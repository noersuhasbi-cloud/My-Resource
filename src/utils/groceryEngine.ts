import type {
  ProductCategory,
  StorageZoneType,
  MarkdownRuleTier,
  DynamicMarkdownConfig,
  BatchMarkdownCandidate,
  InventoryBatch,
  VariableWeightBarcodeInfo,
  POSProductItem,
  PickerOrderItem,
  PickListZoneGroup,
  ZonePickTote,
  VendorCreditNote,
} from '../types/index.ts';

// ============================================================================
// 1. DYNAMIC MARKDOWN & EXPIRY DISCOUNT ENGINE
// ============================================================================

export const DEFAULT_MARKDOWN_TIERS: MarkdownRuleTier[] = [
  {
    id: 'tier-48h',
    maxHoursUntilExpiry: 48,
    discountPercent: 25,
    label: 'Early Yellow Tag (25% off)',
    colorCode: 'amber',
    autoApplyAtPos: true,
  },
  {
    id: 'tier-24h',
    maxHoursUntilExpiry: 24,
    discountPercent: 50,
    label: 'Clearance Orange Tag (50% off)',
    colorCode: 'rose',
    autoApplyAtPos: true,
  },
  {
    id: 'tier-12h',
    maxHoursUntilExpiry: 12,
    discountPercent: 70,
    label: 'Emergency Final Save (70% off)',
    colorCode: 'purple',
    autoApplyAtPos: true,
  },
];

export const DEFAULT_MARKDOWN_CONFIG: DynamicMarkdownConfig = {
  enabled: true,
  minGrossMarginFloorPercent: 5,
  tiers: DEFAULT_MARKDOWN_TIERS,
  targetCategories: ['produce', 'bakery', 'dairy_eggs', 'meat_seafood'],
  updatedAt: new Date().toISOString(),
  updatedBy: 'Automated FEFO Markdown Policy',
};

/**
 * Evaluates whether an inventory batch qualifies for automated dynamic markdown
 */
export function evaluateBatchMarkdown(
  batch: InventoryBatch,
  config: DynamicMarkdownConfig = DEFAULT_MARKDOWN_CONFIG
): BatchMarkdownCandidate | null {
  if (!config.enabled || batch.currentStock <= 0) return null;

  // Calculate remaining hours until expiration
  const now = new Date();
  const expiry = new Date(batch.expiryDate);
  const diffMs = expiry.getTime() - now.getTime();
  const hoursRemaining = Math.max(0, Math.round(diffMs / (1000 * 60 * 60)));

  // If already expired (> 0 hours ago), it belongs in spoilage/waste, not markdown
  if (diffMs <= 0 && batch.daysUntilExpiry <= 0) {
    return null;
  }

  // Sort tiers ascending by maxHoursUntilExpiry so tightest deadline applies first
  const sortedTiers = [...config.tiers].sort(
    (a, b) => a.maxHoursUntilExpiry - b.maxHoursUntilExpiry
  );

  const matchedTier = sortedTiers.find((t) => hoursRemaining <= t.maxHoursUntilExpiry);
  if (!matchedTier) return null;

  // Margin guard calculation: ensure discounted price does not violate hard margin floor unless final tier
  const originalPrice = batch.sellingPrice;
  let effectiveDiscount = matchedTier.discountPercent;
  const unitCost = batch.unitCost;

  let discountedPrice = Math.round(originalPrice * (1 - effectiveDiscount / 100));

  // If below cost and not emergency tier, clamp to min gross margin floor
  if (matchedTier.maxHoursUntilExpiry > 12) {
    const minFloorPrice = Math.round(unitCost * (1 + config.minGrossMarginFloorPercent / 100));
    if (discountedPrice < minFloorPrice) {
      discountedPrice = minFloorPrice;
      effectiveDiscount = Math.round(((originalPrice - discountedPrice) / originalPrice) * 100);
    }
  }

  const salvageRecoveryIDR = discountedPrice * batch.currentStock;
  const fullWasteLossIDR = unitCost * batch.currentStock;

  return {
    batchId: batch.batchId,
    sku: batch.sku,
    productName: batch.productName,
    category: (batch.storageZone === 'cold_chilled' ? 'produce' : 'dairy_eggs') as ProductCategory,
    currentStock: batch.currentStock,
    unitCost: batch.unitCost,
    originalPrice,
    markdownPrice: discountedPrice,
    discountPercent: effectiveDiscount,
    hoursRemaining,
    appliedTier: matchedTier,
    isMarkdownActive: true,
    markdownBarcode: `MD-${batch.batchId.replace(/[^A-Za-z0-9]/g, '')}-${effectiveDiscount}`,
    salvageRecoveryIDR,
    fullWasteLossIDR,
  };
}

// ============================================================================
// 2. VARIABLE-WEIGHT & CATCH-WEIGHT BARCODE PARSER
// ============================================================================

export interface SampleScaleBarcodePreset {
  label: string;
  department: string;
  barcode: string;
  targetSku: string;
  weightDescription: string;
  grams: number;
  weightGrams: number;
}

export const SAMPLE_SCALE_BARCODES: SampleScaleBarcodePreset[] = [
  {
    label: 'Butcher: Wagyu Ribeye Meltique',
    department: 'Meat & Seafood',
    barcode: '20000104855', // Prefix 20, Item 0001, Weight 0485g, Check 5
    targetSku: 'SKU-PRD-001',
    weightDescription: '485g Net Weight',
    grams: 485,
    weightGrams: 485,
  },
  {
    label: 'Deli: Artisanal Dutch Gouda Cheese',
    department: 'Dairy & Deli',
    barcode: '20000203204', // Prefix 20, Item 0002, Weight 0320g, Check 4
    targetSku: 'SKU-PRD-002',
    weightDescription: '320g Net Weight',
    grams: 320,
    weightGrams: 320,
  },
  {
    label: 'Produce: Organic Hass Avocado Pack',
    department: 'Fresh Produce',
    barcode: '20000306508', // Prefix 20, Item 0003, Weight 0650g, Check 8
    targetSku: 'SKU-PRD-003',
    weightDescription: '650g Net Weight',
    grams: 650,
    weightGrams: 650,
  },
  {
    label: 'Fishmonger: Fresh Norwegian Salmon Fillet',
    department: 'Meat & Seafood',
    barcode: '20000405202', // Prefix 20, Item 0004, Weight 0520g, Check 2
    targetSku: 'SKU-PRD-004',
    weightDescription: '520g Net Weight',
    grams: 520,
    weightGrams: 520,
  },
];

/**
 * Parses scale barcodes (GS1 / EAN-13 in-store variable measure prefix 02 or 20-29).
 * EAN-13 format: PP IIII WWWWW C
 * where:
 *   PP = Prefix (20, 21, 22, 23, 24, 02)
 *   IIII = Item code / PLU (4 digits)
 *   WWWWW = Weight in grams (e.g. 00485 = 485g) OR embedded price
 *   C = Check digit
 */
export function parseVariableWeightBarcode(
  rawInput: string,
  catalog: POSProductItem[]
): VariableWeightBarcodeInfo | null {
  const clean = rawInput.trim();
  if (!clean) return null;

  // 1. Text/Demo Format fallback: "SCALE-SKU-001-450G"
  const scaleRegex = /^SCALE-([A-Za-z0-9-]+)-(\d+)G$/i;
  const matchCustom = clean.match(scaleRegex);
  if (matchCustom) {
    const skuCode = matchCustom[1];
    const grams = parseInt(matchCustom[2], 10);
    const matched = catalog.find(
      (p) => p.sku.toLowerCase() === skuCode.toLowerCase() || p.barcode.toLowerCase() === skuCode.toLowerCase()
    );
    const pricePerKg = matched?.pricePerKg || matched?.sellingPrice || 100000;
    const kg = grams / 1000;
    return {
      rawBarcode: clean,
      isVariableWeight: true,
      prefix: 'SCALE',
      skuOrPlu: skuCode,
      netWeightGrams: grams,
      netWeightKg: Number(kg.toFixed(3)),
      matchedSku: matched?.sku,
      calculatedLineTotal: Math.round(pricePerKg * kg),
    };
  }

  // 2. Standard Retail EAN-13 Variable Measure Barcode: 12 or 13 digits starting with 02 or 20-29
  const isEan13Variable =
    (clean.length === 12 || clean.length === 13) &&
    /^(02|20|21|22|23|24|25|26|27|28|29)\d+$/.test(clean);

  if (isEan13Variable) {
    const prefix = clean.slice(0, 2);
    const pluCode = clean.slice(2, 6); // 4-digit PLU
    const weightOrPriceStr = clean.slice(6, 11); // 5-digit weight (grams)
    const weightGrams = parseInt(weightOrPriceStr, 10);

    // Map PLU to catalog product:
    // Try matching by barcode snippet, SKU number (e.g. 0001 -> PRD-001), or PLU
    const matched =
      catalog.find((p) => p.barcode.includes(pluCode)) ||
      catalog.find((p) => p.sku.includes(pluCode)) ||
      catalog.find((p) => p.sku.endsWith(pluCode.replace(/^0+/, ''))) ||
      // Fallback matching to first weighted product or matching index
      catalog.find((p) => p.isWeighted) ||
      catalog[0];

    const pricePerKg = matched?.pricePerKg || (matched ? matched.sellingPrice * 2 : 120000);
    const kg = weightGrams / 1000;
    const calculatedLineTotal = Math.round(pricePerKg * kg);

    return {
      rawBarcode: clean,
      isVariableWeight: true,
      prefix,
      skuOrPlu: pluCode,
      netWeightGrams: weightGrams,
      netWeightKg: Number(kg.toFixed(3)),
      matchedSku: matched?.sku,
      calculatedLineTotal,
    };
  }

  return null;
}

// ============================================================================
// 3. RETURN-TO-VENDOR (RTV) & VENDOR CREDIT NOTE ENGINE
// ============================================================================

export const MOCK_VENDOR_CREDIT_NOTES: VendorCreditNote[] = [
  {
    creditNoteId: 'VCN-2026-081',
    rmaNumber: 'RMA-AGRO-2026-04',
    supplierId: 'SUPP-AGRO-01',
    supplierName: 'PT Lembang Agro Sejahtera',
    storeId: 'store-jkt-senopati',
    storeName: 'GroceMart Senopati Flagship',
    sku: 'SKU-PRD-001',
    productName: 'Organic Baby Spinach Hydroponic 250g',
    lotNumber: 'LOT-SPN-2026-04',
    quantityReturned: 15,
    unit: 'pack',
    unitCost: 14000,
    totalCreditIDR: 210000,
    reason: 'cold_chain_breach',
    status: 'verified_by_vendor',
    createdAt: '2026-10-21T09:30:00Z',
    approvedBy: 'Budi Santoso (Store Manager)',
    journalEntryId: 'GLE-2026-0981',
    notes: 'Damaged chill seal on truck arrival; supplier driver countersigned credit note.',
  },
  {
    creditNoteId: 'VCN-2026-082',
    rmaNumber: 'RMA-DAIRY-2026-11',
    supplierId: 'SUPP-DAIRY-02',
    supplierName: 'PT Greenfields Dairy Indonesia',
    storeId: 'store-jkt-senopati',
    storeName: 'GroceMart Senopati Flagship',
    sku: 'SKU-DAI-001',
    productName: 'Fresh Pasteurized Jersey Whole Milk 1L',
    lotNumber: 'LOT-MLK-2026-19',
    quantityReturned: 8,
    unit: 'bottle',
    unitCost: 28500,
    totalCreditIDR: 228000,
    reason: 'broken_seal',
    status: 'pending_pickup',
    createdAt: '2026-10-22T08:15:00Z',
    approvedBy: 'Siti Rahmawati (Receiving Supervisor)',
    journalEntryId: 'GLE-2026-0994',
    notes: 'Micro-leakage on cap seal detected during dock intake quality inspection.',
  },
];

export function generateRmaNumber(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `RMA-${new Date().getFullYear()}-${num}`;
}

export function generateCreditNoteId(): string {
  const num = Math.floor(100 + Math.random() * 900);
  return `VCN-${new Date().getFullYear()}-${num}`;
}

// ============================================================================
// 4. ZONE-BASED PICKING & COLD CHAIN SEPARATION
// ============================================================================

export const ZONE_DETAILS: Record<
  StorageZoneType,
  { name: string; tempDesc: string; sequence: number; icon: string; bagType: string }
> = {
  ambient: {
    name: 'Ambient Dry Zone',
    tempDesc: '22°C - 26°C Room Temperature (Pantry, Snacks, Bakery)',
    sequence: 1, // Pick first
    icon: '📦',
    bagType: 'Standard Recycled Kraft Tote',
  },
  cold_chilled: {
    name: 'Chilled Cold Chain Zone',
    tempDesc: '2°C - 4°C Refrigerated (Fresh Greens, Dairy, Deli, Fruit)',
    sequence: 2, // Pick second
    icon: '❄️',
    bagType: 'Insulated Chiller Cooler + Food-Safe Gel Ice Pack',
  },
  freezer: {
    name: 'Deep Frozen Zone',
    tempDesc: '-18°C Cryogenic Frozen (Ice Cream, Poultry, Seafood)',
    sequence: 3, // Pick last to prevent thaw
    icon: '🧊',
    bagType: 'Thermal Foil Barrier Pouch + Dry-Ice/Gel Sub-Zero Pack',
  },
};

/**
 * Organizes an order's items into structured temperature zones sorted by standard
 * grocery cold-chain sequence (Ambient first -> Chilled second -> Frozen last).
 */
export function organizePickListByZone(items: PickerOrderItem[]): PickListZoneGroup[] {
  const zoneMap: Record<StorageZoneType, PickerOrderItem[]> = {
    ambient: [],
    cold_chilled: [],
    freezer: [],
  };

  items.forEach((item) => {
    const zone = item.storageZone || 'ambient';
    if (zoneMap[zone]) {
      zoneMap[zone].push(item);
    } else {
      zoneMap.ambient.push(item);
    }
  });

  const zonesInSequence: StorageZoneType[] = ['ambient', 'cold_chilled', 'freezer'];

  return zonesInSequence
    .map((zone) => {
      const zoneItems = zoneMap[zone];
      const details = ZONE_DETAILS[zone];
      const isComplete = zoneItems.length > 0 && zoneItems.every((i) => i.status === 'picked' || i.status === 'substituted');
      const toteBarcode = zone === 'ambient' ? 'TOTE-AMB-01' : zone === 'cold_chilled' ? 'TOTE-CHL-02' : 'TOTE-FRZ-03';
      const colorBadge = zone === 'ambient' ? 'amber' : zone === 'cold_chilled' ? 'emerald' : 'blue';

      return {
        zone,
        zoneName: details.name,
        zoneTempDesc: details.tempDesc,
        sequenceOrder: details.sequence,
        items: zoneItems,
        isZoneComplete: isComplete,
        tote: {
          toteId: toteBarcode,
          zone,
          zoneLabel: details.name,
          toteBarcode,
          colorBadge,
          gelPackVerified: zone === 'cold_chilled',
          itemCount: zoneItems.length,
        },
      };
    })
    .filter((g) => g.items.length > 0);
}

/**
 * Checks for HACCP Cross-Contamination hazards between raw proteins and ready-to-eat produce
 */
export function detectCrossContaminationRisks(items: PickerOrderItem[]): {
  hasRisk: boolean;
  hasHazard: boolean;
  hazardDescription: string;
  recommendedAction: string;
  advisory: string;
  rawProteinItems: string[];
  readyToEatItems: string[];
} {
  const rawProteins = items.filter(
    (i) =>
      i.productName.toLowerCase().includes('beef') ||
      i.productName.toLowerCase().includes('chicken') ||
      i.productName.toLowerCase().includes('pork') ||
      i.productName.toLowerCase().includes('salmon') ||
      i.productName.toLowerCase().includes('meat')
  );

  const readyToEat = items.filter(
    (i) =>
      i.productName.toLowerCase().includes('spinach') ||
      i.productName.toLowerCase().includes('salad') ||
      i.productName.toLowerCase().includes('bread') ||
      i.productName.toLowerCase().includes('croissant') ||
      i.productName.toLowerCase().includes('avocado') ||
      i.productName.toLowerCase().includes('lettuce') ||
      i.productName.toLowerCase().includes('berry')
  );

  const hasHazard = rawProteins.length > 0 && readyToEat.length > 0;
  const desc = hasHazard
    ? 'HACCP Cross-Contamination Guard: Order contains both Raw Animal Protein and Ready-To-Eat Produce/Bakery.'
    : 'No cross-contamination risk detected.';
  const rec = hasHazard
    ? 'Raw meats MUST be isolated in dedicated Leak-Proof Barrier Pouches and never co-mingled in the same bag with raw-consumption greens or fresh bread.'
    : 'Standard tote packing approved.';

  return {
    hasRisk: hasHazard,
    hasHazard,
    hazardDescription: desc,
    recommendedAction: rec,
    advisory: rec,
    rawProteinItems: rawProteins.map((p) => p.productName),
    readyToEatItems: readyToEat.map((p) => p.productName),
  };
}
