import { Link } from 'react-router';
import { Wordmark } from '../components/Wordmark';
import { bg, bgSpike } from '../i18n/bg';

export function Home() {
  return (
    <main className="home">
      <div className="home-sign">
        <Wordmark />
        <p className="home-tagline">{bg.tagline}</p>
      </div>
      <div className="home-foot">
        <p className="home-soon">{bg.home.soon}</p>
        {__SPIKE__ && (
          <Link className="button" to="/spike">
            {bgSpike.link}
          </Link>
        )}
      </div>
    </main>
  );
}
