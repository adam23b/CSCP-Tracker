"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { MODULES } from "../lib/constants";
import { uploadImage, publicUrl, deleteImage, newImagePath } from "../lib/storage";
import DrawingPad from "./DrawingPad";

export default function Notes({ session }) {
  const userId = session.user.id;
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [moduleId, setModuleId] = useState("0");
  const [content, setContent] = useState("");
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
    for (const path of note.image_paths || []) {
      await deleteImage(path);
    }
    await supabase.from("notes").delete().eq("id", note.id);
    setNotes((ns) => ns.filter((n) => n.id !== note.id));
    if (editingId === note.id) resetForm();
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
    return map;
  }, [notes]);

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
          <select value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
            <option value="0">General (no module)</option>
            {MODULES.map((m) => <option key={m.id} value={m.id}>M{m.id} — {m.title.split(",")[0]}</option>)}
          </select>
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
        <h2>Your notes <span className="count">{notes.length}</span></h2>
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
                          <button className="note-row-title" onClick={() => setViewingNoteId(n.id)}>
                            {n.title}
                            {n.image_paths && n.image_paths.length > 0 && <span className="note-row-icon"> 🖼</span>}
                          </button>
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

      {drawOpen && <DrawingPad onSave={addDrawing} onCancel={() => setDrawOpen(false)} />}

      {viewingNote && (
        <div className="note-viewer-overlay" onClick={() => setViewingNoteId(null)}>
          <div className="note-viewer-box" onClick={(e) => e.stopPropagation()}>
            <div className="note-top">
              <div>
                <div className="note-tag">{moduleTitle(viewingNote.module_id)}</div>
                <div className="note-title" style={{ fontSize: 19 }}>{viewingNote.title}</div>
              </div>
              <div className="dr-actions">
                <button className="ghost small" onClick={() => { editNote(viewingNote); setViewingNoteId(null); }}>Edit</button>
                <button className="danger small" onClick={() => { deleteNote(viewingNote); setViewingNoteId(null); }}>Delete</button>
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
