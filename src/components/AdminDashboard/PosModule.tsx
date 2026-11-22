/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type {
  POSProductItem,
  POSCartItem,
  POSTransactionRequest,
  POSTransactionReceipt,
  POSPaymentMethod,
  StaffShiftSession,
  StoreOutletSchedule,
  SupportedCurrency,
  PosRegisterShiftSession,
  SkuTaxRule,
  CrmAccountType,
  CrmLoyaltyTier,
  PosValidatePromoResponse,
  POSSplitPaymentLeg,
} from '../../types/index.ts';
import { apiClient } from '../../services/apiClient';
import { formatIDR } from '../../utils/formatters';
import { normalizeEnterpriseRole } from '../../utils/rbac';
import {
  computeIndonesianTax,
  inferDefaultTaxCategory,
  resolveWholesaleTierPrice,
} from '../../utils/indonesianCompliance';
import { QRCodeSVG } from 'qrcode.react';
import {
  parseVariableWeightBarcode,
  SAMPLE_SCALE_BARCODES,
} from '../../utils/groceryEngine.ts';
import { BarcodeShelfLabelModal } from './BarcodeShelfLabelModal';
import { PosRmaQuickModal, PosSafeDropModal, PosShiftModal } from './PosShiftAndReturnModals';
import { usePrint } from '../../context/PrintContext';
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
  Mail,
  MessageCircle,
  Lock,
  Award,
  Ticket,
  Wifi,
  WifiOff,
  RefreshCw,
  Gift,
  Calendar,
} from 'lucide-react';
import { DocumentDispatchModal } from './DocumentDispatchModal';

const POS_SHIFT_OPTIONS = [
  'Morning Shift (06:00 - 14:00)',
  'Afternoon Shift (14:00 - 22:00)',
  'Night Shift (22:00 - 06:00)',
] as const;

function getDefaultWibShiftName(now: Date = new Date()): (typeof POS_SHIFT_OPTIONS)[number] {
  const hourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    hour12: false,
  }).format(now);
  const wibHour = Number(hourStr) % 24;
  if (wibHour >= 6 && wibHour < 14) return 'Morning Shift (06:00 - 14:00)';
  if (wibHour >= 14 && wibHour < 22) return 'Afternoon Shift (14:00 - 22:00)';
  return 'Night Shift (22:00 - 06:00)';
}

const OFFLINE_POS_QUEUE_KEY = 'grocematrix_offline_pos_queue';
const POS_ACTIVE_CART_STORAGE_KEY = 'grocematrix_active_pos_cart';

interface OfflineQueuedPosTx {
  id: string;
  offlineReceiptNumber: string;
  queuedAt: string;
  payload: POSTransactionRequest;
  localReceipt: POSTransactionReceipt;
}

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
  const { triggerPrint } = usePrint();
  const canOverrideDiscount =
    activeStaffSession?.permissions?.canOverridePosPrice ??
    ['store_manager', 'coo', 'super_admin'].includes(normalizeEnterpriseRole(activeStaffSession?.userRole));
  const [dispatchReceipt, setDispatchReceipt] = useState<{
    receipt: POSTransactionReceipt;
    channel: 'email' | 'whatsapp';
  } | null>(null);

  // 1. Catalog & Filter State
  const [products, setProducts] = useState<POSProductItem[]>([]);
  const [skuTaxRules, setSkuTaxRules] = useState<SkuTaxRule[]>([]);
  const [posPpnTaxPercent, setPosPpnTaxPercent] = useState<number>(11);
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

  // 3. Register Cart State (auto-draft persisted in sessionStorage for accidental F5 recovery)
  const [cart, setCart] = useState<POSCartItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.sessionStorage.getItem(POS_ACTIVE_CART_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.filter((item) => item && typeof item.sku === 'string' && Number(item.quantity) > 0)
        : [];
    } catch {
      return [];
    }
  });
  const [discountPercent, setDiscountPercent] = useState<number>(0);

  // Persist active cart draft to sessionStorage & warn before tab close/refresh when unpaid items exist
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (cart.length > 0) {
        window.sessionStorage.setItem(POS_ACTIVE_CART_STORAGE_KEY, JSON.stringify(cart));
      } else {
        window.sessionStorage.removeItem(POS_ACTIVE_CART_STORAGE_KEY);
      }
    } catch {
      // Ignore storage quota errors
    }
  }, [cart]);

  useEffect(() => {
    if (typeof window === 'undefined' || cart.length === 0) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [cart.length]);

  useEffect(() => {
    if (!canOverrideDiscount && discountPercent !== 0) {
      setDiscountPercent(0);
    }
  }, [canOverrideDiscount, discountPercent]);

  // 3B. Offline-First Resilience Queue (Anti-Putus Internet)
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueuedPosTx[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(OFFLINE_POS_QUEUE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [isSyncingOfflineQueue, setIsSyncingOfflineQueue] = useState<boolean>(false);

  const persistOfflineQueue = useCallback((next: OfflineQueuedPosTx[]) => {
    setOfflineQueue(next);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(OFFLINE_POS_QUEUE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage quota errors
      }
    }
  }, []);
  const [customerName, setCustomerName] = useState<string>('Walk-in Retail Shopper');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerMemberId, setCustomerMemberId] = useState<string>('');
  const [selectedCrmMember, setSelectedCrmMember] = useState<{
    id: string;
    accountType: CrmAccountType;
    name: string;
    companyName?: string;
    phone: string;
    email: string;
    tier: CrmLoyaltyTier;
    pointsBalance: number;
    contractDiscountPct: number;
  } | null>(null);
  const [isMemberLookupOpen, setIsMemberLookupOpen] = useState<boolean>(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState<string>('');
  const [memberResults, setMemberResults] = useState<
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
  >([]);
  const [redeemPointsInput, setRedeemPointsInput] = useState<number>(0);

  // Promotional & CRM Voucher Engine State
  const [promoInput, setPromoInput] = useState<string>('');
  const [appliedPromoCode, setAppliedPromoCode] = useState<string>('');
  const [promoValidation, setPromoValidation] = useState<PosValidatePromoResponse | null>(null);
  const [isValidatingPromo, setIsValidatingPromo] = useState<boolean>(false);
  const [promoStatusError, setPromoStatusError] = useState<string>('');

  // 4. Barcode Quick Scanner State
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const lastCartQtyInputRef = useRef<HTMLInputElement>(null);

  // 5. Digital Weight Scale Modal
  const [scalingProduct, setScalingProduct] = useState<POSProductItem | null>(null);
  const [scaleGrossGrams, setScaleGrossGrams] = useState<number>(500);
  const [scaleTareGrams, setScaleTareGrams] = useState<number>(15);

  // 6. Payment Tender Modal
  const [isTenderModalOpen, setIsTenderModalOpen] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<POSPaymentMethod>('cash');
  const [cashTendered, setCashTendered] = useState<number>(0);
  const [isSplitMode, setIsSplitMode] = useState<boolean>(false);
  const [splitLeg1Method, setSplitLeg1Method] = useState<'CASH' | 'QRIS' | 'CARD'>('CASH');
  const [splitLeg2Method, setSplitLeg2Method] = useState<'CASH' | 'QRIS' | 'CARD'>('QRIS');
  const [splitLeg1Amount, setSplitLeg1Amount] = useState<number>(0);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState<boolean>(false);
  const checkoutSubmitLockRef = useRef<boolean>(false);
  const activeCartIdempotencyKeyRef = useRef<string | null>(null);

  // 7. Electronic Receipt Modal (Struk)
  const [completedReceipt, setCompletedReceipt] = useState<POSTransactionReceipt | null>(null);
  const [waReceiptPhone, setWaReceiptPhone] = useState<string>('');
  const [isSendingWaReceipt, setIsSendingWaReceipt] = useState<boolean>(false);
  const [waReceiptFeedback, setWaReceiptFeedback] = useState<{ message: string; waMeUrl?: string } | null>(null);

  // 8. Parked Tickets (Hold / Resume)
  const [parkedTickets, setParkedTickets] = useState<{ id: string; timestamp: string; cart: POSCartItem[]; customer: string }[]>([]);

  // 9. Recent Transactions History Drawer
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState<boolean>(false);
  const [historyReceipts, setHistoryReceipts] = useState<POSTransactionReceipt[]>([]);

  // 10. Indonesian Compliance: Cashier Shift & Z-Report, Quick RMA, & Scale Barcode Labels
  const [activeShift, setActiveShift] = useState<PosRegisterShiftSession | null>(null);
  const [shiftHistory, setShiftHistory] = useState<PosRegisterShiftSession[]>([]);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState<boolean>(false);
  const isRegisterOpen = Boolean(activeShift && activeShift.status === 'OPEN');
  const [openGateClock, setOpenGateClock] = useState<Date>(() => new Date());
  const [openGateShiftName, setOpenGateShiftName] = useState<string>(() => getDefaultWibShiftName());
  const [openGateRegisterId, setOpenGateRegisterId] = useState<string>('REG-04');
  const [openGatePettyCashInput, setOpenGatePettyCashInput] = useState<string>('500000');
  const [openGateError, setOpenGateError] = useState<string>('');
  const [isOpeningRegister, setIsOpeningRegister] = useState<boolean>(false);
  const [isSafeDropModalOpen, setIsSafeDropModalOpen] = useState<boolean>(false);
  const [rmaTargetReceipt, setRmaTargetReceipt] = useState<POSTransactionReceipt | null>(null);
  const [isBarcodeLabelModalOpen, setIsBarcodeLabelModalOpen] = useState<boolean>(false);

  useEffect(() => {
    if (isRegisterOpen) return;
    const now = new Date();
    setOpenGateClock(now);
    setOpenGateShiftName(getDefaultWibShiftName(now));
    const timer = window.setInterval(() => {
      setOpenGateClock(new Date());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isRegisterOpen]);
  const [safeDropThresholdIDR, setSafeDropThresholdIDR] = useState<number>(5000000);
  const [loyaltyPointRedeemValueIDR, setLoyaltyPointRedeemValueIDR] = useState<number>(100);
  const [minMarginFloorPct, setMinMarginFloorPct] = useState<number>(2.0);
  const [marginOverridePrompt, setMarginOverridePrompt] = useState<{
    payload: POSTransactionRequest;
    message: string;
    violations: Array<{
      sku: string;
      name: string;
      unitCost: number;
      netEffectiveUnitPrice: number;
      minAllowedUnitPrice: number;
    }>;
  } | null>(null);
  const [supervisorPinInput, setSupervisorPinInput] = useState<string>('');
  const [supervisorNameInput, setSupervisorNameInput] = useState<string>('Store Manager (On-Duty)');
  const [supervisorPinError, setSupervisorPinError] = useState<string>('');
  const [isAuthorizingOverride, setIsAuthorizingOverride] = useState<boolean>(false);

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

  // Load Products for current retail store (normalize consolidated / warehouse hub views to Senopati Flagship)
  const selectedOutletObj = storeOutlets.find((s) => s.storeId === selectedStore);
  const effectiveStoreId =
    !selectedStore ||
    selectedStore === 'CONSOLIDATED' ||
    selectedStore === 'ALL' ||
    selectedStore === 'WH-CDC-01' ||
    selectedOutletObj?.outletType === 'CENTRAL_HUB'
      ? 'store-jkt-senopati'
      : selectedStore;
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

  const loadShiftState = async () => {
    try {
      const [activeRes, hist] = await Promise.all([
        apiClient.getActivePosShift(effectiveStoreId),
        apiClient.getPosShiftHistory(effectiveStoreId),
      ]);
      setActiveShift(activeRes.activeShift);
      setShiftHistory(hist);
    } catch {}
  };

  useEffect(() => {
    loadProducts();
    loadHistory();
    loadShiftState();
    apiClient.getSkuTaxRules().then(setSkuTaxRules).catch(() => {});
    apiClient
      .getPosConfig()
      .then((cfg) => {
        if (cfg && typeof cfg.ppnTaxPercent === 'number') {
          setPosPpnTaxPercent(cfg.ppnTaxPercent);
        }
      })
      .catch(() => {});
    apiClient
      .getErpSettingsConfig()
      .then((res) => {
        const cfg = res?.config || res?.erpSettings;
        if (cfg) {
          if (typeof cfg.safeDropThresholdIDR === 'number' && cfg.safeDropThresholdIDR > 0) {
            setSafeDropThresholdIDR(cfg.safeDropThresholdIDR);
          }
          if (typeof cfg.loyaltyPointRedeemValueIDR === 'number' && cfg.loyaltyPointRedeemValueIDR > 0) {
            setLoyaltyPointRedeemValueIDR(cfg.loyaltyPointRedeemValueIDR);
          }
          if (typeof cfg.activeVatRatePct === 'number' && cfg.activeVatRatePct >= 0) {
            setPosPpnTaxPercent(cfg.activeVatRatePct);
          }
          if (typeof cfg.minMarginFloorPct === 'number' && cfg.minMarginFloorPct >= 0) {
            setMinMarginFloorPct(cfg.minMarginFloorPct);
          }
        }
      })
      .catch(() => {});
  }, [effectiveStoreId]);

  useEffect(() => {
    if (!isMemberLookupOpen) return;
    let active = true;
    apiClient
      .searchPosCrmMembers(memberSearchQuery)
      .then((list) => {
        if (active) setMemberResults(list);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isMemberLookupOpen, memberSearchQuery]);

  useEffect(() => {
    if (cart.length === 0) {
      setPromoValidation(null);
      setPromoStatusError('');
      return;
    }
    let active = true;
    setIsValidatingPromo(true);
    apiClient
      .validatePosPromo({
        cartItems: cart.map((c) => ({
          sku: c.sku,
          name: c.name,
          category: c.category,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
          lineTotal: c.lineTotal,
        })),
        promoCode: appliedPromoCode || undefined,
        memberId: selectedCrmMember?.id,
        memberTier: selectedCrmMember?.tier,
      })
      .then((res) => {
        if (!active) return;
        setPromoValidation(res);
        if (appliedPromoCode && !res.valid) {
          setPromoStatusError(res.message || `Voucher "${appliedPromoCode}" is not eligible.`);
        } else {
          setPromoStatusError('');
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setIsValidatingPromo(false);
      });
    return () => {
      active = false;
    };
  }, [cart, appliedPromoCode, selectedCrmMember]);

  const handleApplyPromoCode = async () => {
    const clean = promoInput.trim().toUpperCase();
    if (!clean) {
      setAppliedPromoCode('');
      setPromoStatusError('');
      return;
    }
    if (cart.length === 0) {
      setPromoStatusError('Add items to the register ticket before applying a voucher.');
      return;
    }
    setIsValidatingPromo(true);
    setPromoStatusError('');
    try {
      const res = await apiClient.validatePosPromo({
        cartItems: cart.map((c) => ({
          sku: c.sku,
          name: c.name,
          category: c.category,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
          lineTotal: c.lineTotal,
        })),
        promoCode: clean,
        memberId: selectedCrmMember?.id,
        memberTier: selectedCrmMember?.tier,
      });
      if (!res.valid) {
        setPromoStatusError(res.message || `Voucher "${clean}" is invalid.`);
        onShowToast('Voucher Rejected', res.message || `Code "${clean}" cannot be applied.`);
      } else {
        setAppliedPromoCode(clean);
        setPromoValidation(res);
        setPromoStatusError('');
        onShowToast('Promo / Voucher Applied', res.message || `Code ${clean} applied pre-PPN.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setPromoStatusError(msg);
      onShowToast('Voucher Validation Error', msg);
    } finally {
      setIsValidatingPromo(false);
    }
  };

  // Calculations (matching backend computeIndonesianTax per SKU)
  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.lineTotal, 0);
  }, [cart]);

  const baseDiscountAmount = useMemo(() => {
    return Math.round((subtotal * discountPercent) / 100);
  }, [subtotal, discountPercent]);

  const promoDiscountIDR = useMemo(() => {
    const raw = promoValidation?.totalPromoDiscountIDR || 0;
    return Math.min(Math.max(0, subtotal - baseDiscountAmount), Math.max(0, Math.round(raw)));
  }, [promoValidation, subtotal, baseDiscountAmount]);

  const maxRedeemablePoints = useMemo(() => {
    if (!selectedCrmMember || selectedCrmMember.pointsBalance <= 0) return 0;
    const perPtValue = Math.max(1, loyaltyPointRedeemValueIDR || 100);
    const maxByBill = Math.floor(Math.max(0, subtotal - baseDiscountAmount - promoDiscountIDR) / perPtValue);
    return Math.min(selectedCrmMember.pointsBalance, maxByBill);
  }, [selectedCrmMember, subtotal, baseDiscountAmount, promoDiscountIDR, loyaltyPointRedeemValueIDR]);

  const effectiveRedeemPoints = useMemo(() => {
    if (!selectedCrmMember) return 0;
    return Math.min(maxRedeemablePoints, Math.max(0, Math.floor(redeemPointsInput || 0)));
  }, [selectedCrmMember, maxRedeemablePoints, redeemPointsInput]);

  const pointsDiscountIDR = effectiveRedeemPoints * Math.max(1, loyaltyPointRedeemValueIDR || 100);

  const discountAmount = useMemo(() => {
    return Math.min(subtotal, baseDiscountAmount + promoDiscountIDR + pointsDiscountIDR);
  }, [subtotal, baseDiscountAmount, promoDiscountIDR, pointsDiscountIDR]);

  const { taxAmount, totalAmount } = useMemo(() => {
    const netRevenue = Math.max(0, subtotal - discountAmount);
    let remainingDiscount = discountAmount;
    let totalTax = 0;

    cart.forEach((item, idx) => {
      const share =
        idx === cart.length - 1
          ? remainingDiscount
          : subtotal > 0
          ? Math.min(remainingDiscount, Math.round((item.lineTotal / subtotal) * discountAmount))
          : 0;
      remainingDiscount = Math.max(0, remainingDiscount - share);
      const netLine = Math.max(0, item.lineTotal - share);
      const rule = skuTaxRules.find((r) => r.sku === item.sku);
      const taxCat = rule?.taxCategory || inferDefaultTaxCategory(item.category || '', item.name || '');
      const stdRate = rule?.taxRatePercent ?? posPpnTaxPercent ?? 11;
      const calc = computeIndonesianTax(netLine, taxCat, false, stdRate);
      totalTax += Math.round(calc.ppnIDR + calc.pb1IDR);
    });

    const resolvedTax = Math.round(totalTax);
    return {
      taxAmount: resolvedTax,
      totalAmount: netRevenue + resolvedTax,
    };
  }, [cart, subtotal, discountAmount, skuTaxRules, posPpnTaxPercent]);

  const totalInActiveCurrency = useMemo(() => {
    if (activeCurrency === 'IDR') return totalAmount;
    return Number((totalAmount / currentFx.rateToIDR).toFixed(2));
  }, [totalAmount, currentFx, activeCurrency]);

  const cashChange = Math.max(0, cashTendered - totalAmount);

  // Cart operations (with live availableStock cap & mandatory Open Register lock)
  const addToCart = (
    product: POSProductItem,
    quantity = 1,
    isWeighted = false,
    weightGrams?: number,
    grossGrams?: number
  ) => {
    if (!isRegisterOpen) {
      onShowToast(
        'Register Locked',
        'Complete Open Register & Petty Cash declaration before adding items.'
      );
      return;
    }
    const requestedAdd = isWeighted && weightGrams ? Number((weightGrams / 1000).toFixed(3)) : quantity;
    const currentInCart = cart
      .filter((c) => c.sku === product.sku)
      .reduce((sum, c) => sum + c.quantity, 0);
    if (product.availableStock >= 0 && currentInCart + requestedAdd > product.availableStock) {
      onShowToast(
        'Insufficient Outlet Stock',
        `Only ${product.availableStock} ${product.unit} available for ${product.name} at ${currentStoreInfo.storeName}.`
      );
      return;
    }

    playBeep();
    setCart((prev) => {
      const existingIdx = prev.findIndex((item) => item.sku === product.sku && !item.isWeighted);

      if (!isWeighted && existingIdx >= 0) {
        const next = [...prev];
        const newQty = next[existingIdx].quantity + quantity;
        const tierResolved = resolveWholesaleTierPrice(
          product.wholesaleTiers,
          newQty,
          product.sellingPrice
        );
        next[existingIdx] = {
          ...next[existingIdx],
          quantity: newQty,
          unitPrice: tierResolved.unitPriceIDR,
          lineTotal: Math.round(newQty * tierResolved.unitPriceIDR),
          appliedWholesaleTierLabel: tierResolved.appliedTier?.label,
        };
        return next;
      }

      // Add as new line
      const effectiveQty = requestedAdd;
      const fallbackPricePerKg = product.unit.includes('kg') ? product.sellingPrice : product.sellingPrice * 4;
      const tierResolved = !isWeighted
        ? resolveWholesaleTierPrice(product.wholesaleTiers, effectiveQty, product.sellingPrice)
        : { unitPriceIDR: product.pricePerKg || fallbackPricePerKg, appliedTier: undefined };
      const unitPrice = isWeighted ? product.pricePerKg || fallbackPricePerKg : tierResolved.unitPriceIDR;
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
        grossWeightGrams: isWeighted ? (grossGrams ?? (weightGrams ? weightGrams + scaleTareGrams : undefined)) : undefined,
        tareWeightGrams: isWeighted ? scaleTareGrams : undefined,
        netWeightGrams: isWeighted ? weightGrams : undefined,
        batchId: product.nearestBatchId,
        lotNumber: product.lotNumber,
        expiryDate: product.expiryDate,
        daysUntilExpiry: product.daysUntilExpiry,
        lineTotal,
        image: product.image,
        appliedWholesaleTierLabel: tierResolved.appliedTier?.label,
        isDynamicDiscountSku: product.isDynamicDiscountSku,
        sourceBatchId: product.sourceBatchId,
        originalSku: product.originalSku,
        originalSellingPrice: product.originalSellingPrice,
        discountPercent: product.discountPercent,
        markdownStatus: product.markdownStatus,
      };

      return [newLine, ...prev];
    });
  };

  const updateQuantity = (lineId: string, delta: number) => {
    if (delta > 0) {
      const targetLine = cart.find((c) => c.id === lineId);
      const prod = targetLine ? products.find((p) => p.sku === targetLine.sku) : undefined;
      if (targetLine && prod) {
        const step = targetLine.isWeighted ? delta * 0.25 : delta;
        const totalForSku = cart.filter((c) => c.sku === targetLine.sku).reduce((s, c) => s + c.quantity, 0);
        if (totalForSku + step > prod.availableStock) {
          onShowToast('Stock Cap Reached', `Maximum available at outlet: ${prod.availableStock} ${prod.unit}`);
          return;
        }
      }
    }
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id !== lineId) return item;
          const newQty = item.isWeighted
            ? Number(Math.max(0.1, item.quantity + delta * 0.25).toFixed(3))
            : Math.max(1, item.quantity + delta);
          if (!item.isWeighted) {
            const prod = products.find((p) => p.sku === item.sku);
            if (prod) {
              const tierResolved = resolveWholesaleTierPrice(
                prod.wholesaleTiers,
                newQty,
                prod.sellingPrice
              );
              return {
                ...item,
                quantity: newQty,
                unitPrice: tierResolved.unitPriceIDR,
                lineTotal: Math.round(newQty * tierResolved.unitPriceIDR),
                appliedWholesaleTierLabel: tierResolved.appliedTier?.label,
              };
            }
          }
          return {
            ...item,
            quantity: newQty,
            lineTotal: Math.round(newQty * item.unitPrice),
          };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const setCartItemQuantity = (lineId: string, rawQty: number) => {
    const targetLine = cart.find((c) => c.id === lineId);
    if (!targetLine || !Number.isFinite(rawQty)) return;
    const clampedQty = targetLine.isWeighted
      ? Number(Math.max(0.1, rawQty).toFixed(3))
      : Math.max(1, Math.round(rawQty));
    const prod = products.find((p) => p.sku === targetLine.sku);
    if (prod) {
      const otherQtyForSku = cart
        .filter((c) => c.sku === targetLine.sku && c.id !== lineId)
        .reduce((s, c) => s + c.quantity, 0);
      if (otherQtyForSku + clampedQty > prod.availableStock) {
        onShowToast('Stock Cap Reached', `Maximum available at outlet: ${prod.availableStock} ${prod.unit}`);
        return;
      }
    }
    setCart((prev) =>
      prev.map((item) => {
        if (item.id !== lineId) return item;
        if (!item.isWeighted && prod) {
          const tierResolved = resolveWholesaleTierPrice(prod.wholesaleTiers, clampedQty, prod.sellingPrice);
          return {
            ...item,
            quantity: clampedQty,
            unitPrice: tierResolved.unitPriceIDR,
            lineTotal: Math.round(clampedQty * tierResolved.unitPriceIDR),
            appliedWholesaleTierLabel: tierResolved.appliedTier?.label,
          };
        }
        return {
          ...item,
          quantity: clampedQty,
          lineTotal: Math.round(clampedQty * item.unitPrice),
        };
      })
    );
  };

  const removeFromCart = (lineId: string) => {
    const removedLine = cart.find((item) => item.id === lineId);
    setCart((prev) => prev.filter((item) => item.id !== lineId));
    if (removedLine && !removedLine.isPromoGimmick) {
      apiClient
        .logPosTelemetryEvent({
          eventType: 'CART_LINE_VOID',
          storeId: currentStoreInfo.storeId,
          shiftId: activeShift?.id || activeStaffSession?.activeShiftId,
          operatorId: activeStaffSession?.userId,
          operatorName: activeStaffSession?.userName,
          sku: removedLine.sku,
          productName: removedLine.name,
          amountIDR: removedLine.lineTotal,
          quantity: removedLine.quantity,
          reason: 'Cashier voided cart line item',
        })
        .catch(() => {});
    }
  };

  const clearCart = () => {
    setCart([]);
    activeCartIdempotencyKeyRef.current = null;
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(POS_ACTIVE_CART_STORAGE_KEY);
      } catch {
        // Ignore storage errors
      }
    }
    setDiscountPercent(0);
    setCustomerName('Walk-in Retail Shopper');
    setCustomerPhone('');
    setCustomerMemberId('');
    setSelectedCrmMember(null);
    setRedeemPointsInput(0);
    setIsMemberLookupOpen(false);
    setMemberSearchQuery('');
    setPromoInput('');
    setAppliedPromoCode('');
    setPromoValidation(null);
    setPromoStatusError('');
  };

  // Barcode search and instant add (including Variable-Weight embedded scale barcodes)
  const handleBarcodeSubmit = (e?: React.FormEvent, directBarcodeInput?: string) => {
    if (e) e.preventDefault();
    if (!isRegisterOpen) {
      onShowToast(
        'Register Locked',
        'Complete Open Register & Petty Cash declaration before scanning items.'
      );
      return;
    }
    const rawCode = (directBarcodeInput || barcodeInput).trim();
    if (!rawCode) return;

    // 1. Check for Variable-Weight embedded scale barcode (EAN-13 GS1 prefix 20-29 / 02)
    const scaleBarcode = parseVariableWeightBarcode(rawCode, products);
    if (scaleBarcode && scaleBarcode.isVariableWeight) {
      if (scaleBarcode.error || !scaleBarcode.matchedSku || scaleBarcode.netWeightGrams <= 0) {
        onShowToast(
          'Invalid Scale Barcode',
          scaleBarcode.error ||
            `Scale barcode "${rawCode}" has unknown PLU (${scaleBarcode.skuOrPlu}) or invalid weight.`
        );
        setBarcodeInput('');
        return;
      }

      const targetProduct = products.find((p) => p.sku === scaleBarcode.matchedSku);
      if (!targetProduct) {
        onShowToast(
          'Scale PLU Not In Stock',
          `Matched SKU "${scaleBarcode.matchedSku}" is unavailable in this outlet catalog.`
        );
        setBarcodeInput('');
        return;
      }

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

  useEffect(() => {
    if (isSplitMode && totalAmount > 1 && splitLeg1Amount >= totalAmount) {
      setSplitLeg1Amount(Math.floor(totalAmount / 2));
    }
  }, [isSplitMode, totalAmount, splitLeg1Amount]);

  const splitLeg2Amount = Math.max(0, totalAmount - Math.round(splitLeg1Amount || 0));
  const isSplitValid =
    splitLeg1Method !== splitLeg2Method &&
    Math.round(splitLeg1Amount || 0) > 0 &&
    splitLeg2Amount > 0 &&
    Math.round(splitLeg1Amount || 0) + splitLeg2Amount === totalAmount;

  // Checkout execution
  const handleExecuteCheckout = async (overrideCashTendered?: number) => {
    if (cart.length === 0 || isProcessingCheckout || checkoutSubmitLockRef.current) return;
    if (!isRegisterOpen) {
      onShowToast(
        'Register Belum Dibuka',
        'Silakan Open Register & Input Modal Laci Awal Sebelum Melakukan Transaksi.'
      );
      setIsShiftModalOpen(true);
      return;
    }
    const effectiveCashTendered =
      typeof overrideCashTendered === 'number' && Number.isFinite(overrideCashTendered)
        ? overrideCashTendered
        : cashTendered;
    const effectiveCashChange = Math.max(0, effectiveCashTendered - totalAmount);
    if (isSplitMode) {
      if (!isSplitValid) {
        onShowToast('Invalid Split Tender', 'Split payment requires two distinct methods summing exactly to Total Due.');
        return;
      }
    } else if (paymentMethod === 'cash' && effectiveCashTendered < totalAmount) {
      onShowToast('Insufficient Cash', 'Amount tendered must cover total bill.');
      return;
    }

    checkoutSubmitLockRef.current = true;
    setIsProcessingCheckout(true);

    const splitPayments: POSSplitPaymentLeg[] | undefined = isSplitMode
      ? [
          { method: splitLeg1Method, amountIDR: Math.round(splitLeg1Amount) },
          { method: splitLeg2Method, amountIDR: splitLeg2Amount },
        ]
      : undefined;

    const cashLeg = splitPayments?.find((l) => l.method === 'CASH');
    const resolvedMethod: POSPaymentMethod = isSplitMode
      ? cashLeg
        ? 'cash'
        : splitLeg1Method === 'QRIS'
        ? 'qris'
        : 'debit_card'
      : paymentMethod;

    const clientIdempotencyKey =
      activeCartIdempotencyKeyRef.current ||
      `OFF-KEY-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    activeCartIdempotencyKeyRef.current = clientIdempotencyKey;
    const offlineReceiptNumber = `OFF-2026-${Date.now().toString().slice(-6)}`;

    const payload: POSTransactionRequest = {
      storeId: currentStoreInfo.storeId,
      storeName: currentStoreInfo.storeName,
      cashierId: activeStaffSession?.userId || 'USR-CASH-01',
      cashierName: activeStaffSession?.userName || 'Andi Wijaya (Frontline Cashier)',
      shiftId: activeShift?.id || activeStaffSession?.activeShiftId || 'SHIFT-JKT-SEN-MORNING',
      items: cart,
      subtotal,
      discount: baseDiscountAmount,
      tax: taxAmount,
      total: totalAmount,
      currency: activeCurrency,
      currencyTotal: totalInActiveCurrency,
      currencyRateToIDR: currentFx.rateToIDR,
      paymentMethod: resolvedMethod,
      splitPayments,
      cashTendered: isSplitMode
        ? cashLeg?.amountIDR || totalAmount
        : paymentMethod === 'cash'
        ? effectiveCashTendered
        : totalAmount,
      cashChange: isSplitMode ? 0 : paymentMethod === 'cash' ? effectiveCashChange : 0,
      customerName,
      customerPhone,
      customerMemberId,
      crmAccountId: selectedCrmMember?.id,
      redeemPoints: effectiveRedeemPoints > 0 ? effectiveRedeemPoints : undefined,
      promoCode: appliedPromoCode || undefined,
      appliedPromos: promoValidation?.appliedPromos,
      promoDiscountIDR: promoDiscountIDR > 0 ? promoDiscountIDR : undefined,
      clientIdempotencyKey,
      idempotencyKey: clientIdempotencyKey,
      offlineReceiptNumber,
    };

    const enqueueOfflineFallback = () => {
      const localReceipt: POSTransactionReceipt = {
        receiptNumber: offlineReceiptNumber,
        transactionId: `TXN-OFF-${Date.now().toString().slice(-6)}`,
        orderId: offlineReceiptNumber,
        timestamp: new Date().toISOString(),
        storeId: currentStoreInfo.storeId,
        storeName: currentStoreInfo.storeName,
        cashierId: payload.cashierId,
        cashierName: payload.cashierName,
        shiftId: payload.shiftId,
        items: cart,
        subtotal,
        discount: baseDiscountAmount + promoDiscountIDR + pointsDiscountIDR,
        tax: taxAmount,
        total: totalAmount,
        currency: activeCurrency,
        currencyTotal: totalInActiveCurrency,
        currencyRateToIDR: currentFx.rateToIDR,
        paymentMethod: resolvedMethod,
        splitPayments,
        cashTendered: payload.cashTendered,
        cashChange: payload.cashChange,
        journalEntryIds: ['PENDING-OFFLINE-SYNC'],
        inventoryDeductedCount: cart.reduce((s, it) => s + it.quantity, 0),
        totalCogsCost: 0,
        promoCode: payload.promoCode,
        appliedPromos: promoValidation?.appliedPromos,
        promoDiscountIDR: payload.promoDiscountIDR,
        freeGimmickItems: promoValidation?.freeGimmickItems,
        clientIdempotencyKey,
        offlineReceiptNumber,
        isOfflinePendingSync: true,
      };
      const entry: OfflineQueuedPosTx = {
        id: clientIdempotencyKey,
        offlineReceiptNumber,
        queuedAt: localReceipt.timestamp,
        payload,
        localReceipt,
      };
      persistOfflineQueue([...offlineQueue, entry]);
      setIsOnline(false);
      setCompletedReceipt(localReceipt);
      setIsTenderModalOpen(false);
      clearCart();
      onShowToast(
        'Saved Offline (Anti-Putus Internet)',
        `Koneksi terputus — Struk ${offlineReceiptNumber} disimpan di Offline Queue & siap dicetak 80mm.`
      );
    };

    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        enqueueOfflineFallback();
        return;
      }

      const res = await apiClient.posCheckout(payload);

      if (res.success && res.receipt) {
        setIsOnline(true);
        setCompletedReceipt(res.receipt);
        setIsTenderModalOpen(false);
        clearCart();
        const ptsSummary =
          res.receipt.loyaltyPointsEarned || res.receipt.loyaltyPointsRedeemed
            ? ` (+${res.receipt.loyaltyPointsEarned || 0} pts earned${
                res.receipt.loyaltyPointsRedeemed ? `, -${res.receipt.loyaltyPointsRedeemed} pts redeemed` : ''
              })`
            : '';
        onShowToast('Checkout Complete', `Receipt #${res.receipt.receiptNumber} generated.${ptsSummary}`);
        // Reload products, shift totals, and notify parent dashboard to refresh GL and stock
        loadProducts();
        loadHistory();
        loadShiftState();
        if (onInventoryUpdated) {
          onInventoryUpdated();
        }
      }
    } catch (err: any) {
      const errMsg = String(err?.message || err || '');
      if (err?.code === 'MARGIN_FLOOR_VIOLATION' || err?.data?.requiresSupervisorPin) {
        setSupervisorPinInput('');
        setSupervisorPinError('');
        setMarginOverridePrompt({
          payload,
          message: errMsg || `Proteksi Margin Aktif: Harga jual bersih di bawah batas minimum HPP + ${minMarginFloorPct}%.`,
          violations: Array.isArray(err?.data?.violations) ? err.data.violations : [],
        });
        return;
      }
      const isNetworkFailure =
        err instanceof TypeError ||
        /failed to fetch|networkerror|network request failed|fetch failed|load failed|err_internet|offline/i.test(errMsg);
      if (isNetworkFailure) {
        enqueueOfflineFallback();
      } else {
        onShowToast('Checkout Failed', errMsg || 'Error processing transaction');
      }
    } finally {
      checkoutSubmitLockRef.current = false;
      setIsProcessingCheckout(false);
    }
  };

  // Guard #1: Stale POS Shift Detection (opened on a previous calendar day OR open > 14 hours)
  const staleShiftStatus = useMemo(() => {
    if (!activeShift?.openedAt) {
      return { isStale: false, hoursOpen: 0, isPreviousDay: false };
    }
    const openedDate = new Date(activeShift.openedAt);
    const openedMs = openedDate.getTime();
    if (!Number.isFinite(openedMs)) {
      return { isStale: false, hoursOpen: 0, isPreviousDay: false };
    }
    const now = new Date();
    const hoursOpen = Math.max(0, (now.getTime() - openedMs) / (1000 * 60 * 60));
    const isPreviousDay =
      openedDate.getFullYear() !== now.getFullYear() ||
      openedDate.getMonth() !== now.getMonth() ||
      openedDate.getDate() !== now.getDate();
    return {
      isStale: isPreviousDay || hoursOpen > 14,
      hoursOpen: Math.round(hoursOpen * 10) / 10,
      isPreviousDay,
    };
  }, [activeShift?.openedAt]);

  const handleConfirmSupervisorMarginOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!marginOverridePrompt) return;
    if (!supervisorPinInput.trim()) {
      setSupervisorPinError('Masukkan PIN Supervisor (mis. 1234) untuk otorisasi.');
      return;
    }
    setIsAuthorizingOverride(true);
    setSupervisorPinError('');
    try {
      const res = await apiClient.posCheckout({
        ...marginOverridePrompt.payload,
        supervisorMarginOverride: true,
        supervisorPin: supervisorPinInput.trim(),
        supervisorName: supervisorNameInput.trim() || 'Store Manager (PIN Verified)',
      });
      if (res.success && res.receipt) {
        setIsOnline(true);
        setMarginOverridePrompt(null);
        setCompletedReceipt(res.receipt);
        setIsTenderModalOpen(false);
        clearCart();
        onShowToast(
          'Supervisor Override Approved',
          `Receipt #${res.receipt.receiptNumber} completed with Supervisor Margin Override.`
        );
        loadProducts();
        loadHistory();
        loadShiftState();
        if (onInventoryUpdated) onInventoryUpdated();
      }
    } catch (err: any) {
      setSupervisorPinError(String(err?.message || 'PIN Supervisor tidak valid.'));
    } finally {
      setIsAuthorizingOverride(false);
    }
  };

  const onShowToastRef = useRef(onShowToast);
  onShowToastRef.current = onShowToast;
  const onInventoryUpdatedRef = useRef(onInventoryUpdated);
  onInventoryUpdatedRef.current = onInventoryUpdated;
  const offlineAutoSyncPausedRef = useRef<boolean>(false);

  const syncOfflineQueue = useCallback(async () => {
    if (isSyncingOfflineQueue || offlineQueue.length === 0) return;
    setIsSyncingOfflineQueue(true);
    let syncedCount = 0;
    const remaining: OfflineQueuedPosTx[] = [];
    let abortDueToNetwork = false;

    for (let idx = 0; idx < offlineQueue.length; idx++) {
      const qItem = offlineQueue[idx];
      if (abortDueToNetwork) {
        remaining.push(qItem);
        continue;
      }
      try {
        const res = await apiClient.posCheckout(qItem.payload);
        if (res.success) {
          syncedCount++;
          setIsOnline(true);
        } else {
          remaining.push(qItem);
        }
      } catch (err: any) {
        const msg = String(err?.message || err || '');
        if (err instanceof TypeError || /failed to fetch|networkerror|fetch failed/i.test(msg)) {
          abortDueToNetwork = true;
          setIsOnline(false);
        }
        remaining.push(qItem);
      }
    }

    offlineAutoSyncPausedRef.current = remaining.length > 0 && !abortDueToNetwork;
    persistOfflineQueue(remaining);
    setIsSyncingOfflineQueue(false);

    if (syncedCount > 0) {
      onShowToastRef.current(
        'Offline Queue Synced',
        `${syncedCount} struk offline berhasil disinkronkan ke server & GL (${remaining.length} tersisa).`
      );
      loadProducts();
      loadHistory();
      loadShiftState();
      if (onInventoryUpdatedRef.current) {
        onInventoryUpdatedRef.current();
      }
    } else if (abortDueToNetwork) {
      onShowToastRef.current('Sync Pending', 'Koneksi server masih terputus. Struk tetap aman di Offline Queue.');
    }
  }, [isSyncingOfflineQueue, offlineQueue, persistOfflineQueue]);

  useEffect(() => {
    const handleOnline = () => {
      offlineAutoSyncPausedRef.current = false;
      setIsOnline(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (offlineQueue.length === 0) {
      offlineAutoSyncPausedRef.current = false;
      return;
    }
    if (isOnline && !isSyncingOfflineQueue && !offlineAutoSyncPausedRef.current) {
      syncOfflineQueue();
    }
  }, [isOnline, offlineQueue.length, isSyncingOfflineQueue, syncOfflineQueue]);

  // High-Speed POS Cashier Keyboard Shortcuts (non-visual, scoped strictly to POS Cashier Station)
  const shortcutStateRef = useRef({
    cartLength: cart.length,
    totalAmount,
    isSplitMode,
    splitLeg1Amount,
    isTenderModalOpen,
    isProcessingCheckout,
    isRegisterOpen,
    marginOverridePrompt,
    scalingProduct,
    completedReceipt,
    isHistoryDrawerOpen,
    isShiftModalOpen,
    isSafeDropModalOpen,
    rmaTargetReceipt,
    isBarcodeLabelModalOpen,
    handleExecuteCheckout,
  });
  shortcutStateRef.current = {
    cartLength: cart.length,
    totalAmount,
    isSplitMode,
    splitLeg1Amount,
    isTenderModalOpen,
    isProcessingCheckout,
    isRegisterOpen,
    marginOverridePrompt,
    scalingProduct,
    completedReceipt,
    isHistoryDrawerOpen,
    isShiftModalOpen,
    isSafeDropModalOpen,
    rmaTargetReceipt,
    isBarcodeLabelModalOpen,
    handleExecuteCheckout,
  };

  useEffect(() => {
    const onPosKeyDown = (e: KeyboardEvent) => {
      const s = shortcutStateRef.current;

      if (e.key === 'Escape') {
        if (s.marginOverridePrompt) {
          e.preventDefault();
          setMarginOverridePrompt(null);
          setSupervisorPinInput('');
          setSupervisorPinError('');
          return;
        }
        if (s.scalingProduct) {
          e.preventDefault();
          setScalingProduct(null);
          return;
        }
        if (s.isTenderModalOpen) {
          e.preventDefault();
          setIsTenderModalOpen(false);
          return;
        }
        if (s.completedReceipt) {
          e.preventDefault();
          setCompletedReceipt(null);
          return;
        }
        if (s.isHistoryDrawerOpen) {
          e.preventDefault();
          setIsHistoryDrawerOpen(false);
          return;
        }
        if (s.isShiftModalOpen) {
          e.preventDefault();
          setIsShiftModalOpen(false);
          return;
        }
        if (s.isSafeDropModalOpen) {
          e.preventDefault();
          setIsSafeDropModalOpen(false);
          return;
        }
        if (s.rmaTargetReceipt) {
          e.preventDefault();
          setRmaTargetReceipt(null);
          return;
        }
        if (s.isBarcodeLabelModalOpen) {
          e.preventDefault();
          setIsBarcodeLabelModalOpen(false);
          return;
        }
        return;
      }

      if (!['F2', 'F4', 'F8', 'F12'].includes(e.key)) return;

      // Ignore function shortcuts while typing inside any modal input
      const activeEl = document.activeElement as HTMLElement | null;
      const isInputFocused =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          activeEl.isContentEditable);
      const isInsideModal = Boolean(activeEl?.closest('[role="dialog"], .fixed.inset-0'));
      if (isInputFocused && isInsideModal) return;

      const hasBlockingSubModal = Boolean(
        s.marginOverridePrompt ||
          s.scalingProduct ||
          s.completedReceipt ||
          s.isShiftModalOpen ||
          s.isSafeDropModalOpen ||
          s.rmaTargetReceipt ||
          s.isBarcodeLabelModalOpen
      );

      if (e.key === 'F2') {
        if (hasBlockingSubModal) return;
        e.preventDefault();
        barcodeInputRef.current?.focus();
        barcodeInputRef.current?.select();
        return;
      }

      if (e.key === 'F4') {
        if (hasBlockingSubModal || s.cartLength === 0) return;
        e.preventDefault();
        lastCartQtyInputRef.current?.focus();
        lastCartQtyInputRef.current?.select();
        return;
      }

      if (e.key === 'F8') {
        if (hasBlockingSubModal || s.cartLength === 0) return;
        e.preventDefault();
        if (!s.isRegisterOpen) {
          onShowToast(
            'Register Belum Dibuka',
            'Silakan Open Register & Input Modal Laci Awal Sebelum Melakukan Transaksi.'
          );
          setIsShiftModalOpen(true);
          return;
        }
        if (!s.isTenderModalOpen) {
          setCashTendered(s.totalAmount);
          setIsTenderModalOpen(true);
          setIsSplitMode(true);
          setSplitLeg1Amount(Math.floor(s.totalAmount / 2));
        } else {
          const next = !s.isSplitMode;
          setIsSplitMode(next);
          if (next && s.splitLeg1Amount <= 0) {
            setSplitLeg1Amount(Math.floor(s.totalAmount / 2));
          }
        }
        return;
      }

      if (e.key === 'F12') {
        if (hasBlockingSubModal || s.cartLength === 0 || s.isProcessingCheckout) return;
        e.preventDefault();
        if (!s.isRegisterOpen) {
          onShowToast(
            'Register Belum Dibuka',
            'Silakan Open Register & Input Modal Laci Awal Sebelum Melakukan Transaksi.'
          );
          setIsShiftModalOpen(true);
          return;
        }
        if (s.isTenderModalOpen) {
          void s.handleExecuteCheckout();
        } else {
          setCashTendered(s.totalAmount);
          void s.handleExecuteCheckout(s.totalAmount);
        }
      }
    };

    window.addEventListener('keydown', onPosKeyDown);
    return () => window.removeEventListener('keydown', onPosKeyDown);
  }, []);

  // Filtered product items (strictly MERCHANDISE only; Fixed Assets & Consumables blocked)
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return products.filter((prod) => {
      if (prod.itemClassification && prod.itemClassification !== 'MERCHANDISE') return false;
      const matchesCategory = selectedCategory === 'ALL' || prod.category === selectedCategory;
      const matchesQuery =
        !q ||
        prod.name.toLowerCase().includes(q) ||
        prod.sku.toLowerCase().includes(q) ||
        prod.barcode.toLowerCase().includes(q) ||
        (prod.originalSku && prod.originalSku.toLowerCase().includes(q)) ||
        (prod.lotNumber && prod.lotNumber.toLowerCase().includes(q));
      return matchesCategory && matchesQuery;
    });
  }, [products, selectedCategory, searchQuery]);

  // Categories list matching catalog product categories
  const categories = ['ALL', 'produce', 'dairy_eggs', 'bakery', 'meat_seafood', 'pantry_coffee'];
  const formatCategoryLabel = (cat: string) => {
    if (cat === 'ALL') return 'All Items';
    if (cat === 'dairy_eggs') return 'DAIRY & EGGS';
    if (cat === 'pantry_coffee') return 'PANTRY & COFFEE';
    if (cat === 'meat_seafood') return 'MEAT & SEAFOOD';
    return cat.replace('_', ' ').toUpperCase();
  };
  const getOutletAddress = (storeId?: string, storeName?: string) => {
    const matched = storeOutlets.find((s) => s.storeId === storeId || s.storeName === storeName);
    if (matched?.address) return matched.address;
    const key = `${storeId || ''} ${storeName || ''}`.toLowerCase();
    if (key.includes('pik')) return 'Pantai Indah Kapuk Blvd, Jakarta Utara 14470';
    if (key.includes('menteng')) return 'Jl. HOS. Cokroaminoto No. 78, Jakarta Pusat 10310';
    if (key.includes('dago') || key.includes('bandung')) return 'Jl. Ir. H. Juanda No. 114, Bandung 40132';
    if (key.includes('gubeng') || key.includes('surabaya')) return 'Jl. Raya Gubeng No. 45, Surabaya 60281';
    if (key.includes('canggu') || key.includes('bali')) return 'Jl. Pantai Berawa No. 88, Canggu, Bali 80361';
    return 'Jl. Senopati No. 82, Jakarta Selatan 12110';
  };

  return (
    <div className="space-y-4 font-sans animate-fadeIn">
      {/* 1. POS Top Bar: Store context, Cashier session, Multi-Currency, and Scanner */}
      <div
        className={`p-3.5 sm:p-4 rounded-2xl border transition-colors shadow-xs ${
          isLight ? 'bg-white border-gray-200' : 'bg-[#12141C] border-slate-800/80'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Left: Outlet & Operator Badge */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
              <Store className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{currentStoreInfo.storeName}</span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#090A0F] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800/80 text-xs font-medium">
              <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="font-bold">{activeStaffSession?.userName || 'Andi Wijaya'}</span>
              <span className="text-[10px] uppercase font-mono px-1 py-0.2 rounded bg-slate-200 dark:bg-slate-900/90 text-slate-600 dark:text-slate-300">
                {activeStaffSession?.userRole || 'cashier'}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
                ({isRegisterOpen ? (activeShift?.shiftName || activeStaffSession?.shiftName || 'Shift Open') : 'Register Closed'})
              </span>
            </div>
          </div>

          {/* Right: Shift Control & Currency Selector & Parked Tickets & History */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* POS Shift & Blind Z-Report Pill */}
            <button
              type="button"
              onClick={() => setIsShiftModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeShift
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
              }`}
              title="Manage POS Cash Drawer Float & Blind Z-Report"
            >
              <Banknote className="w-3.5 h-3.5" />
              <span>
                {activeShift
                  ? `Shift Open · ${activeShift.transactionCount} Txn`
                  : 'Open Register (Modal Awal)'}
              </span>
            </button>

            {activeShift && (
              <button
                type="button"
                onClick={() => setIsSafeDropModalOpen(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  (activeShift.expectedTotalCashInDrawerIDR || 0) >= safeDropThresholdIDR
                    ? 'bg-amber-500 text-slate-950 border-amber-600 animate-pulse shadow-xs'
                    : isLight
                    ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    : 'bg-slate-900/90 text-slate-200 border-slate-800/80 hover:bg-slate-800'
                }`}
                title="Mid-Shift Safe Drop (Setor Brankas) — Drawer #1011 to Safe #1010"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>
                  Safe Drop ({formatIDR(activeShift.expectedTotalCashInDrawerIDR || 0)})
                </span>
              </button>
            )}

            {/* Multi-Currency Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#090A0F] px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-800/80">
              <Globe className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold hidden sm:inline">Currency:</span>
              <select
                value={activeCurrency}
                onChange={(e) => setActiveCurrency(e.target.value as SupportedCurrency)}
                className="text-xs font-bold bg-transparent border-0 focus:ring-0 cursor-pointer text-slate-800 dark:text-slate-200"
              >
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c.code} value={c.code} className="bg-white dark:bg-[#12141C] text-slate-900 dark:text-slate-100">
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

            {/* Offline-First Resilience Queue Indicator & 1-Click Sync */}
            {!isOnline && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-[11px] font-bold whitespace-nowrap">
                <WifiOff className="w-3 h-3" />
                <span>OFFLINE</span>
              </span>
            )}
            {offlineQueue.length > 0 && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-[11px] font-bold whitespace-nowrap">
                {isOnline ? <Wifi className="w-3 h-3 text-emerald-500" /> : <WifiOff className="w-3 h-3 text-rose-500" />}
                <span>Offline Queue: {offlineQueue.length} Struk Menunggu Sync</span>
                <button
                  type="button"
                  disabled={isSyncingOfflineQueue}
                  onClick={syncOfflineQueue}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-[10px] font-bold cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-2.5 h-2.5 ${isSyncingOfflineQueue ? 'animate-spin' : ''}`} />
                  <span>{isSyncingOfflineQueue ? 'Syncing...' : 'Sync Sekarang'}</span>
                </button>
              </div>
            )}

            {/* History Toggle */}
            <button
              onClick={() => setIsHistoryDrawerOpen(!isHistoryDrawerOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span className="hidden sm:inline">Receipts ({historyReceipts.length})</span>
            </button>
          </div>
        </div>

        {/* Stale POS Shift Guard Banner (Previous calendar day or open > 14 hours) */}
        {staleShiftStatus.isStale && activeShift && (
          <div className="mt-3 px-3.5 py-2.5 rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50/90 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                <strong>Stale POS Shift Detected:</strong> Shift #{activeShift.id} was opened{' '}
                {staleShiftStatus.isPreviousDay ? 'on a previous calendar day' : `${staleShiftStatus.hoursOpen}h ago (>14h)`}. Complete{' '}
                <strong>Close Shift / Z-Report</strong> before continuing new day sales to keep cash drawer reconciliation clean.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsShiftModalOpen(true)}
              className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold cursor-pointer whitespace-nowrap shrink-0 transition-colors"
            >
              Close Shift / Z-Report
            </button>
          </div>
        )}

        {/* Barcode Scanner & Variable-Weight Controls (Active Only When Register Is Open) */}
        {isRegisterOpen && (
          <>
            <form onSubmit={handleBarcodeSubmit} className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800/80 flex items-center gap-2">
              <div className="relative flex-1">
                <Scan className="w-4 h-4 text-emerald-600 dark:text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="Barcode Scanner Ready — Scan SKU (e.g. SKU-PRD-001) or press Enter to add..."
                  className={`w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono ${
                    isLight ? 'bg-gray-50 border-gray-200 text-gray-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100 dark:placeholder:text-slate-500'
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
              <span className="text-slate-600 dark:text-slate-300 font-bold flex items-center gap-1">
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
              <button
                type="button"
                onClick={() => setIsBarcodeLabelModalOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-[#0F4C3A] hover:bg-[#0b382b] text-white font-sans font-bold transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Tag className="w-3 h-3" />
                <span>Generate EAN-13 Scale &amp; Shelf Labels</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* 2. MANDATORY POS OPEN REGISTER & PETTY CASH SESSION GATE OR ACTIVE POS WORKSPACE */}
      {!isRegisterOpen ? (
        (() => {
          const liveWibDateStr = new Intl.DateTimeFormat('id-ID', {
            timeZone: 'Asia/Jakarta',
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          }).format(openGateClock);
          const liveWibTimeStr =
            new Intl.DateTimeFormat('id-ID', {
              timeZone: 'Asia/Jakarta',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false,
            })
              .format(openGateClock)
              .replace(/\./g, ':') + ' WIB';
          const liveWibYear = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Jakarta',
            year: 'numeric',
          }).format(openGateClock);

          const parsedPettyCash = openGatePettyCashInput.trim() === '' ? NaN : Number(openGatePettyCashInput);
          const isValidPettyCash = Number.isFinite(parsedPettyCash) && parsedPettyCash >= 0;

          const handleInlineOpenRegister = async (e: React.FormEvent) => {
            e.preventDefault();
            if (!isValidPettyCash) {
              setOpenGateError('Masukkan nominal Open Petty Cash / Modal Laci awal yang valid (>= Rp 0).');
              return;
            }
            setOpenGateError('');
            setIsOpeningRegister(true);
            try {
              const cleanFloat = Math.round(parsedPettyCash);
              const res = await apiClient.openPosShift({
                storeId: currentStoreInfo.storeId,
                branchId: currentStoreInfo.storeId,
                storeName: currentStoreInfo.storeName,
                registerId: openGateRegisterId.trim() || 'REG-04',
                shiftName: openGateShiftName,
                openingPettyCashIDR: cleanFloat,
                openingFloatIDR: cleanFloat,
                cashierName: activeStaffSession?.userName || 'Frontline Cashier',
                clientTimestampIso: new Date().toISOString(),
              });
              setActiveShift(res.shift);
              loadShiftState();
              onShowToast('Register Opened', res.message);
            } catch (err: any) {
              const msg = err?.message || 'Gagal membuka register kasir.';
              setOpenGateError(msg);
              onShowToast('Open Register Error', msg);
            } finally {
              setIsOpeningRegister(false);
            }
          };

          return (
            <div className="py-2 sm:py-4">
              <div
                className={`max-w-2xl mx-auto rounded-2xl border shadow-sm overflow-hidden ${
                  isLight ? 'bg-white border-gray-200 text-slate-900' : 'bg-[#12141C] border-slate-800/80 text-slate-100'
                }`}
              >
                {/* Gate Header */}
                <div
                  className={`p-5 sm:p-6 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isLight
                      ? 'border-gray-200 bg-gradient-to-r from-emerald-50/70 via-white to-amber-50/40'
                      : 'border-slate-800/80 bg-gradient-to-r from-[#12141C] via-[#12141C] to-emerald-950/30'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-[#0F4C3A] text-white flex items-center justify-center shadow-sm shrink-0">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 block">
                        POS Terminal Locked · Mandatory Cash Drawer Gate
                      </span>
                      <h2 className="text-lg sm:text-xl font-bold tracking-tight">
                        Open Register &amp; Petty Cash Session
                      </h2>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 self-start sm:self-auto shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Register Closed
                  </span>
                </div>

                {/* Live Synchronized Date, Clock & Year Banner */}
                <div
                  className={`mx-5 sm:mx-6 mt-5 p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isLight
                      ? 'bg-[#EEF2F0]/70 border-emerald-200/80 text-[#18221D]'
                      : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-[#0F4C3A] dark:text-emerald-400 shrink-0" />
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                        Synchronized System Date (WIB · Year {liveWibYear})
                      </span>
                      <span className="text-sm sm:text-base font-bold">{liveWibDateStr}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-[#12141C] border border-gray-200 dark:border-slate-800/80 font-mono font-extrabold text-sm sm:text-base text-[#0F4C3A] dark:text-emerald-400 tabular-nums self-start sm:self-auto">
                    <Clock className="w-4 h-4" />
                    <span>{liveWibTimeStr}</span>
                  </div>
                </div>

                {/* Form */}
                <form onSubmit={handleInlineOpenRegister} className="p-5 sm:p-6 space-y-4 text-xs sm:text-sm">
                  {openGateError && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                      <span>{openGateError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 block mb-1.5">
                        Workstation Shift
                      </label>
                      <select
                        value={openGateShiftName}
                        onChange={(e) => setOpenGateShiftName(e.target.value)}
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0F4C3A] cursor-pointer ${
                          isLight ? 'bg-white border-gray-300 text-slate-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                        }`}
                      >
                        {POS_SHIFT_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 block mb-1.5">
                        Register Terminal &amp; Store Hub
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={openGateRegisterId}
                          onChange={(e) => setOpenGateRegisterId(e.target.value)}
                          placeholder="REG-04"
                          className={`w-28 px-3 py-2.5 rounded-xl border font-mono text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0F4C3A] ${
                            isLight ? 'bg-white border-gray-300 text-slate-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                          }`}
                        />
                        <input
                          type="text"
                          readOnly
                          value={currentStoreInfo.storeName}
                          className={`flex-1 min-w-0 px-3 py-2.5 rounded-xl border text-xs sm:text-sm truncate ${
                            isLight ? 'bg-gray-50 border-gray-200 text-slate-700' : 'bg-[#090A0F] border-slate-800/80 text-slate-300'
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                        Open Petty Cash / Opening Drawer Float (Rp)
                      </label>
                      <span className="font-mono text-xs font-bold text-[#0F4C3A] dark:text-emerald-400">
                        {isValidPettyCash ? formatIDR(Math.round(parsedPettyCash)) : '—'}
                      </span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      required
                      value={openGatePettyCashInput}
                      onChange={(e) => setOpenGatePettyCashInput(e.target.value)}
                      placeholder="e.g. 500000"
                      className={`w-full px-4 py-3 rounded-xl border font-mono text-base font-extrabold focus:outline-none focus:ring-2 focus:ring-[#0F4C3A] ${
                        isLight ? 'bg-white border-gray-300 text-slate-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                      }`}
                    />
                    <div className="flex items-center gap-2 flex-wrap mt-2">
                      {[0, 300000, 500000, 1000000].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setOpenGatePettyCashInput(String(preset))}
                          className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono font-bold cursor-pointer transition-colors ${
                            Number(openGatePettyCashInput) === preset
                              ? 'bg-[#0F4C3A] text-white border-[#0F4C3A]'
                              : isLight
                              ? 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-slate-700'
                              : 'bg-[#090A0F] hover:bg-slate-800 border-slate-800/80 text-slate-300'
                          }`}
                        >
                          {formatIDR(preset)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-200 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Product scanning, cart additions, and payments remain locked until the register drawer is opened for this shift.
                    </p>
                    <button
                      type="submit"
                      disabled={isOpeningRegister}
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                    >
                      <Banknote className="w-4 h-4" />
                      <span>{isOpeningRegister ? 'Opening Register...' : 'Open Register & Start Shift'}</span>
                    </button>
                  </div>
                </form>

                {shiftHistory.length > 0 && (
                  <div
                    className={`px-5 sm:px-6 py-3 border-t text-[11px] flex flex-wrap items-center justify-between gap-2 ${
                      isLight ? 'bg-gray-50 border-gray-200 text-slate-600' : 'bg-[#090A0F] border-slate-800/80 text-slate-400'
                    }`}
                  >
                    <span>
                      Last Closed Shift: <strong className="font-mono">{shiftHistory[0].id}</strong> ({shiftHistory[0].cashierName})
                    </span>
                    <span className="font-mono">
                      Z-Report: {shiftHistory[0].zReportNumber || '—'} · Float {formatIDR(shiftHistory[0].openingFloatIDR)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })()
      ) : (
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
                      : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-800/80'
                  }`}
                >
                  {formatCategoryLabel(cat)}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[160px] sm:w-48">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter items..."
                className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                  isLight ? 'bg-white border-gray-200 text-gray-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100 dark:placeholder:text-slate-500'
                }`}
              />
            </div>
          </div>

          {/* Product Items Grid */}
          {isLoadingProducts ? (
            <div className="p-12 text-center text-xs text-slate-500 dark:text-slate-400">
              <span className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin inline-block mb-2" />
              <p>Loading POS Product Catalog...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div
              className={`p-10 rounded-2xl border text-center text-xs ${
                isLight ? 'bg-white border-gray-200 text-gray-500' : 'bg-[#12141C] border-slate-800/80 text-slate-400'
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
                        : 'bg-[#12141C] border-slate-800/80 hover:border-emerald-500/50'
                    }`}
                  >
                    <div>
                      {/* Product Image & FEFO Tag */}
                      <div className="relative aspect-4/3 rounded-xl overflow-hidden bg-slate-100 dark:bg-[#090A0F] mb-2">
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
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="text-xs font-bold line-clamp-2 text-slate-900 dark:text-slate-100 leading-tight">
                          {prod.name}
                        </h4>
                        {prod.isDynamicDiscountSku ? (
                          <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500 text-slate-950 shadow-2xs">
                            -{prod.discountPercent || 50}%
                          </span>
                        ) : prod.isConsignment ? (
                          <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            Titip Jual
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                        <span className="font-mono truncate max-w-[110px]" title={prod.sku}>
                          {prod.sku}
                        </span>
                        <span>Stock: {prod.availableStock}</span>
                      </div>
                    </div>

                    {/* Price & Action Button */}
                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-1">
                      <div>
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                          <span className="text-xs font-extrabold text-emerald-800 dark:text-emerald-400 block">
                            {formatCurrency(prod.sellingPrice)}
                          </span>
                          {prod.isDynamicDiscountSku && prod.originalSellingPrice && (
                            <span className="text-[10px] text-slate-400 line-through font-mono">
                              {formatCurrency(prod.originalSellingPrice)}
                            </span>
                          )}
                        </div>
                        {prod.isWeighted && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block -mt-0.5">
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
            isLight ? 'bg-white border-gray-200' : 'bg-[#12141C] border-slate-800/80'
          }`}
        >
          {/* Header Ticket Details */}
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800/80">
              <div className="flex items-center gap-2">
                <ReceiptText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
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
                  className="p-1 rounded-lg border border-slate-200 dark:border-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-40 cursor-pointer"
                  title="Clear register"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Customer Shopper Input & Lightweight Member/Loyalty Pill */}
            <div className="mt-3 space-y-2 relative">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Shopper / Member Name..."
                  className={`flex-1 min-w-0 text-xs px-2.5 py-1.5 rounded-xl border focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                    isLight ? 'bg-gray-50 border-gray-200 text-gray-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100 dark:placeholder:text-slate-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setIsMemberLookupOpen((prev) => !prev)}
                  className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                    selectedCrmMember
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                      : isLight
                      ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                  }`}
                  title="Attach CRM Member for Loyalty Points Earn/Redeem"
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>{selectedCrmMember ? `${selectedCrmMember.tier}` : 'Member'}</span>
                </button>
                <select
                  value={discountPercent}
                  disabled={!canOverrideDiscount}
                  onChange={(e) => {
                    if (!canOverrideDiscount) return;
                    setDiscountPercent(Number(e.target.value));
                  }}
                  title={
                    canOverrideDiscount
                      ? 'Apply discount tier'
                      : 'Manual discount / price overrides require Store Manager+ clearance'
                  }
                  className={`text-xs px-2 py-1.5 rounded-xl border font-semibold ${
                    canOverrideDiscount ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                  } ${
                    isLight ? 'bg-gray-50 border-gray-200 text-gray-800' : 'bg-[#090A0F] border-slate-800/80 text-slate-200'
                  }`}
                >
                  <option value={0}>0% Disc</option>
                  <option value={5}>5% Member</option>
                  <option value={10}>10% Staff</option>
                  <option value={15}>15% Promo</option>
                </select>
              </div>

              {selectedCrmMember && (
                <div
                  className={`px-2.5 py-2 rounded-xl border text-[11px] flex flex-wrap items-center justify-between gap-2 ${
                    isLight ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' : 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-bold truncate">{selectedCrmMember.companyName || selectedCrmMember.name}</span>
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400 shrink-0">
                      {selectedCrmMember.pointsBalance.toLocaleString('id-ID')} pts
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {selectedCrmMember.pointsBalance > 0 && cart.length > 0 && (
                      <>
                        <input
                          type="number"
                          min={0}
                          max={maxRedeemablePoints}
                          value={redeemPointsInput || ''}
                          onChange={(e) => setRedeemPointsInput(Math.max(0, Number(e.target.value)))}
                          placeholder="Redeem pts"
                          className={`w-20 px-2 py-0.5 rounded-lg border text-[11px] font-mono ${
                            isLight ? 'bg-white border-emerald-300 text-slate-900' : 'bg-[#090A0F] border-emerald-700 text-slate-100'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setRedeemPointsInput(maxRedeemablePoints)}
                          className="px-1.5 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-bold cursor-pointer"
                        >
                          Max ({maxRedeemablePoints})
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCrmMember(null);
                        setRedeemPointsInput(0);
                        setCustomerMemberId('');
                        setCustomerPhone('');
                        setCustomerName('Walk-in Retail Shopper');
                      }}
                      className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
                      title="Detach member"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Compact Promo / CRM Voucher Code Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1 min-w-0">
                    <Ticket className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleApplyPromoCode();
                        }
                      }}
                      placeholder="Promo / Voucher Code (e.g. VIPHEMAT20)..."
                      className={`w-full pl-8 pr-2.5 py-1.5 rounded-xl border text-xs font-mono uppercase focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                        isLight ? 'bg-gray-50 border-gray-200 text-gray-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100 dark:placeholder:text-slate-500'
                      }`}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={isValidatingPromo || cart.length === 0}
                    onClick={handleApplyPromoCode}
                    className="px-3 py-1.5 rounded-xl bg-[#0F4C3A] hover:bg-[#0b382b] disabled:opacity-40 text-white text-xs font-bold cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                  >
                    {isValidatingPromo ? '...' : 'Apply'}
                  </button>
                  {appliedPromoCode && (
                    <button
                      type="button"
                      onClick={() => {
                        setPromoInput('');
                        setAppliedPromoCode('');
                        setPromoStatusError('');
                      }}
                      className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800/80 text-slate-400 hover:text-rose-500 cursor-pointer"
                      title="Remove Voucher Code"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {promoStatusError && (
                  <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400 px-1">
                    {promoStatusError}
                  </p>
                )}

                {promoValidation && promoValidation.appliedPromos.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {promoValidation.appliedPromos.map((ap, i) => (
                      <span
                        key={`${ap.ruleId}-${i}`}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                      >
                        <Ticket className="w-2.5 h-2.5" />
                        <span>{ap.badgeLabel}</span>
                        <span className="font-mono">
                          {ap.promoType === 'PROMO_GIMMICK' ? 'GRATIS' : `-${formatIDR(ap.discountAmountIDR)}`}
                        </span>
                      </span>
                    ))}
                  </div>
                )}

                {promoValidation?.freeGimmickItems && promoValidation.freeGimmickItems.length > 0 && (
                  <div className="space-y-1 pt-0.5">
                    {promoValidation.freeGimmickItems.map((gItem, idx) => (
                      <div
                        key={`gimmick-${gItem.sku}-${idx}`}
                        className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[11px] font-bold text-rose-700 dark:text-rose-300"
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <Gift className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">
                            {gItem.quantity}x [GRATIS GIMMICK] {gItem.name}
                          </span>
                        </span>
                        <span className="font-mono shrink-0">Rp 0</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {isMemberLookupOpen && (
                <div
                  className={`absolute left-0 right-0 top-10 z-30 rounded-xl border p-2.5 shadow-xl space-y-2 ${
                    isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#12141C] border-slate-800/80 text-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={memberSearchQuery}
                      onChange={(e) => setMemberSearchQuery(e.target.value)}
                      placeholder="Search member name, company, or phone..."
                      className={`flex-1 text-xs bg-transparent focus:outline-none`}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setIsMemberLookupOpen(false)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
                    {memberResults.length === 0 ? (
                      <p className="py-3 text-center text-[11px] text-slate-500 dark:text-slate-400">No CRM members matched.</p>
                    ) : (
                      memberResults.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setSelectedCrmMember(m);
                            setCustomerName(m.companyName || m.name);
                            setCustomerPhone(m.phone);
                            setCustomerMemberId(m.id);
                            setRedeemPointsInput(0);
                            setIsMemberLookupOpen(false);
                          }}
                          className="w-full py-2 px-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-900/70 rounded-lg flex items-center justify-between gap-2 cursor-pointer"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate">{m.companyName || m.name}</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                              {m.phone} · {m.tier}
                            </p>
                          </div>
                          <span className="text-[11px] font-mono font-bold text-amber-600 dark:text-amber-400 shrink-0">
                            {m.pointsBalance.toLocaleString('id-ID')} pts
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Itemized Cart Rows */}
            <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800/80 max-h-[280px] overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
                  <ShoppingCart className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2 stroke-1" />
                  <p>Register cart is empty.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Scan items or select from catalog</p>
                </div>
              ) : (
                cart.map((item, idx) => (
                  <div key={`${item.id}-${idx}`} className="py-2 flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {item.name}
                        </span>
                        {item.isWeighted && (
                          <span className="text-[9px] px-1 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-mono">
                            {item.quantity} kg
                          </span>
                        )}
                        {item.appliedWholesaleTierLabel && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold whitespace-nowrap">
                            Harga Grosir Aktif ({item.appliedWholesaleTierLabel})
                          </span>
                        )}
                        {item.isDynamicDiscountSku && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold whitespace-nowrap">
                            Marked Down -{item.discountPercent || 50}%
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
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
                        className="p-1 rounded-md bg-slate-100 dark:bg-slate-900/90 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        ref={idx === 0 ? lastCartQtyInputRef : undefined}
                        type="number"
                        min={item.isWeighted ? 0.1 : 1}
                        step={item.isWeighted ? 0.25 : 1}
                        value={item.quantity}
                        onChange={(e) => {
                          const parsed = Number(e.target.value);
                          if (parsed > 0) setCartItemQuantity(item.id, parsed);
                        }}
                        aria-label={`Quantity for ${item.name}`}
                        className="w-8 bg-transparent text-xs font-bold font-mono text-center text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, 1)}
                        className="p-1 rounded-md bg-slate-100 dark:bg-slate-900/90 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>

                      <span className="text-xs font-bold font-mono ml-2 min-w-[70px] text-right text-slate-900 dark:text-slate-100">
                        {formatCurrency(item.lineTotal)}
                      </span>

                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        className="p-1 text-slate-400 hover:text-red-500 transition-colors cursor-pointer ml-1"
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
          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 font-medium">
              <span>Subtotal:</span>
              <span className="font-mono">{formatCurrency(subtotal)}</span>
            </div>

            {baseDiscountAmount + pointsDiscountIDR > 0 && (
              <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400">
                <span>
                  Discount ({discountPercent}%{pointsDiscountIDR > 0 ? ` + ${effectiveRedeemPoints} pts` : ''}):
                </span>
                <span className="font-mono">-{formatCurrency(baseDiscountAmount + pointsDiscountIDR)}</span>
              </div>
            )}

            {promoDiscountIDR > 0 && (
              <div className="flex items-center justify-between text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                <span>
                  Promo / Voucher{appliedPromoCode ? ` (${appliedPromoCode})` : ''}:
                </span>
                <span className="font-mono">-{formatCurrency(promoDiscountIDR)}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 font-medium">
              <span>Tax (PPN / PB1):</span>
              <span className="font-mono">{formatCurrency(taxAmount)}</span>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Due:</span>
                {activeCurrency !== 'IDR' && (
                  <span className="text-[11px] text-slate-400 font-mono block">
                    ≈ {formatIDR(totalAmount)}
                  </span>
                )}
              </div>
              <span className="text-xl sm:text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 font-mono">
                {formatCurrency(totalAmount)}
              </span>
            </div>

            {!isRegisterOpen && (
              <div className="mt-2.5 p-2.5 rounded-xl border border-amber-500/40 bg-amber-50 dark:bg-amber-950/35 text-amber-800 dark:text-amber-200 space-y-2">
                <div className="flex items-start gap-2 text-[11px] font-semibold leading-snug">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    Register Belum Dibuka — Silakan Open Register &amp; Input Modal Laci Awal Sebelum Melakukan Transaksi
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsShiftModalOpen(true)}
                  className="w-full py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  Open Register / Start Shift
                </button>
              </div>
            )}

            <button
              type="button"
              disabled={cart.length === 0 || !isRegisterOpen}
              onClick={() => {
                if (!isRegisterOpen) {
                  onShowToast(
                    'Register Belum Dibuka',
                    'Silakan Open Register & Input Modal Laci Awal Sebelum Melakukan Transaksi.'
                  );
                  setIsShiftModalOpen(true);
                  return;
                }
                setCashTendered(totalAmount);
                setIsSplitMode(false);
                setSplitLeg1Amount(Math.floor(totalAmount / 2));
                setIsTenderModalOpen(true);
              }}
              className="w-full mt-3 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <CreditCard className="w-4 h-4" />
              <span>Tender Payment ({activeCurrency})</span>
            </button>
          </div>
        </div>
      </div>
      )}

      {/* 3. DIGITAL WEIGHT SCALE MODAL (Produce & Meat nuanced workflow) */}
      {scalingProduct &&
        createPortal(
          <div
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto gm-backdrop-fade"
            onClick={() => setScalingProduct(null)}
          >
            <div
              className={`w-full max-w-md rounded-2xl border p-5 sm:p-6 shadow-2xl space-y-4 sm:space-y-5 my-auto relative max-h-[calc(100vh-2rem)] overflow-y-auto gm-modal-pop ${
                isLight ? 'bg-white border-gray-200 text-slate-900' : 'bg-[#12141C] border-slate-800/80 text-slate-100'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800/80">
                <div className="flex items-center gap-2">
                  <Scale className="w-5 h-5 text-blue-500" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Digital Scale Weighing
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setScalingProduct(null)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <img
                    src={scalingProduct.image}
                    alt={scalingProduct.name}
                    className="w-14 h-14 rounded-xl object-cover bg-slate-100 dark:bg-[#090A0F] border border-slate-200 dark:border-slate-800/80 shrink-0"
                  />
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm truncate">{scalingProduct.name}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{scalingProduct.sku}</p>
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(scalingProduct.pricePerKg || scalingProduct.sellingPrice * 4)} / kg
                    </p>
                  </div>
                </div>

                {/* Digital Scale Readout Display */}
                <div className="p-4 rounded-xl bg-[#090A0F] text-emerald-400 font-mono border border-emerald-500/30 text-center shadow-inner">
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest block">
                    Net Weight (Beban Bersih)
                  </span>
                  <span className="text-3xl font-extrabold tracking-wider block my-1">
                    {(Math.max(0, scaleGrossGrams - scaleTareGrams) / 1000).toFixed(3)} kg
                  </span>
                  <span className="text-xs text-slate-400">
                    Gross: {scaleGrossGrams}g | Tare (Bag): {scaleTareGrams}g
                  </span>
                </div>

                {/* Scale Controls: Sliders and Tare */}
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 block mb-1">
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
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {[250, 500, 1000, 1500, 2000].map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setScaleGrossGrams(g)}
                          className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/80 text-[11px] font-mono hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          {g >= 1000 ? `${g / 1000}kg` : `${g}g`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Tare Deduction (Packaging):</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={scaleTareGrams}
                        onChange={(e) => setScaleTareGrams(Number(e.target.value))}
                        className="w-16 px-2 py-1 rounded border border-slate-300 text-right font-mono text-xs bg-white text-slate-900 dark:bg-[#090A0F] dark:border-slate-800/80 dark:text-slate-100"
                      />
                      <span>g</span>
                    </div>
                  </div>

                  {/* Line Price preview */}
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Calculated Line Total:</span>
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
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800/80 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const netGrams = Math.max(0, scaleGrossGrams - scaleTareGrams);
                    addToCart(scalingProduct, 1, true, netGrams, scaleGrossGrams);
                    setScalingProduct(null);
                    onShowToast('Weighed Item Added', `${scalingProduct.name} (${(netGrams / 1000).toFixed(3)}kg) added`);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  Apply Weight to Ticket
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* 4. PAYMENT TENDER MODAL (Cash, QRIS, Card, Currency Conversion) */}
      {isTenderModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto gm-backdrop-fade"
            onClick={() => setIsTenderModalOpen(false)}
          >
            <div
              className={`w-full max-w-lg rounded-2xl border p-5 sm:p-6 shadow-2xl space-y-4 sm:space-y-5 my-auto relative max-h-[calc(100vh-2rem)] overflow-y-auto gm-modal-pop ${
                isLight ? 'bg-white border-gray-200 text-slate-900' : 'bg-[#12141C] border-slate-800/80 text-slate-100'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800/80">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Payment Tender &amp; Register Settle
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTenderModalOpen(false)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Total Due Banner */}
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-500/30 dark:border-emerald-800/50 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-300">Total Tender Due:</span>
                  <span className="text-2xl font-black text-emerald-800 dark:text-emerald-300 font-mono block">
                    {formatCurrency(totalAmount)}
                  </span>
                </div>
                {activeCurrency !== 'IDR' && (
                  <div className="text-right">
                    <span className="text-[11px] text-slate-600 dark:text-slate-300 font-mono font-medium">Base Statutory IDR:</span>
                    <span className="text-xs font-bold font-mono text-slate-700 dark:text-slate-200 block">
                      {formatIDR(totalAmount)}
                    </span>
                  </div>
                )}
              </div>

              {/* Payment Method Selector Tabs */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsSplitMode(false);
                    setPaymentMethod('cash');
                  }}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1 text-xs font-bold transition-all cursor-pointer ${
                    !isSplitMode && paymentMethod === 'cash'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800/80 hover:dark:bg-slate-800'
                  }`}
                >
                  <Banknote className="w-4 h-4" />
                  <span>Cash (Tunai)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsSplitMode(false);
                    setPaymentMethod('qris');
                  }}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1 text-xs font-bold transition-all cursor-pointer ${
                    !isSplitMode && paymentMethod === 'qris'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800/80 hover:dark:bg-slate-800'
                  }`}
                >
                  <QrCode className="w-4 h-4" />
                  <span>QRIS Instant</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsSplitMode(false);
                    setPaymentMethod('debit_card');
                  }}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1 text-xs font-bold transition-all cursor-pointer ${
                    !isSplitMode && paymentMethod.includes('card')
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800/80 hover:dark:bg-slate-800'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Debit / Card</span>
                </button>
              </div>

              {/* Additive Split Payment Toggle (2 Metode: Tunai + QRIS + EDC) */}
              <div className="flex items-center justify-between pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    const next = !isSplitMode;
                    setIsSplitMode(next);
                    if (next && splitLeg1Amount <= 0) {
                      setSplitLeg1Amount(Math.floor(totalAmount / 2));
                    }
                  }}
                  className={`w-full py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                    isSplitMode
                      ? 'bg-[#0F4C3A] text-white border-[#0F4C3A]'
                      : isLight
                      ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      : 'bg-slate-900/90 border-slate-800/80 text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <span>Split Payment (2 Metode: Tunai + QRIS / EDC)</span>
                  <span className="font-mono text-[10px] uppercase">
                    {isSplitMode ? 'AKTIF' : 'Aktifkan'}
                  </span>
                </button>
              </div>

              {isSplitMode && (
                <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/25 space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold mb-1">Metode 1</label>
                      <select
                        value={splitLeg1Method}
                        onChange={(e) => setSplitLeg1Method(e.target.value as 'CASH' | 'QRIS' | 'CARD')}
                        className="w-full px-2.5 py-2 rounded-lg border text-xs font-bold bg-white border-slate-300 text-slate-900 dark:bg-[#090A0F] dark:border-slate-800/80 dark:text-slate-100"
                      >
                        <option value="CASH">Tunai (Cash #1011)</option>
                        <option value="QRIS">QRIS Instant (#1020)</option>
                        <option value="CARD">EDC / Kartu (#1020)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold mb-1">Nominal 1 (IDR)</label>
                      <input
                        type="number"
                        min={1}
                        max={Math.max(1, totalAmount - 1)}
                        value={splitLeg1Amount || ''}
                        onChange={(e) => setSplitLeg1Amount(Math.max(0, Math.round(Number(e.target.value) || 0)))}
                        className="w-full px-2.5 py-2 rounded-lg border font-mono font-bold text-xs bg-white border-slate-300 text-slate-900 dark:bg-[#090A0F] dark:border-slate-800/80 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold mb-1">Metode 2</label>
                      <select
                        value={splitLeg2Method}
                        onChange={(e) => setSplitLeg2Method(e.target.value as 'CASH' | 'QRIS' | 'CARD')}
                        className="w-full px-2.5 py-2 rounded-lg border text-xs font-bold bg-white border-slate-300 text-slate-900 dark:bg-[#090A0F] dark:border-slate-800/80 dark:text-slate-100"
                      >
                        <option value="CASH">Tunai (Cash #1011)</option>
                        <option value="QRIS">QRIS Instant (#1020)</option>
                        <option value="CARD">EDC / Kartu (#1020)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold mb-1">Nominal 2 (Sisa Otomatis)</label>
                      <div className="px-2.5 py-2 rounded-lg border font-mono font-bold text-xs bg-slate-100 dark:bg-[#090A0F] border-slate-200 dark:border-slate-800/80 text-emerald-700 dark:text-emerald-300">
                        {formatIDR(splitLeg2Amount)}
                      </div>
                    </div>
                  </div>
                  {!isSplitValid && (
                    <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                      Pilih 2 metode berbeda dengan nominal masing-masing &gt; Rp 0 dan total sama persis {formatIDR(totalAmount)}.
                    </p>
                  )}
                </div>
              )}

              {/* Method Specific Panels */}
              {!isSplitMode && paymentMethod === 'cash' && (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                      Cash Tendered (Uang Diterima):
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">
                        Rp
                      </span>
                      <input
                        type="number"
                        value={cashTendered || ''}
                        onChange={(e) => setCashTendered(Number(e.target.value))}
                        className="w-full pl-9 pr-3 py-2 text-base font-bold font-mono rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white border-slate-300 text-slate-900 dark:bg-[#090A0F] dark:border-slate-800/80 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
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
                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-mono cursor-pointer"
                      >
                        Rp {amt.toLocaleString()}
                      </button>
                    ))}
                  </div>

                  {/* Change calculation */}
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-[#090A0F] border border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">Change Due (Kembalian):</span>
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

              {!isSplitMode && paymentMethod === 'qris' && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#090A0F] border border-slate-200 dark:border-slate-800/80 text-center space-y-3">
                  <div className="w-36 h-36 mx-auto bg-white p-2 rounded-xl border shadow-sm flex items-center justify-center">
                    <QRCodeSVG
                      value={`00020101021226670014ID.LINKAJA.WWW01189360091438201948250215ID10200392817440303UME520454115303360540${totalAmount}5802ID5913GroceMart SEN6007Jakarta61051211062070703A016304`}
                      size={130}
                      level="M"
                    />
                  </div>
                  <div className="text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">
                      GroceMart Senopati Dynamic QRIS
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      NMID: ID1020039281744 · ASPI Standard 2026
                    </span>
                  </div>
                </div>
              )}

              {!isSplitMode && paymentMethod.includes('card') && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#090A0F] border border-slate-200 dark:border-slate-800/80 text-center space-y-2">
                  <CreditCard className="w-8 h-8 text-blue-500 mx-auto" />
                  <div className="text-xs">
                    <span className="font-bold block">BCA EDC Register Terminal #04</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Insert or Tap Customer Debit / Credit Card
                    </span>
                  </div>
                </div>
              )}

              {/* Accounting Hook Notice */}
              <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-[#090A0F] border border-slate-200 dark:border-slate-800/80 text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-mono">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                <span>
                  {isSplitMode
                    ? `Split GL Posting: Debit #1011/#1020 (${splitLeg1Method} + ${splitLeg2Method}) · Credit Sales #4010 · COGS #5010`
                    : `Auto GL Posting: Debit Asset #${paymentMethod === 'cash' ? '1011' : '1020'} · Credit Sales #4010 · COGS #5010`}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTenderModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800/80 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={
                    !isRegisterOpen ||
                    isProcessingCheckout ||
                    (isSplitMode ? !isSplitValid : paymentMethod === 'cash' && cashTendered < totalAmount)
                  }
                  onClick={() => handleExecuteCheckout()}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold shadow-md cursor-pointer flex items-center justify-center gap-1.5"
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
          </div>,
          document.body
        )}

      {/* 5. ELECTRONIC THERMAL RECEIPT MODAL (Struk Kasir) */}
      {completedReceipt &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto print:hidden gm-backdrop-fade"
            onClick={() => setCompletedReceipt(null)}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-white text-slate-900 border border-slate-200 p-6 shadow-2xl space-y-4 font-mono text-xs my-auto relative max-h-[calc(100vh-2rem)] overflow-y-auto gm-modal-pop"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-300">
                <div className="w-8 h-8 rounded-lg bg-emerald-800 text-amber-300 font-bold text-sm mx-auto flex items-center justify-center">
                  GM
                </div>
                <h3 className="font-extrabold text-sm tracking-wider">PT BUMI RETAIL SEJAHTERA</h3>
                <p className="text-[10px] text-zinc-500 leading-tight">
                  {completedReceipt.storeName}
                  <br />
                  {getOutletAddress(completedReceipt.storeId, completedReceipt.storeName)}
                  {storeOutlets.find((s) => s.storeId === completedReceipt.storeId)?.receiptHeaderNote ? (
                    <>
                      <br />
                      <span className="italic text-[9px] text-zinc-400">
                        {storeOutlets.find((s) => s.storeId === completedReceipt.storeId)?.receiptHeaderNote}
                      </span>
                    </>
                  ) : null}
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
                {(completedReceipt.isOfflinePendingSync || completedReceipt.receiptNumber.startsWith('OFF-')) && (
                  <div className="mt-1 py-0.5 px-1.5 rounded bg-amber-100 border border-amber-400 text-amber-900 font-bold text-center text-[9px]">
                    [OFFLINE RECEIPT · MENUNGGU SYNC]
                  </div>
                )}
                {completedReceipt.marginComplianceStatus === 'SUPERVISOR_OVERRIDE' && (
                  <div className="mt-1 py-0.5 px-1.5 rounded bg-rose-100 border border-rose-300 text-rose-800 font-bold text-center text-[9px]">
                    [SUPERVISOR MARGIN OVERRIDE APPROVED]
                  </div>
                )}
                {completedReceipt.marginComplianceStatus === 'CLEARANCE_BELOW_COST' && (
                  <div className="mt-1 py-0.5 px-1.5 rounded bg-amber-50 border border-amber-300 text-amber-800 font-bold text-center text-[9px]">
                    [CLEARANCE MARKDOWN BELOW WAC]
                  </div>
                )}
              </div>

              {/* Line Items */}
              <div className="space-y-1.5 py-1">
                {completedReceipt.items.map((item, idx) => (
                  <div key={`${item.id}-${idx}`} className="text-[10px]">
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
                {completedReceipt.freeGimmickItems?.map((gItem, idx) => (
                  <div key={`rcp-g-${gItem.sku}-${idx}`} className="text-[10px] pt-1 border-t border-dotted border-slate-300 text-rose-700">
                    <div className="flex justify-between font-bold">
                      <span className="truncate max-w-[190px]">
                        {gItem.quantity}x [GRATIS GIMMICK] {gItem.name}
                      </span>
                      <span>Rp 0</span>
                    </div>
                    <div className="text-[8.5px] text-slate-500 flex justify-between">
                      <span>Sponsor POSM ({gItem.ruleCode})</span>
                      <span>Bebas PPN</span>
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
                    <span>Discount &amp; Promos:</span>
                    <span>-{formatIDR(completedReceipt.discount)}</span>
                  </div>
                )}
                {completedReceipt.promoDiscountIDR && completedReceipt.promoDiscountIDR > 0 ? (
                  <div className="flex justify-between text-[9px] text-indigo-700">
                    <span>
                      ↳ Saved via {completedReceipt.promoCode || completedReceipt.appliedPromos?.map((p) => p.ruleCode).join(', ') || 'Promo'}:
                    </span>
                    <span>{formatIDR(completedReceipt.promoDiscountIDR)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <span>Tax (PPN/PB1):</span>
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
                {completedReceipt.splitPayments && completedReceipt.splitPayments.length > 0 ? (
                  <div className="pt-1 space-y-0.5 text-[10px] text-slate-600">
                    <div className="font-bold">Split Tender:</div>
                    {completedReceipt.splitPayments.map((leg, i) => (
                      <div key={i} className="flex justify-between pl-2">
                        <span>• {leg.method}</span>
                        <span>{formatIDR(leg.amountIDR)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex justify-between text-[10px] pt-1 text-slate-600">
                    <span>Tender: {completedReceipt.paymentMethod.toUpperCase()}</span>
                    <span>{formatIDR(completedReceipt.cashTendered || completedReceipt.total)}</span>
                  </div>
                )}
                {completedReceipt.cashChange !== undefined && completedReceipt.cashChange > 0 && (
                  <div className="flex justify-between text-[10px] text-slate-600 font-bold">
                    <span>Change (Kembalian):</span>
                    <span>{formatIDR(completedReceipt.cashChange)}</span>
                  </div>
                )}
              </div>

              {/* Footer / GL Audit Stamp */}
              <div className="pt-2 border-t border-dashed border-slate-300 text-center text-[9px] text-zinc-500 space-y-1">
                {(completedReceipt.loyaltyPointsEarned || completedReceipt.loyaltyPointsRedeemed) && (
                  <p className="text-[10px] font-bold text-emerald-700">
                    Loyalty ({completedReceipt.crmMemberTier || 'MEMBER'}): +{completedReceipt.loyaltyPointsEarned || 0} pts earned
                    {completedReceipt.loyaltyPointsRedeemed ? ` · -${completedReceipt.loyaltyPointsRedeemed} pts redeemed` : ''}
                  </p>
                )}
                <p>GL Journal Vouchers: {completedReceipt.journalEntryIds.slice(0, 2).join(', ')}</p>
                <p>*** TERIMA KASIH ATAS KUNJUNGAN ANDA ***</p>
                <p className="text-[8px] text-zinc-400">Barang yang dibeli tidak dapat ditukar kecuali basi.</p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      triggerPrint({
                        type: 'pos_receipt',
                        format: 'thermal80',
                        receipt: completedReceipt,
                      });
                    }}
                    className="flex-1 py-2 rounded-xl border border-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-slate-50 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRmaTargetReceipt(completedReceipt);
                      setCompletedReceipt(null);
                      setWaReceiptFeedback(null);
                      setWaReceiptPhone('');
                    }}
                    className="py-2 px-3 rounded-xl border border-amber-400 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Return / RMA</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCompletedReceipt(null);
                      setWaReceiptFeedback(null);
                      setWaReceiptPhone('');
                    }}
                    className="flex-1 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                  >
                    New Sale (F2)
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setDispatchReceipt({ receipt: completedReceipt, channel: 'email' })
                    }
                    className="py-1.5 px-2.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Email Receipt</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDispatchReceipt({ receipt: completedReceipt, channel: 'whatsapp' })
                    }
                    className="py-1.5 px-2.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp Receipt</span>
                  </button>
                </div>

                {/* Frictionless 1-Tap Struk WA + Live Loyalty Statement */}
                <div className="pt-1.5 border-t border-slate-200 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="tel"
                      value={waReceiptPhone || selectedCrmMember?.phone || customerPhone || ''}
                      onChange={(e) => setWaReceiptPhone(e.target.value)}
                      placeholder="No. WA (+62 812...)"
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-[11px] font-mono text-slate-900 bg-white"
                    />
                    <button
                      type="button"
                      disabled={isSendingWaReceipt}
                      onClick={async () => {
                        const targetPhone = (waReceiptPhone || selectedCrmMember?.phone || customerPhone || '').trim();
                        if (!targetPhone) {
                          onShowToast('No. WhatsApp Diperlukan', 'Masukkan nomor WhatsApp pelanggan untuk mengirim Struk WA + Saldo Poin.');
                          return;
                        }
                        setIsSendingWaReceipt(true);
                        setWaReceiptFeedback(null);
                        try {
                          const res = await apiClient.sendPosReceiptWhatsapp(completedReceipt.receiptNumber, {
                            toPhone: targetPhone,
                            recipientName: selectedCrmMember?.name || customerName || 'Pelanggan GroceMart',
                          });
                          setWaReceiptFeedback({ message: res.message, waMeUrl: res.waMeUrl });
                          onShowToast('Struk WA + Poin Terkirim', res.message);
                        } catch (err: any) {
                          onShowToast('Gagal Kirim Struk WA', err?.message || 'Unable to dispatch WhatsApp receipt.');
                        } finally {
                          setIsSendingWaReceipt(false);
                        }
                      }}
                      className="py-1.5 px-3 rounded-lg bg-[#0F4C3A] hover:bg-[#0b382b] disabled:opacity-50 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <MessageCircle className="w-3 h-3" />
                      <span>{isSendingWaReceipt ? 'Mengirim...' : 'Kirim Struk WA + Poin'}</span>
                    </button>
                  </div>
                  {waReceiptFeedback && (
                    <div className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1 flex items-center justify-between gap-2">
                      <span className="truncate">{waReceiptFeedback.message}</span>
                      {waReceiptFeedback.waMeUrl && (
                        <a
                          href={waReceiptFeedback.waMeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold underline shrink-0"
                        >
                          wa.me
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* 6. RECENT TRANSACTIONS DRAWER */}
      {isHistoryDrawerOpen &&
        createPortal(
          <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-xs flex justify-end gm-backdrop-fade">
            <div
              className={`w-full max-w-md h-full p-6 shadow-2xl flex flex-col justify-between overflow-y-auto gm-drawer-right ${
                isLight ? 'bg-white text-slate-900' : 'bg-[#12141C] text-slate-100 border-l border-slate-800/80'
              }`}
            >
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <History className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <h3 className="font-bold text-base">Recent POS Receipts</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsHistoryDrawerOpen(false)}
                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {historyReceipts.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-8">No POS transactions yet today.</p>
                  ) : (
                    historyReceipts.map((rcp) => (
                      <div
                        key={rcp.receiptNumber}
                        onClick={() => setCompletedReceipt(rcp)}
                        className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all hover:border-emerald-500/50 ${
                          isLight ? 'bg-gray-50 border-gray-200 hover:bg-white' : 'bg-[#090A0F] border-slate-800/80 hover:bg-slate-900/70'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span className="font-mono">{rcp.receiptNumber}</span>
                          <span className="text-emerald-600 dark:text-emerald-400">{formatIDR(rcp.total)}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          <span>{new Date(rcp.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="uppercase font-mono">{rcp.paymentMethod}</span>
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setRmaTargetReceipt(rcp);
                            }}
                            className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold hover:bg-amber-500/25 cursor-pointer"
                          >
                            Process RMA
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsHistoryDrawerOpen(false)}
                className="w-full mt-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800/80 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Close History
              </button>
            </div>
          </div>,
          document.body
        )}

      {/* 7. POS SHIFT & BLIND Z-REPORT MODAL */}
      <PosShiftModal
        theme={theme}
        isOpen={isShiftModalOpen}
        onClose={() => setIsShiftModalOpen(false)}
        storeId={effectiveStoreId}
        storeName={currentStoreInfo.storeName}
        cashierName={activeStaffSession?.userName || 'Andi Wijaya'}
        activeShift={activeShift}
        shiftHistory={shiftHistory}
        onShiftUpdated={(updatedShift) => {
          if (updatedShift !== undefined) {
            setActiveShift(updatedShift);
          }
          loadShiftState();
          if (onInventoryUpdated) onInventoryUpdated();
        }}
        onShowToast={onShowToast}
      />

      {/* 7B. POS SAFE DROP (SETOR BRANKAS) MODAL */}
      <PosSafeDropModal
        theme={theme}
        isOpen={isSafeDropModalOpen}
        onClose={() => setIsSafeDropModalOpen(false)}
        storeId={effectiveStoreId}
        storeName={currentStoreInfo.storeName}
        activeShift={activeShift}
        safeDropThresholdIDR={safeDropThresholdIDR}
        onSafeDropCompleted={(updatedShift) => {
          setActiveShift(updatedShift);
          loadShiftState();
          if (onInventoryUpdated) onInventoryUpdated();
        }}
        onShowToast={onShowToast}
      />

      {/* 8. POS QUICK RETURN / RMA NOTA RETUR MODAL */}
      <PosRmaQuickModal
        theme={theme}
        receipt={rmaTargetReceipt}
        onClose={() => setRmaTargetReceipt(null)}
        onCompleted={() => {
          loadProducts();
          loadShiftState();
          if (onInventoryUpdated) onInventoryUpdated();
        }}
        onShowToast={onShowToast}
      />

      {/* 9. SCALE BARCODE & SHELF LABEL GENERATOR MODAL */}
      <BarcodeShelfLabelModal
        theme={theme}
        isOpen={isBarcodeLabelModalOpen}
        onClose={() => setIsBarcodeLabelModalOpen(false)}
        products={products.map((p) => ({
          sku: p.sku,
          productName: p.name,
          category: p.category,
          unit: p.unit,
          sellingPrice: p.sellingPrice,
          pricePerKg: p.pricePerKg,
          isWeighted: p.isWeighted,
        }))}
        onTestScanToPos={(ean13) => {
          setBarcodeInput(ean13);
          handleBarcodeSubmit(undefined, ean13);
        }}
        onShowToast={onShowToast}
      />
      {dispatchReceipt && (
        <DocumentDispatchModal
          isOpen={Boolean(dispatchReceipt)}
          onClose={() => setDispatchReceipt(null)}
          theme={theme}
          initialChannel={dispatchReceipt.channel}
          docType="POS_RECEIPT"
          docId={dispatchReceipt.receipt.receiptNumber}
          docNumber={dispatchReceipt.receipt.receiptNumber}
          docSummary={`Outlet: ${dispatchReceipt.receipt.storeName}\nItems: ${dispatchReceipt.receipt.items.length} | Payment: ${dispatchReceipt.receipt.paymentMethod.toUpperCase()}\nSubtotal: ${formatIDR(dispatchReceipt.receipt.subtotal)} | Disc: -${formatIDR(dispatchReceipt.receipt.discount)} | Tax: ${formatIDR(dispatchReceipt.receipt.tax)}\nTotal Paid: ${formatIDR(dispatchReceipt.receipt.total)}`}
          defaultRecipientName="Walk-in Customer"
          defaultRecipientEmail=""
          defaultRecipientPhone=""
          onShowToast={onShowToast}
        />
      )}

      {/* SUPERVISOR MARGIN FLOOR OVERRIDE PIN MODAL */}
      {marginOverridePrompt &&
        createPortal(
          <div
            className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 gm-backdrop-fade"
            onClick={() => setMarginOverridePrompt(null)}
          >
            <div
              className={`w-full max-w-md rounded-2xl border p-5 sm:p-6 shadow-2xl space-y-4 gm-modal-pop ${
                isLight ? 'bg-white border-gray-200 text-slate-900' : 'bg-[#12141C] border-slate-800/80 text-slate-100'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                      Dynamic Margin Floor Guard
                    </span>
                    <h3 className="text-base font-bold">Otorisasi PIN Supervisor Diperlukan</h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMarginOverridePrompt(null)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-900 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-800 dark:text-rose-200 space-y-1.5">
                <p className="font-semibold">{marginOverridePrompt.message}</p>
                {marginOverridePrompt.violations.length > 0 && (
                  <ul className="space-y-1 pt-1 font-mono text-[11px]">
                    {marginOverridePrompt.violations.map((v) => (
                      <li key={v.sku} className="flex justify-between gap-2">
                        <span className="truncate">{v.sku}</span>
                        <span>
                          Net {formatIDR(v.netEffectiveUnitPrice)} &lt; Min {formatIDR(v.minAllowedUnitPrice)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <form onSubmit={handleConfirmSupervisorMarginOverride} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold mb-1">Supervisor Name</label>
                  <input
                    type="text"
                    value={supervisorNameInput}
                    onChange={(e) => setSupervisorNameInput(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border ${
                      isLight ? 'bg-white border-gray-300' : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                    }`}
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Supervisor PIN (Default Store Manager PIN: 1234)</label>
                  <input
                    type="password"
                    value={supervisorPinInput}
                    onChange={(e) => setSupervisorPinInput(e.target.value)}
                    placeholder="Masukkan PIN Supervisor..."
                    autoFocus
                    className={`w-full px-3 py-2 rounded-xl border font-mono ${
                      isLight ? 'bg-white border-gray-300' : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                    }`}
                  />
                </div>
                {supervisorPinError && (
                  <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                    {supervisorPinError}
                  </p>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setMarginOverridePrompt(null)}
                    className="px-4 py-2 rounded-xl border border-gray-300 dark:border-slate-800/80 font-semibold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isAuthorizingOverride}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold cursor-pointer"
                  >
                    {isAuthorizingOverride ? 'Memverifikasi...' : 'Otorisasi & Selesaikan Transaksi'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
