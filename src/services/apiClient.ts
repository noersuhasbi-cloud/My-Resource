import type {
  StoreOperationalStatus,
  StoreOutletSchedule,
  WarehouseZone,
  StoreInventoryStock,
  InventoryItem,
  PurchaseRequest,
  PurchaseOrder,
  GoodsReceiptRecord,
  VendorBill,
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
  UserRole,
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
  EnterpriseSettingsConfig,
  LandedCostRecord,
  WarehouseBinLocation,
  WarehouseMultiStepRoute,
  AnalyticDepartment,
  ProductMarginRecord,
  EnterpriseQuotation,
  VendorCreditNote,
  DynamicMarkdownConfig,
  BatchMarkdownCandidate,
  WasteDisposition,
  B2BCustomer,
  WholesaleProduct,
  PWPRule,
  GiroPaymentRecord,
  B2BWholesaleOrder,
  B2BCartItem,
  RemovalStrategyConfig,
  CustomerRmaRecord,
  VendorRtvDebitNote,
  BlindOpnameSheet,
  PosRegisterShiftSession,
  PosShiftDenominationCount,
  SkuTaxRule,
  IndonesianTaxCategory,
  CoretaxExportRow,
  RmaDisposition,
  RmaRefundMethod,
  RmaSourceChannel,
  EnterpriseNotification,
  BranchMonitorResponse,
  OperatorBranchAssignment,
  ConfirmArrivalResponse,
  CommunicationGatewayConfig,
  CommunicationDispatchLog,
  SendDocumentDispatchPayload,
  SendDocumentDispatchResponse,
  WarehouseRackConfig,
  WarehouseRackStorageZone,
  RackRotationPolicy,
  RemovalStrategyType,
  SkuCsvImportPayload,
  SkuCsvImportResult,
  RackStocktakeCommitPayload,
  RackStocktakeCommitResponse,
  RackStocktakePendingSubmission,
  PutawaySuggestionResponse,
  CrossDockRequest,
  CrossDockResponse,
  RepackBundleRequest,
  RepackBundleResponse,
  ComplianceRecallTraceResponse,
  ConsignmentLedgerEntry,
  SafeDropRecord,
  CrmAccount,
  CrmAccountType,
  CrmDeal,
  CrmDealStage,
  CrmActivity,
  CrmOverviewResponse,
  CrmLoyaltyTier,
  CrmRfmSegment,
  EnterpriseQuotation,
} from '../types/index.ts';
import type { PromotionEvaluationResult } from '../utils/promotionEngine.ts';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let activeOperatorContext: { userRole: string; storeId: string; userId: string } | null = null;

export function setApiOperatorContext(session: Pick<StaffShiftSession, 'userRole' | 'storeId' | 'userId'> | null) {
  if (!session) {
    activeOperatorContext = null;
    return;
  }
  activeOperatorContext = {
    userRole: session.userRole,
    storeId: session.storeId,
    userId: session.userId,
  };
}

export function getApiOperatorContext(): { userRole: string; storeId: string; userId: string } | null {
  if (activeOperatorContext) return activeOperatorContext;
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('grocemart_admin_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.userRole) {
          activeOperatorContext = {
            userRole: parsed.userRole,
            storeId: parsed.storeId || 'ALL',
            userId: parsed.userId || '',
          };
          return activeOperatorContext;
        }
      }
    } catch {}
  }
  return null;
}

async function fetchApi(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const retryDelays = [500, 1000, 1500, 2500, 3500];
  let lastError: unknown = null;

  const headers = new Headers(init?.headers || {});
  const opCtx = getApiOperatorContext();
  if (opCtx) {
    if (!headers.has('x-operator-role')) headers.set('x-operator-role', opCtx.userRole);
    if (!headers.has('x-operator-branch')) headers.set('x-operator-branch', opCtx.storeId || 'ALL');
    if (opCtx.userId && !headers.has('x-operator-id')) headers.set('x-operator-id', opCtx.userId);
  }
  const finalInit: RequestInit = { ...init, headers };

  for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
    try {
      const res = await fetch(input, finalInit);
      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      const isGatewayRetryable = res.status === 502 || res.status === 503 || res.status === 504;
      const isJsonContentType = contentType.includes('application/json') || contentType.includes('+json');

      if (!isJsonContentType) {
        const bodyText = await res.clone().text().catch(() => '');
        const trimmed = bodyText.trim();
        const looksLikeHtml = contentType.includes('text/html') || trimmed.startsWith('<');

        if ((isGatewayRetryable || looksLikeHtml) && attempt < retryDelays.length) {
          await sleep(retryDelays[attempt]);
          continue;
        }

        if (looksLikeHtml) {
          const isWarmup = trimmed.includes('Starting Server') || isGatewayRetryable;
          throw new Error(
            isWarmup
              ? 'Backend server is still starting up. Please refresh in a moment.'
              : `Backend API returned HTML instead of JSON (HTTP ${res.status}).`
          );
        }
      } else if (isGatewayRetryable && attempt < retryDelays.length) {
        await sleep(retryDelays[attempt]);
        continue;
      }

      return res;
    } catch (err) {
      lastError = err;
      if (attempt < retryDelays.length && err instanceof TypeError) {
        await sleep(retryDelays[attempt]);
        continue;
      }
      throw err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Backend API request failed');
}

export const apiClient = {
  // -------------------------------------------------------------
  // QRIS Payment APIs
  // -------------------------------------------------------------
  async generateQRIS(orderId: string, amount: number, customerName: string, customerEmail: string): Promise<QRISGenerateResponse> {
    const res = await fetchApi('/api/qris/generate', {
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
    const res = await fetchApi(`/api/qris/status/${encodeURIComponent(orderId)}`);
    return res.json();
  },

  async simulateQRISPayment(payload: {
    orderId: string;
    amount: number;
    channel?: string;
    customerName: string;
    customerEmail: string;
    storeId?: string;
    discount?: number;
    deliveryFee?: number;
    items?: CartItem[];
  }): Promise<{ success: boolean; message: string; auditRecordId: string; journalEntryIds: string[] }> {
    const res = await fetchApi('/api/qris/simulate-pay', {
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
    const res = await fetchApi('/api/admin/store-status');
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
    const res = await fetchApi('/api/admin/store-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    });
    return res.json();
  },

  async getStoreOutlets(): Promise<StoreOutletSchedule[]> {
    const res = await fetchApi('/api/admin/store-outlets');
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
    const res = await fetchApi(`/api/admin/store-outlets/${encodeURIComponent(storeId)}`, {
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
    const res = await fetchApi(`/api/store/check-open/${encodeURIComponent(storeId)}`);
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
    const res = await fetchApi('/api/admin/inventory');
    return res.json();
  },

  async getInventoryMatrix(): Promise<{
    warehouseZones: WarehouseZone[];
    storeInventoryTiers: StoreInventoryStock[];
    outlets: StoreOutletSchedule[];
  }> {
    const res = await fetchApi('/api/admin/inventory/matrix');
    return res.json();
  },

  async updateStockTier(id: string, update: Partial<StoreInventoryStock>): Promise<{ success: boolean; stockTier: StoreInventoryStock }> {
    const res = await fetchApi(`/api/admin/inventory/stock-tier/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    });
    return res.json();
  },

  async updateThreshold(sku: string, minimumThreshold: number, reorderQuantity?: number): Promise<{ success: boolean; item: InventoryItem }> {
    const res = await fetchApi('/api/admin/inventory/threshold', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku, minimumThreshold, reorderQuantity }),
    });
    return res.json();
  },

  async adjustStock(sku: string, adjustmentQty: number, reason: string, storeId?: string): Promise<{ success: boolean; item: InventoryItem; gleId: string }> {
    const res = await fetchApi('/api/admin/inventory/adjust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku, adjustmentQty, reason, storeId }),
    });
    return res.json();
  },

  async getRemovalStrategies(): Promise<RemovalStrategyConfig> {
    const res = await fetchApi('/api/admin/inventory/removal-strategies');
    if (!res.ok) {
      return {
        categoryStrategies: {
          produce: 'FEFO',
          dairy_eggs: 'FEFO',
          meat_seafood: 'FEFO',
          bakery: 'FEFO',
          pantry_coffee: 'FIFO',
        },
        skuOverrides: {},
        updatedAt: new Date().toISOString(),
      };
    }
    return res.json();
  },

  async updateRemovalStrategies(payload: Partial<RemovalStrategyConfig>): Promise<{
    success: boolean;
    config: RemovalStrategyConfig;
    message: string;
  }> {
    const res = await fetchApi('/api/admin/inventory/removal-strategies', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update removal strategies');
    }
    return res.json();
  },

  // -------------------------------------------------------------
  // Procurement & Partial Goods Receipt APIs
  // -------------------------------------------------------------
  async getPurchaseRequests(): Promise<PurchaseRequest[]> {
    const res = await fetchApi('/api/admin/procurement/requests');
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
    const res = await fetchApi('/api/admin/procurement/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async approvePurchaseRequest(id: string): Promise<{ success: boolean; purchaseRequest: PurchaseRequest; purchaseOrder: PurchaseOrder }> {
    const res = await fetchApi(`/api/admin/procurement/requests/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
    });
    return res.json();
  },

  async getPurchaseOrders(): Promise<PurchaseOrder[]> {
    const res = await fetchApi('/api/admin/procurement/orders');
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
    const res = await fetchApi(`/api/admin/procurement/orders/${encodeURIComponent(id)}/status`, {
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
    const res = await fetchApi('/api/admin/procurement/gr');
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
    const res = await fetchApi('/api/admin/procurement/gr/receive-partial', {
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
  // Vendor Bills, 3-Way Matching & Accounts Payable (AP)
  // -------------------------------------------------------------
  async getVendorBills(storeId?: string, status?: string, currency?: string): Promise<VendorBill[]> {
    const params = new URLSearchParams();
    if (storeId && storeId !== 'CONSOLIDATED') params.append('storeId', storeId);
    if (status && status !== 'ALL') params.append('status', status);
    if (currency && currency !== 'ALL') params.append('currency', currency);

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetchApi(`/api/admin/procurement/vendor-bills${qs}`);
    return res.json();
  },

  async createVendorBill(payload: {
    billNumber: string;
    poId: string;
    goodsReceiptId: string;
    supplierName?: string;
    supplierContact?: string;
    storeId?: string;
    storeName?: string;
    deliveryNoteNumber?: string;
    billDate?: string;
    dueDate?: string;
    paymentTerms?: string;
    currency?: string;
    exchangeRate?: number;
    items: {
      sku: string;
      productName?: string;
      billedQuantity: number;
      unitCost: number;
      notes?: string;
    }[];
    taxPercent?: number;
    notes?: string;
    autoApprove?: boolean;
  }): Promise<{
    success: boolean;
    vendorBill: VendorBill;
    journalEntryIds?: string[];
    message?: string;
  }> {
    const res = await fetchApi('/api/admin/procurement/vendor-bills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create Vendor Bill');
    }
    return res.json();
  },

  async approveVendorBill(id: string, approverName?: string): Promise<{
    success: boolean;
    vendorBill: VendorBill;
    journalEntryIds?: string[];
    message?: string;
  }> {
    const res = await fetchApi(`/api/admin/procurement/vendor-bills/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approverName }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to approve Vendor Bill');
    }
    return res.json();
  },

  async payVendorBill(
    id: string,
    payload: {
      amountPaid: number;
      paymentMethod?: string;
      paymentReference?: string;
      notes?: string;
    }
  ): Promise<{
    success: boolean;
    vendorBill: VendorBill;
    journalEntryIds?: string[];
    message?: string;
  }> {
    const res = await fetchApi(`/api/admin/procurement/vendor-bills/${encodeURIComponent(id)}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to record payment');
    }
    return res.json();
  },

  async voidVendorBill(id: string, reason?: string): Promise<{
    success: boolean;
    vendorBill: VendorBill;
    message?: string;
  }> {
    const res = await fetchApi(`/api/admin/procurement/vendor-bills/${encodeURIComponent(id)}/void`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to void Vendor Bill');
    }
    return res.json();
  },
  async getChartOfAccounts(): Promise<ChartOfAccount[]> {
    const res = await fetchApi('/api/admin/accounting/coa');
    return res.json();
  },

  async getGeneralLedger(storeId?: string): Promise<GeneralLedgerEntry[]> {
    const url = storeId && storeId !== 'CONSOLIDATED'
      ? `/api/admin/accounting/general-ledger?storeId=${encodeURIComponent(storeId)}`
      : '/api/admin/accounting/general-ledger';
    const res = await fetchApi(url);
    return res.json();
  },

  async getPnLReport(storeId?: string): Promise<ProfitAndLossReport> {
    const url = storeId && storeId !== 'CONSOLIDATED'
      ? `/api/admin/accounting/pnl?storeId=${encodeURIComponent(storeId)}`
      : '/api/admin/accounting/pnl';
    const res = await fetchApi(url);
    return res.json();
  },

  async getBalanceSheet(storeId?: string): Promise<BalanceSheetReport> {
    const url = storeId && storeId !== 'CONSOLIDATED'
      ? `/api/admin/accounting/balance-sheet?storeId=${encodeURIComponent(storeId)}`
      : '/api/admin/accounting/balance-sheet';
    const res = await fetchApi(url);
    return res.json();
  },

  async getCashFlow(storeId?: string): Promise<CashFlowStatementReport> {
    const url = storeId && storeId !== 'CONSOLIDATED'
      ? `/api/admin/accounting/cash-flow?storeId=${encodeURIComponent(storeId)}`
      : '/api/admin/accounting/cash-flow';
    const res = await fetchApi(url);
    return res.json();
  },

  async getOmzetAnalytics(): Promise<OmzetAnalyticsReport> {
    const res = await fetchApi('/api/admin/analytics/omzet');
    return res.json();
  },

  async getAuditTrail(): Promise<TransactionAuditRecord[]> {
    const res = await fetchApi('/api/admin/accounting/audit-trail');
    return res.json();
  },

  async reverseGeneralLedgerEntry(id: string, reason?: string): Promise<{
    success: boolean;
    message: string;
    originalVoucher: GeneralLedgerEntry;
    reversingVoucher: GeneralLedgerEntry;
  }> {
    const res = await fetchApi(`/api/admin/accounting/general-ledger/${encodeURIComponent(id)}/reverse`, {
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
    const res = await fetchApi('/api/admin/inventory/concurrency-test', {
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
    const res = await fetchApi('/api/qris/webhook', {
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
    const res = await fetchApi(`/api/admin/inventory/batches${query}`);
    return res.json();
  },

  async allocateFEFO(sku: string, quantity: number, storeId?: string): Promise<{ success: boolean; result: FEFOAllocationResult }> {
    const res = await fetchApi('/api/inventory/fefo-allocate', {
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
    const res = await fetchApi(url);
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
    const res = await fetchApi('/api/admin/waste', {
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
    const res = await fetchApi(`/api/admin/picker/orders${query}`);
    return res.json();
  },

  async pickOrderItem(orderId: string, itemId: string, barcode?: string): Promise<{ success: boolean; order: PickerOrder; item: PickerOrderItem }> {
    const res = await fetchApi(`/api/admin/picker/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}/pick`, {
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
    const res = await fetchApi(`/api/admin/picker/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}/substitute`, {
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
    const res = await fetchApi(`/api/admin/picker/orders/${encodeURIComponent(orderId)}/complete`, {
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
    const res = await fetchApi('/api/admin/catch-weight/weigh', {
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
    const res = await fetchApi('/api/admin/shrinkage/tolerances');
    return res.json();
  },

  async updateWeightTolerance(category: string, update: { maxEvaporationTolerancePercent?: number; auditIntervalHours?: number }): Promise<{
    success: boolean;
    config: WeightToleranceConfig;
  }> {
    const res = await fetchApi(`/api/admin/shrinkage/tolerances/${encodeURIComponent(category)}`, {
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
    const res = await fetchApi(`/api/admin/shrinkage/adjustments?${params.toString()}`);
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
    const res = await fetchApi('/api/admin/shrinkage/adjust-natural', {
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
    const res = await fetchApi(`/api/admin/substitutions/prompts?${params.toString()}`);
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
    const res = await fetchApi('/api/admin/substitutions/request-prompt', {
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
    const res = await fetchApi(`/api/admin/substitutions/${encodeURIComponent(promptId)}/respond`, {
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
  setOperatorContext(session: Pick<StaffShiftSession, 'userRole' | 'storeId' | 'userId'> | null) {
    setApiOperatorContext(session);
  },

  async getRbacSession(): Promise<{
    currentSession: StaffShiftSession;
    availableProfiles: StaffShiftSession[];
  }> {
    const res = await fetchApi('/api/admin/rbac/current-session');
    const data = await res.json();
    if (data?.currentSession) {
      setApiOperatorContext(data.currentSession);
    }
    return data;
  },

  async switchRbacSession(userId: string): Promise<{
    success: boolean;
    session: StaffShiftSession;
  }> {
    const res = await fetchApi('/api/admin/rbac/switch-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to switch RBAC session');
    }
    if (data?.session) {
      setApiOperatorContext(data.session);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('grocemart_admin_session', JSON.stringify(data.session));
        } catch {}
      }
    }
    return data;
  },

  async adminLogin(params: {
    userId?: string;
    username?: string;
    password?: string;
    pin?: string;
    shiftName?: string;
  }): Promise<AdminAuthResponse> {
    const res = await fetchApi('/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Authentication failed. Please verify credentials or select a valid staff profile.');
    }
    const data: AdminAuthResponse = await res.json();
    if (data?.session) {
      setApiOperatorContext(data.session);
    }
    return data;
  },

  async adminLogout(): Promise<{ success: boolean; message?: string }> {
    const res = await fetchApi('/api/admin/auth/logout', { method: 'POST' });
    setApiOperatorContext(null);
    return res.json().catch(() => ({ success: true }));
  },

  async getSecurityAuditTrail(storeId?: string, actionType?: string): Promise<SecurityAuditTrailRecord[]> {
    const params = new URLSearchParams();
    if (storeId) params.append('storeId', storeId);
    if (actionType) params.append('actionType', actionType);
    const res = await fetchApi(`/api/admin/rbac/security-audit-trail?${params.toString()}`);
    return res.json();
  },

  async checkZoneAccess(zoneType: string): Promise<{
    success: boolean;
    authorized: boolean;
    error?: string;
  }> {
    const res = await fetchApi('/api/admin/rbac/check-zone-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zoneType }),
    });
    return res.json();
  },

  async submitRbacHandover(payload: {
    nextShift: string;
    notes: string;
    outgoingUserId?: string;
    outgoingUserName?: string;
  }): Promise<{ success: boolean; auditRecord: SecurityAuditTrailRecord; message: string }> {
    const res = await fetchApi('/api/admin/rbac/handover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to record shift handover');
    }
    return res.json();
  },

  // -------------------------------------------------------------
  // MODULE 4: Multi-Currency & Climate-Adaptive Cold Chain
  // -------------------------------------------------------------
  async getClimateThresholds(storeId?: string): Promise<ClimateAdaptiveThresholdConfig[]> {
    const params = new URLSearchParams();
    if (storeId) params.append('storeId', storeId);
    const res = await fetchApi(`/api/admin/scalability/climate-thresholds?${params.toString()}`);
    return res.json();
  },

  async updateClimateThreshold(zoneId: string, update: Partial<ClimateAdaptiveThresholdConfig>): Promise<{
    success: boolean;
    config: ClimateAdaptiveThresholdConfig;
  }> {
    const res = await fetchApi(`/api/admin/scalability/climate-thresholds/${encodeURIComponent(zoneId)}`, {
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
    const res = await fetchApi(`/api/admin/accounting/pnl-multicurrency?${params.toString()}`);
    return res.json();
  },

  // -------------------------------------------------------------
  // MODULE 5: POS (Point of Sale) & Cashier Module APIs
  // -------------------------------------------------------------
  async getPosProducts(storeId?: string): Promise<POSProductItem[]> {
    const params = new URLSearchParams();
    if (storeId) params.append('storeId', storeId);
    const res = await fetchApi(`/api/pos/products?${params.toString()}`);
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
    const res = await fetchApi('/api/pos/checkout', {
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
    const res = await fetchApi(`/api/pos/history?${params.toString()}`);
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
    const res = await fetchApi('/api/admin/settings/coa-mapping');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch COA mapping configuration');
    }
    return res.json();
  },

  async updateCoaMapping(config: Partial<CoaMappingConfig>): Promise<{ success: boolean; config: CoaMappingConfig; message?: string }> {
    const res = await fetchApi('/api/admin/settings/coa-mapping', {
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
    const res = await fetchApi('/api/admin/settings/pos-config');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch POS checkout configuration');
    }
    return res.json();
  },

  async updatePosConfig(config: Partial<PosCheckoutConfig>): Promise<{ success: boolean; config: PosCheckoutConfig; message?: string }> {
    const res = await fetchApi('/api/admin/settings/pos-config', {
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
    const res = await fetchApi('/api/admin/inventory/bulk-import', {
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
    const res = await fetchApi(`/api/admin/inventory/stock-opname?${params.toString()}`);
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
    const res = await fetchApi('/api/admin/inventory/stock-opname/reconcile', {
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
    const res = await fetchApi('/api/admin/inventory/transfer', {
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
    const res = await fetchApi(`/api/admin/inventory/transfer?${params.toString()}`);
    return res.json().catch(() => []);
  },

  async receiveStockTransfer(id: string): Promise<{
    success: boolean;
    record: StockTransferRecord;
    message: string;
  }> {
    const res = await fetchApi(`/api/admin/inventory/transfer/${encodeURIComponent(id)}/receive`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to receive stock transfer');
    }
    return res.json();
  },

  // -------------------------------------------------------------
  // APPROVAL WORKFLOW & MATRIX APIS
  // -------------------------------------------------------------
  async getApprovalRules(): Promise<ApprovalTierRule[]> {
    const res = await fetchApi('/api/admin/approvals/rules');
    return res.json().catch(() => []);
  },

  async updateApprovalRules(rules: ApprovalTierRule[]): Promise<{ success: boolean; rules: ApprovalTierRule[]; message: string }> {
    const res = await fetchApi('/api/admin/approvals/rules', {
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
    const res = await fetchApi(`/api/admin/approvals/queue?${params.toString()}`);
    return res.json().catch(() => []);
  },

  async decideApprovalRequest(
    requestId: string,
    payload: {
      decision: 'APPROVED' | 'REJECTED';
      tier?: number;
      operatorName?: string;
      operatorRole?: string;
      reason?: string;
    }
  ): Promise<{
    success: boolean;
    request: ApprovalRequest;
    message: string;
  }> {
    const res = await fetchApi(`/api/admin/approvals/${encodeURIComponent(requestId)}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Approval action failed');
    }
    return res.json();
  },

  async processApprovalAction(
    requestId: string,
    action: 'APPROVED' | 'REJECTED',
    comments?: string,
    extra?: { tier?: number; operatorName?: string; operatorRole?: string }
  ): Promise<{
    success: boolean;
    request: ApprovalRequest;
    message: string;
  }> {
    return apiClient.decideApprovalRequest(requestId, {
      decision: action,
      tier: extra?.tier,
      operatorName: extra?.operatorName,
      operatorRole: extra?.operatorRole,
      reason: comments,
    });
  },

  // -------------------------------------------------------------
  // LOGISTICS & SHIPPING DOCUMENTS APIS
  // -------------------------------------------------------------
  async getSuratJalanList(storeId?: string): Promise<SuratJalanDocument[]> {
    const params = new URLSearchParams();
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') params.append('storeId', storeId);
    const res = await fetchApi(`/api/admin/logistics/surat-jalan?${params.toString()}`);
    return res.json().catch(() => []);
  },

  async createSuratJalan(doc: Partial<SuratJalanDocument>): Promise<{
    success: boolean;
    document: SuratJalanDocument;
    message: string;
  }> {
    const res = await fetchApi('/api/admin/logistics/surat-jalan', {
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
    const res = await fetchApi('/api/admin/logistics/delivery-orders');
    return res.json().catch(() => []);
  },

  async createDeliveryOrder(doc: Partial<DeliveryOrderDocument>): Promise<{
    success: boolean;
    document: DeliveryOrderDocument;
    message: string;
  }> {
    const res = await fetchApi('/api/admin/logistics/delivery-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doc),
    });
    return res.json();
  },

  async getShipments(): Promise<ShipmentQuotaTracking[]> {
    const res = await fetchApi('/api/admin/logistics/shipments');
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
    const res = await fetchApi('/api/admin/logistics/shipments', {
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
    const res = await fetchApi(`/api/admin/qc/inspections?${params.toString()}`);
    return res.json().catch(() => []);
  },

  async submitQCInspection(payload: Partial<QCInspectionRecord>): Promise<{
    success: boolean;
    record: QCInspectionRecord;
    message: string;
  }> {
    const res = await fetchApi('/api/admin/qc/inspections', {
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
    const res = await fetchApi('/api/admin/settings/coa-account', {
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
    const res = await fetchApi(`/api/admin/settings/coa-account/${encodeURIComponent(code)}`, {
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
    const res = await fetchApi(`/api/admin/settings/coa-account/${encodeURIComponent(code)}`, {
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
    const res = await fetchApi(`/api/admin/reports/grocery-metrics?${params.toString()}`);
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
    const res = await fetchApi(`/api/admin/cold-chain/logs?${params.toString()}`);
    return res.json().catch(() => []);
  },

  async recordColdChainTelemetry(payload: Partial<ColdChainLogEntry>): Promise<{
    success: boolean;
    log: ColdChainLogEntry;
    message: string;
  }> {
    const res = await fetchApi('/api/admin/cold-chain/logs', {
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
    const res = await fetchApi(`/api/admin/batch-recall/trace/${encodeURIComponent(query)}`);
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
    const res = await fetchApi('/api/admin/batch-recall/quarantine', {
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
    const res = await fetchApi('/api/admin/batch-recall/notify-customers', {
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
    const res = await fetchApi('/api/admin/batch-recall/release', {
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
    const res = await fetchApi('/api/admin/hardware/status');
    return res.json();
  },

  async kickCashDrawer(pulseMs?: number, cashierName?: string): Promise<{
    success: boolean;
    message: string;
    status: POSHardwarePeripheralStatus;
  }> {
    const res = await fetchApi('/api/admin/hardware/kick-drawer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pulseMs, cashierName }),
    });
    return res.json();
  },

  async closeCashDrawer(): Promise<{ success: boolean; status: POSHardwarePeripheralStatus }> {
    const res = await fetchApi('/api/admin/hardware/close-drawer', { method: 'POST' });
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
    const res = await fetchApi('/api/admin/hardware/test-print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paperWidthMm, storeName }),
    });
    return res.json();
  },

  async scaleTare(tareGrams: number): Promise<{ success: boolean; status: POSHardwarePeripheralStatus }> {
    const res = await fetchApi('/api/admin/hardware/scale/tare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tareGrams }),
    });
    return res.json();
  },

  async scaleZero(): Promise<{ success: boolean; status: POSHardwarePeripheralStatus }> {
    const res = await fetchApi('/api/admin/hardware/scale/zero', { method: 'POST' });
    return res.json();
  },

  async scaleWeigh(
    weightGrams: number,
    isStable?: boolean
  ): Promise<{ success: boolean; status: POSHardwarePeripheralStatus }> {
    const res = await fetchApi('/api/admin/hardware/scale/weigh', {
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
    const res = await fetchApi('/api/admin/hardware/scanner/simulate', {
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
    const res = await fetchApi(`/api/admin/returns?${params.toString()}`);
    return res.json().catch(() => []);
  },

  async lookupReturnReceipt(query: string): Promise<any> {
    const res = await fetchApi(`/api/admin/returns/lookup-receipt/${encodeURIComponent(query)}`);
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
    const res = await fetchApi('/api/admin/returns', {
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
    const res = await fetchApi('/api/admin/promotions');
    return res.json().catch(() => []);
  },

  async createPromotion(rule: Partial<PromotionRule>): Promise<{
    success: boolean;
    rule: PromotionRule;
    message: string;
  }> {
    const res = await fetchApi('/api/admin/promotions', {
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
    const res = await fetchApi(`/api/admin/promotions/${id}`, {
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
    const res = await fetchApi(`/api/admin/promotions/${id}`, { method: 'DELETE' });
    return res.json();
  },

  async evaluatePromotions(payload: {
    cartItems: any[];
    couponCode?: string;
    memberTier?: MemberLoyaltyTier;
    memberId?: string;
  }): Promise<PromotionEvaluationResult> {
    const res = await fetchApi('/api/admin/promotions/evaluate', {
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
    const res = await fetchApi(`/api/admin/replenishment/plan?${params.toString()}`);
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
    const res = await fetchApi('/api/admin/replenishment/generate-po', {
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

  // -------------------------------------------------------------
  // MODULE 12: ENTERPRISE SETTINGS, VALUATION, ROUTING, & QUOTES
  // -------------------------------------------------------------
  async getEnterpriseSettings(): Promise<EnterpriseSettingsConfig> {
    const res = await fetchApi('/api/admin/settings/enterprise');
    if (!res.ok) throw new Error('Failed to fetch enterprise settings');
    return res.json();
  },

  async updateEnterpriseSettings(settings: Partial<EnterpriseSettingsConfig>): Promise<{
    success: boolean;
    settings: EnterpriseSettingsConfig;
    message: string;
  }> {
    const res = await fetchApi('/api/admin/settings/enterprise', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update enterprise settings');
    }
    return res.json();
  },

  async getLandedCosts(): Promise<LandedCostRecord[]> {
    const res = await fetchApi('/api/admin/valuation/landed-costs');
    return res.json().catch(() => []);
  },

  async createLandedCost(payload: {
    description: string;
    poId?: string;
    billNumber?: string;
    receiptNumber?: string;
    currency?: string;
    exchangeRate?: number;
    freightCostIDR: number;
    customsDutyIDR?: number;
    handlingCostIDR?: number;
    insuranceCostIDR?: number;
    informalLaborCostIDR?: number;
    allocationMethod: 'EQUAL' | 'BY_QUANTITY' | 'BY_VALUE' | 'BY_WEIGHT';
    items: Array<{ sku: string; quantity: number }>;
  }): Promise<{
    success: boolean;
    record: LandedCostRecord;
    journalEntryIds: string[];
    message: string;
  }> {
    const res = await fetchApi('/api/admin/valuation/landed-costs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create landed cost record');
    }
    return res.json();
  },

  async getWarehouseBins(storeId?: string, zoneId?: string, status?: string): Promise<WarehouseBinLocation[]> {
    const params = new URLSearchParams();
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') params.append('storeId', storeId);
    if (zoneId && zoneId !== 'ALL') params.append('zoneId', zoneId);
    if (status && status !== 'ALL') params.append('status', status);
    const res = await fetchApi(`/api/admin/warehouse/bins?${params.toString()}`);
    return res.json().catch(() => []);
  },

  async createWarehouseBin(bin: Partial<WarehouseBinLocation>): Promise<{
    success: boolean;
    bin: WarehouseBinLocation;
    message: string;
  }> {
    const res = await fetchApi('/api/admin/warehouse/bins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bin),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create warehouse bin');
    }
    return res.json();
  },

  async updateWarehouseBin(id: string, updates: Partial<WarehouseBinLocation>): Promise<{
    success: boolean;
    bin: WarehouseBinLocation;
    message: string;
  }> {
    const res = await fetchApi(`/api/admin/warehouse/bins/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update warehouse bin');
    }
    return res.json();
  },

  async getWarehouseRoutes(): Promise<WarehouseMultiStepRoute[]> {
    const res = await fetchApi('/api/admin/warehouse/routes');
    return res.json().catch(() => []);
  },

  async updateWarehouseRoute(id: string, updates: Partial<WarehouseMultiStepRoute>): Promise<{
    success: boolean;
    route: WarehouseMultiStepRoute;
    message: string;
  }> {
    const res = await fetchApi(`/api/admin/warehouse/routes/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update warehouse route');
    }
    return res.json();
  },

  async getInvoiceTrackingSettings(): Promise<{
    displayLotsOnInvoices: boolean;
    displaySerialExpiryOnDeliveryDocs: boolean;
    requireLotScanOnFulfillment: boolean;
  }> {
    const res = await fetchApi('/api/settings/invoice-tracking');
    if (!res.ok) {
      return {
        displayLotsOnInvoices: true,
        displaySerialExpiryOnDeliveryDocs: true,
        requireLotScanOnFulfillment: false,
      };
    }
    return res.json();
  },

  async getAnalyticDepartments(): Promise<AnalyticDepartment[]> {
    const res = await fetchApi('/api/admin/accounting/analytic-departments');
    return res.json().catch(() => []);
  },

  async createAnalyticDepartment(payload: {
    code: string;
    name: string;
    manager?: string;
    annualBudgetIDR: number;
    actualCostIDR?: number;
    expectedRevenueIDR?: number;
    actualRevenueIDR?: number;
  }): Promise<{
    success: boolean;
    department: AnalyticDepartment;
    message: string;
  }> {
    const res = await fetchApi('/api/admin/accounting/analytic-departments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create cost center');
    }
    return res.json();
  },

  async updateAnalyticDepartment(id: string, updates: Partial<AnalyticDepartment>): Promise<{
    success: boolean;
    department: AnalyticDepartment;
    message: string;
  }> {
    const res = await fetchApi(`/api/admin/accounting/analytic-departments/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update analytic department');
    }
    return res.json();
  },

  async getMarginAnalysis(): Promise<ProductMarginRecord[]> {
    const res = await fetchApi('/api/admin/accounting/margin-analysis');
    return res.json().catch(() => []);
  },

  async getEnterpriseQuotations(): Promise<EnterpriseQuotation[]> {
    const res = await fetchApi('/api/admin/sales/quotations');
    return res.json().catch(() => []);
  },

  async createEnterpriseQuotation(payload: Partial<EnterpriseQuotation>): Promise<{
    success: boolean;
    quotation: EnterpriseQuotation;
    message: string;
  }> {
    const res = await fetchApi('/api/admin/sales/quotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create quotation');
    }
    return res.json();
  },

  async signEnterpriseQuotation(id: string, payload: { signedBy: string; signatureDataUrl?: string }): Promise<{
    success: boolean;
    quotation: EnterpriseQuotation;
    message: string;
  }> {
    const res = await fetchApi(`/api/admin/sales/quotations/${encodeURIComponent(id)}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to sign quotation');
    }
    return res.json();
  },

  async convertQuotationToOrder(id: string): Promise<{
    success: boolean;
    order: any;
    quotation: EnterpriseQuotation;
    message: string;
  }> {
    const res = await fetchApi(`/api/admin/sales/quotations/${encodeURIComponent(id)}/convert-to-order`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to convert quotation to order');
    }
    return res.json();
  },

  // -------------------------------------------------------------
  // GROCERY MODULE: Return-to-Vendor (RTV) & Vendor Credit Notes
  // -------------------------------------------------------------
  async getVendorCreditNotes(storeId?: string): Promise<VendorCreditNote[]> {
    try {
      const res = await fetchApi(`/api/admin/vendor-credit-notes${storeId && storeId !== 'ALL' ? `?storeId=${encodeURIComponent(storeId)}` : ''}`);
      if (res.ok) return await res.json();
    } catch {}
    const { MOCK_VENDOR_CREDIT_NOTES } = await import('../utils/groceryEngine.ts');
    return MOCK_VENDOR_CREDIT_NOTES;
  },

  async createVendorCreditNote(payload: Partial<VendorCreditNote>): Promise<{
    success: boolean;
    creditNote: VendorCreditNote;
    journalEntryId: string;
    message: string;
  }> {
    const res = await fetchApi('/api/admin/vendor-credit-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to generate Return-to-Vendor credit note');
    }
    return res.json();
  },

  async applyCreditNoteToBill(creditNoteId: string, vendorBillId: string): Promise<{
    success: boolean;
    creditNote: VendorCreditNote;
    vendorBill: any;
    message: string;
  }> {
    const res = await fetchApi(`/api/admin/vendor-credit-notes/${encodeURIComponent(creditNoteId)}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendorBillId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to apply vendor credit note to bill');
    }
    return res.json();
  },

  // -------------------------------------------------------------
  // GROCERY MODULE: Dynamic Markdown Engine
  // -------------------------------------------------------------
  async getDynamicMarkdownConfig(): Promise<DynamicMarkdownConfig> {
    try {
      const res = await fetchApi('/api/admin/markdown-rules');
      if (res.ok) return await res.json();
    } catch {}
    const { DEFAULT_MARKDOWN_CONFIG } = await import('../utils/groceryEngine.ts');
    return DEFAULT_MARKDOWN_CONFIG;
  },

  async saveDynamicMarkdownConfig(config: DynamicMarkdownConfig): Promise<{
    success: boolean;
    config: DynamicMarkdownConfig;
    message: string;
  }> {
    const res = await fetchApi('/api/admin/markdown-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to save dynamic markdown rules');
    }
    return res.json();
  },

  async applyDynamicBatchMarkdowns(batchIds: string[]): Promise<{
    success: boolean;
    appliedCount: number;
    message: string;
  }> {
    const res = await fetchApi('/api/admin/markdown-rules/apply-batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchIds }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to apply markdown prices to POS & Storefront');
    }
    return res.json();
  },

  // -------------------------------------------------------------
  // MODULE 14: ENTERPRISE B2B WHOLESALE & GIRO APIS
  // -------------------------------------------------------------
  async getB2BCustomers(): Promise<B2BCustomer[]> {
    const res = await fetchApi('/api/b2b/customers');
    if (!res.ok) {
      const { INITIAL_B2B_CUSTOMERS } = await import('../data/b2bWholesaleData.ts');
      return INITIAL_B2B_CUSTOMERS;
    }
    return res.json().catch(async () => {
      const { INITIAL_B2B_CUSTOMERS } = await import('../data/b2bWholesaleData.ts');
      return INITIAL_B2B_CUSTOMERS;
    });
  },

  async updateB2BCustomer(customerId: string, update: Partial<B2BCustomer>): Promise<B2BCustomer> {
    const res = await fetchApi(`/api/b2b/customers/${encodeURIComponent(customerId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update customer profile');
    }
    return res.json();
  },

  async getB2BProducts(): Promise<WholesaleProduct[]> {
    const res = await fetchApi('/api/b2b/products');
    if (!res.ok) {
      const { WHOLESALE_PRODUCTS } = await import('../data/b2bWholesaleData.ts');
      return WHOLESALE_PRODUCTS;
    }
    return res.json().catch(async () => {
      const { WHOLESALE_PRODUCTS } = await import('../data/b2bWholesaleData.ts');
      return WHOLESALE_PRODUCTS;
    });
  },

  async getPWPRules(): Promise<PWPRule[]> {
    const res = await fetchApi('/api/b2b/pwp-rules');
    if (!res.ok) {
      const { INITIAL_PWP_RULES } = await import('../data/b2bWholesaleData.ts');
      return INITIAL_PWP_RULES;
    }
    return res.json().catch(async () => {
      const { INITIAL_PWP_RULES } = await import('../data/b2bWholesaleData.ts');
      return INITIAL_PWP_RULES;
    });
  },

  async getB2BOrders(): Promise<B2BWholesaleOrder[]> {
    const res = await fetchApi('/api/b2b/orders');
    if (!res.ok) {
      const { INITIAL_B2B_ORDERS } = await import('../data/b2bWholesaleData.ts');
      return INITIAL_B2B_ORDERS;
    }
    return res.json().catch(async () => {
      const { INITIAL_B2B_ORDERS } = await import('../data/b2bWholesaleData.ts');
      return INITIAL_B2B_ORDERS;
    });
  },

  async checkoutB2BOrder(payload: {
    customerId: string;
    items: B2BCartItem[];
    paymentMethod: 'term_net7' | 'term_net14' | 'term_net30' | 'bilyet_giro' | 'transfer_verification' | 'instant_va';
    giroDetails?: {
      giroNumber: string;
      bankName: string;
      clearingDueDate: string;
      nominal: number;
    };
    transferProofUrl?: string;
  }): Promise<{
    success: boolean;
    order: B2BWholesaleOrder;
    message: string;
    requiresApproval?: boolean;
    journalEntryIds: string[];
    customerUpdated: B2BCustomer;
  }> {
    const res = await fetchApi('/api/b2b/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'B2B Wholesale checkout failed');
    }
    return res.json();
  },

  async getGiroRecords(): Promise<GiroPaymentRecord[]> {
    const res = await fetchApi('/api/b2b/giro-records');
    if (!res.ok) {
      const { INITIAL_GIRO_RECORDS } = await import('../data/b2bWholesaleData.ts');
      return INITIAL_GIRO_RECORDS;
    }
    return res.json().catch(async () => {
      const { INITIAL_GIRO_RECORDS } = await import('../data/b2bWholesaleData.ts');
      return INITIAL_GIRO_RECORDS;
    });
  },

  async clearGiro(giroId: string): Promise<{
    success: boolean;
    giro: GiroPaymentRecord;
    journalEntryIds: string[];
    message: string;
  }> {
    const res = await fetchApi(`/api/b2b/giro/${encodeURIComponent(giroId)}/clear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to clear Bilyet Giro');
    }
    return res.json();
  },

  async bounceGiro(giroId: string, reason?: string): Promise<{
    success: boolean;
    giro: GiroPaymentRecord;
    customer: B2BCustomer;
    penaltyFee: number;
    journalEntryIds: string[];
    message: string;
  }> {
    const res = await fetchApi(`/api/b2b/giro/${encodeURIComponent(giroId)}/bounce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to process bounced Giro');
    }
    return res.json();
  },

  // -------------------------------------------------------------
  // MODULE 15: INDONESIAN REGULATORY COMPLIANCE SUITE
  // -------------------------------------------------------------
  async getComplianceRmaList(storeId?: string): Promise<CustomerRmaRecord[]> {
    const params = new URLSearchParams();
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') params.append('storeId', storeId);
    const res = await fetchApi(`/api/admin/compliance/rma?${params.toString()}`);
    if (!res.ok) return [];
    return res.json().catch(() => []);
  },

  async getComplianceRmaSources(): Promise<{
    posReceipts: Array<any>;
    b2cOrders: Array<any>;
    b2bOrders: Array<any>;
  }> {
    const res = await fetchApi('/api/admin/compliance/rma-sources');
    if (!res.ok) return { posReceipts: [], b2cOrders: [], b2bOrders: [] };
    return res.json().catch(() => ({ posReceipts: [], b2cOrders: [], b2bOrders: [] }));
  },

  async createComplianceRma(payload: {
    sourceChannel: RmaSourceChannel;
    sourceReferenceId: string;
    storeId?: string;
    storeName?: string;
    customerId?: string;
    customerName?: string;
    customerNpwpOrNik?: string;
    refundMethod: RmaRefundMethod;
    items: Array<{
      sku: string;
      productName: string;
      category?: string;
      quantity: number;
      unitPriceIDR: number;
      unitCostIDR?: number;
      disposition: RmaDisposition;
      lotNumber?: string;
      reason?: string;
    }>;
    notes?: string;
  }): Promise<{ success: boolean; rma: CustomerRmaRecord; message: string }> {
    const res = await fetchApi('/api/admin/compliance/rma', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to issue Customer RMA / Nota Retur');
    }
    return res.json();
  },

  async getComplianceRtvList(storeId?: string): Promise<VendorRtvDebitNote[]> {
    const params = new URLSearchParams();
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') params.append('storeId', storeId);
    const res = await fetchApi(`/api/admin/compliance/rtv?${params.toString()}`);
    if (!res.ok) return [];
    return res.json().catch(() => []);
  },

  async createComplianceRtv(payload: {
    qcInspectionId?: string;
    supplierId?: string;
    supplierName?: string;
    supplierNpwp?: string;
    storeId?: string;
    storeName?: string;
    sku: string;
    productName?: string;
    lotNumber?: string;
    quantityReturned: number;
    unit?: string;
    unitCostIDR?: number;
    reason?: string;
  }): Promise<{ success: boolean; rtv: VendorRtvDebitNote; message: string }> {
    const res = await fetchApi('/api/admin/compliance/rtv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to generate RTV Debit Note');
    }
    return res.json();
  },

  async getBlindOpnameSheets(storeId?: string): Promise<BlindOpnameSheet[]> {
    const params = new URLSearchParams();
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') params.append('storeId', storeId);
    const res = await fetchApi(`/api/admin/compliance/blind-opname?${params.toString()}`);
    if (!res.ok) return [];
    return res.json().catch(() => []);
  },

  async generateBlindOpnameSheet(payload: {
    warehouseHub: 'CDC' | 'DARK_STORE' | 'RETAIL_FRONT';
    storeId?: string;
    zoneFilter?: string;
  }): Promise<{ success: boolean; sheet: BlindOpnameSheet; message: string }> {
    const res = await fetchApi('/api/admin/compliance/blind-opname/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to generate Blind Cycle Count sheet');
    }
    return res.json();
  },

  async submitBlindOpnameCounts(
    sheetId: string,
    payload: {
      counts: Array<{ sku: string; countedQty: number; countedLotNumber?: string; notes?: string }>;
      submittedBy?: string;
    }
  ): Promise<{ success: boolean; sheet: BlindOpnameSheet; approvalRequestId: string; message: string }> {
    const res = await fetchApi(`/api/admin/compliance/blind-opname/${encodeURIComponent(sheetId)}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to submit blind opname counts');
    }
    return res.json();
  },

  async approveBlindOpnameSheet(
    sheetId: string,
    action: 'APPROVED' | 'REJECTED',
    approverNotes?: string
  ): Promise<{ success: boolean; sheet: BlindOpnameSheet; glVoucherIds?: string[]; message: string }> {
    const res = await fetchApi(`/api/admin/compliance/blind-opname/${encodeURIComponent(sheetId)}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, approverNotes }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to process blind opname approval');
    }
    return res.json();
  },

  async getActivePosShift(storeId: string): Promise<{ activeShift: PosRegisterShiftSession | null }> {
    const params = new URLSearchParams({ storeId });
    const res = await fetchApi(`/api/pos/shifts/active?${params.toString()}`);
    if (!res.ok) return { activeShift: null };
    return res.json().catch(() => ({ activeShift: null }));
  },

  async getPosShiftHistory(storeId?: string): Promise<PosRegisterShiftSession[]> {
    const params = new URLSearchParams();
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') params.append('storeId', storeId);
    const res = await fetchApi(`/api/pos/shifts/history?${params.toString()}`);
    if (!res.ok) return [];
    return res.json().catch(() => []);
  },

  async openPosShift(payload: {
    storeId: string;
    storeName: string;
    registerId?: string;
    openingFloatIDR: number;
    cashierName?: string;
  }): Promise<{ success: boolean; shift: PosRegisterShiftSession; message: string }> {
    const res = await fetchApi('/api/pos/shifts/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to open POS shift');
    }
    return res.json();
  },

  async closePosShift(payload: {
    shiftId?: string;
    storeId: string;
    denominations: PosShiftDenominationCount[];
    countedQrisBatchIDR: number;
    countedEdcBatchIDR: number;
    notes?: string;
  }): Promise<{ success: boolean; shift: PosRegisterShiftSession; zReportNumber: string; message: string }> {
    const res = await fetchApi('/api/pos/shifts/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to close POS shift and generate Z-Report');
    }
    return res.json();
  },

  async getSkuTaxRules(): Promise<SkuTaxRule[]> {
    const res = await fetchApi('/api/admin/compliance/sku-tax-rules');
    if (!res.ok) return [];
    return res.json().catch(() => []);
  },

  async updateSkuTaxRule(payload: {
    sku: string;
    taxCategory: IndonesianTaxCategory;
    taxRatePercent?: number;
    b2cTaxInclusive?: boolean;
    b2bTaxExclusive?: boolean;
  }): Promise<{ success: boolean; rules: SkuTaxRule[]; message: string }> {
    const res = await fetchApi('/api/admin/compliance/sku-tax-rules', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update SKU tax rule');
    }
    return res.json();
  },

  async validateNpwpOrNik(
    npwpOrNik: string,
    b2bCustomerId?: string
  ): Promise<{
    valid: boolean;
    type: 'NPWP_16' | 'NIK_16' | 'NPWP_15' | 'INVALID';
    cleanDigits: string;
    formatted: string;
    error?: string;
  }> {
    const res = await fetchApi('/api/admin/compliance/validate-npwp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ npwpOrNik, b2bCustomerId }),
    });
    return res.json();
  },

  async getCoretaxExport(): Promise<{
    generatedAt: string;
    summary: {
      totalRows: number;
      totalPpnKeluaranIDR: number;
      totalNotaReturPpnIDR: number;
      b2bMissingNpwpCount: number;
    };
    rows: CoretaxExportRow[];
    csvContent: string;
    xmlContent: string;
  }> {
    const res = await fetchApi('/api/admin/compliance/coretax-export');
    if (!res.ok) {
      throw new Error('Failed to compile Coretax / e-Faktur DJP export');
    }
    return res.json();
  },

  // -------------------------------------------------------------
  // REAL-TIME ENTERPRISE NOTIFICATION CENTER APIS
  // -------------------------------------------------------------
  async getAdminNotifications(): Promise<{
    notifications: EnterpriseNotification[];
    unreadCount: number;
  }> {
    const res = await fetchApi('/api/admin/notifications');
    if (!res.ok) {
      return { notifications: [], unreadCount: 0 };
    }
    return res.json().catch(() => ({ notifications: [], unreadCount: 0 }));
  },

  async markNotificationsRead(payload: {
    id?: string;
    markAll?: boolean;
  }): Promise<{
    success: boolean;
    notifications: EnterpriseNotification[];
    unreadCount: number;
  }> {
    const res = await fetchApi('/api/admin/notifications/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to mark notifications as read');
    }
    return res.json();
  },

  async clearAdminNotifications(payload?: { onlyRead?: boolean }): Promise<{
    success: boolean;
    notifications: EnterpriseNotification[];
    unreadCount: number;
  }> {
    const res = await fetchApi('/api/admin/notifications/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || { onlyRead: true }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to clear notifications');
    }
    return res.json();
  },

  // -------------------------------------------------------------
  // MULTI-BRANCH NETWORK MONITOR & SYSTEM RESET APIS
  // -------------------------------------------------------------
  async getBranchMonitor(): Promise<BranchMonitorResponse> {
    const res = await fetchApi('/api/admin/settings/branch-monitor');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to load multi-branch network monitor');
    }
    return res.json();
  },

  async confirmBranchArrival(payload: {
    type: 'TRANSFER' | 'PO';
    id: string;
  }): Promise<ConfirmArrivalResponse> {
    const res = await fetchApi('/api/admin/settings/confirm-arrival', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to confirm incoming delivery arrival');
    }
    return data;
  },

  async getOperatorAssignments(): Promise<{
    assignments: OperatorBranchAssignment[];
    branchOptions: { storeId: string; storeName: string; hubType: string }[];
  }> {
    const res = await fetchApi('/api/admin/settings/operator-assignments');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to load operator branch assignments');
    }
    return data;
  },

  async updateOperatorAssignment(payload: {
    userId: string;
    storeId?: string;
    userRole?: UserRole;
    isActive?: boolean;
    loginPin?: string;
  }): Promise<{
    success: boolean;
    message: string;
    assignments: OperatorBranchAssignment[];
    updatedProfile: StaffShiftSession;
    currentSession: StaffShiftSession;
    availableProfiles: StaffShiftSession[];
  }> {
    const res = await fetchApi('/api/admin/settings/operator-assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to update operator branch assignment');
    }
    if (data?.currentSession) {
      setApiOperatorContext(data.currentSession);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('grocemart_admin_session', JSON.stringify(data.currentSession));
        } catch {}
      }
    }
    return data;
  },

  async resetDemoData(): Promise<{
    success: boolean;
    timestamp: string;
    batchesCount: number;
    message: string;
  }> {
    const res = await fetchApi('/api/admin/system/reset-demo-data', {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to reset demo data');
    }
    return res.json();
  },

  async getCommunicationGateway(): Promise<{
    config: CommunicationGatewayConfig;
    logs: CommunicationDispatchLog[];
    canEdit: boolean;
  }> {
    const res = await fetchApi('/api/admin/settings/communication-gateway');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to load communication gateway configuration');
    }
    return data;
  },

  async saveCommunicationGateway(
    config: CommunicationGatewayConfig
  ): Promise<{
    success: boolean;
    message: string;
    config: CommunicationGatewayConfig;
  }> {
    const res = await fetchApi('/api/admin/settings/communication-gateway', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to save communication gateway configuration');
    }
    return data;
  },

  async testEmailGateway(payload?: {
    recipientEmail?: string;
  }): Promise<{
    success: boolean;
    message: string;
    log: CommunicationDispatchLog;
  }> {
    const res = await fetchApi('/api/admin/communications/test-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to test SMTP connection');
    }
    return data;
  },

  async testWhatsappGateway(payload: {
    recipientPhone: string;
    recipientName?: string;
  }): Promise<{
    success: boolean;
    message: string;
    waMeUrl?: string;
    log: CommunicationDispatchLog;
  }> {
    const res = await fetchApi('/api/admin/communications/test-whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to send test WhatsApp message');
    }
    return data;
  },

  async sendDocumentCommunication(
    payload: SendDocumentDispatchPayload
  ): Promise<SendDocumentDispatchResponse> {
    const res = await fetchApi('/api/admin/communications/send-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to dispatch document');
    }
    return data;
  },

  // -------------------------------------------------------------
  // WAREHOUSE RACK TOPOLOGY, BULK CSV SKU/BATCH IMPORT & RACK BLIND OPNAME
  // -------------------------------------------------------------
  async getWarehouseRacks(storeId?: string): Promise<{
    racks: WarehouseRackConfig[];
  }> {
    const params = new URLSearchParams();
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') {
      params.append('storeId', storeId);
    }
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetchApi(`/api/admin/warehouse/racks${qs}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to load warehouse rack topology');
    }
    return data;
  },

  async saveWarehouseRack(payload: {
    id?: string;
    rackBinCode: string;
    storeId: string;
    storageZone: WarehouseRackStorageZone;
    rotationPolicy: RackRotationPolicy;
    maxCapacity: number;
    notes?: string;
  }): Promise<{
    success: boolean;
    rack: WarehouseRackConfig;
    racks: WarehouseRackConfig[];
    message: string;
  }> {
    const res = await fetchApi('/api/admin/warehouse/racks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to save warehouse rack configuration');
    }
    return data;
  },

  async assignSkuBatchToRack(payload: {
    storeId: string;
    sku: string;
    rackBinCode: string;
    rotationStrategy: RemovalStrategyType;
    batchId?: string;
  }): Promise<{
    success: boolean;
    message: string;
    rack: WarehouseRackConfig;
    updatedBatchesCount: number;
    removalStrategies: RemovalStrategyConfig;
  }> {
    const res = await fetchApi('/api/admin/warehouse/racks/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to assign SKU/batch to rack');
    }
    return data;
  },

  async importSkusCsv(payload: SkuCsvImportPayload): Promise<SkuCsvImportResult> {
    const res = await fetchApi('/api/admin/inventory/import-skus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to import SKUs and initial batches');
    }
    return data;
  },

  async getRackStocktakeSubmissions(storeId?: string): Promise<RackStocktakePendingSubmission[]> {
    const params = new URLSearchParams();
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') {
      params.append('storeId', storeId);
    }
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetchApi(`/api/admin/inventory/stocktake/submissions${qs}`);
    const data = await res.json().catch(() => ([]));
    if (!res.ok) {
      throw new Error((data as any)?.error || 'Failed to load rack stocktake history');
    }
    return Array.isArray(data) ? data : [];
  },

  async commitRackStocktake(payload: RackStocktakeCommitPayload): Promise<RackStocktakeCommitResponse> {
    const res = await fetchApi('/api/admin/inventory/stocktake/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to commit rack blind stock opname');
    }
    return data;
  },

  // -------------------------------------------------------------
  // PUTAWAY, CROSS-DOCK, REPACK/BUNDLE, RECALL, CONSIGNMENT & SAFE DROP
  // -------------------------------------------------------------
  async getQcPutawaySuggestion(payload: {
    sku: string;
    storeId: string;
    qty?: number;
    lotNumber?: string;
    storageZone?: string;
    category?: string;
  }): Promise<PutawaySuggestionResponse> {
    const res = await fetchApi('/api/admin/qc/putaway-suggestion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to compute directed putaway suggestion');
    return data;
  },

  async executeCrossDock(payload: CrossDockRequest): Promise<CrossDockResponse> {
    const res = await fetchApi('/api/admin/procurement/cross-dock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Cross-dock direct fulfillment failed');
    return data;
  },

  async executeRepackOrBundle(payload: RepackBundleRequest): Promise<RepackBundleResponse> {
    const res = await fetchApi('/api/admin/inventory/repack-bundle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Repack/Bundle operation failed');
    return data;
  },

  async getComplianceRecallTrace(lotNumber: string): Promise<ComplianceRecallTraceResponse> {
    const res = await fetchApi(`/api/admin/compliance/recall-trace/${encodeURIComponent(lotNumber)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to trace batch lot');
    return data;
  },

  async executeComplianceRecall(
    lotNumber: string,
    reason?: string
  ): Promise<{
    success: boolean;
    trace: ComplianceRecallTraceResponse;
    quarantinedBatchesCount: number;
    affectedUnits: number;
    message: string;
  }> {
    const res = await fetchApi(`/api/admin/compliance/recall-execute/${encodeURIComponent(lotNumber)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to execute batch recall freeze');
    return data;
  },

  async getConsignmentDashboard(
    storeId?: string,
    supplierName?: string
  ): Promise<{
    summary: {
      unsettledPayableIDR: number;
      settledTotalIDR: number;
      totalStoreCommissionIDR: number;
      totalUnsoldUnits: number;
      activeBatchesCount: number;
    };
    suppliers: string[];
    activeStock: InventoryBatch[];
    salesLedger: ConsignmentLedgerEntry[];
  }> {
    const params = new URLSearchParams();
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') params.append('storeId', storeId);
    if (supplierName && supplierName !== 'ALL') params.append('supplierName', supplierName);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetchApi(`/api/admin/accounting/consignment${qs}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to load consignment ledger');
    return data;
  },

  async settleConsignmentSupplier(payload: {
    supplierName?: string;
    ledgerIds?: string[];
  }): Promise<{
    success: boolean;
    vendorBill: VendorBill;
    settledCount: number;
    totalPayableIDR: number;
    glVoucherIds: string[];
    message: string;
  }> {
    const res = await fetchApi('/api/admin/accounting/consignment/settle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to settle consignment payables');
    return data;
  },

  async returnConsignmentStockRtv(payload: {
    batchId: string;
    quantity?: number;
    reason?: string;
  }): Promise<{
    success: boolean;
    batch: InventoryBatch;
    returnedQuantity: number;
    glImpactIDR: number;
    message: string;
  }> {
    const res = await fetchApi('/api/admin/accounting/consignment/rtv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to return consignment stock');
    return data;
  },

  async getPosSafeDrops(storeId?: string, shiftId?: string): Promise<SafeDropRecord[]> {
    const params = new URLSearchParams();
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') params.append('storeId', storeId);
    if (shiftId) params.append('shiftId', shiftId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetchApi(`/api/pos/safe-drops${qs}`);
    if (!res.ok) return [];
    return res.json().catch(() => []);
  },

  async createPosSafeDrop(payload: {
    storeId: string;
    shiftId?: string;
    amountIDR: number;
    supervisorName?: string;
    sealBagNumber?: string;
    notes?: string;
  }): Promise<{
    success: boolean;
    safeDrop: SafeDropRecord;
    shift: PosRegisterShiftSession;
    glVoucherIds: string[];
    message: string;
  }> {
    const res = await fetchApi('/api/pos/safe-drop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to log POS safe drop');
    return data;
  },

  // =============================================================
  // STANDALONE CRM, LOYALTY & B2B CUSTOMER 360 ENDPOINTS
  // =============================================================
  async searchPosCrmMembers(q?: string): Promise<
    Array<{
      id: string;
      accountType: CrmAccountType;
      name: string;
      companyName?: string;
      phone: string;
      email: string;
      tier: CrmLoyaltyTier;
      pointsBalance: number;
      contractDiscountPct: number;
    }>
  > {
    const qs = q && q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
    const res = await fetchApi(`/api/pos/crm-members${qs}`);
    if (!res.ok) return [];
    return res.json().catch(() => []);
  },

  async getCrmOverview(storeId?: string): Promise<CrmOverviewResponse> {
    const params = new URLSearchParams();
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') {
      params.append('storeId', storeId);
    }
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetchApi(`/api/admin/crm/overview${qs}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to load CRM & Loyalty 360 overview');
    return data;
  },

  async getCrmAccountHistory(id: string): Promise<{
    account: CrmAccount;
    posOrders: POSTransactionReceipt[];
    b2bOrders: B2BWholesaleOrder[];
    quotations: EnterpriseQuotation[];
    communications: CommunicationDispatchLog[];
    activities: CrmActivity[];
  }> {
    const res = await fetchApi(`/api/admin/crm/accounts/${encodeURIComponent(id)}/history`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to load customer 360 history');
    return data;
  },

  async createCrmAccount(payload: {
    accountType: CrmAccountType;
    name: string;
    companyName?: string;
    storeId?: string;
    phone: string;
    email?: string;
    tier?: CrmLoyaltyTier;
    pointsBalance?: number;
    contractDiscountPct?: number;
    creditLimitIDR?: number;
    paymentTerms?: 'CASH' | 'NET_7' | 'NET_14' | 'NET_30';
    preferredCategories?: string[];
    notes?: string;
  }): Promise<{ success: boolean; account: CrmAccount; message: string }> {
    const res = await fetchApi('/api/admin/crm/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to create CRM account');
    return data;
  },

  async updateCrmAccount(
    id: string,
    payload: Partial<
      Pick<
        CrmAccount,
        | 'name'
        | 'companyName'
        | 'phone'
        | 'email'
        | 'tier'
        | 'contractDiscountPct'
        | 'creditLimitIDR'
        | 'paymentTerms'
        | 'preferredCategories'
        | 'notes'
      >
    >
  ): Promise<{ success: boolean; account: CrmAccount; message: string }> {
    const res = await fetchApi(`/api/admin/crm/accounts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to update CRM account');
    return data;
  },

  async createCrmDeal(payload: {
    title: string;
    crmAccountId?: string;
    companyName?: string;
    contactName?: string;
    contactPhone?: string;
    contactEmail?: string;
    storeId?: string;
    stage?: CrmDealStage;
    estimatedMonthlyValueIDR: number;
    nextActivity?: string;
    nextActivityDate?: string;
    notes?: string;
  }): Promise<{ success: boolean; deal: CrmDeal; message: string }> {
    const res = await fetchApi('/api/admin/crm/deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to create CRM deal');
    return data;
  },

  async updateCrmDealStage(
    id: string,
    stage: CrmDealStage
  ): Promise<{ success: boolean; deal: CrmDeal; onboardedAccount?: CrmAccount; message: string }> {
    const res = await fetchApi(`/api/admin/crm/deals/${encodeURIComponent(id)}/stage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to update deal stage');
    return data;
  },

  async convertCrmDealToQuotation(id: string): Promise<{
    success: boolean;
    deal: CrmDeal;
    quotation: EnterpriseQuotation;
    message: string;
  }> {
    const res = await fetchApi(`/api/admin/crm/deals/${encodeURIComponent(id)}/convert-quotation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to convert deal to quotation');
    return data;
  },

  async createCrmActivity(payload: {
    crmAccountId?: string;
    dealId?: string;
    type: CrmActivity['type'];
    subject: string;
    outcome?: string;
  }): Promise<{ success: boolean; activity: CrmActivity; message: string }> {
    const res = await fetchApi('/api/admin/crm/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to log CRM activity');
    return data;
  },

  async dispatchCrmCampaign(payload: {
    channel: 'email' | 'whatsapp' | 'both';
    segment?: CrmRfmSegment | 'ALL';
    accountIds?: string[];
    campaignTitle: string;
    messageTemplate: string;
    voucherCode?: string;
  }): Promise<{
    success: boolean;
    campaignRef: string;
    recipientCount: number;
    dispatchCount: number;
    waMeUrl?: string;
    logs: CommunicationDispatchLog[];
    message: string;
  }> {
    const res = await fetchApi('/api/admin/crm/campaigns/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to dispatch CRM campaign');
    return data;
  },
};




