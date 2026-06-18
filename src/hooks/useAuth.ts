import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import type { Profile, AuthUser } from "../types";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  // Set when a non-admin (employee) account tries to sign in here, so
  // LoginPage can show a clear "mobile only" popup instead of just
  // silently bouncing them back with no explanation.
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) fetchProfile(session.user.id);
      else { setUser(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(authUserId: string) {
    const { data } = await supabase
      .from("profiles")
      .select("*, user_roles(id, name, description), departments(id, name)")
      .eq("auth_user_id", authUserId)
      .single();

    if (data) {
      const role = (data.user_roles as any)?.name as AuthUser["role"];
      if (!["super_admin", "admin"].includes(role)) {
        await supabase.auth.signOut();
        setUser(null);
        setBlocked(true);
      } else {
        setUser({ profile: data as Profile, role });
      }
    }
    setLoading(false);
  }

  async function signIn(email: string, password: string) {
    setBlocked(false);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
  }

  function dismissBlocked() {
    setBlocked(false);
  }

  return { user, loading, blocked, signIn, signOut, dismissBlocked };
}
