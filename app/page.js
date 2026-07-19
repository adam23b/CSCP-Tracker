"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import Auth from "../components/Auth";
import Dashboard from "../components/Dashboard";

export default function Page() {
  const [session, setSession] = useState(undefined); // undefined = not checked yet

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return <div className="wrap"><p className="empty">Loading…</p></div>;
  }
  if (!session) {
    return <Auth />;
  }
  return <Dashboard session={session} />;
}
