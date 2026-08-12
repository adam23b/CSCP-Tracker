"use client";
import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { ADMIN_EMAIL } from "../lib/constants";

export default function Settings({ session }) {
  const email = session.user.email || "";
  const isAdmin = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  const [recipient, setRecipient] = useState("");
  const [sharing, setSharing] = useState(false);
  const [shareMsg, setShareMsg] = useState("");
  const [shareErr, setShareErr] = useState("");

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState("");

  async function share() {
    if (!recipient.trim()) return;
    setSharing(true);
    setShareMsg("");
    setShareErr("");
    const { data, error } = await supabase.rpc("share_deck", { recipient_email: recipient.trim() });
    setSharing(false);
    if (error) {
      setShareErr(error.message || "Couldn't share. Try again.");
      return;
    }
    setShareMsg(
      `Shared: ${data?.cards_copied ?? 0} card${data?.cards_copied === 1 ? "" : "s"} and ${data?.notes_copied ?? 0} note${data?.notes_copied === 1 ? "" : "s"} copied to ${recipient.trim()}.`,
    );
    setRecipient("");
  }

  async function deleteAllCards() {
    setDeleting(true);
    setDeleteMsg("");
    const { error, count } = await supabase
      .from("cards")
      .delete({ count: "exact" })
      .eq("user_id", session.user.id);
    setDeleting(false);
    setConfirmDelete(false);
    if (error) {
      setDeleteMsg("Couldn't delete. Try again.");
      return;
    }
    setDeleteMsg(`Deleted ${count ?? "all"} flashcard${count === 1 ? "" : "s"}. Your notes are untouched.`);
  }

  if (!isAdmin) {
    return (
      <div className="card" style={{ maxWidth: 620, margin: "0 auto" }}>
        <h2>Settings</h2>
        <div className="empty">Settings are available to the account owner only.</div>
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: 620, margin: "0 auto" }}>
      <h2>Settings</h2>

      <div className="eyebrow" style={{ marginTop: 6 }}>Share your deck</div>
      <p className="gen-hint" style={{ margin: "6px 0 10px" }}>
        Copy your current flashcards and notes into another user&apos;s account. They get their own
        independent copy with a fresh review schedule. The recipient must have signed into the app at
        least once. Re-sharing only adds new items.
      </p>
      <div className="note-form">
        <input
          type="email"
          placeholder="Recipient's email"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
        />
        <div className="row">
          <button onClick={share} disabled={sharing || !recipient.trim()}>
            {sharing ? "Sharing…" : "Share my deck & notes"}
          </button>
        </div>
        {shareErr && <div className="gen-error">{shareErr}</div>}
        {shareMsg && <div className="gen-success">{shareMsg}</div>}
      </div>

      <div style={{ marginTop: 24, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
        <div className="eyebrow" style={{ color: "var(--danger)" }}>Danger zone</div>
        <p className="gen-hint" style={{ margin: "6px 0 10px" }}>
          Permanently delete all of your flashcards and start fresh. Your notes are not affected.
          This cannot be undone.
        </p>
        {!confirmDelete ? (
          <button className="danger" onClick={() => setConfirmDelete(true)}>
            Delete all my flashcards
          </button>
        ) : (
          <div className="row">
            <button className="danger" onClick={deleteAllCards} disabled={deleting}>
              {deleting ? "Deleting…" : "Yes, delete them all"}
            </button>
            <button className="ghost" onClick={() => setConfirmDelete(false)}>Cancel</button>
          </div>
        )}
        {deleteMsg && <div className="gen-success" style={{ marginTop: 10 }}>{deleteMsg}</div>}
      </div>
    </div>
  );
}
