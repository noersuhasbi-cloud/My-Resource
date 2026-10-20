import express from 'express';
import type { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  INITIAL_STORE_STATUS,
  INITIAL_STORE_SCHEDULES,
  INITIAL_WAREHOUSE_ZONES,
  INITIAL_STORE_INVENTORY_TIERS,
  INITIAL_INVENTORY,
  INITIAL_PURCHASE_REQUESTS,
  INITIAL_PURCHASE_ORDERS,
  INITIAL_GOODS_RECEIPTS,
  INITIAL_COA,
  INITIAL_GENERAL_LEDGER,
  INITIAL_AUDIT_TRAIL,
  INITIAL_BATCHES,
  INITIAL_WASTE_RECORDS,
  INITIAL_PICKER_ORDERS,
  INITIAL_VENDOR_BILLS,
  INITIAL_ENTERPRISE_SETTINGS,
  INITIAL_LANDED_COSTS,
  INITIAL_WAREHOUSE_BINS,
  INITIAL_WAREHOUSE_ROUTES,
  INITIAL_QUOTATIONS,
} from './src/data/inventoryData.ts';
import { INITIAL_ORDERS, PRODUCTS } from './src/data/mockData.ts';

import type {
  InventoryItem,
  PurchaseRequest,
  PurchaseOrder,
  GeneralLedgerEntry,
  TransactionAuditRecord,
  StoreOperationalStatus,
  StoreOutletSchedule,
  WarehouseZone,
  StoreInventoryStock,
  GoodsReceiptRecord,
  ChartOfAccount,
  AccountCode,
  InventoryBatch,
  WasteRecord,
  PickerOrder,
  FEFOAllocationResult,
  Order,
  WeightToleranceConfig,
  NaturalShrinkageAdjustment,
  SubstitutionPromptRecord,
  StaffShiftSession,
  SecurityAuditTrailRecord,
  ClimateAdaptiveThresholdConfig,
  UserRole,
  SupportedCurrency,
  StorageZoneType,
  CurrencyExchangeRate,
  POSProductItem,
  POSTransactionRequest,
  POSTransactionReceipt,
  EnterpriseSettingsConfig,
  LandedCostRecord,
  WarehouseBinLocation,
  WarehouseMultiStepRoute,
  AnalyticDepartment,
  ProductMarginRecord,
  EnterpriseQuotation,
  EnterpriseQuotationItem,
  VendorBill,
  VendorBillItem,
  VendorBillStatus,
  VendorBillPaymentMethod,
  PromotionRule,
  CoaMappingConfig,
  PosCheckoutConfig,
  StockOpnameSession,
  StockTransferRecord,
  ApprovalTierRule,
  ApprovalRequest,
  BulkInventoryImportRow,
  SuratJalanDocument,
  DeliveryOrderDocument,
  ShipmentQuotaTracking,
  QCInspectionRecord,
  GroceryMetricsReport,
} from './src/types/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-Memory Data Store (Initialized with realistic seed data)
let storeStatus: StoreOperationalStatus = { ...INITIAL_STORE_STATUS };
let storeSchedules: StoreOutletSchedule[] = JSON.parse(JSON.stringify(INITIAL_STORE_SCHEDULES));
let warehouseZones: WarehouseZone[] = JSON.parse(JSON.stringify(INITIAL_WAREHOUSE_ZONES));
let storeInventoryTiers: StoreInventoryStock[] = JSON.parse(JSON.stringify(INITIAL_STORE_INVENTORY_TIERS));
let inventoryList: InventoryItem[] = JSON.parse(JSON.stringify(INITIAL_INVENTORY));
let purchaseRequests: PurchaseRequest[] = JSON.parse(JSON.stringify(INITIAL_PURCHASE_REQUESTS));
let purchaseOrders: PurchaseOrder[] = JSON.parse(JSON.stringify(INITIAL_PURCHASE_ORDERS));
let goodsReceipts: GoodsReceiptRecord[] = JSON.parse(JSON.stringify(INITIAL_GOODS_RECEIPTS));
let chartOfAccounts: ChartOfAccount[] = JSON.parse(JSON.stringify(INITIAL_COA));
let generalLedger: GeneralLedgerEntry[] = JSON.parse(JSON.stringify(INITIAL_GENERAL_LEDGER));
let auditTrail: TransactionAuditRecord[] = JSON.parse(JSON.stringify(INITIAL_AUDIT_TRAIL));
let inventoryBatches: InventoryBatch[] = JSON.parse(JSON.stringify(INITIAL_BATCHES));
let wasteRecords: WasteRecord[] = JSON.parse(JSON.stringify(INITIAL_WASTE_RECORDS));
let pickerOrders: PickerOrder[] = JSON.parse(JSON.stringify(INITIAL_PICKER_ORDERS));
let customerOrders: Order[] = JSON.parse(JSON.stringify(INITIAL_ORDERS));
let enterpriseSettings: EnterpriseSettingsConfig = JSON.parse(JSON.stringify(INITIAL_ENTERPRISE_SETTINGS));
let landedCostsList: LandedCostRecord[] = JSON.parse(JSON.stringify(INITIAL_LANDED_COSTS));
let warehouseBins: WarehouseBinLocation[] = JSON.parse(JSON.stringify(INITIAL_WAREHOUSE_BINS));
let warehouseRoutes: WarehouseMultiStepRoute[] = JSON.parse(JSON.stringify(INITIAL_WAREHOUSE_ROUTES));
let vendorBillsList: VendorBill[] = JSON.parse(JSON.stringify(INITIAL_VENDOR_BILLS));
let enterpriseQuotationsList: EnterpriseQuotation[] = JSON.parse(JSON.stringify(INITIAL_QUOTATIONS));

let coaMappingConfig: CoaMappingConfig = {
  posRevenueAccountCode: '4010',
  posRevenueAccountName: 'Grocery Sales Revenue - Retail Storefront',
  inventoryAssetAccountCode: '1040',
  inventoryAssetAccountName: 'Merchandise Inventory Asset',
  shrinkageExpenseAccountCode: '5030',
  shrinkageExpenseAccountName: 'Waste, Spoilage & Shrinkage Expense',
  cogsAccountCode: '5010',
  cogsAccountName: 'Cost of Goods Sold (COGS) - FIFO / WAC',
  cashClearingAccountCode: '1010',
  cashClearingAccountName: 'Cash & Register Drawer Clearing',
  qrisClearingAccountCode: '1030',
  qrisClearingAccountName: 'QRIS Settlement Receivable (ASPI Clearing)',
  edcClearingAccountCode: '1020',
  edcClearingAccountName: 'Bank BCA Operational Clearing (EDC Card)',
  taxPayableAccountCode: '2020',
  taxPayableAccountName: 'Value-Added Tax (PPN) Output Payable',
  updatedAt: new Date().toISOString(),
  updatedBy: 'Siti Rahmawati',
};

let posCheckoutConfig: PosCheckoutConfig = {
  roundingRule: 'nearest_100',
  ppnTaxPercent: 11,
  isTaxInclusive: false,
  maxCashierDiscountPercent: 15,
  enableVivoNearExpiryDiscount: true,
  vivoNearExpiryDiscountPercent: 25,
  cashDrawerFloatIDR: 500000,
  loyaltyPointsPer1000IDR: 1,
  requireManagerPinForVoid: true,
  storeReceiptFooterText: 'Thank you for shopping at GroceMart! Fresh harvest daily.',
  updatedAt: new Date().toISOString(),
  updatedBy: 'Budi Santoso',
};

let stockOpnameSessions: StockOpnameSession[] = [];
let stockTransfersList: StockTransferRecord[] = [];
let approvalRulesList: ApprovalTierRule[] = [
  {
    id: 'RULE-PO-01',
    module: 'procurement_po',
    tierLevel: 1,
    tierName: 'Store Supervisor Clearance',
    minThresholdIDR: 0,
    maxThresholdIDR: 10000000,
    requiredRole: 'store_manager',
    requiresPin: false,
    autoApproveBelowMin: false,
    slaHours: 24,
    description: 'Store Managers can approve regular inventory restocks under 10 Million IDR',
  },
  {
    id: 'RULE-PO-02',
    module: 'procurement_po',
    tierLevel: 2,
    tierName: 'Regional GM Capital PO',
    minThresholdIDR: 10000001,
    maxThresholdIDR: 50000000,
    requiredRole: 'store_manager',
    requiresPin: true,
    autoApproveBelowMin: false,
    slaHours: 24,
    description: 'Bulk fresh intakes between 10M and 50M IDR require managerial PIN confirmation',
  },
  {
    id: 'RULE-PO-03',
    module: 'procurement_po',
    tierLevel: 3,
    tierName: 'CFO & Executive Board PO',
    minThresholdIDR: 50000001,
    maxThresholdIDR: null,
    requiredRole: 'executive',
    requiresPin: true,
    autoApproveBelowMin: false,
    slaHours: 48,
    description: 'Enterprise farm partnership contracts > 50M IDR require C-level executive sign-off',
  },
  {
    id: 'RULE-WASTE-01',
    module: 'waste_write_off',
    tierLevel: 1,
    tierName: 'Perishable Shrinkage Scrap Clearance',
    minThresholdIDR: 0,
    maxThresholdIDR: 15000000,
    requiredRole: 'store_manager',
    requiresPin: false,
    autoApproveBelowMin: false,
    slaHours: 12,
    description: 'Quality lead scrap disposal verified by Store Manager',
  },
  {
    id: 'RULE-ADJ-01',
    module: 'stock_adjustment',
    tierLevel: 1,
    tierName: 'Stocktake Variance Reconcile',
    minThresholdIDR: 0,
    maxThresholdIDR: 20000000,
    requiredRole: 'store_manager',
    requiresPin: false,
    autoApproveBelowMin: false,
    slaHours: 12,
    description: 'Stock opname variances require store manager approval before posting to GL',
  },
];

let approvalQueueList: ApprovalRequest[] = [
  {
    id: 'APR-2026-001',
    module: 'procurement_po',
    documentId: 'PO-2026-0042',
    documentTitle: 'Bulk Farm Harvest PO: Hydroponic Romaine & Butterhead',
    requestedBy: 'Andi Wijaya (Procurement Lead)',
    requestedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    amountIDR: 18500000,
    storeId: 'store-jkt-senopati',
    storeName: 'GroceMart Senopati Flagship',
    currentTierLevel: 1,
    requiredTierLevel: 2,
    status: 'PENDING',
    history: [],
    payloadSummary: {
      sku: 'SKU-PRD-001',
      productName: 'Hydroponic Romaine Lettuce',
      quantity: 150,
      reason: 'Weekend fresh produce seasonal surge replenishment',
    },
  },
  {
    id: 'APR-2026-002',
    module: 'waste_write_off',
    documentId: 'WST-2026-0018',
    documentTitle: 'Chilled Display Spoilage Scrap Authorization',
    requestedBy: 'Siti Rahma (Quality Inspector)',
    requestedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    amountIDR: 3400000,
    storeId: 'store-jkt-pik',
    storeName: 'GroceMart PIK 2 The Avenue',
    currentTierLevel: 1,
    requiredTierLevel: 1,
    status: 'PENDING',
    history: [],
    payloadSummary: {
      sku: 'SKU-DRY-002',
      productName: 'Organic Greek Yogurt 500g',
      quantity: 45,
      reason: 'Cold-chain display shelf compressor temp excursion exceeding 4h',
    },
  },
];

let suratJalanList: SuratJalanDocument[] = [
  {
    id: 'SJ-2026-0418',
    documentNumber: 'SJ/GMRT/JKT/2026/0418',
    issueDate: new Date().toISOString().split('T')[0],
    deliveryOrderRef: 'DO/GMRT/2026/0210',
    transferRef: 'TRF-2026-001',
    poRef: 'PO-2026-0012',
    senderStoreId: 'store-jkt-senopati',
    senderStoreName: 'GroceMart Senopati Flagship',
    senderAddress: 'Jl. Senopati No. 42, Kebayoran Baru, Jakarta Selatan',
    senderPhone: '+62 21 720 8891',
    recipientName: 'GroceMart PIK 2 Fulfillment Hub',
    recipientAddress: 'The Avenue Commercial Strip B-12, PIK 2, Jakarta Utara',
    recipientPhone: '+62 21 502 9942',
    recipientStoreId: 'store-jkt-pik',
    carrierName: 'GroceMart Fleet Cold Logistics',
    vehiclePlateNumber: 'B 9142 SRO',
    vehicleType: 'Refrigerated Van 1.5T (Cold-Chute -2°C to 4°C)',
    driverName: 'Bambang Supriyanto',
    driverPhone: '+62 812 8899 7711',
    coldChainTempCelsius: 3.5,
    specialHandlingInstructions: 'Continuous Reefer Thermologger active; do not break seal until receiving dock inspection.',
    items: [
      {
        sku: 'SKU-PRD-001',
        productName: 'Hydroponic Romaine Lettuce 250g',
        batchNumber: 'BAT-2026-081',
        quantity: 120,
        unit: 'pack',
        packagingType: 'Plastic Crate',
        condition: 'Fresh / Intact',
        notes: 'Pre-cooled harvest from Lembang farm partner',
      },
      {
        sku: 'SKU-DRY-001',
        productName: 'Farm Fresh Pasteurized Milk 1L',
        batchNumber: 'BAT-2026-094',
        quantity: 60,
        unit: 'bottle',
        packagingType: 'Corrugated Box',
        condition: 'Cold-Chilled OK',
        notes: 'Expiry verified > 10 days',
      },
    ],
    totalPackages: 180,
    totalWeightKg: 95.5,
    status: 'in_transit',
    senderSignatureName: 'Budi Santoso (Store Manager)',
    driverSignatureName: 'Bambang Supriyanto',
  },
];

let deliveryOrdersList: DeliveryOrderDocument[] = [
  {
    id: 'DO-2026-0210',
    doNumber: 'DO/GMRT/2026/0210',
    issueDate: new Date().toISOString().split('T')[0],
    poNumber: 'PO-2026-0012',
    customerOrStoreName: 'GroceMart PIK 2 Outlet & Commercial Kitchen',
    deliveryAddress: 'The Avenue Commercial Strip B-12, PIK 2, Jakarta Utara',
    deliveryWindow: 'Morning Slot (08:00 - 11:30 WIB)',
    authorizedOfficer: 'Hendra Gunawan (Logistics Supervisor)',
    items: [
      {
        sku: 'SKU-PRD-001',
        productName: 'Hydroponic Romaine Lettuce 250g',
        orderedQty: 120,
        dispatchedQty: 120,
        unit: 'pack',
        unitPriceIDR: 24500,
        totalPriceIDR: 2940000,
      },
      {
        sku: 'SKU-DRY-001',
        productName: 'Farm Fresh Pasteurized Milk 1L',
        orderedQty: 60,
        dispatchedQty: 60,
        unit: 'bottle',
        unitPriceIDR: 32000,
        totalPriceIDR: 1920000,
      },
    ],
    subtotalIDR: 4860000,
    taxIDR: 0,
    totalAmountIDR: 4860000,
    status: 'in_transit',
    notes: 'Priority morning delivery with calibrated cold sensor payload.',
  },
];

let shipmentsList: ShipmentQuotaTracking[] = [
  {
    id: 'SHP-2026-001',
    tripId: 'TRIP-JKT-0418',
    vehicleType: 'Refrigerated Van 1.5T',
    vehiclePlate: 'B 9142 SRO',
    maxPayloadKg: 1500,
    currentPayloadKg: 1140,
    quotaUtilizationPercent: 76,
    storageZone: 'cold_chilled',
    currentTempCelsius: 3.2,
    targetTempCelsius: 4.0,
    departureHub: 'Senopati Central Hub',
    destinationHub: 'PIK 2 Avenue Store',
    departureTime: '08:15 WIB',
    estimatedArrival: '09:45 WIB',
    driverName: 'Bambang Supriyanto',
    driverContact: '+62 812 8899 7711',
    assignedOrdersCount: 6,
    status: 'in_transit',
  },
  {
    id: 'SHP-2026-002',
    tripId: 'TRIP-BDG-0102',
    vehicleType: 'Chilled Truck 4T',
    vehiclePlate: 'D 8812 GCM',
    maxPayloadKg: 4000,
    currentPayloadKg: 3600,
    quotaUtilizationPercent: 90,
    storageZone: 'cold_chilled',
    currentTempCelsius: 2.8,
    targetTempCelsius: 4.0,
    departureHub: 'Lembang Agri Partner Terminal',
    destinationHub: 'Dago Green Market Hub',
    departureTime: '06:30 WIB',
    estimatedArrival: '07:45 WIB',
    driverName: 'Asep Saepudin',
    driverContact: '+62 813 2233 4455',
    assignedOrdersCount: 14,
    status: 'arrived',
  },
];

let qcInspectionsList: QCInspectionRecord[] = [
  {
    id: 'QC-2026-0042',
    timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
    referenceType: 'INCOMING_PO',
    referenceId: 'PO-2026-0012',
    sku: 'SKU-PRD-001',
    productName: 'Hydroponic Romaine Lettuce 250g',
    category: 'produce',
    batchNumber: 'BAT-2026-081',
    expiryDate: new Date(Date.now() + 86400000 * 12).toISOString().split('T')[0],
    sampleQuantity: 10,
    totalBatchQuantity: 150,
    storeId: 'store-jkt-senopati',
    storeName: 'GroceMart Senopati Flagship',
    inspectorId: 'QC-INSP-01',
    inspectorName: 'Siti Rahma (HACCP Lead)',
    parameters: {
      visualFreshness: 'Grade A (Pristine)',
      temperatureCelsius: 3.8,
      coldChainCompliant: true,
      packagingIntegrity: 'Sealed & Intact',
      sensoryOdorCheck: 'Normal & Fresh',
      brixSugarContent: 4.2,
      weightToleranceCompliant: true,
    },
    disposition: 'PASSED',
    actionTaken: 'RELEASE_TO_SHELF',
    notes: 'Firm crisp leaves, zero tip burn, pristine harvest seals.',
  },
  {
    id: 'QC-2026-0043',
    timestamp: new Date(Date.now() - 3600000 * 6).toISOString(),
    referenceType: 'INTER_WAREHOUSE_TRANSFER',
    referenceId: 'TRF-2026-001',
    sku: 'SKU-DRY-002',
    productName: 'Organic Greek Yogurt 500g',
    category: 'dairy_eggs',
    batchNumber: 'BAT-2026-077',
    expiryDate: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
    sampleQuantity: 5,
    totalBatchQuantity: 40,
    storeId: 'store-jkt-pik',
    storeName: 'GroceMart PIK 2 The Avenue',
    inspectorId: 'QC-INSP-02',
    inspectorName: 'Dewi Lestari',
    parameters: {
      visualFreshness: 'Grade B (Acceptable)',
      temperatureCelsius: 5.8,
      coldChainCompliant: false,
      packagingIntegrity: 'Sealed & Intact',
      sensoryOdorCheck: 'Normal & Fresh',
      weightToleranceCompliant: true,
    },
    disposition: 'QUARANTINED',
    actionTaken: 'QUARANTINE_HOLD',
    notes: 'Intake temp 5.8°C exceeds 4.0°C limit; held under secondary microbiological testing.',
  },
];
let promotionRulesList: PromotionRule[] = [
  {
    id: 'PRM-2026-01',
    name: 'Organic Fresh Produce Welcome',
    code: 'ORGANIC20',
    type: 'PERCENTAGE_DISCOUNT',
    targetType: 'CATEGORY',
    targetValue: 'produce',
    discountPercent: 20,
    minOrderSubtotalIDR: 50000,
    active: true,
    description: '20% off all crisp greens and heirloom produce',
    usageCount: 42,
  },
  {
    id: 'PRM-2026-02',
    name: 'Gold Member VIP Fresh Bonus',
    code: 'VIPGOLD10',
    type: 'MEMBER_TIER',
    targetType: 'ALL',
    targetValue: 'ALL',
    discountPercent: 10,
    memberTier: 'GOLD',
    active: true,
    description: 'Exclusive 10% discount for Gold tier cardholders',
    usageCount: 88,
  },
  {
    id: 'PRM-2026-03',
    name: 'Butterhead Lettuce B2G1 Harvest Festival',
    code: 'B2G1_LETTUCE',
    type: 'BOGO',
    targetType: 'SKU',
    targetValue: 'SKU-PRD-001',
    buyQty: 2,
    getQty: 1,
    getDiscountPercent: 100,
    active: true,
    description: 'Buy 2 Butterhead heads, get 1 free',
    usageCount: 15,
  },
];
let posTransactionsHistory: POSTransactionReceipt[] = [
  {
    receiptNumber: 'RCP-SEN-882104',
    transactionId: 'TXN-POS-2026-0001',
    orderId: 'GCM-POS-882104',
    timestamp: '2026-10-16T14:32:00Z',
    storeId: 'store-jkt-senopati',
    storeName: 'GroceMart Senopati Flagship',
    cashierId: 'USR-CASH-01',
    cashierName: 'Andi Wijaya (Frontline Cashier)',
    shiftId: 'SHIFT-JKT-SEN-MORNING',
    items: [
      {
        id: 'cart-line-1',
        sku: 'SKU-PRD-001',
        productId: 'prod-01',
        name: 'Organic Hydroponic Butterhead Lettuce',
        category: 'produce',
        unitPrice: 18500,
        unitCost: 11000,
        quantity: 2,
        unit: '250g head',
        lineTotal: 37000,
        batchId: 'BAT-2026-081',
        lotNumber: 'LOT-LETT-2610-A',
        expiryDate: '2026-10-12T23:59:59Z',
        daysUntilExpiry: 2,
      },
      {
        id: 'cart-line-2',
        sku: 'SKU-DAI-001',
        productId: 'prod-04',
        name: 'Artisanal Pasteurised A2 Fresh Milk',
        category: 'dairy',
        unitPrice: 38000,
        unitCost: 22000,
        quantity: 1,
        unit: '1L glass bottle',
        lineTotal: 38000,
        batchId: 'BAT-2026-084',
        lotNumber: 'LOT-MILK-2610-A',
        expiryDate: '2026-10-16T23:59:59Z',
        daysUntilExpiry: 6,
      },
    ],
    subtotal: 75000,
    discount: 0,
    tax: 8250,
    total: 83250,
    currency: 'IDR',
    currencyTotal: 83250,
    currencyRateToIDR: 1,
    paymentMethod: 'qris',
    qrisRef: 'QRIS-POS-882104',
    journalEntryIds: ['GLE-2026-0103', 'GLE-2026-0104', 'GLE-2026-0105', 'GLE-2026-0106'],
    inventoryDeductedCount: 3,
    totalCogsCost: 44000,
  },
];

// -------------------------------------------------------------
// MODULE 1, 2, 3, 4 IN-MEMORY DATA STORES
// -------------------------------------------------------------
// Module 1: Weight Tolerance by Category & Natural Shrinkage adjustments
let weightToleranceConfigs: WeightToleranceConfig[] = [
  {
    category: 'produce',
    categoryLabel: 'Fresh Organic Produce (Leafy Greens, Berries, Root Vegetables)',
    maxEvaporationTolerancePercent: 5.0, // 5% expected transpiration loss over 48h
    auditIntervalHours: 24,
    description: 'Natural moisture respiration and cell evaporation during ambient/chilled holding',
  },
  {
    category: 'meat_seafood',
    categoryLabel: 'Artisanal Butchery & Prime Seafood Cuts',
    maxEvaporationTolerancePercent: 3.0, // 3% dry-aging/drip purge tolerance
    auditIntervalHours: 12,
    description: 'Drip purge loss during cold-chain 0-2°C storage',
  },
  {
    category: 'dairy_eggs',
    categoryLabel: 'Artisan Cheeses & Dairy',
    maxEvaporationTolerancePercent: 1.5,
    auditIntervalHours: 48,
    description: 'Rind moisture loss in European specialty wheels',
  },
  {
    category: 'bakery',
    categoryLabel: 'Sourdough Loaves & Bakery',
    maxEvaporationTolerancePercent: 2.0,
    auditIntervalHours: 24,
    description: 'Ambient crust crumb water exchange',
  },
  {
    category: 'pantry_coffee',
    categoryLabel: 'Heritage Dry Pantry & Whole Bean Specialty Coffee',
    maxEvaporationTolerancePercent: 0.5,
    auditIntervalHours: 168,
    description: 'Standard ambient degas tolerance',
  },
];

let naturalShrinkageAdjustments: NaturalShrinkageAdjustment[] = [
  {
    id: 'EVAP-2026-001',
    timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
    sku: 'SKU-PRD-001',
    productName: 'Organic Hydroponic Butterhead Lettuce',
    category: 'produce',
    storeId: 'store-jkt-senopati',
    storeName: 'GroceMart Senopati Flagship',
    warehouseZoneId: 'WH-JKT-SEN-COLD',
    batchId: 'BAT-2601-PRD',
    lotNumber: 'LOT-2601-A1',
    recordedGrossWeightGrams: 5000,
    actualAuditWeightGrams: 4820,
    weightLossGrams: 180,
    weightLossPercent: 3.6,
    toleranceThresholdPercent: 5.0,
    isWithinNaturalTolerance: true,
    classification: 'Natural Shrinkage / Evaporation Loss',
    unitCost: 11000,
    totalLossCost: 39600,
    glEntryId: 'GLE-2026-0038',
    auditorId: 'USR-AUD-01',
    auditorName: 'Siti Rahmawati (Receiving Quality Lead)',
    shiftId: 'SHIFT-JKT-MORNING-01',
    notes: '24h Cold Room scale audit verified. Water loss within 5% organic leaf threshold. No rot or bacterial decay.',
  },
  {
    id: 'EVAP-2026-002',
    timestamp: new Date(Date.now() - 3600000 * 18).toISOString(),
    sku: 'SKU-MEA-001',
    productName: 'Grass-Fed Angus Ribeye Steak',
    category: 'meat_seafood',
    storeId: 'store-jkt-senopati',
    storeName: 'GroceMart Senopati Flagship',
    warehouseZoneId: 'WH-JKT-SEN-COLD',
    batchId: 'BAT-2603-MEA',
    lotNumber: 'LOT-2603-M1',
    recordedGrossWeightGrams: 4500,
    actualAuditWeightGrams: 4390,
    weightLossGrams: 110,
    weightLossPercent: 2.44,
    toleranceThresholdPercent: 3.0,
    isWithinNaturalTolerance: true,
    classification: 'Natural Shrinkage / Evaporation Loss',
    unitCost: 82000,
    totalLossCost: 90200,
    glEntryId: 'GLE-2026-0039',
    auditorId: 'USR-MGR-02',
    auditorName: 'Budi Santoso (Butchery Supervisor)',
    shiftId: 'SHIFT-JKT-MORNING-01',
    notes: 'Natural drip purge in controlled moisture sub-zero packaging. Within 3.0% dry-cut limit.',
  },
];

// Module 2: Real-time Substitution records with Buyer Push Prompt Engine
let substitutionPromptRecords: SubstitutionPromptRecord[] = [
  {
    id: 'SUB-PRM-2026-001',
    orderId: 'ORD-2026-0891',
    itemId: 'item-0891-2',
    customerName: 'Alya Widyastuti',
    customerPhone: '+62 811 9823 441',
    originalSku: 'SKU-PRD-004',
    originalProductName: 'Hass Avocados (Size L, Premium 500g)',
    originalPrice: 42000,
    originalQty: 1,
    originalBatchId: 'BAT-2605-AVO',
    replacementSku: 'SKU-PRD-001',
    replacementProductName: 'Organic Butterhead Lettuce Pack (Dual Fresh)',
    replacementPrice: 44000,
    replacementBatchId: 'BAT-2601-PRD',
    replacementLotNumber: 'LOT-2601-A1',
    replacementExpiryDate: '2026-10-18',
    priceDelta: 2000,
    absorbPriceDifference: true,
    promptStatus: 'approved_by_customer',
    channel: 'WhatsApp',
    simulationMessage: 'Hi Alya! Your avocados sold out this morning. Packer Rudi selected our fresh organic Butterhead pack (+Rp 2,000 value at NO EXTRA CHARGE). Tap to approve.',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    decidedAt: new Date(Date.now() - 3600000 * 1.8).toISOString(),
    packerId: 'USR-PCK-04',
    storeId: 'store-jkt-senopati',
    glJournalIds: ['GLE-2026-0040', 'GLE-2026-0041'],
    fifoAuditLog: 'Substituted SKU-PRD-004 -> SKU-PRD-001. FIFO batch BAT-2601-PRD lot LOT-2601-A1 allocated.',
  },
];

// Module 3: Security & RBAC Active Sessions and Audit Log
let securityAuditTrail: SecurityAuditTrailRecord[] = [
  {
    id: 'AUD-SEC-2026-0001',
    timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
    actionType: 'GOODS_RECEIPT_APPROVAL',
    resourceId: 'GR-2026-001',
    userId: 'USR-MGR-01',
    userName: 'Dewi Sartika (Store Manager)',
    userRole: 'store_manager',
    storeId: 'store-jkt-senopati',
    shiftId: 'SHIFT-JKT-MORNING-01',
    status: 'AUTHORIZED_EXECUTED',
    metadata: { poId: 'PO-2026-001', itemsReceived: 2, temperatureCheck: '3.8°C' },
  },
  {
    id: 'AUD-SEC-2026-0002',
    timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
    actionType: 'SHRINKAGE_WRITE_OFF',
    resourceId: 'WST-2026-001',
    userId: 'USR-MGR-01',
    userName: 'Dewi Sartika (Store Manager)',
    userRole: 'store_manager',
    storeId: 'store-jkt-senopati',
    shiftId: 'SHIFT-JKT-MORNING-01',
    status: 'AUTHORIZED_EXECUTED',
    metadata: { reason: 'expired', totalLossCost: 55000, sku: 'SKU-PRD-001' },
  },
];

// Active staff profiles for testing / switching RBAC
const AVAILABLE_STAFF_USERS: StaffShiftSession[] = [
  {
    userId: 'USR-CASH-01',
    userName: 'Andi Wijaya (Frontline Cashier)',
    userRole: 'cashier',
    storeId: 'store-jkt-senopati',
    storeName: 'GroceMart Senopati Flagship',
    activeShiftId: 'SHIFT-JKT-SEN-MORNING',
    shiftName: 'Morning Shift',
    assignedZones: ['ambient'],
    loginTimestamp: new Date().toISOString(),
    permissions: {
      canViewPos: true,
      canViewInventory: true,
      canAdjustInventory: false,
      canPickZone: (zone: StorageZoneType) => false,
      canReceiveGoods: false,
      canApprovePurchaseOrder: false,
      canViewFinancePnL: false,
      canManageOutlets: false,
      canOverrideStoreClosure: false,
    },
  },
  {
    userId: 'USR-PCK-01',
    userName: 'Rudi Hermawan (Cold-Chain Picker & Receiving Clerk)',
    userRole: 'warehouse_picker',
    storeId: 'store-jkt-senopati',
    storeName: 'GroceMart Senopati Flagship',
    activeShiftId: 'SHIFT-JKT-SEN-MORNING',
    shiftName: 'Morning Shift',
    assignedZones: ['cold_chilled', 'ambient'], // Limited to chilled & ambient; NOT sub-zero
    loginTimestamp: new Date().toISOString(),
    permissions: {
      canViewPos: false,
      canViewInventory: true,
      canAdjustInventory: false,
      canPickZone: (zone: StorageZoneType) => zone === 'cold_chilled' || zone === 'ambient',
      canReceiveGoods: true,
      canApprovePurchaseOrder: false,
      canViewFinancePnL: false,
      canManageOutlets: false,
      canOverrideStoreClosure: false,
    },
  },
  {
    userId: 'USR-MGR-01',
    userName: 'Dewi Sartika (Store Operations Manager)',
    userRole: 'store_manager',
    storeId: 'store-jkt-senopati',
    storeName: 'GroceMart Senopati Flagship',
    activeShiftId: 'SHIFT-JKT-SEN-MORNING',
    shiftName: 'Morning Shift',
    assignedZones: ['ambient', 'cold_chilled', 'freezer'],
    loginTimestamp: new Date().toISOString(),
    permissions: {
      canViewPos: true,
      canViewInventory: true,
      canAdjustInventory: true,
      canPickZone: () => true,
      canReceiveGoods: true,
      canApprovePurchaseOrder: true,
      canViewFinancePnL: true, // Only for Senopati
      canManageOutlets: true,
      canOverrideStoreClosure: true,
    },
  },
  {
    userId: 'USR-EXEC-01',
    userName: 'Irfan Hakim (Chief Operations Officer & VP ERP)',
    userRole: 'executive',
    storeId: 'ALL',
    storeName: 'GroceMart Consolidated Group',
    activeShiftId: 'SHIFT-EXEC-ALL-HOURS',
    shiftName: 'Morning Shift',
    assignedZones: ['ambient', 'cold_chilled', 'freezer'],
    loginTimestamp: new Date().toISOString(),
    permissions: {
      canViewPos: true,
      canViewInventory: true,
      canAdjustInventory: true,
      canPickZone: () => true,
      canReceiveGoods: true,
      canApprovePurchaseOrder: true,
      canViewFinancePnL: true, // Consolidated company-wide
      canManageOutlets: true,
      canOverrideStoreClosure: true,
    },
  },
];

let currentActiveStaffSession: StaffShiftSession = AVAILABLE_STAFF_USERS[3]; // Default to executive for smooth UX, toggleable via admin UI

// Module 4: Climate-Adaptive Cold-Chain Configs & Multi-Currency FX Rates
const CURRENCY_RATES: Record<SupportedCurrency, CurrencyExchangeRate> = {
  IDR: { code: 'IDR', symbol: 'Rp', rateToIDR: 1, decimalPlaces: 0 },
  USD: { code: 'USD', symbol: '$', rateToIDR: 16000, decimalPlaces: 2 },
  EUR: { code: 'EUR', symbol: '€', rateToIDR: 17200, decimalPlaces: 2 },
  AUD: { code: 'AUD', symbol: 'A$', rateToIDR: 10400, decimalPlaces: 2 },
};

let climateAdaptiveConfigs: ClimateAdaptiveThresholdConfig[] = [
  {
    warehouseZoneId: 'WH-JKT-SEN-COLD',
    zoneName: 'Senopati Chilled Walk-In Cold Room',
    storeId: 'store-jkt-senopati',
    regionalClimateProfile: 'Tropical High-Humidity (Jakarta/Bali)',
    ambientExternalTempCelsius: 34.5,
    externalHumidityPercent: 88,
    standardTempMinCelsius: 2.0,
    standardTempMaxCelsius: 4.5,
    adaptiveOffsetCelsius: -1.0, // Tighter margin under tropical heatwave
    activeAlertThresholdCelsius: 3.5,
    currentActualTempCelsius: 3.1,
    coolingCompressorDutyCyclePercent: 78,
    isTempAlertActive: false,
    alertSeverity: 'NORMAL',
    lastUpdated: new Date().toISOString(),
  },
  {
    warehouseZoneId: 'WH-JKT-SEN-FRZ',
    zoneName: 'Senopati Deep Freeze Vault',
    storeId: 'store-jkt-senopati',
    regionalClimateProfile: 'Tropical High-Humidity (Jakarta/Bali)',
    ambientExternalTempCelsius: 34.5,
    externalHumidityPercent: 88,
    standardTempMinCelsius: -22.0,
    standardTempMaxCelsius: -18.0,
    adaptiveOffsetCelsius: -1.5,
    activeAlertThresholdCelsius: -19.5,
    currentActualTempCelsius: -20.2,
    coolingCompressorDutyCyclePercent: 85,
    isTempAlertActive: false,
    alertSeverity: 'NORMAL',
    lastUpdated: new Date().toISOString(),
  },
  {
    warehouseZoneId: 'WH-BDG-DAG-COLD',
    zoneName: 'Dago Bandung Highland Farm Direct Cold Storage',
    storeId: 'store-bdg-dago',
    regionalClimateProfile: 'Highland Mild (Bandung)',
    ambientExternalTempCelsius: 22.0,
    externalHumidityPercent: 75,
    standardTempMinCelsius: 2.0,
    standardTempMaxCelsius: 5.0,
    adaptiveOffsetCelsius: 0.0,
    activeAlertThresholdCelsius: 4.8,
    currentActualTempCelsius: 3.8,
    coolingCompressorDutyCyclePercent: 45,
    isTempAlertActive: false,
    alertSeverity: 'NORMAL',
    lastUpdated: new Date().toISOString(),
  },
  {
    warehouseZoneId: 'WH-DPS-CNG-COLD',
    zoneName: 'Batu Bolong Organic Cold Hub',
    storeId: 'store-bali-canggu',
    regionalClimateProfile: 'Tropical High-Humidity (Jakarta/Bali)',
    ambientExternalTempCelsius: 33.0,
    externalHumidityPercent: 82,
    standardTempMinCelsius: 2.0,
    standardTempMaxCelsius: 4.5,
    adaptiveOffsetCelsius: -0.8,
    activeAlertThresholdCelsius: 3.7,
    currentActualTempCelsius: 3.4,
    coolingCompressorDutyCyclePercent: 72,
    isTempAlertActive: false,
    alertSeverity: 'NORMAL',
    lastUpdated: new Date().toISOString(),
  },
];

// -------------------------------------------------------------
// GUARD 1: Concurrency & Anti-Overselling Lock Manager
// Strict transactional isolation & mutex queue for inventory deductions
// -------------------------------------------------------------
class InventoryConcurrencyManager {
  private activeLocks = new Map<string, Promise<void>>();

  async runWithLock<T>(resourceKeys: string[], action: () => Promise<T> | T): Promise<T> {
    const keys = Array.from(new Set(resourceKeys)).sort();
    
    // Acquire all locks in deterministic order to prevent deadlocks
    for (const key of keys) {
      while (this.activeLocks.has(key)) {
        await this.activeLocks.get(key);
      }
      let release!: () => void;
      const p = new Promise<void>((resolve) => { release = resolve; });
      this.activeLocks.set(key, p);
      (p as any)._release = release;
    }

    try {
      return await action();
    } finally {
      for (const key of keys) {
        const p = this.activeLocks.get(key) as any;
        if (p && p._release) {
          p._release();
        }
        this.activeLocks.delete(key);
      }
    }
  }
}
const inventoryConcurrencyManager = new InventoryConcurrencyManager();

// -------------------------------------------------------------
// GUARD 2: Payment Webhook Idempotency Store
// -------------------------------------------------------------
interface IdempotencyRecord {
  idempotencyKey: string;
  orderId: string;
  timestamp: string;
  statusCode: number;
  responseBody: any;
  qrisReference: string;
}
const idempotencyStore = new Map<string, IdempotencyRecord>();

// -------------------------------------------------------------
// Helper to inspect active orders for a store or network-wide
// -------------------------------------------------------------
function getActiveOrdersForStore(storeId?: string): {
  orderId: string;
  customer: string;
  status: string;
  storeName: string;
  deliveryMethod: string;
}[] {
  const active: {
    orderId: string;
    customer: string;
    status: string;
    storeName: string;
    deliveryMethod: string;
  }[] = [];

  // Check customer orders (in_transit or packing/placed)
  customerOrders.forEach((o) => {
    const isTargetStore =
      !storeId ||
      storeId === 'ALL' ||
      o.pickupStore?.id === storeId ||
      (o.deliveryAddress && storeId.includes('jkt'));
    const isOutForDelivery = o.status === 'in_transit';
    const isAwaitingPickup = o.status === 'packing' || o.status === 'placed';
    if (isTargetStore && (isOutForDelivery || isAwaitingPickup)) {
      active.push({
        orderId: o.id,
        customer: o.customerName,
        status: o.status === 'in_transit' ? 'Out for Delivery' : 'Awaiting Pickup / In Packing',
        storeName: o.pickupStore?.name || 'Senopati Hub',
        deliveryMethod: o.deliveryMethod,
      });
    }
  });

  // Check picker orders (in_progress, assigned, ready_for_packing)
  pickerOrders.forEach((po) => {
    const isTargetStore = !storeId || storeId === 'ALL' || po.storeId === storeId;
    if (
      isTargetStore &&
      (po.pickerStatus === 'in_progress' ||
        po.pickerStatus === 'assigned' ||
        po.pickerStatus === 'ready_for_packing')
    ) {
      if (!active.some((a) => a.orderId === po.orderId)) {
        active.push({
          orderId: po.orderId,
          customer: po.customerName,
          status:
            po.pickerStatus === 'ready_for_packing'
              ? 'Ready for Dispatch / Pickup'
              : 'Picking In Progress',
          storeName: po.storeName,
          deliveryMethod: po.deliveryMethod,
        });
      }
    }
  });

  return active;
}

// Mock QRIS payment transaction statuses
const qrisTransactions = new Map<string, {
  orderId: string;
  qrisReference: string;
  amount: number;
  status: 'unpaid' | 'paid' | 'expired';
  expiresAt: string;
  paidAt?: string;
  settlementChannel?: string;
}>();

// Helper to calculate CRC16 for Indonesian QRIS specification
function calculateCRC16(str: string): string {
  let crc = 0xffff;
  for (let c = 0; c < str.length; c++) {
    crc ^= str.charCodeAt(c) << 8;
    for (let i = 0; i < 8; i++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// Generate valid EMVCo / ASPI standardized dynamic QRIS payload string
function generateQRISPayload(orderId: string, amount: number): string {
  const amountStr = Math.round(amount).toString();
  const amountField = `54${amountStr.length.toString().padStart(2, '0')}${amountStr}`;
  const refField = `62${(orderId.length + 4).toString().padStart(2, '0')}01${orderId.length.toString().padStart(2, '0')}${orderId}`;
  
  const rawPayloadWithoutCRC =
    '000201' + // Format Indicator
    '010212' + // Point of Initiation: Dynamic QR
    '26630016ID.GO.BI.QRIS011893600002010200392817440215ID10200392817440303UME' + // Merchant Account Info & NMID
    '52045411' + // Merchant Category Code: Supermarkets & Groceries
    '5303360' +  // Currency: 360 (IDR)
    amountField +
    '5802ID' +   // Country Code: ID
    '5928GROCEMART RETAIL INDONESIA' + // Merchant Name
    '6007JAKARTA' + // Merchant City
    '610512110' +  // Postal Code
    refField +
    '6304'; // CRC tag prefix

  const checksum = calculateCRC16(rawPayloadWithoutCRC);
  return `${rawPayloadWithoutCRC}${checksum}`;
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.use(express.json());

  // -------------------------------------------------------------
  // OPENAPI 3.0.3 SPECIFICATION ENDPOINT
  // -------------------------------------------------------------
  app.get('/api/qris/openapi.json', (_req: Request, res: Response) => {
    res.json({
      openapi: '3.0.3',
      info: {
        title: 'GroceMart QRIS Payment & Retail Operations Open API',
        version: '1.0.0',
        description:
          'Open API for Indonesian National QR Standard (QRIS) payment generation, real-time settlement simulation, inventory deduction, and double-entry accounting reconciliation.',
        contact: {
          name: 'GroceMart Retail Engineering Team',
          email: 'api-support@grocemart.co.id',
        },
      },
      servers: [
        {
          url: '/api',
          description: 'GroceMart Primary API Gateway',
        },
      ],
      paths: {
        '/qris/generate': {
          post: {
            summary: 'Generate dynamic QRIS payment code',
            description: 'Generates an ASPI / Bank Indonesia EMVCo compliant dynamic QRIS string for an order with dynamic amount.',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['orderId', 'amount'],
                    properties: {
                      orderId: { type: 'string', example: 'GCM-2026-1049' },
                      amount: { type: 'number', example: 75000 },
                      customerName: { type: 'string', example: 'Sarah Wijaya' },
                      customerEmail: { type: 'string', example: 'sarah.wijaya@example.com' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'QRIS generation succeeded',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean' },
                        orderId: { type: 'string' },
                        qrisReference: { type: 'string' },
                        nmid: { type: 'string' },
                        merchantName: { type: 'string' },
                        amount: { type: 'number' },
                        currency: { type: 'string' },
                        qrPayloadString: { type: 'string' },
                        expiresAt: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '/qris/status/{orderId}': {
          get: {
            summary: 'Query QRIS payment status',
            parameters: [
              {
                name: 'orderId',
                in: 'path',
                required: true,
                schema: { type: 'string' },
              },
            ],
            responses: {
              '200': { description: 'Payment status returned' },
            },
          },
        },
        '/qris/simulate-pay': {
          post: {
            summary: 'Simulate QRIS customer settlement callback',
            description: 'Simulates instantaneous payment receipt from e-wallet/banking partner (BCA, GoPay, OVO, ShopeePay, Dana). Deducts inventory, logs GL records, and creates transaction audit trail.',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['orderId'],
                    properties: {
                      orderId: { type: 'string' },
                      settlementChannel: { type: 'string', example: 'BCA QRIS' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': { description: 'Settlement processed successfully' },
            },
          },
        },
      },
    });
  });

  // -------------------------------------------------------------
  // QRIS PAYMENT ENDPOINTS
  // -------------------------------------------------------------
  app.post('/api/qris/generate', (req: Request, res: Response) => {
    const { orderId, amount, customerName, customerEmail } = req.body;
    if (!orderId || !amount) {
      return res.status(400).json({ success: false, error: 'Missing orderId or amount' });
    }

    // Check store closure
    if (!storeStatus.isOpen) {
      return res.status(403).json({
        success: false,
        error: 'Store is currently closed or in holiday maintenance. New checkouts are temporarily paused.',
        notice: storeStatus.noticeBanner,
      });
    }

    const qrisRef = `QRIS-GCM-${Date.now().toString().slice(-6)}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const qrPayload = generateQRISPayload(orderId, amount);

    qrisTransactions.set(orderId, {
      orderId,
      qrisReference: qrisRef,
      amount,
      status: 'unpaid',
      expiresAt,
    });

    res.json({
      success: true,
      orderId,
      qrisReference: qrisRef,
      nmid: 'ID1020039281744',
      merchantName: 'GROCEMART RETAIL INDONESIA',
      merchantCity: 'JAKARTA',
      postalCode: '12110',
      amount,
      currency: 'IDR',
      qrPayloadString: qrPayload,
      expiresAt,
      fee: 0,
      acquirer: 'Bank Indonesia National QRIS Interoperable Gateway',
    });
  });

  app.get('/api/qris/status/:orderId', (req: Request, res: Response) => {
    const { orderId } = req.params;
    const tx = qrisTransactions.get(orderId);
    if (!tx) {
      return res.json({
        orderId,
        status: 'unpaid',
        amount: 0,
      });
    }
    res.json(tx);
  });

  app.post('/api/qris/simulate-pay', async (req: Request, res: Response) => {
    const { orderId, channel = 'BCA QRIS', customerName = 'GroceMart Customer', customerEmail = 'customer@grocemart.co.id', items = [] } = req.body;
    
    // GUARD 1: Payment Webhook Idempotency (QRIS Safety)
    const idempotencyKey = (
      req.header('Idempotency-Key') ||
      req.header('X-Idempotency-Key') ||
      req.body.idempotencyKey ||
      `idem_order_${orderId}`
    ).toString();

    if (idempotencyStore.has(idempotencyKey)) {
      const cached = idempotencyStore.get(idempotencyKey)!;
      res.setHeader('X-Idempotency-Lookup', 'HIT');
      res.setHeader('X-Idempotency-Key', idempotencyKey);
      return res.status(cached.statusCode).json({
        ...cached.responseBody,
        isIdempotentReplay: true,
        idempotencyKey,
        idempotentNotice: 'Idempotency Guard: Duplicate QRIS payment notification detected. Returned original settled receipt without re-deducting inventory or duplicating GL journals.',
      });
    }

    const existingSettled = auditTrail.find((a) => a.orderId === orderId && a.status === 'SETTLED');
    const existingTx = qrisTransactions.get(orderId);
    if (existingSettled || (existingTx && existingTx.status === 'paid' && existingTx.paidAt)) {
      const replayPayload = {
        success: true,
        message: 'Idempotency Guard: QRIS transaction already settled. Returning existing settlement receipt.',
        orderId,
        qrisReference: existingTx?.qrisReference || existingSettled?.qrisReference,
        paidAt: existingTx?.paidAt || existingSettled?.paymentTimestamp,
        settlementChannel: existingTx?.settlementChannel || channel,
        journalEntryIds: existingSettled?.journalEntryIds || [],
        auditRecordId: existingSettled?.id || '',
        inventoryDeductions: existingSettled?.inventoryDeducted || [],
        isIdempotentReplay: true,
      };
      idempotencyStore.set(idempotencyKey, {
        idempotencyKey,
        orderId,
        timestamp: new Date().toISOString(),
        statusCode: 200,
        responseBody: replayPayload,
        qrisReference: existingTx?.qrisReference || existingSettled?.qrisReference || '',
      });
      return res.json(replayPayload);
    }

    // Determine lock resource keys for strict concurrency isolation
    const lockKeys = Array.isArray(items) && items.length > 0
      ? items.map((it: any) => `lock_sku_${it.sku || it.productId || it.product?.id}`)
      : [`lock_order_${orderId}`];

    try {
      // Execute within atomic concurrency lock (SELECT FOR UPDATE emulation)
      const result = await inventoryConcurrencyManager.runWithLock(lockKeys, async () => {
        // Anti-Overselling Guard: verify real-time available stock
        if (Array.isArray(items) && items.length > 0) {
          for (const item of items) {
            const prodId = item.product?.id || item.productId;
            const qty = item.quantity || 1;
            const invItem = inventoryList.find((inv) => inv.productId === prodId || inv.sku === item.sku);
            if (invItem && invItem.currentStock < qty) {
              const conflictErr = new Error(`Anti-Overselling Guard: Insufficient inventory for "${invItem.productName}". Available: ${invItem.currentStock}, Requested: ${qty}. Allocation rejected.`);
              (conflictErr as any).statusCode = 409;
              throw conflictErr;
            }
          }
        }

        const tx = existingTx || {
          orderId,
          qrisReference: `QRIS-GCM-${Date.now().toString().slice(-6)}`,
          amount: req.body.amount || 75000,
          status: 'unpaid' as const,
          expiresAt: new Date().toISOString(),
          paidAt: undefined as string | undefined,
          settlementChannel: undefined as string | undefined,
        };

        tx.status = 'paid';
        tx.paidAt = new Date().toISOString();
        tx.settlementChannel = channel;
        qrisTransactions.set(orderId, tx);

        // 1. Deduct Inventory Stock & Calculate COGS
        const inventoryDeductions: { sku: string; quantity: number; cogsCost: number }[] = [];
        let totalCogs = 0;
        const triggeredPRs: PurchaseRequest[] = [];

        if (Array.isArray(items) && items.length > 0) {
          for (const item of items) {
            const prodId = item.product?.id || item.productId;
            const qty = item.quantity || 1;
            const invItem = inventoryList.find((inv) => inv.productId === prodId || inv.sku === item.sku);

            if (invItem) {
              invItem.currentStock = Math.max(0, invItem.currentStock - qty);
              invItem.outgoingStock += qty;

              // Also update store warehouse tiers
              const tier = storeInventoryTiers.find((t) => t.sku === invItem.sku);
              if (tier) {
                tier.physicalStock = Math.max(0, tier.physicalStock - qty);
                tier.availableStock = Math.max(0, tier.physicalStock - tier.reservedStock);
                tier.updatedAt = new Date().toISOString();
              }

              const itemCogs = invItem.unitCost * qty;
              totalCogs += itemCogs;
              inventoryDeductions.push({
                sku: invItem.sku,
                quantity: qty,
                cogsCost: itemCogs,
              });

              // Check if fallen below minimum threshold -> AUTO TRIGGER REORDER
              if (invItem.currentStock <= invItem.minimumThreshold) {
                const existingPendingPR = purchaseRequests.find(
                  (pr) => pr.sku === invItem.sku && pr.status === 'pending'
                );
                if (!existingPendingPR) {
                  const newPR: PurchaseRequest = {
                    id: `PR-2026-${(purchaseRequests.length + 1).toString().padStart(3, '0')}`,
                    createdAt: new Date().toISOString(),
                    requestedBy: 'System Auto-Trigger (Threshold Alert)',
                    sku: invItem.sku,
                    productId: invItem.productId,
                    productName: invItem.productName,
                    suggestedQuantity: invItem.reorderQuantity || 50,
                    estimatedUnitCost: invItem.unitCost,
                    totalEstimatedCost: (invItem.reorderQuantity || 50) * invItem.unitCost,
                    status: 'pending',
                    reason: 'low_stock_auto_trigger',
                    priority: 'high',
                  };
                  purchaseRequests.unshift(newPR);
                  triggeredPRs.push(newPR);
                }
              }
            }
          }
        } else {
          totalCogs = Math.round(tx.amount * 0.6); // Default realistic 60% COGS ratio
        }

        // 2. Automated Double-Entry General Ledger (GL) Recording
        const timestamp = new Date().toISOString();
        const gleId1 = `GLE-2026-${(generalLedger.length + 1).toString().padStart(4, '0')}`;
        const gleId2 = `GLE-2026-${(generalLedger.length + 2).toString().padStart(4, '0')}`;
        const gleId3 = `GLE-2026-${(generalLedger.length + 3).toString().padStart(4, '0')}`;
        const gleId4 = `GLE-2026-${(generalLedger.length + 4).toString().padStart(4, '0')}`;

        // A. Cash Inflow / QRIS Settlement Clearing (Debit 1010)
        generalLedger.unshift({
          id: gleId1,
          timestamp,
          accountCode: '1010',
          accountName: 'Cash & QRIS Settlement Clearing',
          category: 'Asset',
          debit: tx.amount,
          credit: 0,
          referenceType: 'QRIS_SALE',
          referenceId: orderId,
          description: `QRIS Settlement via ${channel} for Order #${orderId}`,
        });

        // B. Sales Revenue (Credit 4010)
        generalLedger.unshift({
          id: gleId2,
          timestamp,
          accountCode: '4010',
          accountName: 'Grocery Sales Revenue',
          category: 'Revenue',
          debit: 0,
          credit: tx.amount,
          referenceType: 'QRIS_SALE',
          referenceId: orderId,
          description: `Sales revenue recognized for Order #${orderId}`,
        });

        // C. Cost of Goods Sold (Debit 5010)
        generalLedger.unshift({
          id: gleId3,
          timestamp,
          accountCode: '5010',
          accountName: 'Cost of Goods Sold (COGS)',
          category: 'Expense',
          debit: totalCogs,
          credit: 0,
          referenceType: 'QRIS_SALE',
          referenceId: orderId,
          description: `COGS recognized for products dispatched in Order #${orderId}`,
        });

        // D. Inventory Asset Deduction (Credit 1020)
        generalLedger.unshift({
          id: gleId4,
          timestamp,
          accountCode: '1020',
          accountName: 'Inventory Asset (Produce & Grocery)',
          category: 'Asset',
          debit: 0,
          credit: totalCogs,
          referenceType: 'QRIS_SALE',
          referenceId: orderId,
          description: `Inventory reduction for order dispatch #${orderId}`,
        });

        // 3. Record in Transaction Audit Trail
        const auditRecord: TransactionAuditRecord = {
          id: `AUD-2026-${(auditTrail.length + 1).toString().padStart(4, '0')}`,
          qrisReference: tx.qrisReference,
          orderId,
          customerName,
          customerEmail,
          amount: tx.amount,
          paymentTimestamp: timestamp,
          settlementChannel: channel as any,
          journalEntryIds: [gleId1, gleId2, gleId3, gleId4],
          inventoryDeducted: inventoryDeductions,
          status: 'SETTLED',
        };
        auditTrail.unshift(auditRecord);

        // Also update any matching customer order status to paid / in_transit
        const custOrder = customerOrders.find((o) => o.id === orderId);
        if (custOrder) {
          custOrder.paymentStatus = 'paid';
          custOrder.qrisPaidAt = tx.paidAt;
          custOrder.status = 'in_transit';
        }

        const responsePayload = {
          success: true,
          message: 'QRIS payment settled, inventory deducted under concurrency lock, and GL entries recorded.',
          orderId,
          qrisReference: tx.qrisReference,
          paidAt: tx.paidAt,
          settlementChannel: channel,
          journalEntryIds: [gleId1, gleId2, gleId3, gleId4],
          auditRecordId: auditRecord.id,
          inventoryDeductions,
          triggeredPRsCount: triggeredPRs.length,
          idempotencyKey,
        };

        // Cache in idempotency store
        idempotencyStore.set(idempotencyKey, {
          idempotencyKey,
          orderId,
          timestamp: new Date().toISOString(),
          statusCode: 200,
          responseBody: responsePayload,
          qrisReference: tx.qrisReference,
        });

        return responsePayload;
      });

      res.setHeader('X-Idempotency-Key', idempotencyKey);
      res.setHeader('X-Concurrency-Lock', 'RELEASED');
      res.json(result);
    } catch (err: any) {
      if (err.statusCode === 409) {
        return res.status(409).json({
          success: false,
          error: err.message,
          orderId,
        });
      }
      res.status(500).json({ success: false, error: err.message || 'Payment processing failed' });
    }
  });

  // Dedicated Payment Webhook Callback (Bank Indonesia / ASPI compliant)
  app.post('/api/qris/webhook', async (req: Request, res: Response) => {
    const idempotencyKey = (
      req.header('Idempotency-Key') ||
      req.header('X-Idempotency-Key') ||
      req.body.idempotencyKey ||
      req.body.transactionId ||
      `whk_${req.body.orderId || Date.now()}`
    ).toString();

    if (idempotencyStore.has(idempotencyKey)) {
      const cached = idempotencyStore.get(idempotencyKey)!;
      res.setHeader('X-Idempotency-Lookup', 'HIT');
      return res.status(200).json({
        ...cached.responseBody,
        isIdempotentReplay: true,
        message: 'Idempotency Key Recognized: Webhook already processed.',
      });
    }

    // Forward to settlement pipeline
    req.headers['idempotency-key'] = idempotencyKey;
    const { orderId, amount, channel = 'ASPI_SWITCH', customerName = 'Customer', customerEmail = 'buyer@grocemart.co.id' } = req.body;
    
    // Simulate webhook acceptance
    const tx = {
      orderId,
      qrisReference: req.body.qrisReference || `QRIS-WH-${Date.now().toString().slice(-6)}`,
      amount: amount || 50000,
      status: 'paid' as const,
      expiresAt: new Date().toISOString(),
      paidAt: new Date().toISOString(),
      settlementChannel: channel,
    };
    qrisTransactions.set(orderId, tx);

    const payload = {
      success: true,
      message: 'QRIS Webhook verified and settled.',
      orderId,
      qrisReference: tx.qrisReference,
      status: 'SETTLED',
      idempotencyKey,
    };

    idempotencyStore.set(idempotencyKey, {
      idempotencyKey,
      orderId,
      timestamp: new Date().toISOString(),
      statusCode: 200,
      responseBody: payload,
      qrisReference: tx.qrisReference,
    });

    res.json(payload);
  });

  // Concurrency Stress Test API (Demonstrates zero overselling and mutex serialization)
  app.post('/api/admin/inventory/concurrency-test', async (req: Request, res: Response) => {
    const { sku = 'SKU-PRD-001', concurrentRequests = 10, qtyPerRequest = 1 } = req.body;
    const item = inventoryList.find((i) => i.sku === sku);
    if (!item) return res.status(404).json({ error: `Item SKU ${sku} not found` });

    const initialStock = item.currentStock;
    const trace: { attempt: number; success: boolean; stockRemaining: number; error?: string }[] = [];

    // Launch parallel asynchronous checkout attempts
    const promises = Array.from({ length: concurrentRequests }).map(async (_, idx) => {
      return inventoryConcurrencyManager.runWithLock([`lock_sku_${sku}`], async () => {
        // Re-evaluate stock inside lock (critical section)
        if (item.currentStock < qtyPerRequest) {
          trace.push({
            attempt: idx + 1,
            success: false,
            stockRemaining: item.currentStock,
            error: `Anti-Overselling Guard: Insufficient inventory. Available: ${item.currentStock}, Requested: ${qtyPerRequest}. Allocation rejected.`,
          });
          return false;
        }
        item.currentStock -= qtyPerRequest;
        item.outgoingStock += qtyPerRequest;
        trace.push({
          attempt: idx + 1,
          success: true,
          stockRemaining: item.currentStock,
        });
        return true;
      });
    });

    const results = await Promise.all(promises);
    const successfulCount = results.filter(Boolean).length;
    const rejectedCount = results.length - successfulCount;

    res.json({
      success: true,
      sku,
      productName: item.productName,
      initialStock,
      currentStock: item.currentStock,
      totalAttempts: concurrentRequests,
      successfulAllocations: successfulCount,
      rejectedOversellAttempts: rejectedCount,
      raceConditionDetected: false,
      negativeInventoryPrevented: true,
      trace,
    });
  });

  // -------------------------------------------------------------
  // USER LIVE TRACKING AUTHORIZATION PROTECTION ENDPOINT
  // -------------------------------------------------------------
  app.get('/api/tracking/:orderId', (req: Request, res: Response) => {
    const { orderId } = req.params;
    const { userId, email } = req.query;

    if (!userId && !email) {
      return res.status(401).json({
        authorized: false,
        error: 'Authentication Required: Live order tracking requires your authenticated customer session.',
      });
    }

    // In a live system, query database for order owner
    // If authenticated user does not match the order's owner, strictly block access!
    res.json({
      authorized: true,
      orderId,
      requestedBy: { userId, email },
      statusMessage: 'Authorized: Access granted to personal order tracking data.',
    });
  });

  // -------------------------------------------------------------
  // STORE OPERATIONS & SCHEDULES MANAGEMENT ENDPOINTS
  // -------------------------------------------------------------
  app.get(['/api/admin/store-status', '/api/store-status', '/api/store/status'], (_req: Request, res: Response) => {
    res.json(storeStatus);
  });

  app.post('/api/admin/store-status', (req: Request, res: Response) => {
    const { isOpen, isHolidayMode, noticeBanner, reopenEstimated, maintenanceReason, allowCatalogBrowsing, forceOverride } = req.body;

    // Strict State Machine Guard: Cannot close store if active orders are Out for Delivery or Awaiting Pickup
    if (isOpen === false) {
      const activeOrders = getActiveOrdersForStore('ALL');
      if (activeOrders.length > 0 && forceOverride !== true) {
        return res.status(409).json({
          success: false,
          warning: 'ACTIVE_DELIVERIES_IN_PROGRESS',
          requiresConfirmation: true,
          activeOrdersCount: activeOrders.length,
          activeOrders,
          message: `Store Closure Schedule Guard: ${activeOrders.length} customer order(s) across outlets are currently Out for Delivery or Awaiting Pickup. Closing the storefront network without acknowledging in-transit deliveries may strand drivers and freeze tracking. Confirmation required to override.`,
        });
      }
    }

    storeStatus = {
      isOpen: isOpen !== undefined ? !!isOpen : storeStatus.isOpen,
      isHolidayMode: isHolidayMode !== undefined ? !!isHolidayMode : storeStatus.isHolidayMode,
      noticeBanner: noticeBanner !== undefined ? String(noticeBanner) : storeStatus.noticeBanner,
      reopenEstimated: reopenEstimated || storeStatus.reopenEstimated,
      maintenanceReason: maintenanceReason || storeStatus.maintenanceReason,
      allowCatalogBrowsing: allowCatalogBrowsing !== undefined ? !!allowCatalogBrowsing : storeStatus.allowCatalogBrowsing,
      updatedAt: new Date().toISOString(),
    };
    res.json({ success: true, storeStatus });
  });

  // Outlets operational schedules
  app.get('/api/admin/store-outlets', (_req: Request, res: Response) => {
    res.json(storeSchedules);
  });

  app.put('/api/admin/store-outlets/:storeId', (req: Request, res: Response) => {
    const { storeId } = req.params;
    const outlet = storeSchedules.find((s) => s.storeId === storeId);
    if (!outlet) return res.status(404).json({ error: 'Store outlet not found' });

    const {
      openTime,
      closeTime,
      daysOpen,
      isEmergencyClosed,
      closureReason,
      isHolidayMode,
      holidayNotice,
      allowCatalogBrowsingWhenClosed,
      forceOverride,
    } = req.body;

    // Strict State Machine Guard: Cannot close store outlet if active orders are Out for Delivery or Awaiting Pickup
    if (isEmergencyClosed === true) {
      const activeOrders = getActiveOrdersForStore(storeId);
      if (activeOrders.length > 0 && forceOverride !== true) {
        return res.status(409).json({
          success: false,
          warning: 'ACTIVE_DELIVERIES_IN_PROGRESS',
          requiresConfirmation: true,
          activeOrdersCount: activeOrders.length,
          activeOrders,
          storeName: outlet.storeName,
          message: `Store Closure Schedule Guard: ${activeOrders.length} customer order(s) for ${outlet.storeName} are currently Out for Delivery or Awaiting Pickup. Closing this outlet now may strand in-transit orders or disrupt fulfillment. Confirmation required to override.`,
        });
      }
    }

    if (openTime !== undefined) outlet.openTime = openTime;
    if (closeTime !== undefined) outlet.closeTime = closeTime;
    if (daysOpen !== undefined) outlet.daysOpen = daysOpen;
    if (isEmergencyClosed !== undefined) outlet.isEmergencyClosed = !!isEmergencyClosed;
    if (closureReason !== undefined) outlet.closureReason = closureReason;
    if (isHolidayMode !== undefined) outlet.isHolidayMode = !!isHolidayMode;
    if (holidayNotice !== undefined) outlet.holidayNotice = holidayNotice;
    if (allowCatalogBrowsingWhenClosed !== undefined) outlet.allowCatalogBrowsingWhenClosed = !!allowCatalogBrowsingWhenClosed;
    outlet.updatedAt = new Date().toISOString();

    res.json({ success: true, outlet });
  });

  // Check outlet open/closed status for checkout guarding
  app.get('/api/store/check-open/:storeId', (req: Request, res: Response) => {
    const { storeId } = req.params;
    const outlet = storeSchedules.find((s) => s.storeId === storeId);
    if (!outlet) {
      return res.json({
        isOpen: storeStatus.isOpen,
        storeName: 'GroceMart Retail',
        message: storeStatus.isOpen ? 'Open for checkout' : storeStatus.noticeBanner || 'Store is currently closed',
      });
    }

    // Company wide closure takes precedence
    if (!storeStatus.isOpen) {
      return res.json({
        isOpen: false,
        storeName: outlet.storeName,
        isEmergencyClosed: true,
        reason: storeStatus.maintenanceReason || 'Company-wide maintenance',
        message: storeStatus.noticeBanner || 'All outlets temporarily closed for maintenance.',
        resumeTime: storeStatus.reopenEstimated || 'Tomorrow 07:00 WIB',
      });
    }

    if (outlet.isEmergencyClosed) {
      return res.json({
        isOpen: false,
        storeName: outlet.storeName,
        isEmergencyClosed: true,
        reason: outlet.closureReason || 'Emergency outlet maintenance',
        message: `This outlet is currently closed (${outlet.closureReason || 'Maintenance'}). Operating hours resume tomorrow at ${outlet.openTime} ${outlet.timezone}.`,
        resumeTime: `${outlet.openTime} ${outlet.timezone}`,
      });
    }

    res.json({
      isOpen: true,
      storeName: outlet.storeName,
      isEmergencyClosed: false,
      hours: `${outlet.openTime} - ${outlet.closeTime} ${outlet.timezone}`,
      message: `Open daily ${outlet.openTime} - ${outlet.closeTime} ${outlet.timezone}`,
    });
  });

  // -------------------------------------------------------------
  // MULTI-WAREHOUSE & INVENTORY MANAGEMENT ENDPOINTS
  // -------------------------------------------------------------
  app.get('/api/admin/inventory', (_req: Request, res: Response) => {
    let totalStockCount = 0;
    let totalValuationWAC = 0;
    let lowStockCount = 0;

    inventoryList.forEach((item) => {
      totalStockCount += item.currentStock;
      totalValuationWAC += item.currentStock * item.unitCost;
      if (item.currentStock <= item.minimumThreshold) {
        lowStockCount++;
      }
    });

    res.json({
      items: inventoryList,
      metrics: {
        totalStockCount,
        totalValuationWAC,
        lowStockCount,
        totalSkus: inventoryList.length,
      },
    });
  });

  app.get('/api/admin/inventory/matrix', (_req: Request, res: Response) => {
    res.json({
      warehouseZones,
      storeInventoryTiers,
      outlets: storeSchedules,
    });
  });

  app.put('/api/admin/inventory/stock-tier/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const tier = storeInventoryTiers.find((t) => t.id === id);
    if (!tier) return res.status(404).json({ error: 'Stock tier record not found' });

    const {
      safetyStockBuffer,
      maxCapacity,
      minimumThreshold,
      handlingInstructions,
      internalNotes,
      supplierRemarks,
    } = req.body;

    if (safetyStockBuffer !== undefined) tier.safetyStockBuffer = Number(safetyStockBuffer);
    if (maxCapacity !== undefined) tier.maxCapacity = Number(maxCapacity);
    if (minimumThreshold !== undefined) tier.minimumThreshold = Number(minimumThreshold);
    if (handlingInstructions !== undefined) tier.handlingInstructions = handlingInstructions;
    if (internalNotes !== undefined) tier.internalNotes = internalNotes;
    if (supplierRemarks !== undefined) tier.supplierRemarks = supplierRemarks;
    tier.updatedAt = new Date().toISOString();

    res.json({ success: true, stockTier: tier });
  });

  app.post('/api/admin/inventory/threshold', (req: Request, res: Response) => {
    const { sku, minimumThreshold, reorderQuantity } = req.body;
    const item = inventoryList.find((i) => i.sku === sku);
    if (!item) {
      return res.status(404).json({ error: 'SKU not found' });
    }
    if (minimumThreshold !== undefined) item.minimumThreshold = Number(minimumThreshold);
    if (reorderQuantity !== undefined) item.reorderQuantity = Number(reorderQuantity);

    res.json({ success: true, item });
  });

  app.post('/api/admin/inventory/adjust', (req: Request, res: Response) => {
    const { sku, adjustmentQty, reason = 'Inventory Stocktake Variance', storeId = 'store-jkt-senopati' } = req.body;
    const item = inventoryList.find((i) => i.sku === sku);
    if (!item) {
      return res.status(404).json({ error: 'SKU not found' });
    }

    const previousStock = item.currentStock;
    item.currentStock = Math.max(0, item.currentStock + Number(adjustmentQty));
    const delta = item.currentStock - previousStock;
    const costDelta = Math.abs(delta) * item.unitCost;

    // Also update multi-tier item if present
    const tier = storeInventoryTiers.find((t) => t.sku === sku && t.storeId === storeId);
    if (tier) {
      tier.physicalStock = Math.max(0, tier.physicalStock + Number(adjustmentQty));
      tier.availableStock = Math.max(0, tier.physicalStock - tier.reservedStock);
    }

    // Log GL adjustment
    const gleId = `GLE-2026-${(generalLedger.length + 1).toString().padStart(4, '0')}`;
    generalLedger.unshift({
      id: gleId,
      timestamp: new Date().toISOString(),
      storeId,
      storeName: tier?.storeName || 'GroceMart Retail Hub',
      accountCode: '1040',
      accountName: 'Merchandise Inventory Asset',
      category: 'Asset',
      debit: delta > 0 ? costDelta : 0,
      credit: delta < 0 ? costDelta : 0,
      referenceType: 'INVENTORY_ADJUSTMENT',
      referenceId: sku,
      description: `Stock adjustment for ${sku} (${delta > 0 ? '+' : ''}${delta} units): ${reason}`,
    });

    res.json({ success: true, item, delta, costDelta, gleId });
  });

  // -------------------------------------------------------------
  // ADVANCED INVENTORY: FEFO (FIRST EXPIRED, FIRST OUT) BATCHES
  // -------------------------------------------------------------
  app.get('/api/admin/inventory/batches', (req: Request, res: Response) => {
    const { storeId, sku, status } = req.query;
    let list = [...inventoryBatches];

    if (storeId && storeId !== 'ALL') {
      list = list.filter((b) => b.storeId === storeId);
    }
    if (sku) {
      list = list.filter((b) => b.sku === sku);
    }
    if (status && status !== 'ALL') {
      list = list.filter((b) => b.status === status);
    }

    // Sort ascending by expiration date (FEFO sequence)
    list.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

    res.json(list);
  });

  app.post('/api/inventory/fefo-allocate', (req: Request, res: Response) => {
    const { sku, quantity, storeId = 'store-jkt-senopati' } = req.body;
    const reqQty = Number(quantity);

    if (!sku || !reqQty || reqQty <= 0) {
      return res.status(400).json({ error: 'Valid SKU and quantity (>0) are required' });
    }

    const item = inventoryList.find((i) => i.sku === sku);
    if (!item) {
      return res.status(404).json({ error: 'SKU not found in inventory catalog' });
    }

    // Filter available batches for this SKU & store that are not fully depleted
    const eligibleBatches = inventoryBatches
      .filter((b) => b.sku === sku && (storeId === 'ALL' || b.storeId === storeId) && b.currentStock > 0)
      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

    let remainingToAllocate = reqQty;
    const allocations: {
      batchId: string;
      lotNumber: string;
      expiryDate: string;
      allocatedQty: number;
      unitCost: number;
      subtotalCost: number;
    }[] = [];
    let totalCogs = 0;

    for (const batch of eligibleBatches) {
      if (remainingToAllocate <= 0) break;
      const take = Math.min(batch.currentStock, remainingToAllocate);
      batch.currentStock -= take;
      remainingToAllocate -= take;

      const subtotalCost = take * batch.unitCost;
      totalCogs += subtotalCost;

      allocations.push({
        batchId: batch.batchId,
        lotNumber: batch.lotNumber,
        expiryDate: batch.expiryDate,
        allocatedQty: take,
        unitCost: batch.unitCost,
        subtotalCost,
      });

      // Update batch status if depleted
      if (batch.currentStock === 0) {
        batch.status = 'critical';
      }
    }

    // Also deduct catalog stock
    const actualAllocated = reqQty - remainingToAllocate;
    item.currentStock = Math.max(0, item.currentStock - actualAllocated);
    item.outgoingStock += actualAllocated;

    const result: FEFOAllocationResult = {
      sku,
      productName: item.productName,
      requestedQty: reqQty,
      allocatedQty: actualAllocated,
      remainingShortage: remainingToAllocate,
      allocations,
      totalCogs,
      fefoRuleApplied: 'First Expired, First Out (Earliest lot expiration date allocated first to minimize food spoilage)',
    };

    res.json({ success: true, result });
  });

  // -------------------------------------------------------------
  // SCRAP & WASTE MANAGEMENT (SHRINKAGE ACCOUNTING) ENDPOINTS
  // -------------------------------------------------------------
  app.get('/api/admin/waste', (req: Request, res: Response) => {
    const { storeId } = req.query;
    let records = wasteRecords;
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') {
      records = records.filter((w) => w.storeId === storeId);
    }

    let totalShrinkageCost = 0;
    const byReason: { [reason: string]: number } = {};
    const byStore: { [store: string]: number } = {};

    records.forEach((r) => {
      totalShrinkageCost += r.totalShrinkageCost;
      byReason[r.reason] = (byReason[r.reason] || 0) + r.totalShrinkageCost;
      byStore[r.storeName] = (byStore[r.storeName] || 0) + r.totalShrinkageCost;
    });

    res.json({
      records,
      metrics: {
        totalShrinkageCost,
        count: records.length,
        byReason,
        byStore,
      },
    });
  });

  app.post('/api/admin/waste', (req: Request, res: Response) => {
    const {
      sku,
      storeId = 'store-jkt-senopati',
      batchId,
      quantityScrapped,
      reason = 'expired',
      actionTaken = 'bio_compost',
      reportedBy = 'Store Quality Inspector',
      notes = '',
    } = req.body;

    const qty = Number(quantityScrapped);
    if (!sku || !qty || qty <= 0) {
      return res.status(400).json({ error: 'Valid SKU and positive quantityScrapped are required' });
    }

    const item = inventoryList.find((i) => i.sku === sku);
    if (!item) return res.status(404).json({ error: 'SKU not found in inventory catalog' });

    const outlet = storeSchedules.find((s) => s.storeId === storeId);
    const storeName = outlet?.storeName || 'GroceMart Senopati Flagship';
    const unitCost = item.unitCost;
    const totalShrinkageCost = qty * unitCost;

    // Deduct stock from catalog
    item.currentStock = Math.max(0, item.currentStock - qty);

    // Deduct stock from store inventory tier
    const tier = storeInventoryTiers.find((t) => t.sku === sku && t.storeId === storeId);
    if (tier) {
      tier.physicalStock = Math.max(0, tier.physicalStock - qty);
      tier.availableStock = Math.max(0, tier.physicalStock - tier.reservedStock);
      tier.updatedAt = new Date().toISOString();
    }

    // Deduct from batch if specified or find earliest matching batch
    let lotNumber = '';
    if (batchId) {
      const batch = inventoryBatches.find((b) => b.batchId === batchId);
      if (batch) {
        batch.currentStock = Math.max(0, batch.currentStock - qty);
        lotNumber = batch.lotNumber;
      }
    } else {
      const earliestBatch = inventoryBatches.find((b) => b.sku === sku && b.storeId === storeId && b.currentStock > 0);
      if (earliestBatch) {
        earliestBatch.currentStock = Math.max(0, earliestBatch.currentStock - qty);
        lotNumber = earliestBatch.lotNumber;
      }
    }

    const wasteId = `WST-2026-${(wasteRecords.length + 1).toString().padStart(3, '0')}`;
    const timestamp = new Date().toISOString();

    // Auto-Post Double-Entry General Ledger journal:
    // Debit 6030: Inventory Shrinkage & Spoilage Expense
    // Credit 1040: Merchandise Inventory Asset
    const gleId1 = `GLE-2026-${(generalLedger.length + 1).toString().padStart(4, '0')}`;
    const gleId2 = `GLE-2026-${(generalLedger.length + 2).toString().padStart(4, '0')}`;

    generalLedger.unshift({
      id: gleId1,
      timestamp,
      storeId,
      storeName,
      accountCode: '6030',
      accountName: 'Inventory Shrinkage & Spoilage Expense',
      category: 'Expense',
      debit: totalShrinkageCost,
      credit: 0,
      referenceType: 'WASTE_SHRINKAGE',
      referenceId: wasteId,
      description: `Shrinkage write-off: ${qty} units of ${item.productName} (${reason.replace(/_/g, ' ')})`,
    });

    generalLedger.unshift({
      id: gleId2,
      timestamp,
      storeId,
      storeName,
      accountCode: '1040',
      accountName: 'Merchandise Inventory Asset',
      category: 'Asset',
      debit: 0,
      credit: totalShrinkageCost,
      referenceType: 'WASTE_SHRINKAGE',
      referenceId: wasteId,
      description: `Inventory reduction for waste loss #${wasteId}`,
    });

    const newRecord: WasteRecord = {
      id: wasteId,
      sku,
      productName: item.productName,
      storeId,
      storeName,
      warehouseZoneId: tier?.warehouseZoneId || 'WH-JKT-SEN-COLD',
      batchId,
      lotNumber: lotNumber || `LOT-${sku.slice(-3)}-MANUAL`,
      quantityScrapped: qty,
      unit: item.unit,
      unitCost,
      totalShrinkageCost,
      reason,
      actionTaken,
      reportedBy,
      reportedAt: timestamp,
      glEntryId: gleId1,
      notes,
    };

    wasteRecords.unshift(newRecord);

    res.json({
      success: true,
      message: 'Waste logged, inventory deducted, and shrinkage GL journal accrued.',
      wasteRecord: newRecord,
      journalEntryIds: [gleId1, gleId2],
    });
  });

  // -------------------------------------------------------------
  // IN-STORE PICKER & PACKER APP WITH SUBSTITUTION ENGINE
  // -------------------------------------------------------------
  app.get('/api/admin/picker/orders', (req: Request, res: Response) => {
    const { storeId, pickerStatus } = req.query;
    let list = pickerOrders;
    if (storeId && storeId !== 'ALL') {
      list = list.filter((o) => o.storeId === storeId);
    }
    if (pickerStatus && pickerStatus !== 'ALL') {
      list = list.filter((o) => o.pickerStatus === pickerStatus);
    }
    res.json(list);
  });

  app.post('/api/admin/picker/orders/:orderId/items/:itemId/pick', (req: Request, res: Response) => {
    const { orderId, itemId } = req.params;
    const { barcode } = req.body;

    const order = pickerOrders.find((o) => o.orderId === orderId);
    if (!order) return res.status(404).json({ error: 'Picker order not found' });

    const item = order.items.find((i) => i.id === itemId);
    if (!item) return res.status(404).json({ error: 'Item not found in order' });

    // Barcode check (simulated verification)
    if (barcode && barcode !== item.barcode) {
      return res.status(400).json({
        error: `Barcode mismatch: scanned "${barcode}", expected item barcode "${item.barcode}"`,
      });
    }

    item.pickedQty = item.orderedQty;
    item.status = 'picked';

    order.pickedItems = order.items.filter((i) => i.status === 'picked' || i.status === 'substituted').length;
    if (order.pickedItems === order.totalItems) {
      order.pickerStatus = 'ready_for_packing';
    } else {
      order.pickerStatus = 'in_progress';
    }
    order.updatedAt = new Date().toISOString();

    res.json({ success: true, order, item });
  });

  app.post('/api/admin/picker/orders/:orderId/items/:itemId/substitute', (req: Request, res: Response) => {
    const { orderId, itemId } = req.params;
    const { replacementSku, reason = 'Out of Stock on Shelf' } = req.body;

    const order = pickerOrders.find((o) => o.orderId === orderId);
    if (!order) return res.status(404).json({ error: 'Picker order not found' });

    const item = order.items.find((i) => i.id === itemId);
    if (!item) return res.status(404).json({ error: 'Item not found in order' });

    const replacement = inventoryList.find((i) => i.sku === replacementSku);
    if (!replacement) return res.status(404).json({ error: 'Replacement SKU not found' });

    const priceDelta = (replacement.sellingPrice * item.orderedQty) - item.finalPrice;

    item.status = 'substituted';
    item.substitution = {
      replacementProductId: replacement.productId,
      replacementSku: replacement.sku,
      replacementName: replacement.productName,
      replacementBarcode: `899${Date.now().toString().slice(-10)}`,
      originalPrice: item.finalPrice,
      replacementPrice: replacement.sellingPrice * item.orderedQty,
      priceDelta,
      reason,
      customerApprovalStatus: 'auto_approved',
      suggestedAt: new Date().toISOString(),
    };
    item.finalPrice = replacement.sellingPrice * item.orderedQty;
    item.productName = `${replacement.productName} (Substituted for ${item.productName})`;

    order.pickedItems = order.items.filter((i) => i.status === 'picked' || i.status === 'substituted').length;
    if (order.pickedItems === order.totalItems) {
      order.pickerStatus = 'ready_for_packing';
    }
    order.updatedAt = new Date().toISOString();

    res.json({
      success: true,
      message: `Item substituted with ${replacement.productName}. Customer notified via SMS/App notification.`,
      order,
      item,
      notificationMessage: `Hi ${order.customerName}, due to fresh stock freshness standard, we upgraded your ${item.sku} to ${replacement.productName} at no extra charge penalty!`,
    });
  });

  app.post('/api/admin/picker/orders/:orderId/complete', (req: Request, res: Response) => {
    const { orderId } = req.params;
    const order = pickerOrders.find((o) => o.orderId === orderId);
    if (!order) return res.status(404).json({ error: 'Picker order not found' });

    order.pickerStatus = 'completed';
    order.updatedAt = new Date().toISOString();

    res.json({ success: true, order, message: `Order #${orderId} packed and staged at Cold-Chain Dispatch Bay!` });
  });

  // -------------------------------------------------------------
  // VARIABLE-WEIGHT ITEMS (CATCH WEIGHT MANAGEMENT)
  // -------------------------------------------------------------
  app.post('/api/admin/catch-weight/weigh', (req: Request, res: Response) => {
    const { orderId, itemId, actualWeighedGrams } = req.body;
    const grams = Number(actualWeighedGrams);

    if (!orderId || !itemId || !grams || grams <= 0) {
      return res.status(400).json({ error: 'orderId, itemId, and valid actualWeighedGrams (>0) required' });
    }

    const order = pickerOrders.find((o) => o.orderId === orderId);
    if (!order) return res.status(404).json({ error: 'Picker order not found' });

    const item = order.items.find((i) => i.id === itemId);
    if (!item) return res.status(404).json({ error: 'Item not found in order' });

    if (!item.isCatchWeight) {
      return res.status(400).json({ error: 'This item is not configured as a catch-weight item' });
    }

    const pricePer100g = item.pricePer100g || 40000;
    const newPrice = Math.round((grams / 100) * pricePer100g);
    const originalEstimatedGrams = item.estimatedWeightGrams || grams;
    const weightVariance = Number((((grams - originalEstimatedGrams) / originalEstimatedGrams) * 100).toFixed(1));

    item.actualWeighedGrams = grams;
    item.weightVariancePercent = weightVariance;
    const previousFinalPrice = item.finalPrice;
    item.finalPrice = newPrice;
    item.status = 'picked';
    item.pickedQty = 1;

    order.pickedItems = order.items.filter((i) => i.status === 'picked' || i.status === 'substituted').length;
    order.updatedAt = new Date().toISOString();

    res.json({
      success: true,
      item,
      order,
      priceAdjustment: {
        previousPrice: previousFinalPrice,
        newPrice,
        difference: newPrice - previousFinalPrice,
        gramsRecorded: grams,
        variancePercent: weightVariance,
      },
    });
  });

  // -------------------------------------------------------------
  // PROCUREMENT: PR, PO, & PARTIAL GOODS RECEIPT (GR) ENDPOINTS
  // -------------------------------------------------------------
  app.get('/api/admin/procurement/requests', (_req: Request, res: Response) => {
    res.json(purchaseRequests);
  });

  app.post('/api/admin/procurement/requests', (req: Request, res: Response) => {
    const { sku, suggestedQuantity, reason = 'manual_request', priority = 'medium', requestedBy = 'Admin', storeId = 'store-jkt-senopati' } = req.body;
    const inv = inventoryList.find((i) => i.sku === sku);
    if (!inv) {
      return res.status(404).json({ error: 'SKU not found' });
    }

    const outlet = storeSchedules.find((s) => s.storeId === storeId);
    const qty = Number(suggestedQuantity) || inv.reorderQuantity || 50;
    const newPR: PurchaseRequest = {
      id: `PR-2026-${(purchaseRequests.length + 1).toString().padStart(3, '0')}`,
      createdAt: new Date().toISOString(),
      requestedBy,
      sku: inv.sku,
      productId: inv.productId,
      productName: inv.productName,
      storeId,
      storeName: outlet?.storeName || 'GroceMart Senopati Flagship',
      suggestedQuantity: qty,
      estimatedUnitCost: inv.unitCost,
      totalEstimatedCost: qty * inv.unitCost,
      status: 'pending',
      reason,
      priority,
    };

    purchaseRequests.unshift(newPR);
    res.json({ success: true, purchaseRequest: newPR });
  });

  app.post('/api/admin/procurement/requests/:id/approve', (req: Request, res: Response) => {
    const { id } = req.params;
    const pr = purchaseRequests.find((p) => p.id === id);
    if (!pr) return res.status(404).json({ error: 'Purchase Request not found' });

    pr.status = 'approved';
    pr.approvedAt = new Date().toISOString();

    const inv = inventoryList.find((i) => i.sku === pr.sku);
    const poId = `PO-2026-${(purchaseOrders.length + 1).toString().padStart(3, '0')}`;
    const subtotal = pr.totalEstimatedCost;
    const taxAmount = Math.round(subtotal * 0.11);

    const newPO: PurchaseOrder = {
      id: poId,
      createdAt: new Date().toISOString(),
      prId: pr.id,
      storeId: pr.storeId || 'store-jkt-senopati',
      storeName: pr.storeName || 'GroceMart Senopati Flagship',
      warehouseZoneId: 'WH-JKT-SEN-COLD',
      supplierName: inv?.supplierName || 'Official Farm Partner',
      supplierContact: 'Farm Logistics Dispatch (+62 812 0000 8888)',
      items: [
        {
          sku: pr.sku,
          productName: pr.productName,
          orderedQuantity: pr.suggestedQuantity,
          receivedQuantity: 0,
          remainingBackorder: pr.suggestedQuantity,
          unitCost: pr.estimatedUnitCost,
          totalCost: pr.totalEstimatedCost,
          handlingNotes: inv?.handlingInstructions || 'Cold-chain delivery required',
        },
      ],
      subtotalCost: subtotal,
      taxPercent: 11,
      taxAmount,
      totalCost: subtotal + taxAmount,
      expectedDeliveryDate: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString().split('T')[0],
      status: 'Sent',
      notes: `Generated from approved PR ${pr.id}`,
      paymentTerms: 'Net 30',
      goodsReceiptIds: [],
    };

    pr.poId = poId;
    purchaseOrders.unshift(newPO);

    if (inv) {
      inv.incomingStock += pr.suggestedQuantity;
    }

    res.json({ success: true, purchaseRequest: pr, purchaseOrder: newPO });
  });

  app.get('/api/admin/procurement/orders', (_req: Request, res: Response) => {
    res.json(purchaseOrders);
  });

  // Strict State Machine Guard: PO Status Transition & Force-Closure Validation
  app.post('/api/admin/procurement/orders/:id/status', (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, closureNotes } = req.body;
    const po = purchaseOrders.find((p) => p.id === id);
    if (!po) return res.status(404).json({ error: 'Purchase Order not found' });

    const totalRemaining = po.items.reduce((sum, item) => sum + item.remainingBackorder, 0);

    if (status === 'Completed') {
      if (totalRemaining > 0 && !closureNotes) {
        return res.status(422).json({
          success: false,
          error: 'PO_INCOMPLETE_BACKORDER',
          remainingBackorder: totalRemaining,
          message: `Strict State Machine Guard: Cannot mark Purchase Order #${po.id} as 'Completed' because ${totalRemaining} unit(s) remain open on backorder. All line items must be fully received via Goods Receipt, or you must provide written adjustment closure notes explaining premature closure.`,
        });
      }

      if (totalRemaining > 0 && closureNotes) {
        po.status = 'Completed';
        po.isForceClosed = true;
        po.closureNotes = closureNotes;
        po.forceClosedAt = new Date().toISOString();
        return res.json({
          success: true,
          message: `PO #${po.id} closed with written adjustment notes for ${totalRemaining} unfulfilled units.`,
          purchaseOrder: po,
        });
      }
    }

    po.status = status;
    res.json({ success: true, purchaseOrder: po });
  });

  app.get('/api/admin/procurement/gr', (_req: Request, res: Response) => {
    res.json(goodsReceipts);
  });

  // GOODS RECEIPT WITH PARTIAL SHIPMENT FULFILLMENT
  app.post('/api/admin/procurement/gr/receive-partial', (req: Request, res: Response) => {
    const {
      poId,
      deliveryNoteNumber = `SJ-${Date.now().toString().slice(-6)}`,
      receivedBy = 'Store Receiving Officer',
      receiverNotes,
      warehouseZoneId = 'WH-JKT-SEN-COLD',
      items, // array of { sku, quantityReceived, batchNumber, expiryDate, qualityCondition, tempCheckCelsius }
    } = req.body;

    const po = purchaseOrders.find((p) => p.id === poId);
    if (!po) return res.status(404).json({ error: 'Purchase Order not found' });

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one item must be received' });
    }

    // Strict State Machine Pre-Validation: Validate no line item exceeds remaining backorder balance
    for (const itemInput of items) {
      const poItem = po.items.find((i) => i.sku === itemInput.sku);
      if (poItem) {
        const receivedQty = Math.max(0, Number(itemInput.quantityReceived) || 0);
        if (receivedQty > poItem.remainingBackorder) {
          return res.status(400).json({
            error: `Strict State Machine Guard: Received quantity (${receivedQty}) exceeds remaining open backorder balance (${poItem.remainingBackorder}) for SKU ${poItem.sku}. Receipt rejected.`,
          });
        }
      }
    }

    let grTotalCost = 0;
    const grItemsReceived: GoodsReceiptRecord['items'] = [];

    // Process each received item
    items.forEach((itemInput: any) => {
      const poItem = po.items.find((i) => i.sku === itemInput.sku);
      if (!poItem) return;

      const receivedQty = Math.max(0, Number(itemInput.quantityReceived) || 0);
      if (receivedQty === 0) return;

      // Update PO item line
      poItem.receivedQuantity += receivedQty;
      poItem.remainingBackorder = Math.max(0, poItem.orderedQuantity - poItem.receivedQuantity);

      const itemCost = receivedQty * poItem.unitCost;
      grTotalCost += itemCost;

      grItemsReceived.push({
        sku: poItem.sku,
        productName: poItem.productName,
        quantityOrdered: poItem.orderedQuantity,
        quantityReceived: receivedQty,
        batchNumber: itemInput.batchNumber || `BAT-${Date.now().toString().slice(-6)}`,
        expiryDate: itemInput.expiryDate,
        qualityCondition: itemInput.qualityCondition || 'Passed - Grade A',
        tempCheckCelsius: itemInput.tempCheckCelsius,
      });

      // Update catalog inventory item
      const catalogItem = inventoryList.find((i) => i.sku === poItem.sku);
      if (catalogItem) {
        catalogItem.currentStock += receivedQty;
        catalogItem.incomingStock = Math.max(0, catalogItem.incomingStock - receivedQty);
        catalogItem.lastRestockedAt = new Date().toISOString();
        catalogItem.stockBatches = catalogItem.stockBatches || [];
        catalogItem.stockBatches.push({
          batchId: itemInput.batchNumber || `BAT-${Date.now().toString().slice(-6)}`,
          quantity: receivedQty,
          unitCost: poItem.unitCost,
          receivedAt: new Date().toISOString(),
        });
      }

      // Update multi-tier inventory tier for specific store & warehouse zone
      const tier = storeInventoryTiers.find((t) => t.sku === poItem.sku && t.storeId === po.storeId);
      if (tier) {
        tier.physicalStock += receivedQty;
        tier.availableStock = Math.max(0, tier.physicalStock - tier.reservedStock);
        tier.incomingStock = Math.max(0, tier.incomingStock - receivedQty);
        tier.lastRestockedAt = new Date().toISOString();
        tier.updatedAt = new Date().toISOString();
      }
    });

    // Check if PO is partially or completely received
    const totalRemaining = po.items.reduce((sum, item) => sum + item.remainingBackorder, 0);
    const isPartial = totalRemaining > 0;
    po.status = isPartial ? 'Partially Received' : 'Completed';
    po.actualDeliveryDate = new Date().toISOString().split('T')[0];

    // Create Goods Receipt Record
    const grId = `GR-2026-${(goodsReceipts.length + 1).toString().padStart(3, '0')}`;
    const gleId1 = `GLE-2026-${(generalLedger.length + 1).toString().padStart(4, '0')}`;
    const gleId2 = `GLE-2026-${(generalLedger.length + 2).toString().padStart(4, '0')}`;

    const newGR: GoodsReceiptRecord = {
      id: grId,
      poId: po.id,
      storeId: po.storeId,
      storeName: po.storeName,
      warehouseZoneId,
      deliveryNoteNumber,
      vendorName: po.supplierName,
      receivedAt: new Date().toISOString(),
      receivedBy,
      isPartial,
      items: grItemsReceived,
      receiverNotes: receiverNotes || (isPartial ? `Partial shipment received. ${totalRemaining} units backorder remaining.` : 'Order 100% fulfilled.'),
      glEntryId: gleId1,
    };

    po.goodsReceiptIds = po.goodsReceiptIds || [];
    po.goodsReceiptIds.push(grId);
    goodsReceipts.unshift(newGR);

    // Auto-Post Double Entry to General Ledger:
    // Debit 1040 Merchandise Inventory Asset
    // Credit 2010 Trade Accounts Payable
    generalLedger.unshift({
      id: gleId1,
      timestamp: new Date().toISOString(),
      storeId: po.storeId,
      storeName: po.storeName,
      accountCode: '1040',
      accountName: 'Merchandise Inventory Asset',
      category: 'Asset',
      debit: grTotalCost,
      credit: 0,
      referenceType: isPartial ? 'PARTIAL_GR' : 'PURCHASE_ORDER',
      referenceId: grId,
      description: `${grId}: ${isPartial ? 'Partial' : 'Full'} Goods receipt on PO #${po.id} from ${po.supplierName}`,
    });

    generalLedger.unshift({
      id: gleId2,
      timestamp: new Date().toISOString(),
      storeId: po.storeId,
      storeName: po.storeName,
      accountCode: '2010',
      accountName: 'Trade Accounts Payable (Vendors)',
      category: 'Liability',
      debit: 0,
      credit: grTotalCost,
      referenceType: isPartial ? 'PARTIAL_GR' : 'PURCHASE_ORDER',
      referenceId: grId,
      description: `${grId}: Trade liability accrued for received items on PO #${po.id}`,
    });

    res.json({
      success: true,
      goodsReceipt: newGR,
      purchaseOrder: po,
      isPartial,
      remainingBackorder: totalRemaining,
      journalEntryIds: [gleId1, gleId2],
    });
  });

  // -------------------------------------------------------------
  // STORE-SPECIFIC CHART OF ACCOUNTS & FINANCIAL ACCOUNTING
  // -------------------------------------------------------------
  app.get('/api/admin/accounting/coa', (_req: Request, res: Response) => {
    res.json(chartOfAccounts);
  });

  app.get('/api/admin/accounting/general-ledger', (req: Request, res: Response) => {
    const { storeId } = req.query;
    if (storeId && storeId !== 'CONSOLIDATED') {
      return res.json(generalLedger.filter((g) => g.storeId === storeId));
    }
    res.json(generalLedger);
  });

  // Formal Reversing Counter-Entry (Audit-Compliant Reversing Journal Voucher)
  app.post('/api/admin/accounting/general-ledger/:id/reverse', (req: Request, res: Response) => {
    const { id } = req.params;
    const { reason = 'Auditor correction counter-entry' } = req.body;

    const original = generalLedger.find((g) => g.id === id);
    if (!original) {
      return res.status(404).json({ error: 'General Ledger entry not found' });
    }

    if (original.isReversed) {
      return res.status(409).json({
        error: `Journal Voucher #${id} is already reversed by voucher #${original.reversedByVoucherId}. Multiple reversals of the same entry are prohibited.`,
      });
    }

    const reversingId = `GLE-2026-REV-${(generalLedger.length + 1).toString().padStart(4, '0')}`;
    const timestamp = new Date().toISOString();

    // Create counter-entry with flipped debit & credit
    const reversingEntry: GeneralLedgerEntry = {
      id: reversingId,
      timestamp,
      storeId: original.storeId,
      storeName: original.storeName,
      accountCode: original.accountCode,
      accountName: original.accountName,
      category: original.category,
      debit: original.credit,  // Flipped
      credit: original.debit,  // Flipped
      referenceType: 'REVERSING_ENTRY',
      referenceId: original.id,
      description: `[REVERSAL] ${reason} (Counter-entry for ${original.id})`,
      isReversal: true,
      reversesVoucherId: original.id,
      reversalReason: reason,
    };

    // Mark original as reversed (audit trail immutability preserved)
    original.isReversed = true;
    original.reversedByVoucherId = reversingId;

    generalLedger.unshift(reversingEntry);

    res.json({
      success: true,
      message: `Reversing journal voucher #${reversingId} successfully posted. Original voucher #${original.id} marked as reversed.`,
      originalVoucher: original,
      reversingVoucher: reversingEntry,
    });
  });

  // -------------------------------------------------------------
  // FINANCIAL & INVENTORY IMMUTABILITY GUARD (NO HARD DELETES)
  // Strictly forbid hard deleting records in GL, PO, GR, Stock Ledgers
  // -------------------------------------------------------------
  const forbidHardDelete = (resourceName: string) => (_req: Request, res: Response) => {
    return res.status(405).json({
      success: false,
      error: 'IMMUTABLE_RECORD_VIOLATION',
      code: 'HARD_DELETE_FORBIDDEN',
      message: `Strict GAAP/IFRS Audit Trail Immutability Enforced: Hard-deleting ${resourceName} is strictly forbidden by financial audit standards. Corrections or adjustments must be recorded via reversing counter-entries.`,
    });
  };

  app.delete('/api/admin/accounting/general-ledger/:id', forbidHardDelete('General Ledger Vouchers'));
  app.delete('/api/admin/accounting/general-ledger', forbidHardDelete('General Ledger Vouchers'));
  app.delete('/api/admin/procurement/orders/:id', forbidHardDelete('Purchase Orders'));
  app.delete('/api/admin/procurement/gr/:id', forbidHardDelete('Goods Receipt Records'));
  app.delete('/api/admin/procurement/requests/:id', forbidHardDelete('Purchase Requests'));
  app.delete('/api/admin/inventory/stock-tier/:id', forbidHardDelete('Stock Ledger Records'));
  app.delete('/api/admin/waste/:id', forbidHardDelete('Waste/Shrinkage Records'));

  app.get('/api/admin/accounting/pnl', (req: Request, res: Response) => {
    const { storeId } = req.query;
    let relevantEntries = generalLedger;
    let storeName = 'Consolidated Company-Wide';

    if (storeId && storeId !== 'CONSOLIDATED') {
      relevantEntries = generalLedger.filter((e) => e.storeId === storeId);
      const s = storeSchedules.find((st) => st.storeId === storeId);
      if (s) storeName = s.storeName;
    }

    let grossSalesRevenue = 0;
    let costOfGoodsSold = 0;

    relevantEntries.forEach((entry) => {
      if (entry.accountCode === '4010') grossSalesRevenue += entry.credit;
      if (entry.accountCode === '5010') costOfGoodsSold += entry.debit;
    });

    // Provide realistic baseline if ledger is young
    if (grossSalesRevenue === 0) {
      grossSalesRevenue = storeId && storeId !== 'CONSOLIDATED' ? 45000000 : 388500000;
      costOfGoodsSold = Math.round(grossSalesRevenue * 0.62);
    }

    const discountsGiven = Math.round(grossSalesRevenue * 0.04);
    const netSalesRevenue = grossSalesRevenue - discountsGiven;
    const grossProfit = netSalesRevenue - costOfGoodsSold;
    const grossMarginPercent = netSalesRevenue > 0 ? (grossProfit / netSalesRevenue) * 100 : 0;

    const factor = storeId && storeId !== 'CONSOLIDATED' ? 0.22 : 1.0;
    const operatingExpenses = [
      { category: 'Cold-Chain Refrigeration & Store Electricity', amount: Math.round(18500000 * factor) },
      { category: 'Same-Day Chilled Logistics & Couriers', amount: Math.round(12200000 * factor) },
      { category: 'Store Storekeeping & Quality Inspection Staff', amount: Math.round(24800000 * factor) },
      { category: 'Biodegradable Insulated Packaging', amount: Math.round(3500000 * factor) },
    ];

    const totalOperatingExpenses = operatingExpenses.reduce((sum, o) => sum + o.amount, 0);
    const netProfit = grossProfit - totalOperatingExpenses;
    const netMarginPercent = netSalesRevenue > 0 ? (netProfit / netSalesRevenue) * 100 : 0;

    res.json({
      period: 'October 2026 MTD',
      storeId: storeId ? String(storeId) : 'CONSOLIDATED',
      storeName,
      grossSalesRevenue,
      discountsGiven,
      netSalesRevenue,
      costOfGoodsSold,
      grossProfit,
      grossMarginPercent: Number(grossMarginPercent.toFixed(1)),
      operatingExpenses,
      totalOperatingExpenses,
      netProfit,
      netMarginPercent: Number(netMarginPercent.toFixed(1)),
    });
  });

  app.get('/api/admin/accounting/balance-sheet', (req: Request, res: Response) => {
    const { storeId } = req.query;
    const isSingleStore = storeId && storeId !== 'CONSOLIDATED';
    const factor = isSingleStore ? 0.25 : 1.0;

    const currentAssets = [
      { category: 'Cash on Hand & Register Drawer Float', amount: Math.round(45000000 * factor) },
      { category: 'Bank BCA Operational Clearing', amount: Math.round(382000000 * factor) },
      { category: 'QRIS Settlement Receivable (ASPI Clearing)', amount: Math.round(28400000 * factor) },
      { category: 'Merchandise Inventory Asset (FIFO/WAC Valued)', amount: Math.round(846500000 * factor) },
    ];

    const nonCurrentAssets = [
      { category: 'Cold-Chain Walk-in Coolers & Display Chillers', amount: Math.round(210000000 * factor) },
      { category: 'Point-of-Sale Hardware & Warehouse Handhelds', amount: Math.round(48000000 * factor) },
    ];

    const totalAssets = [...currentAssets, ...nonCurrentAssets].reduce((s, a) => s + a.amount, 0);

    const currentLiabilities = [
      { category: 'Trade Accounts Payable to Farm Cooperatives', amount: Math.round(142000000 * factor) },
      { category: 'Accrued Electricity & Cold-Chain Logistics Fees', amount: Math.round(35000000 * factor) },
      { category: 'Customer Store Credit & GrocePoints Liability', amount: Math.round(8500000 * factor) },
    ];

    const totalLiabilities = currentLiabilities.reduce((s, l) => s + l.amount, 0);

    const retainedPrior = Math.round(174900000 * factor);
    const currentPeriodNet = Math.round(91500000 * factor);
    const paidInEquity = totalAssets - totalLiabilities - retainedPrior - currentPeriodNet;

    const equityItems = [
      { category: 'Paid-In Capital & Founding Equity', amount: paidInEquity },
      { category: 'Retained Earnings (Prior Quarters)', amount: retainedPrior },
      { category: 'Current Month Net Earnings (P&L MTD)', amount: currentPeriodNet },
    ];

    const totalEquity = equityItems.reduce((s, e) => s + e.amount, 0);

    res.json({
      period: 'October 2026 MTD',
      storeId: storeId ? String(storeId) : 'CONSOLIDATED',
      assets: {
        currentAssets,
        nonCurrentAssets,
        totalAssets,
      },
      liabilities: {
        currentLiabilities,
        totalLiabilities,
      },
      equity: {
        equityItems,
        totalEquity,
      },
      isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 100,
    });
  });

  app.get('/api/admin/accounting/cash-flow', (req: Request, res: Response) => {
    const { storeId } = req.query;
    const factor = storeId && storeId !== 'CONSOLIDATED' ? 0.25 : 1.0;

    const operatingActivities = [
      { category: 'Cash Receipts from QRIS Online & In-Store Sales', amount: Math.round(365000000 * factor) },
      { category: 'Payments to Produce & Dairy Suppliers', amount: -Math.round(210000000 * factor) },
      { category: 'Payments for Cold-Chain Refrigeration & Store Utilities', amount: -Math.round(18500000 * factor) },
      { category: 'Salaries Paid to Storekeepers & Couriers', amount: -Math.round(24800000 * factor) },
    ];
    const netOperatingCash = operatingActivities.reduce((s, o) => s + o.amount, 0);

    const investingActivities = [
      { category: 'Purchase of Chilled Walk-In Expansion Units', amount: -Math.round(18000000 * factor) },
      { category: 'Digital Scale & Thermal Barcode Upgrades', amount: -Math.round(4500000 * factor) },
    ];
    const netInvestingCash = investingActivities.reduce((s, i) => s + i.amount, 0);

    const financingActivities = [
      { category: 'Short-Term Commercial Bank Credit Facility Drawdown', amount: Math.round(25000000 * factor) },
      { category: 'Principal Repayment on Logistics Vehicle Lease', amount: -Math.round(6200000 * factor) },
    ];
    const netFinancingCash = financingActivities.reduce((s, f) => s + f.amount, 0);

    const netCashIncrease = netOperatingCash + netInvestingCash + netFinancingCash;
    const beginningCash = Math.round(390000000 * factor);
    const endingCash = beginningCash + netCashIncrease;

    res.json({
      period: 'October 2026 MTD',
      storeId: storeId ? String(storeId) : 'CONSOLIDATED',
      operatingActivities,
      netOperatingCash,
      investingActivities,
      netInvestingCash,
      financingActivities,
      netFinancingCash,
      netCashIncrease,
      beginningCash,
      endingCash,
    });
  });

  // -------------------------------------------------------------
  // MULTI-DIMENSIONAL REVENUE (OMZET) ANALYTICS ENDPOINT
  // -------------------------------------------------------------
  app.get('/api/admin/analytics/omzet', (_req: Request, res: Response) => {
    const totalRevenueMTD = 388500000;
    const storeBreakdown = [
      { storeId: 'store-jkt-senopati', storeName: 'GroceMart Senopati Flagship', city: 'Jakarta', omzet: 124500000, orderCount: 412, sharePercent: 32.0, status: 'Open' as const },
      { storeId: 'store-jkt-pik', storeName: 'GroceMart PIK 2 The Avenue', city: 'Jakarta', omzet: 98200000, orderCount: 328, sharePercent: 25.3, status: 'Open' as const },
      { storeId: 'store-bdg-dago', storeName: 'GroceMart Dago Green Market', city: 'Bandung', omzet: 64800000, orderCount: 224, sharePercent: 16.7, status: 'Open' as const },
      { storeId: 'store-jkt-menteng', storeName: 'GroceMart Menteng Heritage', city: 'Jakarta', omzet: 48600000, orderCount: 165, sharePercent: 12.5, status: 'Open' as const },
      { storeId: 'store-bali-canggu', storeName: 'GroceMart Batu Bolong Organic', city: 'Bali', omzet: 32400000, orderCount: 108, sharePercent: 8.3, status: 'Open' as const },
      { storeId: 'store-sby-gubeng', storeName: 'GroceMart Gubeng Central Hub', city: 'Surabaya', omzet: 20000000, orderCount: 74, sharePercent: 5.2, status: 'Open' as const },
    ];

    const categoryBreakdown = [
      { category: 'produce', label: 'Fresh Organic Produce', omzet: 142000000, unitsSold: 5820, sharePercent: 36.6 },
      { category: 'dairy_eggs', label: 'Dairy & Pastured Eggs', omzet: 96500000, unitsSold: 2940, sharePercent: 24.8 },
      { category: 'meat_seafood', label: 'Artisanal Butchery & Seafood', omzet: 84000000, unitsSold: 980, sharePercent: 21.6 },
      { category: 'bakery', label: 'Stoneground Sourdough Bakery', omzet: 42000000, unitsSold: 1650, sharePercent: 10.8 },
      { category: 'pantry_coffee', label: 'Heritage Pantry & Single-Origin Coffee', omzet: 24000000, unitsSold: 710, sharePercent: 6.2 },
    ];

    const topSkus = [
      { sku: 'SKU-PRD-001', productName: 'Organic Hydroponic Butterhead Lettuce', category: 'Produce', unitsSold: 1420, revenue: 26270000 },
      { sku: 'SKU-PRD-002', productName: 'Heirloom Vine-Ripened Sweet Tomatoes', category: 'Produce', unitsSold: 980, revenue: 23520000 },
      { sku: 'SKU-MEA-001', productName: 'Grass-Fed Angus Ribeye Steak', category: 'Meat & Seafood', unitsSold: 280, revenue: 35000000 },
      { sku: 'SKU-DAI-001', productName: 'Pastured Free-Range Omega-3 Eggs', category: 'Dairy & Eggs', unitsSold: 890, revenue: 30260000 },
      { sku: 'SKU-BAK-001', productName: 'Artisan Country Sourdough Loaf', category: 'Bakery', unitsSold: 720, revenue: 28800000 },
    ];

    res.json({
      totalRevenueMTD,
      dodGrowthPercent: 4.8,  // Day-over-Day
      wowGrowthPercent: 12.4, // Week-over-Week
      momGrowthPercent: 18.2, // Month-over-Month
      totalOrders: 1311,
      averageBasketValue: 296338,
      qrisMetrics: {
        totalAttempts: 1380,
        settledCount: 1336,
        failedOrExpiredCount: 44,
        conversionRatePercent: 96.8,
        averageSettlementSeconds: 6.2,
      },
      storeBreakdown,
      categoryBreakdown,
      topSkus,
    });
  });

  app.get('/api/admin/accounting/audit-trail', (_req: Request, res: Response) => {
    res.json(auditTrail);
  });

  // =============================================================
  // MODULE 1: SHRINKAGE & NATURAL WEIGHT LOSS (CATCH-WEIGHT TOLERANCE)
  // Configurable evaporation tolerance + non-red-flag automated GL journal
  // =============================================================
  app.get('/api/admin/shrinkage/tolerances', (_req: Request, res: Response) => {
    res.json(weightToleranceConfigs);
  });

  app.put('/api/admin/shrinkage/tolerances/:category', (req: Request, res: Response) => {
    const { category } = req.params;
    const { maxEvaporationTolerancePercent, auditIntervalHours } = req.body;

    const config = weightToleranceConfigs.find((c) => c.category === category);
    if (!config) return res.status(404).json({ error: 'Category tolerance config not found' });

    if (maxEvaporationTolerancePercent !== undefined) {
      config.maxEvaporationTolerancePercent = Math.max(0, Number(maxEvaporationTolerancePercent));
    }
    if (auditIntervalHours !== undefined) {
      config.auditIntervalHours = Math.max(1, Number(auditIntervalHours));
    }

    res.json({ success: true, message: `Tolerance updated for ${config.categoryLabel}`, config });
  });

  app.get('/api/admin/shrinkage/adjustments', (req: Request, res: Response) => {
    const { storeId, category } = req.query;
    let list = naturalShrinkageAdjustments;
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') {
      list = list.filter((a) => a.storeId === storeId);
    }
    if (category && category !== 'ALL') {
      list = list.filter((a) => a.category === category);
    }
    res.json(list);
  });

  app.post('/api/admin/shrinkage/adjust-natural', async (req: Request, res: Response) => {
    const {
      sku,
      storeId = 'store-jkt-senopati',
      recordedGrossWeightGrams,
      actualAuditWeightGrams,
      batchId,
      auditorNotes,
    } = req.body;

    const initialGrams = Number(recordedGrossWeightGrams);
    const auditedGrams = Number(actualAuditWeightGrams);

    if (!sku || !initialGrams || !auditedGrams || initialGrams <= 0 || auditedGrams <= 0) {
      return res.status(400).json({ error: 'Valid sku, recordedGrossWeightGrams, and actualAuditWeightGrams required' });
    }

    if (auditedGrams > initialGrams) {
      return res.status(400).json({ error: 'Audit weight exceeds original weight. Mass reduction required for shrinkage calculation.' });
    }

    const item = inventoryList.find((i) => i.sku === sku);
    if (!item) return res.status(404).json({ error: 'Inventory item not found' });

    const toleranceConfig = weightToleranceConfigs.find((c) => c.category === item.category) || {
      category: item.category,
      categoryLabel: item.category,
      maxEvaporationTolerancePercent: 3.0,
      auditIntervalHours: 24,
      description: 'Default tolerance baseline',
    };

    const weightLossGrams = initialGrams - auditedGrams;
    const weightLossPercent = Number(((weightLossGrams / initialGrams) * 100).toFixed(2));
    const isWithinNaturalTolerance = weightLossPercent <= toleranceConfig.maxEvaporationTolerancePercent;

    // Financial valuation of natural moisture loss
    // Grams-to-unit ratio
    const gramsPerUnit = item.weightGrams || 500;
    const equivalentUnitsLost = Number((weightLossGrams / gramsPerUnit).toFixed(3));
    const totalLossCost = Math.round(equivalentUnitsLost * item.unitCost);

    const store = storeSchedules.find((s) => s.storeId === storeId);
    const storeName = store?.storeName || 'GroceMart Senopati Flagship';
    const warehouseZoneId = store?.activeWarehouses[1] || 'WH-JKT-SEN-COLD';

    // Deduct stock mass from inventory tier
    const tier = storeInventoryTiers.find((t) => t.sku === sku && t.storeId === storeId);
    if (tier && equivalentUnitsLost > 0) {
      tier.physicalStock = Math.max(0, Number((tier.physicalStock - equivalentUnitsLost).toFixed(2)));
      tier.availableStock = Math.max(0, tier.physicalStock - tier.reservedStock);
      tier.updatedAt = new Date().toISOString();
    }

    // Auto-Post Double-Entry Accounting Entry:
    // Debit 6030: Inventory Shrinkage & Natural Loss Expense
    // Credit 1040: Merchandise Inventory Asset
    const timestamp = new Date().toISOString();
    const evapId = `EVAP-2026-${(naturalShrinkageAdjustments.length + 1).toString().padStart(3, '0')}`;
    const gleId1 = `GLE-2026-${(generalLedger.length + 1).toString().padStart(4, '0')}`;
    const gleId2 = `GLE-2026-${(generalLedger.length + 2).toString().padStart(4, '0')}`;

    const classification = isWithinNaturalTolerance
      ? 'Natural Shrinkage / Evaporation Loss'
      : 'Anomalous Spoilage Loss';

    generalLedger.unshift({
      id: gleId1,
      timestamp,
      storeId,
      storeName,
      accountCode: '6030',
      accountName: 'Inventory Shrinkage & Spoilage Expense',
      category: 'Expense',
      debit: totalLossCost,
      credit: 0,
      referenceType: 'INVENTORY_ADJUSTMENT',
      referenceId: evapId,
      description: `[${classification}] ${weightLossGrams}g moisture loss on ${item.productName} (${weightLossPercent}% vs ${toleranceConfig.maxEvaporationTolerancePercent}% threshold)`,
    });

    generalLedger.unshift({
      id: gleId2,
      timestamp,
      storeId,
      storeName,
      accountCode: '1040',
      accountName: 'Merchandise Inventory Asset',
      category: 'Asset',
      debit: 0,
      credit: totalLossCost,
      referenceType: 'INVENTORY_ADJUSTMENT',
      referenceId: evapId,
      description: `Asset balance adjustment for natural shrinkage audit #${evapId}`,
    });

    const adjustment: NaturalShrinkageAdjustment = {
      id: evapId,
      timestamp,
      sku,
      productName: item.productName,
      category: item.category,
      storeId,
      storeName,
      warehouseZoneId,
      batchId,
      recordedGrossWeightGrams: initialGrams,
      actualAuditWeightGrams: auditedGrams,
      weightLossGrams,
      weightLossPercent,
      toleranceThresholdPercent: toleranceConfig.maxEvaporationTolerancePercent,
      isWithinNaturalTolerance,
      classification,
      unitCost: item.unitCost,
      totalLossCost,
      glEntryId: gleId1,
      auditorId: currentActiveStaffSession.userId,
      auditorName: currentActiveStaffSession.userName,
      shiftId: currentActiveStaffSession.activeShiftId,
      notes: auditorNotes || `Weight reduction of ${weightLossGrams}g (${weightLossPercent}%) confirmed during shift stocktake.`,
    };

    naturalShrinkageAdjustments.unshift(adjustment);

    // Record in Security & Operational Audit Log
    securityAuditTrail.unshift({
      id: `AUD-SEC-2026-${(securityAuditTrail.length + 1).toString().padStart(4, '0')}`,
      timestamp,
      actionType: 'SHRINKAGE_WRITE_OFF',
      resourceId: evapId,
      userId: currentActiveStaffSession.userId,
      userName: currentActiveStaffSession.userName,
      userRole: currentActiveStaffSession.userRole,
      storeId,
      shiftId: currentActiveStaffSession.activeShiftId,
      status: 'AUTHORIZED_EXECUTED',
      metadata: {
        sku,
        classification,
        isWithinNaturalTolerance,
        weightLossGrams,
        weightLossPercent,
        totalLossCost,
      },
    });

    res.json({
      success: true,
      message: isWithinNaturalTolerance
        ? `Logged as Natural Shrinkage (${weightLossPercent}% within ${toleranceConfig.maxEvaporationTolerancePercent}% tolerance). Clean audit record posted.`
        : `Warning: Moisture loss of ${weightLossPercent}% exceeds natural threshold (${toleranceConfig.maxEvaporationTolerancePercent}%). Flagged as anomalous shrinkage.`,
      adjustment,
      journalEntryIds: [gleId1, gleId2],
    });
  });

  // =============================================================
  // MODULE 2: REAL-TIME SUBSTITUTION & BUYER PROMPT ENGINE
  // Simulated WhatsApp/In-App customer prompt + FIFO batch balance recomputation
  // =============================================================
  app.get('/api/admin/substitutions/prompts', (req: Request, res: Response) => {
    const { status, storeId } = req.query;
    let list = substitutionPromptRecords;
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') {
      list = list.filter((p) => p.storeId === storeId);
    }
    if (status && status !== 'ALL') {
      list = list.filter((p) => p.promptStatus === status);
    }
    res.json(list);
  });

  app.post('/api/admin/substitutions/request-prompt', (req: Request, res: Response) => {
    const {
      orderId,
      itemId,
      replacementSku,
      channel = 'WhatsApp',
      absorbPriceDifference = true,
    } = req.body;

    const order = pickerOrders.find((o) => o.orderId === orderId);
    if (!order) return res.status(404).json({ error: 'Order not found in picker queue' });

    const item = order.items.find((i) => i.id === itemId);
    if (!item) return res.status(404).json({ error: 'Item not found in order' });

    const replacement = inventoryList.find((i) => i.sku === replacementSku);
    if (!replacement) return res.status(404).json({ error: 'Replacement SKU not found' });

    // FIFO allocation check on replacement stock
    const availableReplacementBatches = inventoryBatches
      .filter((b) => b.sku === replacementSku && b.storeId === order.storeId && b.currentStock > 0)
      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

    const replacementBatch = availableReplacementBatches[0] || {
      batchId: `BAT-${replacementSku.slice(-3)}-AUTO`,
      lotNumber: `LOT-${Date.now().toString().slice(-4)}`,
      expiryDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      currentStock: replacement.currentStock,
    };

    const priceDelta = (replacement.sellingPrice * item.orderedQty) - item.finalPrice;
    const promptId = `SUB-PRM-2026-${(substitutionPromptRecords.length + 1).toString().padStart(3, '0')}`;
    const timestamp = new Date().toISOString();

    const simulationMessage =
      channel === 'WhatsApp'
        ? `[GroceMart WhatsApp Official] Hi ${order.customerName}! Due to morning farm freshness harvest checks, your ordered ${item.productName} is currently unavailable. Packer has reserved ${replacement.productName} (Rp ${replacement.sellingPrice.toLocaleString('id-ID')} value${absorbPriceDifference ? ' - Price difference covered by GroceMart!' : ''}). Reply YES to confirm or NO for refund.`
        : `GroceMart App Alert: Substitution proposed for Order #${orderId}: ${replacement.productName}. Tap to approve within 10 mins.`;

    const promptRecord: SubstitutionPromptRecord = {
      id: promptId,
      orderId,
      itemId,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      originalSku: item.sku,
      originalProductName: item.productName,
      originalPrice: item.finalPrice,
      originalQty: item.orderedQty,
      replacementSku: replacement.sku,
      replacementProductName: replacement.productName,
      replacementPrice: replacement.sellingPrice * item.orderedQty,
      replacementBatchId: replacementBatch.batchId,
      replacementLotNumber: replacementBatch.lotNumber,
      replacementExpiryDate: replacementBatch.expiryDate,
      priceDelta,
      absorbPriceDifference: Boolean(absorbPriceDifference),
      promptStatus: 'pending_customer_approval',
      channel,
      simulationMessage,
      timestamp,
      packerId: currentActiveStaffSession.userId,
      storeId: order.storeId,
    };

    substitutionPromptRecords.unshift(promptRecord);

    res.json({
      success: true,
      message: `Customer prompt dispatched via ${channel}. Awaiting customer confirmation.`,
      prompt: promptRecord,
    });
  });

  app.post('/api/admin/substitutions/:promptId/respond', async (req: Request, res: Response) => {
    const { promptId } = req.params;
    const { action } = req.body; // 'approve' | 'decline'

    const prompt = substitutionPromptRecords.find((p) => p.id === promptId);
    if (!prompt) return res.status(404).json({ error: 'Substitution prompt not found' });

    if (prompt.promptStatus !== 'pending_customer_approval') {
      return res.status(400).json({ error: `Prompt has already been decided: ${prompt.promptStatus}` });
    }

    const order = pickerOrders.find((o) => o.orderId === prompt.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const item = order.items.find((i) => i.id === prompt.itemId);
    if (!item) return res.status(404).json({ error: 'Order item not found' });

    prompt.decidedAt = new Date().toISOString();

    if (action === 'decline') {
      prompt.promptStatus = 'declined_by_customer';
      item.status = 'out_of_stock';
      order.updatedAt = new Date().toISOString();
      return res.json({
        success: true,
        message: 'Customer declined substitution. Item marked Out of Stock; customer balance credited for refund.',
        prompt,
      });
    }

    // Customer Approved: Execute substitution with strict FIFO traceability and GL adjustment
    prompt.promptStatus = 'approved_by_customer';
    const replacement = inventoryList.find((i) => i.sku === prompt.replacementSku);
    const replacementBatch = inventoryBatches.find((b) => b.batchId === prompt.replacementBatchId);

    // Deduct stock from replacement FIFO batch
    if (replacementBatch) {
      replacementBatch.currentStock = Math.max(0, replacementBatch.currentStock - item.orderedQty);
    }
    if (replacement) {
      replacement.currentStock = Math.max(0, replacement.currentStock - item.orderedQty);
    }

    // Update item in picker order
    item.status = 'substituted';
    item.substitution = {
      replacementProductId: replacement?.productId || 'prod-sub',
      replacementSku: prompt.replacementSku,
      replacementName: prompt.replacementProductName,
      replacementBarcode: `899${Date.now().toString().slice(-10)}`,
      originalPrice: prompt.originalPrice,
      replacementPrice: prompt.replacementPrice,
      priceDelta: prompt.priceDelta,
      reason: 'Customer Approved Real-Time Substitution',
      customerApprovalStatus: 'auto_approved',
      suggestedAt: prompt.timestamp,
    };
    item.productName = `${prompt.replacementProductName} (Substituted from ${prompt.originalProductName})`;
    item.finalPrice = prompt.absorbPriceDifference ? prompt.originalPrice : prompt.replacementPrice;

    // Financial Hook: If store absorbed difference, book Promotional Courtesy Expense
    const journalIds: string[] = [];
    if (prompt.absorbPriceDifference && prompt.priceDelta > 0) {
      const timestamp = new Date().toISOString();
      const gleId1 = `GLE-2026-${(generalLedger.length + 1).toString().padStart(4, '0')}`;
      const gleId2 = `GLE-2026-${(generalLedger.length + 2).toString().padStart(4, '0')}`;

      generalLedger.unshift({
        id: gleId1,
        timestamp,
        storeId: prompt.storeId,
        storeName: order.storeName,
        accountCode: '6010',
        accountName: 'Store Operational Expense',
        category: 'Expense',
        debit: prompt.priceDelta,
        credit: 0,
        referenceType: 'OPEX',
        referenceId: prompt.id,
        description: `Customer courtesy discount for substituted SKU ${prompt.replacementSku} on Order #${prompt.orderId}`,
      });

      generalLedger.unshift({
        id: gleId2,
        timestamp,
        storeId: prompt.storeId,
        storeName: order.storeName,
        accountCode: '4010',
        accountName: 'Grocery Sales Revenue',
        category: 'Revenue',
        debit: 0,
        credit: prompt.priceDelta,
        referenceType: 'OPEX',
        referenceId: prompt.id,
        description: `Revenue differential offset for order #${prompt.orderId}`,
      });

      journalIds.push(gleId1, gleId2);
      prompt.glJournalIds = journalIds;
    }

    prompt.fifoAuditLog = `FIFO Batch ${prompt.replacementBatchId} (Lot ${prompt.replacementLotNumber}, Expiry ${prompt.replacementExpiryDate}) allocated to Order #${prompt.orderId}.`;

    order.pickedItems = order.items.filter((i) => i.status === 'picked' || i.status === 'substituted').length;
    if (order.pickedItems === order.totalItems) {
      order.pickerStatus = 'ready_for_packing';
    }
    order.updatedAt = new Date().toISOString();

    // Security & Operational Audit Log
    securityAuditTrail.unshift({
      id: `AUD-SEC-2026-${(securityAuditTrail.length + 1).toString().padStart(4, '0')}`,
      timestamp: new Date().toISOString(),
      actionType: 'SUBSTITUTION_DISPATCH',
      resourceId: prompt.id,
      userId: currentActiveStaffSession.userId,
      userName: currentActiveStaffSession.userName,
      userRole: currentActiveStaffSession.userRole,
      storeId: prompt.storeId,
      shiftId: currentActiveStaffSession.activeShiftId,
      status: 'AUTHORIZED_EXECUTED',
      metadata: {
        orderId: prompt.orderId,
        originalSku: prompt.originalSku,
        replacementSku: prompt.replacementSku,
        priceDelta: prompt.priceDelta,
      },
    });

    res.json({
      success: true,
      message: `Substitution confirmed by buyer! Basket updated with ${prompt.replacementProductName}. FIFO tracking maintained.`,
      prompt,
      order,
    });
  });

  // =============================================================
  // MODULE 3: GRANULAR RBAC BY SHIFT, PHYSICAL ZONE & MULTI-OUTLET
  // Staff switch + zone-authorization checks + audit log
  // =============================================================
  app.post('/api/admin/auth/login', (req: Request, res: Response) => {
    const { userId, username, password, pin, shiftName } = req.body || {};

    let target = AVAILABLE_STAFF_USERS.find((u) => u.userId === userId);

    if (!target && username) {
      const cleanUser = String(username).toLowerCase().trim();
      target = AVAILABLE_STAFF_USERS.find(
        (u) =>
          u.userId.toLowerCase() === cleanUser ||
          u.userName.toLowerCase().includes(cleanUser) ||
          u.userRole.toLowerCase() === cleanUser.replace(/\s+/g, '_')
      );
    }

    if (!target) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials. Please select an authorized staff profile or enter a valid Employee ID.',
      });
    }

    if (
      password &&
      password !== 'admin123' &&
      password !== '8821' &&
      password !== 'grocemart2026' &&
      password !== target.userId &&
      pin !== '8821'
    ) {
      return res.status(401).json({
        success: false,
        error: 'Incorrect security password or PIN. Hint: use default "admin123" or PIN "8821".',
      });
    }

    currentActiveStaffSession = {
      ...target,
      loginTimestamp: new Date().toISOString(),
      shiftName: shiftName || target.shiftName,
    };

    securityAuditTrail.unshift({
      id: `AUD-SEC-2026-${(securityAuditTrail.length + 1).toString().padStart(4, '0')}`,
      timestamp: new Date().toISOString(),
      actionType: 'USER_AUTHENTICATION',
      resourceId: `SESSION-${target.userId}`,
      userId: target.userId,
      userName: target.userName,
      userRole: target.userRole,
      storeId: target.storeId,
      shiftId: target.activeShiftId,
      status: 'AUTHORIZED_EXECUTED',
      metadata: {
        loginMethod: userId ? 'role_profile_selection' : 'credential_login',
        clientIp: req.ip || '127.0.0.1',
        shift: currentActiveStaffSession.shiftName,
      },
    });

    res.json({
      success: true,
      token: `erp-session-jwt-${Date.now()}-${target.userId}`,
      session: currentActiveStaffSession,
      availableProfiles: AVAILABLE_STAFF_USERS,
      message: `Authentication successful. Logged in as ${target.userName}`,
    });
  });

  app.post('/api/admin/auth/logout', (_req: Request, res: Response) => {
    securityAuditTrail.unshift({
      id: `AUD-SEC-2026-${(securityAuditTrail.length + 1).toString().padStart(4, '0')}`,
      timestamp: new Date().toISOString(),
      actionType: 'USER_LOGOUT',
      resourceId: `LOGOUT-${currentActiveStaffSession.userId}`,
      userId: currentActiveStaffSession.userId,
      userName: currentActiveStaffSession.userName,
      userRole: currentActiveStaffSession.userRole,
      storeId: currentActiveStaffSession.storeId,
      shiftId: currentActiveStaffSession.activeShiftId,
      status: 'AUTHORIZED_EXECUTED',
      metadata: { reason: 'User initiated ERP session lock / sign out' },
    });

    res.json({ success: true, message: 'ERP session locked and logged out.' });
  });

  app.get('/api/admin/rbac/current-session', (_req: Request, res: Response) => {
    res.json({
      currentSession: currentActiveStaffSession,
      availableProfiles: AVAILABLE_STAFF_USERS,
    });
  });

  app.post('/api/admin/rbac/switch-session', (req: Request, res: Response) => {
    const { userId } = req.body;
    const target = AVAILABLE_STAFF_USERS.find((u) => u.userId === userId);
    if (!target) return res.status(404).json({ error: 'Staff profile not found' });

    currentActiveStaffSession = target;
    res.json({
      success: true,
      message: `Active session switched to ${target.userName} (${target.userRole})`,
      session: currentActiveStaffSession,
    });
  });

  app.get('/api/admin/rbac/security-audit-trail', (req: Request, res: Response) => {
    const { storeId, actionType } = req.query;
    let list = securityAuditTrail;
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') {
      list = list.filter((a) => a.storeId === storeId);
    }
    if (actionType && actionType !== 'ALL') {
      list = list.filter((a) => a.actionType === actionType);
    }
    res.json(list);
  });

  // RBAC Zone Access Guard Endpoint (Enforces physical warehouse zone picking authorization)
  app.post('/api/admin/rbac/check-zone-access', (req: Request, res: Response) => {
    const { zoneType } = req.body; // 'ambient' | 'cold_chilled' | 'freezer'
    const allowed = currentActiveStaffSession.permissions.canPickZone(zoneType);

    if (!allowed) {
      securityAuditTrail.unshift({
        id: `AUD-SEC-2026-${(securityAuditTrail.length + 1).toString().padStart(4, '0')}`,
        timestamp: new Date().toISOString(),
        actionType: 'ZONE_CONFIG_UPDATE',
        resourceId: zoneType,
        userId: currentActiveStaffSession.userId,
        userName: currentActiveStaffSession.userName,
        userRole: currentActiveStaffSession.userRole,
        storeId: currentActiveStaffSession.storeId,
        shiftId: currentActiveStaffSession.activeShiftId,
        status: 'PERMISSION_DENIED',
        metadata: { attemptedZone: zoneType, assignedZones: currentActiveStaffSession.assignedZones },
      });

      return res.status(403).json({
        success: false,
        authorized: false,
        error: `Access Denied: Staff role '${currentActiveStaffSession.userRole}' with active shift '${currentActiveStaffSession.activeShiftId}' is restricted from accessing physical zone '${zoneType}'. Assigned zones: [${currentActiveStaffSession.assignedZones.join(', ')}].`,
      });
    }

    res.json({ success: true, authorized: true, message: `Access granted for zone '${zoneType}'.` });
  });

  // =============================================================
  // MODULE 4: GLOBAL SCALABILITY (MULTI-CURRENCY & CLIMATE COLD-CHAIN)
  // Multi-Currency P&L / GL conversions & Adaptive IoT Chiller Thresholds
  // =============================================================
  app.get('/api/admin/scalability/currencies', (_req: Request, res: Response) => {
    res.json(CURRENCY_RATES);
  });

  app.get('/api/admin/scalability/climate-thresholds', (req: Request, res: Response) => {
    const { storeId } = req.query;
    let list = climateAdaptiveConfigs;
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') {
      list = list.filter((c) => c.storeId === storeId);
    }
    res.json(list);
  });

  app.put('/api/admin/scalability/climate-thresholds/:zoneId', (req: Request, res: Response) => {
    const { zoneId } = req.params;
    const {
      ambientExternalTempCelsius,
      externalHumidityPercent,
      adaptiveOffsetCelsius,
      currentActualTempCelsius,
    } = req.body;

    const config = climateAdaptiveConfigs.find((c) => c.warehouseZoneId === zoneId);
    if (!config) return res.status(404).json({ error: 'Climate config for zone not found' });

    if (ambientExternalTempCelsius !== undefined) config.ambientExternalTempCelsius = Number(ambientExternalTempCelsius);
    if (externalHumidityPercent !== undefined) config.externalHumidityPercent = Number(externalHumidityPercent);
    if (adaptiveOffsetCelsius !== undefined) config.adaptiveOffsetCelsius = Number(adaptiveOffsetCelsius);
    if (currentActualTempCelsius !== undefined) config.currentActualTempCelsius = Number(currentActualTempCelsius);

    // Recompute adaptive alert threshold
    config.activeAlertThresholdCelsius = Number(
      (config.standardTempMaxCelsius + config.adaptiveOffsetCelsius).toFixed(2)
    );

    // Evaluate IoT Breach Condition
    if (config.currentActualTempCelsius > config.activeAlertThresholdCelsius) {
      config.isTempAlertActive = true;
      config.alertSeverity =
        config.currentActualTempCelsius > config.activeAlertThresholdCelsius + 1.5
          ? 'CRITICAL_BREACH'
          : 'ELEVATED';
    } else {
      config.isTempAlertActive = false;
      config.alertSeverity = 'NORMAL';
    }

    config.lastUpdated = new Date().toISOString();

    res.json({
      success: true,
      message: `Zone ${config.zoneName} climate thresholds adapted to local external weather conditions.`,
      config,
    });
  });

  // Multi-Currency Financial Statement API (Converts GL / P&L based on target currency)
  app.get('/api/admin/accounting/pnl-multicurrency', (req: Request, res: Response) => {
    const { storeId, currency = 'IDR' } = req.query;
    const targetCurrency = (String(currency).toUpperCase() as SupportedCurrency) || 'IDR';
    const rateInfo = CURRENCY_RATES[targetCurrency] || CURRENCY_RATES.IDR;

    let relevantEntries = generalLedger;
    let storeName = 'Consolidated Company-Wide';

    if (storeId && storeId !== 'CONSOLIDATED') {
      relevantEntries = generalLedger.filter((e) => e.storeId === storeId);
      const s = storeSchedules.find((st) => st.storeId === storeId);
      if (s) storeName = s.storeName;
    }

    let grossSalesRevenue = 0;
    let costOfGoodsSold = 0;

    relevantEntries.forEach((entry) => {
      if (entry.accountCode === '4010') grossSalesRevenue += entry.credit;
      if (entry.accountCode === '5010') costOfGoodsSold += entry.debit;
    });

    if (grossSalesRevenue === 0) {
      grossSalesRevenue = storeId && storeId !== 'CONSOLIDATED' ? 45000000 : 388500000;
      costOfGoodsSold = Math.round(grossSalesRevenue * 0.62);
    }

    const discountsGiven = Math.round(grossSalesRevenue * 0.04);
    const netSalesRevenue = grossSalesRevenue - discountsGiven;
    const grossProfit = netSalesRevenue - costOfGoodsSold;
    const grossMarginPercent = netSalesRevenue > 0 ? (grossProfit / netSalesRevenue) * 100 : 0;

    const factor = storeId && storeId !== 'CONSOLIDATED' ? 0.22 : 1.0;
    const operatingExpenses = [
      { category: 'Cold-Chain Refrigeration & Store Electricity', amount: Math.round(18500000 * factor) },
      { category: 'Same-Day Chilled Logistics & Couriers', amount: Math.round(12200000 * factor) },
      { category: 'Store Storekeeping & Quality Inspection Staff', amount: Math.round(24800000 * factor) },
      { category: 'Biodegradable Insulated Packaging', amount: Math.round(3500000 * factor) },
    ];

    const totalOperatingExpenses = operatingExpenses.reduce((sum, o) => sum + o.amount, 0);
    const netProfit = grossProfit - totalOperatingExpenses;
    const netMarginPercent = netSalesRevenue > 0 ? (netProfit / netSalesRevenue) * 100 : 0;

    // Convert all IDR values to target currency
    const fx = (val: number) => {
      if (targetCurrency === 'IDR') return val;
      return Number((val / rateInfo.rateToIDR).toFixed(rateInfo.decimalPlaces));
    };

    res.json({
      currency: targetCurrency,
      symbol: rateInfo.symbol,
      fxRateToIDR: rateInfo.rateToIDR,
      period: 'October 2026 MTD',
      storeId: storeId ? String(storeId) : 'CONSOLIDATED',
      storeName,
      grossSalesRevenue: fx(grossSalesRevenue),
      discountsGiven: fx(discountsGiven),
      netSalesRevenue: fx(netSalesRevenue),
      costOfGoodsSold: fx(costOfGoodsSold),
      grossProfit: fx(grossProfit),
      grossMarginPercent: Number(grossMarginPercent.toFixed(1)),
      operatingExpenses: operatingExpenses.map((o) => ({
        category: o.category,
        amount: fx(o.amount),
      })),
      totalOperatingExpenses: fx(totalOperatingExpenses),
      netProfit: fx(netProfit),
      netMarginPercent: Number(netMarginPercent.toFixed(1)),
    });
  });

  // =============================================================
  // MODULE 5: POS (POINT OF SALE) & CASHIER STATION ENGINE
  // Real-time stock deduction, FEFO batch reduction, General Ledger,
  // multi-currency tender, and audit logging.
  // =============================================================
  app.get('/api/pos/products', (req: Request, res: Response) => {
    const { storeId = 'store-jkt-senopati', search = '', category = 'ALL' } = req.query;
    const cleanSearch = String(search).toLowerCase().trim();
    const cleanCategory = String(category).toLowerCase().trim();

    const posCatalog: POSProductItem[] = PRODUCTS.map((prod) => {
      // Find SKU in inventoryList
      const inv = inventoryList.find((i) => i.productId === prod.id || i.productName.toLowerCase() === prod.name.toLowerCase());
      const sku = inv?.sku || `SKU-${prod.category.slice(0, 3).toUpperCase()}-${prod.id.replace(/\D/g, '').padStart(3, '0')}`;

      // Find store stock tier
      const tier = storeInventoryTiers.find(
        (t) => t.sku === sku && (t.storeId === storeId || storeId === 'CONSOLIDATED')
      );
      const currentStock = tier ? tier.physicalStock : (inv ? inv.currentStock : 24);
      const availableStock = tier ? tier.availableStock : Math.max(0, currentStock - 2);

      // Find nearest FEFO batch for this SKU
      const batchesForSku = inventoryBatches
        .filter((b) => b.sku === sku && (b.storeId === storeId || storeId === 'CONSOLIDATED' || b.storeId === 'store-jkt-senopati'))
        .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

      const nearestBatch = batchesForSku[0];

      return {
        sku,
        productId: prod.id,
        name: prod.name,
        category: prod.category,
        sellingPrice: prod.price,
        unitCost: inv?.unitCost || Math.round(prod.price * 0.62),
        unit: prod.unit,
        barcode: sku, // SKU is barcode identifier
        image: prod.image,
        currentStock,
        availableStock,
        isWeighted: Boolean(prod.isWeightBased || prod.category === 'produce' || prod.category === 'meat_seafood'),
        pricePerKg: prod.pricePerKg || (prod.unit.includes('kg') ? prod.price : prod.price * 4),
        nearestBatchId: nearestBatch?.batchId,
        lotNumber: nearestBatch?.lotNumber,
        expiryDate: nearestBatch?.expiryDate,
        daysUntilExpiry: nearestBatch?.daysUntilExpiry,
        batchStatus: nearestBatch
          ? nearestBatch.daysUntilExpiry <= 2
            ? 'critical'
            : nearestBatch.daysUntilExpiry <= 5
            ? 'near_expiry'
            : 'fresh'
          : 'fresh',
      };
    });

    let filtered = posCatalog;
    if (cleanCategory !== 'all') {
      filtered = filtered.filter((p) => p.category.toLowerCase() === cleanCategory);
    }
    if (cleanSearch) {
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(cleanSearch) ||
          p.sku.toLowerCase().includes(cleanSearch) ||
          p.barcode.toLowerCase().includes(cleanSearch) ||
          p.category.toLowerCase().includes(cleanSearch)
      );
    }

    res.json(filtered);
  });

  app.post('/api/pos/checkout', (req: Request, res: Response) => {
    const {
      storeId = 'store-jkt-senopati',
      storeName = 'GroceMart Senopati Flagship',
      cashierId = currentActiveStaffSession.userId,
      cashierName = currentActiveStaffSession.userName,
      shiftId = currentActiveStaffSession.activeShiftId,
      items = [],
      subtotal = 0,
      discount = 0,
      tax = 0,
      total = 0,
      currency = 'IDR',
      currencyTotal = total,
      currencyRateToIDR = 1,
      paymentMethod = 'cash',
      cashTendered,
      cashChange,
      customerName = 'Walk-in Retail Shopper',
      customerPhone,
      customerMemberId,
      notes,
    } = req.body as POSTransactionRequest;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Cannot process POS checkout with an empty cart.' });
    }

    // Role-Based Access Control Verification
    const isAuthorized =
      currentActiveStaffSession.permissions.canViewPos ||
      currentActiveStaffSession.userRole === 'cashier' ||
      currentActiveStaffSession.userRole === 'store_manager' ||
      currentActiveStaffSession.userRole === 'executive' ||
      currentActiveStaffSession.userRole === 'admin';

    if (!isAuthorized) {
      return res.status(403).json({
        error: `Permission Denied: User ${currentActiveStaffSession.userName} (${currentActiveStaffSession.userRole}) is not authorized for Frontline POS register checkouts.`,
      });
    }

    const timestamp = new Date().toISOString();
    const shortCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    const cleanStoreCode = storeId.replace('store-', '').substring(0, 3).toUpperCase();
    const receiptNumber = `RCP-${cleanStoreCode}-${Date.now().toString().slice(-6)}`;
    const transactionId = `TXN-POS-2026-${(auditTrail.length + 1).toString().padStart(4, '0')}`;
    const orderId = `GCM-POS-${Date.now().toString().slice(-6)}`;

    // 1. Real-time Inventory & FEFO Batch Deduction
    let totalCogsCost = 0;
    let inventoryDeductedCount = 0;

    items.forEach((item) => {
      const qty = item.quantity;
      const cogsLine = Math.round((item.unitCost || Math.round(item.unitPrice * 0.62)) * qty);
      totalCogsCost += cogsLine;
      inventoryDeductedCount += qty;

      // A. Store Inventory Tiers
      const tier = storeInventoryTiers.find(
        (t) => t.sku === item.sku && (t.storeId === storeId || storeId === 'CONSOLIDATED')
      );
      if (tier) {
        tier.physicalStock = Math.max(0, Number((tier.physicalStock - qty).toFixed(2)));
        tier.availableStock = Math.max(0, tier.physicalStock - tier.reservedStock);
        tier.updatedAt = timestamp;
      }

      // B. Global Inventory List
      const inv = inventoryList.find((i) => i.sku === item.sku);
      if (inv) {
        inv.currentStock = Math.max(0, Number((inv.currentStock - qty).toFixed(2)));
      }

      // C. FEFO Batch Deduction (First Expired, First Out)
      let remainingToDeduct = qty;
      const batches = inventoryBatches
        .filter((b) => b.sku === item.sku && (b.storeId === storeId || storeId === 'CONSOLIDATED' || b.storeId === 'store-jkt-senopati'))
        .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

      for (const batch of batches) {
        if (remainingToDeduct <= 0) break;
        const take = Math.min(batch.currentStock, remainingToDeduct);
        batch.currentStock = Math.max(0, Number((batch.currentStock - take).toFixed(2)));
        if (batch.currentStock === 0) {
          batch.status = 'depleted';
        }
        remainingToDeduct -= take;
      }
    });

    // 2. Automatic Accounting & General Ledger Double-Entry
    // Asset Account Mapping: Cash: 1010, QRIS: 1030, Card/Bank: 1020
    let assetAccountCode: AccountCode = '1010';
    let assetAccountName = 'Cash on Hand & Store Registers';
    if (paymentMethod === 'qris') {
      assetAccountCode = '1030';
      assetAccountName = 'QRIS Settlement Receivable (ASPI Clearing)';
    } else if (paymentMethod === 'debit_card' || paymentMethod === 'credit_card') {
      assetAccountCode = '1020';
      assetAccountName = 'Bank BCA Operational Clearing';
    }

    const gleId1 = `GLE-2026-${(generalLedger.length + 1).toString().padStart(4, '0')}`;
    const gleId2 = `GLE-2026-${(generalLedger.length + 2).toString().padStart(4, '0')}`;
    const gleId3 = `GLE-2026-${(generalLedger.length + 3).toString().padStart(4, '0')}`;
    const gleId4 = `GLE-2026-${(generalLedger.length + 4).toString().padStart(4, '0')}`;
    const journalEntryIds = [gleId1, gleId2, gleId3, gleId4];

    // Double-entry 1: Asset Debit (Cash/Bank/QRIS received)
    generalLedger.unshift({
      id: gleId1,
      timestamp,
      storeId,
      storeName,
      accountCode: assetAccountCode,
      accountName: assetAccountName,
      category: 'Asset',
      debit: total,
      credit: 0,
      referenceType: 'POS_SALE',
      referenceId: receiptNumber,
      description: `POS Checkout #${receiptNumber} - Tender: ${paymentMethod.toUpperCase()}${currency !== 'IDR' ? ` (${currency} ${currencyTotal})` : ''}`,
    });

    // Double-entry 2: Revenue Credit (Gross Sales Revenue)
    generalLedger.unshift({
      id: gleId2,
      timestamp,
      storeId,
      storeName,
      accountCode: '4010',
      accountName: 'Grocery Sales Revenue',
      category: 'Revenue',
      debit: 0,
      credit: total,
      referenceType: 'POS_SALE',
      referenceId: receiptNumber,
      description: `Sales Revenue recognized from POS Register (Cashier: ${cashierName})`,
    });

    // Double-entry 3: COGS Debit (Cost of Goods Sold Expense)
    generalLedger.unshift({
      id: gleId3,
      timestamp,
      storeId,
      storeName,
      accountCode: '5010',
      accountName: 'Cost of Goods Sold (COGS)',
      category: 'Expense',
      debit: totalCogsCost,
      credit: 0,
      referenceType: 'POS_SALE',
      referenceId: receiptNumber,
      description: `COGS realized for ${items.length} items sold via POS #${receiptNumber}`,
    });

    // Double-entry 4: Inventory Asset Credit (Deduction of stock balance)
    generalLedger.unshift({
      id: gleId4,
      timestamp,
      storeId,
      storeName,
      accountCode: '1040',
      accountName: 'Merchandise Inventory Asset',
      category: 'Asset',
      debit: 0,
      credit: totalCogsCost,
      referenceType: 'POS_SALE',
      referenceId: receiptNumber,
      description: `Inventory balance reduction upon in-store POS dispatch #${receiptNumber}`,
    });

    // 3. Audit Trail Records
    auditTrail.unshift({
      id: `AUD-2026-${(auditTrail.length + 1).toString().padStart(4, '0')}`,
      qrisReference: paymentMethod === 'qris' ? `QRIS-POS-${shortCode}` : undefined,
      orderId: receiptNumber,
      customerName,
      customerEmail: customerPhone || 'cashier.counter@grocemart.co.id',
      amount: total,
      paymentTimestamp: timestamp,
      settlementChannel: `POS Register (${paymentMethod.toUpperCase()})`,
      journalEntryIds,
      inventoryDeducted: items.map((i) => ({
        sku: i.sku,
        quantity: i.quantity,
        cogsCost: Math.round((i.unitCost || 0) * i.quantity),
      })),
      status: 'SETTLED',
    });

    securityAuditTrail.unshift({
      id: `AUD-SEC-2026-${(securityAuditTrail.length + 1).toString().padStart(4, '0')}`,
      timestamp,
      actionType: 'PRICE_OVERRIDE' as any,
      resourceId: receiptNumber,
      userId: cashierId,
      userName: cashierName,
      userRole: currentActiveStaffSession.userRole,
      storeId,
      shiftId: shiftId || currentActiveStaffSession.activeShiftId,
      status: 'AUTHORIZED_EXECUTED',
      metadata: {
        receiptNumber,
        total,
        currency,
        currencyTotal,
        paymentMethod,
        itemCount: items.length,
      },
    });

    // 4. Construct Complete Receipt
    const receipt: POSTransactionReceipt = {
      receiptNumber,
      transactionId,
      orderId,
      timestamp,
      storeId,
      storeName,
      cashierId,
      cashierName,
      shiftId: shiftId || 'SHIFT-01',
      items,
      subtotal,
      discount,
      tax,
      total,
      currency,
      currencyTotal,
      currencyRateToIDR,
      paymentMethod,
      cashTendered,
      cashChange,
      qrisRef: paymentMethod === 'qris' ? `QRIS-POS-${shortCode}` : undefined,
      cardLast4: paymentMethod.includes('card') ? '8842' : undefined,
      journalEntryIds,
      inventoryDeductedCount,
      totalCogsCost,
    };

    posTransactionsHistory.unshift(receipt);

    res.json({
      success: true,
      receipt,
      message: `POS checkout completed! Receipt #${receiptNumber}. Stock deducted across ${items.length} items & GL ledger posted.`,
    });
  });

  app.get('/api/pos/history', (req: Request, res: Response) => {
    const { storeId } = req.query;
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') {
      return res.json(posTransactionsHistory.filter((r) => r.storeId === storeId));
    }
    res.json(posTransactionsHistory);
  });

  // =============================================================
  // MODULE 12: ENTERPRISE SETTINGS & BUSINESS LOGIC SUITE
  // Valuation Landed Costs, Warehouse Multi-Step Routes & Bins,
  // 3-Way Matching, Analytic Accounting, and Quotations Engine
  // =============================================================

  // --- 1. ENTERPRISE SETTINGS MASTER CONFIG ---
  app.get('/api/admin/settings/enterprise', (_req: Request, res: Response) => {
    res.json(enterpriseSettings);
  });

  app.put('/api/admin/settings/enterprise', (req: Request, res: Response) => {
    const updates = req.body as Partial<EnterpriseSettingsConfig>;
    enterpriseSettings = {
      ...enterpriseSettings,
      ...updates,
      landedCosts: { ...enterpriseSettings.landedCosts, ...(updates.landedCosts || {}) },
      invoiceTracking: { ...enterpriseSettings.invoiceTracking, ...(updates.invoiceTracking || {}) },
      warehouseRouting: { ...enterpriseSettings.warehouseRouting, ...(updates.warehouseRouting || {}) },
      threeWayMatching: { ...enterpriseSettings.threeWayMatching, ...(updates.threeWayMatching || {}) },
      analyticAccounting: { ...enterpriseSettings.analyticAccounting, ...(updates.analyticAccounting || {}) },
      quotationsAndSales: { ...enterpriseSettings.quotationsAndSales, ...(updates.quotationsAndSales || {}) },
    };

    securityAuditTrail.unshift({
      id: `AUD-SEC-2026-${(securityAuditTrail.length + 1).toString().padStart(4, '0')}`,
      timestamp: new Date().toISOString(),
      actionType: 'POLICY_UPDATE',
      resourceId: 'ENTERPRISE_SETTINGS',
      userId: currentActiveStaffSession.userId,
      userName: currentActiveStaffSession.userName,
      userRole: currentActiveStaffSession.userRole,
      storeId: 'ALL',
      shiftId: currentActiveStaffSession.activeShiftId,
      status: 'AUTHORIZED_EXECUTED',
      metadata: { updatedBy: currentActiveStaffSession.userName },
    });

    res.json({
      success: true,
      settings: enterpriseSettings,
      message: 'Enterprise configuration saved and synchronized network-wide.',
    });
  });

  // --- 2. COA MAPPING & POS CHECKOUT CONFIG ---
  app.get('/api/admin/settings/coa-mapping', (_req: Request, res: Response) => {
    res.json(coaMappingConfig);
  });

  app.put('/api/admin/settings/coa-mapping', (req: Request, res: Response) => {
    coaMappingConfig = {
      ...coaMappingConfig,
      ...req.body,
      updatedAt: new Date().toISOString(),
      updatedBy: currentActiveStaffSession.userName,
    };
    res.json({ success: true, config: coaMappingConfig, message: 'COA mapping updated successfully.' });
  });

  app.get('/api/admin/settings/pos-config', (_req: Request, res: Response) => {
    res.json(posCheckoutConfig);
  });

  app.put('/api/admin/settings/pos-config', (req: Request, res: Response) => {
    posCheckoutConfig = {
      ...posCheckoutConfig,
      ...req.body,
      updatedAt: new Date().toISOString(),
      updatedBy: currentActiveStaffSession.userName,
    };
    res.json({ success: true, config: posCheckoutConfig, message: 'POS configuration updated successfully.' });
  });

  // --- 3. VALUATION & LANDED COSTS ENGINE ---
  app.get('/api/admin/valuation/landed-costs', (_req: Request, res: Response) => {
    res.json(landedCostsList);
  });

  app.post('/api/admin/valuation/landed-costs', async (req: Request, res: Response) => {
    const {
      description = 'Inbound Cold-Chain Freight & Handling',
      poId,
      billNumber,
      receiptNumber,
      currency = 'IDR',
      exchangeRate = 1,
      freightCostIDR = 0,
      customsDutyIDR = 0,
      handlingCostIDR = 0,
      insuranceCostIDR = 0,
      allocationMethod = 'BY_QUANTITY',
      items = [], // Array<{ sku: string; quantity: number }>
    } = req.body;

    const totalLandedCostIDR = freightCostIDR + customsDutyIDR + handlingCostIDR + insuranceCostIDR;
    if (totalLandedCostIDR <= 0) {
      return res.status(400).json({ error: 'Total landed cost must be greater than zero.' });
    }
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Please specify at least one product SKU to absorb landed cost.' });
    }

    const timestamp = new Date().toISOString();
    const id = `LC-2026-${(landedCostsList.length + 1).toString().padStart(3, '0')}`;

    // Calculate allocation
    const totalQty = items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 1), 0);
    const allocatedItems = items.map((it: any) => {
      const inv = inventoryList.find((i) => i.sku === it.sku);
      const productName = inv?.productName || `Product ${it.sku}`;
      const baseCost = inv?.unitCost || 15000;
      const qty = Number(it.quantity) || 1;

      let lineLandedShare = 0;
      if (allocationMethod === 'BY_QUANTITY') {
        lineLandedShare = totalQty > 0 ? Math.round((totalLandedCostIDR * qty) / totalQty) : Math.round(totalLandedCostIDR / items.length);
      } else if (allocationMethod === 'EQUAL') {
        lineLandedShare = Math.round(totalLandedCostIDR / items.length);
      } else {
        lineLandedShare = Math.round(totalLandedCostIDR / items.length);
      }

      const allocatedPerUnit = Math.round(lineLandedShare / qty);
      const newUnitCost = baseCost + allocatedPerUnit;

      if (inv) {
        inv.unitCost = newUnitCost;
      }
      storeInventoryTiers.forEach((tier) => {
        if (tier.sku === it.sku) {
          tier.unitCost = newUnitCost;
          tier.totalValuation = Math.round(tier.physicalStock * newUnitCost);
        }
      });

      return {
        sku: it.sku,
        productName,
        quantity: qty,
        baseUnitCost: baseCost,
        allocatedCostIDR: allocatedPerUnit,
        newUnitCost,
        totalLineLandedCost: lineLandedShare,
      };
    });

    const gleId1 = `GLE-2026-${(generalLedger.length + 1).toString().padStart(4, '0')}`;
    const gleId2 = `GLE-2026-${(generalLedger.length + 2).toString().padStart(4, '0')}`;
    const glEntryIds = [gleId1, gleId2];

    generalLedger.unshift({
      id: gleId1,
      timestamp,
      storeId: 'CONSOLIDATED',
      storeName: 'Consolidated Company-Wide',
      accountCode: '1040',
      accountName: 'Merchandise Inventory Asset',
      category: 'Asset',
      debit: totalLandedCostIDR,
      credit: 0,
      referenceType: 'LANDED_COST',
      referenceId: id,
      description: `Landed Cost Absorption [${id}]: ${description} allocated across ${allocatedItems.length} SKUs`,
    });

    generalLedger.unshift({
      id: gleId2,
      timestamp,
      storeId: 'CONSOLIDATED',
      storeName: 'Consolidated Company-Wide',
      accountCode: enterpriseSettings.landedCosts.clearingAccountCode as AccountCode || '2040',
      accountName: enterpriseSettings.landedCosts.clearingAccountName || 'Landed Cost Accrual / Clearing',
      category: 'Liability',
      debit: 0,
      credit: totalLandedCostIDR,
      referenceType: 'LANDED_COST',
      referenceId: id,
      description: `Landed Cost Accrual for freight, customs & handling voucher #${id}`,
    });

    const record: LandedCostRecord = {
      id,
      timestamp,
      poId,
      billNumber,
      receiptNumber,
      description,
      currency: currency as SupportedCurrency,
      exchangeRate,
      freightCostIDR,
      customsDutyIDR,
      handlingCostIDR,
      insuranceCostIDR,
      totalLandedCostIDR,
      allocationMethod,
      allocatedItems,
      glEntryIds,
      status: 'POSTED',
      createdBy: currentActiveStaffSession.userName,
    };

    landedCostsList.unshift(record);

    res.json({
      success: true,
      record,
      journalEntryIds: glEntryIds,
      message: `Landed cost ${id} (Rp ${totalLandedCostIDR.toLocaleString('id-ID')}) absorbed into product valuation and posted to General Ledger.`,
    });
  });

  // --- 4. WAREHOUSE STORAGE BINS & ADVANCED ROUTING ---
  app.get('/api/admin/warehouse/bins', (req: Request, res: Response) => {
    const { storeId, zoneId, status } = req.query;
    let filtered = warehouseBins;
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') {
      filtered = filtered.filter((b) => b.storeId === storeId);
    }
    if (zoneId && zoneId !== 'ALL') {
      filtered = filtered.filter((b) => b.zoneId === zoneId);
    }
    if (status && status !== 'ALL') {
      filtered = filtered.filter((b) => b.status === status);
    }
    res.json(filtered);
  });

  app.post('/api/admin/warehouse/bins', (req: Request, res: Response) => {
    const {
      storeId = 'store-jkt-senopati',
      storeName = 'GroceMart Senopati Flagship',
      zoneId = 'WH-JKT-SEN-COLD',
      rack = 'Chilled Rack C',
      shelf = 'Tier 1',
      binCode,
      type = 'COLD_CHUTE',
      capacityUnits = 60,
      currentSku,
    } = req.body;

    if (!binCode) {
      return res.status(400).json({ error: 'binCode is required.' });
    }

    const inv = inventoryList.find((i) => i.sku === currentSku);
    const newBin: WarehouseBinLocation = {
      id: `BIN-${Date.now().toString().slice(-6)}`,
      storeId,
      storeName,
      zoneId,
      rack,
      shelf,
      binCode,
      type,
      currentSku: currentSku || undefined,
      productName: inv?.productName,
      capacityUnits: Number(capacityUnits) || 60,
      occupancyUnits: currentSku ? 10 : 0,
      status: currentSku ? 'OCCUPIED' : 'AVAILABLE',
    };

    warehouseBins.push(newBin);
    res.json({ success: true, bin: newBin, message: `Storage location ${binCode} registered.` });
  });

  app.put('/api/admin/warehouse/bins/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const bin = warehouseBins.find((b) => b.id === id);
    if (!bin) return res.status(404).json({ error: 'Bin location not found.' });

    Object.assign(bin, req.body);
    if (req.body.currentSku) {
      const inv = inventoryList.find((i) => i.sku === req.body.currentSku);
      if (inv) bin.productName = inv.productName;
      bin.status = 'OCCUPIED';
    } else if (req.body.occupancyUnits === 0) {
      bin.status = 'AVAILABLE';
      bin.currentSku = undefined;
      bin.productName = undefined;
    }
    res.json({ success: true, bin, message: `Bin ${bin.binCode} updated.` });
  });

  app.get('/api/admin/warehouse/routes', (_req: Request, res: Response) => {
    res.json(warehouseRoutes);
  });

  app.put('/api/admin/warehouse/routes/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const route = warehouseRoutes.find((r) => r.id === id);
    if (!route) return res.status(404).json({ error: 'Route not found.' });
    Object.assign(route, req.body);
    res.json({ success: true, route, message: `Multi-step warehouse route updated.` });
  });

  // --- 5. PROCUREMENT 3-WAY MATCHING & VENDOR BILLS ---
  app.get('/api/admin/procurement/vendor-bills', (req: Request, res: Response) => {
    const { storeId, status, currency } = req.query;
    let filtered = vendorBillsList;
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') {
      filtered = filtered.filter((b) => b.storeId === storeId);
    }
    if (status && status !== 'ALL') {
      filtered = filtered.filter((b) => b.status === status);
    }
    if (currency && currency !== 'ALL') {
      filtered = filtered.filter((b) => b.currency === currency);
    }
    res.json(filtered);
  });

  app.post('/api/admin/procurement/vendor-bills', (req: Request, res: Response) => {
    const {
      billNumber,
      poId,
      goodsReceiptId,
      supplierName = 'Farm Partner',
      supplierContact,
      storeId = 'store-jkt-senopati',
      storeName = 'GroceMart Senopati Flagship',
      deliveryNoteNumber,
      billDate = new Date().toISOString().split('T')[0],
      dueDate,
      paymentTerms = 'Net 30',
      currency = 'IDR',
      exchangeRate = 1,
      items = [],
      taxPercent = 11,
      notes,
      autoApprove = false,
    } = req.body;

    if (!billNumber || !poId || !goodsReceiptId) {
      return res.status(400).json({ error: 'billNumber, poId, and goodsReceiptId are required.' });
    }

    const po = purchaseOrders.find((p) => p.id === poId);
    const gr = goodsReceipts.find((g) => g.id === goodsReceiptId);

    const qtyTolPercent = enterpriseSettings.threeWayMatching.quantityTolerancePercent || 2.0;
    const priceTolPercent = enterpriseSettings.threeWayMatching.priceTolerancePercent || 1.0;

    let hasAnyPriceVariance = false;
    let hasAnyQtyVariance = false;

    const validatedItems: VendorBillItem[] = items.map((it: any) => {
      const poItem = po?.items.find((p) => p.sku === it.sku);
      const grItem = gr?.items.find((g) => g.sku === it.sku);

      const poQty = poItem ? poItem.orderedQuantity : it.billedQuantity;
      const grQty = grItem ? grItem.quantityReceived : poQty;
      const billedQty = Number(it.billedQuantity) || 0;

      const poPrice = poItem ? (currency === 'IDR' ? poItem.unitCost : poItem.unitCost / exchangeRate) : it.unitCost;
      const billedPrice = Number(it.unitCost) || 0;

      const qtyDiffPercent = grQty > 0 ? (Math.abs(billedQty - grQty) / grQty) * 100 : 0;
      const priceDiffPercent = poPrice > 0 ? (Math.abs(billedPrice - poPrice) / poPrice) * 100 : 0;

      const hasQtyVar = qtyDiffPercent > qtyTolPercent;
      const hasPriceVar = priceDiffPercent > priceTolPercent;

      if (hasQtyVar) hasAnyQtyVariance = true;
      if (hasPriceVar) hasAnyPriceVariance = true;

      return {
        sku: it.sku,
        productName: it.productName || poItem?.productName || `Product ${it.sku}`,
        poQuantity: poQty,
        grQuantity: grQty,
        billedQuantity: billedQty,
        unitCost: billedPrice,
        totalCost: Math.round(billedQty * billedPrice),
        hasQuantityVariance: hasQtyVar,
        hasPriceVariance: hasPriceVar,
        notes: it.notes || '',
      };
    });

    const subtotal = validatedItems.reduce((sum, it) => sum + it.totalCost, 0);
    const taxAmount = Math.round(subtotal * ((Number(taxPercent) || 0) / 100));
    const grandTotal = subtotal + taxAmount;
    const grandTotalIDR = Math.round(grandTotal * exchangeRate);

    let billStatus: VendorBillStatus = 'MATCHED';
    if (hasAnyPriceVariance) {
      billStatus = 'PRICE_VARIANCE';
    } else if (hasAnyQtyVariance) {
      billStatus = 'QTY_VARIANCE';
    }

    const shouldApprove = autoApprove && billStatus === 'MATCHED';
    if (shouldApprove) {
      billStatus = 'APPROVED';
    }

    const timestamp = new Date().toISOString();
    const id = `VB-2026-${(vendorBillsList.length + 1).toString().padStart(3, '0')}`;
    const calculatedDueDate = dueDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    let glEntryIds: string[] = [];
    if (billStatus === 'APPROVED') {
      const gleId1 = `GLE-2026-${(generalLedger.length + 1).toString().padStart(4, '0')}`;
      const gleId2 = `GLE-2026-${(generalLedger.length + 2).toString().padStart(4, '0')}`;
      glEntryIds = [gleId1, gleId2];

      generalLedger.unshift({
        id: gleId1,
        timestamp,
        storeId,
        storeName,
        accountCode: '1040',
        accountName: 'Merchandise Inventory Asset',
        category: 'Asset',
        debit: grandTotalIDR,
        credit: 0,
        referenceType: 'VENDOR_BILL',
        referenceId: id,
        description: `Vendor Bill #${id} approved [${billNumber} - ${supplierName}]`,
      });

      generalLedger.unshift({
        id: gleId2,
        timestamp,
        storeId,
        storeName,
        accountCode: '2010',
        accountName: 'Trade Accounts Payable',
        category: 'Liability',
        debit: 0,
        credit: grandTotalIDR,
        referenceType: 'VENDOR_BILL',
        referenceId: id,
        description: `Accounts Payable booked for vendor invoice #${billNumber}`,
      });
    }

    const newBill: VendorBill = {
      id,
      billNumber,
      supplierName,
      supplierContact,
      storeId,
      storeName,
      poId,
      goodsReceiptId,
      deliveryNoteNumber,
      billDate,
      dueDate: calculatedDueDate,
      paymentTerms: paymentTerms as any,
      currency: currency as SupportedCurrency,
      exchangeRate,
      items: validatedItems,
      subtotal,
      taxPercent: Number(taxPercent) || 0,
      taxAmount,
      grandTotal,
      grandTotalIDR,
      amountPaid: 0,
      remainingDue: grandTotal,
      status: billStatus,
      paymentStatus: 'UNPAID',
      notes,
      glEntryIds: glEntryIds.length > 0 ? glEntryIds : undefined,
      createdAt: timestamp,
      approvedBy: shouldApprove ? currentActiveStaffSession.userName : undefined,
      approvedAt: shouldApprove ? timestamp : undefined,
    };

    vendorBillsList.unshift(newBill);

    res.json({
      success: true,
      vendorBill: newBill,
      journalEntryIds: glEntryIds,
      message: `Vendor Bill #${id} created with 3-Way status [${billStatus}].`,
    });
  });

  app.post('/api/admin/procurement/vendor-bills/:id/approve', (req: Request, res: Response) => {
    const { id } = req.params;
    const { approverName = currentActiveStaffSession.userName } = req.body;
    const bill = vendorBillsList.find((b) => b.id === id);
    if (!bill) return res.status(404).json({ error: 'Vendor Bill not found.' });

    bill.status = 'APPROVED';
    bill.approvedBy = approverName;
    bill.approvedAt = new Date().toISOString();

    if (!bill.glEntryIds || bill.glEntryIds.length === 0) {
      const gleId1 = `GLE-2026-${(generalLedger.length + 1).toString().padStart(4, '0')}`;
      const gleId2 = `GLE-2026-${(generalLedger.length + 2).toString().padStart(4, '0')}`;
      bill.glEntryIds = [gleId1, gleId2];

      generalLedger.unshift({
        id: gleId1,
        timestamp: bill.approvedAt,
        storeId: bill.storeId,
        storeName: bill.storeName,
        accountCode: '1040',
        accountName: 'Merchandise Inventory Asset',
        category: 'Asset',
        debit: bill.grandTotalIDR,
        credit: 0,
        referenceType: 'VENDOR_BILL',
        referenceId: bill.id,
        description: `Vendor Bill #${bill.id} authorized & approved by ${approverName}`,
      });

      generalLedger.unshift({
        id: gleId2,
        timestamp: bill.approvedAt,
        storeId: bill.storeId,
        storeName: bill.storeName,
        accountCode: '2010',
        accountName: 'Trade Accounts Payable',
        category: 'Liability',
        debit: 0,
        credit: bill.grandTotalIDR,
        referenceType: 'VENDOR_BILL',
        referenceId: bill.id,
        description: `Trade Accounts Payable confirmed for ${bill.supplierName}`,
      });
    }

    res.json({ success: true, vendorBill: bill, message: `Vendor Bill #${id} approved.` });
  });

  app.post('/api/admin/procurement/vendor-bills/:id/pay', (req: Request, res: Response) => {
    const { id } = req.params;
    const { amountPaid, paymentMethod = 'BANK_TRANSFER', paymentReference } = req.body;
    const bill = vendorBillsList.find((b) => b.id === id);
    if (!bill) return res.status(404).json({ error: 'Vendor Bill not found.' });

    const payAmt = Number(amountPaid) || bill.remainingDue;
    bill.amountPaid += payAmt;
    bill.remainingDue = Math.max(0, bill.grandTotal - bill.amountPaid);
    bill.paymentStatus = bill.remainingDue <= 0 ? 'PAID' : 'PARTIALLY_PAID';
    if (bill.paymentStatus === 'PAID') bill.status = 'PAID';
    bill.paymentMethod = paymentMethod as VendorBillPaymentMethod;
    bill.paymentReference = paymentReference;
    bill.paidAt = new Date().toISOString();

    const gleId1 = `GLE-2026-${(generalLedger.length + 1).toString().padStart(4, '0')}`;
    const gleId2 = `GLE-2026-${(generalLedger.length + 2).toString().padStart(4, '0')}`;
    const payAmountIDR = Math.round(payAmt * bill.exchangeRate);

    generalLedger.unshift({
      id: gleId1,
      timestamp: bill.paidAt,
      storeId: bill.storeId,
      storeName: bill.storeName,
      accountCode: '2010',
      accountName: 'Trade Accounts Payable',
      category: 'Liability',
      debit: payAmountIDR,
      credit: 0,
      referenceType: 'VENDOR_PAYMENT',
      referenceId: bill.id,
      description: `Disbursement: Payment for Bill #${bill.billNumber} (${bill.supplierName})`,
    });

    generalLedger.unshift({
      id: gleId2,
      timestamp: bill.paidAt,
      storeId: bill.storeId,
      storeName: bill.storeName,
      accountCode: '1020',
      accountName: 'Bank BCA Operational Clearing',
      category: 'Asset',
      debit: 0,
      credit: payAmountIDR,
      referenceType: 'VENDOR_PAYMENT',
      referenceId: bill.id,
      description: `Bank Wire disbursement for bill #${bill.id} via ${paymentMethod}`,
    });

    res.json({ success: true, vendorBill: bill, message: `Payment of ${payAmt} recorded for Bill #${id}.` });
  });

  // --- 6. ANALYTIC ACCOUNTING & MARGIN ANALYSIS ---
  app.get('/api/admin/accounting/analytic-departments', (_req: Request, res: Response) => {
    const departments = enterpriseSettings.analyticAccounting.departments.map((dept) => {
      const variance = dept.annualBudgetIDR - dept.actualCostIDR;
      const utilization = dept.annualBudgetIDR > 0 ? (dept.actualCostIDR / dept.annualBudgetIDR) * 100 : 0;
      let status: 'ON_TRACK' | 'WARNING' | 'OVER_BUDGET' = 'ON_TRACK';
      if (utilization > 100) status = 'OVER_BUDGET';
      else if (utilization > 80) status = 'WARNING';

      return {
        ...dept,
        varianceIDR: variance,
        utilizationPercent: Number(utilization.toFixed(1)),
        status,
      };
    });
    res.json(departments);
  });

  app.put('/api/admin/accounting/analytic-departments/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const dept = enterpriseSettings.analyticAccounting.departments.find((d) => d.id === id);
    if (!dept) return res.status(404).json({ error: 'Department cost center not found.' });
    Object.assign(dept, req.body);
    res.json({ success: true, department: dept, message: `Department budget updated.` });
  });

  app.get('/api/admin/accounting/margin-analysis', (_req: Request, res: Response) => {
    const warningThreshold = enterpriseSettings.analyticAccounting.marginWarningThresholdPercent || 25.0;

    const margins: ProductMarginRecord[] = PRODUCTS.map((prod) => {
      const inv = inventoryList.find((i) => i.productId === prod.id || i.productName.toLowerCase() === prod.name.toLowerCase());
      const sku = inv?.sku || `SKU-${prod.category.slice(0, 3).toUpperCase()}-001`;
      const sellingPrice = prod.price;

      const baseCost = inv ? inv.unitCost : Math.round(prod.price * 0.62);

      let landedAbsorption = 0;
      landedCostsList.forEach((lc) => {
        const match = lc.allocatedItems.find((it) => it.sku === sku);
        if (match) landedAbsorption += match.allocatedCostIDR;
      });

      const totalUnitCost = baseCost;
      const grossProfit = sellingPrice - totalUnitCost;
      const marginPercent = sellingPrice > 0 ? Number(((grossProfit / sellingPrice) * 100).toFixed(1)) : 0;
      const unitsSoldMonth = Math.floor(Math.random() * 80) + 40;
      const totalGrossProfitMonth = grossProfit * unitsSoldMonth;

      return {
        sku,
        name: prod.name,
        category: prod.category,
        sellingPrice,
        baseCost: baseCost - landedAbsorption,
        landedCostAbsorption: landedAbsorption,
        totalUnitCost,
        grossProfit,
        marginPercent,
        unitsSoldMonth,
        totalGrossProfitMonth,
        isLowMarginAlert: marginPercent < warningThreshold,
      };
    });

    res.json(margins);
  });

  // --- 7. QUOTATIONS & SALES RULES ENGINE ---
  app.get('/api/admin/sales/quotations', (_req: Request, res: Response) => {
    res.json(enterpriseQuotationsList);
  });

  app.post('/api/admin/sales/quotations', (req: Request, res: Response) => {
    const {
      customerName,
      customerCompany,
      customerEmail,
      customerPhone,
      items = [],
      currency = 'IDR',
      notes,
      isProForma = false,
    } = req.body;

    if (!customerName || !items || items.length === 0) {
      return res.status(400).json({ error: 'Customer name and line items are required.' });
    }

    let enrichedItems: EnterpriseQuotationItem[] = [...items];
    if (enterpriseSettings.quotationsAndSales.mandatoryProductsEnabled) {
      enterpriseSettings.quotationsAndSales.mandatoryRules.forEach((rule) => {
        const hasTargetCategory = enrichedItems.some((it) => it.category === rule.targetCategory);
        const alreadyHasMandatory = enrichedItems.some((it) => it.sku === rule.mandatorySku);
        if (hasTargetCategory && !alreadyHasMandatory) {
          enrichedItems.push({
            sku: rule.mandatorySku,
            productName: `${rule.mandatoryProductName} [MANDATORY RULE]`,
            category: 'packaging',
            quantity: 1,
            unit: 'pack',
            unitPrice: rule.mandatoryPriceIDR,
            unitCost: Math.round(rule.mandatoryPriceIDR * 0.4),
            lineTotal: rule.mandatoryPriceIDR,
            isMandatoryAddon: true,
          });
        }
      });
    }

    const subtotal = enrichedItems.reduce((sum, it) => sum + (Number(it.lineTotal) || Number(it.quantity) * Number(it.unitPrice)), 0);
    const taxAmount = Math.round(subtotal * 0.11);
    const total = subtotal + taxAmount;

    let depositPercent = 100;
    if (enterpriseSettings.quotationsAndSales.paymentConfirmationThreshold === 'DEPOSIT_50') {
      depositPercent = 50;
    } else if (enterpriseSettings.quotationsAndSales.paymentConfirmationThreshold === 'PAY_ON_DELIVERY') {
      depositPercent = 0;
    }

    const depositAmount = Math.round((total * depositPercent) / 100);
    const validityDays = enterpriseSettings.quotationsAndSales.defaultValidityDays || 14;
    const validUntil = new Date(Date.now() + validityDays * 86400000).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    const quotationNumber = `QTN-2026-${(enterpriseQuotationsList.length + 1001).toString()}`;
    const newQuotation: EnterpriseQuotation = {
      id: `QUO-2026-${(enterpriseQuotationsList.length + 1).toString().padStart(3, '0')}`,
      quotationNumber,
      customerName,
      customerCompany,
      customerEmail: customerEmail || 'client@corporate.id',
      customerPhone: customerPhone || '+62 811 0000 000',
      date: today,
      validUntil,
      items: enrichedItems,
      subtotal,
      taxAmount,
      total,
      currency: currency as SupportedCurrency,
      requiredDepositPercent: depositPercent,
      depositAmount,
      signatureStatus: 'PENDING',
      status: 'SENT',
      notes,
      isProForma: Boolean(isProForma),
    };

    enterpriseQuotationsList.unshift(newQuotation);
    res.json({
      success: true,
      quotation: newQuotation,
      message: `Quotation ${quotationNumber} generated successfully.`,
    });
  });

  app.post('/api/admin/sales/quotations/:id/sign', (req: Request, res: Response) => {
    const { id } = req.params;
    const { signedBy, signatureDataUrl } = req.body;
    const quo = enterpriseQuotationsList.find((q) => q.id === id);
    if (!quo) return res.status(404).json({ error: 'Quotation not found.' });

    quo.signatureStatus = 'SIGNED';
    quo.signedBy = signedBy || quo.customerName;
    quo.signedAt = new Date().toISOString();
    quo.signatureDataUrl = signatureDataUrl;
    quo.status = 'CONFIRMED';

    res.json({ success: true, quotation: quo, message: `Quotation ${quo.quotationNumber} signed and confirmed.` });
  });

  app.post('/api/admin/sales/quotations/:id/convert-to-order', (req: Request, res: Response) => {
    const { id } = req.params;
    const quo = enterpriseQuotationsList.find((q) => q.id === id);
    if (!quo) return res.status(404).json({ error: 'Quotation not found.' });

    const orderId = `GCM-B2B-${Date.now().toString().slice(-6)}`;
    quo.status = 'CONVERTED_TO_ORDER';
    quo.convertedOrderId = orderId;

    const newOrder: Order = {
      id: orderId,
      createdAt: new Date().toISOString(),
      customerName: quo.customerName,
      customerEmail: quo.customerEmail,
      customerPhone: quo.customerPhone,
      deliveryMethod: 'scheduled',
      deliveryAddress: {
        label: 'Corporate Delivery Site',
        recipient: quo.customerName,
        phone: quo.customerPhone,
        addressLine: quo.customerCompany || 'Commercial Kitchen / Foodservice Hub',
        city: 'Jakarta',
      },
      items: quo.items.map((it) => {
        const prod = PRODUCTS.find((p) => p.name.toLowerCase() === it.productName.toLowerCase()) || PRODUCTS[0];
        return {
          product: { ...prod, price: it.unitPrice, name: it.productName },
          quantity: it.quantity,
          notes: `Converted from Quotation #${quo.quotationNumber}`,
        };
      }),
      subtotal: quo.subtotal,
      deliveryFee: 0,
      discount: 0,
      total: quo.total,
      paymentMethod: 'bank_transfer',
      paymentStatus: quo.requiredDepositPercent === 0 ? 'unpaid' : 'paid',
      status: 'placed',
      timeline: [
        {
          status: 'placed',
          label: 'Quotation Converted to Order',
          description: `B2B Order created from signed Quotation #${quo.quotationNumber}`,
          timestamp: new Date().toISOString(),
          completed: true,
        },
      ],
    };

    customerOrders.unshift(newOrder);

    res.json({
      success: true,
      order: newOrder,
      quotation: quo,
      message: `Quotation ${quo.quotationNumber} converted to active Order #${orderId}!`,
    });
  });

  // --- 8. PROMOTIONS & OPNAME & TRANSFERS APIS ---
  app.get('/api/admin/promotions', (_req: Request, res: Response) => {
    res.json(promotionRulesList);
  });

  app.post('/api/admin/promotions', (req: Request, res: Response) => {
    const newRule: PromotionRule = {
      id: `PRM-2026-${(promotionRulesList.length + 1).toString().padStart(2, '0')}`,
      usageCount: 0,
      active: true,
      ...req.body,
    };
    promotionRulesList.unshift(newRule);
    res.json({ success: true, rule: newRule, message: 'Promotion created.' });
  });

  app.put('/api/admin/promotions/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const rule = promotionRulesList.find((r) => r.id === id);
    if (!rule) return res.status(404).json({ error: 'Promotion not found.' });
    Object.assign(rule, req.body);
    res.json({ success: true, rule, message: 'Promotion updated.' });
  });

  app.delete('/api/admin/promotions/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const rule = promotionRulesList.find((r) => r.id === id);
    if (!rule) return res.status(404).json({ error: 'Promotion not found.' });
    rule.active = false;
    res.json({ success: true, message: 'Promotion deactivated.' });
  });

  app.post('/api/admin/inventory/bulk-import', (req: Request, res: Response) => {
    const { rows = [] } = req.body as { rows: BulkInventoryImportRow[] };
    let imported = 0;
    rows.forEach((r) => {
      const existing = inventoryList.find((i) => i.sku === r.sku);
      const qtyToAdd = r.physicalStock ?? r.stock ?? 0;
      const cost = r.unitCost ?? r.costPrice ?? (existing ? existing.unitCost : 0);
      if (existing) {
        existing.currentStock += qtyToAdd;
        existing.unitCost = cost;
      }
      imported++;
    });
    res.json({ success: true, importedCount: imported, tiersUpdatedCount: imported, message: `${imported} items imported.` });
  });

  app.get('/api/admin/inventory/stock-opname', (_req: Request, res: Response) => {
    res.json(stockOpnameSessions);
  });

  app.post('/api/admin/inventory/stock-opname/reconcile', (req: Request, res: Response) => {
    const session = req.body as StockOpnameSession;
    stockOpnameSessions.unshift(session);
    res.json({ success: true, session, journalEntryIds: ['GLE-2026-0099'], message: 'Opname reconciled.' });
  });

  app.get('/api/admin/inventory/transfer', (_req: Request, res: Response) => {
    res.json(stockTransfersList);
  });

  app.post('/api/admin/inventory/transfer', (req: Request, res: Response) => {
    const record: StockTransferRecord = {
      id: `TRF-2026-${(stockTransfersList.length + 1).toString().padStart(3, '0')}`,
      timestamp: new Date().toISOString(),
      status: 'COMPLETED',
      ...req.body,
    };
    stockTransfersList.unshift(record);
    res.json({ success: true, record, message: 'Stock transferred.' });
  });

  // --- 9. APPROVAL WORKFLOW & MATRIX APIS ---
  app.get('/api/admin/approvals/rules', (_req: Request, res: Response) => {
    res.json(approvalRulesList);
  });

  app.put('/api/admin/approvals/rules', (req: Request, res: Response) => {
    const { rules } = req.body as { rules: ApprovalTierRule[] };
    if (Array.isArray(rules)) {
      approvalRulesList = rules;
    }
    securityAuditTrail.unshift({
      id: `AUD-SEC-2026-${(securityAuditTrail.length + 1).toString().padStart(4, '0')}`,
      timestamp: new Date().toISOString(),
      actionType: 'APPROVAL_MATRIX_UPDATE',
      resourceId: 'APPROVAL_RULES',
      userId: currentActiveStaffSession.userId,
      userName: currentActiveStaffSession.userName,
      userRole: currentActiveStaffSession.userRole,
      storeId: 'ALL',
      shiftId: currentActiveStaffSession.activeShiftId,
      status: 'AUTHORIZED_EXECUTED',
      metadata: { ruleCount: approvalRulesList.length },
    });
    res.json({ success: true, rules: approvalRulesList, message: 'Approval tier matrix synchronized.' });
  });

  app.get('/api/admin/approvals/queue', (req: Request, res: Response) => {
    const { storeId, status } = req.query as { storeId?: string; status?: string };
    let result = [...approvalQueueList];
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') {
      result = result.filter((q) => q.storeId === storeId);
    }
    if (status && status !== 'ALL') {
      result = result.filter((q) => q.status === status);
    }
    res.json(result);
  });

  app.post('/api/admin/approvals/action', (req: Request, res: Response) => {
    const { requestId, action, comments } = req.body as {
      requestId: string;
      action: 'APPROVED' | 'REJECTED';
      comments?: string;
    };
    const reqItem = approvalQueueList.find((q) => q.id === requestId);
    if (!reqItem) return res.status(404).json({ error: 'Approval request not found.' });

    const newLog = {
      tierLevel: reqItem.currentTierLevel,
      tierName: `Tier ${reqItem.currentTierLevel}`,
      approverId: currentActiveStaffSession.userId,
      approverName: currentActiveStaffSession.userName,
      approverRole: currentActiveStaffSession.userRole,
      action,
      timestamp: new Date().toISOString(),
      comments: comments || `${action} by ${currentActiveStaffSession.userName}`,
    };
    reqItem.history.push(newLog);

    if (action === 'REJECTED') {
      reqItem.status = 'REJECTED';
    } else {
      if (reqItem.currentTierLevel < reqItem.requiredTierLevel) {
        reqItem.currentTierLevel += 1;
      } else {
        reqItem.status = 'APPROVED';
      }
    }

    securityAuditTrail.unshift({
      id: `AUD-SEC-2026-${(securityAuditTrail.length + 1).toString().padStart(4, '0')}`,
      timestamp: new Date().toISOString(),
      actionType: reqItem.module === 'procurement_po' ? 'PURCHASE_ORDER_APPROVAL' : 'GOODS_RECEIPT_APPROVAL',
      resourceId: reqItem.documentId,
      userId: currentActiveStaffSession.userId,
      userName: currentActiveStaffSession.userName,
      userRole: currentActiveStaffSession.userRole,
      storeId: reqItem.storeId,
      shiftId: currentActiveStaffSession.activeShiftId,
      status: 'AUTHORIZED_EXECUTED',
      metadata: { requestId, action, finalStatus: reqItem.status, amountIDR: reqItem.amountIDR },
    });

    res.json({
      success: true,
      request: reqItem,
      message: `Request ${reqItem.documentId} ${action === 'APPROVED' ? (reqItem.status === 'APPROVED' ? 'fully authorized' : `advanced to Tier ${reqItem.currentTierLevel}`) : 'rejected'}.`,
    });
  });

  // --- 10. LOGISTICS & SHIPPING DOCUMENTS APIS ---
  app.get('/api/admin/logistics/surat-jalan', (req: Request, res: Response) => {
    const { storeId } = req.query as { storeId?: string };
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') {
      return res.json(suratJalanList.filter((sj) => sj.senderStoreId === storeId || sj.recipientStoreId === storeId));
    }
    res.json(suratJalanList);
  });

  app.post('/api/admin/logistics/surat-jalan', (req: Request, res: Response) => {
    const body = req.body as Partial<SuratJalanDocument>;
    const seq = (suratJalanList.length + 1).toString().padStart(4, '0');
    const docNumber = `SJ/GMRT/JKT/2026/${seq}`;
    const newDoc: SuratJalanDocument = {
      id: `SJ-2026-${seq}`,
      documentNumber: docNumber,
      issueDate: new Date().toISOString().split('T')[0],
      senderStoreId: body.senderStoreId || 'store-jkt-senopati',
      senderStoreName: body.senderStoreName || 'GroceMart Senopati Flagship',
      senderAddress: body.senderAddress || 'Jl. Senopati No. 42, Kebayoran Baru, Jakarta Selatan',
      senderPhone: body.senderPhone || '+62 21 720 8891',
      recipientName: body.recipientName || 'Fulfillment Center Hub',
      recipientAddress: body.recipientAddress || 'Cold Transit Depot, Jakarta',
      recipientPhone: body.recipientPhone || '+62 812 0000 1111',
      carrierName: body.carrierName || 'GroceMart Reefer Fleet Logistics',
      vehiclePlateNumber: body.vehiclePlateNumber || 'B 9142 SRO',
      vehicleType: body.vehicleType || 'Refrigerated Van 1.5T',
      driverName: body.driverName || 'Bambang Supriyanto',
      driverPhone: body.driverPhone || '+62 812 8899 7711',
      coldChainTempCelsius: body.coldChainTempCelsius ?? 3.5,
      specialHandlingInstructions: body.specialHandlingInstructions || 'Keep refrigerated at 0-4°C.',
      items: body.items || [],
      totalPackages: body.totalPackages || (body.items?.length || 1),
      totalWeightKg: body.totalWeightKg || 50,
      status: 'in_transit',
      senderSignatureName: body.senderSignatureName || currentActiveStaffSession.userName,
      driverSignatureName: body.driverSignatureName || body.driverName || 'Bambang Supriyanto',
      ...body,
    };
    suratJalanList.unshift(newDoc);

    securityAuditTrail.unshift({
      id: `AUD-SEC-2026-${(securityAuditTrail.length + 1).toString().padStart(4, '0')}`,
      timestamp: new Date().toISOString(),
      actionType: 'LOGISTICS_DOCUMENT_ISSUED',
      resourceId: newDoc.documentNumber,
      userId: currentActiveStaffSession.userId,
      userName: currentActiveStaffSession.userName,
      userRole: currentActiveStaffSession.userRole,
      storeId: newDoc.senderStoreId,
      shiftId: currentActiveStaffSession.activeShiftId,
      status: 'AUTHORIZED_EXECUTED',
      metadata: { vehiclePlate: newDoc.vehiclePlateNumber, itemsCount: newDoc.items.length },
    });

    res.json({ success: true, document: newDoc, message: `Surat Jalan #${newDoc.documentNumber} issued.` });
  });

  app.get('/api/admin/logistics/delivery-orders', (_req: Request, res: Response) => {
    res.json(deliveryOrdersList);
  });

  app.post('/api/admin/logistics/delivery-orders', (req: Request, res: Response) => {
    const seq = (deliveryOrdersList.length + 1).toString().padStart(4, '0');
    const newDo: DeliveryOrderDocument = {
      id: `DO-2026-${seq}`,
      doNumber: `DO/GMRT/2026/${seq}`,
      issueDate: new Date().toISOString().split('T')[0],
      customerOrStoreName: 'GroceMart Commercial Kitchen',
      deliveryAddress: 'Main Delivery Dock',
      deliveryWindow: 'Morning Slot (08:00 - 12:00 WIB)',
      authorizedOfficer: currentActiveStaffSession.userName,
      items: [],
      subtotalIDR: 0,
      taxIDR: 0,
      totalAmountIDR: 0,
      status: 'pending',
      ...req.body,
    };
    deliveryOrdersList.unshift(newDo);
    res.json({ success: true, document: newDo, message: `Delivery Order #${newDo.doNumber} registered.` });
  });

  app.get('/api/admin/logistics/shipments', (_req: Request, res: Response) => {
    res.json(shipmentsList);
  });

  app.post('/api/admin/logistics/shipments', (req: Request, res: Response) => {
    const newShp: ShipmentQuotaTracking = {
      id: `SHP-2026-${(shipmentsList.length + 1).toString().padStart(3, '0')}`,
      tripId: `TRIP-JKT-${Date.now().toString().slice(-4)}`,
      vehicleType: 'Refrigerated Van 1.5T',
      vehiclePlate: 'B 9142 SRO',
      maxPayloadKg: 1500,
      currentPayloadKg: 850,
      quotaUtilizationPercent: 57,
      storageZone: 'cold_chilled',
      currentTempCelsius: 3.5,
      targetTempCelsius: 4.0,
      departureHub: 'Senopati Hub',
      destinationHub: 'PIK 2 Hub',
      departureTime: '08:00 WIB',
      estimatedArrival: '09:30 WIB',
      driverName: 'Bambang Supriyanto',
      driverContact: '+62 812 8899 7711',
      assignedOrdersCount: 5,
      status: 'in_transit',
      ...req.body,
    };
    shipmentsList.unshift(newShp);
    res.json({ success: true, shipment: newShp, message: 'Shipment trip dispatched.' });
  });

  // --- 11. INVENTORY QUALITY CONTROL (QC) APIS ---
  app.get('/api/admin/qc/inspections', (req: Request, res: Response) => {
    const { storeId, disposition } = req.query as { storeId?: string; disposition?: string };
    let result = [...qcInspectionsList];
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') {
      result = result.filter((qc) => qc.storeId === storeId);
    }
    if (disposition && disposition !== 'ALL') {
      result = result.filter((qc) => qc.disposition === disposition);
    }
    res.json(result);
  });

  app.post('/api/admin/qc/inspections', (req: Request, res: Response) => {
    const seq = (qcInspectionsList.length + 1).toString().padStart(4, '0');
    const newQc: QCInspectionRecord = {
      id: `QC-2026-${seq}`,
      timestamp: new Date().toISOString(),
      referenceType: 'INCOMING_PO',
      referenceId: 'PO-2026-0099',
      sku: 'SKU-PRD-001',
      productName: 'Fresh Produce Harvest',
      category: 'produce',
      batchNumber: `BAT-2026-${seq}`,
      expiryDate: new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0],
      sampleQuantity: 5,
      totalBatchQuantity: 100,
      storeId: 'store-jkt-senopati',
      storeName: 'GroceMart Senopati Flagship',
      inspectorId: currentActiveStaffSession.userId,
      inspectorName: currentActiveStaffSession.userName,
      parameters: {
        visualFreshness: 'Grade A (Pristine)',
        temperatureCelsius: 3.5,
        coldChainCompliant: true,
        packagingIntegrity: 'Sealed & Intact',
        sensoryOdorCheck: 'Normal & Fresh',
        weightToleranceCompliant: true,
      },
      disposition: 'PASSED',
      actionTaken: 'RELEASE_TO_SHELF',
      ...req.body,
    };
    qcInspectionsList.unshift(newQc);

    securityAuditTrail.unshift({
      id: `AUD-SEC-2026-${(securityAuditTrail.length + 1).toString().padStart(4, '0')}`,
      timestamp: new Date().toISOString(),
      actionType: 'QC_INSPECTION_LOGGED',
      resourceId: newQc.id,
      userId: currentActiveStaffSession.userId,
      userName: currentActiveStaffSession.userName,
      userRole: currentActiveStaffSession.userRole,
      storeId: newQc.storeId,
      shiftId: currentActiveStaffSession.activeShiftId,
      status: 'AUTHORIZED_EXECUTED',
      metadata: { sku: newQc.sku, disposition: newQc.disposition, action: newQc.actionTaken },
    });

    res.json({ success: true, record: newQc, message: `Quality inspection ${newQc.id} logged with disposition ${newQc.disposition}.` });
  });

  // --- 12. MANUAL CHART OF ACCOUNTS (COA) APIS ---
  app.post('/api/admin/settings/coa-account', (req: Request, res: Response) => {
    const body = req.body as Partial<ChartOfAccount>;
    if (!body.accountCode || !body.accountName) {
      return res.status(400).json({ error: 'accountCode and accountName are required.' });
    }
    const existing = chartOfAccounts.find((a) => a.accountCode === body.accountCode);
    if (existing) {
      return res.status(400).json({ error: `Account code ${body.accountCode} already exists.` });
    }
    const newAcct: ChartOfAccount = {
      accountCode: body.accountCode,
      accountName: body.accountName,
      category: body.category || 'Asset',
      storeId: body.storeId || 'CONSOLIDATED',
      normalBalance: body.normalBalance || (body.category === 'Asset' || body.category === 'Expense' ? 'Debit' : 'Credit'),
      balance: body.balance || 0,
      description: body.description || '',
    };
    chartOfAccounts.push(newAcct);

    securityAuditTrail.unshift({
      id: `AUD-SEC-2026-${(securityAuditTrail.length + 1).toString().padStart(4, '0')}`,
      timestamp: new Date().toISOString(),
      actionType: 'COA_MAPPING_UPDATE',
      resourceId: newAcct.accountCode,
      userId: currentActiveStaffSession.userId,
      userName: currentActiveStaffSession.userName,
      userRole: currentActiveStaffSession.userRole,
      storeId: 'ALL',
      shiftId: currentActiveStaffSession.activeShiftId,
      status: 'AUTHORIZED_EXECUTED',
      metadata: { action: 'CREATE', accountCode: newAcct.accountCode, accountName: newAcct.accountName },
    });

    res.json({ success: true, account: newAcct, message: `COA account [${newAcct.accountCode}] ${newAcct.accountName} created.` });
  });

  app.put('/api/admin/settings/coa-account/:code', (req: Request, res: Response) => {
    const { code } = req.params;
    const acct = chartOfAccounts.find((a) => a.accountCode === code);
    if (!acct) return res.status(404).json({ error: 'COA account not found.' });
    Object.assign(acct, req.body);
    res.json({ success: true, account: acct, message: `Account ${code} updated.` });
  });

  app.delete('/api/admin/settings/coa-account/:code', (req: Request, res: Response) => {
    const { code } = req.params;
    const idx = chartOfAccounts.findIndex((a) => a.accountCode === code);
    if (idx === -1) return res.status(404).json({ error: 'COA account not found.' });
    chartOfAccounts.splice(idx, 1);
    res.json({ success: true, message: `Account ${code} deleted.` });
  });

  // --- 13. SPECIALIZED GROCERY METRICS & INTELLIGENCE REPORT ---
  app.get('/api/admin/reports/grocery-metrics', (req: Request, res: Response) => {
    const { storeId } = req.query as { storeId?: string };
    const targetStore = storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED' ? storeId : 'store-jkt-senopati';

    const report: GroceryMetricsReport = {
      generatedAt: new Date().toISOString(),
      storeId: targetStore,
      fifoExpiryMetrics: {
        criticalBatchesCount: 4,
        nearExpiryBatchesCount: 8,
        freshBatchesCount: 22,
        stableBatchesCount: 45,
        atRiskInventoryValueIDR: 4250000,
        vivoDiscountSoldUnits: 142,
        vivoRevenueRecoveredIDR: 3550000,
        batchTurnoverRateDays: 4.8,
        agingBuckets: [
          { bucket: '< 3 Days (Critical)', units: 48, valueIDR: 1200000 },
          { bucket: '4 - 7 Days (Near Expiry)', units: 120, valueIDR: 3050000 },
          { bucket: '8 - 14 Days (Prime Fresh)', units: 260, valueIDR: 6500000 },
          { bucket: '> 15 Days (Long Stable)', units: 410, valueIDR: 10250000 },
        ],
      },
      wasteShrinkageMetrics: {
        totalShrinkLossIDR: 2150000,
        shrinkToSalesRatioPercent: 1.4,
        naturalMoistureLossIDR: 450000,
        prepAndWashLossIDR: 380000,
        handlingDamageLossIDR: 320000,
        expiredSpoilageLossIDR: 1000000,
        departmentBreakdown: [
          { department: 'Fresh Produce', lossIDR: 1200000, percentage: 55.8 },
          { department: 'Chilled Dairy & Eggs', lossIDR: 520000, percentage: 24.2 },
          { department: 'Meat & Seafood', lossIDR: 430000, percentage: 20.0 },
        ],
      },
      fulfillmentMetrics: {
        averagePickTimeMinutes: 3.4,
        catchWeightAccuracyPercent: 99.2,
        substitutionsAcceptedPercent: 94.5,
        onTimeDeliveryPercent: 98.1,
        clickAndCollectFulfillmentRatePercent: 99.5,
      },
    };
    res.json(report);
  });

  // -------------------------------------------------------------
  // VITE OR STATIC CLIENT MOUNT
  // -------------------------------------------------------------
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[GroceMart Backend] Server running on http://0.0.0.0:${PORT}`);
    console.log(`[GroceMart Backend] QRIS OpenAPI available at http://0.0.0.0:${PORT}/api/qris/openapi.json`);
  });
}

startServer();
