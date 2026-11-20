import { FunctionsHttpError } from '@supabase/supabase-js';
import { useState, type FormEvent } from 'react';
import { bg } from '../i18n/bg';
import { todayUtc } from '../lib/age';
import { useAuth } from '../lib/auth-context';
import { supabase } from '../lib/supabase';
import { isValidUsername } from '../lib/username';

type FieldError = { field: 'username' | 'dob' | 'form'; code: string };

// The door check: username + date of birth. The server (complete-signup) has the final word; these
// client checks use the same shared rules only to give faster feedback.
export function Onboarding() {
  const { refreshProfile, signOut } = useAuth();
  const [username, setUsername] = useState('');
  const [dob, setDob] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FieldError | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase || busy) return;

    const name = username.trim();
    if (!isValidUsername(name)) return setError({ field: 'username', code: 'invalid_username' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return setError({ field: 'dob', code: 'invalid_date' });
    // An under-18 date is still sent: the server deletes the account and answers under_18 (Q6).

    setError(null);
    setBusy(true);
    const { error: err } = await supabase.functions.invoke('complete-signup', {
      body: { username: name, date_of_birth: dob },
    });

    if (!err) {
      await refreshProfile();
      return;
    }

    let code = 'generic';
    if (err instanceof FunctionsHttpError) {
      try {
        const body: unknown = await err.context.json();
        if (body && typeof body === 'object' && 'code' in body && typeof body.code === 'string')
          code = body.code;
      } catch {
        // keep generic
      }
    }
    setBusy(false);

    if (code === 'under_18') {
      // The server deleted the auth user; only clear this device and say why on the sign-in screen.
      await signOut({ scope: 'local', notice: 'under_18' });
      return;
    }
    if (code === 'already_completed') {
      await refreshProfile();
      return;
    }
    setError({ field: code === 'invalid_date' ? 'dob' : code === 'generic' ? 'form' : 'username', code });
  }

  const message = (code: string) => bg.errors[code] ?? bg.errors.generic;

  return (
    <main className="door">
      <header className="door-head">
        <h1 className="door-title">{bg.onboarding.title}</h1>
        <p className="door-intro">{bg.onboarding.intro}</p>
      </header>

      <form className="door-form" onSubmit={submit} noValidate>
        <div className="field">
          <label className="field-label" htmlFor="username">
            {bg.onboarding.usernameLabel}
          </label>
          <div className="input-at">
            <span aria-hidden="true">@</span>
            <input
              id="username"
              className="input"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={20}
              value={username}
              aria-invalid={error?.field === 'username'}
              aria-describedby="username-hint"
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          {error?.field === 'username' ? (
            <p id="username-hint" className="field-error" role="alert">
              {message(error.code)}
            </p>
          ) : (
            <p id="username-hint" className="field-hint">
              {bg.onboarding.usernameHint}
            </p>
          )}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="dob">
            {bg.onboarding.dobLabel}
          </label>
          <input
            id="dob"
            className="input"
            type="date"
            max={todayUtc()}
            value={dob}
            aria-invalid={error?.field === 'dob'}
            aria-describedby="dob-hint"
            onChange={(e) => setDob(e.target.value)}
          />
          {error?.field === 'dob' ? (
            <p id="dob-hint" className="field-error" role="alert">
              {message(error.code)}
            </p>
          ) : (
            <p id="dob-hint" className="field-hint">
              {bg.onboarding.dobHint}
            </p>
          )}
        </div>

        {error?.field === 'form' && (
          <p className="field-error" role="alert">
            {message(error.code)}
          </p>
        )}

        <button type="submit" className="button button-wide" disabled={busy}>
          {busy ? bg.onboarding.submitting : bg.onboarding.submit}
        </button>
        <button type="button" className="link-button" onClick={() => void signOut()}>
          {bg.onboarding.signOut}
        </button>
      </form>
    </main>
  );
}
