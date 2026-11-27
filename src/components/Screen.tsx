import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { bg } from '../i18n/bg';

/** Inner-screen frame: a back link to home and a title. */
export function Screen({
  title,
  back = '/',
  children,
}: {
  title: string;
  back?: string;
  children: ReactNode;
}) {
  return (
    <main className="screen">
      <header className="screen-head">
        <Link className="screen-back" to={back}>
          ← {bg.friends.back}
        </Link>
        <h1 className="screen-title">{title}</h1>
      </header>
      {children}
    </main>
  );
}

/** A destructive action that asks once, inline, before it runs (easy to mis-tap on a phone). */
export function ConfirmAction({
  label,
  question,
  disabled,
  onConfirm,
}: {
  label: string;
  question: string;
  disabled?: boolean;
  onConfirm: () => void;
}) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button
        type="button"
        className="button button-ghost"
        disabled={disabled}
        onClick={() => setAsking(true)}
      >
        {label}
      </button>
    );
  }
  return (
    <div className="confirm" role="group" aria-label={label}>
      <p className="confirm-question">{question}</p>
      <div className="row">
        <button
          type="button"
          className="button button-danger"
          disabled={disabled}
          onClick={() => {
            setAsking(false);
            onConfirm();
          }}
        >
          {bg.profile.confirm}
        </button>
        <button type="button" className="button button-ghost" onClick={() => setAsking(false)}>
          {bg.profile.keep}
        </button>
      </div>
    </div>
  );
}
