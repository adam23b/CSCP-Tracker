"use client";
import { useSession } from "../../lib/useSession";
import Auth from "../../components/Auth";
import NavBar from "../../components/NavBar";
import Settings from "../../components/Settings";

export default function SettingsPage() {
  const session = useSession();
  if (session === undefined) return <div className="wrap"><p className="empty">Loading…</p></div>;
  if (!session) return <Auth />;

  return (
    <div className="wrap">
      <NavBar active="settings" />
      <Settings session={session} />
    </div>
  );
}
