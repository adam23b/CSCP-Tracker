"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { MODULES, sessionsFor, isReferenceNote } from "../lib/constants";

export default function NoteOrganizer({ session, notes, onClose, onSaved }) {
  // Notes with a module but no functional area, excluding module-level reference
  // notes (Required Reading), which don't belong to a single session.
  const targets = notes.filter((n) => n.module_id && !n.functional_area && !isReferenceNote(n));

  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState({}); // id -> { functional_area, session }
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    suggest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function suggest() {
    setLoading(true);
    setErr("");
    // Seed drafts empty first (so the UI is usable even if AI fails).
    const seed = {};
    targets.forEach((n) => (seed[n.id] = { functional_area: "", session: "" }));
    setDrafts(seed);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const res = await fetch("/api/tag-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` },
        body: JSON.stringify({
          notes: targets.map((n) => ({ id: n.id, title: n.title, content: n.content, module_id: n.module_id })),
        }),
      });
      const payload = await res.json();
      if (res.ok && Array.isArray(payload.suggestions)) {
        setDrafts((d) => {
          const next = { ...d };
          payload.suggestions.forEach((s) => {
            if (next[s.id]) next[s.id] = { functional_area: s.functional_area || "", session: s.session || "" };
          });
          return next;
        });
      } else if (!res.ok) {
        setErr(payload?.error || "Couldn't get suggestions — you can still assign manually.");
      }
    } catch {
      setErr("Couldn't reach the suggester — you can still assign manually.");
    } finally {
      setLoading(false);
    }
  }

  function setField(id, field, value) {
    setDrafts((d) => {
      const cur = d[id] || { functional_area: "", session: "" };
      const next = { ...cur, [field]: value };
      if (field === "functional_area") next.session = ""; // reset session when area changes
      return { ...d, [id]: next };
    });
  }

  async function saveAll() {
    setSaving(true);
    try {
      for (const n of targets) {
        const dr = drafts[n.id];
        if (!dr || !dr.functional_area) continue; // skip unassigned
        await supabase
          .from("notes")
          .update({ functional_area: dr.functional_area, session: dr.session || null, updated_at: new Date().toISOString() })
          .eq("id", n.id);
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const moduleName = (id) => MODULES.find((m) => m.id === id)?.title.split(",")[0] || "";
  const areasFor = (id) => MODULES.find((m) => m.id === id)?.areas || [];

  return (
    <div className="ex-overlay" onClick={onClose}>
      <div className="ex-box" onClick={(e) => e.stopPropagation()} style={{ width: "min(720px, 96vw)" }}>
        <div className="ex-head">
          <div className="ex-title">Organize notes into the course</div>
          <button className="ghost small" onClick={onClose}>Close</button>
        </div>

        {targets.length === 0 ? (
          <div className="empty">All your module notes are already placed. (Notes with no module can't be placed.)</div>
        ) : (
          <>
            <p className="gen-hint" style={{ marginBottom: 12 }}>
              {loading ? "Suggesting a functional area and session for each note…" :
                "Review the suggested area and session for each note, adjust if needed, then save."}
            </p>
            {err && <div className="gen-error" style={{ marginBottom: 10 }}>{err}</div>}
            <div className="org-list">
              {targets.map((n) => {
                const dr = drafts[n.id] || { functional_area: "", session: "" };
                return (
                  <div className="org-row" key={n.id}>
                    <div className="org-note-title">{n.title} <span className="org-mod">M{n.module_id} · {moduleName(n.module_id)}</span></div>
                    <div className="org-selects">
                      <select value={dr.functional_area} onChange={(e) => setField(n.id, "functional_area", e.target.value)}>
                        <option value="">— functional area —</option>
                        {areasFor(n.module_id).map((a) => <option key={a} value={a}>{a}</option>)}
                      </select>
                      <select value={dr.session} onChange={(e) => setField(n.id, "session", e.target.value)} disabled={!dr.functional_area}>
                        <option value="">— session —</option>
                        {sessionsFor(n.module_id, dr.functional_area).map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="row" style={{ marginTop: 14 }}>
              <button onClick={saveAll} disabled={saving || loading}>{saving ? "Saving…" : "Save placements"}</button>
              <button className="ghost" onClick={onClose}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
