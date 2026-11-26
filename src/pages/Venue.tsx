import { Link, useParams } from 'react-router';
import { Screen } from '../components/Screen';
import { bg } from '../i18n/bg';
import { useAuth } from '../lib/auth-context';
import { formatEventTime } from '../lib/sofia-time';
import { getClient } from '../lib/supabase';
import { useLoad } from '../lib/use-load';
import { getVenue, mapsUrl, telHref } from '../lib/venues';

const load = (id: string) => getVenue(getClient(), id);

/** Venue page: where it is, how to call, what's on. */
export function Venue() {
  const { id = '' } = useParams();
  const { profile } = useAuth();
  const admin = !!profile?.isAdmin;
  const { loading, failed, value: venue } = useLoad(id, load);
  const tel = venue ? telHref(venue.phone) : null;

  return (
    <Screen title={venue?.name ?? bg.venues.title} back="/venues">
      {loading && <div className="panel" aria-busy="true" />}
      {failed && <p className="field-error">{bg.venues.loadFailed}</p>}
      {venue === null && <p className="panel-note">{bg.venues.notFound}</p>}

      {venue && (
        <>
          <section className="panel">
            <p className="venue-address">{venue.address}</p>
            <div className="row">
              {tel && (
                <a className="button" href={tel}>
                  {bg.venues.call}
                </a>
              )}
              <a
                className="button button-ghost"
                href={mapsUrl(venue.lat, venue.lng)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {bg.venues.map}
              </a>
            </div>
            {admin && (
              <Link className="link-button" to={`/venues/${venue.id}/edit`}>
                {bg.venues.edit}
              </Link>
            )}
          </section>

          <section className="people" aria-labelledby="events-title">
            <h2 id="events-title" className="people-title">
              {bg.venues.upcoming}
            </h2>
            {venue.events.length === 0 && <p className="panel-note">{bg.venues.noEvents}</p>}
            {venue.events.length > 0 && (
              <ul className="people-list">
                {venue.events.map((e) => (
                  <li key={e.id} className="event">
                    <time className="event-time" dateTime={e.starts_at}>
                      {formatEventTime(e.starts_at)}
                    </time>
                    <span className="person-name">{e.performer}</span>
                    {e.promo && <p className="event-promo">{e.promo}</p>}
                    {admin && (
                      <Link className="link-button" to={`/events/${e.id}/edit`}>
                        {bg.venues.edit}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {admin && (
              <Link className="button button-ghost" to={`/venues/${venue.id}/events/new`}>
                + {bg.venues.addEvent}
              </Link>
            )}
          </section>
        </>
      )}
    </Screen>
  );
}
