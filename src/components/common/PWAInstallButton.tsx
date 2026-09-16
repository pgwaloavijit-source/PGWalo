import React, { useState } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Download, Smartphone, X, CheckCircle2 } from 'lucide-react';

export const PWAInstallButton: React.FC<{ variant?: 'header' | 'banner' }> = ({ variant = 'header' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // If already installed, don't show prompt
  if (isInstalled) {
    return null;
  }

  // Header button view
  if (variant === 'header') {
    if (isInstallable) {
      return (
        <button
          id="pwa-install-header-btn"
          onClick={install}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 shadow-xs transition-all active:scale-95"
          title="Install PGWalo App on your device"
        >
          <Download className="w-3.5 h-3.5 text-blue-600 animate-bounce" />
          <span>Install App</span>
        </button>
      );
    }

    if (isIOS) {
      return (
        <>
          <button
            id="pwa-install-ios-btn"
            onClick={() => setShowIOSGuide(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-all"
          >
            <Smartphone className="w-3.5 h-3.5 text-blue-600" />
            <span>Install on iOS</span>
          </button>

          {showIOSGuide && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
              <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-blue-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <img
                      src="/logo.png"
                      alt="PGWalo"
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-xl object-contain border border-blue-100"
                    />
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Install PGWalo on iPhone</h3>
                      <p className="text-xs text-slate-500">Fast access without app store</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowIOSGuide(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3 text-xs text-slate-600">
                  <div className="flex items-start gap-3 p-2.5 rounded-xl bg-blue-50/70 border border-blue-100">
                    <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                      1
                    </div>
                    <p>
                      Tap the <strong>Share</strong> button (box with an arrow up) at the bottom of Safari.
                    </p>
                  </div>
                  <div className="flex items-start gap-3 p-2.5 rounded-xl bg-blue-50/70 border border-blue-100">
                    <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                      2
                    </div>
                    <p>
                      Scroll down in options and tap <strong>Add to Home Screen</strong>.
                    </p>
                  </div>
                  <div className="flex items-start gap-3 p-2.5 rounded-xl bg-blue-50/70 border border-blue-100">
                    <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                      3
                    </div>
                    <p>Tap <strong>Add</strong> in the top right corner. You're all set!</p>
                  </div>
                </div>

                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="mt-5 w-full rounded-xl bg-blue-600 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 transition shadow-sm"
                >
                  Got It
                </button>
              </div>
            </div>
          )}
        </>
      );
    }

    // Standard fallback button if not yet triggered
    return (
      <button
        id="pwa-install-app-btn"
        onClick={() => {
          alert('To install PGWalo: Click the Install icon in your browser URL bar or Add to Home Screen in mobile settings.');
        }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs transition-all"
        title="PGWalo Progressive Web App"
      >
        <Smartphone className="w-3.5 h-3.5 text-blue-600" />
        <span className="hidden sm:inline">PWA App</span>
      </button>
    );
  }

  // Banner view (optional bottom bar)
  if (bannerDismissed) return null;

  return (
    <div className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white px-4 py-2.5 shadow-md flex items-center justify-between text-xs sm:text-sm">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-blue-200 shrink-0" />
        <span>Install PGWalo PWA for instant offline attendance, meal menus & quick rent alerts</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => {
            if (isInstallable) {
              install();
            } else if (isIOS) {
              setShowIOSGuide(true);
            }
          }}
          className="bg-white text-blue-700 font-bold px-3 py-1 rounded-md hover:bg-blue-50 transition"
        >
          Install
        </button>
        <button
          onClick={() => setBannerDismissed(true)}
          className="text-white/80 hover:text-white p-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
