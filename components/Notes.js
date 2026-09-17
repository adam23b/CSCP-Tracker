"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { MODULES, sessionsFor, courseSortKey, isReferenceNote } from "../lib/constants";
import { uploadImage, publicUrl, deleteImage, newImagePath } from "../lib/storage";
import DrawingPad from "./DrawingPad";
import NoteOrganizer from "./NoteOrganizer";

// Order notes to match the course: module → functional area → session, then oldest-first.
// "Required Reading" is a module-level reference — pin it to the top of its module.
function noteKey(n) {
  if (isReferenceNote(n)) return [MODULES.findIndex((m) => m.id === n.module_id), -1, -1];
  return courseSortKey(n.module_id, n.functional_area, n.session);
}
function cmpNotes(a, b) {
  const ka = noteKey(a);
  const kb = noteKey(b);
  for (let i = 0; i < 3; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
  return (a.created_at || "") < (b.created_at || "") ? -1 : 1;
}

export default function Notes({ session }) {
  const userId = session.user.id;
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [moduleId, setModuleId] = useState("0");
  const [area, setArea] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [content, setContent] = useState("");
  const [organizerOpen, setOrganizerOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]); // File objects not yet uploaded
  const [drawOpen, setDrawOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [openGroups, setOpenGroups] = useState({ 0: true });
  const [viewingNoteId, setViewingNoteId] = useState(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("notes")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setNotes(data || []);
    setLoading(false);
  }

  function addFiles(fileList) {
    setPendingFiles((f) => [...f, ...Array.from(fileList)]);
  }
  function addDrawing(file) {
    setPendingFiles((f) => [...f, file]);
    setDrawOpen(false);
  }
  function removePendingFile(idx) {
    setPendingFiles((f) => f.filter((_, i) => i !== idx));
  }

  function resetForm() {
    setTitle("");
    setModuleId("0");
    setArea("");
    setSessionName("");
    setContent("");
    setPendingFiles([]);
    setEditingId(null);
  }

  async function saveNote() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const uploadedPaths = [];
      for (const file of pendingFiles) {
        const ext = (file.name.split(".").pop() || "png").toLowerCase();
        const path = newImagePath(userId, "notes", ext);
        await uploadImage(path, file);
        uploadedPaths.push(path);
      }

      if (editingId) {
        const existing = notes.find((n) => n.id === editingId);
        const image_paths = [...(existing?.image_paths || []), ...uploadedPaths];
        const { data } = await supabase
          .from("notes")
          .update({
            title: title.trim(),
            module_id: moduleId === "0" ? null : parseInt(moduleId),
            functional_area: moduleId === "0" ? null : area || null,
            session: moduleId === "0" || !area ? null : sessionName || null,
            content,
            image_paths,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingId)
          .select()
          .single();
        setNotes((ns) => ns.map((n) => (n.id === editingId ? data : n)));
      } else {
        const { data } = await supabase
          .from("notes")
          .insert({
            user_id: userId,
            title: title.trim(),
            module_id: moduleId === "0" ? null : parseInt(moduleId),
            functional_area: moduleId === "0" ? null : area || null,
            session: moduleId === "0" || !area ? null : sessionName || null,
            content,
            image_paths: uploadedPaths,
          })
          .select()
          .single();
        setNotes((ns) => [data, ...ns]);
      }
      resetForm();
    } finally {
      setSaving(false);
    }
  }

  function editNote(note) {
    setEditingId(note.id);
    setTitle(note.title);
    setModuleId(note.module_id ? String(note.module_id) : "0");
    setArea(note.functional_area || "");
    setSessionName(note.session || "");
    setContent(note.content || "");
    setPendingFiles([]);
  }

  async function removeImageFromNote(note, path) {
    const image_paths = (note.image_paths || []).filter((p) => p !== path);
    await supabase.from("notes").update({ image_paths }).eq("id", note.id);
    await deleteImage(path);
    setNotes((ns) => ns.map((n) => (n.id === note.id ? { ...n, image_paths } : n)));
  }

  async function deleteNote(note) {
    if (!window.confirm(`Delete note "${note.title}"?\n\nThis can't be undone.`)) return false;
    for (const path of note.image_paths || []) {
      await deleteImage(path);
    }
    await supabase.from("notes").delete().eq("id", note.id);
    setNotes((ns) => ns.filter((n) => n.id !== note.id));
    if (editingId === note.id) resetForm();
    return true;
  }

  const moduleTitle = (id) => (id ? MODULES.find((m) => m.id === id)?.title.split(",")[0] : "General");

  const groups = useMemo(() => {
    const map = {};
    map[0] = { title: "General", notes: [] };
    MODULES.forEach((m) => (map[m.id] = { title: m.title.split(",")[0], notes: [] }));
    notes.forEach((n) => {
      const key = n.module_id || 0;
      if (!map[key]) map[key] = { title: moduleTitle(n.module_id), notes: [] };
      map[key].notes.push(n);
    });
    Object.values(map).forEach((g) => g.notes.sort(cmpNotes));
    return map;
  }, [notes]);

  const untaggedCount = useMemo(
    () => notes.filter((n) => n.module_id && !n.functional_area && !isReferenceNote(n)).length,
    [notes],
  );

  function toggleGroup(key) {
    setOpenGroups((g) => ({ ...g, [key]: !g[key] }));
  }

  const viewingNote = viewingNoteId ? notes.find((n) => n.id === viewingNoteId) : null;

  return (
    <div className="cols">
      <div className="card">
        <h2>{editingId ? "Edit note" : "New note"}</h2>
        <div className="note-form">
          <input type="text" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <select value={moduleId} onChange={(e) => { setModuleId(e.target.value); setArea(""); setSessionName(""); }}>
            <option value="0">General (no module)</option>
            {MODULES.map((m) => <option key={m.id} value={m.id}>M{m.id} — {m.title.split(",")[0]}</option>)}
          </select>
          {moduleId !== "0" && (
            <>
              <select value={area} onChange={(e) => { setArea(e.target.value); setSessionName(""); }}>
                <option value="">Functional area (optional)</option>
                {(MODULES.find((m) => m.id === parseInt(moduleId))?.areas || []).map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              {area && (
                <select value={sessionName} onChange={(e) => setSessionName(e.target.value)}>
                  <option value="">Session (optional)</option>
                  {sessionsFor(parseInt(moduleId), area).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
            </>
          )}
          <textarea placeholder="Notes, worked examples, anything text-based…" value={content} onChange={(e) => setContent(e.target.value)} />

          <div className="file-row">
            <input type="file" accept="image/*" multiple onChange={(e) => addFiles(e.target.files)} />
            <button className="ghost small" onClick={() => setDrawOpen(true)}>Draw a sketch</button>
          </div>

          {pendingFiles.length > 0 && (
            <div className="thumb-row">
              {pendingFiles.map((f, i) => (
                <div key={i} style={{ position: "relative" }}>
                  <img className="thumb" src={URL.createObjectURL(f)} alt="" />
                  <button
                    className="danger small"
                    style={{ position: "absolute", top: -8, right: -8, padding: "2px 6px", borderRadius: "50%" }}
                    onClick={() => removePendingFile(i)}
                  >×</button>
                </div>
              ))}
            </div>
          )}

          <div className="row">
            <button onClick={saveNote} disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "Add note"}</button>
            {editingId && <button className="ghost" onClick={resetForm}>Cancel</button>}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>
          <span>Your notes <span className="count">{notes.length}</span></span>
          {untaggedCount > 0 && (
            <button className="ghost small" onClick={() => setOrganizerOpen(true)}>Organize ({untaggedCount})</button>
          )}
        </h2>
        {loading ? (
          <div className="empty">Loading…</div>
        ) : (
          <div className="notes-groups">
            {Object.entries(groups).map(([key, group]) => (
              <div className="note-group" key={key}>
                <button className="note-group-header" onClick={() => toggleGroup(key)}>
                  <span>{openGroups[key] ? "▾" : "▸"} {group.title}</span>
                  <span className="count">{group.notes.length}</span>
                </button>
                {openGroups[key] && (
                  <div className="note-group-body">
                    {group.notes.length === 0 ? (
                      <div className="empty">No notes yet.</div>
                    ) : (
                      group.notes.map((n) => (
                        <div className="note-row" key={n.id}>
                          <div className="note-row-main">
                            <button className="note-row-title" onClick={() => setViewingNoteId(n.id)}>
                              {n.title}
                              {n.image_paths && n.image_paths.length > 0 && <span className="note-row-icon"> 🖼</span>}
                            </button>
                            {isReferenceNote(n) ? (
                              <div className="note-row-tag note-row-ref">Reference</div>
                            ) : (n.functional_area || n.session) ? (
                              <div className="note-row-tag">{[n.functional_area, n.session].filter(Boolean).join(" · ")}</div>
                            ) : null}
                          </div>
                          <button className="danger small" onClick={() => deleteNote(n)}>Delete</button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {organizerOpen && (
        <NoteOrganizer
          session={session}
          notes={notes}
          onClose={() => setOrganizerOpen(false)}
          onSaved={load}
        />
      )}

      {drawOpen && <DrawingPad onSave={addDrawing} onCancel={() => setDrawOpen(false)} />}

      {viewingNote && (
        <div className="note-viewer-overlay" onClick={() => setViewingNoteId(null)}>
          <div className="note-viewer-box" onClick={(e) => e.stopPropagation()}>
            <div className="note-top">
              <div>
                <div className="note-tag">{[moduleTitle(viewingNote.module_id), viewingNote.functional_area, viewingNote.session].filter(Boolean).join(" · ")}</div>
                <div className="note-title" style={{ fontSize: 19 }}>{viewingNote.title}</div>
              </div>
              <div className="dr-actions">
                <button className="ghost small" onClick={() => { editNote(viewingNote); setViewingNoteId(null); }}>Edit</button>
                <button className="danger small" onClick={async () => { if (await deleteNote(viewingNote)) setViewingNoteId(null); }}>Delete</button>
                <button className="ghost small" onClick={() => setViewingNoteId(null)}>Close</button>
              </div>
            </div>
            {viewingNote.content && <div className="note-content">{viewingNote.content}</div>}
            {viewingNote.image_paths && viewingNote.image_paths.length > 0 && (
              <div className="note-viewer-images">
                {viewingNote.image_paths.map((p) => (
                  <img key={p} className="note-viewer-image" src={publicUrl(p)} alt="" onClick={() => setLightbox(p)} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {lightbox && (
        <div className="drawpad-overlay" onClick={() => setLightbox(null)}>
          <img src={publicUrl(lightbox)} alt="" style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 10 }} />
        </div>
      )}
    </div>
  );
}
