import { ProductCategory } from '../types';

/**
 * Converts a browser File or Blob into a compressed Base64 data URL string.
 * This runs entirely client-side without any cloud storage or console setup.
 * Images are safely scaled to maxWidth and compressed to keep Firestore payloads under ~50-100KB.
 */
export async function fileToBase64(
  file: File,
  maxWidth: number = 800,
  quality: number = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        // Calculate new dimensions maintaining aspect ratio
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(readerEvent.target?.result as string);
          return;
        }

        // Draw and compress image to JPEG data URL
        ctx.drawImage(img, 0, 0, width, height);
        const base64 = canvas.toDataURL('image/jpeg', quality);
        resolve(base64);
      };

      img.onerror = () => {
        reject(new Error('Failed to load image for Base64 conversion'));
      };

      img.src = readerEvent.target?.result as string;
    };

    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * Validates if a string is a Base64 data URL.
 */
export function isBase64Image(src: string): boolean {
  return typeof src === 'string' && src.startsWith('data:image/');
}

/**
 * Returns formatted image URL or passes through Base64 / public asset paths.
 */
export function formatImageUrl(src: string): string {
  if (!src) return '';
  return src.trim();
}

/**
 * Standard public image fallbacks for categories if any image source fails to load.
 * Uses public direct CDN images with high availability.
 */
export const CATEGORY_PUBLIC_FALLBACK_IMAGES: Record<string, string> = {
  produce:
    'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=800&q=80',
  bakery:
    'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80',
  dairy_eggs:
    'https://images.unsplash.com/photo-1527153857715-3908f2bae5e8?auto=format&fit=crop&w=800&q=80',
  meat_seafood:
    'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
  pantry_coffee:
    'https://images.unsplash.com/photo-1587734195503-904fca47e0e9?auto=format&fit=crop&w=800&q=80',
  default:
    'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80',
};

/**
 * Returns default SVG data URI and public image fallbacks based on grocery category
 * when an image URL fails to load or is invalid.
 */
export function getCategoryFallback(category?: ProductCategory | string): {
  gradient: string;
  label: string;
  iconName: string;
  fallbackImageUrl: string;
} {
  const catKey = category || 'default';
  const fallbackImageUrl = CATEGORY_PUBLIC_FALLBACK_IMAGES[catKey] || CATEGORY_PUBLIC_FALLBACK_IMAGES.default;

  switch (category) {
    case 'produce':
      return {
        gradient: 'from-emerald-700 to-green-900',
        label: 'Fresh Farm Produce',
        iconName: 'Leaf',
        fallbackImageUrl,
      };
    case 'bakery':
      return {
        gradient: 'from-amber-700 to-yellow-900',
        label: 'Artisan Bakery',
        iconName: 'Croissant',
        fallbackImageUrl,
      };
    case 'dairy_eggs':
      return {
        gradient: 'from-blue-700 to-indigo-900',
        label: 'Dairy & Farm Eggs',
        iconName: 'Milk',
        fallbackImageUrl,
      };
    case 'meat_seafood':
      return {
        gradient: 'from-rose-800 to-red-950',
        label: 'Butchery & Catch',
        iconName: 'Fish',
        fallbackImageUrl,
      };
    case 'pantry_coffee':
      return {
        gradient: 'from-stone-700 to-amber-950',
        label: 'Pantry & Heritage Roasts',
        iconName: 'Coffee',
        fallbackImageUrl,
      };
    default:
      return {
        gradient: 'from-emerald-800 to-stone-900',
        label: 'GroceMart Fresh',
        iconName: 'ShoppingBag',
        fallbackImageUrl,
      };
  }
}
