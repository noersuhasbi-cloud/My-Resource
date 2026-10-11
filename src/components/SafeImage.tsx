import React, { useState, useEffect } from 'react';
import { getCategoryFallback, isBase64Image } from '../utils/imageUtils';
import { ProductCategory } from '../types';
import { Leaf, Sparkles, ShoppingBag } from 'lucide-react';

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  category?: ProductCategory | string;
  fallbackSrc?: string;
  className?: string;
  containerClassName?: string;
}

export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt,
  category,
  fallbackSrc,
  className = 'w-full h-full object-cover',
  containerClassName = 'relative w-full h-full overflow-hidden bg-stone-100',
  ...rest
}) => {
  const fallback = getCategoryFallback(category);
  const preferredFallback = fallbackSrc || fallback.fallbackImageUrl;

  // Track currently active source to allow falling back to public CDN before SVG
  const [currentSrc, setCurrentSrc] = useState<string>(src || preferredFallback || '');
  const [triedFallback, setTriedFallback] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(!src && !preferredFallback);
  const [isLoading, setIsLoading] = useState<boolean>(!isBase64Image(src));

  // Sync if src prop changes
  useEffect(() => {
    if (src) {
      setCurrentSrc(src);
      setTriedFallback(false);
      setHasError(false);
      setIsLoading(!isBase64Image(src));
    } else if (preferredFallback) {
      setCurrentSrc(preferredFallback);
      setTriedFallback(true);
      setHasError(false);
      setIsLoading(true);
    } else {
      setHasError(true);
      setIsLoading(false);
    }
  }, [src, preferredFallback]);

  const handleError = () => {
    if (!triedFallback && preferredFallback && currentSrc !== preferredFallback) {
      // Step 1 fallback: switch to high-res public CDN category image
      setTriedFallback(true);
      setCurrentSrc(preferredFallback);
      setIsLoading(true);
    } else {
      // Step 2 fallback: switch to inline gradient SVG card
      setHasError(true);
      setIsLoading(false);
    }
  };

  const handleLoad = () => {
    setIsLoading(false);
  };

  // If both network images failed, render instant high-fidelity SVG/CSS card
  if (hasError || !currentSrc) {
    return (
      <div
        className={`${containerClassName} flex flex-col items-center justify-center p-3 text-center bg-gradient-to-br ${fallback.gradient} text-white select-none`}
        role="img"
        aria-label={alt}
      >
        <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center mb-1.5 shadow-xs">
          <Leaf className="w-5 h-5 text-amber-300" />
        </div>
        <p className="text-[11px] font-bold text-white line-clamp-1 max-w-[90%] leading-tight">
          {alt}
        </p>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-[9px] text-white/80 tracking-wider uppercase font-semibold">
            {fallback.label}
          </span>
          <Sparkles className="w-2.5 h-2.5 text-amber-300" />
        </div>
      </div>
    );
  }

  return (
    <div className={containerClassName}>
      {/* Light shimmer placeholder while loading external network image */}
      {isLoading && !isBase64Image(currentSrc) && (
        <div className="absolute inset-0 bg-stone-200 animate-pulse pointer-events-none" />
      )}

      <img
        src={currentSrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={handleLoad}
        onError={handleError}
        className={`${className} transition-opacity duration-200 ${
          isLoading && !isBase64Image(currentSrc) ? 'opacity-0' : 'opacity-100'
        }`}
        {...rest}
      />
    </div>
  );
};
