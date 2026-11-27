import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Screen } from '../components/Screen';
import { bg } from '../i18n/bg';
import { getClient } from '../lib/supabase';
import { useLoad } from '../lib/use-load';
import { eventDate, eventStartsAt, getEvent, saveEvent, type VenueEvent } from '../lib/venues';
import { Field } from './VenueForm';

const load = (id: string) => (id ? getEvent(getClient(), id) : Promise.resolve(null));

/** Admin only. New: /venues/:venueId/events/new. Edit: /events/:id/edit. */
export function EventForm() {
  const { id = '', venueId = '' } = useParams();
  const { loading, failed, value: event } = useLoad(id, load);
  const venue = event?.venue_id ?? venueId;

  return (
    <Screen title={id ? bg.admin.editEvent : bg.admin.newEvent} back={venue ? `/venues/${venue}` : '/venues'}>
      {loading && <div className="panel" aria-busy="true" />}
      {failed && <p className="field-error">{bg.venues.loadFailed}</p>}
      {id && event === null && <p className="panel-note">{bg.venues.notFound}</p>}
      {!loading && !failed && (!id || event) && <Fields event={event ?? null} venueId={venue} />}
    </Screen>
  );
}

function Fields({ event, venueId }: { event: VenueEvent | null; venueId: string }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const f = new FormData(e.currentTarget);
    const text = (k: string) => String(f.get(k) ?? '').trim();
    const startsAt = eventStartsAt(text('date'));
    if (!startsAt) return setFailed(true);

    setFailed(false);
    setBusy(true);
    try {
      await saveEvent(getClient(), event?.id ?? null, {
        venue_id: venueId,
        performer: text('performer'),
        starts_at: startsAt,
        promo: text('promo') || null,
      });
      navigate(`/venues/${venueId}`, { replace: true });
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <form className="door-form form" onSubmit={submit}>
      <Field label={bg.admin.performer} name="performer" defaultValue={event?.performer} required />
      <Field
        label={bg.admin.date}
        name="date"
        type="date"
        defaultValue={event ? eventDate(event.starts_at) : ''}
        required
      />
      <div className="field">
        <label className="field-label" htmlFor="promo">
          {bg.admin.promo}
        </label>
        <textarea id="promo" name="promo" className="input" rows={3} defaultValue={event?.promo ?? ''} />
      </div>

      {failed && (
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
