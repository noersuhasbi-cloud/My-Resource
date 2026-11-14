import type {
  InventoryBatch,
  RemovalStrategyConfig,
  RemovalStrategyType,
  SalesChannelScope,
  WarehouseBinLocation,
} from '../types/index.ts';

import b2bPalletCartonsImg from '../assets/images/b2b_wholesale_pallet_cartons_1794580770806.jpg';
import b2bChilledCratesImg from '../assets/images/b2b_chilled_bulk_crates_1794580771049.jpg';

const B2C_PRODUCE_IMG = '/images/category_fresh_produce_1791623385871.jpg';
const B2C_BAKERY_IMG = '/images/category_bakery_deli_1791623399386.jpg';
const B2C_FARM_IMG = '/images/about_heritage_farm_1791623371694.jpg';
const B2C_STORE_IMG = '/images/hero_grocemart_store_1791623358669.jpg';

export interface UoMConversionMeta {
  wholesaleUnitLabel: string;
  unitsPerCarton: number;
  cartonsPerPallet: number;
  baseUnitLabel: string;
}

export interface OdooSkuProfile {
  sku: string;
  salesChannel: SalesChannelScope;
  b2cImageUrl: string;
  b2bImageUrl: string;
  retailPackagingSpec: string;
  wholesalePackagingSpec: string;
  outerBoxBarcode: string;
  grossWeightKg: number;
  palletDimensions: string;
  uomConversion: UoMConversionMeta;
  defaultRemovalStrategy: RemovalStrategyType;
  defaultBinLocation: string;
}

export const PERISHABLE_CATEGORIES = new Set([
  'produce',
  'fresh_produce',
  'bakery',
  'dairy_eggs',
  'meat_seafood',
  'fresh_eggs',
  'dairy_beverages',
]);

export function isPerishableCategory(category?: string): boolean {
  if (!category) return true;
  return PERISHABLE_CATEGORIES.has(category.toLowerCase());
}

export function getDefaultRemovalStrategy(category?: string, sku?: string): RemovalStrategyType {
  if (sku && sku.startsWith('B2B-SKU-')) {
    if (sku.includes('TELUR') || sku.includes('SUSU')) return 'FEFO';
    return 'FIFO';
  }
  return isPerishableCategory(category) ? 'FEFO' : 'FIFO';
}

export function resolveEffectiveRemovalStrategy(
  sku: string,
  category?: string,
  config?: RemovalStrategyConfig | null
): RemovalStrategyType {
  if (config?.skuOverrides?.[sku]) {
    return config.skuOverrides[sku];
  }
  if (category && config?.categoryStrategies?.[category]) {
    return config.categoryStrategies[category];
  }
  return getDefaultRemovalStrategy(category, sku);
}

const SKU_PROFILES: Record<string, Partial<OdooSkuProfile>> = {
  'SKU-PRD-001': {
    salesChannel: 'BOTH',
    b2cImageUrl: B2C_PRODUCE_IMG,
    b2bImageUrl: b2bChilledCratesImg,
    retailPackagingSpec: 'Clamshell Perforated Retail Pack · 250g Head (Root-Intact)',
    wholesalePackagingSpec: 'ReeferRPC Crate (20 Heads / 5.0 Kg Gross) · Breathable Liner',
    outerBoxBarcode: '8997021001014',
    grossWeightKg: 5.4,
    palletDimensions: '120 x 100 x 145 cm (40 Crates)',
    uomConversion: { wholesaleUnitLabel: 'Crate', unitsPerCarton: 20, cartonsPerPallet: 40, baseUnitLabel: 'head' },
    defaultRemovalStrategy: 'FEFO',
    defaultBinLocation: 'CDC-Chilled-Rack-A1',
  },
  'SKU-PRD-002': {
    salesChannel: 'BOTH',
    b2cImageUrl: B2C_FARM_IMG,
    b2bImageUrl: b2bChilledCratesImg,
    retailPackagingSpec: 'Recycled Kraft Punnet · 500g Vine-Ripened Cluster',
    wholesalePackagingSpec: 'Ventilated Corrugated Carton (20 Punnets / 10.0 Kg Net)',
    outerBoxBarcode: '8997021001021',
    grossWeightKg: 10.8,
    palletDimensions: '120 x 100 x 150 cm (48 Cartons)',
    uomConversion: { wholesaleUnitLabel: 'Carton', unitsPerCarton: 20, cartonsPerPallet: 48, baseUnitLabel: 'pack' },
    defaultRemovalStrategy: 'FEFO',
    defaultBinLocation: 'CDC-Chilled-Rack-A2',
  },
  'SKU-PRD-003': {
    salesChannel: 'B2C',
    b2cImageUrl: B2C_PRODUCE_IMG,
    b2bImageUrl: b2bChilledCratesImg,
    retailPackagingSpec: 'Cushioned Clear PET Berry Punnet · 250g–300g',
    wholesalePackagingSpec: 'Insulated Foam Master Tray (9 Punnets / 2.7 Kg Net)',
    outerBoxBarcode: '8997021001038',
    grossWeightKg: 3.1,
    palletDimensions: '120 x 100 x 130 cm (60 Trays)',
    uomConversion: { wholesaleUnitLabel: 'Tray', unitsPerCarton: 9, cartonsPerPallet: 60, baseUnitLabel: 'punnet' },
    defaultRemovalStrategy: 'FEFO',
    defaultBinLocation: 'CDC-Chilled-Rack-A3',
  },
  'SKU-BAK-001': {
    salesChannel: 'B2C',
    b2cImageUrl: B2C_BAKERY_IMG,
    b2bImageUrl: b2bPalletCartonsImg,
    retailPackagingSpec: 'Breathable Kraft Artisan Loaf Bag · 650g Boule',
    wholesalePackagingSpec: 'Bakery Rack Crate (10 Loaves / 6.5 Kg Net)',
    outerBoxBarcode: '8997021002011',
    grossWeightKg: 7.2,
    palletDimensions: '120 x 80 x 160 cm (24 Crates)',
    uomConversion: { wholesaleUnitLabel: 'Crate', unitsPerCarton: 10, cartonsPerPallet: 24, baseUnitLabel: 'loaf' },
    defaultRemovalStrategy: 'FEFO',
    defaultBinLocation: 'CDC-Bakery-Rack-B1',
  },
  'SKU-BAK-002': {
    salesChannel: 'B2C',
    b2cImageUrl: B2C_BAKERY_IMG,
    b2bImageUrl: b2bPalletCartonsImg,
    retailPackagingSpec: 'Windowed Pastry Box · Pack of 3 Croissants',
    wholesalePackagingSpec: 'Master Bake Carton (16 Packs / 48 Croissants)',
    outerBoxBarcode: '8997021002028',
    grossWeightKg: 4.5,
    palletDimensions: '120 x 80 x 150 cm (30 Cartons)',
    uomConversion: { wholesaleUnitLabel: 'Carton', unitsPerCarton: 16, cartonsPerPallet: 30, baseUnitLabel: 'pack' },
    defaultRemovalStrategy: 'FEFO',
    defaultBinLocation: 'CDC-Bakery-Rack-B2',
  },
  'SKU-DAI-001': {
    salesChannel: 'BOTH',
    b2cImageUrl: B2C_BAKERY_IMG,
    b2bImageUrl: b2bChilledCratesImg,
    retailPackagingSpec: 'Molded Pulp 10-Egg Retail Carton · Omega-3 Sealed',
    wholesalePackagingSpec: 'Ikat Peti Bulk Tray (18 Retail Cartons / 180 Eggs)',
    outerBoxBarcode: '8997021003018',
    grossWeightKg: 11.4,
    palletDimensions: '120 x 100 x 140 cm (32 Peti)',
    uomConversion: { wholesaleUnitLabel: 'Peti', unitsPerCarton: 18, cartonsPerPallet: 32, baseUnitLabel: 'carton' },
    defaultRemovalStrategy: 'FEFO',
    defaultBinLocation: 'CDC-Chilled-Rack-B1',
  },
  'SKU-DAI-002': {
    salesChannel: 'BOTH',
    b2cImageUrl: B2C_STORE_IMG,
    b2bImageUrl: b2bChilledCratesImg,
    retailPackagingSpec: 'Foil Parchment Retail Block · 200g Cultured Butter',
    wholesalePackagingSpec: 'Insulated Dairy Carton (24 Blocks / 4.8 Kg Net)',
    outerBoxBarcode: '8997021003025',
    grossWeightKg: 5.2,
    palletDimensions: '120 x 100 x 140 cm (50 Cartons)',
    uomConversion: { wholesaleUnitLabel: 'Carton', unitsPerCarton: 24, cartonsPerPallet: 50, baseUnitLabel: 'block' },
    defaultRemovalStrategy: 'FEFO',
    defaultBinLocation: 'CDC-Chilled-Rack-B2',
  },
  'SKU-MEA-001': {
    salesChannel: 'BOTH',
    b2cImageUrl: B2C_STORE_IMG,
    b2bImageUrl: b2bChilledCratesImg,
    retailPackagingSpec: 'Vacuum Skin-Pack Retail Tray · 250g Ribeye Cut',
    wholesalePackagingSpec: 'HoReCa Cryovac Master Box (12 Cuts / 3.0 Kg Net)',
    outerBoxBarcode: '8997021004015',
    grossWeightKg: 3.4,
    palletDimensions: '120 x 100 x 135 cm (45 Master Boxes)',
    uomConversion: { wholesaleUnitLabel: 'Master Box', unitsPerCarton: 12, cartonsPerPallet: 45, baseUnitLabel: 'cut' },
    defaultRemovalStrategy: 'FEFO',
    defaultBinLocation: 'CDC-Freezer-Vault-F1',
  },
  'SKU-MEA-002': {
    salesChannel: 'B2C',
    b2cImageUrl: B2C_STORE_IMG,
    b2bImageUrl: b2bChilledCratesImg,
    retailPackagingSpec: 'Deep-Chill Vacuum Pouch · 200g Sashimi Loin',
    wholesalePackagingSpec: 'Blast-Freeze Insulated Carton (25 Pouches / 5.0 Kg Net)',
    outerBoxBarcode: '8997021004022',
    grossWeightKg: 5.5,
    palletDimensions: '120 x 100 x 135 cm (40 Cartons)',
    uomConversion: { wholesaleUnitLabel: 'Carton', unitsPerCarton: 25, cartonsPerPallet: 40, baseUnitLabel: 'pack' },
    defaultRemovalStrategy: 'FEFO',
    defaultBinLocation: 'CDC-Freezer-Vault-F2',
  },
  'SKU-PAN-001': {
    salesChannel: 'BOTH',
    b2cImageUrl: B2C_FARM_IMG,
    b2bImageUrl: b2bPalletCartonsImg,
    retailPackagingSpec: 'One-Way Degassing Valve Retail Bag · 250g',
    wholesalePackagingSpec: 'Corrugated Master Carton (24 Bags / 6.0 Kg Net)',
    outerBoxBarcode: '8997021005012',
    grossWeightKg: 6.5,
    palletDimensions: '120 x 100 x 160 cm (48 Cartons)',
    uomConversion: { wholesaleUnitLabel: 'Carton', unitsPerCarton: 24, cartonsPerPallet: 48, baseUnitLabel: 'bag' },
    defaultRemovalStrategy: 'FIFO',
    defaultBinLocation: 'CDC-Dry-Rack-A2',
  },
  'SKU-PAN-002': {
    salesChannel: 'BOTH',
    b2cImageUrl: B2C_FARM_IMG,
    b2bImageUrl: b2bPalletCartonsImg,
    retailPackagingSpec: 'Hexagonal Glass Retail Jar · 350ml Tamper-Sealed',
    wholesalePackagingSpec: 'Partitioned Protective Carton (12 Jars / 6.2 Kg Gross)',
    outerBoxBarcode: '8997021005029',
    grossWeightKg: 6.2,
    palletDimensions: '120 x 100 x 150 cm (54 Cartons)',
    uomConversion: { wholesaleUnitLabel: 'Carton', unitsPerCarton: 12, cartonsPerPallet: 54, baseUnitLabel: 'jar' },
    defaultRemovalStrategy: 'FIFO',
    defaultBinLocation: 'CDC-Dry-Rack-A3',
  },
  'B2B-SKU-BERAS-01': {
    salesChannel: 'B2B',
    b2cImageUrl: B2C_FARM_IMG,
    b2bImageUrl: b2bPalletCartonsImg,
    retailPackagingSpec: 'Single Woven Sack · 5kg Retail Carry Bag',
    wholesalePackagingSpec: 'Heavy-Duty Bale / Master Dus (4 Sacks / 20kg) · Palletized 40 Dus',
    outerBoxBarcode: '8997021008013',
    grossWeightKg: 20.4,
    palletDimensions: '120 x 100 x 165 cm (40 Dus / 800 Kg)',
    uomConversion: { wholesaleUnitLabel: 'Dus (4 Sak)', unitsPerCarton: 4, cartonsPerPallet: 40, baseUnitLabel: 'Sak 5kg' },
    defaultRemovalStrategy: 'FIFO',
    defaultBinLocation: 'CDC-Bulk-Pallet-P1',
  },
  'B2B-SKU-MINYAK-01': {
    salesChannel: 'B2B',
    b2cImageUrl: B2C_STORE_IMG,
    b2bImageUrl: b2bPalletCartonsImg,
    retailPackagingSpec: 'Standing Pouch 2L · Retail Shelf Unit',
    wholesalePackagingSpec: 'Reinforced Carton (6 Pouches / 12L) · Pallet 60 Dus',
    outerBoxBarcode: '8997021008020',
    grossWeightKg: 11.8,
    palletDimensions: '120 x 100 x 160 cm (60 Dus)',
    uomConversion: { wholesaleUnitLabel: 'Dus (6 Pcs)', unitsPerCarton: 6, cartonsPerPallet: 60, baseUnitLabel: 'Pouch 2L' },
    defaultRemovalStrategy: 'FIFO',
    defaultBinLocation: 'CDC-Bulk-Pallet-P2',
  },
  'B2B-SKU-MIE-01': {
    salesChannel: 'B2B',
    b2cImageUrl: B2C_STORE_IMG,
    b2bImageUrl: b2bPalletCartonsImg,
    retailPackagingSpec: 'Single Pack 85g · Retail Wrapper',
    wholesalePackagingSpec: 'Standard Cardboard Master Carton (40 Bungkus) · Barcode Outer Sealed',
    outerBoxBarcode: '8997021008037',
    grossWeightKg: 3.9,
    palletDimensions: '120 x 100 x 170 cm (50 Dus)',
    uomConversion: { wholesaleUnitLabel: 'Dus (40 Bks)', unitsPerCarton: 40, cartonsPerPallet: 50, baseUnitLabel: 'Bungkus' },
    defaultRemovalStrategy: 'FIFO',
    defaultBinLocation: 'CDC-Bulk-Rack-C1',
  },
  'B2B-SKU-KOPI-01': {
    salesChannel: 'B2B',
    b2cImageUrl: B2C_FARM_IMG,
    b2bImageUrl: b2bPalletCartonsImg,
    retailPackagingSpec: 'Individual Foil Sachet 24g',
    wholesalePackagingSpec: 'Master Carton (20 Slop / 100 Renceng / 1,000 Sachet)',
    outerBoxBarcode: '8997021008044',
    grossWeightKg: 25.2,
    palletDimensions: '120 x 100 x 160 cm (32 Dus)',
    uomConversion: { wholesaleUnitLabel: 'Slop (50 Sch)', unitsPerCarton: 50, cartonsPerPallet: 640, baseUnitLabel: 'Sachet' },
    defaultRemovalStrategy: 'FIFO',
    defaultBinLocation: 'CDC-Dry-Rack-C2',
  },
  'B2B-SKU-GULA-01': {
    salesChannel: 'B2B',
    b2cImageUrl: B2C_STORE_IMG,
    b2bImageUrl: b2bPalletCartonsImg,
    retailPackagingSpec: 'Retail Pillow Pack 1kg',
    wholesalePackagingSpec: 'Heavy Master Carton (24 Pcs / 24kg) · 45 Dus/Pallet',
    outerBoxBarcode: '8997021008051',
    grossWeightKg: 24.5,
    palletDimensions: '120 x 100 x 155 cm (45 Dus)',
    uomConversion: { wholesaleUnitLabel: 'Dus (24 Pcs)', unitsPerCarton: 24, cartonsPerPallet: 45, baseUnitLabel: 'Pcs 1kg' },
    defaultRemovalStrategy: 'FIFO',
    defaultBinLocation: 'CDC-Bulk-Pallet-P3',
  },
  'B2B-SKU-SUSU-01': {
    salesChannel: 'B2B',
    b2cImageUrl: B2C_STORE_IMG,
    b2bImageUrl: b2bChilledCratesImg,
    retailPackagingSpec: 'Tetra Pak Aseptic Carton 1000ml',
    wholesalePackagingSpec: 'Tray Shrink-Wrap Dus (12 x 1L) · Cold-Ready Staging',
    outerBoxBarcode: '8997021008068',
    grossWeightKg: 12.6,
    palletDimensions: '120 x 100 x 150 cm (50 Dus)',
    uomConversion: { wholesaleUnitLabel: 'Dus (12 Kotak)', unitsPerCarton: 12, cartonsPerPallet: 50, baseUnitLabel: 'Kotak 1L' },
    defaultRemovalStrategy: 'FEFO',
    defaultBinLocation: 'CDC-Chilled-Rack-C1',
  },
  'B2B-SKU-TELUR-01': {
    salesChannel: 'B2B',
    b2cImageUrl: B2C_BAKERY_IMG,
    b2bImageUrl: b2bChilledCratesImg,
    retailPackagingSpec: 'Pulp Karpet Tray (30 Butir)',
    wholesalePackagingSpec: 'Ikat Peti Kayu (6 Tray / 180 Butir / ~10kg Gross)',
    outerBoxBarcode: '8997021008075',
    grossWeightKg: 10.5,
    palletDimensions: '120 x 100 x 140 cm (30 Peti)',
    uomConversion: { wholesaleUnitLabel: 'Tray (30 Btr)', unitsPerCarton: 30, cartonsPerPallet: 180, baseUnitLabel: 'Butir' },
    defaultRemovalStrategy: 'FEFO',
    defaultBinLocation: 'CDC-Chilled-Rack-C2',
  },
  'B2B-SKU-RINSO-01': {
    salesChannel: 'B2B',
    b2cImageUrl: B2C_STORE_IMG,
    b2bImageUrl: b2bPalletCartonsImg,
    retailPackagingSpec: 'Single Detergent Sachet 40g',
    wholesalePackagingSpec: 'Master Carton (20 Renceng / 120 Sachet)',
    outerBoxBarcode: '8997021008082',
    grossWeightKg: 5.3,
    palletDimensions: '120 x 100 x 160 cm (60 Dus)',
    uomConversion: { wholesaleUnitLabel: 'Renceng (6 Sch)', unitsPerCarton: 6, cartonsPerPallet: 1200, baseUnitLabel: 'Sachet' },
    defaultRemovalStrategy: 'FIFO',
    defaultBinLocation: 'CDC-Dry-Rack-D1',
  },
};

export function getOdooSkuProfile(
  sku: string,
  category?: string,
  unit?: string,
  fallbackImage?: string
): OdooSkuProfile {
  const override = SKU_PROFILES[sku] || {};
  const perishable = isPerishableCategory(category);
  const defaultB2C =
    category === 'produce'
      ? B2C_PRODUCE_IMG
      : category === 'bakery'
      ? B2C_BAKERY_IMG
      : category === 'pantry_coffee'
      ? B2C_FARM_IMG
      : B2C_STORE_IMG;
  const defaultB2B = perishable ? b2bChilledCratesImg : b2bPalletCartonsImg;
  const baseUnitLabel = unit || 'pcs';

  return {
    sku,
    salesChannel: override.salesChannel || (sku.startsWith('B2B-') ? 'B2B' : 'BOTH'),
    b2cImageUrl: override.b2cImageUrl || fallbackImage || defaultB2C,
    b2bImageUrl: override.b2bImageUrl || defaultB2B,
    retailPackagingSpec: override.retailPackagingSpec || `Retail Unit Pack (${baseUnitLabel})`,
    wholesalePackagingSpec:
      override.wholesalePackagingSpec ||
      (perishable ? `Chilled Master Crate (12 x ${baseUnitLabel})` : `Bulk Master Carton (24 x ${baseUnitLabel})`),
    outerBoxBarcode: override.outerBoxBarcode || `8997021${sku.replace(/[^0-9]/g, '').padEnd(6, '0').slice(0, 6)}`,
    grossWeightKg: override.grossWeightKg || (perishable ? 6.0 : 12.0),
    palletDimensions: override.palletDimensions || '120 x 100 x 150 cm',
    uomConversion: override.uomConversion || {
      wholesaleUnitLabel: perishable ? 'Crate' : 'Carton',
      unitsPerCarton: perishable ? 12 : 24,
      cartonsPerPallet: 40,
      baseUnitLabel,
    },
    defaultRemovalStrategy: override.defaultRemovalStrategy || getDefaultRemovalStrategy(category, sku),
    defaultBinLocation:
      override.defaultBinLocation || (perishable ? 'CDC-Chilled-Rack-A1' : 'CDC-Dry-Rack-B1'),
  };
}

export function formatMultiUomStock(
  baseQty: number,
  uom: UoMConversionMeta
): { wholesaleSummary: string; baseSummary: string } {
  const safeQty = Math.max(0, Number(baseQty) || 0);
  const uomConversionFactor = Math.max(1, uom.unitsPerCarton || 1);
  const fullBulkUnits = Math.floor(safeQty / uomConversionFactor);
  const looseBaseUnits = Number((safeQty - fullBulkUnits * uomConversionFactor).toFixed(2));
  const wholesaleSummary =
    fullBulkUnits > 0 && looseBaseUnits > 0
      ? `${fullBulkUnits} ${uom.wholesaleUnitLabel} + ${looseBaseUnits} loose`
      : fullBulkUnits > 0 && looseBaseUnits === 0
      ? `${fullBulkUnits} ${uom.wholesaleUnitLabel}`
      : `0 ${uom.wholesaleUnitLabel} (${looseBaseUnits} loose)`;
  return {
    wholesaleSummary,
    baseSummary: `${safeQty.toLocaleString('id-ID')} ${uom.baseUnitLabel}`,
  };
}

export interface TierLotResolution {
  lotNumber: string;
  expiryDate: string;
  daysUntilExpiry: number | null;
  statusLabel: string;
  tone: 'emerald' | 'amber' | 'rose' | 'slate';
  binLocation: string;
  activeBatchCount: number;
  expiredBatchCount: number;
  isQuarantined: boolean;
}

export function resolveLotAndFefoForTier(
  sku: string,
  storeId: string,
  zoneId: string,
  batches: InventoryBatch[],
  warehouseBins: WarehouseBinLocation[],
  strategy: RemovalStrategyType,
  defaultBinLocation: string
): TierLotResolution {
  const matchedBin = warehouseBins.find(
    (b) => b.currentSku === sku && (b.storeId === storeId || b.zoneId === zoneId)
  );
  const binLocation = matchedBin
    ? `${matchedBin.binCode} (${matchedBin.rack})`
    : defaultBinLocation;

  const skuBatches = batches.filter(
    (b) => b.sku === sku && (b.storeId === storeId || storeId === 'CONSOLIDATED')
  );
  const pool = skuBatches.length > 0 ? skuBatches : batches.filter((b) => b.sku === sku);

  const nowMs = Date.now();
  const isBatchExpired = (b: InventoryBatch): boolean => {
    if (b.status === 'expired') return true;
    if (typeof b.daysUntilExpiry === 'number' && b.daysUntilExpiry <= 0) return true;
    if (b.expiryDate) {
      const expMs = new Date(b.expiryDate).getTime();
      if (!Number.isNaN(expMs) && expMs <= nowMs) return true;
    }
    return false;
  };
  const isBatchQuarantinedOrRecalled = (b: InventoryBatch): boolean =>
    b.status === 'quarantined' || b.status === 'recalled';

  const sortByStrategy = (a: InventoryBatch, b: InventoryBatch) => {
    if (strategy === 'FIFO') {
      return new Date(a.receivedDate).getTime() - new Date(b.receivedDate).getTime();
    }
    return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
  };

  const nonDepletedPool = pool.filter((b) => b.currentStock > 0 && b.status !== 'depleted');
  const sellablePool = nonDepletedPool
    .filter((b) => !isBatchExpired(b) && !isBatchQuarantinedOrRecalled(b))
    .sort(sortByStrategy);
  const lockedPool = nonDepletedPool
    .filter((b) => isBatchExpired(b) || isBatchQuarantinedOrRecalled(b))
    .sort(sortByStrategy);
  const quarantinedBatch = pool.find(isBatchQuarantinedOrRecalled);

  const leadBatch = sellablePool[0] || lockedPool[0] || quarantinedBatch || pool[0];
  if (!leadBatch) {
    return {
      lotNumber: `LOT-${sku.replace(/[^A-Z0-9]/g, '').slice(-6)}`,
      expiryDate: '—',
      daysUntilExpiry: null,
      statusLabel: strategy === 'FIFO' ? 'Dry · FIFO Ready' : 'Standard Stock',
      tone: 'slate',
      binLocation,
      activeBatchCount: 0,
      expiredBatchCount: 0,
      isQuarantined: false,
    };
  }

  const days = typeof leadBatch.daysUntilExpiry === 'number' ? leadBatch.daysUntilExpiry : null;
  const leadIsQuarantined = isBatchQuarantinedOrRecalled(leadBatch);
  const leadIsExpired = isBatchExpired(leadBatch);
  const isQuarantined = sellablePool.length === 0 && (leadIsQuarantined || leadIsExpired);

  let statusLabel = 'Fresh';
  let tone: TierLotResolution['tone'] = 'emerald';

  if (leadIsQuarantined) {
    statusLabel = leadBatch.status === 'recalled' ? 'Recalled · Locked' : 'Quarantined · Locked';
    tone = 'rose';
  } else if (leadIsExpired) {
    statusLabel = 'Expired · Locked';
    tone = 'rose';
  } else if (leadBatch.status === 'critical' || leadBatch.status === 'near_expiry' || (days !== null && days <= 7)) {
    statusLabel = days !== null ? `Near Expiry (${days}d) · Markdown` : 'Near Expiry < 7d';
    tone = 'amber';
  } else if (days !== null && days > 30) {
    statusLabel = `Fresh > 30d (${days}d)`;
    tone = 'emerald';
  } else if (days !== null) {
    statusLabel = `Fresh (${days}d)`;
    tone = 'emerald';
  }

  return {
    lotNumber: leadBatch.lotNumber,
    expiryDate: leadBatch.expiryDate ? leadBatch.expiryDate.split('T')[0] : '—',
    daysUntilExpiry: days,
    statusLabel,
    tone,
    binLocation,
    activeBatchCount: nonDepletedPool.length,
    expiredBatchCount: lockedPool.length,
    isQuarantined,
  };
}
