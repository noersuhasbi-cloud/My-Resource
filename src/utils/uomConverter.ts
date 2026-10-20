// Unit of Measurement (UOM) Conversion Engine for GroceMart ERP
// International Grocery Standard: Metric (kg, g) vs. Imperial / US Customary (lbs, oz)

export type WeightUOM = 'g' | 'kg' | 'oz' | 'lb';
export type UOMSystem = 'metric' | 'imperial';

// Precise conversion constants (NIST / International Standards)
export const GRAMS_PER_POUND = 453.59237;
export const GRAMS_PER_OUNCE = 28.349523;
export const POUNDS_PER_KG = 2.20462262;

/**
 * Convert any weight value into grams
 */
export function toGrams(value: number, fromUnit: WeightUOM): number {
  if (!value || isNaN(value)) return 0;
  switch (fromUnit) {
    case 'g':
      return value;
    case 'kg':
      return value * 1000;
    case 'lb':
      return value * GRAMS_PER_POUND;
    case 'oz':
      return value * GRAMS_PER_OUNCE;
    default:
      return value;
  }
}

/**
 * Convert grams to a target unit
 */
export function fromGrams(grams: number, toUnit: WeightUOM): number {
  if (!grams || isNaN(grams)) return 0;
  switch (toUnit) {
    case 'g':
      return Number(grams.toFixed(1));
    case 'kg':
      return Number((grams / 1000).toFixed(3));
    case 'lb':
      return Number((grams / GRAMS_PER_POUND).toFixed(2));
    case 'oz':
      return Number((grams / GRAMS_PER_OUNCE).toFixed(1));
    default:
      return grams;
  }
}

/**
 * Convert directly between any two units
 */
export function convertUom(value: number, from: WeightUOM, to: WeightUOM): number {
  const inGrams = toGrams(value, from);
  return fromGrams(inGrams, to);
}

/**
 * Format weight with dual unit display:
 * e.g., "500g (1.10 lbs)" or "2.40 kg (5.29 lbs)"
 */
export function formatDualWeight(
  grams: number,
  primarySystem: UOMSystem = 'metric'
): {
  primary: string;
  secondary: string;
  fullBadge: string;
} {
  const safeGrams = Math.max(0, grams || 0);
  const kg = safeGrams / 1000;
  const lbs = safeGrams / GRAMS_PER_POUND;

  if (primarySystem === 'metric') {
    const primary = safeGrams < 1000 ? `${Math.round(safeGrams)}g` : `${kg.toFixed(2)} kg`;
    const secondary = `${lbs.toFixed(2)} lbs`;
    return {
      primary,
      secondary,
      fullBadge: `${primary} (${secondary})`,
    };
  } else {
    const primary = lbs < 1 ? `${(safeGrams / GRAMS_PER_OUNCE).toFixed(1)} oz` : `${lbs.toFixed(2)} lbs`;
    const secondary = safeGrams < 1000 ? `${Math.round(safeGrams)}g` : `${kg.toFixed(2)} kg`;
    return {
      primary,
      secondary,
      fullBadge: `${primary} (${secondary})`,
    };
  }
}

/**
 * Convert and format dual pricing (e.g. price per kg vs price per lb)
 */
export function formatDualUnitPrice(
  pricePerKgIDR: number,
  currencyRateToIDR = 1,
  currencySymbol = 'Rp',
  currencyCode = 'IDR'
): {
  metricLabel: string;
  imperialLabel: string;
  dualLabel: string;
} {
  const convertedPerKg = pricePerKgIDR / currencyRateToIDR;
  const convertedPerLb = convertedPerKg / POUNDS_PER_KG;

  const isDec = currencyCode !== 'IDR';
  const fmtMetric = isDec
    ? `${currencySymbol}${convertedPerKg.toFixed(2)}/kg`
    : `Rp ${Math.round(pricePerKgIDR).toLocaleString('id-ID')}/kg`;
  const fmtImperial = isDec
    ? `${currencySymbol}${convertedPerLb.toFixed(2)}/lb`
    : `Rp ${Math.round(pricePerKgIDR / POUNDS_PER_KG).toLocaleString('id-ID')}/lb`;

  return {
    metricLabel: fmtMetric,
    imperialLabel: fmtImperial,
    dualLabel: `${fmtMetric} • ${fmtImperial}`,
  };
}
