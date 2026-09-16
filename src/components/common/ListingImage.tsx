import React from 'react';

interface ListingImageProps {
  src?: string;
  alt: string;
  className?: string;
}

export const ListingImage: React.FC<ListingImageProps> = ({ src, alt, className = '' }) => (
  <img
    src={src || ''}
    alt={alt}
    referrerPolicy="no-referrer"
    className={`listing-photo bg-slate-100 object-cover ${className}`}
  />
);
