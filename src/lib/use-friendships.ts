import { useCallback, useEffect, useState } from 'react';
import { loadFriendships, type FriendshipRow } from './friends';
import { getClient } from './supabase';

/** My friendship rows. Reloads when the app comes back to the foreground, so a request sent from another
 *  phone shows up without a manual refresh. */
export function useFriendships() {
  const [rows, setRows] = useState<FriendshipRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(async () => {
    try {
      const next = await loadFriendships(getClient());
      setRows(next);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = () => {
      if (active) void reload();
    };
    const timer = setTimeout(load, 0);
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [reload]);

  return { rows, failed, reload };
}
