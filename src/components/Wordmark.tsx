import { bg } from '../i18n/bg';

// The app title from bg.ts. If it starts with "i", the dot becomes the amber streetlamp
// (a dotless ı plus a drawn lamp). Screen readers get the plain title.
export function Wordmark() {
  const title = bg.appTitle;
  const lamp = title.startsWith('i');

  return (
    <h1 className="wordmark" aria-label={title}>
      {lamp ? (
        <span aria-hidden="true">
          <span className="wordmark-i">
            ı<span className="wordmark-lamp" />
          </span>
          {title.slice(1)}
        </span>
      ) : (
        <span aria-hidden="true">{title}</span>
      )}
    </h1>
  );
}
