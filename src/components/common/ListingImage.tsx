import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ListingImageProps {
  src?: string;
  images?: string[];
  alt: string;
  className?: string;
}

export const ListingImage: React.FC<ListingImageProps> = ({ src, images = [], alt, className = '' }) => {
  const slides = Array.from(new Set([src, ...images].filter(Boolean) as string[]));
  const [index, setIndex] = useState(0);
  const current = slides[index] || '';

  if (slides.length < 2) {
    return <img src={current} alt={alt} referrerPolicy="no-referrer" className={`listing-photo bg-slate-100 object-cover ${className}`} />;
  }

  return (
    <div className={`relative overflow-hidden bg-slate-100 ${className}`}>
      <img src={current} alt={`${alt} ${index + 1}`} referrerPolicy="no-referrer" className="listing-photo h-full w-full object-cover" />
      <button type="button" aria-label="Previous property photo" onClick={(e) => { e.stopPropagation(); setIndex((index - 1 + slides.length) % slides.length); }} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-slate-950/55 p-1.5 text-white hover:bg-slate-950/80">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button type="button" aria-label="Next property photo" onClick={(e) => { e.stopPropagation(); setIndex((index + 1) % slides.length); }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-slate-950/55 p-1.5 text-white hover:bg-slate-950/80">
        <ChevronRight className="h-4 w-4" />
      </button>
      <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-slate-950/65 px-2 py-0.5 text-[10px] font-bold text-white">{index + 1}/{slides.length}</span>
    </div>
  );
};
