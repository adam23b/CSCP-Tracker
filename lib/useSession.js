"use client";
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

export function useSession() {
  const [session, setSession] = useState(undefined); // undefined = not checked yet

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  return session;
}
