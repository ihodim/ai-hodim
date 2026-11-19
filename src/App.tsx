import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { AuthProvider } from './components/AuthProvider';
import { bg } from './i18n/bg';
import { useAuth } from './lib/auth-context';
import { supabase } from './lib/supabase';
import { Home } from './pages/Home';
import { Onboarding } from './pages/Onboarding';
import { SignIn } from './pages/SignIn';

// The spike is a throwaway phone test. When __SPIKE__ is false (production and plain local/CI builds),
// this branch is constant-folded away and the Spike chunk is never emitted.
const Spike = __SPIKE__ ? lazy(() => import('./pages/Spike')) : null;

// Route guard: signed out -> sign-in; signed in without a profile -> onboarding only, whatever the URL;
// member -> the app. RLS is the real access control; this only decides which screen to show.
function Gate() {
  const { loading, session, profile } = useAuth();
  if (loading) return <main className="splash" aria-busy="true" />;
  if (!session) return <SignIn />;
  if (!profile) return <Onboarding />;
  return <Home />;
}

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
      <Route
        path="*"
        element={
          supabase ? (
            <AuthProvider client={supabase}>
              <Gate />
            </AuthProvider>
          ) : (
            <main className="splash">
              <p className="home-soon">{bg.auth.notConfigured}</p>
            </main>
          )
        }
      />
    </Routes>
  );
}
