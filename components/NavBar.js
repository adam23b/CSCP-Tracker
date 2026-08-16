"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import { ADMIN_EMAIL } from "../lib/constants";

export default function NavBar({ active }) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsAdmin((data.user?.email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase());
    });
  }, []);

  return (
    <div className="navbar">
      <div className="navlinks">
        <Link href="/" className={active === "route" ? "navlink active" : "navlink"}>Route</Link>
        <Link href="/dock" className="navlink dock-navlink">⚓ Dock</Link>
        <Link href="/notes" className={active === "notes" ? "navlink active" : "navlink"}>Notes</Link>
        <Link href="/generate" className={active === "generate" ? "navlink active" : "navlink"}>Generate</Link>
        <Link href="/readiness" className={active === "readiness" ? "navlink active" : "navlink"}>Readiness</Link>
        <Link href="/plan" className={active === "plan" ? "navlink active" : "navlink"}>Study Plan</Link>
        <Link href="/how-it-works" className={active === "how" ? "navlink active" : "navlink"}>How It Works</Link>
        {isAdmin && <Link href="/settings" className={active === "settings" ? "navlink active" : "navlink"}>Settings</Link>}
      </div>
      <button className="signout" onClick={() => supabase.auth.signOut()}>Sign out</button>
    </div>
  );
}
