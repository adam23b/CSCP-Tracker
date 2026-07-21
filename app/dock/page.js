"use client";
import { useSession } from "../../lib/useSession";
import Auth from "../../components/Auth";
import DockMode from "../../components/DockMode";

export default function DockPage() {
  const session = useSession();
  if (session === undefined) return <div className="wrap"><p className="empty">Loading…</p></div>;
  if (!session) return <Auth />;
  return <DockMode session={session} />;
}
