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

  async updateStoreStatus(update: Partial<StoreOperationalStatus>): Promise<{ success: boolean; storeStatus: StoreOperationalStatus }> {
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

  async updateStoreOutlet(storeId: string, update: Partial<StoreOutletSchedule>): Promise<{ success: boolean; outlet: StoreOutletSchedule }> {
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
};
