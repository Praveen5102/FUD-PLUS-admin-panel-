import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import type { Profile, AuthUser } from "../types";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  // Set when a profile has no recognized role, so LoginPage can show a
  // clear explanation instead of just silently bouncing them back.
  const [blocked, setBlocked] = useState(false);

  const fetchProfile = useCallback(async (authUserId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*, user_roles(id, name, description), departments(id, name)")
      .eq("auth_user_id", authUserId)
      .single();

    if (data) {
      const role = (data.user_roles as { name: AuthUser["role"] } | null)?.name as AuthUser["role"];
      // Every staff/employee role gets a web session now — admin/hr land on
      // the admin Layout, employee/manager land on EmployeeLayout (see
      // App.tsx), mirroring the mobile app's AppNavigator split. Only a
      // missing/unrecognized role is blocked.
      const knownRoles: AuthUser["role"][] = ["super_admin", "admin", "hr", "manager", "employee"];
      if (!knownRoles.includes(role)) {
        await supabase.auth.signOut();
        setUser(null);
        setBlocked(true);
      } else {
        setUser({ profile: data as Profile, role });
      }
    }
    setLoading(false);
  }, []);

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
  }, [fetchProfile]);

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
