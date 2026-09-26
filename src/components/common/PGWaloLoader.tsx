import React, { useEffect, useRef, useState } from 'react';

export interface PGWaloLoaderProps {
  done?: boolean;
  message?: string;
  visible?: boolean;
}

const MIN_VISIBLE_MS = 420;

/** Small branded loader used during the initial app and workspace transitions. */
export const PGWaloLoader: React.FC<PGWaloLoaderProps> = ({
  done = false,
  visible = true,
}) => {
  const [exiting, setExiting] = useState(false);
  const [hidden, setHidden] = useState(false);
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    if (!done) return;
    const elapsed = Date.now() - mountedAt.current;
    const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
    const fade = window.setTimeout(() => setExiting(true), wait);
    const remove = window.setTimeout(() => setHidden(true), wait + 220);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(remove);
    };
  }, [done]);

  if (hidden) return null;

  return (
    <div
      aria-live="polite"
      aria-busy={!done}
      role="status"
      aria-label="Loading PGWalo"
      className={`fixed inset-0 z-[999] grid place-items-center bg-slate-950 transition-opacity duration-300 ${
        exiting || !visible ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="relative grid h-[76px] w-[76px] place-items-center">
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full pgwalo-orbit" aria-hidden="true">
          <defs>
            <linearGradient id="pgwalo-loader-ring" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="55%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="43" fill="none" stroke="#1e293b" strokeWidth="5" />
          <circle cx="50" cy="50" r="43" fill="none" stroke="url(#pgwalo-loader-ring)" strokeWidth="5" strokeLinecap="round" strokeDasharray="92 178" />
        </svg>
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white shadow-lg shadow-blue-950/40">
          <img src="/pgwalo-logo.png" alt="PGWalo" className="h-9 w-9 object-contain" />
        </div>
      </div>
    </div>
  );
};

export default PGWaloLoader;
