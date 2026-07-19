"use client";
import { useSession } from "../../lib/useSession";
import Auth from "../../components/Auth";
import NavBar from "../../components/NavBar";
import Notes from "../../components/Notes";

export default function NotesPage() {
  const session = useSession();
  if (session === undefined) return <div className="wrap"><p className="empty">Loading…</p></div>;
  if (!session) return <Auth />;

  return (
    <div className="wrap">
      <NavBar active="notes" />
      <Notes session={session} />
    </div>
  );
}
