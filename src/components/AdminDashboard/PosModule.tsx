import React, { useState, useEffect, useMemo } from 'react';
import type {
  POSProductItem,
  POSCartItem,
  POSPaymentMethod,
  POSTransactionRequest,
  POSTransactionReceipt,
  SupportedCurrency,
  StaffShiftSession,
  StoreOutletSchedule,
  StoreOperationalStatus,
  PosCheckoutConfig,
  POSHardwarePeripheralStatus,
  ThermalPrintReceiptPayload,
  POSReturnRecord,
  POSReturnItemLine,
  ReturnCageDisposition,
  RefundPaymentChannel,
  PromotionRule,
  MemberLoyaltyTier,
  AppliedPromotionSummary,
} from '../../types/index.ts';
import { apiClient } from '../../services/apiClient';
import { savePosReceiptToFirestore } from '../../services/firebaseService';
import { formatIDR } from '../../utils/formatters';
import {
  TaxRegionCode,
  TAX_REGIONS,
  calculateCartTax,
  getDefaultTaxRegionForCurrency,
} from '../../utils/taxEngine';
import {
  UOMSystem,
  formatDualUnitPrice,
  formatDualWeight,
} from '../../utils/uomConverter';
import {
  generateEscPosReceipt,
  triggerCashDrawerKick,
  setupBarcodeScannerListener,
  createDigitalScaleSession,
  playBeepSuccess,
  playCashDrawerChime,
  DigitalScaleReading,
} from '../../utils/posHardware';
import {
  evaluateCartPromotions,
  detectMemberTier,
  INITIAL_PROMOTION_RULES,
} from '../../utils/promotionEngine';
import { QRCodeCanvas } from 'qrcode.react';
import {
  Scan,
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Scale,
  QrCode,
  CreditCard,
  Banknote,
  ReceiptText,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Clock,
  Store,
  RefreshCw,
  Tag,
  Percent,
  UserCheck,
  Printer,
  ArrowUpRight,
  Layers,
  Package,
  Sparkles,
  PauseCircle,
  PlayCircle,
  X,
  Check,
  Building2,
  FileCheck2,
  Globe2,
  Barcode,
  RotateCcw,
  Undo2,
  Cpu,
  Coins,
  Eye,
  Gift,
  SlidersHorizontal,
  Volume2,
} from 'lucide-react';

export interface PosModuleProps {
  theme: 'light' | 'dark';
  selectedStore: string;
  activeStaffSession: StaffShiftSession | null;
  availableStaffProfiles: StaffShiftSession[];
  storeOutlets: StoreOutletSchedule[];
  storeStatus?: StoreOperationalStatus | null;
  onSwitchSession: (userId: string) => Promise<void>;
  onTransactionSynced: () => Promise<void>;
  onNavigateToAccounting?: (subTab: 'pnl' | 'balance_sheet' | 'cash_flow' | 'gl' | 'coa') => void;
  onShowToast: (title: string, message: string) => void;
}

const POS_CURRENCIES: Record<
  SupportedCurrency,
  { code: SupportedCurrency; symbol: string; rateToIDR: number; decimals: number; label: string }
> = {
  IDR: { code: 'IDR', symbol: 'Rp', rateToIDR: 1, decimals: 0, label: 'IDR (Rupiah)' },
  USD: { code: 'USD', symbol: '$', rateToIDR: 16000, decimals: 2, label: 'USD (US Dollar)' },
  EUR: { code: 'EUR', symbol: '€', rateToIDR: 17200, decimals: 2, label: 'EUR (Euro)' },
  AUD: { code: 'AUD', symbol: 'A$', rateToIDR: 10400, decimals: 2, label: 'AUD (Aus Dollar)' },
};

interface HeldOrder {
  id: string;
  customerName: string;
  savedAt: string;
  items: POSCartItem[];
  discountPercent: number;
  notes: string;
}

/**
 * Bridge function that executes POS Checkout and triggers atomic backend
 * multi-warehouse stock deduction, Vivo/FEFO batch consumption, and General Ledger / PnL sync,
 * plus cloud persistence in Firestore.
 */
export async function syncPosCheckoutWithInventoryAndAccounting(
  payload: POSTransactionRequest,
  onErpStateRefresh?: () => Promise<void>
): Promise<{
  success: boolean;
  receipt: POSTransactionReceipt;
  message: string;
}> {
  const response = await apiClient.posCheckout(payload);
  if (response.success && response.receipt) {
    const r = response.receipt;
    await savePosReceiptToFirestore({
      receiptId: r.receiptNumber,
      storeId: r.storeId,
      storeName: r.storeName,
      cashierId: r.cashierId,
      cashierName: r.cashierName,
      paymentMethod: r.paymentMethod.toUpperCase(),
      currency: r.currency,
      grandTotalIDR: r.total,
      totalCogsIDR: r.totalCogsCost,
      timestamp: r.timestamp,
      items: r.items,
      glEntriesCreated: r.journalEntryIds,
    });
    if (onErpStateRefresh) {
      await onErpStateRefresh();
    }
  }
  return response;
}

export const PosModule: React.FC<PosModuleProps> = ({
  theme,
  selectedStore,
  activeStaffSession,
  availableStaffProfiles,
  storeOutlets,
  storeStatus,
  onSwitchSession,
  onTransactionSynced,
  onNavigateToAccounting,
  onShowToast,
}) => {
  const isLight = theme === 'light';
  const isNetworkClosed = Boolean(storeStatus && (!storeStatus.isOpen || storeStatus.isHolidayMode));

  // Active Store Outlet for POS Terminal (defaults to selectedStore or cashier's store or Senopati Flagship)
  const [posStoreId, setPosStoreId] = useState<string>(() => {
    if (selectedStore && selectedStore !== 'CONSOLIDATED' && selectedStore !== 'ALL') {
      return selectedStore;
    }
    if (
      activeStaffSession?.storeId &&
      activeStaffSession.storeId !== 'ALL' &&
      activeStaffSession.storeId !== 'CONSOLIDATED'
    ) {
      return activeStaffSession.storeId;
    }
    return 'store-jkt-senopati';
  });

  useEffect(() => {
    if (selectedStore && selectedStore !== 'CONSOLIDATED' && selectedStore !== 'ALL') {
      setPosStoreId(selectedStore);
    }
  }, [selectedStore]);

  // Sub-view mode: 'register' | 'returns' | 'hardware' | 'history'
  const [posViewMode, setPosViewMode] = useState<'register' | 'returns' | 'hardware' | 'history'>('register');

  // POS Catalog & History State
  const [posProducts, setPosProducts] = useState<POSProductItem[]>([]);
  const [posHistory, setPosHistory] = useState<POSTransactionReceipt[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(true);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState<boolean>(false);

  // Search, Category & Barcode Input
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Multi-Currency Selector & Global Compliance Tax / UOM Engine
  const [currency, setCurrency] = useState<SupportedCurrency>('IDR');
  const currencyConfig = POS_CURRENCIES[currency];
  const [taxRegion, setTaxRegion] = useState<TaxRegionCode>('ID_PPN_11');
  const [uomSystem, setUomSystem] = useState<UOMSystem>('metric');

  // POS Cart State
  const [cart, setCart] = useState<POSCartItem[]>([]);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [applyVivoNearExpiryDiscount, setApplyVivoNearExpiryDiscount] = useState<boolean>(false);
  const [customerName, setCustomerName] = useState<string>('Walk-In Customer');
  const [customerMemberId, setCustomerMemberId] = useState<string>('');
  const [orderNotes, setOrderNotes] = useState<string>('');

  // Payment Method & Tender State
  const [paymentMethod, setPaymentMethod] = useState<POSPaymentMethod>('qris');
  const [cashTenderedIDR, setCashTenderedIDR] = useState<number>(0);

  // Digital Catch-Weight Scale Modal State (for produce / meat / weighted items)
  const [weighingProduct, setWeighingProduct] = useState<POSProductItem | null>(null);
  const [grossWeightGrams, setGrossWeightGrams] = useState<number>(550);
  const [tareWeightGrams, setTareWeightGrams] = useState<number>(25);

  // Hold / Recall Orders
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);

  // Completed Receipt Modal
  const [activeReceiptModal, setActiveReceiptModal] = useState<POSTransactionReceipt | null>(null);

  // -------------------------------------------------------------
  // MODULE 1: POS HARDWARE & PERIPHERAL INTEGRATION LAYER STATE
  // -------------------------------------------------------------
  const [hardwareStatus, setHardwareStatus] = useState<POSHardwarePeripheralStatus | null>(null);
  const [isKickingDrawer, setIsKickingDrawer] = useState<boolean>(false);
  const [isTestingPrinter, setIsTestingPrinter] = useState<boolean>(false);
  const [printedSlipModal, setPrintedSlipModal] = useState<string | null>(null);
  const [scannerWedgeActive, setScannerWedgeActive] = useState<boolean>(true);
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string>('');
  const [scaleReading, setScaleReading] = useState<DigitalScaleReading | null>(null);
  const [simulatedScannerInput, setSimulatedScannerInput] = useState<string>('8999999001014');

  // -------------------------------------------------------------
  // MODULE 2: REVERSE LOGISTICS & RETURNS / REFUNDS / EXCHANGES STATE
  // -------------------------------------------------------------
  const [returnsList, setReturnsList] = useState<POSReturnRecord[]>([]);
  const [isLoadingReturns, setIsLoadingReturns] = useState<boolean>(false);
  const [returnReceiptQuery, setReturnReceiptQuery] = useState<string>('');
  const [searchedReturnReceipt, setSearchedReturnReceipt] = useState<POSTransactionReceipt | null>(null);
  const [isSearchingReceipt, setIsSearchingReceipt] = useState<boolean>(false);
  const [returnLineSelections, setReturnLineSelections] = useState<
    Record<
      string,
      {
        selected: boolean;
        quantity: number;
        condition: ReturnCageDisposition;
        reason: string;
      }
    >
  >({});
  const [refundChannel, setRefundChannel] = useState<RefundPaymentChannel>('CASH');
  const [returnCustomerName, setReturnCustomerName] = useState<string>('');
  const [returnCustomerPhone, setReturnCustomerPhone] = useState<string>('');
  const [isProcessingReturn, setIsProcessingReturn] = useState<boolean>(false);
  const [returnSuccessModal, setReturnSuccessModal] = useState<{
    record: POSReturnRecord;
    glVouchers: string[];
    slipText: string;
  } | null>(null);

  // -------------------------------------------------------------
  // MODULE 3: PROMOTION & LOYALTY ENGINE STATE
  // -------------------------------------------------------------
  const [promoRules, setPromoRules] = useState<PromotionRule[]>(INITIAL_PROMOTION_RULES);
  const [couponCodeInput, setCouponCodeInput] = useState<string>('');
  const [appliedCouponCode, setAppliedCouponCode] = useState<string>('');
  const [selectedMemberTier, setSelectedMemberTier] = useState<MemberLoyaltyTier>('BRONZE');

  // Format value in active currency
  const formatCurrencyValue = (idrAmount: number): string => {
    if (currency === 'IDR') {
      return formatIDR(Math.round(idrAmount));
    }
    const converted = idrAmount / currencyConfig.rateToIDR;
    return `${currencyConfig.symbol}${converted.toLocaleString('en-US', {
      minimumFractionDigits: currencyConfig.decimals,
      maximumFractionDigits: currencyConfig.decimals,
    })}`;
  };

  // Load POS Catalog & Receipt History for active store outlet
  const loadPosData = async (targetStore = posStoreId) => {
    setIsLoadingCatalog(true);
    try {
      const [productsRes, historyRes] = await Promise.all([
        apiClient.getPosProducts(targetStore),
        apiClient.getPosHistory(targetStore),
      ]);
      setPosProducts(productsRes || []);
      setPosHistory(historyRes || []);
    } catch (err) {
      console.error('Failed to load POS catalog:', err);
      onShowToast('POS Sync Error', String(err));
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  // Load hardware status
  const loadHardwareStatus = async () => {
    try {
      const status = await apiClient.getHardwareStatus();
      setHardwareStatus(status);
    } catch (e) {
      console.warn('Could not load hardware status:', e);
    }
  };

  // Load returns list
  const loadReturnsList = async () => {
    setIsLoadingReturns(true);
    try {
      const data = await apiClient.getPosReturns(posStoreId);
      setReturnsList(data || []);
    } catch (e) {
      console.warn('Could not load POS returns:', e);
    } finally {
      setIsLoadingReturns(false);
    }
  };

  // Load active promotion rules
  const loadPromotionRules = async () => {
    try {
      const data = await apiClient.getPromotions();
      if (data && data.length > 0) setPromoRules(data);
    } catch (e) {
      console.warn('Could not load promotion rules:', e);
    }
  };

  useEffect(() => {
    loadPosData(posStoreId);
    loadHardwareStatus();
    loadPromotionRules();
  }, [posStoreId]);

  useEffect(() => {
    if (posViewMode === 'returns') {
      loadReturnsList();
    }
  }, [posViewMode, posStoreId]);

  // Global Barcode Scanner Wedge Listener
  useEffect(() => {
    if (!scannerWedgeActive) return;
    const cleanup = setupBarcodeScannerListener({
      onScan: (scanned) => {
        playBeepSuccess();
        setLastScannedBarcode(scanned);
        if (posViewMode === 'returns') {
          setReturnReceiptQuery(scanned);
          handleSearchReturnReceipt(scanned);
        } else {
          const matched = posProducts.find(
            (p) =>
              p.barcode === scanned ||
              p.sku.toLowerCase() === scanned.toLowerCase() ||
              p.name.toLowerCase().includes(scanned.toLowerCase())
          );
          if (matched) {
            handleAddToCart(matched);
            onShowToast('Barcode Scanned', `${matched.name} added to register cart.`);
          } else {
            onShowToast('Barcode Not Found', `Scanned code "${scanned}" not matched to catalog.`);
          }
        }
      },
    });
    return cleanup;
  }, [scannerWedgeActive, posViewMode, posProducts]);

  // Digital Scale Streaming Session
  useEffect(() => {
    if (!weighingProduct) {
      setScaleReading(null);
      return;
    }
    const session = createDigitalScaleSession(grossWeightGrams, tareWeightGrams, (reading) => {
      setScaleReading(reading);
    });
    return () => {
      session.stop();
    };
  }, [weighingProduct, grossWeightGrams, tareWeightGrams]);

  // Hardware Diagnostic Handlers
  const handleKickDrawer = async () => {
    setIsKickingDrawer(true);
    try {
      playCashDrawerChime();
      const res = await apiClient.kickCashDrawer(250, activeStaffSession?.userName);
      if (res.status) setHardwareStatus(res.status);
      onShowToast('Cash Drawer Triggered', '24V DC solenoid pulse sent (ESC p 0 25 250). Drawer open.');
    } catch (e: any) {
      onShowToast('Cash Drawer Error', e.message);
    } finally {
      setIsKickingDrawer(false);
    }
  };

  const handleTestPrintThermalReceipt = async (widthMm: 58 | 80 = 80) => {
    setIsTestingPrinter(true);
    try {
      const res = await apiClient.testPrintThermalReceipt(widthMm, currentOutlet.storeName);
      if (res.status) setHardwareStatus(res.status);
      setPrintedSlipModal(res.slipText);
      onShowToast('Thermal Receipt Printed', `ESC/POS receipt sent to ${widthMm}mm thermal printer.`);
    } catch (e: any) {
      onShowToast('Printer Error', e.message);
    } finally {
      setIsTestingPrinter(false);
    }
  };

  const handleScaleTare = async () => {
    try {
      const res = await apiClient.scaleTare(tareWeightGrams);
      if (res.status) setHardwareStatus(res.status);
      onShowToast('Scale Tared', `Container tare set to ${tareWeightGrams}g.`);
    } catch (e: any) {
      onShowToast('Scale Error', e.message);
    }
  };

  const handleScaleZero = async () => {
    try {
      const res = await apiClient.scaleZero();
      if (res.status) setHardwareStatus(res.status);
      setGrossWeightGrams(0);
      onShowToast('Scale Zeroed', 'Digital scale zero calibration complete.');
    } catch (e: any) {
      onShowToast('Scale Error', e.message);
    }
  };

  // Reverse Logistics Returns Handlers
  const handleSearchReturnReceipt = async (query?: string) => {
    const q = (query || returnReceiptQuery).trim();
    if (!q) {
      onShowToast('Search Required', 'Enter receipt number or customer order ID.');
      return;
    }
    setIsSearchingReceipt(true);
    try {
      const found = await apiClient.lookupReturnReceipt(q);
      if (found && found.receiptNumber) {
        setSearchedReturnReceipt(found);
        const initialSelections: Record<string, any> = {};
        found.items.forEach((item: any) => {
          initialSelections[item.sku] = {
            selected: true,
            quantity: item.quantity,
            condition: 'RESTOCK_INVENTORY',
            reason: 'Customer return (verified unopened)',
          };
        });
        setReturnLineSelections(initialSelections);
        setReturnCustomerName(found.customerName || 'Walk-In Customer');
        onShowToast('Receipt Found', `Loaded receipt ${found.receiptNumber} with ${found.items.length} items.`);
      } else {
        onShowToast('Receipt Not Found', `No active POS transaction found matching "${q}".`);
      }
    } catch (e: any) {
      onShowToast('Lookup Error', e.message || 'Receipt not found');
    } finally {
      setIsSearchingReceipt(false);
    }
  };

  const handleProcessReturn = async () => {
    if (!searchedReturnReceipt) return;
    const selectedSkus = Object.entries(returnLineSelections).filter(([_, val]) => val.selected && val.quantity > 0);
    if (selectedSkus.length === 0) {
      onShowToast('Selection Required', 'Select at least one line item to return.');
      return;
    }

    setIsProcessingReturn(true);
    try {
      const itemsPayload = selectedSkus.map(([sku, config]) => {
        const orig = searchedReturnReceipt.items.find((it) => it.sku === sku);
        return {
          sku,
          productName: orig?.name || sku,
          quantity: config.quantity,
          unitPrice: orig?.unitPrice || 0,
          originalLineTotal: (orig?.unitPrice || 0) * config.quantity,
          refundAmount: (orig?.unitPrice || 0) * config.quantity,
          returnReason: config.reason || 'Customer request',
          disposition: config.condition,
          condition: config.condition === 'RESTOCK_INVENTORY' ? 'GOOD_FOR_RESALE' : 'DAMAGED_EXPIRED',
        };
      });

      const res = await apiClient.processPosReturn({
        originalReceiptNumber: searchedReturnReceipt.receiptNumber,
        originalOrderId: searchedReturnReceipt.receiptNumber,
        storeId: posStoreId,
        processedByUserId: activeStaffSession?.userId || 'USR-CASH-01',
        processedByUserName: activeStaffSession?.userName || 'Frontline Cashier',
        items: itemsPayload,
        refundChannel,
        customerName: returnCustomerName || searchedReturnReceipt.customerName,
        customerPhone: returnCustomerPhone,
      });

      if (res.success) {
        if (refundChannel === 'CASH') {
          playCashDrawerChime();
          apiClient.kickCashDrawer(250, activeStaffSession?.userName).catch(() => {});
        }
        setReturnSuccessModal({
          record: res.returnRecord,
          glVouchers: res.glVouchers,
          slipText: res.slipText,
        });
        setSearchedReturnReceipt(null);
        setReturnReceiptQuery('');
        setReturnLineSelections({});
        await loadReturnsList();
        await onTransactionSynced();
        onShowToast(
          'Return & Refund Processed',
          `Return ${res.returnRecord.returnNumber} posted! GL vouchers created: ${res.glVouchers.join(', ')}`
        );
      }
    } catch (e: any) {
      onShowToast('Return Processing Error', e.message || 'Failed to process return');
    } finally {
      setIsProcessingReturn(false);
    }
  };

  // Active store metadata
  const currentOutlet = useMemo(() => {
    return (
      storeOutlets.find((o) => o.storeId === posStoreId) || {
        storeId: posStoreId,
        storeName:
          posStoreId === 'store-jkt-senopati'
            ? 'GroceMart Senopati Flagship'
            : posStoreId,
        isEmergencyClosed: false,
        closureReason: undefined as string | undefined,
        openTime: '07:00',
        closeTime: '22:00',
      }
    );
  }, [storeOutlets, posStoreId]);

  // Add item to POS Cart (with FEFO / Vivo batch assignment & stock check)
  const handleAddToCart = (product: POSProductItem, customWeightKg?: number, tareGrams?: number, grossGrams?: number) => {
    if (product.availableStock <= 0) {
      onShowToast(
        'Out of Stock at Outlet',
        `${product.name} (${product.sku}) has 0 available stock at ${currentOutlet.storeName}.`
      );
      return;
    }

    const isWeightCustom = typeof customWeightKg === 'number' && customWeightKg > 0;
    const addQty = isWeightCustom ? Number(customWeightKg.toFixed(3)) : 1;

    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.sku === product.sku);
      if (existingIndex > -1 && !isWeightCustom) {
        const existing = prev[existingIndex];
        const nextQty = Number((existing.quantity + addQty).toFixed(3));
        if (nextQty > product.availableStock) {
          onShowToast(
            'Stock Limit Reached',
            `Only ${product.availableStock} ${product.unit} available in ${currentOutlet.storeName}.`
          );
          return prev;
        }
        const unitPrice = product.isWeighted && product.pricePerKg ? product.pricePerKg : product.sellingPrice;
        const updated: POSCartItem = {
          ...existing,
          quantity: nextQty,
          lineTotal: Math.round(nextQty * unitPrice),
        };
        const clone = [...prev];
        clone[existingIndex] = updated;
        return clone;
      }

      if (addQty > product.availableStock) {
        onShowToast(
          'Stock Limit Reached',
          `Requested quantity (${addQty}) exceeds available outlet stock (${product.availableStock}).`
        );
        return prev;
      }

      const effectiveUnitPrice =
        isWeightCustom && product.pricePerKg ? product.pricePerKg : product.sellingPrice;
      const effectiveUnitLabel = isWeightCustom ? 'kg' : product.unit;

      const newLine: POSCartItem = {
        id: `POS-LINE-${product.sku}-${Date.now()}`,
        sku: product.sku,
        productId: product.productId,
        name: product.name,
        category: product.category,
        unitPrice: effectiveUnitPrice,
        unitCost: product.unitCost,
        quantity: addQty,
        unit: effectiveUnitLabel,
        isWeighted: Boolean(product.isWeighted || isWeightCustom),
        tareWeightGrams: tareGrams,
        grossWeightGrams: grossGrams,
        netWeightGrams: isWeightCustom ? Math.round(addQty * 1000) : undefined,
        batchId: product.nearestBatchId,
        lotNumber: product.lotNumber,
        expiryDate: product.expiryDate,
        daysUntilExpiry: product.daysUntilExpiry,
        lineTotal: Math.round(addQty * effectiveUnitPrice),
        image: product.image,
      };

      return [newLine, ...prev];
    });
  };

  // Barcode / SKU Scanner Handler
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;

    const matched = posProducts.find(
      (p) =>
        p.barcode === code ||
        p.sku.toLowerCase() === code.toLowerCase() ||
        p.name.toLowerCase().includes(code.toLowerCase())
    );

    if (matched) {
      handleAddToCart(matched);
      setBarcodeInput('');
      onShowToast(
        'Barcode Scanned',
        `${matched.name} (${matched.sku}) • FEFO Batch ${matched.nearestBatchId} added.`
      );
    } else {
      onShowToast('Barcode Not Found', `No active SKU or EAN-13 barcode matched "${code}".`);
    }
  };

  // Update Cart Line Quantity
  const handleUpdateQty = (lineId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id !== lineId) return item;
          const product = posProducts.find((p) => p.sku === item.sku);
          const maxStock = product ? product.availableStock : 999;
          const step = item.unit === 'kg' ? Number((delta * 0.25).toFixed(2)) : delta;
          const nextQty = Number((item.quantity + step).toFixed(2));
          if (nextQty <= 0) return null;
          if (nextQty > maxStock) {
            onShowToast('Max Stock Reached', `Only ${maxStock} available at this outlet.`);
            return item;
          }
          return {
            ...item,
            quantity: nextQty,
            lineTotal: Math.round(nextQty * item.unitPrice),
          };
        })
        .filter(Boolean) as POSCartItem[]
    );
  };

  const handleRemoveLine = (lineId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== lineId));
  };

  const handleClearCart = () => {
    setCart([]);
    setDiscountPercent(0);
    setApplyVivoNearExpiryDiscount(false);
    setCashTenderedIDR(0);
    setOrderNotes('');
  };

  // Hold / Park Current Basket
  const handleHoldCurrentOrder = () => {
    if (cart.length === 0) return;
    const held: HeldOrder = {
      id: `HOLD-${Date.now().toString().slice(-4)}`,
      customerName: customerName || 'Walk-In Customer',
      savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      items: cart,
      discountPercent,
      notes: orderNotes,
    };
    setHeldOrders((prev) => [held, ...prev]);
    handleClearCart();
    onShowToast('Order Parked', `Basket (${held.items.length} items) saved to Hold Slot #${held.id}.`);
  };

  const handleRecallOrder = (held: HeldOrder) => {
    setCart(held.items);
    setCustomerName(held.customerName);
    setDiscountPercent(held.discountPercent);
    setOrderNotes(held.notes);
    setHeldOrders((prev) => prev.filter((h) => h.id !== held.id));
    onShowToast('Order Recalled', `Restored Hold Slot #${held.id} to active register.`);
  };

  // Confirm Catch-Weight Scale Modal
  const handleConfirmScaleWeight = () => {
    if (!weighingProduct) return;
    const netGrams = Math.max(50, grossWeightGrams - tareWeightGrams);
    const netKg = Number((netGrams / 1000).toFixed(3));
    handleAddToCart(weighingProduct, netKg, tareWeightGrams, grossWeightGrams);
    onShowToast(
      'Catch-Weight Recorded',
      `${weighingProduct.name}: ${netGrams}g net (${netKg} kg) added to POS register.`
    );
    setWeighingProduct(null);
  };

  // Cart Financial Totals (in base IDR + converted currency)
  const subtotalIDR = useMemo(
    () => cart.reduce((sum, item) => sum + item.lineTotal, 0),
    [cart]
  );

  // Near-expiry Vivo markdown calculation (20% off items expiring in <= 5 days)
  const vivoNearExpiryMarkdownIDR = useMemo(() => {
    if (!applyVivoNearExpiryDiscount) return 0;
    return cart.reduce((sum, item) => {
      if ((item.daysUntilExpiry ?? 10) <= 5) {
        return sum + Math.round(item.lineTotal * 0.2);
      }
      return sum;
    }, 0);
  }, [cart, applyVivoNearExpiryDiscount]);

  // Dynamic Promotion Engine Evaluation (Buy 2 Get 1, Seasonal Coupons, Member Tier Discounts)
  const promoEvaluation = useMemo(() => {
    if (cart.length === 0) {
      return { totalPromoDiscountIDR: 0, appliedPromotions: [], lineDiscounts: {} };
    }
    const evalItems = cart.map((ci) => ({
      sku: ci.sku,
      name: ci.name,
      category: ci.category,
      unitPrice: ci.unitPrice,
      quantity: ci.quantity,
      lineTotal: ci.lineTotal,
    }));
    return evaluateCartPromotions(evalItems, promoRules, {
      couponCode: appliedCouponCode,
      memberTier: selectedMemberTier,
      memberId: customerMemberId,
    });
  }, [cart, promoRules, appliedCouponCode, selectedMemberTier, customerMemberId]);

  const manualDiscountIDR = useMemo(
    () => Math.round((subtotalIDR - vivoNearExpiryMarkdownIDR) * (discountPercent / 100)),
    [subtotalIDR, vivoNearExpiryMarkdownIDR, discountPercent]
  );

  const totalDiscountIDR =
    vivoNearExpiryMarkdownIDR + manualDiscountIDR + promoEvaluation.totalPromoDiscountIDR;
  const taxableAmountIDR = Math.max(0, subtotalIDR - totalDiscountIDR);

  // Dynamic Multi-Region Tax Calculation (US Sales Tax, EU VAT, AU GST, ID PPN)
  const cartTaxCalculation = useMemo(() => {
    const discountRatio = subtotalIDR > 0 ? Math.max(0, taxableAmountIDR / subtotalIDR) : 1;
    const taxItems = cart.map((item) => ({
      lineTotal: Math.round(item.lineTotal * discountRatio),
      category: item.category,
      name: item.name,
    }));
    return calculateCartTax(taxItems, taxRegion);
  }, [cart, subtotalIDR, taxableAmountIDR, taxRegion]);

  const taxIDR = cartTaxCalculation.totalTax;
  const grandTotalIDR = taxableAmountIDR + taxIDR;

  const estimatedCogsIDR = useMemo(
    () => cart.reduce((sum, item) => sum + Math.round(item.quantity * item.unitCost), 0),
    [cart]
  );

  // Keep default cash tendered synced with grandTotalIDR when cash is selected
  useEffect(() => {
    if (paymentMethod === 'cash' && cashTenderedIDR < grandTotalIDR) {
      setCashTenderedIDR(Math.ceil(grandTotalIDR / 50000) * 50000 || grandTotalIDR);
    }
  }, [grandTotalIDR, paymentMethod]);

  const cashChangeIDR = Math.max(0, cashTenderedIDR - grandTotalIDR);

  // Execute POS Checkout -> Inventory Deduction + FEFO Batch + General Ledger Sync
  const handleCompletePosCheckout = async () => {
    if (cart.length === 0) {
      onShowToast('Empty Register Cart', 'Scan or select at least one grocery item.');
      return;
    }

    if (isNetworkClosed) {
      onShowToast(
        'Store Network Closed',
        storeStatus?.noticeBanner || 'Company storefront network is currently closed. POS register checkout is blocked.'
      );
      return;
    }

    if (currentOutlet.isEmergencyClosed) {
      onShowToast(
        'Outlet Register Locked (Store Closed)',
        `${currentOutlet.storeName} is under emergency closure (${currentOutlet.closureReason || 'Maintenance'}). Cashier checkout is blocked.`
      );
      return;
    }

    if (paymentMethod === 'cash' && cashTenderedIDR < grandTotalIDR) {
      onShowToast(
        'Insufficient Cash Tendered',
        `Customer tendered ${formatIDR(cashTenderedIDR)}, which is less than total ${formatIDR(grandTotalIDR)}.`
      );
      return;
    }

    setIsProcessingCheckout(true);
    try {
      const currencyTotal =
        currency === 'IDR'
          ? grandTotalIDR
          : Number((grandTotalIDR / currencyConfig.rateToIDR).toFixed(currencyConfig.decimals));

      const payload: POSTransactionRequest = {
        storeId: posStoreId,
        storeName: currentOutlet.storeName,
        cashierId: activeStaffSession?.userId || 'USR-CASH-01',
        cashierName: activeStaffSession?.userName || 'Andi Wijaya (Frontline Cashier)',
        shiftId: activeStaffSession?.activeShiftId || 'SHIFT-JKT-SEN-MORNING',
        items: cart,
        subtotal: subtotalIDR,
        discount: totalDiscountIDR,
        tax: taxIDR,
        total: grandTotalIDR,
        currency,
        currencyRateToIDR: currencyConfig.rateToIDR,
        currencyTotal,
        paymentMethod,
        cashTendered: paymentMethod === 'cash' ? cashTenderedIDR : undefined,
        cashChange: paymentMethod === 'cash' ? cashChangeIDR : undefined,
        customerName: customerName.trim() || 'Walk-In Customer',
        customerMemberId: customerMemberId.trim() || undefined,
        notes: orderNotes.trim() || undefined,
      };

      const res = await syncPosCheckoutWithInventoryAndAccounting(payload, onTransactionSynced);

      if (res.success && res.receipt) {
        if (paymentMethod === 'cash') {
          playCashDrawerChime();
          apiClient.kickCashDrawer(250, activeStaffSession?.userName).catch(() => {});
        }
        apiClient.testPrintThermalReceipt(80, currentOutlet.storeName).catch(() => {});
        setActiveReceiptModal(res.receipt);
        handleClearCart();
        await loadPosData(posStoreId);
        onShowToast(
          `POS Checkout Settled (${res.receipt.receiptNumber})`,
          `Deducted ${res.receipt.inventoryDeductedCount} units from ${currentOutlet.storeName} & posted 4 GL entries.`
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('POS Checkout Failed', msg);
    } finally {
      setIsProcessingCheckout(false);
    }
  };

  // Filtered POS Catalog
  const categories = useMemo(() => {
    const set = new Set<string>(posProducts.map((p) => p.category));
    return ['ALL', ...Array.from(set)];
  }, [posProducts]);

  const filteredProducts = useMemo(() => {
    return posProducts.filter((p) => {
      if (selectedCategory !== 'ALL' && p.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode.includes(q) ||
          (p.nearestBatchId && p.nearestBatchId.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [posProducts, selectedCategory, searchQuery]);

  // Style tokens matching AdminDashboard
  const cardClass = isLight
    ? 'bg-white border border-gray-200/90 shadow-[0_4px_12px_rgba(0,0,0,0.03)] text-gray-900 rounded-2xl'
    : 'bg-stone-900/90 border border-stone-800 text-stone-100 rounded-2xl';
  const subCardClass = isLight
    ? 'bg-gray-50/80 border border-gray-200/90 text-gray-900 rounded-xl'
    : 'bg-stone-800/60 border border-stone-700/80 text-stone-100 rounded-xl';
  const textTitle = isLight ? 'text-gray-900' : 'text-white';
  const textMuted = isLight ? 'text-gray-500' : 'text-stone-400';
  const inputClass = isLight
    ? 'bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#0F4C3A] focus:ring-1 focus:ring-[#0F4C3A]'
    : 'bg-stone-800 border border-stone-700 text-white placeholder:text-stone-500 focus:outline-none focus:border-emerald-500';

  // ============================================================================
  // RBAC SECURITY GATE: Only authorized Cashiers, Store Managers, or Executives
  // ============================================================================
  const isAuthorizedForPos = activeStaffSession ? activeStaffSession.permissions.canViewPos : true;

  if (!isAuthorizedForPos && activeStaffSession) {
    const authorizedProfiles = availableStaffProfiles.filter((p) => p.permissions.canViewPos);
    return (
      <div className={`${cardClass} p-6 sm:p-10 max-w-3xl mx-auto my-6 border-rose-500/30`}>
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30">
            RBAC Security Gate • POS Cashier Restricted
          </span>
          <h2 className={`text-xl sm:text-2xl font-bold ${textTitle}`}>
            Cashier Register Authorization Required
          </h2>
          <p className={`text-xs sm:text-sm max-w-xl ${textMuted} leading-relaxed`}>
            Active operator <strong>{activeStaffSession.userName}</strong> (
            <code className="font-mono uppercase">{activeStaffSession.userRole.replace(/_/g, ' ')}</code>) does not hold{' '}
            <code className="font-mono text-rose-500">canViewPos</code> register clearance. Only authorized{' '}
            <strong>Frontline Cashiers</strong>, <strong>Store Managers</strong>, or <strong>Company Executives</strong>{' '}
            may operate the Point of Sale terminal and trigger General Ledger settlements.
          </p>

          <div className="w-full pt-4 border-t border-gray-200 dark:border-stone-800">
            <p className={`text-xs font-bold uppercase tracking-wider mb-3 ${textMuted}`}>
              Switch to an Authorized POS Operator Profile:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {authorizedProfiles.map((profile) => (
                <button
                  key={profile.userId}
                  onClick={() => onSwitchSession(profile.userId)}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isLight
                      ? 'bg-gray-50 hover:bg-emerald-50/70 border-gray-200 hover:border-[#0F4C3A]'
                      : 'bg-stone-800/70 hover:bg-emerald-950/30 border-stone-700 hover:border-emerald-500/50'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#0F4C3A] text-white">
                        {profile.userRole.replace(/_/g, ' ')}
                      </span>
                      <UserCheck className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className={`font-bold text-xs mt-2 ${textTitle}`}>{profile.userName}</div>
                    <div className={`text-[11px] mt-0.5 ${textMuted}`}>{profile.storeName}</div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-gray-200/60 dark:border-stone-700/60 text-[11px] font-semibold text-[#0F4C3A] dark:text-emerald-400 flex items-center justify-between">
                    <span>Activate Cashier Session</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ========================================================================= */}
      {/* TOP POS TERMINAL STATUS BAR: OUTLET, CASHIER RBAC, MULTI-CURRENCY, MODES */}
      {/* ========================================================================= */}
      <div
        className={`p-4 sm:p-5 rounded-2xl border transition-colors ${
          isLight
            ? 'bg-gradient-to-r from-emerald-50/90 via-white to-stone-50 border-emerald-900/15 shadow-[0_4px_20px_rgba(0,0,0,0.03)]'
            : 'bg-stone-900/90 border-stone-800'
        }`}
      >
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          {/* Left: Terminal Identity & RBAC Operator Badge */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#0F4C3A] text-white tracking-wide uppercase flex items-center gap-1.5">
                <Scan className="w-3.5 h-3.5" />
                POS Cashier Terminal
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-[#0F4C3A] dark:text-emerald-300 border border-emerald-500/30">
                FEFO Vivo Batch &amp; Double-Entry GL Auto-Sync
              </span>
              {isNetworkClosed && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/30 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Network Closed
                </span>
              )}
              {currentOutlet.isEmergencyClosed && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/30 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Outlet Emergency Closed
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap pt-1">
              <h2 className={`text-lg sm:text-xl font-bold tracking-tight ${textTitle}`}>
                {currentOutlet.storeName} — Register #01
              </h2>
              <span className={`text-xs ${textMuted} font-mono`}>
                Cashier: <strong className={textTitle}>{activeStaffSession?.userName || 'Andi Wijaya'}</strong> (
                {activeStaffSession?.activeShiftId || 'SHIFT-MORNING'})
              </span>
            </div>
          </div>

          {/* Right: Outlet Scope Selector, Multi-Currency Switcher, Mode Toggle */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Store Outlet Warehouse Selector */}
            <div className="flex items-center gap-1.5">
              <Store className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400 shrink-0" />
              <select
                value={posStoreId}
                onChange={(e) => setPosStoreId(e.target.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer ${inputClass}`}
                title="Select POS Store Outlet for Real-Time Stock Deduction"
              >
                <option value="store-jkt-senopati">Senopati Flagship (Jakarta)</option>
                <option value="store-jkt-pik">PIK 2 The Avenue (Jakarta)</option>
                <option value="store-jkt-menteng">Menteng Heritage (Jakarta)</option>
                <option value="store-bdg-dago">Dago Green Market (Bandung)</option>
                <option value="store-sby-gubeng">Gubeng Central Hub (Surabaya)</option>
                <option value="store-bali-canggu">Batu Bolong Organic (Bali)</option>
              </select>
            </div>

            {/* Multi-Currency & Global Tax / UOM Selectors */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-stone-800 p-1 rounded-xl border border-gray-200 dark:border-stone-700">
                <Globe2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 ml-1.5 mr-0.5" />
                {(['IDR', 'USD', 'EUR', 'AUD'] as SupportedCurrency[]).map((cur) => (
                  <button
                    key={cur}
                    type="button"
                    onClick={() => {
                      setCurrency(cur);
                      const defTax = getDefaultTaxRegionForCurrency(cur);
                      setTaxRegion(defTax);
                      setUomSystem(cur === 'USD' ? 'imperial' : 'metric');
                      onShowToast(
                        `POS Multi-Currency & Tax: ${cur}`,
                        cur === 'IDR'
                          ? 'Base Indonesian Rupiah (IDR) with 11% PPN'
                          : `1 ${cur} = Rp ${POS_CURRENCIES[cur].rateToIDR.toLocaleString('id-ID')} (Tax: ${TAX_REGIONS[defTax].shortLabel})`
                      );
                    }}
                    className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      currency === cur
                        ? 'bg-[#0F4C3A] text-white shadow-xs'
                        : isLight
                        ? 'text-gray-600 hover:text-gray-900'
                        : 'text-stone-400 hover:text-white'
                    }`}
                  >
                    {cur}
                  </button>
                ))}
              </div>

              {/* Dynamic Tax Jurisdiction Selector */}
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-stone-800 px-2 py-1 rounded-xl border border-gray-200 dark:border-stone-700 text-xs">
                <Percent className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <select
                  value={taxRegion}
                  onChange={(e) => {
                    const reg = e.target.value as TaxRegionCode;
                    setTaxRegion(reg);
                    onShowToast('Tax Jurisdiction Updated', TAX_REGIONS[reg].name);
                  }}
                  className="bg-transparent font-bold text-xs cursor-pointer focus:outline-none dark:text-stone-200"
                  title="Dynamic Multi-Region Tax Engine (US Sales Tax, EU VAT, AU GST, ID PPN)"
                >
                  <option value="ID_PPN_11" className="dark:bg-stone-900">ID PPN (11% VAT)</option>
                  <option value="US_CA_725" className="dark:bg-stone-900">US-CA (7.25% / 0% Food)</option>
                  <option value="US_NY_8875" className="dark:bg-stone-900">US-NYC (8.875% / 0% Food)</option>
                  <option value="US_TX_825" className="dark:bg-stone-900">US-TX (8.25% / 0% Food)</option>
                  <option value="EU_DE_70" className="dark:bg-stone-900">EU-DE (7% Food VAT)</option>
                  <option value="EU_FR_55" className="dark:bg-stone-900">EU-FR (5.5% Food TVA)</option>
                  <option value="UK_VAT_0" className="dark:bg-stone-900">UK (0% Zero-Rated Food)</option>
                  <option value="AU_GST_10" className="dark:bg-stone-900">AU (10% GST / 0% Food)</option>
                </select>
              </div>

              {/* UOM Dual-Unit Measurement Toggle */}
              <button
                type="button"
                onClick={() => {
                  const nextUom = uomSystem === 'metric' ? 'imperial' : 'metric';
                  setUomSystem(nextUom);
                  onShowToast('UOM Engine', `Switched primary measurement system to ${nextUom.toUpperCase()}`);
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                  uomSystem === 'imperial'
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-800 dark:text-amber-300'
                    : 'bg-emerald-500/10 border-emerald-500/25 text-[#0F4C3A] dark:text-emerald-300'
                }`}
                title="Toggle Unit of Measurement: Metric (kg/g) vs Imperial (lb/oz)"
              >
                <Scale className="w-3.5 h-3.5" />
                <span>{uomSystem === 'metric' ? 'Metric (kg)' : 'Imperial (lb)'}</span>
              </button>
            </div>

            {/* View Switcher: Active Register vs Shift Receipts & GL Log */}
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-stone-800 p-1 rounded-xl border border-gray-200 dark:border-stone-700">
              <button
                type="button"
                onClick={() => setPosViewMode('register')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  posViewMode === 'register'
                    ? 'bg-[#0F4C3A] text-white shadow-xs'
                    : isLight
                    ? 'text-gray-600 hover:text-gray-900'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Cashier Register</span>
              </button>
              <button
                type="button"
                onClick={() => setPosViewMode('history')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  posViewMode === 'history'
                    ? 'bg-[#0F4C3A] text-white shadow-xs'
                    : isLight
                    ? 'text-gray-600 hover:text-gray-900'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                <ReceiptText className="w-3.5 h-3.5" />
                <span>Shift Receipts &amp; GL ({posHistory.length})</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: ACTIVE POS CASHIER REGISTER & CATALOG                             */}
      {/* ========================================================================= */}
      {posViewMode === 'register' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT 7 COLUMNS: BARCODE SCANNER, CATEGORY PILLS & PRODUCT GRID */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-4">
            {/* Barcode Scanner & Search Bar Card */}
            <div className={`${cardClass} p-4 space-y-3`}>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                {/* Barcode / SKU Direct Scanner Form */}
                <form onSubmit={handleBarcodeSubmit} className="md:col-span-6 flex gap-2">
                  <div className="relative flex-1">
                    <Barcode className="w-4 h-4 text-emerald-600 dark:text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      placeholder="Scan EAN-13 Barcode or type SKU (e.g. SKU-PRD-001)..."
                      className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs font-mono ${inputClass}`}
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-3.5 py-2 rounded-xl bg-[#0F4C3A] hover:bg-[#0F4C3A]/90 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer transition-all"
                  >
                    <Scan className="w-3.5 h-3.5" />
                    <span>Scan</span>
                  </button>
                </form>

                {/* Instant Catalog Filter */}
                <div className="md:col-span-6 relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter by grocery name, FEFO batch ID, or category..."
                    className={`w-full pl-9 pr-8 py-2 rounded-xl text-xs ${inputClass}`}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Barcode Test Buttons & Category Filter Row */}
              <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-gray-100 dark:border-stone-800">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                        selectedCategory === cat
                          ? 'bg-[#0F4C3A] text-white'
                          : isLight
                          ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          : 'bg-stone-800 hover:bg-stone-700 text-stone-300'
                      }`}
                    >
                      {cat.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className={`${textMuted} font-medium`}>Quick Scan:</span>
                  {posProducts.slice(0, 3).map((sample, idx) => (
                    <button
                      key={`${sample.sku}-${sample.barcode || idx}`}
                      type="button"
                      onClick={() => {
                        handleAddToCart(sample);
                        onShowToast(
                          'Laser Scanner Simulated',
                          `Scanned ${sample.barcode} → ${sample.name} (${sample.nearestBatchId})`
                        );
                      }}
                      className={`px-2 py-0.5 rounded border font-mono text-[10px] transition-colors cursor-pointer ${
                        isLight
                          ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-[#0F4C3A]'
                          : 'bg-emerald-950/40 hover:bg-emerald-900/50 border-emerald-800/50 text-emerald-300'
                      }`}
                      title={`Simulate barcode scan for ${sample.name}`}
                    >
                      +{sample.sku}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Held Orders Bar (if any parked baskets exist) */}
            {heldOrders.length > 0 && (
              <div className={`${cardClass} p-3 border-amber-500/30 bg-amber-500/5`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-300">
                    <PauseCircle className="w-4 h-4" />
                    <span>Parked / Held Customer Baskets ({heldOrders.length})</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {heldOrders.map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => handleRecallOrder(h)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-200 border border-amber-500/30 cursor-pointer transition-all"
                      >
                        <PlayCircle className="w-3.5 h-3.5" />
                        <span>
                          {h.id} • {h.customerName} ({h.items.length} items @ {h.savedAt})
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* POS Product Grid */}
            {isLoadingCatalog ? (
              <div className={`${cardClass} p-12 text-center space-y-2`}>
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#0F4C3A] dark:text-emerald-400" />
                <p className={`text-xs font-semibold ${textMuted}`}>
                  Synchronizing real-time warehouse stock &amp; FEFO Vivo batches for {currentOutlet.storeName}...
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {filteredProducts.map((product, pIdx) => {
                  const isOut = product.availableStock <= 0;
                  const isLow = product.availableStock > 0 && product.availableStock <= 12;
                  const isNearExpiry =
                    product.batchStatus === 'near_expiry' ||
                    product.batchStatus === 'critical' ||
                    (product.daysUntilExpiry ?? 10) <= 5;

                  return (
                    <div
                      key={`${product.sku}-${product.barcode || pIdx}`}
                      className={`${cardClass} p-3.5 flex flex-col justify-between transition-all ${
                        isOut
                          ? 'opacity-60'
                          : 'hover:border-[#0F4C3A]/50 dark:hover:border-emerald-500/50 hover:shadow-md'
                      }`}
                    >
                      <div>
                        {/* Top SKU, Barcode & Stock Pill */}
                        <div className="flex items-center justify-between gap-1.5 mb-2">
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-stone-800 text-gray-600 dark:text-stone-300">
                            {product.sku}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              isOut
                                ? 'bg-rose-500/15 text-rose-600 border-rose-500/30'
                                : isLow
                                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
                            }`}
                          >
                            {isOut
                              ? 'Out of Stock'
                              : `${product.availableStock} ${product.unit} in bin`}
                          </span>
                        </div>

                        {/* Product Title & Price */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className={`text-xs sm:text-sm font-bold leading-snug ${textTitle}`}>
                              {product.name}
                            </h3>
                            <span className={`text-[11px] capitalize ${textMuted}`}>
                              {product.category.replace(/_/g, ' ')} • Barcode: {product.barcode.slice(-6)}
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-extrabold text-[#0F4C3A] dark:text-emerald-400">
                              {formatCurrencyValue(product.sellingPrice)}
                            </div>
                            <div className={`text-[10px] ${textMuted}`}>
                              per {product.unit}
                              {(product.isWeighted || product.unit === 'kg') && (
                                <span className="block text-[9px] font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                                  {formatDualUnitPrice(product.pricePerKg || product.sellingPrice, currencyConfig.rateToIDR, currencyConfig.symbol, currency).imperialLabel}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Vivo / FEFO Batch Expiry Strip */}
                        <div
                          className={`mt-2.5 p-2 rounded-xl border text-[10px] flex items-center justify-between gap-1 ${
                            isNearExpiry
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200'
                              : isLight
                              ? 'bg-gray-50 border-gray-200/80 text-gray-600'
                              : 'bg-stone-800/50 border-stone-700/70 text-stone-300'
                          }`}
                        >
                          <div className="flex items-center gap-1 truncate">
                            <Clock className="w-3 h-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            <span className="font-mono font-semibold truncate">
                              FEFO: {product.nearestBatchId}
                            </span>
                          </div>
                          <span className="font-mono shrink-0">
                            Exp: {product.expiryDate} ({product.daysUntilExpiry}d)
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons: Quick Add vs Digital Scale Weigh */}
                      <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-stone-800 flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isOut}
                          onClick={() => handleAddToCart(product)}
                          className="flex-1 py-1.5 px-3 rounded-xl bg-[#0F4C3A] hover:bg-[#0F4C3A]/90 disabled:bg-gray-300 dark:disabled:bg-stone-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Unit</span>
                        </button>

                        {product.isWeighted && (
                          <button
                            type="button"
                            disabled={isOut}
                            onClick={() => {
                              setWeighingProduct(product);
                              setGrossWeightGrams(550);
                              setTareWeightGrams(25);
                            }}
                            className={`py-1.5 px-2.5 rounded-xl border text-xs font-bold flex items-center gap-1 cursor-pointer transition-all ${
                              isLight
                                ? 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-800'
                                : 'bg-amber-950/40 hover:bg-amber-900/50 border-amber-800/50 text-amber-300'
                            }`}
                            title="Weigh on Digital Catch-Weight Scale"
                          >
                            <Scale className="w-3.5 h-3.5" />
                            <span>Weigh</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT 5 COLUMNS: ACTIVE CASHIER CART, VIVO MARKDOWN, MULTI-CURRENCY & PAYMENT */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-4 lg:sticky lg:top-20">
            <div className={`${cardClass} p-4 sm:p-5 space-y-4`}>
              {/* Cart Header */}
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-stone-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#0F4C3A] text-white flex items-center justify-center">
                    <ShoppingCart className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className={`text-sm font-bold ${textTitle}`}>
                      Active Register Basket ({cart.length})
                    </h3>
                    <p className={`text-[11px] ${textMuted}`}>
                      Outlet: {currentOutlet.storeName}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={cart.length === 0}
                    onClick={handleHoldCurrentOrder}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-40 ${
                      isLight
                        ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                        : 'bg-amber-950/40 border-amber-800/50 text-amber-300'
                    }`}
                    title="Park / Hold Current Customer Basket"
                  >
                    <PauseCircle className="w-3.5 h-3.5" />
                    <span>Hold</span>
                  </button>
                  {cart.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearCart}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Clear Cart"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Customer & Loyalty Member Input */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`text-[10px] font-bold uppercase ${textMuted} block mb-1`}>
                    Customer Name
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Walk-In Customer"
                    className={`w-full px-2.5 py-1.5 rounded-lg text-xs ${inputClass}`}
                  />
                </div>
                <div>
                  <label className={`text-[10px] font-bold uppercase ${textMuted} block mb-1`}>
                    Loyalty / Member ID
                  </label>
                  <input
                    type="text"
                    value={customerMemberId}
                    onChange={(e) => setCustomerMemberId(e.target.value)}
                    placeholder="Optional (e.g. GM-8821)"
                    className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-mono ${inputClass}`}
                  />
                </div>
              </div>

              {/* Cart Items Scrollable List */}
              <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {cart.length === 0 ? (
                  <div className="py-10 text-center space-y-2 border border-dashed border-gray-200 dark:border-stone-800 rounded-xl">
                    <Scan className="w-7 h-7 mx-auto text-gray-400" />
                    <p className={`text-xs font-semibold ${textMuted}`}>
                      Register basket is empty. Scan a barcode or click any product card.
                    </p>
                  </div>
                ) : (
                  cart.map((item, idx) => (
                    <div
                      key={item.id ? `${item.id}-${idx}` : `cart-${item.sku}-${idx}`}
                      className={`${subCardClass} p-2.5 flex flex-col gap-1.5`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className={`text-xs font-bold truncate ${textTitle}`}>
                            {item.name}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                            <span>{item.sku}</span>
                            <span>•</span>
                            <span>Batch: {item.batchId || 'FEFO-AUTO'}</span>
                            {item.expiryDate && <span>(Exp: {item.expiryDate})</span>}
                          </div>
                          {item.netWeightGrams && (
                            <div className="text-[10px] text-amber-600 dark:text-amber-400 font-mono">
                              Scale Net: {formatDualWeight(item.netWeightGrams, uomSystem).fullBadge} (Tare: {item.tareWeightGrams}g)
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`text-xs font-extrabold ${textTitle}`}>
                            {formatCurrencyValue(item.lineTotal)}
                          </div>
                          {currency !== 'IDR' && (
                            <div className={`text-[10px] font-mono ${textMuted}`}>
                              {formatIDR(item.lineTotal)}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-gray-200/60 dark:border-stone-700/60">
                        <span className={`text-[10px] ${textMuted}`}>
                          {formatCurrencyValue(item.unitPrice)} / {item.unit}
                          {(item.unit === 'kg' || item.isWeighted) && (
                            <span className="ml-1 text-[9px] font-mono text-emerald-700 dark:text-emerald-400">
                              ({formatDualUnitPrice(item.unitPrice, currencyConfig.rateToIDR, currencyConfig.symbol, currency).imperialLabel})
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(item.id, -1)}
                            className="w-6 h-6 rounded-lg border border-gray-300 dark:border-stone-600 flex items-center justify-center text-xs hover:bg-gray-200 dark:hover:bg-stone-700 cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-bold font-mono px-1.5">
                            {item.quantity} {item.unit}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(item.id, 1)}
                            className="w-6 h-6 rounded-lg border border-gray-300 dark:border-stone-600 flex items-center justify-center text-xs hover:bg-gray-200 dark:hover:bg-stone-700 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(item.id)}
                            className="p-1 text-rose-500 hover:bg-rose-500/10 rounded-lg ml-1 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Grocery Vivo Near-Expiry Markdown & Promo Discount Controls */}
              <div className="pt-2 border-t border-gray-200 dark:border-stone-800 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={applyVivoNearExpiryDiscount}
                      onChange={(e) => setApplyVivoNearExpiryDiscount(e.target.checked)}
                      className="rounded text-[#0F4C3A] focus:ring-[#0F4C3A]"
                    />
                    <span className="flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5 text-amber-500" />
                      <span>Vivo Near-Expiry 20% Markdown (≤5d)</span>
                    </span>
                  </label>
                  {vivoNearExpiryMarkdownIDR > 0 && (
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                      -{formatCurrencyValue(vivoNearExpiryMarkdownIDR)}
                    </span>
                  )}
                </div>

                {/* Quick Manual Discount Pills */}
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs font-medium ${textMuted} flex items-center gap-1`}>
                    <Percent className="w-3.5 h-3.5" /> Cashier Promo Discount:
                  </span>
                  <div className="flex items-center gap-1">
                    {[0, 5, 10, 15].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setDiscountPercent(pct)}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-all ${
                          discountPercent === pct
                            ? 'bg-[#0F4C3A] text-white'
                            : isLight
                            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Financial Breakdown (Multi-Currency + IDR GL Preview) */}
              <div className={`${subCardClass} p-3 space-y-1.5 text-xs`}>
                <div className="flex justify-between">
                  <span className={textMuted}>Subtotal ({cart.length} lines)</span>
                  <span className="font-semibold">{formatCurrencyValue(subtotalIDR)}</span>
                </div>
                {totalDiscountIDR > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                    <span>Total Discounts Applied</span>
                    <span className="font-semibold">-{formatCurrencyValue(totalDiscountIDR)}</span>
                  </div>
                )}
                <div className="space-y-0.5">
                  <div className="flex justify-between items-center">
                    <span className={textMuted}>
                      {cartTaxCalculation.region.shortLabel}
                    </span>
                    <span className="font-semibold">{formatCurrencyValue(taxIDR)}</span>
                  </div>
                  {cartTaxCalculation.itemsTaxSummary.exemptItemCount > 0 && (
                    <div className="flex items-center justify-between text-[10px] text-emerald-700 dark:text-emerald-400">
                      <span>✓ {cartTaxCalculation.itemsTaxSummary.exemptItemCount} Basic Staple Groceries 100% Tax-Exempt</span>
                      <span>{cartTaxCalculation.effectiveTaxRatePercent}% eff. rate</span>
                    </div>
                  )}
                  <div className="text-[9px] text-gray-400 italic">
                    {cartTaxCalculation.region.legalNotice}
                  </div>
                </div>
                <div className="pt-2 border-t border-gray-200 dark:border-stone-700 flex items-baseline justify-between">
                  <div>
                    <span className={`text-sm font-extrabold ${textTitle}`}>Grand Total</span>
                    {currency !== 'IDR' && (
                      <span className={`block text-[10px] font-mono ${textMuted}`}>
                        GL Base: {formatIDR(grandTotalIDR)} (@ Rp {currencyConfig.rateToIDR.toLocaleString('id-ID')})
                      </span>
                    )}
                  </div>
                  <span className="text-lg font-extrabold text-[#0F4C3A] dark:text-emerald-400">
                    {formatCurrencyValue(grandTotalIDR)}
                  </span>
                </div>
                <div className="pt-1 flex items-center justify-between text-[10px] font-mono text-gray-400">
                  <span>Est. FEFO COGS / HPP (5010):</span>
                  <span>{formatCurrencyValue(estimatedCogsIDR)}</span>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-2">
                <label className={`text-[10px] font-bold uppercase tracking-wider ${textMuted} block`}>
                  Select Settlement Channel (Auto-Maps to COA Asset Account)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'qris', label: 'QRIS BI', coa: '1030', icon: QrCode },
                    { id: 'cash', label: 'Cash Drawer', coa: '1010', icon: Banknote },
                    { id: 'debit_card', label: 'Debit EDC', coa: '1020', icon: CreditCard },
                    { id: 'credit_card', label: 'Credit Card', coa: '1020', icon: CreditCard },
                  ].map((pm) => {
                    const Icon = pm.icon;
                    const active = paymentMethod === pm.id;
                    return (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => setPaymentMethod(pm.id as POSPaymentMethod)}
                        className={`p-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                          active
                            ? 'bg-[#0F4C3A] text-white border-[#0F4C3A] shadow-xs'
                            : isLight
                            ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                            : 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-[11px] font-bold leading-none">{pm.label}</span>
                        <span className="text-[9px] font-mono opacity-75">COA {pm.coa}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Cash Tendered & Change Calculator */}
                {paymentMethod === 'cash' && cart.length > 0 && (
                  <div className={`${subCardClass} p-3 space-y-2`}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold">Cash Tendered (IDR):</span>
                      <input
                        type="number"
                        value={cashTenderedIDR}
                        onChange={(e) => setCashTenderedIDR(Math.max(0, Number(e.target.value)))}
                        className={`w-36 px-2.5 py-1 rounded-lg text-right font-mono font-bold ${inputClass}`}
                      />
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[grandTotalIDR, 50000, 100000, 200000, 500000].map((bill, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setCashTenderedIDR(bill)}
                          className="px-2 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-[#0F4C3A] dark:text-emerald-300 text-[10px] font-mono font-bold cursor-pointer"
                        >
                          {i === 0 ? 'Exact' : formatIDR(bill)}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-200 dark:border-stone-700">
                      <span className={textMuted}>Change Due to Customer:</span>
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                        {formatCurrencyValue(cashChangeIDR)}
                      </span>
                    </div>
                  </div>
                )}

                {/* QRIS Live Customer Facing Display Preview */}
                {paymentMethod === 'qris' && cart.length > 0 && (
                  <div className={`${subCardClass} p-3 flex items-center gap-3`}>
                    <div className="p-1.5 bg-white rounded-lg border border-gray-200 shrink-0">
                      <QRCodeCanvas
                        value={`00020101021226590014ID.CO.GROCEMART.WWW0118936000140000088211520454115303360540${grandTotalIDR}5802ID5918GROCEMART POS ${posStoreId.toUpperCase()}6007JAKARTA6304A1B2`}
                        size={64}
                      />
                    </div>
                    <div className="text-[11px] space-y-0.5">
                      <div className="font-bold text-[#0F4C3A] dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Dynamic QRIS Customer Display Ready
                      </div>
                      <p className={textMuted}>
                        Amount: <strong>{formatCurrencyValue(grandTotalIDR)}</strong> • Settles directly to COA{' '}
                        <code className="font-mono">1030</code> (QRIS Clearing).
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Closure Warning (Strict Store Closed Validation) */}
              {(isNetworkClosed || currentOutlet.isEmergencyClosed) && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2.5 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">
                      {isNetworkClosed ? 'Store Network Closed' : 'Outlet Register Locked (Emergency Closed)'}
                    </span>
                    <p className="text-[11px] mt-0.5 leading-relaxed">
                      {isNetworkClosed
                        ? storeStatus?.noticeBanner || 'Store network is currently closed. Register checkout is blocked.'
                        : `${currentOutlet.storeName} is under emergency closure (${currentOutlet.closureReason || 'Maintenance'}). Cashier checkout is blocked.`}
                    </p>
                  </div>
                </div>
              )}

              {/* Complete POS Sale CTA */}
              <button
                type="button"
                disabled={cart.length === 0 || isProcessingCheckout || currentOutlet.isEmergencyClosed || isNetworkClosed}
                onClick={handleCompletePosCheckout}
                className="w-full py-3 px-4 rounded-xl bg-[#0F4C3A] hover:bg-[#0F4C3A]/95 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-[#0F4C3A]/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                {isProcessingCheckout ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Syncing Stock, FEFO Batch &amp; General Ledger...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      Complete POS Sale • {formatCurrencyValue(grandTotalIDR)}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: SHIFT POS RECEIPTS & AUTOMATIC GENERAL LEDGER / PNL SYNC AUDIT    */}
      {/* ========================================================================= */}
      {posViewMode === 'history' && (
        <div className={`${cardClass} p-5 space-y-4`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 dark:border-stone-800 pb-4">
            <div>
              <h3 className={`text-base font-bold ${textTitle}`}>
                Shift POS Receipts &amp; Automatic Accounting Sync Log
              </h3>
              <p className={`text-xs ${textMuted}`}>
                Every POS transaction atomically relieves outlet warehouse inventory and posts 4 double-entry General Ledger lines.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {onNavigateToAccounting && (
                <button
                  type="button"
                  onClick={() => onNavigateToAccounting('gl')}
                  className="px-3 py-1.5 rounded-xl bg-[#0F4C3A] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <ReceiptText className="w-3.5 h-3.5" />
                  <span>Inspect Full General Ledger &amp; P&amp;L</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => loadPosData(posStoreId)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                  isLight ? 'bg-white border-gray-200 text-gray-700' : 'bg-stone-800 border-stone-700 text-stone-200'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-200 dark:border-stone-800 text-[10px] uppercase font-bold text-gray-400">
                  <th className="py-2.5 px-3">Receipt #</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Store Outlet</th>
                  <th className="py-2.5 px-3">Cashier</th>
                  <th className="py-2.5 px-3">Items / Stock Deducted</th>
                  <th className="py-2.5 px-3">Payment</th>
                  <th className="py-2.5 px-3">Revenue (4010)</th>
                  <th className="py-2.5 px-3">FEFO COGS (5010)</th>
                  <th className="py-2.5 px-3">GL Vouchers</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200/70 dark:divide-stone-800">
                {posHistory.map((rcp) => (
                  <tr
                    key={rcp.receiptNumber}
                    className="hover:bg-gray-50/80 dark:hover:bg-stone-800/40 transition-colors"
                  >
                    <td className="py-3 px-3 font-mono font-bold text-[#0F4C3A] dark:text-emerald-400">
                      {rcp.receiptNumber}
                    </td>
                    <td className={`py-3 px-3 font-mono ${textMuted}`}>
                      {new Date(rcp.timestamp).toLocaleString()}
                    </td>
                    <td className={`py-3 px-3 font-semibold ${textTitle}`}>{rcp.storeName}</td>
                    <td className={`py-3 px-3 ${textMuted}`}>{rcp.cashierName}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                        -{rcp.inventoryDeductedCount} units ({rcp.items.length} SKUs)
                      </span>
                    </td>
                    <td className="py-3 px-3 uppercase font-mono font-bold text-[11px]">
                      {rcp.paymentMethod.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 px-3 font-bold text-[#0F4C3A] dark:text-emerald-400 font-mono">
                      {formatIDR(rcp.total)}
                      {rcp.currency !== 'IDR' && (
                        <span className="block text-[10px] text-gray-400">
                          ({rcp.currency} {rcp.currencyTotal})
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-amber-600 dark:text-amber-400 font-semibold">
                      {formatIDR(rcp.totalCogsCost)}
                    </td>
                    <td className="py-3 px-3 font-mono text-[10px] text-blue-600 dark:text-blue-400">
                      {rcp.journalEntryIds.join(', ')}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => setActiveReceiptModal(rcp)}
                        className="px-2.5 py-1 rounded-lg bg-[#0F4C3A]/10 hover:bg-[#0F4C3A]/20 text-[#0F4C3A] dark:text-emerald-300 font-bold text-[11px] cursor-pointer"
                      >
                        View Receipt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: DIGITAL CATCH-WEIGHT SCALE SIMULATOR                             */}
      {/* ========================================================================= */}
      {weighingProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`${cardClass} max-w-md w-full p-6 space-y-4 shadow-2xl`}>
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-stone-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`text-sm font-bold ${textTitle}`}>
                    Digital POS Catch-Weight Scale
                  </h3>
                  <p className={`text-[11px] ${textMuted}`}>
                    {weighingProduct.name} ({weighingProduct.sku})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWeighingProduct(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold block mb-1">Gross Weight (grams)</label>
                  <input
                    type="number"
                    min={100}
                    max={25000}
                    value={grossWeightGrams}
                    onChange={(e) => setGrossWeightGrams(Math.max(50, Number(e.target.value)))}
                    className={`w-full px-3 py-2 rounded-xl font-mono font-bold ${inputClass}`}
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">Container Tare (grams)</label>
                  <input
                    type="number"
                    min={0}
                    max={500}
                    value={tareWeightGrams}
                    onChange={(e) => setTareWeightGrams(Math.max(0, Number(e.target.value)))}
                    className={`w-full px-3 py-2 rounded-xl font-mono font-bold ${inputClass}`}
                  />
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-[11px] ${textMuted}`}>Preset Weights:</span>
                {[250, 500, 750, 1000, 1500].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGrossWeightGrams(g + tareWeightGrams)}
                    className="px-2 py-0.5 rounded bg-gray-100 dark:bg-stone-800 text-[11px] font-mono font-semibold cursor-pointer"
                  >
                    {g}g net
                  </button>
                ))}
              </div>

              <div className={`${subCardClass} p-3.5 space-y-1.5 font-mono`}>
                <div className="flex justify-between">
                  <span>Net Billable Weight:</span>
                  <span className="font-bold text-[#0F4C3A] dark:text-emerald-400">
                    {formatDualWeight(Math.max(50, grossWeightGrams - tareWeightGrams), uomSystem).fullBadge}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Rate per Unit:</span>
                  <div className="text-right">
                    <div>{formatCurrencyValue(weighingProduct.pricePerKg || weighingProduct.sellingPrice)}/kg</div>
                    <div className="text-[10px] text-emerald-700 dark:text-emerald-400">
                      {formatDualUnitPrice(weighingProduct.pricePerKg || weighingProduct.sellingPrice, currencyConfig.rateToIDR, currencyConfig.symbol, currency).imperialLabel}
                    </div>
                  </div>
                </div>
                <div className="flex justify-between text-sm font-extrabold text-[#0F4C3A] dark:text-emerald-400 pt-1 border-t border-gray-200 dark:border-stone-700">
                  <span>Computed Line Total:</span>
                  <span>
                    {formatCurrencyValue(
                      Math.round(
                        (Math.max(50, grossWeightGrams - tareWeightGrams) / 1000) *
                          (weighingProduct.pricePerKg || weighingProduct.sellingPrice)
                      )
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setWeighingProduct(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 dark:border-stone-700 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmScaleWeight}
                className="px-5 py-2 rounded-xl bg-[#0F4C3A] text-white text-xs font-bold cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Confirm Weight &amp; Add to POS</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: SETTLED POS THERMAL RECEIPT & GL ACCOUNTING SYNC VERIFICATION    */}
      {/* ========================================================================= */}
      {activeReceiptModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className={`${cardClass} max-w-lg w-full p-6 space-y-4 shadow-2xl my-auto`}>
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-stone-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className={`text-base font-bold ${textTitle}`}>
                    POS Receipt &amp; ERP Accounting Synced
                  </h3>
                  <p className={`text-xs font-mono ${textMuted}`}>
                    {activeReceiptModal.receiptNumber} • {activeReceiptModal.storeName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveReceiptModal(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Thermal Receipt Box */}
            <div className={`${subCardClass} p-4 font-mono text-xs space-y-2.5`}>
              <div className="text-center border-b border-dashed border-gray-300 dark:border-stone-700 pb-2">
                <div className="font-extrabold text-sm">PT BUMI RETAIL SEJAHTERA (GROCEMART)</div>
                <div className="text-[11px] text-gray-500">{activeReceiptModal.storeName}</div>
                <div className="text-[10px] text-gray-400">
                  Cashier: {activeReceiptModal.cashierName} • Shift: {activeReceiptModal.shiftId}
                </div>
              </div>

              <div className="space-y-1.5 border-b border-dashed border-gray-300 dark:border-stone-700 pb-2">
                {activeReceiptModal.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between gap-2">
                    <div>
                      <div className="font-bold">
                        {item.name} ({item.quantity} {item.unit})
                      </div>
                      <div className="text-[10px] text-gray-400">
                        SKU: {item.sku} • FEFO Batch: {item.batchId || 'AUTO'} (Exp: {item.expiryDate || 'Verified'})
                      </div>
                    </div>
                    <div className="font-bold shrink-0">{formatIDR(item.lineTotal)}</div>
                  </div>
                ))}
              </div>

              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatIDR(activeReceiptModal.subtotal)}</span>
                </div>
                {activeReceiptModal.discount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount:</span>
                    <span>-{formatIDR(activeReceiptModal.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>PPN (11% VAT):</span>
                  <span>{formatIDR(activeReceiptModal.tax)}</span>
                </div>
                <div className="flex justify-between text-sm font-extrabold pt-1 border-t border-gray-200 dark:border-stone-700">
                  <span>TOTAL SETTLED ({activeReceiptModal.paymentMethod.toUpperCase()}):</span>
                  <span>{formatIDR(activeReceiptModal.total)}</span>
                </div>
                {activeReceiptModal.currency !== 'IDR' && (
                  <div className="flex justify-between text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                    <span>Foreign Currency Tender ({activeReceiptModal.currency}):</span>
                    <span>
                      {POS_CURRENCIES[activeReceiptModal.currency].symbol}
                      {activeReceiptModal.currencyTotal} (@ Rp{' '}
                      {activeReceiptModal.currencyRateToIDR.toLocaleString('id-ID')})
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Automatic Double-Entry General Ledger & Inventory Verification Box */}
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs space-y-1.5">
              <div className="font-bold text-[#0F4C3A] dark:text-emerald-300 flex items-center gap-1.5">
                <FileCheck2 className="w-4 h-4" />
                <span>Real-Time Inventory &amp; General Ledger Sync Verified</span>
              </div>
              <div className="text-[11px] space-y-1 text-gray-700 dark:text-stone-300 font-mono">
                <div>
                  • <strong>Stock Relieved:</strong> {activeReceiptModal.inventoryDeductedCount} units deducted from{' '}
                  {activeReceiptModal.storeName} warehouse &amp; FEFO batches.
                </div>
                <div>
                  • <strong>Revenue Posted:</strong> Credit COA 4010 ({formatIDR(activeReceiptModal.total)})
                </div>
                <div>
                  • <strong>COGS / HPP Recognized:</strong> Debit COA 5010 / Credit COA 1040 (
                  {formatIDR(activeReceiptModal.totalCogsCost)})
                </div>
                <div>
                  • <strong>GL Vouchers:</strong> {activeReceiptModal.journalEntryIds.join(', ')}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              {onNavigateToAccounting && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveReceiptModal(null);
                    onNavigateToAccounting('gl');
                  }}
                  className="px-3.5 py-2 rounded-xl border border-emerald-600/40 text-xs font-bold text-[#0F4C3A] dark:text-emerald-300 hover:bg-emerald-500/10 cursor-pointer flex items-center gap-1.5"
                >
                  <ReceiptText className="w-3.5 h-3.5" />
                  <span>Inspect GL Entries</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveReceiptModal(null)}
                className="ml-auto px-5 py-2 rounded-xl bg-[#0F4C3A] text-white text-xs font-bold cursor-pointer"
              >
                Done &amp; Next Customer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
