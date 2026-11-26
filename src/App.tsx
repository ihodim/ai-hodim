import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { AuthProvider } from './components/AuthProvider';
import { bg } from './i18n/bg';
import { useAuth } from './lib/auth-context';
import { supabase } from './lib/supabase';
import { Friends } from './pages/Friends';
import { EventForm } from './pages/EventForm';
import { Home } from './pages/Home';
import { Onboarding } from './pages/Onboarding';
import { Profile } from './pages/Profile';
import { Settings } from './pages/Settings';
import { SignIn } from './pages/SignIn';
import { Venue } from './pages/Venue';
import { VenueForm } from './pages/VenueForm';
import { Venues } from './pages/Venues';

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
  return (
    <Routes>
      <Route path="/friends" element={<Friends />} />
      <Route path="/u/:username" element={<Profile />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/venues" element={<Venues />} />
      <Route path="/venues/:id" element={<Venue />} />
      {/* Admin screens exist only for admins; for anyone else these URLs fall through to home. */}
      {profile.isAdmin && (
        <>
          <Route path="/venues/new" element={<VenueForm />} />
          <Route path="/venues/:id/edit" element={<VenueForm />} />
          <Route path="/venues/:venueId/events/new" element={<EventForm />} />
          <Route path="/events/:id/edit" element={<EventForm />} />
        </>
      )}
      <Route path="*" element={<Home />} />
    </Routes>
  );
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
