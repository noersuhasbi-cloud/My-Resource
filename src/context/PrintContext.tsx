import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type {
  B2BCustomer,
  B2BWholesaleOrder,
  BalanceSheetReport,
  BatchRecallTraceResult,
  CashFlowStatementReport,
  ChartOfAccount,
  CustomerRmaRecord,
  DeliveryOrderDocument,
  EnterpriseQuotation,
  EnterpriseSettingsConfig,
  GeneralLedgerEntry,
  GiroPaymentRecord,
  GroceryMetricsReport,
  OmzetAnalyticsReport,
  Order,
  POSTransactionReceipt,
  PosRegisterShiftSession,
  ProfitAndLossReport,
  ShipmentQuotaTracking,
  SupportedCurrency,
  SuratJalanDocument,
  VendorBill,
  VendorCreditNote,
  VendorRtvDebitNote,
  BatchMarkdownCandidate,
  SafeDropRecord,
} from '../types/index.ts';
import type { LabelableProductItem } from '../components/AdminDashboard/BarcodeShelfLabelModal';
import type { AccountingSubTab } from '../components/AdminDashboard/AdminSidebar';
import { apiClient } from '../services/apiClient';

export type PrintFormat = 'thermal80' | 'label50x30' | 'a4';

export type PrintPayload =
  | {
      type: 'pos_receipt';
      format: 'thermal80';
      receipt: POSTransactionReceipt;
    }
  | {
      type: 'pos_zreport';
      format: 'thermal80';
      shift: PosRegisterShiftSession;
    }
  | {
      type: 'pos_safe_drop';
      format: 'thermal80';
      safeDrop: SafeDropRecord;
    }
  | {
      type: 'b2c_receipt';
      format: 'thermal80';
      order: Order;
    }
  | {
      type: 'clearance_sticker';
      format: 'label50x30';
      candidate: BatchMarkdownCandidate;
    }
  | {
      type: 'barcode_shelf_label';
      format: 'label50x30';
      product: LabelableProductItem;
      ean13Code: string;
      barBits: string;
      plu5: string;
      weightGrams: number;
      effectivePricePerKg: number;
      computedWeighedPrice: number;
      shelfRetailPrice: number;
      pricePer100g: number;
      taxInclusiveDisplay: boolean;
      isHalalCertified: boolean;
      promoText: string;
      labelMode: 'BOTH' | 'SCALE_ONLY' | 'SHELF_ONLY';
    }
  | {
      type: 'logistics_doc';
      format: 'a4';
      activeTab: 'surat_jalan' | 'delivery_orders' | 'shipment_quota';
      selectedSj: SuratJalanDocument | null;
      deliveryOrders: DeliveryOrderDocument[];
      shipments: ShipmentQuotaTracking[];
    }
  | {
      type: 'b2b_invoice';
      format: 'a4';
      order: B2BWholesaleOrder;
    }
  | {
      type: 'bilyet_giro_slip';
      format: 'a4';
      giro: GiroPaymentRecord;
    }
  | {
      type: 'waste_rma_slip';
      format: 'a4';
      rma: VendorCreditNote;
    }
  | {
      type: 'vendor_bill';
      format: 'a4';
      bill: VendorBill;
    }
  | {
      type: 'nota_retur_customer';
      format: 'a4';
      rma: CustomerRmaRecord;
    }
  | {
      type: 'nota_retur_vendor';
      format: 'a4';
      rtv: VendorRtvDebitNote;
    }
  | {
      type: 'executive_report';
      format: 'a4';
      selectedGlobalStore: string;
      preparedBy?: string;
      omzetData: OmzetAnalyticsReport | null;
      inventoryMetrics: {
        totalValuationWAC: number;
        lowStockCount: number;
        totalStockCount: number;
      };
    }
  | {
      type: 'accounting_statement';
      format: 'a4';
      subTab: AccountingSubTab;
      selectedStore: string;
      selectedCurrency: SupportedCurrency;
      fxRate: number;
      fxSymbol: string;
      pnlReport: ProfitAndLossReport | null;
      balanceSheet: BalanceSheetReport | null;
      cashFlow: CashFlowStatementReport | null;
      filteredLedger: GeneralLedgerEntry[];
      filteredCOA: ChartOfAccount[];
      b2bCustomers: B2BCustomer[];
      giroRecords: GiroPaymentRecord[];
      vendorBills?: VendorBill[];
    }
  | {
      type: 'quotation';
      format: 'a4';
      quotation: EnterpriseQuotation;
      termsText?: string;
    }
  | {
      type: 'grocery_analytics';
      format: 'a4';
      selectedStore: string;
      activeTab: 'all' | 'fifo' | 'waste' | 'fulfillment' | 'recall';
      operatorName?: string;
      reportData: GroceryMetricsReport | null;
      recallTraceResult?: BatchRecallTraceResult | null;
    }
  | {
      type: 'blind_count_sheet';
      format: 'a4';
      sheetTitle: string;
      storeId: string;
      storeName: string;
      storageZone: string;
      rackBinCode: string;
      rotationPolicy?: string;
      preparedBy: string;
      items: Array<{
        sku: string;
        productName: string;
        rackBinCode: string;
        lotNumber: string;
        expiryDate: string;
        uom: string;
        statusLabel?: string;
      }>;
    };

interface PrintTriggerOptions {
  skipPreview?: boolean;
}

export type InvoiceTrackingFlags = EnterpriseSettingsConfig['invoiceTracking'];

interface PrintContextValue {
  activePrintPayload: PrintPayload | null;
  isPreviewOpen: boolean;
  invoiceTracking: InvoiceTrackingFlags;
  triggerPrint: (payload: PrintPayload, options?: PrintTriggerOptions) => void;
  executePrint: () => void;
  clearPrint: () => void;
}

const PrintContext = createContext<PrintContextValue | undefined>(undefined);

const PAGE_CSS_BY_FORMAT: Record<PrintFormat, string> = {
  thermal80: '@page { size: 80mm auto; margin: 3mm; }',
  label50x30: '@page { size: 50mm 30mm; margin: 1.5mm; }',
  a4: '@page { size: A4 portrait; margin: 14mm; }',
};

function applyDynamicPageStyle(format: PrintFormat | null) {
  if (typeof document === 'undefined') return;
  const styleId = 'dynamic-print-page-style';
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!format) {
    if (styleEl) styleEl.textContent = '';
    return;
  }
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = PAGE_CSS_BY_FORMAT[format];
}

const DEFAULT_INVOICE_TRACKING: InvoiceTrackingFlags = {
  displayLotsOnInvoices: true,
  displaySerialExpiryOnDeliveryDocs: true,
  requireLotScanOnFulfillment: true,
};

export const PrintProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activePrintPayload, setActivePrintPayload] = useState<PrintPayload | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [invoiceTracking, setInvoiceTracking] = useState<InvoiceTrackingFlags>(DEFAULT_INVOICE_TRACKING);
  const printTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const refreshInvoiceTracking = useCallback(() => {
    apiClient
      .getInvoiceTrackingSettings()
      .then((res) => {
        if (res && typeof res.displayLotsOnInvoices === 'boolean') {
          setInvoiceTracking(res);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshInvoiceTracking();
  }, [refreshInvoiceTracking]);

  const cancelScheduledPrint = useCallback(() => {
    if (printTimerRef.current !== null) {
      window.clearTimeout(printTimerRef.current);
      printTimerRef.current = null;
    }
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const clearPrint = useCallback(() => {
    cancelScheduledPrint();
    setIsPreviewOpen(false);
    setActivePrintPayload(null);
    applyDynamicPageStyle(null);
  }, [cancelScheduledPrint]);

  useEffect(() => {
    const handleAfterPrint = () => {
      clearPrint();
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
      clearPrint();
    };
  }, [clearPrint]);

  const executePrint = useCallback(() => {
    cancelScheduledPrint();
    // Wait a frame + 50ms so React flushes the isolated portal DOM and dynamic @page rule
    rafRef.current = window.requestAnimationFrame(() => {
      printTimerRef.current = window.setTimeout(() => {
        window.print();
      }, 50);
    });
  }, [cancelScheduledPrint]);

  const triggerPrint = useCallback(
    (payload: PrintPayload, options?: PrintTriggerOptions) => {
      cancelScheduledPrint();
      applyDynamicPageStyle(payload.format);
      setActivePrintPayload(payload);
      if (
        payload.type === 'b2c_receipt' ||
        payload.type === 'b2b_invoice' ||
        payload.type === 'logistics_doc' ||
        payload.type === 'pos_receipt'
      ) {
        refreshInvoiceTracking();
      }

      if (options?.skipPreview) {
        setIsPreviewOpen(false);
        executePrint();
      } else {
        setIsPreviewOpen(true);
      }
    },
    [cancelScheduledPrint, executePrint, refreshInvoiceTracking]
  );

  return (
    <PrintContext.Provider
      value={{ activePrintPayload, isPreviewOpen, invoiceTracking, triggerPrint, executePrint, clearPrint }}
    >
      {children}
    </PrintContext.Provider>
  );
};

export function usePrint(): PrintContextValue {
  const ctx = useContext(PrintContext);
  if (!ctx) {
    throw new Error('usePrint must be used within a PrintProvider');
  }
  return ctx;
}
