import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';

export interface OwnProfile {
  username: string;
  /** UI gate for the admin screens only. RLS (is_admin()) decides every write. */
  isAdmin: boolean;
}

export interface AuthState {
  /** true until the first session and profile check has finished */
  loading: boolean;
  session: Session | null;
  /** null while signed out, or signed in without a finished sign-up */
  profile: OwnProfile | null;
  /** an error code from bg.errors to show on the sign-in screen (e.g. under_18 after the account was deleted) */
  notice: string | null;
  refreshProfile: () => Promise<void>;
  /** scope 'local' only clears this device, used after the server has already deleted the user */
  signOut: (opts?: { scope?: 'local' | 'global'; notice?: string }) => Promise<void>;
  clearNotice: () => void;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
