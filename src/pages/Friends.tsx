import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Screen } from '../components/Screen';
import { bg } from '../i18n/bg';
import { useAuth } from '../lib/auth-context';
import {
  findUser,
  friendAction,
  groupFriendships,
  type FriendAction,
  type FriendErrorCode,
  type Person,
} from '../lib/friends';
import { getClient } from '../lib/supabase';
import { useFriendships } from '../lib/use-friendships';
import { isValidUsername } from '../lib/username';

type SearchState =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'none' }
  | { kind: 'found'; person: Person }
  | { kind: 'error' };

export function Friends() {
  const { session, profile } = useAuth();
  const myId = session?.user.id ?? '';
  const { rows, failed, reload } = useFriendships();
  const groups = useMemo(() => (rows ? groupFriendships(rows, myId) : null), [rows, myId]);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<FriendErrorCode | null>(null);

  async function act(action: FriendAction, id: string) {
    setBusyId(id);
    setError(null);
    const code = await friendAction(getClient(), action, id);
    if (code) setError(code);
    await reload();
    setBusyId(null);
  }

  return (
    <Screen title={bg.friends.title}>
      {profile && <MyName username={profile.username} />}
      <Search myId={myId} />

      {error && (
        <p className="field-error" role="alert">
          {bg.friends.errors[error]}
        </p>
      )}

      {failed && !groups && (
        <div className="panel">
          <p className="panel-error">{bg.friends.loadFailed}</p>
          <button type="button" className="button button-ghost" onClick={() => void reload()}>
            {bg.friends.retry}
          </button>
        </div>
      )}

      {groups && groups.incoming.length > 0 && (
        <section className="people" aria-labelledby="incoming-title">
          <h2 id="incoming-title" className="people-title">
            {bg.friends.incoming} <span className="count">{groups.incoming.length}</span>
          </h2>
          <ul className="people-list">
            {groups.incoming.map((p) => (
              <li key={p.id} className="person">
                <PersonLink person={p} />
                <div className="row">
                  <button
                    type="button"
                    className="button button-small"
                    disabled={busyId === p.id}
                    onClick={() => void act('accept', p.id)}
                  >
                    {bg.friends.accept}
                  </button>
                  <button
                    type="button"
                    className="button button-small button-ghost"
                    disabled={busyId === p.id}
                    onClick={() => void act('decline', p.id)}
                  >
                    {bg.friends.decline}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {groups && (
        <section className="people" aria-labelledby="friends-title">
          <h2 id="friends-title" className="people-title">
            {bg.friends.list} <span className="count">{groups.friends.length}</span>
          </h2>
          {groups.friends.length === 0 ? (
            <p className="panel-note">{bg.friends.noFriends}</p>
          ) : (
            <ul className="people-list">
              {groups.friends.map((p) => (
                <li key={p.id} className="person">
                  <PersonLink person={p} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {groups && groups.outgoing.length > 0 && (
        <section className="people" aria-labelledby="outgoing-title">
          <h2 id="outgoing-title" className="people-title">
            {bg.friends.outgoing}
          </h2>
          <ul className="people-list">
            {groups.outgoing.map((p) => (
              <li key={p.id} className="person">
                <PersonLink person={p} />
                <button
                  type="button"
                  className="button button-small button-ghost"
                  disabled={busyId === p.id}
                  onClick={() => void act('cancel', p.id)}
                >
                  {bg.friends.cancel}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Screen>
  );
}

function PersonLink({ person }: { person: Person }) {
  return (
    <Link className="person-name" to={`/u/${encodeURIComponent(person.username)}`}>
      @{person.username}
    </Link>
  );
}

/** My own username with a copy button, so I can send it to friends in another app. */
function MyName({ username }: { username: string }) {
  const [copied, setCopied] = useState(false);
  const canCopy = typeof navigator !== 'undefined' && !!navigator.clipboard;

  async function copy() {
    try {
      await navigator.clipboard.writeText(username);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard refused: the name is on screen to copy by hand
    }
  }

  return (
    <div className="myname">
      <div>
        <p className="field-label">{bg.friends.you}</p>
        <p className="myname-value">@{username}</p>
        <p className="field-hint">{bg.friends.shareHint}</p>
      </div>
      {canCopy && (
        <button type="button" className="button button-small button-ghost" onClick={() => void copy()}>
          <span aria-live="polite">{copied ? bg.friends.copied : bg.friends.copy}</span>
        </button>
      )}
    </div>
  );
}

function Search({ myId }: { myId: string }) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<SearchState>({ kind: 'idle' });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const name = query.trim().replace(/^@/, '');
    if (!name || state.kind === 'busy') return;
    // A name that breaks the username rules can't exist, so skip the round trip.
    if (!isValidUsername(name)) return setState({ kind: 'none' });
    setState({ kind: 'busy' });
    try {
      const person = await findUser(getClient(), name);
      setState(person ? { kind: 'found', person } : { kind: 'none' });
    } catch {
      setState({ kind: 'error' });
    }
  }

  return (
    <form className="search" onSubmit={submit} role="search" noValidate>
      <label className="field-label" htmlFor="friend-search">
        {bg.friends.searchLabel}
      </label>
      <div className="row row-fill">
        <div className="input-at">
          <span aria-hidden="true">@</span>
          <input
            id="friend-search"
            className="input"
            type="search"
            enterKeyHint="search"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={21}
            value={query}
            aria-describedby="friend-search-hint"
            onChange={(e) => {
              setQuery(e.target.value);
              if (state.kind !== 'busy') setState({ kind: 'idle' });
            }}
          />
        </div>
        <button type="submit" className="button" disabled={state.kind === 'busy'}>
          {state.kind === 'busy' ? bg.friends.searching : bg.friends.search}
        </button>
      </div>
      <p id="friend-search-hint" className="field-hint">
        {bg.friends.searchHint}
      </p>
      <div aria-live="polite">
        {state.kind === 'none' && <p className="panel-note">{bg.friends.notFound}</p>}
        {state.kind === 'error' && <p className="field-error">{bg.friends.errors.generic}</p>}
        {state.kind === 'found' && (
          <div className="person person-found">
            <PersonLink person={state.person} />
            {state.person.id === myId ? (
              <span className="panel-note">{bg.profile.self}</span>
            ) : (
              <Link className="button button-small" to={`/u/${encodeURIComponent(state.person.username)}`}>
                {bg.friends.open}
              </Link>
            )}
          </div>
        )}
      </div>
    </form>
  );
}
