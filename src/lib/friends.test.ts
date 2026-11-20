import { describe, expect, it } from 'vitest';
import { bg } from '../i18n/bg';
import {
  FRIEND_ERROR_CODES,
  friendErrorCode,
  groupFriendships,
  relationTo,
  type FriendshipRow,
} from './friends';

const ME = 'me';
const row = (
  requester_id: string,
  addressee_id: string,
  status: FriendshipRow['status'],
  names: Record<string, string> = { a: 'ana', b: 'boris', c: 'cveti', me: 'az' },
): FriendshipRow => ({
  requester_id,
  addressee_id,
  status,
  requester: names[requester_id] ? { username: names[requester_id] } : null,
  addressee: names[addressee_id] ? { username: names[addressee_id] } : null,
});

describe('groupFriendships', () => {
  it('returns empty groups for no rows', () => {
    expect(groupFriendships([], ME)).toEqual({ friends: [], incoming: [], outgoing: [] });
  });

  it('puts accepted rows in friends whichever side sent the request', () => {
    const g = groupFriendships([row(ME, 'b', 'accepted'), row('a', ME, 'accepted')], ME);
    expect(g.friends).toEqual([
      { id: 'a', username: 'ana' },
      { id: 'b', username: 'boris' },
    ]);
  });

  it('splits pending rows by direction', () => {
    const g = groupFriendships([row('a', ME, 'pending'), row(ME, 'b', 'pending')], ME);
    expect(g.incoming).toEqual([{ id: 'a', username: 'ana' }]);
    expect(g.outgoing).toEqual([{ id: 'b', username: 'boris' }]);
  });

  it('leaves out blocked rows, rows without me, self rows and rows whose profile is unreadable', () => {
    const g = groupFriendships(
      [
        row(ME, 'a', 'blocked'),
        row('b', 'c', 'accepted'),
        row(ME, ME, 'accepted'),
        row('x', ME, 'pending'), // no username: RLS hid the profile
      ],
      ME,
    );
    expect(g).toEqual({ friends: [], incoming: [], outgoing: [] });
  });

  it('lists each person once', () => {
    const g = groupFriendships([row('a', ME, 'accepted'), row(ME, 'a', 'accepted')], ME);
    expect(g.friends).toHaveLength(1);
  });
});

describe('relationTo', () => {
  const rows = [row('a', ME, 'pending'), row(ME, 'b', 'pending'), row(ME, 'c', 'accepted')];

  it('knows each relation', () => {
    expect(relationTo(rows, ME, ME)).toBe('self');
    expect(relationTo(rows, ME, 'a')).toBe('incoming');
    expect(relationTo(rows, ME, 'b')).toBe('outgoing');
    expect(relationTo(rows, ME, 'c')).toBe('friends');
    expect(relationTo(rows, ME, 'z')).toBe('none');
  });

  it('shows my own block, and never a block against me', () => {
    expect(relationTo([row(ME, 'a', 'blocked')], ME, 'a')).toBe('blocked');
    expect(relationTo([row('a', ME, 'blocked')], ME, 'a')).toBe('none');
  });
});

describe('friend error codes', () => {
  it('maps known RPC messages and falls back to generic', () => {
    expect(friendErrorCode({ message: 'request_not_allowed' })).toBe('request_not_allowed');
    expect(friendErrorCode({ message: 'duplicate key value violates unique constraint' })).toBe('generic');
    expect(friendErrorCode(null)).toBe('generic');
  });

  it('has a Bulgarian message for every code', () => {
    for (const code of [...FRIEND_ERROR_CODES, 'generic'] as const) {
      expect(bg.friends.errors[code]).toMatch(/[Ѐ-ӿ]/);
    }
  });
});
