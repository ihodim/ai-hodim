import { useEffect, useState } from 'react';

type Result<T> = { key: string; value: T } | { key: string; failed: true };

/** Loads `load(key)` whenever key changes. `load` must be stable (module scope). value is undefined while
 *  loading or after a failure. */
export function useLoad<T>(key: string, load: (key: string) => Promise<T>) {
  const [result, setResult] = useState<Result<T> | null>(null);

  useEffect(() => {
    let active = true;
    load(key).then(
      (value) => active && setResult({ key, value }),
      () => active && setResult({ key, failed: true }),
    );
    return () => {
      active = false;
    };
  }, [key, load]);

  const current = result?.key === key ? result : null;
  return {
    loading: !current,
    failed: !!current && 'failed' in current,
    value: current && 'value' in current ? current.value : undefined,
  };
}
