// Shared signup validation for the complete-signup Edge Function and the onboarding form.
// Imports use explicit .ts extensions because Deno requires them (tsconfig allows them via allowImportingTsExtensions).
import { isAtLeast18, parseIsoDate } from './age.ts';
import { isValidUsername } from './username.ts';

/** Error codes from docs/CONTRACTS.md "Edge Function complete-signup". */
export const SIGNUP_ERROR_CODES = [
  'invalid_username',
  'invalid_date',
  'under_18',
  'username_taken',
  'already_completed',
] as const;

export type SignupErrorCode = (typeof SIGNUP_ERROR_CODES)[number];

export type SignupValidation =
  | { ok: true; username: string; dateOfBirth: string }
  | { ok: false; code: 'invalid_username' | 'invalid_date' | 'under_18' };

/**
 * Validates a complete-signup body. Only `username` and `date_of_birth` are read: anything else
 * (for example `is_admin`) is ignored. Order: username, then date format, then age.
 */
export function validateSignupInput(body: unknown, today: string): SignupValidation {
  const fields = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const username = fields.username;
  const dob = fields.date_of_birth;

  if (typeof username !== 'string' || !isValidUsername(username))
    return { ok: false, code: 'invalid_username' };
  if (typeof dob !== 'string' || !parseIsoDate(dob)) return { ok: false, code: 'invalid_date' };
  if (!isAtLeast18(dob, today)) return { ok: false, code: 'under_18' };
  return { ok: true, username, dateOfBirth: dob };
}
