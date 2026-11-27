// Event times are typed and shown in Sofia time, whatever time zone the phone is set to.
const TZ = 'Europe/Sofia';

const parts = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/** Sofia wall-clock parts of an instant. */
function wall(ms: number) {
  const p: Partial<Record<string, string>> = Object.fromEntries(
    parts.formatToParts(ms).map((x) => [x.type, x.value]),
  );
  return {
    y: Number(p.year),
    mo: Number(p.month),
    d: Number(p.day),
    h: Number(p.hour),
    mi: Number(p.minute),
  };
}

/** Sofia's offset from UTC at an instant, in ms. */
function offset(ms: number): number {
  const w = wall(ms);
  return Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi) - Math.floor(ms / 60000) * 60000;
}

/** `YYYY-MM-DDTHH:mm` (an <input type="datetime-local"> value) in Sofia time -> UTC ISO string, or null. */
export function fromSofiaInput(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const [y, mo, d, h, mi] = [m[1], m[2], m[3], m[4], m[5]].map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const back = new Date(guess);
  if (back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d || h > 23 || mi > 59) return null;
  // Second pass corrects the offset when the first guess landed on the other side of a DST change.
  return new Date(guess - offset(guess - offset(guess))).toISOString();
}

/** UTC instant -> `YYYY-MM-DDTHH:mm` in Sofia time, for prefilling a datetime-local input. */
export function toSofiaInput(iso: string): string {
  const w = wall(Date.parse(iso));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${w.y}-${pad(w.mo)}-${pad(w.d)}T${pad(w.h)}:${pad(w.mi)}`;
}

const display = new Intl.DateTimeFormat('bg-BG', {
  timeZone: TZ,
  weekday: 'short',
  day: 'numeric',
  month: 'long',
});

/** "сб, 5 декември" */
export function formatEventDate(iso: string): string {
  return display.format(Date.parse(iso));
}
