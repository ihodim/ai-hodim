import { describe, expect, it } from 'vitest';
import { bg } from './bg';

const cyrillic = /[Ѐ-ӿ]/;

describe('bg strings', () => {
  it('has the app title and a Bulgarian tagline', () => {
    expect(bg.appTitle).toBe('iHodim');
    expect(bg.tagline).toMatch(cyrillic);
  });

  it('has an errors object for the error codes added in later phases', () => {
    expect(bg.errors).toBeTypeOf('object');
  });
});
