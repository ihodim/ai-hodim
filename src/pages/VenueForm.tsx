import { useState, type FormEvent, type InputHTMLAttributes } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Screen } from '../components/Screen';
import { bg } from '../i18n/bg';
import { getClient } from '../lib/supabase';
import { useLoad } from '../lib/use-load';
import {
  getVenue,
  GPS_WARN_M,
  mapsUrl,
  parseLocation,
  saveVenue,
  type ParsedLocation,
  type Venue,
} from '../lib/venues';

const load = (id: string) => (id ? getVenue(getClient(), id) : Promise.resolve(null));

/** Admin only (App registers the route only for admins; RLS is_admin() decides the write). */
export function VenueForm() {
  const { id = '' } = useParams();
  const { loading, failed, value: venue } = useLoad(id, load);
  const title = id ? bg.admin.editVenue : bg.admin.newVenue;

  return (
    <Screen title={title} back={id ? `/venues/${id}` : '/venues'}>
      {loading && <div className="panel" aria-busy="true" />}
      {failed && <p className="field-error">{bg.venues.loadFailed}</p>}
      {id && venue === null && <p className="panel-note">{bg.venues.notFound}</p>}
      {!loading && !failed && (!id || venue) && <Fields venue={venue ?? null} />}
    </Screen>
  );
}

function Fields({ venue }: { venue: Venue | null }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [where, setWhere] = useState(venue ? `${venue.lat}, ${venue.lng}` : '');
  const location = parseLocation(where);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || 'error' in location) return;
    const f = new FormData(e.currentTarget);
    const text = (k: string) => String(f.get(k) ?? '').trim();

    setFailed(false);
    setBusy(true);
    try {
      const id = await saveVenue(getClient(), venue?.id ?? null, {
        name: text('name'),
        address: text('address'),
        phone: text('phone'),
        lat: location.lat,
        lng: location.lng,
        checkin_radius_m: Number(text('radius')),
        checkin_window_start: text('start'),
        checkin_window_end: text('end'),
      });
      navigate(`/venues/${id}`, { replace: true });
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  // DB times come back as HH:MM:SS; <input type="time"> wants HH:MM.
  const hhmm = (t: string | undefined, fallback: string) => t?.slice(0, 5) ?? fallback;

  return (
    <form className="door-form form" onSubmit={submit}>
      <Field label={bg.admin.name} name="name" defaultValue={venue?.name} required />
      <Field label={bg.admin.address} name="address" defaultValue={venue?.address} required />
      <Field label={bg.admin.phone} name="phone" type="tel" defaultValue={venue?.phone} required />
      <LocationField value={where} onChange={setWhere} location={location} />

      <Field
        label={bg.admin.radius}
        name="radius"
        type="number"
        min={1}
        step={1}
        defaultValue={String(venue?.checkin_radius_m ?? 100)}
        required
      />
      <div className="row row-split">
        <Field
          label={bg.admin.windowStart}
          name="start"
          type="time"
          defaultValue={hhmm(venue?.checkin_window_start, '22:00')}
          required
        />
        <Field
          label={bg.admin.windowEnd}
          name="end"
          type="time"
          defaultValue={hhmm(venue?.checkin_window_end, '04:00')}
          required
        />
      </div>
      <p className="field-hint">{bg.admin.windowHint}</p>

      {failed && (
        <p className="field-error" role="alert">
          {bg.admin.saveFailed}
        </p>
      )}
      <button type="submit" className="button button-wide" disabled={busy || 'error' in location}>
        {busy ? bg.admin.saving : bg.admin.save}
      </button>
    </form>
  );
}

type Gps = { state: 'idle' | 'busy' | 'denied' | 'failed' } | { state: 'done'; accuracy: number };

/** Where the venue is: the phone's GPS (standing at the club) or a pasted Google Maps link / "lat, lng".
 *  Every result is shown with a map link to check before saving. */
function LocationField({
  value,
  onChange,
  location,
}: {
  value: string;
  onChange: (v: string) => void;
  location: ParsedLocation;
}) {
  const [gps, setGps] = useState<Gps>({ state: 'idle' });

  function locate() {
    setGps({ state: 'busy' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`);
        setGps({ state: 'done', accuracy: Math.round(pos.coords.accuracy) });
      },
      (err) => setGps({ state: err.code === err.PERMISSION_DENIED ? 'denied' : 'failed' }),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }

  const empty = value.trim() === '';
  const found = 'error' in location ? null : location;

  return (
    <div className="field">
      <label className="field-label" htmlFor="where">
        {bg.admin.location}
      </label>
      {'geolocation' in navigator && (
        <button
          type="button"
          className="button button-ghost"
          disabled={gps.state === 'busy'}
          onClick={locate}
        >
          {gps.state === 'busy' ? bg.admin.gpsBusy : bg.admin.useMyLocation}
        </button>
      )}
      <input
        id="where"
        className="input"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        placeholder={bg.admin.locationPlaceholder}
        value={value}
        aria-invalid={!empty && !found}
        aria-describedby="where-note"
        onChange={(e) => {
          onChange(e.target.value);
          setGps({ state: 'idle' });
        }}
      />
      <div id="where-note" aria-live="polite">
        {gps.state === 'denied' && <p className="field-error">{bg.admin.gpsDenied}</p>}
        {gps.state === 'failed' && <p className="field-error">{bg.admin.gpsFailed}</p>}
        {found && (
          <p className="field-hint">
            {bg.admin.found} {found.lat.toFixed(5)}, {found.lng.toFixed(5)} ·{' '}
            <a href={mapsUrl(found.lat, found.lng)} target="_blank" rel="noopener noreferrer">
              {bg.admin.checkOnMap}
            </a>
          </p>
        )}
        {found && gps.state === 'done' && gps.accuracy > GPS_WARN_M && (
          <p className="field-error">{bg.admin.gpsInaccurate(gps.accuracy)}</p>
        )}
        {found?.approximate && <p className="field-error">{bg.admin.approximate}</p>}
        {empty && <p className="field-hint">{bg.admin.locationHint}</p>}
        {!empty && 'error' in location && (
          <p className="field-error">{bg.admin.locationErrors[location.error]}</p>
        )}
      </div>
    </div>
  );
}

/** A labelled input. Native validation (required, min, type) is enough for the two admins. */
export function Field({
  label,
  name,
  ...input
}: { label: string; name: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={name}>
        {label}
      </label>
      <input id={name} name={name} className="input" {...input} />
    </div>
  );
}
