import React, { useEffect, useRef, useState } from 'react';

/**
 * PGWalo boot loader — animated brand mark + progress bar.
 *
 * Two stages so the branding is continuous:
 *  - `phase="boot"`  : the bundle is parsing/React is mounting
 *  - `phase="data"`  : the API snapshot is still in flight
 *
 * The bar creeps toward 94% while work is happening and snaps to 100% when
 * `done` flips true, then the overlay fades out.
 */
export interface PGWaloLoaderProps {
  /** Keep the overlay mounted but fading until this is true. */
  done?: boolean;
  /** Short status line under the bar. */
  message?: string;
  /** Start hidden (used for the post-mount data phase). */
  visible?: boolean;
}

const MIN_VISIBLE_MS = 700;

export const PGWaloLoader: React.FC<PGWaloLoaderProps> = ({
  done = false,
  message = 'Setting up your workspace',
  visible = true,
}) => {
  const [progress, setProgress] = useState(6);
  const [exiting, setExiting] = useState(false);
  const [hidden, setHidden] = useState(false);
  const mountedAt = useRef(Date.now());

  // Creep toward — but never reach — 94% until `done` arrives.
  useEffect(() => {
    if (done) return;
    const id = window.setInterval(() => {
      setProgress((value) => {
        if (value >= 94) return value;
        const step = Math.max(0.6, (94 - value) * 0.07);
        return Math.min(94, value + step);
      });
    }, 180);
    return () => window.clearInterval(id);
  }, [done]);

  // Complete, honour the minimum display time, then fade out.
  useEffect(() => {
    if (!done) return;
    setProgress(100);
    const elapsed = Date.now() - mountedAt.current;
    const wait = Math.max(0, MIN_VISIBLE_MS - elapsed) + 260;
    const fade = window.setTimeout(() => setExiting(true), wait);
    const remove = window.setTimeout(() => setHidden(true), wait + 520);
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
      className={`fixed inset-0 z-[999] flex flex-col items-center justify-center bg-slate-950 text-white transition-opacity duration-500 ${
        exiting ? 'opacity-0 pointer-events-none' : visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* soft brand glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/25 blur-3xl pgwalo-breathe" />
        <div className="absolute left-1/2 top-2/3 h-[300px] w-[300px] -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl pgwalo-breathe" />
      </div>

      <div className="relative flex w-[min(320px,82vw)] flex-col items-center">
        {/* ---- animated graphic ---- */}
        <div className="relative mb-7 grid h-28 w-28 place-items-center pgwalo-rise">
          <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full pgwalo-orbit" aria-hidden="true">
            <defs>
              <linearGradient id="pgwalo-ring" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#60a5fa" />
                <stop offset="50%" stopColor="#2563eb" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="44" fill="none" stroke="#1e293b" strokeWidth="6" />
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke="url(#pgwalo-ring)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray="168 108"
              className="pgwalo-dash"
            />
          </svg>
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white shadow-xl shadow-blue-900/40">
            <img src="/pgwalo-logo.png" alt="" className="h-11 w-11 object-contain" />
          </div>
        </div>

        {/* ---- wordmark ---- */}
        <p className="text-[11px] font-bold uppercase tracking-[0.42em] text-blue-300">PGWalo</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight">Your Home Away From Home</h1>

        {/* ---- "PG Walo" label above the bar, as specified ---- */}
        <p className="mt-7 text-sm font-black uppercase tracking-[0.3em] text-white/90">PG Walo</p>

        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="relative h-full rounded-full bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500 transition-[width] duration-300 ease-out"
            style={{ width: `${Math.round(progress)}%` }}
          >
            <span className="pgwalo-shimmer absolute inset-y-0 left-0 w-1/3 rounded-full bg-white/45 blur-[2px]" />
          </div>
        </div>

        <div className="mt-3 flex w-full items-center justify-between text-[11px] font-semibold text-slate-400">
          <span>{done ? 'Ready' : message}</span>
          <span className="tabular-nums text-slate-300">{Math.round(progress)}%</span>
        </div>

        {/* ---- pulse dots ---- */}
        <div className="mt-5 flex items-center gap-1.5">
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className="pgwalo-dot h-1.5 w-1.5 rounded-full bg-blue-300"
              style={{ animationDelay: `${dot * 0.16}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default PGWaloLoader;
