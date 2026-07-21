"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { MODULES, STEP_DAYS, dayStr, phaseBoundaries, currentPhaseIndex } from "../lib/constants";
import { uploadImage, publicUrl, deleteImage, newImagePath } from "../lib/storage";
import TodayPlan from "./TodayPlan";

export default function Dashboard({ session }) {
  const userId = session.user.id;
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null); // {start_date, exam_date, target_hours}
  const [progress, setProgress] = useState({}); // {module_id: status}
  const [sessions, setSessions] = useState([]); // [{module_id, minutes}]
  const [cards, setCards] = useState([]);
  const [openModule, setOpenModule] = useState(null);
  const [deckOpen, setDeckOpen] = useState(false);
  const [editingCardId, setEditingCardId] = useState(null);
  const [revealedId, setRevealedId] = useState(null);

  const [examDateInput, setExamDateInput] = useState("");
  const [targetHoursInput, setTargetHoursInput] = useState(100);
  const [cardModule, setCardModule] = useState(1);
  const [cardFront, setCardFront] = useState("");
  const [cardBack, setCardBack] = useState("");
  const [cardImageFile, setCardImageFile] = useState(null);
  const [logModule, setLogModule] = useState(1);
  const [logMinutes, setLogMinutes] = useState("");

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAll() {
    setLoading(true);

    let { data: settingsRow } = await supabase
      .from("settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!settingsRow) {
      const { data: inserted } = await supabase
        .from("settings")
        .insert({ user_id: userId })
        .select()
        .single();
      settingsRow = inserted;
    }
    setSettings(settingsRow);
    setExamDateInput(settingsRow.exam_date);
    setTargetHoursInput(settingsRow.target_hours);

    const { data: progressRows } = await supabase
      .from("modules_progress")
      .select("*")
      .eq("user_id", userId);

    const existingIds = new Set((progressRows || []).map((r) => r.module_id));
    const missing = MODULES.filter((m) => !existingIds.has(m.id)).map((m) => ({
      user_id: userId,
      module_id: m.id,
      status: "todo",
    }));
    if (missing.length) {
      await supabase.from("modules_progress").insert(missing);
    }
    const { data: allProgress } = await supabase
      .from("modules_progress")
      .select("*")
      .eq("user_id", userId);
    const progMap = {};
    (allProgress || []).forEach((r) => (progMap[r.module_id] = r.status));
    setProgress(progMap);

    const { data: sessionRows } = await supabase
      .from("sessions")
      .select("module_id, minutes, logged_at")
      .eq("user_id", userId);
    setSessions(sessionRows || []);

    const { data: cardRows } = await supabase
      .from("cards")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setCards(cardRows || []);

    setLoading(false);
  }

  const hoursByModule = useMemo(() => {
    const map = {};
    MODULES.forEach((m) => (map[m.id] = 0));
    sessions.forEach((s) => {
      map[s.module_id] = (map[s.module_id] || 0) + s.minutes / 60;
    });
    return map;
  }, [sessions]);

  const totalHours = useMemo(
    () => Object.values(hoursByModule).reduce((a, b) => a + b, 0),
    [hoursByModule]
  );

  const doneCount = useMemo(
    () => Object.values(progress).filter((s) => s === "done").length,
    [progress]
  );

  const dueCards = useMemo(() => {
    const today = dayStr(new Date());
    return cards.filter((c) => c.due_date <= today);
  }, [cards]);

  const bounds = settings ? phaseBoundaries(settings.start_date, settings.exam_date) : [];
  const curPhase = settings ? currentPhaseIndex(settings.start_date, settings.exam_date) : 0;

  const pace = useMemo(() => {
    if (!settings) return { remaining: 0, weeksLeft: 0, perWeek: 0 };
    const remaining = Math.max(settings.target_hours - totalHours, 0);
    const weeksLeft = Math.max(
      (new Date(settings.exam_date) - new Date()) / (7 * 24 * 3600 * 1000),
      0
    );
    const perWeek = weeksLeft > 0.1 ? remaining / weeksLeft : remaining;
    return { remaining, weeksLeft, perWeek };
  }, [settings, totalHours]);

  async function saveSettings() {
    const { data } = await supabase
      .from("settings")
      .update({ exam_date: examDateInput, target_hours: parseFloat(targetHoursInput) || 100 })
      .eq("user_id", userId)
      .select()
      .single();
    setSettings(data);
  }

  async function setModuleStatus(moduleId, status) {
    await supabase
      .from("modules_progress")
      .update({ status })
      .eq("user_id", userId)
      .eq("module_id", moduleId);
    setProgress((p) => ({ ...p, [moduleId]: status }));
    setOpenModule(null);
  }

  async function logSession() {
    const mins = parseFloat(logMinutes);
    if (!mins || mins <= 0) return;
    const { data } = await supabase
      .from("sessions")
      .insert({ user_id: userId, module_id: logModule, minutes: mins })
      .select()
      .single();
    setSessions((s) => [...s, data]);
    if (progress[logModule] === "todo") setModuleStatus(logModule, "progress");
    setLogMinutes("");
  }

  async function addCard() {
    if (!cardFront.trim() || !cardBack.trim()) return;
    let image_path = null;
    if (cardImageFile) {
      const ext = (cardImageFile.name.split(".").pop() || "png").toLowerCase();
      image_path = newImagePath(userId, "cards", ext);
      await uploadImage(image_path, cardImageFile);
    }
    const { data } = await supabase
      .from("cards")
      .insert({
        user_id: userId,
        module_id: cardModule,
        front: cardFront.trim(),
        back: cardBack.trim(),
        step: 0,
        due_date: dayStr(new Date()),
        image_path,
      })
      .select()
      .single();
    setCards((c) => [data, ...c]);
    setCardFront("");
    setCardBack("");
    setCardImageFile(null);
  }

  async function gradeCard(card, result) {
    let step = card.step;
    if (result === "again") step = 0;
    else if (result === "good") step = Math.min(step + 1, STEP_DAYS.length - 1);
    else step = Math.min(step + 2, STEP_DAYS.length - 1);
    const d = new Date();
    d.setDate(d.getDate() + STEP_DAYS[step]);
    const due_date = dayStr(d);
    await supabase.from("cards").update({ step, due_date }).eq("id", card.id);
    setCards((cs) => cs.map((c) => (c.id === card.id ? { ...c, step, due_date } : c)));
    setRevealedId(null);
  }

  async function saveCardEdit(id, front, back, module_id, newImageFile, removeImage) {
    const existing = cards.find((c) => c.id === id);
    let image_path = existing?.image_path || null;

    if (removeImage && image_path) {
      await deleteImage(image_path);
      image_path = null;
    }
    if (newImageFile) {
      if (image_path) await deleteImage(image_path);
      const ext = (newImageFile.name.split(".").pop() || "png").toLowerCase();
      image_path = newImagePath(userId, "cards", ext);
      await uploadImage(image_path, newImageFile);
    }

    await supabase.from("cards").update({ front, back, module_id, image_path }).eq("id", id);
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, front, back, module_id, image_path } : c)));
    setEditingCardId(null);
  }

  async function deleteCard(id) {
    const existing = cards.find((c) => c.id === id);
    if (existing?.image_path) await deleteImage(existing.image_path);
    await supabase.from("cards").delete().eq("id", id);
    setCards((cs) => cs.filter((c) => c.id !== id));
  }

  if (loading || !settings) {
    return <p className="empty">Loading your route…</p>;
  }

  const currentDue = dueCards[0];
  const currentDueModule = currentDue ? MODULES.find((m) => m.id === currentDue.module_id) : null;

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="eyebrow">ASCM · CSCP Exam Content Manual v5.0</div>
          <h1>The Route</h1>
        </div>
        <div className="stat-strip">
          <div className="stat"><div className="num">{totalHours.toFixed(1)}</div><div className="lbl">Hrs logged</div></div>
          <div className="stat"><div className="num">{doneCount}/8</div><div className="lbl">Modules cleared</div></div>
          <div className="stat"><div className="num">{dueCards.length}</div><div className="lbl">Cards due</div></div>
        </div>
      </div>

      <TodayPlan settings={settings} progress={progress} sessions={sessions} cards={cards} />

      <div className="pace-card">
        <div className="pace-top">
          <h2>Pace check</h2>
          <div className="pace-inputs">
            <div className="field">
              <label>Expected exam date</label>
              <input type="date" value={examDateInput} onChange={(e) => setExamDateInput(e.target.value)} />
            </div>
            <div className="field">
              <label>Target hours</label>
              <input type="number" style={{ width: 80 }} value={targetHoursInput} onChange={(e) => setTargetHoursInput(e.target.value)} />
            </div>
            <button className="small" onClick={saveSettings}>Save</button>
          </div>
        </div>
        <div className="pace-readout">
          <div><div className="pace-num">{pace.remaining.toFixed(0)}</div><div className="pace-lbl">Hours remaining</div></div>
          <div><div className="pace-num">{pace.weeksLeft.toFixed(0)}</div><div className="pace-lbl">Weeks until exam</div></div>
          <div><div className={"pace-num " + (pace.perWeek > 6 ? "warn" : "ok")}>{pace.perWeek.toFixed(1)}</div><div className="pace-lbl">Hrs/week needed from today</div></div>
        </div>
      </div>

      <div className="route-card">
        <div className="route-title">
          <h2>8 modules, one route</h2>
          <div className="phase-tag">{bounds[curPhase]?.name.split("—")[0].trim()}</div>
        </div>
        <div className="route">
          <div className="route-line"></div>
          <div className="route-line-fill" style={{ width: `${(doneCount / MODULES.length) * 100}%` }}></div>
          <div className="vessel" style={{ left: `${(doneCount / MODULES.length) * 100}%` }}>🚢</div>
          <div className="ports">
            {MODULES.map((m) => {
              const st = progress[m.id] || "todo";
              return (
                <button key={m.id} className={"port " + st} onClick={() => setOpenModule(m.id)}>
                  <div className="port-dot">{st === "done" ? "✓" : m.id}</div>
                  <div className="port-lbl">{m.title.split(",")[0]}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {openModule && (
        <div className="mod-detail">
          <h3>Module {openModule} — {MODULES.find((m) => m.id === openModule).title}</h3>
          <div className="mod-sub">Logged: {hoursByModule[openModule].toFixed(1)} hrs</div>
          <div className="row">
            <select defaultValue={progress[openModule] || "todo"} id="status-select">
              <option value="todo">Not started</option>
              <option value="progress">In progress</option>
              <option value="done">Cleared</option>
            </select>
            <button onClick={() => setModuleStatus(openModule, document.getElementById("status-select").value)}>Update</button>
            <button className="ghost" onClick={() => setOpenModule(null)}>Close</button>
          </div>
        </div>
      )}

      <div className="cols" style={{ marginTop: 20 }}>
        <div className="card">
          <h2>Today at the dock <span className="count">{dueCards.length} due</span></h2>
          {!currentDue ? (
            <div className="empty">Nothing due — clear a module or add cards below.</div>
          ) : (
            <>
              <div className="due-card">
                <div className="tag">M{currentDue.module_id} · {currentDueModule?.title.split(",")[0]}</div>
                <div className="front">{currentDue.front}</div>
                {currentDue.image_path && <img className="card-image" src={publicUrl(currentDue.image_path)} alt="" />}
                {revealedId === currentDue.id && <div className="back">{currentDue.back}</div>}
                {revealedId !== currentDue.id ? (
                  <button className="ghost" onClick={() => setRevealedId(currentDue.id)}>Show answer</button>
                ) : (
                  <div className="btn-row">
                    <button className="danger" onClick={() => gradeCard(currentDue, "again")}>Again</button>
                    <button className="amber" onClick={() => gradeCard(currentDue, "good")}>Good</button>
                    <button onClick={() => gradeCard(currentDue, "easy")}>Easy</button>
                  </div>
                )}
              </div>
              <div className="queue-note">{dueCards.length - 1} more waiting after this one</div>
            </>
          )}

          <div style={{ marginTop: 18, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
            <h2 style={{ fontSize: 13 }}>Add a card</h2>
            <div className="flash-add">
              <select value={cardModule} onChange={(e) => setCardModule(parseInt(e.target.value))}>
                {MODULES.map((m) => <option key={m.id} value={m.id}>M{m.id} — {m.title.split(",")[0]}</option>)}
              </select>
              <textarea placeholder="Front — question, term, or scenario prompt" value={cardFront} onChange={(e) => setCardFront(e.target.value)} />
              <textarea placeholder="Back — answer or explanation" value={cardBack} onChange={(e) => setCardBack(e.target.value)} />
              <div className="file-row">
                <input type="file" accept="image/*" onChange={(e) => setCardImageFile(e.target.files[0] || null)} />
                {cardImageFile && <img className="thumb" src={URL.createObjectURL(cardImageFile)} alt="" />}
              </div>
              <button onClick={addCard}>Add to deck</button>
            </div>
          </div>

          <div style={{ marginTop: 18, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
            <h2 style={{ fontSize: 13 }}>Log a study session</h2>
            <div className="log-form">
              <select value={logModule} onChange={(e) => setLogModule(parseInt(e.target.value))}>
                {MODULES.map((m) => <option key={m.id} value={m.id}>M{m.id} — {m.title.split(",")[0]}</option>)}
              </select>
              <input type="number" placeholder="Minutes" min="5" style={{ width: 90 }} value={logMinutes} onChange={(e) => setLogMinutes(e.target.value)} />
              <button className="amber" onClick={logSession}>Log</button>
            </div>
          </div>

          <div style={{ marginTop: 18, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
            <h2 style={{ fontSize: 13 }}>
              Manage deck <span className="count">{cards.length} cards</span>
              <button className="ghost small" onClick={() => setDeckOpen((o) => !o)}>{deckOpen ? "Hide" : "Show"}</button>
            </h2>
            {deckOpen && (
              <div className="deck-list">
                {cards.length === 0 ? (
                  <div className="empty">No cards yet.</div>
                ) : (
                  cards.map((c) => (
                    <DeckRow
                      key={c.id}
                      card={c}
                      editing={editingCardId === c.id}
                      onEdit={() => setEditingCardId(c.id)}
                      onCancel={() => setEditingCardId(null)}
                      onSave={saveCardEdit}
                      onDelete={deleteCard}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <h2>The four legs</h2>
          <div className="phase-list">
            {bounds.map((p, i) => (
              <div key={i} className={"phase-item " + (i === curPhase ? "current" : "")}>
                <div className="phase-num">{i + 1}</div>
                <div>
                  <div className="phase-name">{p.name} <span style={{ color: "var(--muted)", fontWeight: 400 }}>· ~{p.weeks.toFixed(0)} wks</span></div>
                  <div className="phase-desc">{p.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="footer-note">Route started {settings.start_date} · legs rescale automatically if you move your exam date.</div>
        </div>
      </div>

      <div className="footer-note">Synced to your account — signed in as {session.user.email}.</div>
    </div>
  );
}

function DeckRow({ card, editing, onEdit, onCancel, onSave, onDelete }) {
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);
  const [moduleId, setModuleId] = useState(card.module_id);
  const [newImageFile, setNewImageFile] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const m = MODULES.find((x) => x.id === card.module_id);

  if (editing) {
    return (
      <div className="deck-row">
        <div className="edit-form">
          <select value={moduleId} onChange={(e) => setModuleId(parseInt(e.target.value))}>
            {MODULES.map((mo) => <option key={mo.id} value={mo.id}>M{mo.id} — {mo.title.split(",")[0]}</option>)}
          </select>
          <textarea value={front} onChange={(e) => setFront(e.target.value)} />
          <textarea value={back} onChange={(e) => setBack(e.target.value)} />
          {card.image_path && !removeImage && (
            <div className="thumb-row">
              <img className="thumb" src={publicUrl(card.image_path)} alt="" />
              <button className="ghost small" onClick={() => setRemoveImage(true)}>Remove image</button>
            </div>
          )}
          <div className="file-row">
            <input type="file" accept="image/*" onChange={(e) => setNewImageFile(e.target.files[0] || null)} />
            {newImageFile && <img className="thumb" src={URL.createObjectURL(newImageFile)} alt="" />}
          </div>
          <div className="row">
            <button className="small" onClick={() => onSave(card.id, front, back, moduleId, newImageFile, removeImage)}>Save</button>
            <button className="ghost small" onClick={onCancel}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="deck-row">
      <div className="dr-top">
        <div className="dr-tag">M{card.module_id} · {m?.title.split(",")[0]} · due {card.due_date}</div>
        <div className="dr-actions">
          <button className="ghost small" onClick={onEdit}>Edit</button>
          <button className="danger small" onClick={() => onDelete(card.id)}>Delete</button>
        </div>
      </div>
      <div className="dr-front">{card.front}</div>
      {card.image_path && <img className="thumb" src={publicUrl(card.image_path)} alt="" style={{ marginTop: 6 }} />}
      <div className="dr-back">{card.back}</div>
    </div>
  );
}
