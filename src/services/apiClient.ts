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
} from '../types/index.ts';

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
};
