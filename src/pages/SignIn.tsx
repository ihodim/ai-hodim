import { useState, type FormEvent } from 'react';
import { Wordmark } from '../components/Wordmark';
import { bg } from '../i18n/bg';
import { useAuth } from '../lib/auth-context';
import { supabase } from '../lib/supabase';

// Google or email magic link (Q5). No passwords anywhere in the UI.
export function SignIn() {
  const { notice, clearNotice } = useAuth();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectTo = window.location.origin;

  async function google() {
    if (!supabase) return;
    clearNotice();
    setError(null);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (err) setError(bg.auth.failed);
  }

  async function sendLink(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    clearNotice();
    setError(null);
    setBusy(true);
    const address = email.trim();
    const { error: err } = await supabase.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
    });
    setBusy(false);
    if (err) setError(bg.auth.failed);
    else setSentTo(address);
  }

  return (
    <main className="home">
      <div className="home-sign">
        <Wordmark />
        <p className="home-tagline">{bg.tagline}</p>
      </div>

      <div className="home-foot auth">
        {notice && (
          <p className="notice" role="alert">
            {bg.errors[notice] ?? bg.errors.generic}
          </p>
        )}

        {sentTo ? (
          <div className="auth-sent" role="status">
            <h2 className="auth-sent-title">{bg.auth.sentTitle}</h2>
            <p className="auth-sent-body">
              {bg.auth.sentBody} <strong>{sentTo}</strong>
            </p>
            <button type="button" className="link-button" onClick={() => setSentTo(null)}>
              {bg.auth.sentAgain}
            </button>
          </div>
        ) : (
          <>
            <button type="button" className="button button-wide" onClick={google}>
              {bg.auth.google}
            </button>

            <form className="auth-email" onSubmit={sendLink}>
              <label className="field-label" htmlFor="email">
                {bg.auth.or}
              </label>
              <input
                id="email"
                className="input"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                placeholder={bg.auth.emailPlaceholder}
                aria-label={bg.auth.emailLabel}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button type="submit" className="button button-ghost button-wide" disabled={busy}>
                {busy ? bg.auth.sending : bg.auth.sendLink}
              </button>
            </form>
          </>
        )}

        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <p className="home-soon">{bg.auth.adultsOnly}</p>
      </div>
    </main>
  );
}
