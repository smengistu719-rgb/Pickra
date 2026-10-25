import React, { useState } from 'react';
import { Compass } from 'lucide-react';
import { resolveImageSrc } from '../assets/presetImages';

interface ResilientImageProps {
  imageKey: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

export const ResilientImage: React.FC<ResilientImageProps> = ({
  imageKey,
  alt,
  className = '',
  fallbackLabel,
}) => {
  const [failed, setFailed] = useState(false);
  const src = resolveImageSrc(imageKey);

  if (failed || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#F3EFE8] via-[#EBE5DA] to-[#E2DACB] text-stone-600 p-6 text-center select-none ${className}`}
        role="img"
        aria-label={alt}
      >
        <Compass className="w-6 h-6 text-stone-500 mb-2 stroke-[1.5]" />
        <span className="font-serif text-sm text-stone-700 line-clamp-2 max-w-[24ch]">
          {fallbackLabel || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
      loading="lazy"
    />
  );
};
