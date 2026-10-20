// Dynamic Multi-Region Tax Engine (US, EU, Australia, Indonesia)
// Supports state/county sales tax, grocery VAT reductions, GST exemptions, and multi-currency integration.

import type { SupportedCurrency } from '../types/index.ts';

export type TaxRegionCode =
  | 'ID_PPN_11' // Indonesia: Flat 11% Value-Added Tax (PPN)
  | 'US_CA_725' // US - California: 7.25% Sales Tax (0% on staple food/produce, 7.25% on prepared/bakery)
  | 'US_NY_8875' // US - New York (NYC): 8.875% Combined Sales Tax (0% staple food, 8.875% prepared/confectionery)
  | 'US_TX_825' // US - Texas: 8.25% Sales Tax (0% grocery food, 8.25% prepared/taxable goods)
  | 'EU_DE_70' // Germany: 7% Reduced Food VAT (19% standard non-food/luxury)
  | 'EU_FR_55' // France: 5.5% Reduced Food VAT (20% standard)
  | 'UK_VAT_0' // United Kingdom: 0% Zero-Rated Food/Staples (20% standard confectionery/luxury)
  | 'AU_GST_10'; // Australia: 10% GST (0% GST-Free basic foods: fresh fruit/veg, meat, dairy)

export interface TaxRegionConfig {
  code: TaxRegionCode;
  country: string;
  name: string;
  shortLabel: string;
  defaultCurrency: SupportedCurrency;
  standardRate: number; // e.g., 0.11
  groceryFoodRate: number; // e.g., 0.00 or 0.07
  isGroceryExemptOrReduced: boolean;
  legalNotice: string;
  regulatoryAuthority: string;
}

export const TAX_REGIONS: Record<TaxRegionCode, TaxRegionConfig> = {
  ID_PPN_11: {
    code: 'ID_PPN_11',
    country: 'Indonesia',
    name: 'Indonesia PPN (11% Standard VAT)',
    shortLabel: 'PPN 11%',
    defaultCurrency: 'IDR',
    standardRate: 0.11,
    groceryFoodRate: 0.11,
    isGroceryExemptOrReduced: false,
    legalNotice: 'UU HPP No. 7/2021 — Pajak Pertambahan Nilai (PPN) 11%',
    regulatoryAuthority: 'Direktorat Jenderal Pajak (DJP)',
  },
  US_CA_725: {
    code: 'US_CA_725',
    country: 'United States (California)',
    name: 'US California Sales Tax (7.25% Base / Food Exempt)',
    shortLabel: 'US-CA 7.25% (0% Food)',
    defaultCurrency: 'USD',
    standardRate: 0.0725,
    groceryFoodRate: 0.0,
    isGroceryExemptOrReduced: true,
    legalNotice: 'CA Rev & Tax Code § 6359 — Fresh grocery food items are 100% tax-exempt',
    regulatoryAuthority: 'California Department of Tax and Fee Administration (CDTFA)',
  },
  US_NY_8875: {
    code: 'US_NY_8875',
    country: 'United States (New York)',
    name: 'US New York City Sales Tax (8.875% Combined / Food Exempt)',
    shortLabel: 'US-NYC 8.875% (0% Food)',
    defaultCurrency: 'USD',
    standardRate: 0.08875,
    groceryFoodRate: 0.0,
    isGroceryExemptOrReduced: true,
    legalNotice: 'NY Tax Law § 1115(a)(1) — Unprepared grocery items are 100% exempt from sales tax',
    regulatoryAuthority: 'New York State Department of Taxation and Finance',
  },
  US_TX_825: {
    code: 'US_TX_825',
    country: 'United States (Texas)',
    name: 'US Texas Sales Tax (8.25% Combined / Food Exempt)',
    shortLabel: 'US-TX 8.25% (0% Food)',
    defaultCurrency: 'USD',
    standardRate: 0.0825,
    groceryFoodRate: 0.0,
    isGroceryExemptOrReduced: true,
    legalNotice: 'Texas Tax Code § 151.314 — Food products for human consumption are exempt',
    regulatoryAuthority: 'Texas Comptroller of Public Accounts',
  },
  EU_DE_70: {
    code: 'EU_DE_70',
    country: 'Germany (EU)',
    name: 'EU Germany VAT (7% Reduced Grocery / 19% Standard)',
    shortLabel: 'EU-DE 7% Food VAT',
    defaultCurrency: 'EUR',
    standardRate: 0.19,
    groceryFoodRate: 0.07,
    isGroceryExemptOrReduced: true,
    legalNotice: 'UStG § 12 Abs. 2 Nr. 1 — Ermäßigter Steuersatz 7% für Lebensmittel (Groceries)',
    regulatoryAuthority: 'Bundeszentralamt für Steuern (BZSt)',
  },
  EU_FR_55: {
    code: 'EU_FR_55',
    country: 'France (EU)',
    name: 'EU France TVA (5.5% Reduced Food / 20% Standard)',
    shortLabel: 'EU-FR 5.5% TVA',
    defaultCurrency: 'EUR',
    standardRate: 0.2,
    groceryFoodRate: 0.055,
    isGroceryExemptOrReduced: true,
    legalNotice: 'CGI Article 278-0 bis A — Taux réduit de 5,5% pour produits alimentaires',
    regulatoryAuthority: 'Direction Générale des Finances Publiques (DGFiP)',
  },
  UK_VAT_0: {
    code: 'UK_VAT_0',
    country: 'United Kingdom',
    name: 'UK VAT (0% Zero-Rated Staple Food / 20% Standard)',
    shortLabel: 'UK VAT 0% (Staples)',
    defaultCurrency: 'EUR',
    standardRate: 0.2,
    groceryFoodRate: 0.0,
    isGroceryExemptOrReduced: true,
    legalNotice: 'VATA 1994 Schedule 8 Group 1 — Essential food items zero-rated (0% VAT)',
    regulatoryAuthority: 'HM Revenue & Customs (HMRC)',
  },
  AU_GST_10: {
    code: 'AU_GST_10',
    country: 'Australia',
    name: 'Australia GST (10% Standard / GST-Free Basic Food)',
    shortLabel: 'AU GST (0% Fresh)',
    defaultCurrency: 'AUD',
    standardRate: 0.1,
    groceryFoodRate: 0.0,
    isGroceryExemptOrReduced: true,
    legalNotice: 'A New Tax System (Goods and Services Tax) Act 1999 § 38-2 — Basic food is GST-free',
    regulatoryAuthority: 'Australian Taxation Office (ATO)',
  },
};

/**
 * Categorize grocery item into basic food/produce vs taxable prepared/bakery/confectionery
 */
export function isBasicGroceryFood(category?: string, productName?: string): boolean {
  if (!category) return true;
  const c = category.toLowerCase();
  const name = (productName || '').toLowerCase();

  // Non-food or luxury/confectionery items that usually trigger standard rates in US/EU/AU
  if (
    c.includes('beverage_alcohol') ||
    c.includes('cleaning') ||
    c.includes('household') ||
    name.includes('wine') ||
    name.includes('beer') ||
    name.includes('snack candy')
  ) {
    return false;
  }

  // Produce, fresh meat, seafood, dairy, eggs, raw grains are standard staple foods
  return (
    c === 'produce' ||
    c === 'meat_seafood' ||
    c === 'dairy_eggs' ||
    c === 'grains_pantry' ||
    c === 'staples' ||
    c.includes('produce') ||
    c.includes('meat') ||
    c.includes('dairy') ||
    c.includes('egg')
  );
}

export interface ItemTaxCalculation {
  taxRate: number;
  taxRatePercent: number;
  taxAmount: number;
  isExempt: boolean;
  classification: 'STAPLE_GROCERY_EXEMPT' | 'REDUCED_FOOD_VAT' | 'STANDARD_TAXABLE';
}

export function calculateItemTax(
  amount: number,
  category: string,
  productName: string,
  regionCode: TaxRegionCode
): ItemTaxCalculation {
  const config = TAX_REGIONS[regionCode] || TAX_REGIONS.ID_PPN_11;
  const isStaple = isBasicGroceryFood(category, productName);

  if (config.code === 'ID_PPN_11') {
    return {
      taxRate: config.standardRate,
      taxRatePercent: config.standardRate * 100,
      taxAmount: Math.round(amount * config.standardRate),
      isExempt: false,
      classification: 'STANDARD_TAXABLE',
    };
  }

  if (isStaple) {
    if (config.groceryFoodRate === 0) {
      return {
        taxRate: 0,
        taxRatePercent: 0,
        taxAmount: 0,
        isExempt: true,
        classification: 'STAPLE_GROCERY_EXEMPT',
      };
    } else {
      return {
        taxRate: config.groceryFoodRate,
        taxRatePercent: config.groceryFoodRate * 100,
        taxAmount: Math.round(amount * config.groceryFoodRate),
        isExempt: false,
        classification: 'REDUCED_FOOD_VAT',
      };
    }
  }

  // Standard item
  return {
    taxRate: config.standardRate,
    taxRatePercent: config.standardRate * 100,
    taxAmount: Math.round(amount * config.standardRate),
    isExempt: false,
    classification: 'STANDARD_TAXABLE',
  };
}

export interface CartTaxCalculationResult {
  region: TaxRegionConfig;
  subtotal: number;
  exemptSubtotal: number;
  taxableSubtotal: number;
  totalTax: number;
  effectiveTaxRatePercent: number;
  itemsTaxSummary: {
    exemptItemCount: number;
    taxableItemCount: number;
  };
}

export function calculateCartTax(
  items: Array<{ lineTotal: number; category?: string; name?: string }>,
  regionCode: TaxRegionCode
): CartTaxCalculationResult {
  const config = TAX_REGIONS[regionCode] || TAX_REGIONS.ID_PPN_11;
  let exemptSubtotal = 0;
  let taxableSubtotal = 0;
  let totalTax = 0;
  let exemptItemCount = 0;
  let taxableItemCount = 0;

  items.forEach((item) => {
    const calc = calculateItemTax(item.lineTotal, item.category || 'produce', item.name || '', regionCode);
    if (calc.isExempt) {
      exemptSubtotal += item.lineTotal;
      exemptItemCount++;
    } else {
      taxableSubtotal += item.lineTotal;
      taxableItemCount++;
    }
    totalTax += calc.taxAmount;
  });

  const subtotal = exemptSubtotal + taxableSubtotal;
  const effectiveTaxRatePercent = subtotal > 0 ? Number(((totalTax / subtotal) * 100).toFixed(2)) : 0;

  return {
    region: config,
    subtotal,
    exemptSubtotal,
    taxableSubtotal,
    totalTax,
    effectiveTaxRatePercent,
    itemsTaxSummary: {
      exemptItemCount,
      taxableItemCount,
    },
  };
}

/**
 * Suggest optimal tax jurisdiction based on selected currency
 */
export function getDefaultTaxRegionForCurrency(currency: SupportedCurrency): TaxRegionCode {
  switch (currency) {
    case 'USD':
      return 'US_CA_725';
    case 'EUR':
      return 'EU_DE_70';
    case 'AUD':
      return 'AU_GST_10';
    case 'IDR':
    default:
      return 'ID_PPN_11';
  }
}
