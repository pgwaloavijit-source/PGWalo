import React from 'react';

export const UserAvatar: React.FC<{
  name?: string;
  src?: string;
  className?: string;
  sizeClass?: string;
}> = ({ name = 'User', src, className = '', sizeClass = 'w-8 h-8 text-[11px]' }) => {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || 'U';

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        referrerPolicy="no-referrer"
        className={`${sizeClass} rounded-xl object-cover border border-slate-200 shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-xl shrink-0 grid place-items-center bg-linear-to-br from-blue-600 to-indigo-500 text-white font-black ${className}`}
      aria-hidden
    >
      {initials}
    </div>
  );
};
