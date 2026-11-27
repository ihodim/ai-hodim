import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../lib/database.types';
import { AuthContext, type AuthState, type OwnProfile } from '../lib/auth-context';

async function loadOwnProfile(client: SupabaseClient<Database>, userId: string): Promise<OwnProfile | null> {
  const { data, error } = await client
    .from('profiles')
    .select('username, is_admin')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? { username: data.username, isAdmin: data.is_admin } : null;
}

export function AuthProvider({
  client,
  children,
}: {
  client: SupabaseClient<Database>;
  children: ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<OwnProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const sync = useCallback(
    async (next: Session | null) => {
      setSession(next);
      if (!next) {
        setProfile(null);
        setLoading(false);
        return;
      }
      try {
        setProfile(await loadOwnProfile(client, next.user.id));
      } catch {
        setProfile(null);
      }
      setLoading(false);
    },
    [client],
  );

  useEffect(() => {
    let active = true;
    // onAuthStateChange fires INITIAL_SESSION first, which also covers a magic-link or OAuth redirect.
    // The callback must not await Supabase calls directly (it holds the auth lock), so defer the work.
    const { data } = client.auth.onAuthStateChange((event, next) => {
      if (!active || event === 'TOKEN_REFRESHED') return;
      setTimeout(() => {
        if (active) void sync(next);
      }, 0);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client, sync]);

  const refreshProfile = useCallback(async () => {
    const { data } = await client.auth.getSession();
    await sync(data.session);
  }, [client, sync]);

  const signOut = useCallback<AuthState['signOut']>(
    async (opts) => {
      await client.auth.signOut({ scope: opts?.scope ?? 'global' });
      setNotice(opts?.notice ?? null);
      await sync(null);
    },
    [client, sync],
  );

  const clearNotice = useCallback(() => setNotice(null), []);

  const value = useMemo<AuthState>(
    () => ({ loading, session, profile, notice, refreshProfile, signOut, clearNotice }),
    [loading, session, profile, notice, refreshProfile, signOut, clearNotice],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
