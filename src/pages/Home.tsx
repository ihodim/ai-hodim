import { useMemo } from 'react';
import { Link } from 'react-router';
import { Wordmark } from '../components/Wordmark';
import { bg, bgSpike } from '../i18n/bg';
import { useAuth } from '../lib/auth-context';
import { groupFriendships } from '../lib/friends';
import { useFriendships } from '../lib/use-friendships';

export function Home() {
  const { session, profile, signOut } = useAuth();
  const { rows } = useFriendships();
  const myId = session?.user.id ?? '';
  // Requests nobody notices never get accepted, so the count sits on the way in.
  const incoming = useMemo(() => (rows ? groupFriendships(rows, myId).incoming.length : 0), [rows, myId]);

  return (
    <main className="home">
      <div className="home-sign">
        <Wordmark />
        <p className="home-tagline">{bg.tagline}</p>
      </div>
      <div className="home-foot">
        {profile && (
          <p className="home-who">
            {bg.home.signedInAs} <strong>@{profile.username}</strong>
          </p>
        )}
        <nav className="row">
          <Link className="button" to="/friends">
            {bg.home.friends}
            {incoming > 0 && (
              <span className="badge">
                {incoming}
                <span className="visually-hidden"> {bg.home.newRequests}</span>
              </span>
            )}
          </Link>
          <Link className="button button-ghost" to="/settings">
            {bg.home.settings}
          </Link>
        </nav>
        <p className="home-soon">{bg.home.soon}</p>
        {__SPIKE__ && (
          <Link className="button button-ghost" to="/spike">
            {bgSpike.link}
          </Link>
        )}
        <button type="button" className="link-button" onClick={() => void signOut()}>
          {bg.home.signOut}
        </button>
      </div>
    </main>
  );
}
