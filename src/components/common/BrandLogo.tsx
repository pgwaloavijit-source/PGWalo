import React, { useState } from 'react';

interface BrandLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  subtitle?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  showText = true,
  className = '',
  subtitle = 'Your Home Away From Home',
}) => {
  const [imgError, setImgError] = useState(false);

  // Size mapping for logo icon
  const sizeClasses = {
    xs: 'w-7 h-7',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  const titleSizes = {
    xs: 'text-sm',
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-xl',
    xl: 'text-2xl',
  };

  const subtitleSizes = {
    xs: 'text-[9px]',
    sm: 'text-[10px]',
    md: 'text-[11px]',
    lg: 'text-xs',
    xl: 'text-sm',
  };

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Logo Graphic Container */}
      <div
        className={`${sizeClasses[size]} relative shrink-0 rounded-2xl overflow-hidden bg-white shadow-xs border border-blue-100 flex items-center justify-center p-0.5`}
      >
        {!imgError ? (
          <img
            src="/pgwalo-logo.png"
            alt="PGWalo Logo"
            onError={() => setImgError(true)}
            className="w-full h-full object-contain rounded-xl"
            referrerPolicy="no-referrer"
          />
        ) : (
          /* Updated SVG matching the user's PGWalo logo design */
          <svg
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full p-1"
          >
            {/* Circular wave design background */}
            <circle cx="50" cy="50" r="45" fill="#E0F2FE" />
            <circle cx="50" cy="50" r="38" fill="#BAE6FD" />
            
            {/* House with roof */}
            <path
              d="M 25 55 L 25 35 L 50 18 L 75 35 L 75 55 L 68 55 L 68 40 L 50 26 L 32 40 L 32 55 Z"
              fill="#1D4ED8"
              stroke="#0F172A"
              strokeWidth="2"
            />
            
            {/* Roof accent */}
            <path
              d="M 25 35 L 50 18 L 75 35"
              stroke="#60A5FA"
              strokeWidth="3"
              strokeLinecap="round"
            />
            
            {/* Door */}
            <rect x="42" y="45" width="16" height="10" rx="2" fill="#60A5FA" />
            
            {/* Window */}
            <rect x="33" y="38" width="8" height="8" rx="1" fill="#BAE6FD" stroke="#1D4ED8" strokeWidth="1" />
            <rect x="59" y="38" width="8" height="8" rx="1" fill="#BAE6FD" stroke="#1D4ED8" strokeWidth="1" />
            
            {/* Bed inside house */}
            <rect x="38" y="50" width="24" height="8" rx="2" fill="#2563EB" />
            <circle cx="44" cy="54" r="2" fill="#93C5FD" />
            <circle cx="56" cy="54" r="2" fill="#93C5FD" />
            
            {/* Sleeping person silhouette */}
            <ellipse cx="50" cy="52" rx="8" ry="4" fill="#0F172A" opacity="0.3" />
            
            {/* Wave elements at bottom */}
            <path
              d="M 20 75 Q 35 65 50 75 Q 65 85 80 75"
              stroke="#38BDF8"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M 15 82 Q 35 72 50 82 Q 65 92 85 82"
              stroke="#60A5FA"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>

      {/* Brand Typography */}
      {showText && (
        <div className="flex flex-col leading-none">
          <div className="flex items-center gap-1">
            <span
              className={`font-black tracking-tight text-slate-900 ${titleSizes[size]} font-['Plus_Jakarta_Sans',sans-serif]`}
            >
              PG<span className="text-blue-600">Walo</span>
            </span>
          </div>
          {subtitle && (
            <span
              className={`font-semibold text-slate-500 tracking-wide mt-0.5 ${subtitleSizes[size]}`}
            >
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
