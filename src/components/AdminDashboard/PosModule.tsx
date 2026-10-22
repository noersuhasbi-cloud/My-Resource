/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import type {
  POSProductItem,
  POSCartItem,
  POSTransactionRequest,
  POSTransactionReceipt,
  POSPaymentMethod,
  StaffShiftSession,
  StoreOutletSchedule,
  SupportedCurrency,
} from '../../types/index.ts';
import { apiClient } from '../../services/apiClient';
import { formatIDR } from '../../utils/formatters';
import { QRCodeSVG } from 'qrcode.react';
import {
  parseVariableWeightBarcode,
  SAMPLE_SCALE_BARCODES,
} from '../../utils/groceryEngine.ts';
import {
  Scan,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  QrCode,
  Banknote,
  Scale,
  ReceiptText,
  Search,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Printer,
  RotateCcw,
  Store,
  Layers,
  ArrowRight,
  ShieldCheck,
  Globe,
  Tag,
  DollarSign,
  Maximize2,
  PauseCircle,
  PlayCircle,
  History,
  X,
  UserCheck,
} from 'lucide-react';

interface PosModuleProps {
  theme: 'light' | 'dark';
  selectedStore: string;
  storeOutlets: StoreOutletSchedule[];
  activeStaffSession: StaffShiftSession | null;
  onShowToast: (title: string, message: string) => void;
  onInventoryUpdated?: () => void;
}

const CURRENCY_OPTIONS: { code: SupportedCurrency; symbol: string; rateToIDR: number; label: string }[] = [
  { code: 'IDR', symbol: 'Rp', rateToIDR: 1, label: 'Indonesian Rupiah (IDR)' },
  { code: 'USD', symbol: '$', rateToIDR: 16000, label: 'US Dollar (USD)' },
  { code: 'EUR', symbol: '€', rateToIDR: 17200, label: 'Euro (EUR)' },
  { code: 'AUD', symbol: 'A$', rateToIDR: 10400, label: 'Australian Dollar (AUD)' },
];

export const PosModule: React.FC<PosModuleProps> = ({
  theme,
  selectedStore,
  storeOutlets,
  activeStaffSession,
  onShowToast,
  onInventoryUpdated,
}) => {
  const isLight = theme === 'light';

  // 1. Catalog & Filter State
  const [products, setProducts] = useState<POSProductItem[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // 2. Multi-Currency State
  const [activeCurrency, setActiveCurrency] = useState<SupportedCurrency>('IDR');
  const currentFx = useMemo(() => {
    return CURRENCY_OPTIONS.find((c) => c.code === activeCurrency) || CURRENCY_OPTIONS[0];
  }, [activeCurrency]);

  const formatCurrency = (amountInIDR: number): string => {
    if (activeCurrency === 'IDR') return formatIDR(amountInIDR);
    const converted = amountInIDR / currentFx.rateToIDR;
    return `${currentFx.symbol} ${converted.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // 3. Register Cart State
  const [cart, setCart] = useState<POSCartItem[]>([]);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [customerName, setCustomerName] = useState<string>('Walk-in Retail Shopper');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerMemberId, setCustomerMemberId] = useState<string>('');

  // 4. Barcode Quick Scanner State
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // 5. Digital Weight Scale Modal
  const [scalingProduct, setScalingProduct] = useState<POSProductItem | null>(null);
  const [scaleGrossGrams, setScaleGrossGrams] = useState<number>(500);
  const [scaleTareGrams, setScaleTareGrams] = useState<number>(15);

  // 6. Payment Tender Modal
  const [isTenderModalOpen, setIsTenderModalOpen] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<POSPaymentMethod>('cash');
  const [cashTendered, setCashTendered] = useState<number>(0);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState<boolean>(false);

  // 7. Electronic Receipt Modal (Struk)
  const [completedReceipt, setCompletedReceipt] = useState<POSTransactionReceipt | null>(null);

  // 8. Parked Tickets (Hold / Resume)
  const [parkedTickets, setParkedTickets] = useState<{ id: string; timestamp: string; cart: POSCartItem[]; customer: string }[]>([]);

  // 9. Recent Transactions History Drawer
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState<boolean>(false);
  const [historyReceipts, setHistoryReceipts] = useState<POSTransactionReceipt[]>([]);

  // Sound generator for barcode scan feedback (clean Web Audio API beep)
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // 880Hz A5 note
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.1);
    } catch {}
  };

  // Load Products for current store
  const effectiveStoreId = selectedStore === 'CONSOLIDATED' ? 'store-jkt-senopati' : selectedStore;
  const currentStoreInfo = useMemo(() => {
    return storeOutlets.find((s) => s.storeId === effectiveStoreId) || {
      storeId: effectiveStoreId,
      storeName: 'GroceMart Senopati Flagship',
    };
  }, [storeOutlets, effectiveStoreId]);

  const loadProducts = async () => {
    setIsLoadingProducts(true);
    try {
      const data = await apiClient.getPosProducts(effectiveStoreId);
      setProducts(data);
    } catch (e: any) {
      onShowToast('POS Error', e.message || 'Failed to load catalog');
    } finally {
      setIsLoadingProducts(false);
    }
  };

  const loadHistory = async () => {
    try {
      const data = await apiClient.getPosHistory(effectiveStoreId);
      setHistoryReceipts(data);
    } catch {}
  };

  useEffect(() => {
    loadProducts();
    loadHistory();
  }, [effectiveStoreId]);

  // Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.lineTotal, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    return Math.round((subtotal * discountPercent) / 100);
  }, [subtotal, discountPercent]);

  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = Math.round(taxableAmount * 0.11); // 11% PPN
  const totalAmount = taxableAmount + taxAmount;

  const totalInActiveCurrency = useMemo(() => {
    if (activeCurrency === 'IDR') return totalAmount;
    return Number((totalAmount / currentFx.rateToIDR).toFixed(2));
  }, [totalAmount, currentFx, activeCurrency]);

  const cashChange = Math.max(0, cashTendered - totalAmount);

  // Cart operations
  const addToCart = (product: POSProductItem, quantity = 1, isWeighted = false, weightGrams?: number) => {
    playBeep();
    setCart((prev) => {
      const existingIdx = prev.findIndex((item) => item.sku === product.sku && !item.isWeighted);

      if (!isWeighted && existingIdx >= 0) {
        const next = [...prev];
        const newQty = next[existingIdx].quantity + quantity;
        next[existingIdx] = {
          ...next[existingIdx],
          quantity: newQty,
          lineTotal: newQty * next[existingIdx].unitPrice,
        };
        return next;
      }

      // Add as new line
      const effectiveQty = isWeighted && weightGrams ? Number((weightGrams / 1000).toFixed(3)) : quantity;
      const unitPrice = isWeighted ? product.pricePerKg || product.sellingPrice : product.sellingPrice;
      const lineTotal = Math.round(unitPrice * effectiveQty);

      const newLine: POSCartItem = {
        id: `cart-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        sku: product.sku,
        productId: product.productId,
        name: product.name,
        category: product.category,
        unitPrice,
        unitCost: product.unitCost,
        quantity: effectiveQty,
        unit: isWeighted ? 'kg' : product.unit,
        isWeighted,
        grossWeightGrams: isWeighted ? weightGrams : undefined,
        tareWeightGrams: isWeighted ? scaleTareGrams : undefined,
        netWeightGrams: isWeighted ? weightGrams : undefined,
        batchId: product.nearestBatchId,
        lotNumber: product.lotNumber,
        expiryDate: product.expiryDate,
        daysUntilExpiry: product.daysUntilExpiry,
        lineTotal,
        image: product.image,
      };

      return [newLine, ...prev];
    });
  };

  const updateQuantity = (lineId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id !== lineId) return item;
          const newQty = item.isWeighted
            ? Number(Math.max(0.1, item.quantity + delta * 0.25).toFixed(3))
            : Math.max(1, item.quantity + delta);
          return {
            ...item,
            quantity: newQty,
            lineTotal: Math.round(newQty * item.unitPrice),
          };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (lineId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== lineId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountPercent(0);
    setCustomerName('Walk-in Retail Shopper');
    setCustomerPhone('');
    setCustomerMemberId('');
  };

  // Barcode search and instant add (including Variable-Weight embedded scale barcodes)
  const handleBarcodeSubmit = (e?: React.FormEvent, directBarcodeInput?: string) => {
    if (e) e.preventDefault();
    const rawCode = (directBarcodeInput || barcodeInput).trim();
    if (!rawCode) return;

    // 1. Check for Variable-Weight embedded scale barcode (EAN-13 GS1 prefix 20-29 / 02)
    const scaleBarcode = parseVariableWeightBarcode(rawCode, products);
    if (scaleBarcode && scaleBarcode.isVariableWeight) {
      const targetProduct =
        products.find((p) => p.sku === scaleBarcode.matchedSku) ||
        products.find((p) => p.isWeighted) ||
        products[0];

      if (targetProduct) {
        addToCart(targetProduct, 1, true, scaleBarcode.netWeightGrams);
        onShowToast(
          'Catch-Weight Scale Barcode Parsed',
          `GS1 Scale Barcode (${rawCode}): ${targetProduct.name} @ ${scaleBarcode.netWeightGrams}g (${scaleBarcode.netWeightKg}kg). Added to cart for ${formatIDR(
            Math.round((targetProduct.pricePerKg || targetProduct.sellingPrice) * scaleBarcode.netWeightKg)
          )}.`
        );
        setBarcodeInput('');
        return;
      }
    }

    const query = rawCode.toLowerCase();
    const matched = products.find(
      (p) =>
        p.barcode.toLowerCase() === query ||
        p.sku.toLowerCase() === query ||
        p.name.toLowerCase().includes(query)
    );

    if (matched) {
      if (matched.isWeighted) {
        setScalingProduct(matched);
      } else {
        addToCart(matched, 1);
        onShowToast('Item Scanned', `${matched.name} added to cart`);
      }
      setBarcodeInput('');
    } else {
      onShowToast('Not Found', `No product found matching barcode "${rawCode}"`);
    }
  };

  // Park / Hold Cart
  const handleParkTicket = () => {
    if (cart.length === 0) return;
    const newParked = {
      id: `PARK-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      cart: [...cart],
      customer: customerName,
    };
    setParkedTickets((prev) => [newParked, ...prev]);
    clearCart();
    onShowToast('Ticket Parked', `Held ticket #${newParked.id} for ${newParked.customer}`);
  };

  const handleResumeTicket = (parkedId: string) => {
    const target = parkedTickets.find((p) => p.id === parkedId);
    if (!target) return;
    setCart(target.cart);
    setCustomerName(target.customer);
    setParkedTickets((prev) => prev.filter((p) => p.id !== parkedId));
    onShowToast('Ticket Resumed', `Ticket #${target.id} restored to register`);
  };

  // Checkout execution
  const handleExecuteCheckout = async () => {
    if (cart.length === 0) return;
    if (paymentMethod === 'cash' && cashTendered < totalAmount) {
      onShowToast('Insufficient Cash', 'Amount tendered must cover total bill.');
      return;
    }

    setIsProcessingCheckout(true);

    try {
      const payload: POSTransactionRequest = {
        storeId: currentStoreInfo.storeId,
        storeName: currentStoreInfo.storeName,
        cashierId: activeStaffSession?.userId || 'USR-CASH-01',
        cashierName: activeStaffSession?.userName || 'Andi Wijaya (Frontline Cashier)',
        shiftId: activeStaffSession?.activeShiftId || 'SHIFT-JKT-SEN-MORNING',
        items: cart,
        subtotal,
        discount: discountAmount,
        tax: taxAmount,
        total: totalAmount,
        currency: activeCurrency,
        currencyTotal: totalInActiveCurrency,
        currencyRateToIDR: currentFx.rateToIDR,
        paymentMethod,
        cashTendered: paymentMethod === 'cash' ? cashTendered : totalAmount,
        cashChange: paymentMethod === 'cash' ? cashChange : 0,
        customerName,
        customerPhone,
        customerMemberId,
      };

      const res = await apiClient.posCheckout(payload);

      if (res.success && res.receipt) {
        setCompletedReceipt(res.receipt);
        setIsTenderModalOpen(false);
        clearCart();
        onShowToast('Checkout Complete', `Receipt #${res.receipt.receiptNumber} generated.`);
        // Reload products and notify parent dashboard to refresh GL and stock
        loadProducts();
        loadHistory();
        if (onInventoryUpdated) {
          onInventoryUpdated();
        }
      }
    } catch (err: any) {
      onShowToast('Checkout Failed', err.message || 'Error processing transaction');
    } finally {
      setIsProcessingCheckout(false);
    }
  };

  // Filtered product items
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      const matchesCategory = selectedCategory === 'ALL' || prod.category === selectedCategory;
      const matchesQuery =
        !searchQuery ||
        prod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prod.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prod.barcode.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesQuery;
    });
  }, [products, selectedCategory, searchQuery]);

  // Categories list
  const categories = ['ALL', 'produce', 'dairy', 'bakery', 'meat_seafood', 'pantry', 'beverages'];

  return (
    <div className="space-y-4 font-sans animate-fadeIn">
      {/* 1. POS Top Bar: Store context, Cashier session, Multi-Currency, and Scanner */}
      <div
        className={`p-3.5 sm:p-4 rounded-2xl border transition-colors shadow-xs ${
          isLight ? 'bg-white border-gray-200' : 'bg-zinc-900 border-zinc-800'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Left: Outlet & Operator Badge */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
              <Store className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{currentStoreInfo.storeName}</span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 text-xs font-medium">
              <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="font-bold">{activeStaffSession?.userName || 'Andi Wijaya'}</span>
              <span className="text-[10px] uppercase font-mono px-1 py-0.2 rounded bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300">
                {activeStaffSession?.userRole || 'cashier'}
              </span>
              <span className="text-[11px] text-zinc-400 hidden sm:inline">
                ({activeStaffSession?.shiftName || 'Morning Shift'})
              </span>
            </div>
          </div>

          {/* Right: Currency Selector & Parked Tickets & History */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Multi-Currency Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-800 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-zinc-700">
              <Globe className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-[11px] text-slate-600 dark:text-zinc-300 font-semibold hidden sm:inline">Currency:</span>
              <select
                value={activeCurrency}
                onChange={(e) => setActiveCurrency(e.target.value as SupportedCurrency)}
                className="text-xs font-bold bg-transparent border-0 focus:ring-0 cursor-pointer text-slate-800 dark:text-zinc-200"
              >
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c.code} value={c.code} className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-white">
                    {c.code} ({c.symbol})
                  </option>
                ))}
              </select>
              {activeCurrency !== 'IDR' && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono hidden md:inline">
                  1 {activeCurrency} = Rp {currentFx.rateToIDR.toLocaleString()}
                </span>
              )}
            </div>

            {/* Parked Tickets Button */}
            {parkedTickets.length > 0 && (
              <div className="flex items-center gap-1.5">
                {parkedTickets.map((parked) => (
                  <button
                    key={parked.id}
                    onClick={() => handleResumeTicket(parked.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-semibold cursor-pointer transition-all"
                    title={`Resume held ticket for ${parked.customer}`}
                  >
                    <PlayCircle className="w-3.5 h-3.5 text-amber-500" />
                    <span>{parked.id}</span>
                  </button>
                ))}
              </div>
            )}

            {/* History Toggle */}
            <button
              onClick={() => setIsHistoryDrawerOpen(!isHistoryDrawerOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-xs font-medium text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-zinc-500" />
              <span className="hidden sm:inline">Receipts ({historyReceipts.length})</span>
            </button>
          </div>
        </div>

        {/* Barcode Scanner Input Form */}
        <form onSubmit={handleBarcodeSubmit} className="mt-3 pt-3 border-t border-slate-200 dark:border-zinc-800 flex items-center gap-2">
          <div className="relative flex-1">
            <Scan className="w-4 h-4 text-emerald-600 dark:text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={barcodeInputRef}
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="Barcode Scanner Ready — Scan SKU (e.g. SKU-PRD-001) or press Enter to add..."
              className={`w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono ${
                isLight ? 'bg-gray-50 border-gray-200 text-gray-900' : 'bg-zinc-800 border-zinc-700 text-white'
              }`}
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <Scan className="w-3.5 h-3.5" />
            <span>Scan / Add</span>
          </button>
        </form>

        {/* Quick Scale Variable-Weight Barcode Test Buttons */}
        <div className="mt-2.5 flex items-center gap-1.5 flex-wrap text-[11px]">
          <span className="text-slate-600 dark:text-zinc-300 font-bold flex items-center gap-1">
            <Scale className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Variable Scale Barcode Tests:
          </span>
          {SAMPLE_SCALE_BARCODES.map((s) => (
            <button
              key={s.barcode}
              type="button"
              onClick={() => {
                setBarcodeInput(s.barcode);
                handleBarcodeSubmit(undefined, s.barcode);
              }}
              className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 font-mono transition-all flex items-center gap-1"
              title={`Simulate scanning scale tag: ${s.barcode}`}
            >
              <span>{s.label}</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">({s.weightGrams}g)</span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Main POS Workspace: Product Grid (60%) + Cart Ticket (40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Column: Product Grid & Category Filters (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          {/* Category Tabs & Quick Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : isLight
                      ? 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                  }`}
                >
                  {cat === 'ALL' ? 'All Items' : cat.replace('_', ' ').toUpperCase()}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[160px] sm:w-48">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter items..."
                className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                  isLight ? 'bg-white border-gray-200 text-gray-900' : 'bg-zinc-800 border-zinc-700 text-white'
                }`}
              />
            </div>
          </div>

          {/* Product Items Grid */}
          {isLoadingProducts ? (
            <div className="p-12 text-center text-xs text-zinc-400">
              <span className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin inline-block mb-2" />
              <p>Loading POS Product Catalog...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div
              className={`p-10 rounded-2xl border text-center text-xs ${
                isLight ? 'bg-white border-gray-200 text-gray-500' : 'bg-zinc-900 border-zinc-800 text-zinc-400'
              }`}
            >
              No products found matching "{searchQuery}"
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[600px] overflow-y-auto pr-1">
              {filteredProducts.map((prod) => {
                const isOutOfStock = prod.availableStock <= 0;
                return (
                  <div
                    key={prod.sku}
                    className={`p-3 rounded-2xl border flex flex-col justify-between transition-all group relative ${
                      isOutOfStock ? 'opacity-50' : 'hover:shadow-md'
                    } ${
                      isLight
                        ? 'bg-white border-gray-200/80 hover:border-emerald-500/50'
                        : 'bg-zinc-900 border-zinc-800 hover:border-emerald-500/50'
                    }`}
                  >
                    <div>
                      {/* Product Image & FEFO Tag */}
                      <div className="relative aspect-4/3 rounded-xl overflow-hidden bg-slate-100 dark:bg-zinc-800 mb-2">
                        <img
                          src={prod.image}
                          alt={prod.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                        {/* FEFO Expiry Badge */}
                        {prod.daysUntilExpiry !== undefined && (
                          <div
                            className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono tracking-tight shadow-xs ${
                              prod.daysUntilExpiry <= 2
                                ? 'bg-red-500 text-white'
                                : prod.daysUntilExpiry <= 5
                                ? 'bg-amber-500 text-black'
                                : 'bg-emerald-600 text-white'
                            }`}
                          >
                            Exp: {prod.daysUntilExpiry}d ({prod.lotNumber || 'FEFO'})
                          </div>
                        )}
                        {prod.isWeighted && (
                          <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-blue-600/90 text-white text-[9px] font-bold flex items-center gap-1 shadow-xs">
                            <Scale className="w-2.5 h-2.5" />
                            <span>Scale</span>
                          </div>
                        )}
                      </div>

                      {/* Name & SKU */}
                      <h4 className="text-xs font-bold line-clamp-2 text-slate-900 dark:text-zinc-100 leading-tight">
                        {prod.name}
                      </h4>
                      <div className="flex items-center justify-between text-[10px] text-zinc-500 mt-1">
                        <span className="font-mono">{prod.sku}</span>
                        <span>Stock: {prod.availableStock}</span>
                      </div>
                    </div>

                    {/* Price & Action Button */}
                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-1">
                      <div>
                        <span className="text-xs font-extrabold text-emerald-800 dark:text-emerald-400 block">
                          {formatCurrency(prod.sellingPrice)}
                        </span>
                        {prod.isWeighted && (
                          <span className="text-[10px] text-zinc-400 block -mt-0.5">
                            {formatCurrency(prod.pricePerKg || prod.sellingPrice * 4)}/kg
                          </span>
                        )}
                      </div>

                      {prod.isWeighted ? (
                        <button
                          type="button"
                          onClick={() => setScalingProduct(prod)}
                          disabled={isOutOfStock}
                          className="p-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white transition-all cursor-pointer shadow-xs flex items-center gap-1 text-[11px] font-bold"
                          title="Weigh item on digital scale"
                        >
                          <Scale className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Weigh</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => addToCart(prod, 1)}
                          disabled={isOutOfStock}
                          className="p-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white transition-all cursor-pointer shadow-xs"
                          title="Add unit to cart"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Register Bill Ticket & Tender CTA (5 cols) */}
        <div
          className={`lg:col-span-5 rounded-2xl border p-4 flex flex-col justify-between shadow-sm sticky top-4 ${
            isLight ? 'bg-white border-gray-200' : 'bg-zinc-900 border-zinc-800'
          }`}
        >
          {/* Header Ticket Details */}
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <ReceiptText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                  Register Ticket
                </h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                  {cart.length} line{cart.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleParkTicket}
                  disabled={cart.length === 0}
                  className="px-2.5 py-1 rounded-lg border border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 text-xs font-semibold transition-all disabled:opacity-40 cursor-pointer flex items-center gap-1"
                  title="Park / Hold current ticket"
                >
                  <PauseCircle className="w-3.5 h-3.5" />
                  <span>Hold</span>
                </button>
                <button
                  type="button"
                  onClick={clearCart}
                  disabled={cart.length === 0}
                  className="p-1 rounded-lg border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-red-500 transition-colors disabled:opacity-40 cursor-pointer"
                  title="Clear register"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Customer Shopper Input */}
            <div className="mt-3 flex items-center gap-2">
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Shopper / Member Name..."
                className={`flex-1 text-xs px-2.5 py-1.5 rounded-xl border focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                  isLight ? 'bg-gray-50 border-gray-200 text-gray-900' : 'bg-zinc-800 border-zinc-700 text-white'
                }`}
              />
              <select
                value={discountPercent}
                onChange={(e) => setDiscountPercent(Number(e.target.value))}
                className={`text-xs px-2 py-1.5 rounded-xl border font-semibold cursor-pointer ${
                  isLight ? 'bg-gray-50 border-gray-200 text-gray-800' : 'bg-zinc-800 border-zinc-700 text-zinc-200'
                }`}
              >
                <option value={0}>0% Disc</option>
                <option value={5}>5% Member</option>
                <option value={10}>10% Staff</option>
                <option value={15}>15% Promo</option>
              </select>
            </div>

            {/* Itemized Cart Rows */}
            <div className="mt-3 divide-y divide-slate-100 dark:divide-zinc-800 max-h-[280px] overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-400">
                  <ShoppingCart className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mx-auto mb-2 stroke-1" />
                  <p>Register cart is empty.</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">Scan items or select from catalog</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="py-2 flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">
                          {item.name}
                        </span>
                        {item.isWeighted && (
                          <span className="text-[9px] px-1 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-mono">
                            {item.quantity} kg
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-0.5">
                        <span className="font-mono">{item.sku}</span>
                        {item.lotNumber && (
                          <span className="text-amber-600 dark:text-amber-400 font-mono">
                            LOT: {item.lotNumber}
                          </span>
                        )}
                        <span>{formatCurrency(item.unitPrice)}</span>
                      </div>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, -1)}
                        className="p-1 rounded-md bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold font-mono min-w-[24px] text-center text-slate-900 dark:text-zinc-100">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, 1)}
                        className="p-1 rounded-md bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>

                      <span className="text-xs font-bold font-mono ml-2 min-w-[70px] text-right text-slate-900 dark:text-zinc-100">
                        {formatCurrency(item.lineTotal)}
                      </span>

                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        className="p-1 text-zinc-400 hover:text-red-500 transition-colors cursor-pointer ml-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Bottom Financial Totals & Tender CTA */}
          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-zinc-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-zinc-300 font-medium">
              <span>Subtotal:</span>
              <span className="font-mono">{formatCurrency(subtotal)}</span>
            </div>

            {discountAmount > 0 && (
              <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400">
                <span>Discount ({discountPercent}%):</span>
                <span className="font-mono">-{formatCurrency(discountAmount)}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-zinc-300 font-medium">
              <span>PPN / VAT (11%):</span>
              <span className="font-mono">{formatCurrency(taxAmount)}</span>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Total Due:</span>
                {activeCurrency !== 'IDR' && (
                  <span className="text-[11px] text-zinc-400 font-mono block">
                    ≈ {formatIDR(totalAmount)}
                  </span>
                )}
              </div>
              <span className="text-xl sm:text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 font-mono">
                {formatCurrency(totalAmount)}
              </span>
            </div>

            <button
              type="button"
              disabled={cart.length === 0}
              onClick={() => {
                setCashTendered(totalAmount);
                setIsTenderModalOpen(true);
              }}
              className="w-full mt-3 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <CreditCard className="w-4 h-4" />
              <span>Tender Payment ({activeCurrency})</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. DIGITAL WEIGHT SCALE MODAL (Produce & Meat nuanced workflow) */}
      {scalingProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl space-y-5 animate-in zoom-in-95 ${
              isLight ? 'bg-white border-gray-200' : 'bg-zinc-900 border-zinc-800 text-white'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-blue-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                  Digital Scale Weighing
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setScalingProduct(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-zinc-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <img
                  src={scalingProduct.image}
                  alt={scalingProduct.name}
                  className="w-14 h-14 rounded-xl object-cover bg-slate-100 dark:bg-zinc-800 border"
                />
                <div>
                  <h4 className="font-bold text-sm">{scalingProduct.name}</h4>
                  <p className="text-xs text-zinc-400 font-mono">{scalingProduct.sku}</p>
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(scalingProduct.pricePerKg || scalingProduct.sellingPrice * 4)} / kg
                  </p>
                </div>
              </div>

              {/* Digital Scale Readout Display */}
              <div className="p-4 rounded-xl bg-zinc-950 text-emerald-400 font-mono border border-emerald-500/30 text-center shadow-inner">
                <span className="text-[10px] text-zinc-400 uppercase tracking-widest block">
                  Net Weight (Beban Bersih)
                </span>
                <span className="text-3xl font-extrabold tracking-wider block my-1">
                  {(Math.max(0, scaleGrossGrams - scaleTareGrams) / 1000).toFixed(3)} kg
                </span>
                <span className="text-xs text-zinc-400">
                  Gross: {scaleGrossGrams}g | Tare (Bag): {scaleTareGrams}g
                </span>
              </div>

              {/* Scale Controls: Sliders and Tare */}
              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-200 block mb-1">
                    Simulate Scale Weight (Grams):
                  </label>
                  <input
                    type="range"
                    min={50}
                    max={5000}
                    step={25}
                    value={scaleGrossGrams}
                    onChange={(e) => setScaleGrossGrams(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                  <div className="flex items-center gap-2 mt-1">
                    {[250, 500, 1000, 1500, 2000].map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setScaleGrossGrams(g)}
                        className="px-2 py-1 rounded bg-slate-100 dark:bg-zinc-800 text-[11px] font-mono hover:bg-slate-200 dark:hover:bg-zinc-700 cursor-pointer"
                      >
                        {g >= 1000 ? `${g / 1000}kg` : `${g}g`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Tare Deduction (Packaging):</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={scaleTareGrams}
                      onChange={(e) => setScaleTareGrams(Number(e.target.value))}
                      className="w-16 px-2 py-1 rounded border text-right font-mono text-xs dark:bg-zinc-800 dark:border-zinc-700"
                    />
                    <span>g</span>
                  </div>
                </div>

                {/* Line Price preview */}
                <div className="pt-2 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-400">Calculated Line Total:</span>
                  <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                    {formatCurrency(
                      Math.round(
                        (scalingProduct.pricePerKg || scalingProduct.sellingPrice * 4) *
                          (Math.max(0, scaleGrossGrams - scaleTareGrams) / 1000)
                      )
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setScalingProduct(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const netGrams = Math.max(0, scaleGrossGrams - scaleTareGrams);
                  addToCart(scalingProduct, 1, true, netGrams);
                  setScalingProduct(null);
                  onShowToast('Weighed Item Added', `${scalingProduct.name} (${(netGrams / 1000).toFixed(3)}kg) added`);
                }}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md cursor-pointer"
              >
                Apply Weight to Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. PAYMENT TENDER MODAL (Cash, QRIS, Card, Currency Conversion) */}
      {isTenderModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl space-y-5 animate-in zoom-in-95 ${
              isLight ? 'bg-white border-gray-200' : 'bg-zinc-900 border-zinc-800 text-white'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                  Payment Tender &amp; Register Settle
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsTenderModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-zinc-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Total Due Banner */}
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between">
              <div>
                <span className="text-xs text-zinc-500 dark:text-zinc-300">Total Tender Due:</span>
                <span className="text-2xl font-black text-emerald-800 dark:text-emerald-300 font-mono block">
                  {formatCurrency(totalAmount)}
                </span>
              </div>
              {activeCurrency !== 'IDR' && (
                <div className="text-right">
                  <span className="text-[11px] text-slate-600 dark:text-zinc-300 font-mono font-medium">Base Statutory IDR:</span>
                  <span className="text-xs font-bold font-mono text-slate-700 dark:text-zinc-300 block">
                    {formatIDR(totalAmount)}
                  </span>
                </div>
              )}
            </div>

            {/* Payment Method Selector Tabs */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1 text-xs font-bold transition-all cursor-pointer ${
                  paymentMethod === 'cash'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700'
                }`}
              >
                <Banknote className="w-4 h-4" />
                <span>Cash (Tunai)</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('qris')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1 text-xs font-bold transition-all cursor-pointer ${
                  paymentMethod === 'qris'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700'
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span>QRIS Instant</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('debit_card')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1 text-xs font-bold transition-all cursor-pointer ${
                  paymentMethod.includes('card')
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>Debit / Card</span>
              </button>
            </div>

            {/* Method Specific Panels */}
            {paymentMethod === 'cash' && (
              <div className="space-y-3 pt-1">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-200 block mb-1">
                    Cash Tendered (Uang Diterima):
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-zinc-400">
                      Rp
                    </span>
                    <input
                      type="number"
                      value={cashTendered || ''}
                      onChange={(e) => setCashTendered(Number(e.target.value))}
                      className="w-full pl-9 pr-3 py-2 text-base font-bold font-mono rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white border-slate-300 text-slate-900 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-400"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Quick denomination chips */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setCashTendered(totalAmount)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 text-xs font-bold cursor-pointer"
                  >
                    Uang Pas (Exact)
                  </button>
                  {[50000, 100000, 200000, 500000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setCashTendered(amt)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-xs font-mono cursor-pointer"
                    >
                      Rp {amt.toLocaleString()}
                    </button>
                  ))}
                </div>

                {/* Change calculation */}
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-zinc-800/80 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-zinc-200">Change Due (Kembalian):</span>
                  <span
                    className={`text-base font-black font-mono ${
                      cashTendered >= totalAmount ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'
                    }`}
                  >
                    {cashTendered >= totalAmount ? formatIDR(cashChange) : 'Kurang ' + formatIDR(totalAmount - cashTendered)}
                  </span>
                </div>
              </div>
            )}

            {paymentMethod === 'qris' && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border text-center space-y-3">
                <div className="w-36 h-36 mx-auto bg-white p-2 rounded-xl border shadow-sm flex items-center justify-center">
                  <QRCodeSVG
                    value={`00020101021226670014ID.LINKAJA.WWW01189360091438201948250215ID10200392817440303UME520454115303360540${totalAmount}5802ID5913GroceMart SEN6007Jakarta61051211062070703A016304`}
                    size={130}
                    level="M"
                  />
                </div>
                <div className="text-xs">
                  <span className="font-bold text-slate-800 dark:text-zinc-200 block">
                    GroceMart Senopati Dynamic QRIS
                  </span>
                  <span className="text-[11px] text-zinc-400 font-mono">
                    NMID: ID1020039281744 · ASPI Standard 2026
                  </span>
                </div>
              </div>
            )}

            {paymentMethod.includes('card') && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border text-center space-y-2">
                <CreditCard className="w-8 h-8 text-blue-500 mx-auto" />
                <div className="text-xs">
                  <span className="font-bold block">BCA EDC Register Terminal #04</span>
                  <span className="text-[11px] text-zinc-400">
                    Insert or Tap Customer Debit / Credit Card
                  </span>
                </div>
              </div>
            )}

            {/* Accounting Hook Notice */}
            <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-zinc-800/40 text-[10px] text-zinc-500 flex items-center gap-1.5 font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              <span>
                Auto GL Posting: Debit Asset #{paymentMethod === 'cash' ? '1010' : paymentMethod === 'qris' ? '1030' : '1020'} · Credit Sales #4010 · COGS #5010
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsTenderModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                disabled={isProcessingCheckout || (paymentMethod === 'cash' && cashTendered < totalAmount)}
                onClick={handleExecuteCheckout}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold shadow-md cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isProcessingCheckout ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Deducting Stock &amp; Syncing GL...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Complete Sale &amp; Print Struk</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. ELECTRONIC THERMAL RECEIPT MODAL (Struk Kasir) */}
      {completedReceipt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white text-slate-900 border border-slate-200 p-6 shadow-2xl space-y-4 font-mono text-xs animate-in zoom-in-95">
            {/* Header */}
            <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-300">
              <div className="w-8 h-8 rounded-lg bg-emerald-800 text-amber-300 font-bold text-sm mx-auto flex items-center justify-center">
                GM
              </div>
              <h3 className="font-extrabold text-sm tracking-wider">PT BUMI RETAIL SEJAHTERA</h3>
              <p className="text-[10px] text-zinc-500 leading-tight">
                {completedReceipt.storeName}
                <br />
                Jl. Senopati No. 82, Jakarta Selatan 12110
              </p>
            </div>

            {/* Metadata */}
            <div className="text-[10px] space-y-0.5 text-slate-600 pb-2 border-b border-dashed border-slate-300">
              <div className="flex justify-between">
                <span>Receipt #:</span>
                <span className="font-bold text-slate-900">{completedReceipt.receiptNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{new Date(completedReceipt.timestamp).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Cashier:</span>
                <span>{completedReceipt.cashierName.split(' ')[0]} (Reg #04)</span>
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-1.5 py-1">
              {completedReceipt.items.map((item) => (
                <div key={item.id} className="text-[10px]">
                  <div className="flex justify-between font-bold">
                    <span className="truncate max-w-[190px]">{item.name}</span>
                    <span>{formatIDR(item.lineTotal)}</span>
                  </div>
                  <div className="text-zinc-500 text-[9px] flex justify-between">
                    <span>
                      {item.quantity} x {formatIDR(item.unitPrice)}
                    </span>
                    {item.lotNumber && <span>LOT: {item.lotNumber}</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="pt-2 border-t border-dashed border-slate-300 space-y-0.5 text-[10px]">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatIDR(completedReceipt.subtotal)}</span>
              </div>
              {completedReceipt.discount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount:</span>
                  <span>-{formatIDR(completedReceipt.discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>PPN (11%):</span>
                <span>{formatIDR(completedReceipt.tax)}</span>
              </div>
              <div className="flex justify-between text-xs font-bold pt-1 border-t border-zinc-900">
                <span>TOTAL:</span>
                <span>{formatIDR(completedReceipt.total)}</span>
              </div>
              {completedReceipt.currency !== 'IDR' && (
                <div className="flex justify-between text-[10px] text-zinc-500">
                  <span>Tender ({completedReceipt.currency}):</span>
                  <span>
                    {completedReceipt.currency} {completedReceipt.currencyTotal}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-[10px] pt-1 text-slate-600">
                <span>Tender: {completedReceipt.paymentMethod.toUpperCase()}</span>
                <span>{formatIDR(completedReceipt.cashTendered || completedReceipt.total)}</span>
              </div>
              {completedReceipt.cashChange !== undefined && completedReceipt.cashChange > 0 && (
                <div className="flex justify-between text-[10px] text-slate-600 font-bold">
                  <span>Change (Kembalian):</span>
                  <span>{formatIDR(completedReceipt.cashChange)}</span>
                </div>
              )}
            </div>

            {/* Footer / GL Audit Stamp */}
            <div className="pt-2 border-t border-dashed border-slate-300 text-center text-[9px] text-zinc-500 space-y-1">
              <p>GL Journal Vouchers: {completedReceipt.journalEntryIds.slice(0, 2).join(', ')}</p>
              <p>*** TERIMA KASIH ATAS KUNJUNGAN ANDA ***</p>
              <p className="text-[8px] text-zinc-400">Barang yang dibeli tidak dapat ditukar kecuali basi.</p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="flex-1 py-2 rounded-xl border border-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-slate-50 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
              <button
                type="button"
                onClick={() => setCompletedReceipt(null)}
                className="flex-1 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold cursor-pointer"
              >
                New Sale (F2)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. RECENT TRANSACTIONS DRAWER */}
      {isHistoryDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end">
          <div
            className={`w-full max-w-md h-full p-6 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200 ${
              isLight ? 'bg-white text-slate-900' : 'bg-zinc-900 text-white'
            }`}
          >
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="font-bold text-base">Recent POS Receipts</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsHistoryDrawerOpen(false)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-zinc-400 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {historyReceipts.length === 0 ? (
                  <p className="text-xs text-zinc-400 text-center py-8">No POS transactions yet today.</p>
                ) : (
                  historyReceipts.map((rcp) => (
                    <div
                      key={rcp.receiptNumber}
                      onClick={() => setCompletedReceipt(rcp)}
                      className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all hover:border-emerald-500/50 ${
                        isLight ? 'bg-gray-50 border-gray-200 hover:bg-white' : 'bg-zinc-800/60 border-zinc-700 hover:bg-zinc-800'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span className="font-mono">{rcp.receiptNumber}</span>
                        <span className="text-emerald-600 dark:text-emerald-400">{formatIDR(rcp.total)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-1">
                        <span>{new Date(rcp.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="uppercase font-mono">{rcp.paymentMethod}</span>
                        <span>{rcp.items.length} items</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsHistoryDrawerOpen(false)}
              className="w-full mt-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-semibold cursor-pointer"
            >
              Close History
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
