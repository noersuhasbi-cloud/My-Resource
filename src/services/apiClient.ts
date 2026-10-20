import type {
  StoreOperationalStatus,
  StoreOutletSchedule,
  WarehouseZone,
  StoreInventoryStock,
  InventoryItem,
  PurchaseRequest,
  PurchaseOrder,
  GoodsReceiptRecord,
  ChartOfAccount,
  GeneralLedgerEntry,
  ProfitAndLossReport,
  BalanceSheetReport,
  CashFlowStatementReport,
  OmzetAnalyticsReport,
  TransactionAuditRecord,
  QRISGenerateResponse,
  CartItem,
  InventoryBatch,
  FEFOAllocationResult,
  WasteRecord,
  PickerOrder,
  PickerOrderItem,
  WeightToleranceConfig,
  NaturalShrinkageAdjustment,
  SubstitutionPromptRecord,
  StaffShiftSession,
  SecurityAuditTrailRecord,
  ClimateAdaptiveThresholdConfig,
  SupportedCurrency,
  AdminAuthResponse,
  POSProductItem,
  POSTransactionRequest,
  POSTransactionReceipt,
  CoaMappingConfig,
  PosCheckoutConfig,
  BulkInventoryImportRow,
  StockOpnameSession,
  StockTransferRecord,
  ApprovalTierRule,
  ApprovalRequest,
  SuratJalanDocument,
  DeliveryOrderDocument,
  ShipmentQuotaTracking,
  QCInspectionRecord,
  GroceryMetricsReport,
  ColdChainLogEntry,
  BatchRecallTraceResult,
  CustomerRecallNotification,
  POSHardwarePeripheralStatus,
  ThermalPrintReceiptPayload,
  POSReturnRecord,
  PromotionRule,
  MemberLoyaltyTier,
  AppliedPromotionSummary,
  AutoReplenishmentItemPlan,
  AutoReplenishmentConsolidatedPlan,
} from '../types/index.ts';
import type { PromotionEvaluationResult } from '../utils/promotionEngine.ts';

export const apiClient = {
  // -------------------------------------------------------------
  // QRIS Payment APIs
  // -------------------------------------------------------------
  async generateQRIS(orderId: string, amount: number, customerName: string, customerEmail: string): Promise<QRISGenerateResponse> {
    const res = await fetch('/api/qris/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, amount, customerName, customerEmail }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to generate QRIS payment code');
    }
    return res.json();
  },

  async getQRISStatus(orderId: string): Promise<{ orderId: string; status: 'unpaid' | 'paid' | 'expired'; amount: number }> {
    const res = await fetch(`/api/qris/status/${encodeURIComponent(orderId)}`);
    return res.json();
  },

  async simulateQRISPayment(payload: {
    orderId: string;
    amount: number;
    channel?: string;
    customerName: string;
    customerEmail: string;
    items?: CartItem[];
  }): Promise<{ success: boolean; message: string; auditRecordId: string; journalEntryIds: string[] }> {
    const res = await fetch('/api/qris/simulate-pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Payment simulation failed');
    }
    return res.json();
  },

  // -------------------------------------------------------------
  // Store Operations & Outlets APIs
  // -------------------------------------------------------------
  async getStoreStatus(): Promise<StoreOperationalStatus> {
    const res = await fetch('/api/admin/store-status');
    return res.json();
  },

  async updateStoreStatus(update: Partial<StoreOperationalStatus> & { forceOverride?: boolean }): Promise<{
    success: boolean;
    storeStatus?: StoreOperationalStatus;
    warning?: string;
    requiresConfirmation?: boolean;
    activeOrdersCount?: number;
    activeOrders?: any[];
    message?: string;
  }> {
    const res = await fetch('/api/admin/store-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    });
    return res.json();
  },

  async getStoreOutlets(): Promise<StoreOutletSchedule[]> {
    const res = await fetch('/api/admin/store-outlets');
    return res.json();
  },

  async updateStoreOutlet(storeId: string, update: Partial<StoreOutletSchedule> & { forceOverride?: boolean }): Promise<{
    success: boolean;
    outlet?: StoreOutletSchedule;
    warning?: string;
    requiresConfirmation?: boolean;
    activeOrdersCount?: number;
    activeOrders?: any[];
    message?: string;
    storeName?: string;
  }> {
    const res = await fetch(`/api/admin/store-outlets/${encodeURIComponent(storeId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    });
    return res.json();
  },

  async checkStoreOpen(storeId: string): Promise<{
    isOpen: boolean;
    storeName: string;
    isEmergencyClosed?: boolean;
    reason?: string;
    message: string;
    resumeTime?: string;
    hours?: string;
  }> {
    const res = await fetch(`/api/store/check-open/${encodeURIComponent(storeId)}`);
    return res.json();
  },

  // -------------------------------------------------------------
  // Multi-Warehouse & Inventory Matrix APIs
  // -------------------------------------------------------------
  async getInventory(): Promise<{
    items: InventoryItem[];
    metrics: {
      totalStockCount: number;
      totalValuationWAC: number;
      lowStockCount: number;
      totalSkus: number;
    };
  }> {
    const res = await fetch('/api/admin/inventory');
    return res.json();
  },

  async getInventoryMatrix(): Promise<{
    warehouseZones: WarehouseZone[];
    storeInventoryTiers: StoreInventoryStock[];
    outlets: StoreOutletSchedule[];
  }> {
    const res = await fetch('/api/admin/inventory/matrix');
    return res.json();
  },

  async updateStockTier(id: string, update: Partial<StoreInventoryStock>): Promise<{ success: boolean; stockTier: StoreInventoryStock }> {
    const res = await fetch(`/api/admin/inventory/stock-tier/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    });
    return res.json();
  },

  async updateThreshold(sku: string, minimumThreshold: number, reorderQuantity?: number): Promise<{ success: boolean; item: InventoryItem }> {
    const res = await fetch('/api/admin/inventory/threshold', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku, minimumThreshold, reorderQuantity }),
    });
    return res.json();
  },

  async adjustStock(sku: string, adjustmentQty: number, reason: string, storeId?: string): Promise<{ success: boolean; item: InventoryItem; gleId: string }> {
    const res = await fetch('/api/admin/inventory/adjust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku, adjustmentQty, reason, storeId }),
    });
    return res.json();
  },

  // -------------------------------------------------------------
  // Procurement & Partial Goods Receipt APIs
  // -------------------------------------------------------------
  async getPurchaseRequests(): Promise<PurchaseRequest[]> {
    const res = await fetch('/api/admin/procurement/requests');
    return res.json();
  },

  async createPurchaseRequest(payload: {
    sku: string;
    suggestedQuantity: number;
    reason?: string;
    priority?: string;
    requestedBy?: string;
    storeId?: string;
  }): Promise<{ success: boolean; purchaseRequest: PurchaseRequest }> {
    const res = await fetch('/api/admin/procurement/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async approvePurchaseRequest(id: string): Promise<{ success: boolean; purchaseRequest: PurchaseRequest; purchaseOrder: PurchaseOrder }> {
    const res = await fetch(`/api/admin/procurement/requests/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
    });
    return res.json();
  },

  async getPurchaseOrders(): Promise<PurchaseOrder[]> {
    const res = await fetch('/api/admin/procurement/orders');
    return res.json();
  },

  async updatePurchaseOrderStatus(
    id: string,
    status: 'Completed' | 'Cancelled' | 'Partially Received' | 'Sent',
    closureNotes?: string
  ): Promise<{
    success: boolean;
    purchaseOrder?: PurchaseOrder;
    error?: string;
    message?: string;
  }> {
    const res = await fetch(`/api/admin/procurement/orders/${encodeURIComponent(id)}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, closureNotes }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Failed to update Purchase Order status');
    }
    return data;
  },

  async getGoodsReceipts(): Promise<GoodsReceiptRecord[]> {
    const res = await fetch('/api/admin/procurement/gr');
    return res.json();
  },

  async receivePartialGoods(payload: {
    poId: string;
    deliveryNoteNumber: string;
    receivedBy: string;
    receiverNotes?: string;
    warehouseZoneId?: string;
    items: {
      sku: string;
      quantityReceived: number;
      batchNumber?: string;
      expiryDate?: string;
      qualityCondition?: string;
      tempCheckCelsius?: number;
    }[];
  }): Promise<{
    success: boolean;
    goodsReceipt: GoodsReceiptRecord;
    purchaseOrder: PurchaseOrder;
    isPartial: boolean;
    remainingBackorder: number;
    journalEntryIds: string[];
  }> {
    const res = await fetch('/api/admin/procurement/gr/receive-partial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to process Goods Receipt');
    }
    return res.json();
  },

  // -------------------------------------------------------------
  // Accounting & Multi-Store Financials APIs
  // -------------------------------------------------------------
  async getChartOfAccounts(): Promise<ChartOfAccount[]> {
    const res = await fetch('/api/admin/accounting/coa');
    return res.json();
  },

  async getGeneralLedger(storeId?: string): Promise<GeneralLedgerEntry[]> {
    const url = storeId && storeId !== 'CONSOLIDATED'
      ? `/api/admin/accounting/general-ledger?storeId=${encodeURIComponent(storeId)}`
      : '/api/admin/accounting/general-ledger';
    const res = await fetch(url);
    return res.json();
  },

  async getPnLReport(storeId?: string): Promise<ProfitAndLossReport> {
    const url = storeId && storeId !== 'CONSOLIDATED'
      ? `/api/admin/accounting/pnl?storeId=${encodeURIComponent(storeId)}`
      : '/api/admin/accounting/pnl';
    const res = await fetch(url);
    return res.json();
  },

  async getBalanceSheet(storeId?: string): Promise<BalanceSheetReport> {
    const url = storeId && storeId !== 'CONSOLIDATED'
      ? `/api/admin/accounting/balance-sheet?storeId=${encodeURIComponent(storeId)}`
      : '/api/admin/accounting/balance-sheet';
    const res = await fetch(url);
    return res.json();
  },

  async getCashFlow(storeId?: string): Promise<CashFlowStatementReport> {
    const url = storeId && storeId !== 'CONSOLIDATED'
      ? `/api/admin/accounting/cash-flow?storeId=${encodeURIComponent(storeId)}`
      : '/api/admin/accounting/cash-flow';
    const res = await fetch(url);
    return res.json();
  },

  async getOmzetAnalytics(): Promise<OmzetAnalyticsReport> {
    const res = await fetch('/api/admin/analytics/omzet');
    return res.json();
  },

  async getAuditTrail(): Promise<TransactionAuditRecord[]> {
    const res = await fetch('/api/admin/accounting/audit-trail');
    return res.json();
  },

  async reverseGeneralLedgerEntry(id: string, reason?: string): Promise<{
    success: boolean;
    message: string;
    originalVoucher: GeneralLedgerEntry;
    reversingVoucher: GeneralLedgerEntry;
  }> {
    const res = await fetch(`/api/admin/accounting/general-ledger/${encodeURIComponent(id)}/reverse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Failed to post reversing journal entry');
    }
    return data;
  },

  async testInventoryConcurrency(sku = 'SKU-PRD-001', concurrentRequests = 10, qtyPerRequest = 1): Promise<{
    success: boolean;
    sku: string;
    productName: string;
    initialStock: number;
    currentStock: number;
    totalAttempts: number;
    successfulAllocations: number;
    rejectedOversellAttempts: number;
    raceConditionDetected: boolean;
    negativeInventoryPrevented: boolean;
    trace: { attempt: number; success: boolean; stockRemaining: number; error?: string }[];
  }> {
    const res = await fetch('/api/admin/inventory/concurrency-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku, concurrentRequests, qtyPerRequest }),
    });
    return res.json();
  },

  async testQRISWebhook(payload: any): Promise<{
    success: boolean;
    message: string;
    isIdempotentReplay?: boolean;
    idempotencyKey?: string;
  }> {
    const res = await fetch('/api/qris/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  // -------------------------------------------------------------
  // FEFO (First Expired, First Out) Batch APIs
  // -------------------------------------------------------------
  async getInventoryBatches(storeId?: string, sku?: string, status?: string): Promise<InventoryBatch[]> {
    const params = new URLSearchParams();
    if (storeId && storeId !== 'ALL') params.append('storeId', storeId);
    if (sku) params.append('sku', sku);
    if (status && status !== 'ALL') params.append('status', status);
    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`/api/admin/inventory/batches${query}`);
    return res.json();
  },

  async allocateFEFO(sku: string, quantity: number, storeId?: string): Promise<{ success: boolean; result: FEFOAllocationResult }> {
    const res = await fetch('/api/inventory/fefo-allocate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku, quantity, storeId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to simulate FEFO allocation');
    }
    return res.json();
  },

  // -------------------------------------------------------------
  // Scrap & Waste Management (Shrinkage Accounting) APIs
  // -------------------------------------------------------------
  async getWasteRecords(storeId?: string): Promise<{
    records: WasteRecord[];
    metrics: {
      totalShrinkageCost: number;
      count: number;
      byReason: { [reason: string]: number };
      byStore: { [store: string]: number };
    };
  }> {
    const url = storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED'
      ? `/api/admin/waste?storeId=${encodeURIComponent(storeId)}`
      : '/api/admin/waste';
    const res = await fetch(url);
    return res.json();
  },

  async logWaste(payload: {
    sku: string;
    storeId?: string;
    batchId?: string;
    quantityScrapped: number;
    reason?: string;
    actionTaken?: string;
    reportedBy?: string;
    notes?: string;
  }): Promise<{ success: boolean; wasteRecord: WasteRecord; journalEntryIds: string[] }> {
    const res = await fetch('/api/admin/waste', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to log waste');
    }
    return res.json();
  },

  // -------------------------------------------------------------
  // In-Store Picker & Packer App APIs
  // -------------------------------------------------------------
  async getPickerOrders(storeId?: string, pickerStatus?: string): Promise<PickerOrder[]> {
    const params = new URLSearchParams();
    if (storeId && storeId !== 'ALL') params.append('storeId', storeId);
    if (pickerStatus && pickerStatus !== 'ALL') params.append('pickerStatus', pickerStatus);
    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`/api/admin/picker/orders${query}`);
    return res.json();
  },

  async pickOrderItem(orderId: string, itemId: string, barcode?: string): Promise<{ success: boolean; order: PickerOrder; item: PickerOrderItem }> {
    const res = await fetch(`/api/admin/picker/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}/pick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to pick item');
    }
    return res.json();
  },

  async substituteOrderItem(orderId: string, itemId: string, payload: {
    replacementSku: string;
    reason?: string;
  }): Promise<{ success: boolean; order: PickerOrder; item: PickerOrderItem; notificationMessage: string }> {
    const res = await fetch(`/api/admin/picker/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}/substitute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to substitute item');
    }
    return res.json();
  },

  async completePickerOrder(orderId: string): Promise<{ success: boolean; order: PickerOrder; message: string }> {
    const res = await fetch(`/api/admin/picker/orders/${encodeURIComponent(orderId)}/complete`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to complete picker order');
    }
    return res.json();
  },

  // -------------------------------------------------------------
  // Catch Weight Management API
  // -------------------------------------------------------------
  async recordCatchWeight(orderId: string, itemId: string, actualWeighedGrams: number): Promise<{
    success: boolean;
    item: PickerOrderItem;
    order: PickerOrder;
    priceAdjustment: {
      previousPrice: number;
      newPrice: number;
      difference: number;
      gramsRecorded: number;
      variancePercent: number;
    };
  }> {
    const res = await fetch('/api/admin/catch-weight/weigh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, itemId, actualWeighedGrams }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to record catch weight');
    }
    return res.json();
  },

  // -------------------------------------------------------------
  // MODULE 1: Shrinkage & Natural Weight Loss (Evaporation)
  // -------------------------------------------------------------
  async getWeightTolerances(): Promise<WeightToleranceConfig[]> {
    const res = await fetch('/api/admin/shrinkage/tolerances');
    return res.json();
  },

  async updateWeightTolerance(category: string, update: { maxEvaporationTolerancePercent?: number; auditIntervalHours?: number }): Promise<{
    success: boolean;
    config: WeightToleranceConfig;
  }> {
    const res = await fetch(`/api/admin/shrinkage/tolerances/${encodeURIComponent(category)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    });
    return res.json();
  },

  async getNaturalShrinkageAdjustments(storeId?: string, category?: string): Promise<NaturalShrinkageAdjustment[]> {
    const params = new URLSearchParams();
    if (storeId) params.append('storeId', storeId);
    if (category) params.append('category', category);
    const res = await fetch(`/api/admin/shrinkage/adjustments?${params.toString()}`);
    return res.json();
  },

  async logNaturalShrinkage(payload: {
    sku: string;
    storeId: string;
    recordedGrossWeightGrams: number;
    actualAuditWeightGrams: number;
    batchId?: string;
    auditorNotes?: string;
  }): Promise<{
    success: boolean;
    message: string;
    adjustment: NaturalShrinkageAdjustment;
    journalEntryIds: string[];
  }> {
    const res = await fetch('/api/admin/shrinkage/adjust-natural', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to record natural shrinkage adjustment');
    }
    return res.json();
  },

  // -------------------------------------------------------------
  // MODULE 2: Substitution & Customer Prompt Engine
  // -------------------------------------------------------------
  async getSubstitutionPrompts(status?: string, storeId?: string): Promise<SubstitutionPromptRecord[]> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (storeId) params.append('storeId', storeId);
    const res = await fetch(`/api/admin/substitutions/prompts?${params.toString()}`);
    return res.json();
  },

  async requestSubstitutionPrompt(payload: {
    orderId: string;
    itemId: string;
    replacementSku: string;
    channel?: 'WhatsApp' | 'InAppPush' | 'SMS';
    absorbPriceDifference?: boolean;
  }): Promise<{
    success: boolean;
    message: string;
    prompt: SubstitutionPromptRecord;
  }> {
    const res = await fetch('/api/admin/substitutions/request-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to dispatch customer substitution prompt');
    }
    return res.json();
  },

  async respondSubstitutionPrompt(promptId: string, action: 'approve' | 'decline'): Promise<{
    success: boolean;
    message: string;
    prompt: SubstitutionPromptRecord;
  }> {
    const res = await fetch(`/api/admin/substitutions/${encodeURIComponent(promptId)}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to process prompt response');
    }
    return res.json();
  },

  // -------------------------------------------------------------
  // MODULE 3: Granular RBAC by Shift, Physical Zone & Multi-Outlet
  // -------------------------------------------------------------
  async getRbacSession(): Promise<{
    currentSession: StaffShiftSession;
    availableProfiles: StaffShiftSession[];
  }> {
    const res = await fetch('/api/admin/rbac/current-session');
    return res.json();
  },

  async switchRbacSession(userId: string): Promise<{
    success: boolean;
    session: StaffShiftSession;
  }> {
    const res = await fetch('/api/admin/rbac/switch-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    return res.json();
  },

  async adminLogin(params: {
    userId?: string;
    username?: string;
    password?: string;
    pin?: string;
    shiftName?: string;
  }): Promise<AdminAuthResponse> {
    const res = await fetch('/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Authentication failed. Please verify credentials or select a valid staff profile.');
    }
    return res.json();
  },

  async adminLogout(): Promise<{ success: boolean; message?: string }> {
    const res = await fetch('/api/admin/auth/logout', { method: 'POST' });
    return res.json().catch(() => ({ success: true }));
  },

  async getSecurityAuditTrail(storeId?: string, actionType?: string): Promise<SecurityAuditTrailRecord[]> {
    const params = new URLSearchParams();
    if (storeId) params.append('storeId', storeId);
    if (actionType) params.append('actionType', actionType);
    const res = await fetch(`/api/admin/rbac/security-audit-trail?${params.toString()}`);
    return res.json();
  },

  async checkZoneAccess(zoneType: string): Promise<{
    success: boolean;
    authorized: boolean;
    error?: string;
  }> {
    const res = await fetch('/api/admin/rbac/check-zone-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zoneType }),
    });
    return res.json();
  },

  // -------------------------------------------------------------
  // MODULE 4: Multi-Currency & Climate-Adaptive Cold Chain
  // -------------------------------------------------------------
  async getClimateThresholds(storeId?: string): Promise<ClimateAdaptiveThresholdConfig[]> {
    const params = new URLSearchParams();
    if (storeId) params.append('storeId', storeId);
    const res = await fetch(`/api/admin/scalability/climate-thresholds?${params.toString()}`);
    return res.json();
  },

  async updateClimateThreshold(zoneId: string, update: Partial<ClimateAdaptiveThresholdConfig>): Promise<{
    success: boolean;
    config: ClimateAdaptiveThresholdConfig;
  }> {
    const res = await fetch(`/api/admin/scalability/climate-thresholds/${encodeURIComponent(zoneId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    });
    return res.json();
  },

  async getMultiCurrencyPnL(storeId?: string, currency?: SupportedCurrency): Promise<any> {
    const params = new URLSearchParams();
    if (storeId) params.append('storeId', storeId);
    if (currency) params.append('currency', currency);
    const res = await fetch(`/api/admin/accounting/pnl-multicurrency?${params.toString()}`);
    return res.json();
  },

  // -------------------------------------------------------------
  // MODULE 5: POS (Point of Sale) & Cashier Module APIs
  // -------------------------------------------------------------
  async getPosProducts(storeId?: string): Promise<POSProductItem[]> {
    const params = new URLSearchParams();
    if (storeId) params.append('storeId', storeId);
    const res = await fetch(`/api/pos/products?${params.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch POS product catalog');
    }
    return res.json();
  },

  async posCheckout(payload: POSTransactionRequest): Promise<{
    success: boolean;
    receipt: POSTransactionReceipt;
    message: string;
  }> {
    const res = await fetch('/api/pos/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'POS Transaction processing failed');
    }
    return res.json();
  },

  async getPosHistory(storeId?: string): Promise<POSTransactionReceipt[]> {
    const params = new URLSearchParams();
    if (storeId) params.append('storeId', storeId);
    const res = await fetch(`/api/pos/history?${params.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch POS transaction history');
    }
    return res.json();
  },

  // -------------------------------------------------------------
  // MODULE 6: Settings, COA Mapping, POS Config & Stock Opname APIs
  // -------------------------------------------------------------
  async getCoaMapping(): Promise<CoaMappingConfig> {
    const res = await fetch('/api/admin/settings/coa-mapping');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch COA mapping configuration');
    }
    return res.json();
  },

  async updateCoaMapping(config: Partial<CoaMappingConfig>): Promise<{ success: boolean; config: CoaMappingConfig; message?: string }> {
    const res = await fetch('/api/admin/settings/coa-mapping', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update COA mapping');
    }
    return res.json();
  },

  async getPosConfig(): Promise<PosCheckoutConfig> {
    const res = await fetch('/api/admin/settings/pos-config');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch POS checkout configuration');
    }
    return res.json();
  },

  async updatePosConfig(config: Partial<PosCheckoutConfig>): Promise<{ success: boolean; config: PosCheckoutConfig; message?: string }> {
    const res = await fetch('/api/admin/settings/pos-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update POS checkout configuration');
    }
    return res.json();
  },

  async bulkImportInventory(rows: BulkInventoryImportRow[]): Promise<{
    success: boolean;
    importedCount: number;
    tiersUpdatedCount: number;
    message: string;
  }> {
    const res = await fetch('/api/admin/inventory/bulk-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Bulk inventory import failed');
    }
    return res.json();
  },

  async getStockOpnameSessions(storeId?: string): Promise<StockOpnameSession[]> {
    const params = new URLSearchParams();
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') params.append('storeId', storeId);
    const res = await fetch(`/api/admin/inventory/stock-opname?${params.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch Stock Opname sessions');
    }
    return res.json();
  },

  async reconcileStockOpname(session: Partial<StockOpnameSession>): Promise<{
    success: boolean;
    session: StockOpnameSession;
    journalEntryIds: string[];
    message: string;
  }> {
    const res = await fetch('/api/admin/inventory/stock-opname/reconcile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Stock Opname reconciliation failed');
    }
    return res.json();
  },

  async transferStock(payload: {
    sku: string;
    sourceStoreId: string;
    destinationStoreId: string;
    quantity: number;
    notes?: string;
  }): Promise<{
    success: boolean;
    record: StockTransferRecord;
    message: string;
  }> {
    const res = await fetch('/api/admin/inventory/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Inter-warehouse stock transfer failed');
    }
    return res.json();
  },

  async getStockTransfers(storeId?: string): Promise<StockTransferRecord[]> {
    const params = new URLSearchParams();
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') params.append('storeId', storeId);
    const res = await fetch(`/api/admin/inventory/transfer?${params.toString()}`);
    return res.json().catch(() => []);
  },

  // -------------------------------------------------------------
  // APPROVAL WORKFLOW & MATRIX APIS
  // -------------------------------------------------------------
  async getApprovalRules(): Promise<ApprovalTierRule[]> {
    const res = await fetch('/api/admin/approvals/rules');
    return res.json().catch(() => []);
  },

  async updateApprovalRules(rules: ApprovalTierRule[]): Promise<{ success: boolean; rules: ApprovalTierRule[]; message: string }> {
    const res = await fetch('/api/admin/approvals/rules', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update approval rules');
    }
    return res.json();
  },

  async getApprovalQueue(storeId?: string, status?: string): Promise<ApprovalRequest[]> {
    const params = new URLSearchParams();
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') params.append('storeId', storeId);
    if (status && status !== 'ALL') params.append('status', status);
    const res = await fetch(`/api/admin/approvals/queue?${params.toString()}`);
    return res.json().catch(() => []);
  },

  async processApprovalAction(requestId: string, action: 'APPROVED' | 'REJECTED', comments?: string): Promise<{
    success: boolean;
    request: ApprovalRequest;
    message: string;
  }> {
    const res = await fetch('/api/admin/approvals/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, action, comments }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Approval action failed');
    }
    return res.json();
  },

  // -------------------------------------------------------------
  // LOGISTICS & SHIPPING DOCUMENTS APIS
  // -------------------------------------------------------------
  async getSuratJalanList(storeId?: string): Promise<SuratJalanDocument[]> {
    const params = new URLSearchParams();
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') params.append('storeId', storeId);
    const res = await fetch(`/api/admin/logistics/surat-jalan?${params.toString()}`);
    return res.json().catch(() => []);
  },

  async createSuratJalan(doc: Partial<SuratJalanDocument>): Promise<{
    success: boolean;
    document: SuratJalanDocument;
    message: string;
  }> {
    const res = await fetch('/api/admin/logistics/surat-jalan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doc),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to issue Surat Jalan');
    }
    return res.json();
  },

  async getDeliveryOrders(): Promise<DeliveryOrderDocument[]> {
    const res = await fetch('/api/admin/logistics/delivery-orders');
    return res.json().catch(() => []);
  },

  async createDeliveryOrder(doc: Partial<DeliveryOrderDocument>): Promise<{
    success: boolean;
    document: DeliveryOrderDocument;
    message: string;
  }> {
    const res = await fetch('/api/admin/logistics/delivery-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doc),
    });
    return res.json();
  },

  async getShipments(): Promise<ShipmentQuotaTracking[]> {
    const res = await fetch('/api/admin/logistics/shipments');
    return res.json().catch(() => []);
  },

  async getShipmentQuotaTracking(): Promise<ShipmentQuotaTracking[]> {
    return this.getShipments();
  },

  async createShipment(data: Partial<ShipmentQuotaTracking>): Promise<{
    success: boolean;
    shipment: ShipmentQuotaTracking;
    message: string;
  }> {
    const res = await fetch('/api/admin/logistics/shipments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // -------------------------------------------------------------
  // INVENTORY QUALITY CONTROL (QC) APIS
  // -------------------------------------------------------------
  async getQCInspections(storeId?: string, disposition?: string): Promise<QCInspectionRecord[]> {
    const params = new URLSearchParams();
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') params.append('storeId', storeId);
    if (disposition && disposition !== 'ALL') params.append('disposition', disposition);
    const res = await fetch(`/api/admin/qc/inspections?${params.toString()}`);
    return res.json().catch(() => []);
  },

  async submitQCInspection(payload: Partial<QCInspectionRecord>): Promise<{
    success: boolean;
    record: QCInspectionRecord;
    message: string;
  }> {
    const res = await fetch('/api/admin/qc/inspections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to record QC inspection');
    }
    return res.json();
  },

  // -------------------------------------------------------------
  // MANUAL COA MANAGEMENT APIS
  // -------------------------------------------------------------
  async createCoaAccount(account: Partial<ChartOfAccount>): Promise<{
    success: boolean;
    account: ChartOfAccount;
    message: string;
  }> {
    const res = await fetch('/api/admin/settings/coa-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(account),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create COA account');
    }
    return res.json();
  },

  async updateCoaAccount(code: string, update: Partial<ChartOfAccount>): Promise<{
    success: boolean;
    account: ChartOfAccount;
    message: string;
  }> {
    const res = await fetch(`/api/admin/settings/coa-account/${encodeURIComponent(code)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update COA account');
    }
    return res.json();
  },

  async deleteCoaAccount(code: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/admin/settings/coa-account/${encodeURIComponent(code)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete COA account');
    }
    return res.json();
  },

  // -------------------------------------------------------------
  // SPECIALIZED GROCERY METRICS APIS
  // -------------------------------------------------------------
  async getGroceryMetrics(storeId?: string): Promise<GroceryMetricsReport> {
    const params = new URLSearchParams();
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') params.append('storeId', storeId);
    const res = await fetch(`/api/admin/reports/grocery-metrics?${params.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch grocery metrics');
    }
    return res.json();
  },

  // -------------------------------------------------------------
  // GLOBAL COMPLIANCE: COLD CHAIN TELEMETRY LOGS
  // -------------------------------------------------------------
  async getColdChainLogs(zoneId?: string, storeId?: string): Promise<ColdChainLogEntry[]> {
    const params = new URLSearchParams();
    if (zoneId && zoneId !== 'ALL') params.append('zoneId', zoneId);
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') params.append('storeId', storeId);
    const res = await fetch(`/api/admin/cold-chain/logs?${params.toString()}`);
    return res.json().catch(() => []);
  },

  async recordColdChainTelemetry(payload: Partial<ColdChainLogEntry>): Promise<{
    success: boolean;
    log: ColdChainLogEntry;
    message: string;
  }> {
    const res = await fetch('/api/admin/cold-chain/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to record cold chain log');
    }
    return res.json();
  },

  // -------------------------------------------------------------
  // GLOBAL COMPLIANCE: BATCH RECALL & FDA/EU TRACEABILITY APIS
  // -------------------------------------------------------------
  async traceBatchRecall(query: string): Promise<BatchRecallTraceResult> {
    const res = await fetch(`/api/admin/batch-recall/trace/${encodeURIComponent(query)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `No batch found matching query '${query}'`);
    }
    return res.json();
  },

  async quarantineBatch(payload: {
    batchId: string;
    reason?: string;
    recallClassification?: string;
    hazardDescription?: string;
    auditorName?: string;
  }): Promise<{ success: boolean; message: string; quarantinedUnits: number }> {
    const res = await fetch('/api/admin/batch-recall/quarantine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to quarantine batch');
    }
    return res.json();
  },

  async notifyRecallCustomers(payload: {
    batchId: string;
    message?: string;
    channel?: 'WhatsApp' | 'SMS' | 'Email';
  }): Promise<{ success: boolean; message: string; notifications: CustomerRecallNotification[] }> {
    const res = await fetch('/api/admin/batch-recall/notify-customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to send recall notifications');
    }
    return res.json();
  },

  async releaseBatchRecall(batchId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/admin/batch-recall/release', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to release quarantined batch');
    }
    return res.json();
  },

  // -------------------------------------------------------------
  // MODULE 1: POS HARDWARE & PERIPHERAL INTEGRATION
  // -------------------------------------------------------------
  async getHardwareStatus(): Promise<POSHardwarePeripheralStatus> {
    const res = await fetch('/api/admin/hardware/status');
    return res.json();
  },

  async kickCashDrawer(pulseMs?: number, cashierName?: string): Promise<{
    success: boolean;
    message: string;
    status: POSHardwarePeripheralStatus;
  }> {
    const res = await fetch('/api/admin/hardware/kick-drawer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pulseMs, cashierName }),
    });
    return res.json();
  },

  async closeCashDrawer(): Promise<{ success: boolean; status: POSHardwarePeripheralStatus }> {
    const res = await fetch('/api/admin/hardware/close-drawer', { method: 'POST' });
    return res.json();
  },

  async testPrintThermalReceipt(
    paperWidthMm?: 58 | 80,
    storeName?: string
  ): Promise<{
    success: boolean;
    message: string;
    slipText: string;
    status: POSHardwarePeripheralStatus;
  }> {
    const res = await fetch('/api/admin/hardware/test-print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paperWidthMm, storeName }),
    });
    return res.json();
  },

  async scaleTare(tareGrams: number): Promise<{ success: boolean; status: POSHardwarePeripheralStatus }> {
    const res = await fetch('/api/admin/hardware/scale/tare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tareGrams }),
    });
    return res.json();
  },

  async scaleZero(): Promise<{ success: boolean; status: POSHardwarePeripheralStatus }> {
    const res = await fetch('/api/admin/hardware/scale/zero', { method: 'POST' });
    return res.json();
  },

  async scaleWeigh(
    weightGrams: number,
    isStable?: boolean
  ): Promise<{ success: boolean; status: POSHardwarePeripheralStatus }> {
    const res = await fetch('/api/admin/hardware/scale/weigh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weightGrams, isStable }),
    });
    return res.json();
  },

  async simulateScannerBarcode(barcode: string): Promise<{
    success: boolean;
    barcode: string;
    matchedItem: any;
    status: POSHardwarePeripheralStatus;
  }> {
    const res = await fetch('/api/admin/hardware/scanner/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode }),
    });
    return res.json();
  },

  // -------------------------------------------------------------
  // MODULE 2: REVERSE LOGISTICS & RETURNS / REFUNDS / EXCHANGES
  // -------------------------------------------------------------
  async getPosReturns(storeId?: string): Promise<POSReturnRecord[]> {
    const params = new URLSearchParams();
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') params.append('storeId', storeId);
    const res = await fetch(`/api/admin/returns?${params.toString()}`);
    return res.json().catch(() => []);
  },

  async lookupReturnReceipt(query: string): Promise<any> {
    const res = await fetch(`/api/admin/returns/lookup-receipt/${encodeURIComponent(query)}`);
    return res.json();
  },

  async processPosReturn(payload: {
    originalReceiptNumber: string;
    originalOrderId?: string;
    storeId?: string;
    processedByUserId?: string;
    processedByUserName?: string;
    items: any[];
    refundChannel: string;
    customerName?: string;
    customerPhone?: string;
  }): Promise<{
    success: boolean;
    returnRecord: POSReturnRecord;
    glVoucherIds: string[];
    slipText: string;
    message: string;
  }> {
    const res = await fetch('/api/admin/returns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to process return');
    }
    return res.json();
  },

  // -------------------------------------------------------------
  // MODULE 3: ADVANCED PROMOTION & LOYALTY ENGINE
  // -------------------------------------------------------------
  async getPromotions(): Promise<PromotionRule[]> {
    const res = await fetch('/api/admin/promotions');
    return res.json().catch(() => []);
  },

  async createPromotion(rule: Partial<PromotionRule>): Promise<{
    success: boolean;
    rule: PromotionRule;
    message: string;
  }> {
    const res = await fetch('/api/admin/promotions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create promotion');
    }
    return res.json();
  },

  async updatePromotion(
    id: string,
    updates: Partial<PromotionRule>
  ): Promise<{
    success: boolean;
    rule: PromotionRule;
    message: string;
  }> {
    const res = await fetch(`/api/admin/promotions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update promotion');
    }
    return res.json();
  },

  async deletePromotion(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/admin/promotions/${id}`, { method: 'DELETE' });
    return res.json();
  },

  async evaluatePromotions(payload: {
    cartItems: any[];
    couponCode?: string;
    memberTier?: MemberLoyaltyTier;
    memberId?: string;
  }): Promise<PromotionEvaluationResult> {
    const res = await fetch('/api/admin/promotions/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  // -------------------------------------------------------------
  // MODULE 4: AUTO-REPLENISHMENT & MIN-MAX PLANNING
  // -------------------------------------------------------------
  async getReplenishmentPlan(storeId?: string): Promise<AutoReplenishmentConsolidatedPlan> {
    const params = new URLSearchParams();
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') params.append('storeId', storeId);
    const res = await fetch(`/api/admin/replenishment/plan?${params.toString()}`);
    return res.json();
  },

  async generateReplenishmentPO(payload: {
    storeId: string;
    selectedSkus?: string[];
  }): Promise<{
    success: boolean;
    generatedOrders: any[];
    message: string;
  }> {
    const res = await fetch('/api/admin/replenishment/generate-po', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to generate replenishment POs');
    }
    return res.json();
  },
};

