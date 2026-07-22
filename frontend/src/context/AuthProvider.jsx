import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase, isConfigured } from "@/lib/supabase";

const AuthContext = createContext({ session: null, user: null, loading: true });

/**
 * Supabase session, kept in sync with the tab.
 *
 * getSession() reads the persisted session so a reload does not bounce the user
 * back to the login screen, and onAuthStateChange keeps it current when a token
 * refreshes or the user signs out in another tab.
 */
export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return undefined;
    }
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data?.session ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });

    return () => {
      active = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signOut: () => supabase.auth.signOut(),
    }),
    [session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
export default AuthProvider;
