import { Link } from 'react-router';
import { Wordmark } from '../components/Wordmark';
import { bg, bgSpike } from '../i18n/bg';
import { useAuth } from '../lib/auth-context';

export function Home() {
  const { profile, signOut } = useAuth();

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
        <p className="home-soon">{bg.home.soon}</p>
        {__SPIKE__ && (
          <Link className="button" to="/spike">
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
