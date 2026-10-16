export interface StoreLocation {
  id: string;
  name: string;
  city: 'Jakarta' | 'Bandung' | 'Surabaya' | 'Bali' | 'Yogyakarta' | 'Medan';
  address: string;
  district: string;
  postalCode: string;
  phone: string;
  hours: string;
  isFlagship?: boolean;
  manager: string;
  establishedYear: number;
  amenities: string[];
  coordinates: {
    lat: number;
    lng: number;
  };
  pickupAvailable: boolean;
}

export interface Milestone {
  year: number;
  title: string;
  subtitle: string;
  description: string;
  metric?: string;
}

export type ProductCategory = 
  | 'produce'
  | 'bakery'
  | 'dairy_eggs'
  | 'meat_seafood'
  | 'pantry_coffee';

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  categoryLabel: string;
  price: number; // in IDR
  unit: string;
  origin: string;
  farmPartner?: string;
  isOrganic?: boolean;
  isFarmDirect?: boolean;
  rating: number;
  reviewCount: number;
  stock: number;
  description: string;
  image: string;
  fallbackGradient: string;
  storageTip?: string;
  nutritionHighlights?: string[];
}

export interface CartItem {
  product: Product;
  quantity: number;
  notes?: string;
}

export type OrderStatus = 'placed' | 'paid' | 'packing' | 'in_transit' | 'ready_for_pickup' | 'delivered';

export interface OrderTimelineStep {
  status: OrderStatus;
  label: string;
  description: string;
  timestamp: string;
  completed: boolean;
}

export interface Order {
  id: string;
  userId?: string;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryMethod: 'instant' | 'scheduled' | 'pickup';
  deliveryAddress?: {
    label: string;
    recipient: string;
    phone: string;
    addressLine: string;
    city: string;
    notes?: string;
  };
  pickupStore?: StoreLocation;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  voucherApplied?: string;
  total: number;
  paymentMethod: 'qris' | 'bank_transfer' | 'card';
  paymentStatus: 'unpaid' | 'paid';
  qrisRef?: string;
  qrisNmid?: string;
  qrisPaidAt?: string;
  status: OrderStatus;
  courierName?: string;
  courierPhone?: string;
  vehiclePlate?: string;
  estimatedArrival?: string;
  timeline: OrderTimelineStep[];
}

export interface SavedAddress {
  id: string;
  label: string;
  recipient: string;
  phone: string;
  addressLine: string;
  city: string;
  postalCode: string;
  isDefault: boolean;
}

export interface CustomerAccount {
  id: string;
  name: string;
  email: string;
  phone: string;
  photoUrl?: string;
  memberTier: 'Silver Member' | 'Gold Member' | 'Platinum Member';
  grocePoints: number;
  memberSince: string;
  savedAddresses: SavedAddress[];
  role?: 'admin' | 'customer';
}

// -------------------------------------------------------------
// Role-Based Access Control (RBAC) & Operations
// -------------------------------------------------------------
export type UserRole =
  | 'admin'
  | 'customer'
  | 'cashier'
  | 'warehouse_picker'
  | 'receiving_clerk'
  | 'store_manager'
  | 'executive';

export interface StoreOperationalStatus {
  isOpen: boolean;
  isHolidayMode: boolean;
  noticeBanner: string;
  reopenEstimated?: string;
  maintenanceReason?: string;
  allowCatalogBrowsing: boolean;
  updatedAt: string;
}

export interface StoreOutletSchedule {
  storeId: string;
  storeName: string;
  city: 'Jakarta' | 'Bandung' | 'Surabaya' | 'Bali' | 'Yogyakarta' | 'Medan';
  district: string;
  timezone: 'WIB' | 'WITA' | 'WIT';
  openTime: string; // e.g. "07:00"
  closeTime: string; // e.g. "22:00"
  daysOpen: string; // e.g. "Mon - Sun"
  isEmergencyClosed: boolean;
  closureReason?: string;
  isHolidayMode: boolean;
  holidayNotice?: string;
  allowCatalogBrowsingWhenClosed: boolean;
  activeWarehouses: string[];
  contactPhone: string;
  updatedAt: string;
}

// -------------------------------------------------------------
// Multi-Warehouse & Storage Zones
// -------------------------------------------------------------
export type StorageZoneType = 'ambient' | 'cold_chilled' | 'freezer';

export interface WarehouseZone {
  id: string; // e.g. WH-JKT-SEN-COLD
  storeId: string;
  name: string;
  type: StorageZoneType;
  temperatureTarget: string; // e.g. "4°C", "-18°C", "24°C"
  capacityCubicMeters: number;
  currentOccupancyPercent: number;
  managerInCharge: string;
}

// -------------------------------------------------------------
// Inventory & Valuation (Multi-Tier & Store-Specific)
// -------------------------------------------------------------
export interface StoreInventoryStock {
  id: string;
  sku: string;
  productId: string;
  productName: string;
  category: ProductCategory | string;
  storeId: string;
  storeName: string;
  warehouseZoneId: string;
  storageType: StorageZoneType;
  
  // Multi-tier stock tracking
  physicalStock: number;   // Actual on-hand count in bin
  availableStock: number;  // Ready to sell (physical - reserved)
  reservedStock: number;   // Locked in active checkout carts
  incomingStock: number;   // In transit from approved/partial POs
  
  // Thresholds & Buffers
  minimumThreshold: number;
  safetyStockBuffer: number;
  maxCapacity: number;
  reorderQuantity: number;
  
  // Cost & Valuation
  unitCost: number;        // WAC or FIFO cost
  sellingPrice: number;
  unit: string;
  
  // Handling & Notes
  handlingInstructions?: string; // e.g. "Keep refrigerated at 4°C", "Fragile produce"
  internalNotes?: string;        // Admin notes
  supplierRemarks?: string;
  
  supplierId: string;
  supplierName: string;
  lastRestockedAt: string;
  updatedAt: string;
}

export interface InventoryItem {
  sku: string;
  productId: string;
  productName: string;
  category: ProductCategory | string;
  currentStock: number;
  minimumThreshold: number;
  unitCost: number; // Acquisition cost in IDR
  sellingPrice: number; // Retail price in IDR
  unit: string;
  supplierId: string;
  supplierName: string;
  lastRestockedAt: string;
  incomingStock: number; // Stock pending from approved POs
  outgoingStock: number; // Cumulative sold units
  reorderQuantity: number;
  valuationMethod: 'FIFO' | 'Weighted Average';
  stockBatches?: {
    batchId: string;
    quantity: number;
    unitCost: number;
    receivedAt: string;
  }[];
  // Extended ERP Attributes
  handlingInstructions?: string;
  internalNotes?: string;
  supplierRemarks?: string;
  safetyStockBuffer?: number;
  maxCapacity?: number;
  storageType?: StorageZoneType;
  weightGrams?: number;
}

// -------------------------------------------------------------
// Procurement & Purchasing (PR, PO, and Partial Goods Receipt)
// -------------------------------------------------------------
export interface PurchaseRequest {
  id: string; // e.g. PR-2026-001
  createdAt: string;
  requestedBy: string;
  sku: string;
  productId: string;
  productName: string;
  storeId?: string;
  storeName?: string;
  suggestedQuantity: number;
  estimatedUnitCost: number;
  totalEstimatedCost: number;
  status: 'pending' | 'approved' | 'rejected' | 'converted_to_po';
  reason: 'low_stock_auto_trigger' | 'seasonal_demand' | 'manual_request';
  priority: 'high' | 'medium' | 'low';
  poId?: string;
  approvedAt?: string;
}

export interface PurchaseOrderItem {
  sku: string;
  productName: string;
  orderedQuantity: number;
  receivedQuantity: number;      // Tracks cumulative received items
  remainingBackorder: number;    // ordered - received
  unitCost: number;
  totalCost: number;
  handlingNotes?: string;
}

export interface PurchaseOrder {
  id: string; // e.g. PO-2026-089
  createdAt: string;
  prId?: string;
  storeId: string;
  storeName: string;
  warehouseZoneId?: string;
  supplierName: string;
  supplierContact: string;
  items: PurchaseOrderItem[];
  subtotalCost: number;
  taxPercent: number; // e.g. 11% PPN
  taxAmount: number;
  totalCost: number;
  expectedDeliveryDate: string;
  actualDeliveryDate?: string;
  status: 'Draft' | 'Sent' | 'Partially Received' | 'Completed' | 'Cancelled';
  notes?: string;
  supplierRemarks?: string;
  paymentTerms: 'Net 30' | 'COD' | 'Advance Payment';
  goodsReceiptIds?: string[];
  closureNotes?: string;
  forceClosedAt?: string;
  isForceClosed?: boolean;
}

export interface GoodsReceiptItem {
  sku: string;
  productName: string;
  quantityOrdered: number;
  quantityReceived: number;
  batchNumber: string;
  expiryDate?: string;
  qualityCondition: 'Passed - Grade A' | 'Minor Discrepancy' | 'Cold-Chain Verified';
  tempCheckCelsius?: number; // e.g. 3.8°C for cold produce
}

export interface GoodsReceiptRecord {
  id: string; // e.g. GR-2026-041
  poId: string;
  storeId: string;
  storeName: string;
  warehouseZoneId: string;
  deliveryNoteNumber: string; // Surat Jalan vendor
  vendorName: string;
  receivedAt: string;
  receivedBy: string;
  isPartial: boolean;
  items: GoodsReceiptItem[];
  receiverNotes?: string;
  glEntryId?: string;
}

// -------------------------------------------------------------
// FEFO (First Expired, First Out) Batch Tracking
// -------------------------------------------------------------
export type BatchExpiryStatus = 'fresh' | 'near_expiry' | 'critical' | 'expired';

export interface InventoryBatch {
  batchId: string; // e.g. BAT-2026-081
  sku: string;
  productName: string;
  storeId: string;
  storeName: string;
  warehouseZoneId: string;
  lotNumber: string;
  initialQuantity: number;
  currentStock: number;
  unitCost: number;
  sellingPrice: number;
  receivedDate: string;
  expiryDate: string;
  daysUntilExpiry: number;
  status: BatchExpiryStatus;
  storageZone: StorageZoneType;
  supplierName: string;
}

export interface FEFOAllocationTrace {
  batchId: string;
  lotNumber: string;
  expiryDate: string;
  allocatedQty: number;
  unitCost: number;
  subtotalCost: number;
}

export interface FEFOAllocationResult {
  sku: string;
  productName: string;
  requestedQty: number;
  allocatedQty: number;
  remainingShortage: number;
  allocations: FEFOAllocationTrace[];
  totalCogs: number;
  fefoRuleApplied: string;
}

// -------------------------------------------------------------
// Scrap & Waste Management Module
// -------------------------------------------------------------
export type WasteReason =
  | 'expired'
  | 'damaged_in_transit'
  | 'chiller_temp_breach'
  | 'pest_spoilage'
  | 'trimming_loss';

export type WasteAction =
  | 'bio_compost'
  | 'safe_disposal'
  | 'supplier_claim'
  | 'donated_animal_feed';

export interface WasteRecord {
  id: string; // e.g. WST-2026-001
  sku: string;
  productName: string;
  storeId: string;
  storeName: string;
  warehouseZoneId: string;
  batchId?: string;
  lotNumber?: string;
  quantityScrapped: number;
  unit: string;
  unitCost: number;
  totalShrinkageCost: number;
  reason: WasteReason;
  actionTaken: WasteAction;
  reportedBy: string;
  reportedAt: string;
  glEntryId?: string;
  notes?: string;
}

// -------------------------------------------------------------
// In-Store Picker App, Real-Time Substitutions & Catch-Weight
// -------------------------------------------------------------
export type PickerItemStatus = 'pending' | 'picked' | 'substituted' | 'out_of_stock';
export type PickerOrderStatus = 'assigned' | 'in_progress' | 'ready_for_packing' | 'completed';

export interface PickerItemSubstitution {
  replacementProductId: string;
  replacementSku: string;
  replacementName: string;
  replacementBarcode: string;
  originalPrice: number;
  replacementPrice: number;
  priceDelta: number;
  reason: string;
  customerApprovalStatus: 'pending' | 'auto_approved' | 'rejected';
  suggestedAt: string;
}

export interface PickerOrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  sku: string;
  barcode: string; // EAN-13
  aisleLocation: string; // e.g. Aisle 2 - Fresh Greens
  shelfLocation: string; // e.g. Bay B-04 Chilled
  storageZone: StorageZoneType;
  orderedQty: number;
  pickedQty: number;
  unit: string;
  pricePerUnit: number;
  
  // Catch Weight Attributes
  isCatchWeight: boolean;
  pricePer100g?: number;
  estimatedWeightGrams?: number;
  actualWeighedGrams?: number;
  weightVariancePercent?: number;
  finalPrice: number;

  status: PickerItemStatus;
  substitution?: PickerItemSubstitution;
}

export interface PickerOrder {
  orderId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  storeId: string;
  storeName: string;
  deliveryMethod: 'instant' | 'scheduled' | 'pickup';
  assignedPicker: string;
  pickerStatus: PickerOrderStatus;
  priority: 'express_30min' | 'standard' | 'scheduled';
  targetDispatchTime: string;
  items: PickerOrderItem[];
  totalItems: number;
  pickedItems: number;
  hasCatchWeight: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// -------------------------------------------------------------
// Accounting & Financial Management (Store-Tagged Multi-COA)
// -------------------------------------------------------------
export type AccountCode = '1010' | '1020' | '1030' | '1040' | '2010' | '2020' | '3010' | '3020' | '4010' | '5010' | '6010' | '6020' | '6030';

export interface ChartOfAccount {
  accountCode: AccountCode;
  accountName: string;
  category: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
  storeId: 'CONSOLIDATED' | string;
  normalBalance: 'Debit' | 'Credit';
  balance: number;
  description: string;
}

export interface GeneralLedgerEntry {
  id: string; // GLE-2026-0042
  timestamp: string;
  storeId?: string; // Tagged per store outlet
  storeName?: string;
  accountCode: AccountCode;
  accountName: string;
  category: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
  debit: number;
  credit: number;
  referenceType: 'QRIS_SALE' | 'PURCHASE_ORDER' | 'PARTIAL_GR' | 'OPEX' | 'INVENTORY_ADJUSTMENT' | 'WASTE_SHRINKAGE' | 'REVERSING_ENTRY';
  referenceId: string; // Order ID or PO ID or GR ID or Waste ID
  description: string;
  isReversal?: boolean;
  reversesVoucherId?: string;
  isReversed?: boolean;
  reversedByVoucherId?: string;
  reversalReason?: string;
}

export interface ProfitAndLossReport {
  period: string;
  storeId?: string;
  storeName?: string;
  grossSalesRevenue: number;
  discountsGiven: number;
  netSalesRevenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  grossMarginPercent: number;
  operatingExpenses: {
    category: string;
    amount: number;
  }[];
  totalOperatingExpenses: number;
  netProfit: number;
  netMarginPercent: number;
}

export interface BalanceSheetReport {
  period: string;
  storeId?: string;
  storeName?: string;
  assets: {
    currentAssets: { category: string; amount: number }[];
    nonCurrentAssets: { category: string; amount: number }[];
    totalAssets: number;
  };
  liabilities: {
    currentLiabilities: { category: string; amount: number }[];
    totalLiabilities: number;
  };
  equity: {
    equityItems: { category: string; amount: number }[];
    totalEquity: number;
  };
  isBalanced: boolean;
}

export interface CashFlowStatementReport {
  period: string;
  storeId?: string;
  operatingActivities: { category: string; amount: number }[];
  netOperatingCash: number;
  investingActivities: { category: string; amount: number }[];
  netInvestingCash: number;
  financingActivities: { category: string; amount: number }[];
  netFinancingCash: number;
  netCashIncrease: number;
  beginningCash: number;
  endingCash: number;
}

export interface OmzetAnalyticsReport {
  totalRevenueMTD: number;
  dodGrowthPercent: number; // Day-over-Day
  wowGrowthPercent: number; // Week-over-Week
  momGrowthPercent: number; // Month-over-Month
  totalOrders: number;
  averageBasketValue: number;
  qrisMetrics: {
    totalAttempts: number;
    settledCount: number;
    failedOrExpiredCount: number;
    conversionRatePercent: number;
    averageSettlementSeconds: number;
  };
  storeBreakdown: {
    storeId: string;
    storeName: string;
    city: string;
    omzet: number;
    orderCount: number;
    sharePercent: number;
    status: 'Open' | 'Closed' | 'Maintenance';
  }[];
  categoryBreakdown: {
    category: ProductCategory | string;
    label: string;
    omzet: number;
    unitsSold: number;
    sharePercent: number;
  }[];
  topSkus: {
    sku: string;
    productName: string;
    category: string;
    unitsSold: number;
    revenue: number;
  }[];
}

export interface TransactionAuditRecord {
  id: string;
  qrisReference: string;
  orderId: string;
  customerName: string;
  customerEmail: string;
  amount: number;
  paymentTimestamp: string;
  settlementChannel: 'BCA QRIS' | 'GoPay' | 'OVO' | 'ShopeePay' | 'Dana';
  journalEntryIds: string[];
  inventoryDeducted: {
    sku: string;
    quantity: number;
    cogsCost: number;
  }[];
  status: 'SETTLED' | 'PENDING' | 'FAILED';
}

// -------------------------------------------------------------
// QRIS OpenAPI Payload Interfaces
// -------------------------------------------------------------
export interface QRISGenerateRequest {
  orderId: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  itemsCount: number;
}

export interface QRISGenerateResponse {
  success: boolean;
  orderId: string;
  qrisReference: string;
  nmid: string;
  merchantName: string;
  merchantCity: string;
  postalCode: string;
  amount: number;
  currency: string;
  qrPayloadString: string;
  expiresAt: string;
  fee: number;
  acquirer: string;
}

export interface QRISStatusResponse {
  orderId: string;
  qrisReference: string;
  status: 'unpaid' | 'paid' | 'expired';
  amount: number;
  paidAt?: string;
  settlementChannel?: string;
}

// =============================================================
// MODULE 1: Shrinkage & Natural Weight Loss (Evaporation)
// =============================================================
export interface WeightToleranceConfig {
  category: ProductCategory | string;
  categoryLabel: string;
  maxEvaporationTolerancePercent: number; // e.g. 5.0% for produce, 3.0% for meat
  auditIntervalHours: number;
  description: string;
}

export interface NaturalShrinkageAdjustment {
  id: string; // e.g. EVAP-2026-001
  timestamp: string;
  sku: string;
  productName: string;
  category: ProductCategory | string;
  storeId: string;
  storeName: string;
  warehouseZoneId: string;
  batchId?: string;
  lotNumber?: string;
  recordedGrossWeightGrams: number;
  actualAuditWeightGrams: number;
  weightLossGrams: number;
  weightLossPercent: number;
  toleranceThresholdPercent: number;
  isWithinNaturalTolerance: boolean;
  classification: 'Natural Shrinkage / Evaporation Loss' | 'Anomalous Spoilage Loss';
  unitCost: number;
  totalLossCost: number;
  glEntryId?: string;
  auditorId: string;
  auditorName: string;
  shiftId: string;
  notes?: string;
}

// =============================================================
// MODULE 2: Substitution & Customer WhatsApp/App Prompt Engine
// =============================================================
export interface SubstitutionPromptRecord {
  id: string; // SUB-PRM-2026-001
  orderId: string;
  itemId: string;
  customerName: string;
  customerPhone: string;
  originalSku: string;
  originalProductName: string;
  originalPrice: number;
  originalQty: number;
  originalBatchId?: string;
  replacementSku: string;
  replacementProductName: string;
  replacementPrice: number;
  replacementBatchId: string;
  replacementLotNumber: string;
  replacementExpiryDate: string;
  priceDelta: number; // positive = customer pays more or store absorbs, negative = refund
  absorbPriceDifference: boolean;
  promptStatus: 'pending_customer_approval' | 'approved_by_customer' | 'declined_by_customer' | 'auto_timeout_approved';
  channel: 'WhatsApp' | 'InAppPush' | 'SMS';
  simulationMessage: string;
  timestamp: string;
  decidedAt?: string;
  packerId: string;
  storeId: string;
  glJournalIds?: string[];
  fifoAuditLog?: string;
}

// =============================================================
// MODULE 3: Granular RBAC by Shift, Physical Zone & Multi-Outlet
// =============================================================

export interface StaffShiftSession {
  userId: string;
  userName: string;
  userRole: UserRole;
  storeId: string; // Assigned physical store or 'ALL' for executive
  storeName: string;
  activeShiftId: string; // e.g. SHIFT-JKT-MORNING-01
  shiftName: 'Morning Shift' | 'Afternoon Shift' | 'Night Shift';
  assignedZones: StorageZoneType[]; // e.g. ['cold_chilled', 'ambient']
  loginTimestamp: string;
  permissions: {
    canViewPos: boolean;
    canViewInventory: boolean;
    canAdjustInventory: boolean;
    canPickZone: (zone: StorageZoneType) => boolean;
    canReceiveGoods: boolean;
    canApprovePurchaseOrder: boolean;
    canViewFinancePnL: boolean;
    canManageOutlets: boolean;
    canOverrideStoreClosure: boolean;
  };
}

export interface SecurityAuditTrailRecord {
  id: string; // AUD-SEC-2026-0001
  timestamp: string;
  actionType:
    | 'GOODS_RECEIPT_APPROVAL'
    | 'PURCHASE_ORDER_APPROVAL'
    | 'PRICE_OVERRIDE'
    | 'SHRINKAGE_WRITE_OFF'
    | 'SUBSTITUTION_DISPATCH'
    | 'STORE_EMERGENCY_OVERRIDE'
    | 'ZONE_CONFIG_UPDATE';
  resourceId: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  storeId: string;
  shiftId: string;
  ipAddress?: string;
  status: 'AUTHORIZED_EXECUTED' | 'PERMISSION_DENIED';
  metadata: Record<string, any>;
}

// =============================================================
// MODULE 4: Global Scalability (Multi-Currency & Climate Cold-Chain)
// =============================================================
export type SupportedCurrency = 'IDR' | 'USD' | 'EUR' | 'AUD';

export interface CurrencyExchangeRate {
  code: SupportedCurrency;
  symbol: string;
  rateToIDR: number; // e.g. 1 USD = 16,000 IDR, 1 EUR = 17,200 IDR, 1 AUD = 10,400 IDR
  decimalPlaces: number;
}

export interface ClimateAdaptiveThresholdConfig {
  warehouseZoneId: string;
  zoneName: string;
  storeId: string;
  regionalClimateProfile: 'Tropical High-Humidity (Jakarta/Bali)' | 'Temperate (Europe)' | 'Extreme Heat Arid (Australia)' | 'Highland Mild (Bandung)';
  ambientExternalTempCelsius: number;
  externalHumidityPercent: number;
  standardTempMinCelsius: number;
  standardTempMaxCelsius: number;
  adaptiveOffsetCelsius: number; // Dynamic margin reduction in heatwaves
  activeAlertThresholdCelsius: number;
  currentActualTempCelsius: number;
  coolingCompressorDutyCyclePercent: number;
  isTempAlertActive: boolean;
  alertSeverity: 'NORMAL' | 'ELEVATED' | 'CRITICAL_BREACH';
  lastUpdated: string;
}

