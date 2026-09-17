"use client";
import { useState } from "react";
import { MODULES } from "../lib/constants";

export default function NoteTrash({ trashed, onRestore, onPurge, onEmpty, onClose }) {
  const [busy, setBusy] = useState(false);
  const moduleName = (id) => (id ? MODULES.find((m) => m.id === id)?.title.split(",")[0] : "General");

  async function run(fn) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  function daysLeft(deletedAt) {
    const gone = new Date(deletedAt).getTime() + 30 * 24 * 3600 * 1000 - Date.now();
    return Math.max(0, Math.ceil(gone / (24 * 3600 * 1000)));
  }

  return (
    <div className="ex-overlay" onClick={onClose}>
      <div className="ex-box" onClick={(e) => e.stopPropagation()} style={{ width: "min(680px, 96vw)" }}>
        <div className="ex-head">
          <div className="ex-title">Trash <span className="count">{trashed.length}</span></div>
          <button className="ghost small" onClick={onClose}>Close</button>
        </div>

        {trashed.length === 0 ? (
          <div className="empty">Trash is empty.</div>
        ) : (
          <>
            <p className="gen-hint" style={{ marginBottom: 12 }}>
              Deleted notes are kept here and auto-removed after 30 days. Restore to bring one back.
            </p>
            <div className="org-list">
              {trashed.map((n) => (
                <div className="org-row" key={n.id}>
                  <div className="trash-row">
                    <div>
                      <div className="org-note-title" style={{ marginBottom: 2 }}>{n.title}</div>
                      <div className="note-row-tag">
                        {[moduleName(n.module_id), n.functional_area, n.session].filter(Boolean).join(" · ")}
                        {" · "}deletes in {daysLeft(n.deleted_at)}d
                      </div>
                    </div>
                    <div className="dr-actions">
                      <button className="ghost small" disabled={busy} onClick={() => run(() => onRestore(n))}>Restore</button>
                      <button className="danger small" disabled={busy} onClick={() => run(() => onPurge(n))}>Delete forever</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="row" style={{ marginTop: 14 }}>
              <button className="danger" disabled={busy} onClick={() => run(onEmpty)}>Empty trash</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
