import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ConfirmAction, Screen } from '../components/Screen';
import { bg } from '../i18n/bg';
import { useAuth } from '../lib/auth-context';
import {
  findUser,
  friendAction,
  relationTo,
  type FriendAction,
  type FriendErrorCode,
  type Person,
} from '../lib/friends';
import { getClient } from '../lib/supabase';
import { useFriendships } from '../lib/use-friendships';

type Lookup = { username: string; person: Person | null | 'error' };

/** Another user's page: add, accept, unfriend or block. Found by exact username, so a user who blocked me
 *  (or whom I blocked) is simply "not found" (Q12). */
export function Profile() {
  const { username = '' } = useParams();
  const { session } = useAuth();
  const myId = session?.user.id ?? '';
  const { rows, reload } = useFriendships();

  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FriendErrorCode | null>(null);

  useEffect(() => {
    let active = true;
    findUser(getClient(), username).then(
      (person) => active && setLookup({ username, person }),
      () => active && setLookup({ username, person: 'error' }),
    );
    return () => {
      active = false;
    };
  }, [username]);

  const current = lookup?.username === username ? lookup.person : undefined;
  // After I block someone, search no longer returns them, but the page keeps the person it already loaded.
  const person = current && current !== 'error' ? current : null;

  async function act(action: FriendAction) {
    if (!person) return;
    setBusy(true);
    setError(null);
    const code = await friendAction(getClient(), action, person.id);
    if (code) setError(code);
    await reload();
    setBusy(false);
  }

  const relation = person && rows ? relationTo(rows, myId, person.id) : null;

  return (
    <Screen title={person ? `@${person.username}` : `@${username}`}>
      {current === undefined && <div className="panel" aria-busy="true" />}
      {current === null && <p className="panel-note">{bg.profile.notFound}</p>}
      {current === 'error' && <p className="field-error">{bg.friends.errors.generic}</p>}

      {person && relation && (
        <section className="panel profile">
          {relation === 'self' && <p className="panel-note">{bg.profile.self}</p>}

          {relation === 'none' && (
            <button type="button" className="button" disabled={busy} onClick={() => void act('send')}>
              {bg.profile.add}
            </button>
          )}

          {relation === 'outgoing' && (
            <>
              <p className="panel-note">{bg.profile.requested}</p>
              <button
                type="button"
                className="button button-ghost"
                disabled={busy}
                onClick={() => void act('cancel')}
              >
                {bg.profile.cancel}
              </button>
            </>
          )}

          {relation === 'incoming' && (
            <>
              <p className="panel-note">{bg.profile.incoming}</p>
              <div className="row">
                <button type="button" className="button" disabled={busy} onClick={() => void act('accept')}>
                  {bg.profile.accept}
                </button>
                <button
                  type="button"
                  className="button button-ghost"
                  disabled={busy}
                  onClick={() => void act('decline')}
                >
                  {bg.profile.decline}
                </button>
              </div>
            </>
          )}

          {relation === 'friends' && (
            <>
              <p className="panel-note profile-friends">{bg.profile.areFriends}</p>
              <ConfirmAction
                label={bg.profile.unfriend}
                question={bg.profile.unfriendConfirm}
                disabled={busy}
                onConfirm={() => void act('unfriend')}
              />
            </>
          )}

          {relation === 'blocked' && (
            <p className="panel-note">
              {bg.profile.blocked} <Link to="/settings">{bg.profile.unblockIn}</Link>
            </p>
          )}

          {error && (
            <p className="field-error" role="alert">
              {bg.friends.errors[error]}
            </p>
          )}
        </section>
      )}

      {person && relation && relation !== 'self' && relation !== 'blocked' && (
        <ConfirmAction
          label={bg.profile.block}
          question={bg.profile.blockConfirm}
          disabled={busy}
          onConfirm={() => void act('block')}
        />
      )}
    </Screen>
  );
}
