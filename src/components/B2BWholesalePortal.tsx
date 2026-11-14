import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type {
  B2BCustomer,
  WholesaleProduct,
  B2BCartItem,
  WholesaleUoM,
  PWPRule,
  B2BWholesaleOrder,
  GiroPaymentRecord,
  SkuTaxRule,
  IndonesianTaxCategory,
} from '../types/index.ts';
import { formatIDR } from '../utils/formatters';
import { computeIndonesianTax, inferDefaultTaxCategory } from '../utils/indonesianCompliance';
import { getOdooSkuProfile } from '../utils/inventoryOdooHelper';
import { apiClient } from '../services/apiClient';
import { usePrint } from '../context/PrintContext';
import {
  Building2,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Layers,
  ArrowRight,
  Calculator,
  Search,
  Filter,
  Package,
  Plus,
  Minus,
  Trash2,
  FileText,
  Clock,
  ArrowUpRight,
  TrendingUp,
  X,
  Upload,
  UserCheck,
  Percent,
  Check,
  AlertCircle,
  Truck,
  Printer,
  ChevronDown,
} from 'lucide-react';

interface B2BWholesalePortalProps {
  onBackToRetailStorefront: () => void;
  onShowToast: (title: string, message: string) => void;
  isCartOpen?: boolean;
  onCloseCart?: () => void;
  onOpenCart?: () => void;
  cartItems?: B2BCartItem[];
  onUpdateCartItems?: (items: B2BCartItem[] | ((prev: B2BCartItem[]) => B2BCartItem[])) => void;
  onOpenCustomerPortal?: (tab?: 'b2b_credit' | 'b2b_orders' | 'b2b_profile') => void;
  selectedCustomerId?: string;
  onSelectCustomerId?: (id: string) => void;
  customers?: B2BCustomer[];
  onUpdateCustomers?: (customers: B2BCustomer[]) => void;
  b2bOrders?: B2BWholesaleOrder[];
  onUpdateB2bOrders?: (orders: B2BWholesaleOrder[]) => void;
}

export const B2BWholesalePortal: React.FC<B2BWholesalePortalProps> = ({
  onBackToRetailStorefront,
  onShowToast,
  isCartOpen,
  onCloseCart,
  onOpenCart,
  cartItems: propCartItems,
  onUpdateCartItems,
  onOpenCustomerPortal,
  selectedCustomerId: propSelectedCustomerId,
  onSelectCustomerId,
  customers: propCustomers,
  onUpdateCustomers,
  b2bOrders: propB2bOrders,
  onUpdateB2bOrders,
}) => {
  const { triggerPrint } = usePrint();
  // 1. Data State (synced with parent if supplied, fallback to local fetch)
  const [internalCustomers, setInternalCustomers] = useState<B2BCustomer[]>([]);
  const customers = propCustomers && propCustomers.length > 0 ? propCustomers : internalCustomers;
  const setCustomers = (c: B2BCustomer[]) => {
    if (onUpdateCustomers) onUpdateCustomers(c);
    setInternalCustomers(c);
  };

  const [internalSelectedCustomerId, setInternalSelectedCustomerId] = useState<string>('B2B-CUST-001');
  const selectedCustomerId = propSelectedCustomerId || internalSelectedCustomerId;
  const setSelectedCustomerId = (id: string) => {
    if (onSelectCustomerId) onSelectCustomerId(id);
    setInternalSelectedCustomerId(id);
  };

  const [products, setProducts] = useState<WholesaleProduct[]>([]);
  const [pwpRules, setPwpRules] = useState<PWPRule[]>([]);
  const [skuTaxRules, setSkuTaxRules] = useState<SkuTaxRule[]>([]);

  const [internalB2bOrders, setInternalB2bOrders] = useState<B2BWholesaleOrder[]>([]);
  const b2bOrders = propB2bOrders && propB2bOrders.length > 0 ? propB2bOrders : internalB2bOrders;
  const setB2bOrders = (ords: B2BWholesaleOrder[]) => {
    if (onUpdateB2bOrders) onUpdateB2bOrders(ords);
    setInternalB2bOrders(ords);
  };

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // 2. Search & Category Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // 3. B2B Cart State
  const [internalCartItems, setInternalCartItems] = useState<B2BCartItem[]>([]);
  const cartItems = propCartItems !== undefined ? propCartItems : internalCartItems;
  const setCartItems = (updater: B2BCartItem[] | ((prev: B2BCartItem[]) => B2BCartItem[])) => {
    const next = typeof updater === 'function' ? updater(cartItems) : updater;
    if (onUpdateCartItems) onUpdateCartItems(next);
    setInternalCartItems(next);
  };

  const [internalCartOpen, setInternalCartOpen] = useState<boolean>(false);
  const isCartDrawerOpen = isCartOpen !== undefined ? isCartOpen : internalCartOpen;
  const setIsCartDrawerOpen = (open: boolean) => {
    if (open) {
      if (onOpenCart) onOpenCart();
      else setInternalCartOpen(true);
    } else {
      if (onCloseCart) onCloseCart();
      else setInternalCartOpen(false);
    }
  };

  // 4. Checkout Modal State
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState<boolean>(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<
    'term_net7' | 'term_net14' | 'term_net30' | 'bilyet_giro' | 'transfer_verification' | 'instant_va'
  >('term_net14');
  const [giroNumber, setGiroNumber] = useState<string>('BG-BCA-8891024');
  const [giroBank, setGiroBank] = useState<string>('Bank Central Asia (BCA)');
  const [giroDueDate, setGiroDueDate] = useState<string>('2026-11-26');
  const [giroSlipPhoto, setGiroSlipPhoto] = useState<string>(
    'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=400&q=80'
  );
  const [transferProofPhoto, setTransferProofPhoto] = useState<string>(
    'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=400&q=80'
  );
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);
  const [activeReceiptOrder, setActiveReceiptOrder] = useState<B2BWholesaleOrder | null>(null);

  // Active Customer Object
  const currentCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId) || customers[0] || null;
  }, [customers, selectedCustomerId]);

  // Load Initial Data
  const loadPortalData = async () => {
    setIsLoading(true);
    try {
      const [custData, prodData, rulesData, ordersData, taxRulesData] = await Promise.all([
        apiClient.getB2BCustomers(),
        apiClient.getB2BProducts(),
        apiClient.getPWPRules(),
        apiClient.getB2BOrders(),
        apiClient.getSkuTaxRules().catch(() => []),
      ]);
      setCustomers(custData);
      setProducts(prodData);
      setPwpRules(rulesData);
      setB2bOrders(ordersData);
      setSkuTaxRules(taxRulesData);
    } catch (err) {
      console.error('Failed to load B2B portal data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPortalData();
  }, []);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      const matchQuery =
        prod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prod.sku.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = selectedCategory === 'ALL' || prod.category === selectedCategory;
      return matchQuery && matchCat;
    });
  }, [products, searchQuery, selectedCategory]);

  // UoM Ordering State per SKU (selected UoM and quantity)
  const [skuSelections, setSkuSelections] = useState<
    Record<string, { uom: WholesaleUoM; quantity: number }>
  >({});

  const getSkuSelection = (product: WholesaleProduct) => {
    if (skuSelections[product.id]) return skuSelections[product.id];
    // Default to the first carton or highest UoM tier
    const defaultTier = product.uomTiers.find((t) => t.uom === 'carton') || product.uomTiers[0];
    return {
      uom: defaultTier.uom,
      quantity: 1,
    };
  };

  const handleUpdateSkuSelection = (
    productId: string,
    uom: WholesaleUoM,
    quantity: number
  ) => {
    setSkuSelections((prev) => ({
      ...prev,
      [productId]: { uom, quantity: Math.max(0.1, quantity) },
    }));
  };

  // Add to Wholesale Cart with Multi-Tier Calculation
  const handleAddToCart = (product: WholesaleProduct) => {
    const selection = getSkuSelection(product);
    const tier = product.uomTiers.find((t) => t.uom === selection.uom) || product.uomTiers[0];
    const baseUnitsCalculated = Math.round(selection.quantity * tier.multiplierToBase * 10) / 10;
    const lineTotal = Math.round(selection.quantity * tier.unitPrice);

    setCartItems((prev) => {
      const existingIdx = prev.findIndex(
        (it) => it.product.id === product.id && it.selectedUoM === selection.uom
      );
      if (existingIdx >= 0) {
        const next = [...prev];
        const existing = next[existingIdx];
        const newQty = Math.round((existing.quantity + selection.quantity) * 10) / 10;
        next[existingIdx] = {
          ...existing,
          quantity: newQty,
          baseUnitsCalculated: Math.round(newQty * tier.multiplierToBase * 10) / 10,
          lineTotal: Math.round(newQty * tier.unitPrice),
        };
        return next;
      }
      return [
        ...prev,
        {
          id: `b2b-cart-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          product,
          selectedUoM: selection.uom,
          quantity: selection.quantity,
          unitPrice: tier.unitPrice,
          baseUnitsCalculated,
          lineTotal,
        },
      ];
    });

    onShowToast(
      'Added to Wholesale Basket',
      `${selection.quantity} ${tier.label} of ${product.name} (${baseUnitsCalculated} base units)`
    );
  };

  const handleUpdateCartQuantity = (cartItemId: string, newQty: number) => {
    if (newQty <= 0) {
      setCartItems((prev) => prev.filter((it) => it.id !== cartItemId));
      return;
    }
    setCartItems((prev) =>
      prev.map((it) => {
        if (it.id === cartItemId) {
          if (it.isPwpRedemption && newQty > 1) {
            onShowToast('Tebus Murah Limit', 'Maksimal 1 unit promo Tebus Murah per faktur (Tidak berlaku kelipatan).');
            return it;
          }
          const tier = it.product.uomTiers.find((t) => t.uom === it.selectedUoM) || it.product.uomTiers[0];
          return {
            ...it,
            quantity: Math.round(newQty * 10) / 10,
            baseUnitsCalculated: Math.round(newQty * tier.multiplierToBase * 10) / 10,
            lineTotal: Math.round(newQty * tier.unitPrice),
          };
        }
        return it;
      })
    );
  };

  const handleRemoveCartItem = (cartItemId: string) => {
    setCartItems((prev) => prev.filter((it) => it.id !== cartItemId));
  };

  // Cart Calculations
  const rawSubtotal = cartItems.reduce((sum, it) => sum + it.lineTotal, 0);

  // Eligible spend for PWP: Exclude restricted categories (Cigarettes, Infant Formula)
  const eligiblePwpSpend = useMemo(() => {
    return cartItems.reduce((sum, it) => {
      if (it.product.isRestrictedForPwp || it.isPwpRedemption) return sum;
      return sum + it.lineTotal;
    }, 0);
  }, [cartItems]);

  // Primary PWP Rule (Minyak Goreng Sania 2L @ Rp 10.000 upon reaching Rp 1.000.000 eligible spend)
  const primaryPwpRule = pwpRules[0] || null;
  const isPwpUnlocked = primaryPwpRule ? eligiblePwpSpend >= primaryPwpRule.minSpendIDR : false;
  const hasClaimedPwp = cartItems.some((it) => it.isPwpRedemption);

  // Claim Tebus Murah (Non-Cumulative, Capped at exactly 1 Unit)
  const handleClaimPwp = () => {
    if (!primaryPwpRule) return;
    if (hasClaimedPwp) {
      onShowToast('Tebus Murah Limit', 'Maksimal 1 unit promo Tebus Murah per faktur (Tidak berlaku kelipatan).');
      return;
    }
    const redemptionProd = products.find((p) => p.sku === primaryPwpRule.redemptionProductSku);
    if (!redemptionProd) return;

    setCartItems((prev) => [
      ...prev,
      {
        id: `pwp-${Date.now()}`,
        product: redemptionProd,
        selectedUoM: 'pcs',
        quantity: 1, // Strictly capped at 1
        unitPrice: primaryPwpRule.promoPriceIDR,
        baseUnitsCalculated: 1,
        lineTotal: primaryPwpRule.promoPriceIDR,
        isPwpRedemption: true,
      },
    ]);

    onShowToast(
      'Tebus Murah Diklaim!',
      `1 Pcs ${redemptionProd.name} seharga ${formatIDR(primaryPwpRule.promoPriceIDR)} berhasil ditambahkan ke keranjang.`
    );
  };

  // Total B2B Cart Calculations (Indonesian PPN 11% for BKP vs 0% Sembako Exempt matching backend)
  const cartSubtotal = cartItems.reduce((sum, it) => sum + it.lineTotal, 0);
  const cartTaxPPN11 = useMemo(() => {
    return cartItems.reduce((sum, it) => {
      const rule = skuTaxRules.find((r) => r.sku === it.product.sku);
      const taxCat: IndonesianTaxCategory =
        rule?.taxCategory || inferDefaultTaxCategory(it.product.category || '', it.product.name || '');
      const stdRate = rule?.taxRatePercent ?? 11;
      const calc = computeIndonesianTax(Math.round(it.lineTotal), taxCat, false, stdRate);
      return sum + Math.round(calc.ppnIDR) + Math.round(calc.pb1IDR);
    }, 0);
  }, [cartItems, skuTaxRules]);
  const cartTotalDue = cartSubtotal + cartTaxPPN11;
  const totalBaseUnitsInCart = cartItems.reduce((sum, it) => sum + it.baseUnitsCalculated, 0);

  // Customer Credit Status & Lock Check
  const isCreditLocked = currentCustomer ? currentCustomer.status === 'CREDIT_LOCKED' : false;
  const isOverdueLocked = currentCustomer ? currentCustomer.overdueDaysMax > 7 : false;
  const isCreditInsufficient = currentCustomer ? cartTotalDue > currentCustomer.availableCredit : false;
  const cannotUseTerm = isCreditLocked || isOverdueLocked || isCreditInsufficient;

  // Execute Checkout
  const handleExecuteCheckout = async () => {
    if (!currentCustomer) return;
    if (cartItems.length === 0) {
      onShowToast('Cart Empty', 'Please add wholesale items to checkout.');
      return;
    }

    if ((selectedPaymentMethod.startsWith('term_') || selectedPaymentMethod === 'bilyet_giro') && cannotUseTerm) {
      onShowToast('Credit Blocked', 'Credit terms and Bilyet Giro unavailable due to credit limit or overdue receivables.');
      return;
    }

    setIsSubmittingOrder(true);
    try {
      const res = await apiClient.checkoutB2BOrder({
        customerId: currentCustomer.id,
        items: cartItems,
        paymentMethod: selectedPaymentMethod,
        giroDetails:
          selectedPaymentMethod === 'bilyet_giro'
            ? {
                giroNumber,
                bankName: giroBank,
                clearingDueDate: giroDueDate,
                nominal: cartTotalDue,
              }
            : undefined,
        transferProofUrl:
          selectedPaymentMethod === 'transfer_verification' ? transferProofPhoto : undefined,
      });

      if (res.success) {
        onShowToast(
          res.requiresApproval ? 'Order Submitted for Approval' : 'B2B Wholesale Order Confirmed',
          res.message
        );
        // Refresh customer list to update AR balances
        const updatedCusts = await apiClient.getB2BCustomers();
        setCustomers(updatedCusts);
        const updatedOrders = await apiClient.getB2BOrders();
        setB2bOrders(updatedOrders);

        setActiveReceiptOrder(res.order);
        setCartItems([]);
        setIsCheckoutModalOpen(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Checkout Failed', msg);
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-zinc-950 text-stone-900 dark:text-zinc-100 flex flex-col font-sans transition-colors">
      {/* Compact B2B Context Strip: Single Sleek Status Bar above Catalog */}
      <section className="bg-white dark:bg-zinc-900 border-b border-stone-200 dark:border-zinc-800 shadow-2xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
            {/* Wholesale Account Selector & Status Chips */}
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <div className="flex items-center gap-2 bg-stone-100 dark:bg-zinc-800 px-3 py-1.5 rounded-xl border border-stone-200 dark:border-zinc-700 text-xs">
                <Building2 className="w-4 h-4 text-emerald-800 dark:text-emerald-400 shrink-0" />
                <span className="font-semibold text-stone-600 dark:text-zinc-300 hidden sm:inline">Wholesale Account:</span>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="bg-transparent font-bold text-stone-900 dark:text-zinc-100 focus:outline-none cursor-pointer text-xs"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id} className="bg-white dark:bg-zinc-900 text-stone-900 dark:text-zinc-100">
                      {c.companyName} ({c.tierLabel}) {c.status === 'CREDIT_LOCKED' ? '⚠️ [LOCKED]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {currentCustomer && (
                <div className="flex items-center gap-2 text-xs flex-wrap">
                  {/* Credit Facility Pill */}
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-300 font-medium">
                    <CreditCard className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                    <span>Credit:</span>
                    <strong className="font-mono text-emerald-800 dark:text-emerald-300">
                      {formatIDR(currentCustomer.availableCredit)}
                    </strong>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono hidden sm:inline">
                      / {formatIDR(currentCustomer.creditLimit)}
                    </span>
                  </div>

                  {/* AR & Overdue Pill */}
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-medium ${
                      currentCustomer.status === 'CREDIT_LOCKED' || currentCustomer.overdueDaysMax > 0
                        ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-300'
                        : 'bg-stone-50 dark:bg-zinc-800/60 border-stone-200 dark:border-zinc-700 text-stone-700 dark:text-zinc-300'
                    }`}
                  >
                    <span>AR:</span>
                    <strong className="font-mono">{formatIDR(currentCustomer.outstandingAR)}</strong>
                    {currentCustomer.status === 'CREDIT_LOCKED' ? (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-600 text-white uppercase">
                        Locked
                      </span>
                    ) : (
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold hidden sm:inline">
                        Active
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Actions to Unified Customer Portal */}
            <div className="flex items-center gap-2 text-xs self-end lg:self-center">
              <button
                type="button"
                onClick={() => onOpenCustomerPortal?.('b2b_credit')}
                className="px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 dark:hover:bg-zinc-700 text-stone-800 dark:text-zinc-200 font-semibold border border-stone-200 dark:border-zinc-700 transition-colors flex items-center gap-1.5 cursor-pointer text-xs"
                title="View full credit terms, outstanding AR aging, and Bilyet Giro clearing ledger"
              >
                <CreditCard className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Credit &amp; Giro</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenCustomerPortal?.('b2b_orders')}
                className="px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 dark:hover:bg-zinc-700 text-stone-800 dark:text-zinc-200 font-semibold border border-stone-200 dark:border-zinc-700 transition-colors flex items-center gap-1.5 cursor-pointer text-xs"
                title="View bulk orders history and reprint invoices"
              >
                <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Bulk Orders ({b2bOrders.length})</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenCustomerPortal?.('b2b_profile')}
                className="px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 dark:hover:bg-zinc-700 text-stone-800 dark:text-zinc-200 font-semibold border border-stone-200 dark:border-zinc-700 transition-colors flex items-center gap-1.5 cursor-pointer text-xs"
                title="View entity registration, NPWP, KAM rep, and request credit limit increase"
              >
                <Building2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Company Profile</span>
              </button>
            </div>
          </div>

          {/* Auto-Credit Lock Banner if Locked */}
          {currentCustomer && (currentCustomer.status === 'CREDIT_LOCKED' || currentCustomer.overdueDaysMax > 7) && (
            <div className="mt-2 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-xs text-amber-950 dark:text-amber-200 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
              <span>
                <strong>Auto-Credit Facility Locked: </strong>
                {currentCustomer.lockReason ||
                  'Pelanggan memiliki tagihan lewat jatuh tempo > 7 hari atau telah mencapai batas limit kredit. Opsi Term dan Giro dikunci.'}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Main Body Content: Unified Wholesale Purchasing Catalog */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 flex-1 w-full">
        <div className="space-y-6">
            {/* Conditional "Tebus Murah" (PWP) Live Tracker Banner */}
            {primaryPwpRule && (
              <div className="rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-linear-to-r from-emerald-50 via-amber-50/50 to-emerald-50 dark:from-emerald-950/40 dark:via-zinc-900 dark:to-emerald-950/40 p-4 sm:p-5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="p-3 rounded-xl bg-emerald-800 text-amber-300 shadow-xs shrink-0">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white">
                          Promo Tebus Murah PWP
                        </span>
                        <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                          Max 1 unit per faktur (Non-kelipatan)
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100 mt-0.5">
                        {primaryPwpRule.title}
                      </h3>
                      <p className="text-xs text-stone-600 dark:text-zinc-300 mt-1 max-w-2xl leading-relaxed">
                        {primaryPwpRule.description}
                      </p>
                    </div>
                  </div>

                  {/* PWP Claim Action / Progress Tracker */}
                  <div className="sm:text-right shrink-0">
                    {hasClaimedPwp ? (
                      <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Tebus Murah Telah Diklaim</span>
                      </div>
                    ) : isPwpUnlocked ? (
                      <button
                        type="button"
                        onClick={handleClaimPwp}
                        className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
                      >
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        <span>Klaim Tebus Murah Sekarang</span>
                      </button>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="text-xs font-bold text-stone-700 dark:text-zinc-300">
                          Kurang{' '}
                          <span className="font-mono text-emerald-700 dark:text-emerald-400">
                            {formatIDR(primaryPwpRule.minSpendIDR - eligiblePwpSpend)}
                          </span>{' '}
                          lagi
                        </div>
                        <div className="w-48 bg-stone-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.min(
                                100,
                                (eligiblePwpSpend / primaryPwpRule.minSpendIDR) * 100
                              )}%`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-stone-500 dark:text-zinc-400 block">
                          Eligible spend: {formatIDR(eligiblePwpSpend)} / {formatIDR(primaryPwpRule.minSpendIDR)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Catalog Search & Category Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari SKU grosir, beras, minyak goreng, mi, kopi..."
                  className="w-full pl-9 pr-4 py-2.5 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-stone-900 dark:text-zinc-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
                {[
                  { id: 'ALL', label: 'Semua Produk' },
                  { id: 'pantry_staples', label: 'Beras & Sembako' },
                  { id: 'cooking_oil', label: 'Minyak Goreng' },
                  { id: 'instant_noodles', label: 'Mi Instan' },
                  { id: 'beverages', label: 'Kopi & Minuman' },
                  { id: 'dairy_beverages', label: 'Susu UHT' },
                  { id: 'fresh_eggs', label: 'Telur Ayam' },
                  { id: 'household_hygiene', label: 'Kebutuhan Rumah' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl whitespace-nowrap font-medium transition-all cursor-pointer ${
                      selectedCategory === cat.id
                        ? 'bg-emerald-800 text-white font-bold shadow-xs'
                        : 'bg-stone-100 dark:bg-zinc-800 text-stone-700 dark:text-zinc-300 hover:bg-stone-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Wholesale Products Grid with Multi-Tier UoM Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {filteredProducts.map((prod) => {
                const currentSel = getSkuSelection(prod);
                const activeTier =
                  prod.uomTiers.find((t) => t.uom === currentSel.uom) || prod.uomTiers[0];
                const calculatedBaseUnits =
                  Math.round(currentSel.quantity * activeTier.multiplierToBase * 10) / 10;
                const calculatedTotal = Math.round(currentSel.quantity * activeTier.unitPrice);

                const odooProfile = getOdooSkuProfile(prod.sku, prod.category, prod.baseUnit, prod.image);
                const wholesaleImg = prod.b2bImageUrl || odooProfile.b2bImageUrl || prod.image;
                const imgFailed = failedImages[prod.id];

                return (
                  <div
                    key={prod.id}
                    className="rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs hover:border-emerald-500/50 transition-all flex flex-col justify-between overflow-hidden group"
                  >
                    <div>
                      {/* Product Header & B2B Wholesale Packaging Image */}
                      <div className="relative h-44 w-full overflow-hidden bg-stone-100 dark:bg-zinc-800">
                        {imgFailed ? (
                          <div className={`w-full h-full bg-gradient-to-br ${prod.fallbackGradient} flex flex-col items-center justify-center p-4 text-center`}>
                            <Package className="w-8 h-8 text-emerald-900/60 mb-1" />
                            <span className="text-[11px] font-bold text-stone-700 line-clamp-1">{prod.name}</span>
                          </div>
                        ) : (
                          <img
                            src={wholesaleImg}
                            alt={`${prod.name} B2B Wholesale Bulk Packaging`}
                            referrerPolicy="no-referrer"
                            onError={() => setFailedImages((prev) => ({ ...prev, [prod.id]: true }))}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        )}
                        <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
                          <span className="px-2 py-0.5 rounded-md bg-stone-900/80 backdrop-blur-xs text-white text-[10px] font-mono font-bold">
                            {prod.sku}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-amber-600/90 text-white text-[10px] font-bold">
                            B2B Bulk Spec
                          </span>
                          {prod.isRestrictedForPwp && (
                            <span className="px-2 py-0.5 rounded-md bg-rose-600/90 text-white text-[10px] font-bold">
                              Non-PWP Eligible
                            </span>
                          )}
                        </div>
                        <div className="absolute bottom-2.5 right-2.5 px-2 py-1 rounded-lg bg-emerald-950/85 backdrop-blur-xs text-emerald-300 text-[11px] font-mono font-bold">
                          Stock: {prod.currentStockBaseUnits} {prod.baseUnit}
                        </div>
                      </div>

                      {/* Product Metadata */}
                      <div className="p-4 sm:p-5 space-y-3">
                        <div>
                          <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                            {prod.categoryLabel}
                          </div>
                          <h4 className="text-sm font-bold text-stone-900 dark:text-zinc-100 line-clamp-2 mt-0.5">
                            {prod.name}
                          </h4>
                          <p className="text-[11px] text-stone-500 dark:text-zinc-400 line-clamp-2 mt-1">
                            {prod.description}
                          </p>
                          <div className="mt-2 pt-2 border-t border-stone-100 dark:border-zinc-800/80 flex items-center justify-between gap-2 text-[10px] font-mono text-stone-600 dark:text-zinc-400">
                            <span className="truncate">{prod.wholesalePackagingSpec || odooProfile.wholesalePackagingSpec}</span>
                            <span className="shrink-0 font-bold">GTIN {prod.outerBoxBarcode || odooProfile.outerBoxBarcode}</span>
                          </div>
                        </div>

                        {/* Multi-Tier UoM Selector Tabs (Pallet -> Carton -> Slop -> Pack -> Renceng -> Pcs) */}
                        <div className="space-y-1.5 pt-1 border-t border-stone-100 dark:border-zinc-800">
                          <span className="text-[11px] font-bold text-stone-700 dark:text-zinc-300 block">
                            Pilih Satuan Order (UoM Hierarchy):
                          </span>
                          <div className="grid grid-cols-3 gap-1">
                            {prod.uomTiers.map((tier) => (
                              <button
                                key={tier.uom}
                                type="button"
                                onClick={() =>
                                  handleUpdateSkuSelection(prod.id, tier.uom, currentSel.quantity)
                                }
                                className={`p-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                                  currentSel.uom === tier.uom
                                    ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-600 text-emerald-900 dark:text-emerald-200 font-bold shadow-xs'
                                    : 'bg-stone-50 dark:bg-zinc-800/80 border-stone-200 dark:border-zinc-700 text-stone-700 dark:text-zinc-300 hover:bg-stone-100'
                                }`}
                              >
                                <span className="block text-[11px] capitalize truncate">
                                  {tier.uom}
                                </span>
                                <span className="block font-mono text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                                  {formatIDR(tier.unitPrice)}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Fractional Quantity Input & Conversion Preview */}
                        <div className="p-3 rounded-xl bg-stone-50 dark:bg-zinc-800/50 border border-stone-200 dark:border-zinc-700/80 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-stone-700 dark:text-zinc-300">
                              Kuantitas Order ({activeTier.label}):
                            </span>
                            {activeTier.tierDiscountPercent && (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 dark:bg-amber-950 px-1.5 py-0.5 rounded">
                                Hemat {activeTier.tierDiscountPercent}%
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="flex items-center border border-stone-300 dark:border-zinc-600 rounded-xl overflow-hidden bg-white dark:bg-zinc-900">
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateSkuSelection(
                                    prod.id,
                                    currentSel.uom,
                                    Math.max(0.5, currentSel.quantity - (prod.allowFractional ? 0.5 : 1))
                                  )
                                }
                                className="px-2.5 py-1.5 text-stone-600 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-zinc-800 cursor-pointer"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input
                                type="number"
                                step={prod.allowFractional ? '0.1' : '1'}
                                min="0.1"
                                value={currentSel.quantity}
                                onChange={(e) =>
                                  handleUpdateSkuSelection(
                                    prod.id,
                                    currentSel.uom,
                                    parseFloat(e.target.value) || 1
                                  )
                                }
                                className="w-16 text-center text-xs font-bold font-mono focus:outline-none bg-transparent"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateSkuSelection(
                                    prod.id,
                                    currentSel.uom,
                                    currentSel.quantity + (prod.allowFractional ? 0.5 : 1)
                                  )
                                }
                                className="px-2.5 py-1.5 text-stone-600 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-zinc-800 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Fractional conversion chip */}
                            <div className="flex-1 text-right">
                              <span className="text-[10px] text-stone-400 block font-mono">
                                Konversi Base Unit:
                              </span>
                              <span className="text-xs font-bold font-mono text-emerald-700 dark:text-emerald-400">
                                = {calculatedBaseUnits} {prod.baseUnit}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer: Calculated Line Total & Add Button */}
                    <div className="p-4 bg-stone-50 dark:bg-zinc-800/80 border-t border-stone-200 dark:border-zinc-800 flex items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] text-stone-500 dark:text-zinc-400 block">Subtotal Baris:</span>
                        <span className="text-sm font-extrabold font-mono text-stone-900 dark:text-zinc-100">
                          {formatIDR(calculatedTotal)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddToCart(prod)}
                        className="px-3.5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center gap-1.5 active:scale-98"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Order Grosir</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
      </main>

      {/* Slide-Over B2B Wholesale Cart Drawer */}
      {isCartDrawerOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex justify-end"
          onClick={() => setIsCartDrawerOpen(false)}
        >
          <div
            className="w-full max-w-lg h-full bg-white dark:bg-zinc-900 shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-5 border-b border-stone-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShoppingBag className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                <div>
                  <h3 className="font-bold text-base text-stone-900 dark:text-zinc-100">
                    Keranjang Grosir (Wholesale Basket)
                  </h3>
                  <span className="text-xs text-stone-500 dark:text-zinc-400">
                    {cartItems.length} SKU · {totalBaseUnitsInCart} Base Units
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCartDrawerOpen(false)}
                className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Items List */}
            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              {cartItems.length === 0 ? (
                <div className="py-20 text-center text-xs text-stone-400 space-y-3">
                  <ShoppingBag className="w-10 h-10 mx-auto text-stone-300 dark:text-zinc-600" />
                  <p>Keranjang grosir masih kosong.</p>
                </div>
              ) : (
                cartItems.map((it) => (
                  <div
                    key={it.id}
                    className={`p-3.5 rounded-xl border ${
                      it.isPwpRedemption
                        ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700/60'
                        : 'bg-stone-50 dark:bg-zinc-800/60 border-stone-200 dark:border-zinc-700/80'
                    } space-y-2.5`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        {it.isPwpRedemption && (
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500 text-white uppercase tracking-wider inline-block mb-1">
                            Tebus Murah PWP (Promo)
                          </span>
                        )}
                        <h4 className="text-xs font-bold text-stone-900 dark:text-zinc-100">
                          {it.product.name}
                        </h4>
                        <span className="text-[10px] text-stone-400 font-mono block">
                          SKU: {it.product.sku} · Base: {it.product.baseUnit}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveCartItem(it.id)}
                        className="text-stone-400 hover:text-rose-500 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-stone-200/60 dark:border-zinc-700/60">
                      {/* Quantity Modifier */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-stone-500 font-semibold uppercase">
                          {it.selectedUoM}:
                        </span>
                        {it.isPwpRedemption ? (
                          <span className="font-mono font-bold px-2 py-0.5 rounded bg-white dark:bg-zinc-900 border text-xs">
                            1 Unit (Max Capped)
                          </span>
                        ) : (
                          <div className="flex items-center border border-stone-300 dark:border-zinc-600 rounded-lg overflow-hidden bg-white dark:bg-zinc-900">
                            <button
                              type="button"
                              onClick={() => handleUpdateCartQuantity(it.id, it.quantity - 0.5)}
                              className="px-2 py-1 text-stone-600 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-zinc-800"
                            >
                              -
                            </button>
                            <span className="w-10 text-center font-bold font-mono text-xs">
                              {it.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateCartQuantity(it.id, it.quantity + 0.5)}
                              className="px-2 py-1 text-stone-600 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-zinc-800"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Line Total */}
                      <div className="text-right">
                        <span className="text-[10px] text-stone-400 font-mono block">
                          ={it.baseUnitsCalculated} base
                        </span>
                        <span className="font-mono font-bold text-stone-900 dark:text-zinc-100">
                          {formatIDR(it.lineTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Drawer Footer & Checkout Action */}
            <div className="p-5 border-t border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-900 space-y-3">
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-stone-600 dark:text-zinc-400">
                  <span>Subtotal Grosir:</span>
                  <span className="font-mono font-bold">{formatIDR(cartSubtotal)}</span>
                </div>
                <div className="flex justify-between text-stone-600 dark:text-zinc-400">
                  <span>PPN 11% (Faktur Pajak):</span>
                  <span className="font-mono font-bold">{formatIDR(cartTaxPPN11)}</span>
                </div>
                <div className="flex justify-between text-sm font-black pt-2 border-t border-stone-200 dark:border-zinc-800 text-stone-900 dark:text-zinc-100">
                  <span>Total Tagihan:</span>
                  <span className="font-mono text-emerald-800 dark:text-emerald-300">
                    {formatIDR(cartTotalDue)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                disabled={cartItems.length === 0}
                onClick={() => {
                  setIsCartDrawerOpen(false);
                  setIsCheckoutModalOpen(true);
                }}
                className="w-full py-3 rounded-xl bg-emerald-800 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Lanjut ke Pembayaran B2B</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* B2B Checkout & Payment Modal (Gap #2: Terms, Giro PDC, Transfer Proof) */}
      {isCheckoutModalOpen && currentCustomer && (
        createPortal(
          <div
            className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
            onClick={() => setIsCheckoutModalOpen(false)}
          >
            <div
              className="w-full max-w-xl rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-stone-900 dark:text-zinc-100 p-6 shadow-2xl space-y-5 my-auto relative max-h-[calc(100vh-2rem)] overflow-y-auto animate-in zoom-in-95"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <CreditCard className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                  <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100">
                    B2B Wholesale Checkout &amp; Settlement
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCheckoutModalOpen(false)}
                  className="p-1 rounded-lg text-stone-400 hover:bg-stone-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Order Due Summary Banner */}
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/50 flex items-center justify-between">
                <div>
                  <span className="text-xs text-stone-500 dark:text-zinc-400 block">Total Faktur Due:</span>
                  <span className="text-2xl font-black font-mono text-emerald-800 dark:text-emerald-300">
                    {formatIDR(cartTotalDue)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold text-stone-700 dark:text-zinc-300 block">
                    {currentCustomer.companyName}
                  </span>
                  <span className="text-[11px] text-stone-400 font-mono">
                    Avail Credit: {formatIDR(currentCustomer.availableCredit)}
                  </span>
                </div>
              </div>

              {/* Payment Methods Selector (Gap #2: Terms, Giro PDC, Transfer Proof) */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-stone-800 dark:text-zinc-200 block">
                  Pilih Metode Pembayaran Grosir:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Option 1: Net Terms */}
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod('term_net14')}
                    disabled={cannotUseTerm}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedPaymentMethod.startsWith('term_')
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 shadow-xs'
                        : 'border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-800/40 hover:border-stone-300'
                    } ${cannotUseTerm ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-stone-900 dark:text-zinc-100">
                        Termin Dagang
                      </span>
                      {selectedPaymentMethod.startsWith('term_') && (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      )}
                    </div>
                    <span className="text-[11px] text-stone-500 dark:text-zinc-400 block mt-1">
                      Net-7, Net-14, Net-30 (Potong Limit)
                    </span>
                  </button>

                  {/* Option 2: Bilyet Giro (PDC) */}
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod('bilyet_giro')}
                    disabled={cannotUseTerm}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedPaymentMethod === 'bilyet_giro'
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 shadow-xs'
                        : 'border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-800/40 hover:border-stone-300'
                    } ${cannotUseTerm ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-stone-900 dark:text-zinc-100">
                        Bilyet Giro (PDC)
                      </span>
                      {selectedPaymentMethod === 'bilyet_giro' && (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      )}
                    </div>
                    <span className="text-[11px] text-stone-500 dark:text-zinc-400 block mt-1">
                      Post-Dated Check (Jatuh Tempo Kliring)
                    </span>
                  </button>

                  {/* Option 3: Manual Transfer Verification */}
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod('transfer_verification')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedPaymentMethod === 'transfer_verification'
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 shadow-xs'
                        : 'border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-800/40 hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-stone-900 dark:text-zinc-100">
                        Transfer Bank
                      </span>
                      {selectedPaymentMethod === 'transfer_verification' && (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      )}
                    </div>
                    <span className="text-[11px] text-stone-500 dark:text-zinc-400 block mt-1">
                      Upload Bukti Transfer (Finance Verification)
                    </span>
                  </button>
                </div>
              </div>

              {/* Sub-Panel: Net Terms configuration */}
              {selectedPaymentMethod.startsWith('term_') && (
                <div className="p-4 rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-800 dark:text-zinc-200">
                      Pilihan Jangka Waktu Termin:
                    </span>
                    <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      Sisa Limit: {formatIDR(currentCustomer.availableCredit - cartTotalDue)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {(['term_net7', 'term_net14', 'term_net30'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSelectedPaymentMethod(t)}
                        className={`flex-1 py-2 rounded-lg border text-xs font-bold capitalize transition-all cursor-pointer ${
                          selectedPaymentMethod === t
                            ? 'bg-emerald-700 text-white border-emerald-700'
                            : 'bg-white dark:bg-zinc-900 border-stone-300 dark:border-zinc-700 text-stone-700 dark:text-zinc-300'
                        }`}
                      >
                        {t.replace('term_', '').toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Sub-Panel: Bilyet Giro / PDC Form (Gap #2) */}
              {selectedPaymentMethod === 'bilyet_giro' && (
                <div className="p-4 rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800/50 space-y-3">
                  <div className="text-xs font-bold text-stone-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-emerald-600" />
                    <span>Data Warkat Bilyet Giro (PDC):</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-stone-600 dark:text-zinc-300 block mb-1">
                        Nomor Seri Bilyet Giro *
                      </label>
                      <input
                        type="text"
                        value={giroNumber}
                        onChange={(e) => setGiroNumber(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-stone-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                        placeholder="BG-BCA-8891024"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-stone-600 dark:text-zinc-300 block mb-1">
                        Bank Penerbit Giro *
                      </label>
                      <select
                        value={giroBank}
                        onChange={(e) => setGiroBank(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-stone-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                      >
                        <option>Bank Central Asia (BCA)</option>
                        <option>Bank Mandiri (Persero) Tbk</option>
                        <option>Bank Rakyat Indonesia (BRI)</option>
                        <option>Bank Negara Indonesia (BNI)</option>
                        <option>Bank CIMB Niaga</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-stone-600 dark:text-zinc-300 block mb-1">
                        Tanggal Jatuh Tempo Kliring *
                      </label>
                      <input
                        type="date"
                        value={giroDueDate}
                        onChange={(e) => setGiroDueDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-stone-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-stone-600 dark:text-zinc-300 block mb-1">
                        Foto Slip Bilyet Giro
                      </label>
                      <div className="flex items-center gap-2">
                        <img
                          src={giroSlipPhoto}
                          alt="Slip Giro"
                          className="w-9 h-9 rounded-lg object-cover border"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            onShowToast('Simulated Photo', 'Foto slip warkat giro telah dilampirkan.')
                          }
                          className="px-2.5 py-1.5 rounded-lg border text-[11px] font-medium bg-white dark:bg-zinc-900 hover:bg-stone-100"
                        >
                          Change Slip Photo
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-Panel: Manual Bank Transfer Verification (Gap #2) */}
              {selectedPaymentMethod === 'transfer_verification' && (
                <div className="p-4 rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800/50 space-y-3">
                  <div className="text-xs font-bold text-stone-800 dark:text-zinc-200">
                    Rekening Virtual Account Escrow B2B:
                  </div>
                  <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border text-xs font-mono space-y-1">
                    <div className="text-stone-500">Bank Central Asia (BCA) Wholesale Escrow</div>
                    <div className="text-sm font-black text-emerald-800 dark:text-emerald-400">
                      8201-9988-7711
                    </div>
                    <div className="text-[11px] text-stone-600 dark:text-zinc-300">
                      a.n. PT BUMI RETAIL SEJAHTERA
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-stone-600 dark:text-zinc-300 block mb-1">
                      Unggah Bukti Transfer Bank (Struk / Tangkapan Layar):
                    </label>
                    <div className="flex items-center gap-3">
                      <img
                        src={transferProofPhoto}
                        alt="Bukti Transfer"
                        className="w-12 h-12 rounded-lg object-cover border"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          onShowToast('Transfer Proof Uploaded', 'Bukti transfer BCA telah diverifikasi.')
                        }
                        className="px-3 py-2 rounded-xl border text-xs font-bold bg-white dark:bg-zinc-900 hover:bg-stone-100 cursor-pointer flex items-center gap-1.5"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Bukti Bayar</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Accounting & Auto-GL Notice */}
              <div className="p-3 rounded-xl bg-stone-100 dark:bg-zinc-800/60 text-[10px] text-stone-500 dark:text-zinc-400 flex items-center gap-2 font-mono">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Auto-GL Posting: Debit AR #1200 / Giro #1210 · Credit B2B Revenue #4020 · Debit COGS #5010 · Credit Inventory #1040 (FEFO allocation)
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCheckoutModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-stone-200 dark:border-zinc-700 text-xs font-semibold hover:bg-stone-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  Kembali
                </button>
                <button
                  type="button"
                  disabled={isSubmittingOrder}
                  onClick={handleExecuteCheckout}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isSubmittingOrder ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Memproses FEFO &amp; Ledger...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Konfirmasi Order Grosir</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      )}

      {/* Success Receipt Modal */}
      {activeReceiptOrder && (
        createPortal(
          <div
            className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
            onClick={() => setActiveReceiptOrder(null)}
          >
            <div
              className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 p-6 shadow-2xl space-y-4 my-auto relative max-h-[calc(100vh-2rem)] overflow-y-auto animate-in zoom-in-95 text-stone-900 dark:text-zinc-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center space-y-1 pb-3 border-b border-stone-200 dark:border-zinc-800">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-base mt-2">Faktur Pesanan Grosir Diterbitkan</h3>
                <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400">
                  {activeReceiptOrder.id}
                </span>
              </div>

              <div className="text-xs space-y-1 font-mono">
                <div className="flex justify-between">
                  <span>Pelanggan:</span>
                  <span className="font-bold">{activeReceiptOrder.companyName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Metode:</span>
                  <span className="font-bold uppercase">{activeReceiptOrder.paymentMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Base Units:</span>
                  <span className="font-bold">{activeReceiptOrder.totalBaseUnits} units</span>
                </div>
                <div className="flex justify-between text-sm font-black pt-2 border-t border-stone-200 dark:border-zinc-800">
                  <span>Total Faktur:</span>
                  <span className="text-emerald-800 dark:text-emerald-300">
                    {formatIDR(activeReceiptOrder.totalAmountIDR)}
                  </span>
                </div>
              </div>

              {activeReceiptOrder.approvalRequestId && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Dalam Antrian Persetujuan Direksi (Approval Matrix)</span>
                  </div>
                  <p>
                    Nomor Approval: {activeReceiptOrder.approvalRequestId}. Dokumen Surat Jalan akan otomatis diterbitkan setelah Finance Director menyetujui.
                  </p>
                </div>
              )}

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    triggerPrint({
                      type: 'b2b_invoice',
                      format: 'a4',
                      order: activeReceiptOrder,
                    })
                  }
                  className="flex-1 py-2.5 rounded-xl border border-stone-300 dark:border-zinc-700 text-xs font-bold hover:bg-stone-100 dark:hover:bg-zinc-800 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak Faktur</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveReceiptOrder(null)}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-800 text-white text-xs font-bold hover:bg-emerald-700 cursor-pointer"
                >
                  Selesai
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      )}
    </div>
  );
};
