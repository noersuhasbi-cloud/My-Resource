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
  isEmergencyClosed?: boolean;
  closureReason?: string;
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
export type AccountCode = '1010' | '1020' | '1030' | '1040' | '2010' | '2020' | '3010' | '3020' | '4010' | '5010' | '6010' | '6020' | '6030' | string;

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
  referenceType: 'QRIS_SALE' | 'PURCHASE_ORDER' | 'PARTIAL_GR' | 'OPEX' | 'INVENTORY_ADJUSTMENT' | 'WASTE_SHRINKAGE' | 'REVERSING_ENTRY' | 'STOCK_RECONCILIATION' | 'RETURN_REFUND';
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
    | 'ZONE_CONFIG_UPDATE'
    | 'USER_AUTHENTICATION'
    | 'USER_LOGOUT'
    | 'COA_MAPPING_UPDATE'
    | 'POS_CONFIG_UPDATE'
    | 'INVENTORY_IMPORT_BULK'
    | 'STOCK_OPNAME_RECONCILE'
    | 'STOCK_TRANSFER_INTER_WAREHOUSE'
    | 'HARDWARE_DRAWER_KICK'
    | 'RETURN_REFUND_PROCESSED'
    | 'AUTO_REPLENISHMENT_PO_GENERATED';
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

export interface AdminAuthResponse {
  success: boolean;
  token?: string;
  session: StaffShiftSession;
  availableProfiles?: StaffShiftSession[];
  message?: string;
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

// =============================================================
// MODULE 5: POS (Point of Sale) & Cashier Station
// =============================================================
export interface POSProductItem {
  sku: string;
  productId: string;
  name: string;
  category: string;
  sellingPrice: number; // IDR
  unitCost: number; // IDR
  unit: string;
  barcode: string;
  image: string;
  currentStock: number;
  availableStock: number;
  isWeighted?: boolean;
  pricePerKg?: number;
  // FEFO Batch details
  nearestBatchId?: string;
  lotNumber?: string;
  expiryDate?: string;
  daysUntilExpiry?: number;
  batchStatus?: 'fresh' | 'near_expiry' | 'critical';
}

export interface POSCartItem {
  id: string; // unique cart line ID
  sku: string;
  productId: string;
  name: string;
  category: string;
  unitPrice: number; // in IDR
  unitCost: number; // in IDR
  quantity: number; // or kg for weighted items
  unit: string;
  isWeighted?: boolean;
  tareWeightGrams?: number;
  grossWeightGrams?: number;
  netWeightGrams?: number;
  batchId?: string;
  lotNumber?: string;
  expiryDate?: string;
  daysUntilExpiry?: number;
  lineTotal: number; // in IDR
  image?: string;
}

export type POSPaymentMethod = 'cash' | 'qris' | 'debit_card' | 'credit_card';

export interface POSTransactionRequest {
  storeId: string;
  storeName: string;
  cashierId: string;
  cashierName: string;
  shiftId: string;
  items: POSCartItem[];
  subtotal: number; // in IDR
  discount: number; // in IDR
  tax: number; // in IDR (11% VAT / PPN)
  total: number; // in IDR
  currency: SupportedCurrency;
  currencyRateToIDR: number;
  currencyTotal: number;
  paymentMethod: POSPaymentMethod;
  cashTendered?: number;
  cashChange?: number;
  customerName?: string;
  customerPhone?: string;
  customerMemberId?: string;
  notes?: string;
}

export interface POSTransactionReceipt {
  receiptNumber: string;
  transactionId: string;
  orderId: string;
  timestamp: string;
  storeId: string;
  storeName: string;
  cashierId: string;
  cashierName: string;
  shiftId: string;
  items: POSCartItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  currency: SupportedCurrency;
  currencyTotal: number;
  currencyRateToIDR: number;
  paymentMethod: POSPaymentMethod;
  cashTendered?: number;
  cashChange?: number;
  qrisRef?: string;
  cardLast4?: string;
  journalEntryIds: string[];
  inventoryDeductedCount: number;
  totalCogsCost: number;
}

// -------------------------------------------------------------
// SETTINGS & CONFIGURATION SYSTEM TYPES
// -------------------------------------------------------------
export interface CoaMappingConfig {
  posRevenueAccountCode: string;
  posRevenueAccountName: string;
  inventoryAssetAccountCode: string;
  inventoryAssetAccountName: string;
  shrinkageExpenseAccountCode: string;
  shrinkageExpenseAccountName: string;
  cogsAccountCode: string;
  cogsAccountName: string;
  cashClearingAccountCode: string;
  cashClearingAccountName: string;
  qrisClearingAccountCode: string;
  qrisClearingAccountName: string;
  edcClearingAccountCode: string;
  edcClearingAccountName: string;
  taxPayableAccountCode: string;
  taxPayableAccountName: string;
  updatedAt: string;
  updatedBy: string;
}

export type PosRoundingRule =
  | 'none'
  | 'nearest_100'
  | 'nearest_500'
  | 'nearest_1000'
  | 'ceil_1000';

export interface PosCheckoutConfig {
  roundingRule: PosRoundingRule;
  ppnTaxPercent: number; // e.g. 11%
  isTaxInclusive: boolean;
  maxCashierDiscountPercent: number; // e.g. 15%
  enableVivoNearExpiryDiscount: boolean;
  vivoNearExpiryDiscountPercent: number; // e.g. 25%
  cashDrawerFloatIDR: number; // e.g. 500,000 IDR
  loyaltyPointsPer1000IDR: number; // e.g. 1 point
  requireManagerPinForVoid: boolean;
  storeReceiptFooterText: string;
  updatedAt: string;
  updatedBy: string;
}

export interface BulkInventoryImportRow {
  sku: string;
  productName: string;
  category: string;
  storeId: string;
  storeName: string;
  warehouseZoneId: string;
  storageType: StorageZoneType;
  physicalStock: number;
  unitCost: number;
  sellingPrice: number;
  unit: string;
  minimumThreshold: number;
  reorderQuantity?: number;
  supplierName?: string;
}

export interface StockOpnameItem {
  sku: string;
  productName: string;
  category: string;
  storeId: string;
  storeName: string;
  warehouseZoneId: string;
  systemStock: number;
  countedStock: number;
  varianceQty: number; // countedStock - systemStock
  unitCost: number;
  financialVarianceIDR: number; // varianceQty * unitCost
  notes?: string;
  status: 'matched' | 'shortage' | 'surplus';
}

export interface StockOpnameSession {
  id: string;
  date: string;
  storeId: string;
  storeName: string;
  warehouseZoneId: string;
  auditorId: string;
  auditorName: string;
  status: 'draft' | 'completed' | 'reconciled';
  items: StockOpnameItem[];
  totalSystemUnits: number;
  totalCountedUnits: number;
  totalVarianceUnits: number;
  netFinancialVarianceIDR: number;
  glEntryIds: string[];
  notes?: string;
  completedAt?: string;
}

export interface StockTransferRecord {
  id: string;
  timestamp: string;
  sku: string;
  productName: string;
  sourceStoreId: string;
  sourceStoreName: string;
  destinationStoreId: string;
  destinationStoreName: string;
  quantity: number;
  unitCost: number;
  totalTransferValue: number;
  transferredBy: string;
  status: 'completed' | 'in_transit';
  notes?: string;
  suratJalanNumber?: string;
}

// =============================================================
// MODULE 6: APPROVAL WORKFLOW & MULTI-TIER MATRIX
// =============================================================
export type ApprovalModuleType =
  | 'procurement_pr'
  | 'procurement_po'
  | 'stock_adjustment'
  | 'waste_write_off';

export interface ApprovalTierRule {
  id: string;
  module: ApprovalModuleType;
  tierLevel: number; // 1, 2, 3
  tierName: string; // e.g. "Store Supervisor", "Branch Operations Manager", "Director of Supply Chain"
  minThresholdIDR: number;
  maxThresholdIDR: number | null; // null = infinity
  requiredRole: UserRole | string;
  requiresPin: boolean;
  autoApproveBelowMin: boolean;
  slaHours: number;
  description: string;
}

export interface ApprovalActionLog {
  tierLevel: number;
  tierName: string;
  approverId: string;
  approverName: string;
  approverRole: string;
  action: 'APPROVED' | 'REJECTED';
  timestamp: string;
  comments?: string;
}

export interface ApprovalRequest {
  id: string; // e.g. APR-2026-001
  module: ApprovalModuleType;
  documentId: string; // e.g. PR-2026-0042, PO-2026-0015, ADJ-SKU-001
  documentTitle: string;
  requestedBy: string;
  requestedAt: string;
  amountIDR: number;
  storeId: string;
  storeName: string;
  currentTierLevel: number;
  requiredTierLevel: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  history: ApprovalActionLog[];
  payloadSummary: {
    sku?: string;
    productName?: string;
    quantity?: number;
    reason?: string;
  };
}

// =============================================================
// MODULE 7: LOGISTICS & OPERATIONAL SHIPPING DOCUMENTS
// =============================================================
export interface SuratJalanItem {
  sku: string;
  productName: string;
  batchNumber: string;
  quantity: number;
  unit: string;
  packagingType: 'Plastic Crate' | 'Corrugated Box' | 'Vacuum Cold Pack' | 'Wooden Pallet';
  condition: 'Fresh / Intact' | 'Cold-Chilled OK' | 'Frozen Solid';
  notes?: string;
}

export interface SuratJalanDocument {
  id: string; // e.g. SJ-2026-0418
  documentNumber: string; // SJ/GMRT/JKT/2026/0418
  issueDate: string;
  deliveryOrderRef?: string;
  transferRef?: string;
  poRef?: string;
  senderStoreId: string;
  senderStoreName: string;
  senderAddress: string;
  senderPhone: string;
  recipientName: string;
  recipientAddress: string;
  recipientPhone: string;
  recipientStoreId?: string;
  carrierName: string;
  vehiclePlateNumber: string;
  vehicleType: string;
  driverName: string;
  driverPhone: string;
  coldChainTempCelsius?: number;
  specialHandlingInstructions: string;
  items: SuratJalanItem[];
  totalPackages: number;
  totalWeightKg: number;
  status: 'draft' | 'dispatched' | 'in_transit' | 'delivered' | 'signed';
  senderSignatureName: string;
  driverSignatureName?: string;
  recipientSignatureName?: string;
  signedAt?: string;
}

export interface DeliveryOrderItem {
  sku: string;
  productName: string;
  orderedQty: number;
  dispatchedQty: number;
  unit: string;
  unitPriceIDR: number;
  totalPriceIDR: number;
}

export interface DeliveryOrderDocument {
  id: string; // e.g. DO-2026-0210
  doNumber: string; // DO/GMRT/2026/0210
  issueDate: string;
  poNumber?: string;
  customerOrStoreName: string;
  deliveryAddress: string;
  deliveryWindow: string; // e.g. "Morning Slot (08:00 - 12:00)"
  authorizedOfficer: string;
  items: DeliveryOrderItem[];
  subtotalIDR: number;
  taxIDR: number;
  totalAmountIDR: number;
  status: 'pending' | 'in_transit' | 'fulfilled' | 'cancelled';
  notes?: string;
}

export interface ShipmentQuotaTracking {
  id: string; // e.g. SHP-2026-001
  tripId: string;
  vehicleType: 'Refrigerated Van 1.5T' | 'Chilled Truck 4T' | 'Electric Cargo Trike' | 'Standard Courier';
  vehiclePlate: string;
  maxPayloadKg: number;
  currentPayloadKg: number;
  quotaUtilizationPercent: number;
  storageZone: StorageZoneType;
  currentTempCelsius: number;
  targetTempCelsius: number;
  departureHub: string;
  destinationHub: string;
  departureTime: string;
  estimatedArrival: string;
  actualArrival?: string;
  driverName: string;
  driverContact: string;
  assignedOrdersCount: number;
  status: 'loading' | 'in_transit' | 'arrived' | 'delayed';
}

// =============================================================
// MODULE 8: INVENTORY QUALITY CONTROL (QC) INSPECTION
// =============================================================
export type QCDisposition = 'PASSED' | 'QUARANTINED' | 'REJECTED';
export type QCDispositionAction =
  | 'RELEASE_TO_SHELF'
  | 'QUARANTINE_HOLD'
  | 'RETURN_TO_VENDOR'
  | 'SCRAP_WASTE';

export interface QCInspectionRecord {
  id: string; // e.g. QC-2026-0042
  timestamp: string;
  referenceType: 'INCOMING_PO' | 'INTER_WAREHOUSE_TRANSFER' | 'PERIODIC_SPOILAGE_CHECK';
  referenceId: string;
  sku: string;
  productName: string;
  category: string;
  batchNumber: string;
  expiryDate: string;
  sampleQuantity: number;
  totalBatchQuantity: number;
  storeId: string;
  storeName: string;
  inspectorId: string;
  inspectorName: string;
  parameters: {
    visualFreshness: 'Grade A (Pristine)' | 'Grade B (Acceptable)' | 'Defective (Browning/Bruised)';
    temperatureCelsius: number;
    coldChainCompliant: boolean;
    packagingIntegrity: 'Sealed & Intact' | 'Minor Scuff' | 'Damaged/Leaking';
    sensoryOdorCheck: 'Normal & Fresh' | 'Off-Odor / Souring';
    brixSugarContent?: number;
    weightToleranceCompliant: boolean;
  };
  disposition: QCDisposition;
  actionTaken: QCDispositionAction;
  notes?: string;
}

// =============================================================
// MODULE 9: SPECIALIZED GROCERY METRICS & INTELLIGENCE
// =============================================================
export interface GroceryMetricsReport {
  generatedAt: string;
  storeId: string;
  fifoExpiryMetrics: {
    criticalBatchesCount: number; // < 3 days
    nearExpiryBatchesCount: number; // 4 - 7 days
    freshBatchesCount: number; // 8 - 14 days
    stableBatchesCount: number; // > 15 days
    atRiskInventoryValueIDR: number;
    vivoDiscountSoldUnits: number;
    vivoRevenueRecoveredIDR: number;
    batchTurnoverRateDays: number;
    agingBuckets: { bucket: string; units: number; valueIDR: number }[];
  };
  wasteShrinkageMetrics: {
    totalShrinkLossIDR: number;
    shrinkToSalesRatioPercent: number; // e.g. 1.8% vs benchmark < 2.5%
    naturalMoistureLossIDR: number;
    prepAndWashLossIDR: number;
    handlingDamageLossIDR: number;
    expiredSpoilageLossIDR: number;
    departmentBreakdown: {
      department: string;
      lossIDR: number;
      percentage: number;
    }[];
  };
  fulfillmentMetrics: {
    averagePickTimeMinutes: number;
    catchWeightAccuracyPercent: number;
    substitutionsAcceptedPercent: number;
    onTimeDeliveryPercent: number;
    clickAndCollectFulfillmentRatePercent: number;
  };
}

// =============================================================
// GLOBAL COMPLIANCE: Cold Chain Monitoring & Food Safety Logs
// (US FDA FSMA 204, EU Regulation 852/2004, FSANZ 3.2.2, HACCP CCP)
// =============================================================
export interface ColdChainLogEntry {
  id: string; // CCL-2026-001
  warehouseZoneId: string;
  zoneName: string;
  storeId: string;
  storeName: string;
  sensorId: string;
  timestamp: string;
  temperatureCelsius: number;
  temperatureFahrenheit: number;
  humidityPercent: number;
  isExcursion: boolean;
  severity: 'NORMAL' | 'ELEVATED' | 'CRITICAL_SPIKE';
  complianceStandard: 'FDA FSMA 204' | 'EU Reg 852/2004' | 'FSANZ 3.2.2' | 'HACCP CCP';
  correctiveAction?: string;
  inspectorName: string;
}

// =============================================================
// GLOBAL COMPLIANCE: FDA / EU Food Safety Lot Recall & Traceability
// =============================================================
export interface BatchRecallTraceResult {
  batchId: string;
  lotNumber: string;
  sku: string;
  productName: string;
  category: string;
  supplierName: string;
  receivedDate: string;
  expiryDate: string;
  currentWarehouseStock: number;
  quarantinedStock: number;
  recallStatus: 'none' | 'quarantined' | 'fda_class_1_active' | 'eu_rasff_active' | 'fsanz_active';
  quarantineReason?: string;
  quarantinedAt?: string;
  upstreamOrigin: {
    poId?: string;
    supplierId?: string;
    supplierName: string;
    deliveryNoteNumber?: string;
    intakeTempCelsius?: number;
    intakeQualityStatus?: string;
    receivedDate: string;
  };
  warehouseLocations: Array<{
    storeId: string;
    storeName: string;
    warehouseZoneId: string;
    storageType: string;
    physicalStock: number;
    availableStock: number;
    isQuarantined: boolean;
  }>;
  posSales: Array<{
    receiptNumber: string;
    transactionId: string;
    orderId: string;
    timestamp: string;
    storeName: string;
    cashierName: string;
    customerName: string;
    quantitySold: number;
    lineTotal: number;
  }>;
  onlineOrders: Array<{
    orderId: string;
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
    orderDate: string;
    status: string;
    quantity: number;
    deliveryAddress?: string;
  }>;
  regulatoryNotice?: {
    recallClassification: 'Class I (High Risk / Immediate Hazard)' | 'Class II (Moderate Risk)' | 'Class III (Minor / Technical Defect)';
    fdaReportableFoodRegistryId: string;
    euRasffReferenceNumber: string;
    fsanzAlertId: string;
    hazardDescription: string;
    recommendedAction: string;
  };
}

export interface CustomerRecallNotification {
  id: string;
  recallId: string;
  batchId: string;
  channel: 'WhatsApp' | 'SMS' | 'Email';
  recipientName: string;
  recipientContact: string;
  orderId: string;
  message: string;
  timestamp: string;
  status: 'SENT' | 'DELIVERED';
}

// =============================================================
// MODULE 8: POS HARDWARE & PERIPHERAL INTEGRATION
// =============================================================
export interface POSHardwarePeripheralStatus {
  thermalPrinter: {
    status: 'connected' | 'disconnected' | 'out_of_paper' | 'simulated';
    model: string;
    paperWidthMm: 58 | 80;
    lastPrintedAt?: string;
  };
  cashDrawer: {
    status: 'closed' | 'open' | 'kick_triggered';
    kickPulseMs: number;
    lastKickedAt?: string;
  };
  barcodeScanner: {
    status: 'active_listening' | 'idle' | 'wedge_error';
    interfaceType: 'USB-HID-Wedge' | 'Serial' | 'Bluetooth';
    lastScannedBarcode?: string;
    lastScannedAt?: string;
  };
  digitalScale: {
    status: 'streaming' | 'motion' | 'stable' | 'zeroed';
    currentWeightGrams: number;
    tareGrams: number;
    unit: 'kg' | 'g' | 'lb' | 'oz';
    isStable: boolean;
    lastStabilizedAt?: string;
  };
}

export interface ThermalPrintReceiptPayload {
  receiptNumber: string;
  storeName: string;
  storeAddress: string;
  cashierName: string;
  timestamp: string;
  items: Array<{
    name: string;
    sku: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    lineTotal: number;
    discount?: number;
    isWeighted?: boolean;
    netWeightGrams?: number;
  }>;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  currency: string;
  currencyTotal: number;
  paymentMethod: string;
  cashTendered?: number;
  cashChange?: number;
  qrisRef?: string;
  footerNotes?: string;
}

// =============================================================
// MODULE 9: REVERSE LOGISTICS & RETURNS / REFUNDS / EXCHANGES
// =============================================================
export type ReturnCageDisposition = 'RETURN_CAGE_WASTE' | 'RESTOCK_INVENTORY';
export type RefundPaymentChannel = 'CASH_DRAWER' | 'BANK_EDC_REVERSAL' | 'QRIS_CLEARING_REFUND' | 'STORE_CREDIT_VOUCHER';

export interface POSReturnItemLine {
  sku: string;
  productName: string;
  category: string;
  originalQuantity: number;
  returnQuantity: number;
  unitPrice: number;
  unitCost: number;
  refundAmount: number;
  returnReason: 'PERISHABLE_DEFECT' | 'INCORRECT_ITEM' | 'CUSTOMER_REMORSE_UNOPENED' | 'EXPIRED_ON_SHELF' | 'PACKAGING_DAMAGED';
  disposition: ReturnCageDisposition;
  conditionNotes?: string;
}

export interface POSReturnRecord {
  id: string; // RET-2026-0001
  originalReceiptNumber: string;
  originalOrderId?: string;
  storeId: string;
  storeName: string;
  processedByUserId: string;
  processedByUserName: string;
  timestamp: string;
  items: POSReturnItemLine[];
  totalRefundAmountIDR: number;
  refundChannel: RefundPaymentChannel;
  wasteRecordId?: string;
  glVoucherIds: string[];
  status: 'COMPLETED' | 'PENDING_APPROVAL';
  customerName?: string;
  customerPhone?: string;
}

// =============================================================
// MODULE 10: ADVANCED PROMOTION & LOYALTY ENGINE
// =============================================================
export type PromotionType =
  | 'BOGO'
  | 'PERCENTAGE_DISCOUNT'
  | 'FIXED_DISCOUNT'
  | 'MEMBER_TIER'
  | 'CATEGORY_BUNDLE';

export type MemberLoyaltyTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

export interface PromotionRule {
  id: string; // PRM-2026-01
  name: string;
  code: string; // e.g. ORGANIC20, B2G1_APPLES
  type: PromotionType;
  targetType: 'ALL' | 'CATEGORY' | 'SKU';
  targetValue: string; // e.g. 'produce' or 'SKU-PRD-001'
  discountPercent?: number; // e.g. 20 for 20%
  discountAmountIDR?: number; // e.g. 50000
  minOrderSubtotalIDR?: number; // e.g. 100000
  buyQty?: number; // e.g. 2 for Buy 2 Get 1 Free
  getQty?: number; // e.g. 1
  getDiscountPercent?: number; // 100 for 100% free, 50 for 50% off
  memberTier?: MemberLoyaltyTier;
  active: boolean;
  startDate?: string;
  endDate?: string;
  description: string;
  usageCount: number;
}

export interface AppliedPromotionSummary {
  ruleId: string;
  ruleCode: string;
  name: string;
  discountAmountIDR: number;
  promoType: PromotionType;
  appliedSku?: string;
  badgeLabel: string;
}

// =============================================================
// MODULE 11: AUTO-REPLENISHMENT & MIN-MAX STOCK PLANNING
// =============================================================
export interface AutoReplenishmentItemPlan {
  sku: string;
  productName: string;
  category: string;
  storeId: string;
  storeName: string;
  warehouseZoneId: string;
  physicalStock: number;
  availableStock: number;
  reservedStock: number;
  incomingStock: number;
  minimumThreshold: number;
  safetyStockBuffer: number;
  maxCapacity: number;
  reorderQuantity: number;
  dailySalesVelocity: number; // units sold / day
  daysOfInventoryLeft: number; // availableStock / dailySalesVelocity
  supplierLeadTimeDays: number; // default 3 days
  reorderPoint: number; // safetyStock + (dailySalesVelocity * leadTimeDays)
  isReorderTriggered: boolean;
  urgencyLevel: 'CRITICAL_OUT_OF_STOCK' | 'BELOW_SAFETY_STOCK' | 'HEALTHY_STOCK' | 'OVERSTOCKED';
  suggestedOrderQty: number;
  unitCost: number;
  estimatedOrderCostIDR: number;
  supplierId: string;
  supplierName: string;
}

export interface AutoReplenishmentConsolidatedPlan {
  storeId: string;
  storeName: string;
  calculatedAt: string;
  totalSkusEvaluated: number;
  skusNeedingRestockCount: number;
  criticalSkusCount: number;
  totalSuggestedCostIDR: number;
  items: AutoReplenishmentItemPlan[];
  bySupplier: Array<{
    supplierId: string;
    supplierName: string;
    skuCount: number;
    totalOrderQty: number;
    totalAmountIDR: number;
    suggestedPoId: string;
  }>;
}
