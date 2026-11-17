import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { Home } from './pages/Home';

// The spike is a throwaway phone test. When __SPIKE__ is false (production and plain local/CI builds),
// this branch is constant-folded away and the Spike chunk is never emitted.
const Spike = __SPIKE__ ? lazy(() => import('./pages/Spike')) : null;

export function App() {
  return (
    <Routes>
      {Spike && (
        <Route
          path="/spike"
          element={
            <Suspense fallback={null}>
              <Spike />
            </Suspense>
          }
        />
      )}
      {/* Catch-all: every deep link loads the app shell (Cloudflare serves index.html via SPA mode in wrangler.jsonc). */}
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
