// THROWAWAY Phase 0 spike: checks rear camera (getUserMedia) and GPS (watchPosition) on real phones,
// in the browser and as an installed PWA. Only built when __SPIKE__ is true (see vite.config.ts).
// Delete this file once the real check-in camera exists (Phase 5).
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { bgSpike as t } from '../i18n/bg';

interface Fix {
  lat: number;
  lng: number;
  accuracy: number;
  at: number;
}

function isInstalled(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches;
}

function cameraError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return t.camera.denied;
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return t.camera.notFound;
  if (name === 'NotReadableError') return t.camera.busy;
  return `${t.camera.failed} (${name || String(err)})`;
}

function gpsError(err: GeolocationPositionError): string {
  if (err.code === err.PERMISSION_DENIED) return t.gps.denied;
  if (err.code === err.POSITION_UNAVAILABLE) return t.gps.unavailable;
  if (err.code === err.TIMEOUT) return t.gps.timeout;
  return `${t.gps.failed} (${err.message})`;
}

function CameraTest() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const aliveRef = useRef(true);
  const [on, setOn] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState<{ facing: string; size: string } | null>(null);

  function stop() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setOn(false);
    setInfo(null);
  }

  async function start() {
    setError('');
    if (!window.isSecureContext) return setError(t.camera.insecure);
    if (!navigator.mediaDevices?.getUserMedia) return setError(t.camera.unsupported);
    // The button is disabled while this runs, so a double tap can't open (and leak) a second stream.
    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      // Left the page while the permission prompt was open: release the camera right away.
      if (!aliveRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
      const settings = stream.getVideoTracks()[0]?.getSettings() ?? {};
      const facing =
        settings.facingMode === 'environment'
          ? t.camera.facingRear
          : settings.facingMode === 'user'
            ? t.camera.facingFront
            : t.camera.facingUnknown;
      setInfo({ facing, size: `${settings.width ?? '?'} × ${settings.height ?? '?'}` });
      setOn(true);
    } catch (err) {
      if (!aliveRef.current) return;
      stop();
      setError(cameraError(err));
    } finally {
      if (aliveRef.current) setStarting(false);
    }
  }

  // Release the camera when leaving the page. aliveRef is reset on mount because
  // StrictMode mounts, unmounts and remounts once in development.
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <section className="panel" aria-labelledby="spike-camera">
      <h2 id="spike-camera">{t.camera.title}</h2>
      <video ref={videoRef} className="spike-video" data-on={on} playsInline muted />
      {info && (
        <dl className="readout">
          <dt>{t.camera.facing}</dt>
          <dd>{info.facing}</dd>
          <dt>{t.camera.resolution}</dt>
          <dd>{info.size}</dd>
        </dl>
      )}
      {error && (
        <p className="panel-error" role="alert">
          {error}
        </p>
      )}
      <button type="button" className="button" disabled={starting} onClick={on ? stop : () => void start()}>
        {on ? t.camera.stop : t.camera.start}
      </button>
    </section>
  );
}

function GpsTest() {
  const watchRef = useRef<number | null>(null);
  const [on, setOn] = useState(false);
  const [error, setError] = useState('');
  const [last, setLast] = useState<Fix | null>(null);
  const [best, setBest] = useState<number | null>(null);
  const [count, setCount] = useState(0);

  function stop() {
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
    setOn(false);
  }

  function start() {
    setError('');
    if (!('geolocation' in navigator)) return setError(t.gps.unsupported);
    setLast(null);
    setBest(null);
    setCount(0);
    setOn(true);
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const fix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          at: pos.timestamp,
        };
        setLast(fix);
        setBest((b) => (b === null ? fix.accuracy : Math.min(b, fix.accuracy)));
        setCount((c) => c + 1);
      },
      (err) => {
        setError(gpsError(err));
        if (err.code === err.PERMISSION_DENIED) stop();
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
  }

  // Stop watching when leaving the page.
  useEffect(
    () => () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    },
    [],
  );

  const m = (v: number) => `${Math.round(v)} ${t.gps.meters}`;

  return (
    <section className="panel" aria-labelledby="spike-gps">
      <h2 id="spike-gps">{t.gps.title}</h2>
      {on && !last && !error && <p className="panel-note">{t.gps.waiting}</p>}
      {last && (
        <dl className="readout">
          <dt>{t.gps.accuracy}</dt>
          <dd className="readout-big">{m(last.accuracy)}</dd>
          <dt>{t.gps.best}</dt>
          <dd>{best === null ? '—' : m(best)}</dd>
          <dt>{t.gps.fixes}</dt>
          <dd>{count}</dd>
          <dt>{t.gps.lat}</dt>
          <dd>{last.lat.toFixed(6)}</dd>
          <dt>{t.gps.lng}</dt>
          <dd>{last.lng.toFixed(6)}</dd>
          <dt>{t.gps.lastAt}</dt>
          <dd>{new Date(last.at).toLocaleTimeString('bg-BG')}</dd>
        </dl>
      )}
      {error && (
        <p className="panel-error" role="alert">
          {error}
        </p>
      )}
      <button type="button" className="button" onClick={on ? stop : start}>
        {on ? t.gps.stop : t.gps.start}
      </button>
    </section>
  );
}

export default function Spike() {
  const [installed] = useState(isInstalled);

  return (
    <main className="spike">
      <Link className="spike-back" to="/">
        {t.back}
      </Link>
      <h1 className="spike-title">{t.title}</h1>
      <p className="spike-intro">{t.intro}</p>

      <dl className="readout readout-env">
        <dt>{t.mode}</dt>
        <dd>{installed ? t.modeInstalled : t.modeBrowser}</dd>
        <dt>{t.secureContext}</dt>
        <dd>{window.isSecureContext ? t.yes : t.no}</dd>
        <dt>{t.device}</dt>
        <dd className="readout-small">{navigator.userAgent}</dd>
      </dl>

      <CameraTest />
      <GpsTest />
    </main>
  );
}
