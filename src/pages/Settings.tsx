import { useCallback, useEffect, useState } from 'react';
import { Screen } from '../components/Screen';
import { bg } from '../i18n/bg';
import { friendAction, listBlocked, type FriendErrorCode, type Person } from '../lib/friends';
import { getClient } from '../lib/supabase';

/** Settings. For now only the blocked list with unblock (Phase 2). */
export function Settings() {
  const [blocked, setBlocked] = useState<Person[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<FriendErrorCode | null>(null);

  const reload = useCallback(async () => {
    try {
      setBlocked(await listBlocked(getClient()));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void reload(), 0);
    return () => clearTimeout(timer);
  }, [reload]);

  async function unblock(id: string) {
    setBusyId(id);
    setError(null);
    const code = await friendAction(getClient(), 'unblock', id);
    if (code) setError(code);
    await reload();
    setBusyId(null);
  }

  return (
    <Screen title={bg.settings.title}>
      <section className="people" aria-labelledby="blocked-title">
        <h2 id="blocked-title" className="people-title">
          {bg.settings.blocked}
        </h2>
        <p className="field-hint">{bg.settings.blockedHint}</p>
        {failed && <p className="field-error">{bg.settings.loadFailed}</p>}
        {error && (
          <p className="field-error" role="alert">
            {bg.friends.errors[error]}
          </p>
        )}
        {blocked && blocked.length === 0 && <p className="panel-note">{bg.settings.noBlocked}</p>}
        {blocked && blocked.length > 0 && (
          <ul className="people-list">
            {blocked.map((p) => (
              <li key={p.id} className="person">
                <span className="person-name">@{p.username}</span>
                <button
                  type="button"
                  className="button button-small button-ghost"
                  disabled={busyId === p.id}
                  onClick={() => void unblock(p.id)}
                >
                  {bg.settings.unblock}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Screen>
  );
}
