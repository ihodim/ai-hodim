import { useState, type FormEvent, type InputHTMLAttributes } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Screen } from '../components/Screen';
import { bg } from '../i18n/bg';
import { getClient } from '../lib/supabase';
import { useLoad } from '../lib/use-load';
import { getVenue, parseLatLng, saveVenue, type Venue } from '../lib/venues';

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
  const [error, setError] = useState<'coords' | 'save' | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const f = new FormData(e.currentTarget);
    const text = (k: string) => String(f.get(k) ?? '').trim();
    const point = parseLatLng(text('coords'));
    if (!point) return setError('coords');

    setError(null);
    setBusy(true);
    try {
      const id = await saveVenue(getClient(), venue?.id ?? null, {
        name: text('name'),
        address: text('address'),
        phone: text('phone'),
        ...point,
        checkin_radius_m: Number(text('radius')),
        checkin_window_start: text('start'),
        checkin_window_end: text('end'),
      });
      navigate(`/venues/${id}`, { replace: true });
    } catch {
      setError('save');
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

      <div className="field">
        <label className="field-label" htmlFor="coords">
          {bg.admin.coords}
        </label>
        <input
          id="coords"
          name="coords"
          className="input"
          inputMode="decimal"
          autoComplete="off"
          required
          defaultValue={venue ? `${venue.lat}, ${venue.lng}` : ''}
          aria-invalid={error === 'coords'}
          aria-describedby="coords-hint"
        />
        <p
          id="coords-hint"
          className={error === 'coords' ? 'field-error' : 'field-hint'}
          role={error === 'coords' ? 'alert' : undefined}
        >
          {error === 'coords' ? bg.admin.coordsInvalid : bg.admin.coordsHint}
        </p>
      </div>

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

      {error === 'save' && (
        <p className="field-error" role="alert">
          {bg.admin.saveFailed}
        </p>
      )}
      <button type="submit" className="button button-wide" disabled={busy}>
        {busy ? bg.admin.saving : bg.admin.save}
      </button>
    </form>
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
