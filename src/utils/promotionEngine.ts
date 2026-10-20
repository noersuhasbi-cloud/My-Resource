// Advanced Promotion & Loyalty Engine for GroceMart ERP
// BOGO (Buy 2 Get 1 Free), Seasonal Coupon Codes, Member Tier Loyalty Perks, Category Bundles

import type {
  PromotionRule,
  MemberLoyaltyTier,
  AppliedPromotionSummary,
} from '../types/index.ts';

export const INITIAL_PROMOTION_RULES: PromotionRule[] = [
  {
    id: 'PRM-2026-01',
    name: 'Buy 2 Get 1 Free: Organic Fuji Apples',
    code: 'B2G1_APPLES',
    type: 'BOGO',
    targetType: 'SKU',
    targetValue: 'SKU-PRD-002',
    buyQty: 2,
    getQty: 1,
    getDiscountPercent: 100,
    active: true,
    startDate: '2026-10-01',
    endDate: '2026-12-31',
    description: 'Buy 2 units of Premium Organic Fuji Apples and receive the 3rd unit 100% free.',
    usageCount: 142,
  },
  {
    id: 'PRM-2026-02',
    name: 'Fresh Organic Produce 20% Off',
    code: 'ORGANIC20',
    type: 'PERCENTAGE_DISCOUNT',
    targetType: 'CATEGORY',
    targetValue: 'produce',
    discountPercent: 20,
    minOrderSubtotalIDR: 50000,
    active: true,
    startDate: '2026-10-01',
    endDate: '2026-11-30',
    description: '20% off all fresh farm produce lines on orders over Rp 50.000 with coupon ORGANIC20.',
    usageCount: 89,
  },
  {
    id: 'PRM-2026-03',
    name: 'Storewide Fresh Welcome 10% Off',
    code: 'FRESH10',
    type: 'PERCENTAGE_DISCOUNT',
    targetType: 'ALL',
    targetValue: 'ALL',
    discountPercent: 10,
    minOrderSubtotalIDR: 75000,
    active: true,
    startDate: '2026-10-01',
    endDate: '2026-12-31',
    description: '10% discount on entire grocery basket for orders over Rp 75.000.',
    usageCount: 310,
  },
  {
    id: 'PRM-2026-04',
    name: 'Weekend Prime Wagyu & Butchery 15% Off',
    code: 'WEEKEND_MEAT',
    type: 'CATEGORY_BUNDLE',
    targetType: 'CATEGORY',
    targetValue: 'meat_seafood',
    discountPercent: 15,
    minOrderSubtotalIDR: 100000,
    active: true,
    startDate: '2026-10-15',
    endDate: '2026-11-15',
    description: '15% savings on all grass-fed beef, poultry, and cold-chain salmon fillets.',
    usageCount: 64,
  },
  {
    id: 'PRM-2026-05',
    name: 'Platinum VIP Member Exclusive (15% Off)',
    code: 'PLATINUM_VIP',
    type: 'MEMBER_TIER',
    targetType: 'ALL',
    targetValue: 'ALL',
    memberTier: 'PLATINUM',
    discountPercent: 15,
    active: true,
    description: '15% automatic tier discount for verified GroceMart Platinum VIP members.',
    usageCount: 228,
  },
  {
    id: 'PRM-2026-06',
    name: 'Gold Member Privilege (10% Off)',
    code: 'GOLD_MEMBER',
    type: 'MEMBER_TIER',
    targetType: 'ALL',
    targetValue: 'ALL',
    memberTier: 'GOLD',
    discountPercent: 10,
    active: true,
    description: '10% automatic tier discount for GroceMart Gold members.',
    usageCount: 184,
  },
  {
    id: 'PRM-2026-07',
    name: 'Silver Member Privilege (5% Off)',
    code: 'SILVER_MEMBER',
    type: 'MEMBER_TIER',
    targetType: 'ALL',
    targetValue: 'ALL',
    memberTier: 'SILVER',
    discountPercent: 5,
    active: true,
    description: '5% automatic tier discount for GroceMart Silver members.',
    usageCount: 95,
  },
];

export interface PromotionEvaluationCartItem {
  sku: string;
  name: string;
  category: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PromotionEvaluationResult {
  totalPromoDiscountIDR: number;
  appliedPromotions: AppliedPromotionSummary[];
  lineDiscounts: Record<string, number>; // sku -> discount amount
}

/**
 * Dynamically evaluate and calculate active promotions without altering master item catalog prices
 */
export function evaluateCartPromotions(
  cartItems: PromotionEvaluationCartItem[],
  rules: PromotionRule[] = INITIAL_PROMOTION_RULES,
  options?: {
    couponCode?: string;
    memberTier?: MemberLoyaltyTier;
    memberId?: string;
  }
): PromotionEvaluationResult {
  const activeRules = rules.filter((r) => r.active);
  const normalizedCoupon = (options?.couponCode || '').trim().toUpperCase();
  const effectiveTier = options?.memberTier || (options?.memberId ? detectMemberTier(options.memberId) : undefined);

  let totalPromoDiscountIDR = 0;
  const appliedPromotions: AppliedPromotionSummary[] = [];
  const lineDiscounts: Record<string, number> = {};

  const cartSubtotal = cartItems.reduce((sum, it) => sum + it.lineTotal, 0);

  // 1. Process BOGO (Buy X Get Y) Promotions
  const bogoRules = activeRules.filter((r) => r.type === 'BOGO');
  for (const rule of bogoRules) {
    if (!rule.buyQty || !rule.getQty) continue;
    const buyQty = rule.buyQty;
    const getQty = rule.getQty;
    const bundleSize = buyQty + getQty;

    cartItems.forEach((item) => {
      const isTarget =
        rule.targetType === 'ALL' ||
        (rule.targetType === 'SKU' && item.sku === rule.targetValue) ||
        (rule.targetType === 'CATEGORY' && item.category === rule.targetValue);

      if (isTarget && item.quantity >= bundleSize) {
        const fullBundles = Math.floor(item.quantity / bundleSize);
        const freeUnits = fullBundles * getQty;
        const discountRate = (rule.getDiscountPercent || 100) / 100;
        const discount = Math.round(freeUnits * item.unitPrice * discountRate);

        if (discount > 0) {
          totalPromoDiscountIDR += discount;
          lineDiscounts[item.sku] = (lineDiscounts[item.sku] || 0) + discount;
          appliedPromotions.push({
            ruleId: rule.id,
            ruleCode: rule.code,
            name: rule.name,
            discountAmountIDR: discount,
            promoType: 'BOGO',
            appliedSku: item.sku,
            badgeLabel: `B2G1 (${freeUnits} Free)`,
          });
        }
      }
    });
  }

  // 2. Process Member Tier Discounts
  if (effectiveTier) {
    const tierRule = activeRules.find((r) => r.type === 'MEMBER_TIER' && r.memberTier === effectiveTier);
    if (tierRule && tierRule.discountPercent) {
      const discount = Math.round(cartSubtotal * (tierRule.discountPercent / 100));
      if (discount > 0) {
        totalPromoDiscountIDR += discount;
        appliedPromotions.push({
          ruleId: tierRule.id,
          ruleCode: tierRule.code,
          name: `${effectiveTier} Member Discount (${tierRule.discountPercent}%)`,
          discountAmountIDR: discount,
          promoType: 'MEMBER_TIER',
          badgeLabel: `${effectiveTier} VIP -${tierRule.discountPercent}%`,
        });
      }
    }
  }

  // 3. Process Coupon Code or Category Bundle
  if (normalizedCoupon) {
    const matchedCoupon = activeRules.find(
      (r) => r.code.toUpperCase() === normalizedCoupon && (r.type === 'PERCENTAGE_DISCOUNT' || r.type === 'FIXED_DISCOUNT' || r.type === 'CATEGORY_BUNDLE')
    );

    if (matchedCoupon) {
      const meetsMinSpend = !matchedCoupon.minOrderSubtotalIDR || cartSubtotal >= matchedCoupon.minOrderSubtotalIDR;

      if (meetsMinSpend) {
        let eligibleSubtotal = cartSubtotal;
        if (matchedCoupon.targetType === 'CATEGORY') {
          eligibleSubtotal = cartItems
            .filter((it) => it.category === matchedCoupon.targetValue)
            .reduce((sum, it) => sum + it.lineTotal, 0);
        } else if (matchedCoupon.targetType === 'SKU') {
          eligibleSubtotal = cartItems
            .filter((it) => it.sku === matchedCoupon.targetValue)
            .reduce((sum, it) => sum + it.lineTotal, 0);
        }

        let couponDiscount = 0;
        if (matchedCoupon.discountPercent) {
          couponDiscount = Math.round(eligibleSubtotal * (matchedCoupon.discountPercent / 100));
        } else if (matchedCoupon.discountAmountIDR) {
          couponDiscount = Math.min(eligibleSubtotal, matchedCoupon.discountAmountIDR);
        }

        if (couponDiscount > 0) {
          totalPromoDiscountIDR += couponDiscount;
          appliedPromotions.push({
            ruleId: matchedCoupon.id,
            ruleCode: matchedCoupon.code,
            name: matchedCoupon.name,
            discountAmountIDR: couponDiscount,
            promoType: matchedCoupon.type,
            badgeLabel: `Promo [${matchedCoupon.code}]`,
          });
        }
      }
    }
  }

  // Ensure total discount does not exceed cart subtotal
  totalPromoDiscountIDR = Math.min(cartSubtotal, totalPromoDiscountIDR);

  return {
    totalPromoDiscountIDR,
    appliedPromotions,
    lineDiscounts,
  };
}

/**
 * Helper to detect member tier from loyalty card ID
 */
export function detectMemberTier(memberId: string): MemberLoyaltyTier {
  const upper = (memberId || '').toUpperCase();
  if (upper.includes('VIP') || upper.includes('PLAT') || upper.endsWith('99')) return 'PLATINUM';
  if (upper.includes('GOLD') || upper.endsWith('88')) return 'GOLD';
  if (upper.includes('SILV') || upper.endsWith('77')) return 'SILVER';
  return 'BRONZE';
}
