// Shared by the browser (src/lib/username.ts) and the complete-signup Edge Function.
// Same rule as the DB CHECK profiles_username_format (Q3): 3-20 chars, starts with a Latin letter,
// then Latin letters, digits, underscore or dot. Uniqueness is case-insensitive (citext in the DB).

export const USERNAME_PATTERN = /^[A-Za-z][A-Za-z0-9_.]{2,19}$/;

export function isValidUsername(s: string): boolean {
  return typeof s === 'string' && USERNAME_PATTERN.test(s);
}
