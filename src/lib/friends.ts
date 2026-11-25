import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Friends data for the screens. The database is the authority: RLS decides which rows come back and the
// security definer RPCs decide every change. This module only shapes the rows for the UI.

type Client = SupabaseClient<Database>;
type FriendshipStatus = Database['public']['Enums']['friendship_status'];

export interface Person {
  id: string;
  username: string;
}

/** A friendships row as the client sees it, with the other side's username when RLS lets us read it. */
export interface FriendshipRow {
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  requester: { username: string } | null;
  addressee: { username: string } | null;
}

export interface FriendGroups {
  friends: Person[];
  /** requests other people sent me */
  incoming: Person[];
  /** requests I sent */
  outgoing: Person[];
}

export type Relation = 'self' | 'none' | 'friends' | 'incoming' | 'outgoing' | 'blocked';

const byUsername = (a: Person, b: Person) => a.username.localeCompare(b.username);

/** Splits my friendship rows into friends, incoming and outgoing requests. Blocked rows are left out. */
export function groupFriendships(rows: readonly FriendshipRow[], myId: string): FriendGroups {
  const groups: FriendGroups = { friends: [], incoming: [], outgoing: [] };
  const seen = new Set<string>();

  for (const row of rows) {
    if (row.status === 'blocked') continue;
    const iSent = row.requester_id === myId;
    if (!iSent && row.addressee_id !== myId) continue;
    const otherId = iSent ? row.addressee_id : row.requester_id;
    const other = iSent ? row.addressee : row.requester;
    if (otherId === myId || !other || seen.has(otherId)) continue;
    seen.add(otherId);

    const person = { id: otherId, username: other.username };
    if (row.status === 'accepted') groups.friends.push(person);
    else if (iSent) groups.outgoing.push(person);
    else groups.incoming.push(person);
  }

  groups.friends.sort(byUsername);
  groups.incoming.sort(byUsername);
  groups.outgoing.sort(byUsername);
  return groups;
}

/** How I relate to another user. Blocked rows are invisible to clients, so "I block them" comes from my
 *  list_blocked() ids; a block against me is never visible and reads as 'none' (Q12). */
export function relationTo(
  rows: readonly FriendshipRow[],
  myId: string,
  otherId: string,
  blockedIds: ReadonlySet<string> = new Set(),
): Relation {
  if (otherId === myId) return 'self';
  if (blockedIds.has(otherId)) return 'blocked';
  const row = rows.find(
    (r) =>
      (r.requester_id === myId && r.addressee_id === otherId) ||
      (r.requester_id === otherId && r.addressee_id === myId),
  );
  if (!row || row.status === 'blocked') return 'none';
  if (row.status === 'accepted') return 'friends';
  return row.requester_id === myId ? 'outgoing' : 'incoming';
}

/** Error codes the friendship RPCs raise (the exception message). Anything else shows the generic message. */
export const FRIEND_ERROR_CODES = [
  'not_member',
  'request_not_allowed',
  'no_pending_request',
  'not_friends',
  'block_not_allowed',
  'not_blocked',
] as const;
export type FriendErrorCode = (typeof FRIEND_ERROR_CODES)[number] | 'generic';

export function friendErrorCode(error: { message?: string } | null | undefined): FriendErrorCode {
  const msg = error?.message ?? '';
  return (FRIEND_ERROR_CODES as readonly string[]).includes(msg) ? (msg as FriendErrorCode) : 'generic';
}

// ---- data access --------------------------------------------------------------------------------------------------

export async function loadFriendships(client: Client): Promise<FriendshipRow[]> {
  const { data, error } = await client
    .from('friendships')
    .select(
      'requester_id, addressee_id, status, requester:profiles!friendships_requester_id_fkey(username), addressee:profiles!friendships_addressee_id_fkey(username)',
    );
  if (error) throw error;
  return data;
}

export async function findUser(client: Client, username: string): Promise<Person | null> {
  const { data, error } = await client.rpc('find_user_by_username', { p_username: username });
  if (error) throw error;
  return data[0] ?? null;
}

export async function listBlocked(client: Client): Promise<Person[]> {
  const { data, error } = await client.rpc('list_blocked');
  if (error) throw error;
  return data;
}

export type FriendAction = 'send' | 'accept' | 'decline' | 'cancel' | 'unfriend' | 'block' | 'unblock';

/** Runs one friendship RPC. Returns null on success, or the error code to show. */
export async function friendAction(
  client: Client,
  action: FriendAction,
  otherId: string,
): Promise<FriendErrorCode | null> {
  const { error } = await (() => {
    switch (action) {
      case 'send':
        return client.rpc('send_friend_request', { p_addressee: otherId });
      case 'accept':
        return client.rpc('accept_request', { p_requester: otherId });
      case 'decline':
        return client.rpc('decline_request', { p_requester: otherId });
      case 'cancel':
        return client.rpc('cancel_request', { p_addressee: otherId });
      case 'unfriend':
        return client.rpc('unfriend', { p_friend: otherId });
      case 'block':
        return client.rpc('block_user', { p_target: otherId });
      case 'unblock':
        return client.rpc('unblock_user', { p_target: otherId });
    }
  })();
  return error ? friendErrorCode(error) : null;
}
