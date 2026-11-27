import { Link } from 'react-router';
import { Screen } from '../components/Screen';
import { bg } from '../i18n/bg';
import { useAuth } from '../lib/auth-context';
import { getClient } from '../lib/supabase';
import { useLoad } from '../lib/use-load';
import { listVenues } from '../lib/venues';

const load = () => listVenues(getClient());

export function Venues() {
  const { profile } = useAuth();
  const { loading, failed, value: venues } = useLoad('all', load);

  return (
    <Screen title={bg.venues.title}>
      {profile?.isAdmin && (
        <Link className="button button-ghost" to="/venues/new">
          + {bg.venues.add}
        </Link>
      )}
      {loading && <div className="panel" aria-busy="true" />}
      {failed && <p className="field-error">{bg.venues.loadFailed}</p>}
      {venues?.length === 0 && <p className="panel-note">{bg.venues.none}</p>}
      {venues && venues.length > 0 && (
        <ul className="people-list">
          {venues.map((v) => (
            <li key={v.id}>
              <Link className="venue-row" to={`/venues/${v.id}`}>
                <span className="person-name">{v.name}</span>
                <span className="venue-address">{v.address}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}
