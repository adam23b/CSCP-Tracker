"use client";
import { useSession } from "../../lib/useSession";
import Auth from "../../components/Auth";
import NavBar from "../../components/NavBar";
import Readiness from "../../components/Readiness";

export default function ReadinessPage() {
  const session = useSession();
  if (session === undefined) return <div className="wrap"><p className="empty">Loading…</p></div>;
  if (!session) return <Auth />;

  return (
    <div className="wrap">
      <NavBar active="readiness" />
      <Readiness session={session} />
    </div>
  );
}
