"use client";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

export default function NavBar({ active }) {
  return (
    <div className="navbar">
      <div className="navlinks">
        <Link href="/" className={active === "route" ? "navlink active" : "navlink"}>Route</Link>
        <Link href="/notes" className={active === "notes" ? "navlink active" : "navlink"}>Notes</Link>
        <Link href="/plan" className={active === "plan" ? "navlink active" : "navlink"}>Study Plan</Link>
        <Link href="/how-it-works" className={active === "how" ? "navlink active" : "navlink"}>How It Works</Link>
      </div>
      <button className="signout" onClick={() => supabase.auth.signOut()}>Sign out</button>
    </div>
  );
}
