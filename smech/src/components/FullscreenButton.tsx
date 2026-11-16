import { useEffect, useState } from 'react';

export default function FullscreenButton() {
  const [active, setActive] = useState(!!document.fullscreenElement);
  useEffect(() => {
    const sync = () => setActive(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  if (!document.fullscreenEnabled) return null;
  return (
    <button type="button" className="fullscreen-button" aria-label={active ? 'Exit fullscreen' : 'Enter fullscreen'}
      onClick={async () => {
        try {
          if (document.fullscreenElement) await document.exitFullscreen();
          else await document.documentElement.requestFullscreen();
        } catch { /* Embedded browsers can disallow fullscreen. */ }
      }}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        {active ? <path d="M9 3v6H3m12-6v6h6M9 21v-6H3m12 6v-6h6" /> : <path d="M3 9V3h6m6 0h6v6M3 15v6h6m6 0h6v-6" />}
      </svg><span>{active ? 'WINDOW' : 'FULLSCREEN'}</span>
    </button>
  );
}