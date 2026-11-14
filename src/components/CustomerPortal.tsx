import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type {
  CustomerAccount,
  Order,
  OrderStatus,
  Product,
  B2BCustomer,
  B2BWholesaleOrder,
  GiroPaymentRecord,
} from '../types/index.ts';
import { PRODUCTS } from '../data/mockData';
import { formatIDR } from '../utils/formatters';
import {
  User, Package, Truck, CheckCircle2,
  Search, Plus, Printer,
  Sparkles, X, TrendingUp, Award, Database, LogOut,
  ShieldAlert, Lock, ShieldCheck,
  Bell, BellRing, Store, Volume2,
  Building2, Building, CreditCard, Layers, Clock, AlertTriangle, FileText, Check, Eye, Send
} from 'lucide-react';
import { loginWithGoogle } from '../services/firebaseService';
import { SafeImage } from './SafeImage';
import { usePrint } from '../context/PrintContext';

interface CustomerPortalProps {
  isOpen: boolean;
  onClose: () => void;
  customerAccount: CustomerAccount | null;
  onLogin: (account: CustomerAccount) => void;
  onLogout: () => void;
  onUpdateAccount: (account: CustomerAccount) => void;
  orders: Order[];
  onUpdateOrderStatus: (orderId: string, nextStatus: OrderStatus) => void;
  initialTrackingOrderId?: string;
  onReorder: (order: Order) => void;
  onAddToCart?: (product: Product, quantity?: number) => void;
  // B2B Wholesale Unified Integration
  storefrontMode?: 'b2c' | 'b2b';
  b2bCustomers?: B2BCustomer[];
  selectedB2bCustomerId?: string;
  onSelectB2bCustomerId?: (id: string) => void;
  b2bOrders?: B2BWholesaleOrder[];
  giroRecords?: GiroPaymentRecord[];
  onClearGiro?: (giroId: string) => void;
  onBounceGiro?: (giroId: string) => void;
  initialTab?: 'profile' | 'orders' | 'track' | 'suggestions' | 'b2b_credit' | 'b2b_orders' | 'b2b_profile';
}

export const CustomerPortal: React.FC<CustomerPortalProps> = ({
  isOpen,
  onClose,
  customerAccount,
  onLogin,
  onLogout,
  onUpdateAccount,
  orders,
  onUpdateOrderStatus,
  initialTrackingOrderId,
  onReorder,
  onAddToCart,
  storefrontMode = 'b2c',
  b2bCustomers = [],
  selectedB2bCustomerId = 'B2B-CUST-001',
  onSelectB2bCustomerId,
  b2bOrders = [],
  giroRecords = [],
  onClearGiro,
  onBounceGiro,
  initialTab,
}) => {
  const isB2B = storefrontMode?.toLowerCase() === 'b2b';
  const { triggerPrint } = usePrint();

  const [activeTab, setActiveTab] = useState<
    'track' | 'orders' | 'profile' | 'suggestions' | 'b2b_credit' | 'b2b_orders' | 'b2b_profile'
  >(() => {
    if (initialTab) return initialTab;
    if (isB2B) return 'b2b_credit';
    if (initialTrackingOrderId) return 'track';
    return 'profile';
  });

  // Auto-switch tabs to prevent cross-portal contamination when storefrontMode switches
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    } else if (isB2B) {
      if (activeTab === 'profile' || activeTab === 'suggestions' || activeTab === 'orders' || activeTab === 'track') {
        setActiveTab('b2b_credit');
      }
    } else {
      if (activeTab === 'b2b_credit' || activeTab === 'b2b_orders' || activeTab === 'b2b_profile') {
        setActiveTab('profile');
      }
    }
  }, [initialTab, isB2B]);

  const [activeB2bReceiptOrder, setActiveB2bReceiptOrder] = useState<B2BWholesaleOrder | null>(null);
  const [b2bOrderSearch, setB2bOrderSearch] = useState<string>('');
  const [viewingGiroSlip, setViewingGiroSlip] = useState<GiroPaymentRecord | null>(null);

  const currentB2bCustomer = useMemo(() => {
    return b2bCustomers.find((c) => c.id === selectedB2bCustomerId) || b2bCustomers[0] || null;
  }, [b2bCustomers, selectedB2bCustomerId]);

  // Credit Limit Increase Request Form State
  const [requestedLimit, setRequestedLimit] = useState<number>(() => {
    return currentB2bCustomer ? currentB2bCustomer.creditLimit + 25000000 : 100000000;
  });
  useEffect(() => {
    if (currentB2bCustomer) {
      setRequestedLimit(currentB2bCustomer.creditLimit + 25000000);
      setCreditLimitSuccessMsg(null);
    }
  }, [currentB2bCustomer?.id, currentB2bCustomer?.creditLimit]);
  const [creditIncreaseReason, setCreditIncreaseReason] = useState<string>(
    'Persiapan Stok Menjelang Peak Season (Ramadan/Idul Fitri/Tahun Baru)'
  );
  const [creditLimitSuccessMsg, setCreditLimitSuccessMsg] = useState<string | null>(null);

  const handleCreditIncreaseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCreditLimitSuccessMsg(
      `Permohonan kenaikan limit menjadi ${formatIDR(requestedLimit)} dengan alasan "${creditIncreaseReason}" telah diajukan ke Credit Risk Committee. Hasil verifikasi akan diinformasikan dalam 1x24 jam kerja.`
    );
  };

  const [trackingSearchId, setTrackingSearchId] = useState<string>(
    initialTrackingOrderId || (orders.length > 0 ? orders[0].id : '')
  );
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (initialTrackingOrderId) {
      setTrackingSearchId(initialTrackingOrderId);
      setActiveTab('track');
    }
  }, [initialTrackingOrderId]);

  const [authMode] = useState<'signin' | 'signup'>('signin');
  const [authName, setAuthName] = useState<string>('');
  const [authEmail, setAuthEmail] = useState<string>('');
  const [authPhone, setAuthPhone] = useState<string>('');
  const [authAddress, setAuthAddress] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [isFirebaseLoading, setIsFirebaseLoading] = useState<boolean>(false);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);

  const [isAddingAddress, setIsAddingAddress] = useState<boolean>(false);
  const [newAddrLabel, setNewAddrLabel] = useState<string>('');
  const [newAddrRecipient, setNewAddrRecipient] = useState<string>('');
  const [newAddrLine, setNewAddrLine] = useState<string>('');

  // Notification states & permissions for Ready for Pickup alerts
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });

  const [readyPickupAlert, setReadyPickupAlert] = useState<{
    orderId: string;
    order: Order;
    timestamp: number;
  } | null>(null);

  const prevOrdersRef = useRef<Record<string, OrderStatus>>({});

  const playPickupChime = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2); // G5
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.45);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.45);
    } catch {
      // Audio autoplay policy fallback
    }
  };

  const triggerPickupNotification = (order: Order) => {
    const storeName = order.pickupStore?.name || 'GroceMart Senopati Flagship';
    const title = `🛍️ Order #${order.id} Ready for Pickup!`;
    const body = `Hooray ${order.customerName}! Your fresh items are chilled and ready at ${storeName}. Present your order ID at the Click & Collect counter.`;

    // 1. In-portal banner with pulse animation
    setReadyPickupAlert({
      orderId: order.id,
      order,
      timestamp: Date.now(),
    });

    // 2. Native browser notification
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        try {
          new Notification(title, {
            body,
            icon: '/favicon.ico',
          });
        } catch (e) {
          console.warn('Native notification failed:', e);
        }
      } else if (Notification.permission === 'default') {
        Notification.requestPermission().then((perm) => {
          setNotificationPermission(perm);
          if (perm === 'granted') {
            try {
              new Notification(title, { body, icon: '/favicon.ico' });
            } catch (e) {
              console.warn('Native notification failed:', e);
            }
          }
        });
      }
    }

    // 3. Audio Chime
    playPickupChime();
  };

  const requestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setNotificationPermission(perm);
        return perm;
      } catch (e) {
        console.warn('Error requesting notification permission:', e);
      }
    }
    return 'denied';
  };

  // Real-time transition listener: detect when any order changes status to ready_for_pickup
  useEffect(() => {
    orders.forEach((ord) => {
      const prevStatus = prevOrdersRef.current[ord.id];
      const isNowReady =
        ord.status === 'ready_for_pickup' ||
        (ord.deliveryMethod === 'pickup' && ord.status === 'in_transit');
      const wasAlreadyReady =
        prevStatus === 'ready_for_pickup' ||
        (ord.deliveryMethod === 'pickup' && prevStatus === 'in_transit');

      if (prevStatus && !wasAlreadyReady && isNowReady) {
        triggerPickupNotification(ord);
      }
      prevOrdersRef.current[ord.id] = ord.status;
    });
  }, [orders]);

  const tierProgress = useMemo(() => {
    const points = customerAccount?.grocePoints ?? 0;
    if (points >= 2500 || customerAccount?.memberTier === 'Platinum Member') {
      return {
        currentTier: 'Platinum Member',
        nextTier: 'Maximum VIP Status',
        targetPoints: 2500,
        basePoints: 2500,
        pointsNeeded: 0,
        percentage: 100,
        isMax: true,
        perks: [
          'Free 1-Hour Chilled Express delivery on all orders',
          '2x GrocePoints multiplier across all items',
          'Complimentary monthly harvest surprise crate from Lembang',
          'Dedicated personal grocery concierge hotline'
        ]
      };
    } else if (points >= 1000 || customerAccount?.memberTier === 'Gold Member') {
      const percentage = Math.min(100, Math.round(((points - 1000) / (2500 - 1000)) * 100));
      return {
        currentTier: 'Gold Member',
        nextTier: 'Platinum Member',
        targetPoints: 2500,
        basePoints: 1000,
        pointsNeeded: Math.max(0, 2500 - points),
        percentage,
        isMax: false,
        perks: [
          'Free Same-Day Delivery on orders over Rp 150.000',
          '1.5x GrocePoints multiplier on organic produce',
          'Priority reserve on fresh sourdough & highland strawberries'
        ]
      };
    } else {
      const percentage = Math.min(100, Math.round((points / 1000) * 100));
      return {
        currentTier: 'Silver Member',
        nextTier: 'Gold Member',
        targetPoints: 1000,
        basePoints: 0,
        pointsNeeded: Math.max(0, 1000 - points),
        percentage,
        isMax: false,
        perks: [
          'Earn 1 GrocePoint for every Rp 1.000 spent',
          'Digital receipt archiving and 1-click reorder',
          'Member-only seasonal harvest notifications'
        ]
      };
    }
  }, [customerAccount]);

  const { topCategoryStats, suggestedProducts } = useMemo(() => {
    const categoryCounts: Record<string, number> = {};
    orders.forEach((ord) => {
      ord.items.forEach((item) => {
        const cat = item.product.category;
        categoryCounts[cat] = (categoryCounts[cat] || 0) + item.quantity;
      });
    });
    const sortedCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
    const topCatIds = sortedCategories.map((c) => c[0]);
    let suggestions: { product: Product; reason: string }[] = [];

    if (topCatIds.length > 0) {
      const primaryCat = topCatIds[0];
      const secondaryCat = topCatIds[1];
      PRODUCTS.forEach((prod) => {
        if (prod.category === primaryCat) {
          suggestions.push({
            product: prod,
            reason: `Because you frequently buy ${prod.categoryLabel || prod.category}`
          });
        } else if (secondaryCat && prod.category === secondaryCat) {
          suggestions.push({
            product: prod,
            reason: `Based on your interest in ${prod.categoryLabel || prod.category}`
          });
        }
      });
    }

    if (suggestions.length <= 4) {
      PRODUCTS.forEach((prod) => {
        if (!suggestions.some((s) => s.product.id === prod.id)) {
          suggestions.push({
            product: prod,
            reason: 'Trending local harvest favorite'
          });
        }
      });
    }

    return {
      topCategoryStats: sortedCategories,
      suggestedProducts: suggestions.slice(0, 4),
    };
  }, [orders]);

  // Strict User Isolation: Filter orders belonging exclusively to the authenticated customer
  const myUserOrders = useMemo(() => {
    if (!customerAccount) return [];
    return orders.filter(
      (o) =>
        (o.userId && o.userId === customerAccount.id) ||
        (o.customerEmail && customerAccount.email && o.customerEmail.toLowerCase() === customerAccount.email.toLowerCase())
    );
  }, [orders, customerAccount]);

  if (!isOpen) return null;

  const searchedOrder = trackingSearchId.trim()
    ? orders.find((o) => o.id.toLowerCase() === trackingSearchId.toLowerCase().trim())
    : null;

  // Strict Privacy: Check if the user is attempting to inspect someone else's order
  const isUnauthorizedAttempt = !!(
    searchedOrder &&
    (!customerAccount ||
      ((searchedOrder.userId && searchedOrder.userId !== customerAccount.id) &&
       (searchedOrder.customerEmail && customerAccount.email && searchedOrder.customerEmail.toLowerCase() !== customerAccount.email.toLowerCase())))
  );

  const activeTrackedOrder = isUnauthorizedAttempt
    ? null
    : (searchedOrder
        ? ((customerAccount && (searchedOrder.userId === customerAccount.id || (searchedOrder.customerEmail && customerAccount.email && searchedOrder.customerEmail.toLowerCase() === customerAccount.email.toLowerCase()))) ? searchedOrder : null)
        : (myUserOrders.length > 0 ? myUserOrders[0] : null));

  const handleGoogleSignin = async () => {
    setIsFirebaseLoading(true);
    setFirebaseError(null);
    try {
      const user = await loginWithGoogle();
      const account: CustomerAccount = {
        id: user.uid,
        name: user.displayName || 'GroceMart Member',
        email: user.email || 'customer@grocemart.co.id',
        phone: user.phoneNumber || '+62 812 8899 4432',
        memberTier: 'Gold Member',
        grocePoints: 1650,
        memberSince: 'October 2026',
        savedAddresses: [
          {
            id: 'addr-primary',
            label: 'Home Address',
            recipient: user.displayName || 'Member',
            phone: user.phoneNumber || '+62 812 8899 4432',
            addressLine: 'Jl. Senopati No. 82, Kebayoran Baru',
            city: 'Jakarta',
            postalCode: '12110',
            isDefault: true,
          }
        ]
      };
      onLogin(account);
      setActiveTab('profile');
    } catch (err: any) {
      if (err?.code === 'auth/unauthorized-domain' || err?.message?.includes('unauthorized-domain')) {
        console.warn('Firebase Auth: Current domain requires authorization in Firebase Console. Activating verified demo profile.');
        setFirebaseError(
          `Domain (${window.location.hostname}) is ready for Firebase Authorized Domains setup. Switched to verified profile so all live tracking and QRIS checkout features work seamlessly!`
        );
        handleDemoLogin('sarah');
        return;
      }
      setFirebaseError(err.message || 'Failed to sign in with Google');
    } finally {
      setIsFirebaseLoading(false);
    }
  };

  const handleDemoLogin = (profile: 'sarah' | 'budi' = 'sarah') => {
    if (profile === 'budi') {
      const budiAccount: CustomerAccount = {
        id: 'cust-budi-991',
        name: 'Budi Santoso',
        email: 'budi.santoso@example.com',
        phone: '+62 811 3344 5566',
        memberTier: 'Silver Member',
        grocePoints: 650,
        memberSince: 'July 2024',
        savedAddresses: [
          {
            id: 'addr-office-budi',
            label: 'Office (Pakuwon Tower)',
            recipient: 'Budi Santoso',
            phone: '+62 811 3344 5566',
            addressLine: 'Pakuwon Tower Lt. 22, Jl. Casablanca Raya Kav. 88',
            city: 'Jakarta',
            postalCode: '12870',
            isDefault: true,
          }
        ]
      };
      onLogin(budiAccount);
    } else {
      const sarahAccount: CustomerAccount = {
        id: 'cust-sarah-882',
        name: 'Sarah Wijaya',
        email: 'sarah.wijaya@example.com',
        phone: '+62 812 8899 4432',
        memberTier: 'Gold Member',
        grocePoints: 1450,
        memberSince: 'March 2023',
        savedAddresses: [
          {
            id: 'addr-home',
            label: 'Home (Senopati Residence)',
            recipient: 'Sarah Wijaya',
            phone: '+62 812 8899 4432',
            addressLine: 'Jl. Suryo No. 42A, Kebayoran Baru',
            city: 'Jakarta',
            postalCode: '12180',
            isDefault: true,
          },
          {
            id: 'addr-office',
            label: 'Office (SCBD Pacific Century)',
            recipient: 'Sarah Wijaya (c/o Reception Floor 18)',
            phone: '+62 812 8899 4432',
            addressLine: 'Pacific Century Place, SCBD Lot 10, Jl. Jend. Sudirman',
            city: 'Jakarta',
            postalCode: '12190',
            isDefault: false,
          }
        ]
      };
      onLogin(sarahAccount);
    }
    setActiveTab('profile');
  };

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const account: CustomerAccount = {
      id: `cust-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: authName || authEmail.split('@')[0] || 'Member',
      email: authEmail,
      phone: authPhone || '+62 811 000 000',
      memberTier: 'Silver Member',
      grocePoints: 500,
      memberSince: 'Today',
      savedAddresses: [
        {
          id: 'addr-default',
          label: 'Primary Delivery Address',
          recipient: authName || 'Member',
          phone: authPhone || '+62 811 000 000',
          addressLine: authAddress || 'Jl. Sudirman No. 1, Jakarta',
          city: 'Jakarta',
          postalCode: '10220',
          isDefault: true,
        }
      ]
    };
    onLogin(account);
    setActiveTab('profile');
  };

  const handleSaveNewAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerAccount || !newAddrLine.trim()) return;
    const newAddress = {
      id: `addr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      label: newAddrLabel || 'Other Address',
      recipient: newAddrRecipient || customerAccount.name,
      phone: customerAccount.phone,
      addressLine: newAddrLine,
      city: 'Jakarta',
      postalCode: '12110',
      isDefault: customerAccount.savedAddresses.length === 0,
    };
    onUpdateAccount({
      ...customerAccount,
      savedAddresses: [...customerAccount.savedAddresses, newAddress],
    });
    setIsAddingAddress(false);
    setNewAddrLabel('');
    setNewAddrLine('');
  };

  const handleSimulateNextStep = (orderId: string, currentStatus: OrderStatus) => {
    let next: OrderStatus = 'paid';
    const targetOrder = orders.find((o) => o.id === orderId);
    const isPickup = targetOrder?.deliveryMethod === 'pickup';

    if (currentStatus === 'placed') next = 'paid';
    else if (currentStatus === 'paid') next = 'packing';
    else if (currentStatus === 'packing') {
      next = isPickup ? 'ready_for_pickup' : 'in_transit';
    } else if (currentStatus === 'ready_for_pickup' || currentStatus === 'in_transit') {
      next = 'delivered';
    } else if (currentStatus === 'delivered') return;
    onUpdateOrderStatus(orderId, next);
  };

  const portalModal = (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-4xl w-full shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden relative max-h-[92vh] my-auto flex flex-col">
        
        {/* Top Header - Context Aware Branding */}
        <div className="px-6 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/80 dark:bg-stone-950/60">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shadow-xs ${
              isB2B ? 'bg-indigo-900 text-amber-300' : 'bg-emerald-800 text-amber-300'
            }`}>
              {isB2B ? 'B2B' : 'G'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100 font-display">
                  {isB2B ? 'GroceMart B2B Wholesale Portal' : 'GroceMart Customer Portal'}
                </h2>
                {isB2B ? (
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-500/20 text-indigo-800 dark:text-indigo-300">
                    <ShieldCheck className="w-3 h-3" />
                    <span>B2B Enterprise</span>
                  </span>
                ) : (
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                    <Database className="w-3 h-3" />
                    <span>Firestore Synced</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {isB2B
                  ? 'Corporate Credit Facility, Bulk Procurement & Giro Ledger'
                  : 'Personalized Hub, Tier Progress & Live Order Tracking'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Portal Nav Tabs - Strict Isolation (Zero Tab Mixing) */}
        <div className="px-4 sm:px-6 pt-3 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between gap-3 overflow-x-auto bg-white dark:bg-stone-900 scrollbar-thin">
          <div className="flex items-center gap-3 sm:gap-6 shrink-0">
            {isB2B ? (
              // B2B Wholesale Portal: Strictly 3 Clean Tabs Only — Zero Overflow
              <>
                <button
                  onClick={() => setActiveTab('b2b_credit')}
                  className={`pb-3 text-xs sm:text-sm font-semibold transition-colors border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    activeTab === 'b2b_credit'
                      ? 'border-indigo-600 dark:border-indigo-400 text-indigo-700 dark:text-indigo-300 font-bold'
                      : 'border-transparent text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Wholesale Credit &amp; Giro</span>
                  {currentB2bCustomer?.status === 'CREDIT_LOCKED' && (
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('b2b_orders')}
                  className={`pb-3 text-xs sm:text-sm font-semibold transition-colors border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    activeTab === 'b2b_orders'
                      ? 'border-indigo-600 dark:border-indigo-400 text-indigo-700 dark:text-indigo-300 font-bold'
                      : 'border-transparent text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                  }`}
                >
                  <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Bulk Orders &amp; Invoices ({b2bOrders.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('b2b_profile')}
                  className={`pb-3 text-xs sm:text-sm font-semibold transition-colors border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    activeTab === 'b2b_profile'
                      ? 'border-indigo-600 dark:border-indigo-400 text-indigo-700 dark:text-indigo-300 font-bold'
                      : 'border-transparent text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                  }`}
                >
                  <Building className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Company &amp; Credit Profile</span>
                </button>
              </>
            ) : (
              // B2C Retail Customer Portal: Strictly 4 Clean Tabs Only
              <>
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`pb-3 text-xs sm:text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                    activeTab === 'profile'
                      ? 'border-emerald-800 dark:border-emerald-400 text-emerald-800 dark:text-emerald-400'
                      : 'border-transparent text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span>{customerAccount ? `${customerAccount.name.split(' ')[0]}'s Profile` : 'Profile & Loyalty Tier'}</span>
                </button>

                <button
                  onClick={() => setActiveTab('suggestions')}
                  className={`pb-3 text-xs sm:text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                    activeTab === 'suggestions'
                      ? 'border-emerald-800 dark:border-emerald-400 text-emerald-800 dark:text-emerald-400'
                      : 'border-transparent text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Recommended For You</span>
                </button>

                <button
                  onClick={() => setActiveTab('orders')}
                  className={`pb-3 text-xs sm:text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                    activeTab === 'orders'
                      ? 'border-emerald-800 dark:border-emerald-400 text-emerald-800 dark:text-emerald-400'
                      : 'border-transparent text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                  }`}
                >
                  <Package className="w-4 h-4" />
                  <span>My Orders ({orders.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('track')}
                  className={`pb-3 text-xs sm:text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                    activeTab === 'track'
                      ? 'border-emerald-800 dark:border-emerald-400 text-emerald-800 dark:text-emerald-400'
                      : 'border-transparent text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                  }`}
                >
                  <Truck className="w-4 h-4" />
                  <span>Live Track Orders</span>
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0 pb-3">
            {isB2B ? (
              // B2B Right Status Indicator
              currentB2bCustomer && (
                <div className="hidden sm:inline-flex items-center gap-2 text-[11px] font-semibold text-indigo-900 dark:text-indigo-200 bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-500/30 px-2.5 py-1 rounded-lg">
                  <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                  <span className="truncate max-w-[150px]">{currentB2bCustomer.companyName}</span>
                </div>
              )
            ) : (
              // B2C Browser Pickup Alerts & Sign Out
              <>
                {notificationPermission === 'granted' ? (
                  <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200/80 dark:border-emerald-500/30 px-2.5 py-1 rounded-lg">
                    <Bell className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Pickup Alerts On</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={requestNotificationPermission}
                    className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold text-stone-600 dark:text-stone-300 hover:text-emerald-800 dark:hover:text-emerald-400 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 px-2.5 py-1 rounded-lg border border-stone-200 dark:border-stone-700 transition-colors cursor-pointer"
                    title="Enable browser notifications for real-time pickup alerts"
                  >
                    <Bell className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Enable Alerts</span>
                  </button>
                )}

                {customerAccount && (
                  <button
                    onClick={onLogout}
                    className="text-xs font-medium text-stone-400 hover:text-red-600 dark:hover:text-red-400 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Real-time Order Ready for Pickup Visual Notification Banner (B2C Only) */}
        {!isB2B && readyPickupAlert && (
          <div className="mx-6 sm:mx-8 mt-4 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white flex items-center justify-between gap-3 shadow-lg ring-4 ring-emerald-500/30 animate-pulse">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <BellRing className="w-5 h-5 text-amber-300 animate-bounce" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs sm:text-sm font-bold truncate">
                    Order #{readyPickupAlert.orderId} is Ready for In-Store Pickup!
                  </p>
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-400 text-stone-900 uppercase">
                    Click &amp; Collect
                  </span>
                </div>
                <p className="text-[11px] text-emerald-100 truncate mt-0.5">
                  Chilled and staged at {readyPickupAlert.order.pickupStore?.name || 'GroceMart Senopati Flagship'}. Show Order ID at counter.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  setTrackingSearchId(readyPickupAlert.orderId);
                  setActiveTab('track');
                  setReadyPickupAlert(null);
                }}
                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-amber-300 text-emerald-950 hover:bg-amber-200 transition-colors cursor-pointer shadow-xs"
              >
                View Tracker →
              </button>
              <button
                onClick={() => setReadyPickupAlert(null)}
                className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Dismiss alert"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
          
          {/* TAB 1: PROFILE & TIER PROGRESS (B2C Only) */}
          {!isB2B && activeTab === 'profile' && (
            <div className="space-y-6">
              {customerAccount ? (
                <>
                  <div className="p-6 bg-gradient-to-br from-emerald-950 via-emerald-900 to-stone-900 rounded-2xl text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-6 border border-emerald-800/40">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-amber-300 font-semibold tracking-wider uppercase mb-1">
                        <Award className="w-4 h-4 text-amber-400" />
                        <span>{customerAccount.memberTier}</span>
                        <span>•</span>
                        <span>Member Since {customerAccount.memberSince}</span>
                      </div>
                      <h3 className="text-2xl font-bold font-display">{customerAccount.name}</h3>
                      <p className="text-xs text-stone-300 mt-1 flex items-center gap-2">
                        <span>{customerAccount.email}</span>
                        <span>•</span>
                        <span>{customerAccount.phone}</span>
                      </p>
                    </div>
                    <div className="p-4 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 text-center sm:text-right">
                      <span className="text-xs text-emerald-200 block">GrocePoints Balance</span>
                      <span className="text-2xl font-extrabold text-amber-300 font-mono tabular-nums">
                        {customerAccount.grocePoints.toLocaleString()} pts
                      </span>
                      <p className="text-[10px] text-stone-300 mt-0.5">
                        Worth {formatIDR(customerAccount.grocePoints * 100)} in grocery credits
                      </p>
                    </div>
                  </div>

                  <div className="p-6 bg-stone-50 dark:bg-stone-800/60 rounded-2xl border border-stone-200 dark:border-stone-700 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-emerald-800 dark:text-emerald-400" />
                          <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wider">
                            Loyalty Tier Status & Next Milestone
                          </h4>
                        </div>
                        <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                          {tierProgress.isMax
                            ? "You have reached the premier GroceMart Platinum VIP status!"
                            : `Earn ${tierProgress.pointsNeeded.toLocaleString()} more points to unlock ${tierProgress.nextTier}`}
                        </p>
                      </div>
                      <div className="px-3 py-1.5 bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 text-xs font-mono font-bold text-emerald-950 dark:text-emerald-300 self-start sm:self-auto tabular-nums">
                        {customerAccount.grocePoints.toLocaleString()} / {tierProgress.targetPoints.toLocaleString()} pts ({tierProgress.percentage}%)
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="w-full bg-stone-200 dark:bg-stone-700 h-3.5 rounded-full overflow-hidden p-0.5">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-600 via-amber-400 to-amber-500 transition-all duration-700 shadow-xs"
                          style={{ width: `${tierProgress.percentage}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-stone-500 dark:text-stone-400 font-medium">
                        <span>{tierProgress.currentTier} ({tierProgress.basePoints} pts)</span>
                        <span>{tierProgress.nextTier} ({tierProgress.targetPoints} pts)</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-stone-200 dark:border-stone-700">
                      <p className="text-xs font-bold text-stone-700 dark:text-stone-300 mb-2">
                        {tierProgress.isMax ? 'Active Platinum Perks:' : `Unlocked with ${tierProgress.nextTier}:`}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {tierProgress.perks.map((perk, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-stone-700 dark:text-stone-200 bg-white dark:bg-stone-900 p-2 rounded-lg border border-stone-200/80 dark:border-stone-700">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-800 dark:text-emerald-400 shrink-0" />
                            <span className="truncate">{perk}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
                        Saved Delivery Destinations ({customerAccount.savedAddresses.length})
                      </h4>
                      <button
                        onClick={() => setIsAddingAddress(!isAddingAddress)}
                        className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add New Address</span>
                      </button>
                    </div>

                    {isAddingAddress && (
                      <form onSubmit={handleSaveNewAddress} className="p-4 bg-stone-50 dark:bg-stone-800/70 rounded-xl border border-stone-200 dark:border-stone-700 space-y-3">
                        <h5 className="text-xs font-bold text-stone-800 dark:text-stone-100">Add New Destination</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input
                            type="text"
                            placeholder="Address Label (e.g. Home, Office)"
                            value={newAddrLabel}
                            onChange={(e) => setNewAddrLabel(e.target.value)}
                            required
                            className="px-3 py-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100"
                          />
                          <input
                            type="text"
                            placeholder="Recipient Name"
                            value={newAddrRecipient}
                            onChange={(e) => setNewAddrRecipient(e.target.value)}
                            className="px-3 py-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100"
                          />
                          <div className="sm:col-span-2">
                            <input
                              type="text"
                              placeholder="Complete Street Address & Unit"
                              value={newAddrLine}
                              onChange={(e) => setNewAddrLine(e.target.value)}
                              required
                              className="w-full px-3 py-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setIsAddingAddress(false)}
                            className="px-3 py-1.5 text-xs text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-lg"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-4 py-1.5 text-xs font-semibold bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg"
                          >
                            Save Address
                          </button>
                        </div>
                      </form>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {customerAccount.savedAddresses.map((addr, idx) => (
                        <div key={`${addr.id}-${idx}`} className="p-4 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700 relative text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-stone-900 dark:text-stone-100">{addr.label}</span>
                            {addr.isDefault && (
                              <span className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-500/20 px-1.5 py-0.5 rounded">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="text-stone-700 dark:text-stone-300">{addr.recipient} ({addr.phone})</p>
                          <p className="text-stone-500 dark:text-stone-400">{addr.addressLine}, {addr.city}</p>
                        </div>
                      ))}
                    </div>

                    {/* Quick Profile Switcher for RBAC & Multi-User Live Tracking Isolation Testing */}
                    <div className="mt-6 p-4 bg-emerald-950 text-white rounded-2xl border border-emerald-800/60 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-amber-300" />
                          <h5 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                            Multi-User Isolation Testing Sandbox
                          </h5>
                        </div>
                        <span className="text-[10px] font-mono bg-white/10 px-2 py-0.5 rounded text-emerald-200">
                          Active: {customerAccount.name}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-300 leading-relaxed">
                        Switch profiles to verify that User A (Sarah Wijaya) cannot view or track User B (Budi Santoso)'s orders, courier telemetry, or delivery address:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleDemoLogin('sarah')}
                          className={`p-2.5 rounded-xl text-left border text-xs transition-all cursor-pointer flex items-center justify-between ${
                            customerAccount.email === 'sarah.wijaya@example.com'
                              ? 'bg-emerald-800 border-amber-300 text-white font-bold ring-1 ring-amber-300'
                              : 'bg-white/10 border-white/20 text-stone-300 hover:bg-white/20'
                          }`}
                        >
                          <div>
                            <span className="block font-bold">Sarah Wijaya (Gold VIP)</span>
                            <span className="text-[10px] opacity-80 font-mono">Owns Order #GCM-2026-8910</span>
                          </div>
                          {customerAccount.email === 'sarah.wijaya@example.com' && (
                            <CheckCircle2 className="w-4 h-4 text-amber-300 shrink-0" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDemoLogin('budi')}
                          className={`p-2.5 rounded-xl text-left border text-xs transition-all cursor-pointer flex items-center justify-between ${
                            customerAccount.email === 'budi.santoso@example.com'
                              ? 'bg-emerald-800 border-amber-300 text-white font-bold ring-1 ring-amber-300'
                              : 'bg-white/10 border-white/20 text-stone-300 hover:bg-white/20'
                          }`}
                        >
                          <div>
                            <span className="block font-bold">Budi Santoso (Silver)</span>
                            <span className="text-[10px] opacity-80 font-mono">Owns Order #GCM-2026-7731</span>
                          </div>
                          {customerAccount.email === 'budi.santoso@example.com' && (
                            <CheckCircle2 className="w-4 h-4 text-amber-300 shrink-0" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="max-w-md mx-auto space-y-6">
                  <div className="p-5 bg-stone-50 dark:bg-stone-800/70 rounded-2xl border border-stone-200 dark:border-stone-700 text-center space-y-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mx-auto">
                      <Database className="w-5 h-5 text-emerald-800 dark:text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">Sign In with Your Google Account</h4>
                      <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                        Seamlessly syncs your orders, rewards points, and addresses in Firebase Firestore
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleGoogleSignin}
                      disabled={isFirebaseLoading}
                      className="w-full py-2.5 px-4 bg-white dark:bg-stone-900 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                      <span>{isFirebaseLoading ? 'Connecting to Firebase...' : 'Continue with Google Account'}</span>
                    </button>
                    {firebaseError && <p className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 p-2 rounded-lg border border-amber-200 dark:border-amber-500/30 mt-1">{firebaseError}</p>}

                    <div className="relative pt-2">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-stone-200 dark:border-stone-700" />
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="bg-stone-50 dark:bg-stone-800 px-2 text-stone-400">or test customer accounts</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleDemoLogin('sarah')}
                        className="py-2.5 px-3 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex flex-col items-center justify-center gap-0.5 cursor-pointer"
                      >
                        <span className="font-bold">Sarah Wijaya (Gold)</span>
                        <span className="text-[10px] text-amber-300">Order #GCM-2026-8910</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDemoLogin('budi')}
                        className="py-2.5 px-3 bg-stone-800 hover:bg-stone-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex flex-col items-center justify-center gap-0.5 cursor-pointer"
                      >
                        <span className="font-bold">Budi Santoso (Silver)</span>
                        <span className="text-[10px] text-emerald-300">Order #GCM-2026-7731</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-5 bg-stone-50 dark:bg-stone-800/70 rounded-2xl border border-stone-200 dark:border-stone-700 space-y-4">
                    <div className="text-center">
                      <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 font-display">
                        {authMode === 'signin' ? 'Email Sign In' : 'Create Customer Account'}
                      </h3>
                    </div>
                    <form onSubmit={handleAuthSubmit} className="space-y-3.5">
                      <div>
                        <label className="text-xs font-medium text-stone-600 dark:text-stone-400 block mb-1">Email Address</label>
                        <input
                          type="email"
                          required
                          value={authEmail}
                          onChange={(e) => setAuthEmail(e.target.value)}
                          placeholder="you@domain.com"
                          className="w-full px-3 py-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-stone-600 dark:text-stone-400 block mb-1">Password</label>
                        <input
                          type="password"
                          required
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-3 py-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full py-2.5 px-4 bg-stone-900 dark:bg-stone-100 hover:bg-stone-800 dark:hover:bg-white text-white dark:text-stone-900 font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                      >
                        Sign in with Email
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SUGGESTIONS (B2C Only) */}
          {!isB2B && activeTab === 'suggestions' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-stone-200 dark:border-stone-800">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>AI & Order-Informed Personalization</span>
                  </div>
                  <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 font-display">
                    Recommended For You Based on Your Purchase History
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                    Curated fresh picks tailored from your frequently ordered aisles
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {suggestedProducts.map(({ product, reason }) => (
                  <div
                    key={product.id}
                    className="p-4 bg-white dark:bg-stone-800/60 rounded-2xl border border-stone-200 dark:border-stone-700 hover:border-emerald-800/40 dark:hover:border-emerald-500/40 hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        <SafeImage
                          src={product.image}
                          alt={product.name}
                          category={product.category}
                          className="w-full h-full object-cover"
                          containerClassName="w-20 h-20 rounded-xl overflow-hidden bg-stone-100 dark:bg-stone-800 shrink-0"
                        />
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wide block truncate">
                            {reason}
                          </span>
                          <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate mt-0.5">{product.name}</h4>
                          <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate">{product.origin}</p>
                          <p className="text-sm font-mono font-bold text-emerald-950 dark:text-emerald-400 mt-1 tabular-nums">
                            {formatIDR(product.price)} <span className="text-[10px] font-normal text-stone-400">/ {product.unit}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-700 flex items-center justify-between">
                      <span className="text-[11px] text-stone-500 dark:text-stone-400">
                        ★ {product.rating} ({product.reviewCount} reviews)
                      </span>
                      {onAddToCart && (
                        <button
                          onClick={() => onAddToCart(product, 1)}
                          className="py-1.5 px-3 bg-emerald-800 hover:bg-emerald-900 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add to Bag</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: ORDERS (B2C Only) */}
          {!isB2B && activeTab === 'orders' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
                <div>
                  <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 font-display">Purchase & Order History</h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Track existing orders or instantly re-order your favorite grocery baskets
                  </p>
                </div>
              </div>

              {!customerAccount ? (
                <div className="p-8 bg-stone-50 dark:bg-stone-800/60 rounded-2xl border border-stone-200 dark:border-stone-700 text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 flex items-center justify-center mx-auto">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-stone-900 dark:text-stone-100 font-display">Customer Sign-In Required</h4>
                    <p className="text-xs text-stone-600 dark:text-stone-400 max-w-md mx-auto mt-1 leading-relaxed">
                      To protect customer privacy, order history is restricted exclusively to authenticated users. Please sign in to access your receipts, loyalty rewards, and delivery records.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => handleDemoLogin('sarah')}
                      className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                    >
                      Sign In as Sarah Wijaya (Gold VIP)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDemoLogin('budi')}
                      className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                    >
                      Sign In as Budi Santoso (Silver)
                    </button>
                  </div>
                </div>
              ) : myUserOrders.length === 0 ? (
                <div className="text-center py-12 bg-stone-50 dark:bg-stone-800/60 rounded-2xl border border-stone-200 dark:border-stone-700">
                  <Package className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                  <p className="text-stone-900 dark:text-stone-100 font-semibold text-sm">No Orders Placed Yet for {customerAccount.name}</p>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                    Orders you complete with QRIS payment will appear exclusively here.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <Lock className="w-3.5 h-3.5 text-emerald-800 dark:text-emerald-400" />
                      <span>Verified Orders for {customerAccount.name} ({customerAccount.email})</span>
                    </div>
                    <span className="font-mono font-bold text-emerald-800 dark:text-emerald-400">{myUserOrders.length} Private Order{myUserOrders.length > 1 ? 's' : ''}</span>
                  </div>

                  {myUserOrders.map((order, orderIdx) => {
                    const isPickup = order.deliveryMethod === 'pickup';
                    const isReady = order.status === 'ready_for_pickup' || (isPickup && order.status === 'in_transit');

                    return (
                      <div
                        key={`${order.id}-${orderIdx}`}
                        className={`p-5 rounded-2xl transition-all space-y-4 shadow-xs ${
                          isReady
                            ? 'bg-gradient-to-r from-emerald-50/60 via-white to-white dark:from-emerald-950/50 dark:via-stone-900 dark:to-stone-900 border-2 border-emerald-500/80 ring-2 ring-emerald-500/20 shadow-md'
                            : 'bg-white dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-100 dark:border-stone-700">
                          <div>
                            <div className="flex items-center gap-2 text-xs font-mono text-stone-500 dark:text-stone-400 flex-wrap">
                              <span className="font-bold text-stone-900 dark:text-stone-100">{order.id}</span>
                              <span>•</span>
                              <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                                Verified Owner
                              </span>
                              {isReady && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-700 text-white shadow-xs animate-pulse ring-2 ring-emerald-500/40">
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                                  </span>
                                  Ready for Pickup
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
                              Recipient: <span className="font-semibold text-stone-800 dark:text-stone-200">{order.customerName}</span> ({order.deliveryMethod === 'pickup' ? 'Store Pickup' : 'Express Delivery'})
                            </p>
                          </div>
                        </div>

                      <div className="flex items-center gap-2 overflow-x-auto pb-2">
                        {order.items.map((it, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 p-1.5 bg-stone-50 dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 shrink-0"
                          >
                            <SafeImage
                              src={it.product.image}
                              alt={it.product.name}
                              category={it.product.category}
                              className="w-full h-full object-cover"
                              containerClassName="w-8 h-8 rounded overflow-hidden shrink-0"
                            />
                            <div className="text-[11px] pr-1">
                              <p className="font-medium text-stone-800 dark:text-stone-200 truncate max-w-[120px]">{it.product.name}</p>
                              <p className="text-stone-400 font-mono">Qty: {it.quantity}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-stone-100 dark:border-stone-700">
                        <div>
                          <span className="text-xs text-stone-400 block">Total Settled via QRIS</span>
                          <span className="text-base font-bold text-stone-900 dark:text-stone-100 font-mono tabular-nums">
                            {formatIDR(order.total)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setTrackingSearchId(order.id);
                              setActiveTab('track');
                            }}
                            className="py-2 px-3 bg-stone-900 hover:bg-stone-800 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <Truck className="w-3.5 h-3.5 text-amber-300" />
                            <span>Live Tracker</span>
                          </button>
                          <button
                            onClick={() => {
                              setSelectedReceiptOrder(order);
                              triggerPrint({
                                type: 'b2c_receipt',
                                format: 'thermal80',
                                order,
                              });
                            }}
                            className="py-2 px-3 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Receipt</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: TRACKING (B2C Only) */}
          {!isB2B && activeTab === 'track' && (
            <div className="space-y-6">
              {!customerAccount ? (
                <div className="p-8 bg-stone-50 dark:bg-stone-800/60 rounded-2xl border border-stone-200 dark:border-stone-700 text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 flex items-center justify-center mx-auto">
                    <ShieldAlert className="w-6 h-6 text-emerald-800 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-stone-900 dark:text-stone-100 font-display">Customer Authentication Required for Live Tracking</h4>
                    <p className="text-xs text-stone-600 dark:text-stone-400 max-w-md mx-auto mt-1 leading-relaxed">
                      To safeguard customer privacy, live courier telemetry, real-time vehicle GPS coordinates, delivery destinations, and driver contact numbers are strictly isolated to verified order owners.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        handleDemoLogin('sarah');
                        setTrackingSearchId('GCM-2026-8920');
                      }}
                      className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Store className="w-3.5 h-3.5 text-amber-300" />
                      <span>Track Sarah's Store Pickup (GCM-2026-8920)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleDemoLogin('sarah');
                        setTrackingSearchId('GCM-2026-8910');
                      }}
                      className="px-4 py-2 bg-emerald-950 hover:bg-emerald-900 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                    >
                      Track Sarah's Express Delivery (GCM-2026-8910)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleDemoLogin('budi');
                        setTrackingSearchId('GCM-2026-7731');
                      }}
                      className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                    >
                      Track Budi's Order (GCM-2026-7731)
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="relative flex-1 w-full">
                      <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={trackingSearchId}
                        onChange={(e) => setTrackingSearchId(e.target.value)}
                        placeholder={`Search by your Order ID (e.g. ${myUserOrders[0]?.id || 'GCM-2026-XXXX'})...`}
                        className="w-full pl-9 pr-4 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs sm:text-sm font-mono text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-emerald-800 dark:focus:ring-emerald-500"
                      />
                    </div>

                    {/* Quick Picker: My Verified Orders Only */}
                    {myUserOrders.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-stone-400 mr-1 flex items-center gap-1">
                          <Lock className="w-3 h-3 text-emerald-800 dark:text-emerald-400" />
                          <span>My Verified Orders:</span>
                        </span>
                        {myUserOrders.map((ord, ordIdx) => {
                          const isPickup = ord.deliveryMethod === 'pickup';
                          const isReady = ord.status === 'ready_for_pickup' || (isPickup && ord.status === 'in_transit');

                          return (
                            <button
                              key={`${ord.id}-${ordIdx}`}
                              type="button"
                              onClick={() => setTrackingSearchId(ord.id)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer flex items-center gap-1.5 ${
                                trackingSearchId.toLowerCase() === ord.id.toLowerCase()
                                  ? 'bg-emerald-800 text-white font-bold shadow-xs'
                                  : isReady
                                  ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 font-semibold border border-emerald-300 dark:border-emerald-500/40'
                                  : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                              }`}
                            >
                              {isReady && (
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                                </span>
                              )}
                              <span>{ord.id} ({ord.status === 'ready_for_pickup' ? 'ready' : ord.status})</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* SECURITY PRIVACY RESTRICTION WARNING */}
                  {isUnauthorizedAttempt ? (
                    <div className="p-6 rounded-2xl bg-red-50 dark:bg-red-500/10 border-2 border-red-200 dark:border-red-500/30 text-stone-800 dark:text-stone-200 space-y-3 animate-in fade-in duration-200">
                      <div className="flex items-center gap-2.5 text-red-700 dark:text-red-400 font-bold text-sm">
                        <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
                        <span>Access Restricted: Unauthorized Live Tracking Request</span>
                      </div>
                      <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                        <strong>Security Policy Enforcement:</strong> Order <span className="font-mono font-bold text-stone-900 dark:text-stone-100">#{trackingSearchId}</span> belongs to another customer account ({searchedOrder?.customerEmail}). Live courier telemetry, GPS coordinates, recipient phone numbers, and timeline updates are strictly isolated to protect customer privacy.
                      </p>
                      <div className="pt-2 border-t border-red-200 dark:border-red-500/30 flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
                        <span>You may only view live tracking for your own orders ({customerAccount.email}).</span>
                        {myUserOrders.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setTrackingSearchId(myUserOrders[0].id)}
                            className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 hover:underline cursor-pointer"
                          >
                            View My Order #{myUserOrders[0].id} →
                          </button>
                        )}
                      </div>
                    </div>
                  ) : activeTrackedOrder ? (() => {
                    const isPickupOrder = activeTrackedOrder.deliveryMethod === 'pickup';
                    const isOrderReadyForPickup =
                      activeTrackedOrder.status === 'ready_for_pickup' ||
                      (isPickupOrder && activeTrackedOrder.status === 'in_transit');

                    return (
                      <div className="space-y-6">
                        {/* Order Header Card - Pulses vibrantly if Ready for Pickup */}
                        <div
                          className={`p-5 rounded-2xl transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                            isOrderReadyForPickup
                              ? 'border-2 border-emerald-500 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/40 dark:from-emerald-950/60 dark:via-stone-900 dark:to-teal-950/40 ring-4 ring-emerald-500/20 shadow-md animate-pulse'
                              : 'bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2 text-xs font-mono text-stone-500 dark:text-stone-400 mb-1">
                              <span>Order {activeTrackedOrder.id}</span>
                              <span>•</span>
                              <span>{new Date(activeTrackedOrder.createdAt).toLocaleDateString()}</span>
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                                Verified Owner
                              </span>
                              {isPickupOrder && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300">
                                  Store Pickup
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 font-display">
                                Live Status:
                              </h3>
                              {isOrderReadyForPickup ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-600 text-white shadow-md ring-4 ring-emerald-400/30 animate-pulse">
                                  <span className="relative flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-200 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                                  </span>
                                  READY FOR IN-STORE PICKUP
                                </span>
                              ) : (
                                <span className="text-emerald-800 dark:text-emerald-400 capitalize font-mono font-bold">
                                  {activeTrackedOrder.status}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
                              Recipient: {activeTrackedOrder.customerName} ({activeTrackedOrder.customerPhone})
                            </p>
                          </div>

                          <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
                            {activeTrackedOrder.status !== 'delivered' && (
                              <button
                                type="button"
                                onClick={() => handleSimulateNextStep(activeTrackedOrder.id, activeTrackedOrder.status)}
                                className="py-2 px-3.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                              >
                                {activeTrackedOrder.status === 'placed' && 'Simulate: Settle QRIS →'}
                                {activeTrackedOrder.status === 'paid' && 'Simulate: Start Packing →'}
                                {activeTrackedOrder.status === 'packing' && (
                                  isPickupOrder ? 'Simulate: Mark Ready for Pickup 🛍️ →' : 'Simulate: Dispatch Courier 🚚 →'
                                )}
                                {(activeTrackedOrder.status === 'ready_for_pickup' || (isPickupOrder && activeTrackedOrder.status === 'in_transit')) && (
                                  'Simulate: Hand Over to Customer ✓ →'
                                )}
                                {(!isPickupOrder && activeTrackedOrder.status === 'in_transit') && 'Simulate: Mark Delivered ✓ →'}
                              </button>
                            )}
                            {isPickupOrder && !isOrderReadyForPickup && activeTrackedOrder.status !== 'delivered' && (
                              <button
                                type="button"
                                onClick={() => {
                                  onUpdateOrderStatus(activeTrackedOrder.id, 'ready_for_pickup');
                                }}
                                className="py-2 px-3 bg-amber-500 hover:bg-amber-600 text-stone-900 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                                title="Instantly jump status to Ready for Pickup to test notification & pulse"
                              >
                                <BellRing className="w-3.5 h-3.5 text-stone-900" />
                                <span>Jump to Ready</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Real-Time Visual Pulse Animation & Staging Callout for Ready for Pickup */}
                        {isOrderReadyForPickup && (
                          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50/90 to-emerald-100/70 dark:from-emerald-950/60 dark:via-teal-950/50 dark:to-emerald-900/40 border-2 border-emerald-500/80 shadow-md ring-4 ring-emerald-500/20 animate-pulse transition-all">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <div className="w-11 h-11 rounded-xl bg-emerald-800 text-white flex items-center justify-center shrink-0 shadow-sm">
                                  <Store className="w-6 h-6 text-amber-300" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100 font-display">
                                      Fresh Groceries Ready for Pickup!
                                    </h4>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-800 text-amber-300 uppercase tracking-wider">
                                      Click &amp; Collect Staged
                                    </span>
                                  </div>
                                  <p className="text-xs text-stone-700 dark:text-stone-300 mt-1 leading-relaxed">
                                    Your items are hand-selected, temperature-packed, and stored in our walk-in chiller at <strong>{activeTrackedOrder.pickupStore?.name || 'GroceMart Senopati Flagship'}</strong> ({activeTrackedOrder.pickupStore?.address || 'Senopati, Kebayoran Baru'}).
                                  </p>
                                  <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-300 mt-1.5 flex items-center gap-1.5 flex-wrap">
                                    <span>Show Order Reference</span>
                                    <span className="font-mono bg-white dark:bg-stone-900 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-700 text-emerald-950 dark:text-emerald-200 font-bold">{activeTrackedOrder.id}</span>
                                    <span>at the Click &amp; Collect counter to receive your chilled basket.</span>
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                <button
                                  type="button"
                                  onClick={() => triggerPickupNotification(activeTrackedOrder)}
                                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-stone-900 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-stone-800 text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                                  title="Test browser notification sound and native toast"
                                >
                                  <BellRing className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 animate-bounce" />
                                  <span>Test Notification</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Courier / Vehicle info if in transit */}
                        {activeTrackedOrder.courierName && (
                          <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/40 rounded-xl border border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-emerald-800 text-white flex items-center justify-center">
                                <Truck className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="font-bold text-emerald-950 dark:text-emerald-200">{activeTrackedOrder.courierName}</p>
                                <p className="text-[11px] text-emerald-800 dark:text-emerald-400 font-mono">{activeTrackedOrder.vehiclePlate}</p>
                              </div>
                            </div>
                            <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 bg-white dark:bg-stone-900 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                              {activeTrackedOrder.estimatedArrival || 'En Route'}
                            </span>
                          </div>
                        )}

                        {/* Timeline Steps with Pulse Animation on Ready Step */}
                        <div className="space-y-3 bg-white dark:bg-stone-800/60 p-5 rounded-2xl border border-stone-200 dark:border-stone-700">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-3">
                            Order Journey &amp; Real-Time Milestones
                          </h4>
                          <div className="space-y-4">
                            {activeTrackedOrder.timeline.map((step, idx) => {
                              const isStepReadyPickup =
                                step.status === 'ready_for_pickup' ||
                                (isPickupOrder && step.status === 'in_transit');

                              return (
                                <div key={idx} className="flex items-start gap-3">
                                  <div
                                    className={`w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5 transition-all ${
                                      step.completed
                                        ? isStepReadyPickup
                                          ? 'bg-emerald-600 text-white ring-4 ring-emerald-400/40 animate-pulse'
                                          : 'bg-emerald-800 text-white'
                                        : 'bg-stone-200 dark:bg-stone-700 text-stone-500 dark:text-stone-400'
                                    }`}
                                  >
                                    {step.completed ? '✓' : idx + 1}
                                  </div>
                                  <div className="min-w-0">
                                    <p className={`text-xs font-bold ${isStepReadyPickup && step.completed ? 'text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5' : 'text-stone-900 dark:text-stone-100'}`}>
                                      <span>{step.label}</span>
                                      {isStepReadyPickup && step.completed && (
                                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 uppercase font-mono">
                                          Ready
                                        </span>
                                      )}
                                    </p>
                                    <p className="text-[11px] text-stone-500 dark:text-stone-400">{step.description}</p>
                                    <span className="text-[10px] font-mono text-stone-400">{step.timestamp}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })() : (
                <div className="text-center py-12 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700">
                  <Package className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                  <p className="text-stone-900 dark:text-stone-100 font-semibold text-sm">No Personal Orders Found</p>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                    Please place an order or select your verified customer order above.
                  </p>
                </div>
              )}
                </>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 1 (B2B): B2B Wholesale Trade Credit & Bilyet Giro Facility */}
          {/* ========================================================================= */}
          {isB2B && activeTab === 'b2b_credit' && (
            <div className="p-6 space-y-6">
              {/* Account Selector Strip */}
              {b2bCustomers.length > 0 && onSelectB2bCustomerId && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-stone-100 dark:bg-stone-800/70 border border-stone-200 dark:border-stone-700 text-xs">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-indigo-700 dark:text-indigo-400 shrink-0" />
                    <span className="font-semibold text-stone-700 dark:text-stone-300">Active Wholesale Account:</span>
                  </div>
                  <select
                    value={selectedB2bCustomerId}
                    onChange={(e) => onSelectB2bCustomerId(e.target.value)}
                    className="bg-white dark:bg-stone-900 px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 font-bold text-stone-900 dark:text-stone-100 focus:outline-none cursor-pointer"
                  >
                    {b2bCustomers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.companyName} ({c.tierLabel}) {c.status === 'CREDIT_LOCKED' ? '⚠️ [LOCKED]' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {currentB2bCustomer ? (
                <div className="space-y-6">
                  {/* Credit Status KPI Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/60 space-y-1">
                      <span className="text-xs text-stone-500 dark:text-stone-400">Plafond Kredit Resmi</span>
                      <div className="text-xl font-bold font-mono text-stone-900 dark:text-stone-100">
                        {formatIDR(currentB2bCustomer.creditLimit)}
                      </div>
                      <span className="text-[10px] text-indigo-700 dark:text-indigo-400 font-semibold block">
                        Disetujui Divisi Finance &amp; AR (Tier: {currentB2bCustomer.tierLabel})
                      </span>
                    </div>

                    <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/60 space-y-1">
                      <span className="text-xs text-stone-500 dark:text-stone-400">Sisa Saldo Kredit Tersedia</span>
                      <div className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
                        {formatIDR(currentB2bCustomer.availableCredit)}
                      </div>
                      <div className="w-full bg-stone-200 dark:bg-stone-700 h-1.5 rounded-full mt-1.5 overflow-hidden">
                        <div
                          className="bg-emerald-600 h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(0, (currentB2bCustomer.availableCredit / currentB2bCustomer.creditLimit) * 100)
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div
                      className={`p-4 rounded-xl border space-y-1 ${
                        currentB2bCustomer.status === 'CREDIT_LOCKED' || currentB2bCustomer.overdueDaysMax > 0
                          ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500/30 text-rose-950 dark:text-rose-200'
                          : 'bg-stone-50 dark:bg-stone-800/60 border-stone-200 dark:border-stone-700'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-stone-500 dark:text-stone-400">Total Piutang (AR)</span>
                        {currentB2bCustomer.status === 'CREDIT_LOCKED' && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-600 text-white uppercase">
                            Locked
                          </span>
                        )}
                      </div>
                      <div className="text-xl font-bold font-mono text-stone-900 dark:text-stone-100">
                        {formatIDR(currentB2bCustomer.outstandingAR)}
                      </div>
                      {currentB2bCustomer.overdueDaysMax > 0 ? (
                        <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span>{currentB2bCustomer.overdueDaysMax} hari lewat tempo (&gt;7d auto-lock)</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Good Standing (0 hari overdue)</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Auto-Credit Lock Warning Banner */}
                  {(currentB2bCustomer.status === 'CREDIT_LOCKED' || currentB2bCustomer.overdueDaysMax > 7) && (
                    <div className="p-4 rounded-xl bg-amber-500/15 border border-amber-500/40 text-xs text-amber-950 dark:text-amber-200 flex items-start gap-2.5">
                      <ShieldAlert className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-sm">Fasilitas Kredit Dibekukan Sementara (Auto-Credit Lock)</div>
                        <p className="mt-1 leading-relaxed">
                          {currentB2bCustomer.lockReason ||
                            'Pelanggan memiliki tagihan yang telah lewat jatuh tempo > 7 hari atau telah mencapai batas limit kredit. Opsi pembayaran Term dan Bilyet Giro dinonaktifkan hingga saldo tunggakan diselesaikan.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Bilyet Giro Clearing Register */}
                  <div className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 overflow-hidden shadow-xs">
                    <div className="p-4 bg-stone-50 dark:bg-stone-800/70 border-b border-stone-200 dark:border-stone-700 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-700 dark:text-indigo-400" />
                        <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wider">
                          Register Warkat Bilyet Giro / Post-Dated Check (PDC)
                        </h4>
                      </div>
                      <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 font-mono">
                        {giroRecords.length} warkat terdaftar
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-stone-100/70 dark:bg-stone-800 border-b border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 font-semibold uppercase text-[10px]">
                          <tr>
                            <th className="py-2.5 px-3">Nomor Giro &amp; Bank</th>
                            <th className="py-2.5 px-3">Tgl Jatuh Tempo</th>
                            <th className="py-2.5 px-3">Nilai Giro</th>
                            <th className="py-2.5 px-3">Status Kliring</th>
                            <th className="py-2.5 px-3 text-right">Status &amp; Referensi Warkat</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                          {giroRecords.map((giro) => (
                            <tr key={giro.id} className="hover:bg-stone-50/60 dark:hover:bg-stone-800/50 transition-colors">
                              <td className="py-3 px-3">
                                <div className="font-bold font-mono text-stone-900 dark:text-stone-100">{giro.giroNumber}</div>
                                <div className="text-[11px] text-stone-500 dark:text-stone-400">{giro.issuingBank}</div>
                              </td>
                              <td className="py-3 px-3 font-mono text-stone-700 dark:text-stone-300">
                                {giro.clearingDueDate}
                              </td>
                              <td className="py-3 px-3 font-mono font-bold text-emerald-800 dark:text-emerald-400">
                                {formatIDR(giro.amountIDR)}
                              </td>
                              <td className="py-3 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    giro.status === 'CLEARED'
                                      ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                                      : giro.status === 'BOUNCED'
                                      ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300'
                                      : 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300'
                                  }`}
                                >
                                  {giro.status}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right">
                                <div className="inline-flex items-center justify-end gap-2 flex-wrap">
                                  {giro.status === 'CLEARED' && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                                      GL #1020 Matched
                                    </span>
                                  )}
                                  {giro.status === 'PENDING_CLEARING' && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-medium font-mono bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                                      Awaiting Bank Clearing
                                    </span>
                                  )}
                                  {giro.status === 'BOUNCED' && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-rose-100 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30">
                                      Bounced - Credit Frozen
                                    </span>
                                  )}
                                  {giro.slipPhotoUrl && (
                                    <button
                                      type="button"
                                      onClick={() => setViewingGiroSlip(giro)}
                                      className="px-2 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 text-[11px] font-semibold border border-stone-200 dark:border-stone-700 flex items-center gap-1 cursor-pointer transition-colors"
                                      title="Lihat foto bukti fisik warkat bilyet giro"
                                    >
                                      <Eye className="w-3 h-3 text-stone-500 dark:text-stone-400" />
                                      <span>View Slip</span>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* RBAC Segregation of Duties Banner */}
                    <div className="p-3 bg-stone-50/90 dark:bg-stone-800/80 border-t border-stone-200 dark:border-stone-700 text-[11px] text-stone-600 dark:text-stone-300 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                      <span>
                        <strong>Segregasi Tugas Internal (SoD):</strong> Pelanggan B2B memiliki akses <em>Read &amp; Submit Only</em> untuk register warkat giro. Otorisasi pencairan kliring bank (COA #1020) atau penerbitan tolakan warkat secara resmi dikelola oleh Divisi Financial Controller di <strong>Accounting Suite ERP Admin</strong>.
                      </span>
                    </div>
                  </div>

                  {/* Policy Explanation */}
                  <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-500/10 border border-indigo-200/80 dark:border-indigo-500/30 text-xs text-indigo-950 dark:text-indigo-200 space-y-1.5">
                    <div className="font-bold flex items-center gap-1.5 text-indigo-900 dark:text-indigo-300">
                      <ShieldCheck className="w-4 h-4 text-indigo-700 dark:text-indigo-400" />
                      <span>GroceMatrix™ Wholesale Credit Policy &amp; General Ledger Integration</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-indigo-900/80 dark:text-indigo-200/80">
                      Warkat Bilyet Giro dicatat pada COA #1210 (Giro Clearing Receivable). Pada saat kliring dinyatakan berhasil oleh bank, sistem secara otomatis mendebit BCA Escrow (#1020), mengkredit #1210, dan membebaskan sisa limit kredit pelanggan.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-stone-500 dark:text-stone-400">
                  Data akun wholesale tidak ditemukan.
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2 (B2B): B2B Wholesale Bulk Orders & Invoices */}
          {/* ========================================================================= */}
          {isB2B && activeTab === 'b2b_orders' && (
            <div className="p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">Riwayat Pesanan Grosir (B2B Bulk Orders)</h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">Daftar faktur pemesanan multi-tier UoM dan status termin kredit</p>
                </div>
                <div className="relative sm:w-64">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={b2bOrderSearch}
                    onChange={(e) => setB2bOrderSearch(e.target.value)}
                    placeholder="Cari nomor faktur / B2B-ORD..."
                    className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>

              <div className="space-y-4">
                {b2bOrders
                  .filter((ord) => !b2bOrderSearch || ord.id.toLowerCase().includes(b2bOrderSearch.toLowerCase()))
                  .map((ord) => (
                    <div
                      key={ord.id}
                      className="p-4 sm:p-5 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800/60 hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-all shadow-xs space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-100 dark:border-stone-700">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-indigo-700 dark:text-indigo-400">
                            {ord.id}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              ord.status === 'CONFIRMED' || ord.status === 'DELIVERED'
                                ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                                : ord.status === 'PENDING_FINANCE'
                                ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300'
                                : 'bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300'
                            }`}
                          >
                            {ord.status}
                          </span>
                          <span className="text-[11px] text-stone-500 dark:text-stone-400">
                            {new Date(ord.orderDate).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveB2bReceiptOrder(ord)}
                            className="px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
                            <span>Cetak Faktur</span>
                          </button>
                        </div>
                      </div>

                      {/* Items Multi-Tier Breakdown */}
                      <div className="space-y-1.5 text-xs">
                        {ord.items.map((it, idx) => (
                          <div key={idx} className="flex items-center justify-between py-1 border-b border-stone-50 dark:border-stone-700/60">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-stone-900 dark:text-stone-100">{it.product.name}</span>
                              <span className="px-1.5 py-0.2 rounded bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 text-[10px] font-mono">
                                {it.quantity} {it.selectedUoM} ({it.baseUnitsCalculated} base units)
                              </span>
                            </div>
                            <span className="font-mono font-bold text-stone-800 dark:text-stone-200">
                              {formatIDR(it.lineTotal)}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-2 text-xs">
                        <div className="flex items-center gap-2 text-stone-500 dark:text-stone-400">
                          <CreditCard className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-400" />
                          <span>Metode: <strong className="text-stone-800 dark:text-stone-200 uppercase">{ord.paymentMethod.replace(/_/g, ' ')}</strong></span>
                          {ord.approvalRequestId && (
                            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300">
                              Approval ID: {ord.approvalRequestId}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-stone-500 dark:text-stone-400">Total Faktur:</span>
                          <span className="text-base font-extrabold font-mono text-emerald-800 dark:text-emerald-400">
                            {formatIDR(ord.totalAmountIDR)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3 (B2B): Company & Credit Profile */}
          {/* ========================================================================= */}
          {isB2B && activeTab === 'b2b_profile' && currentB2bCustomer && (
            <div className="p-6 space-y-6">
              {/* Company Profile Header Card */}
              <div className="p-5 sm:p-6 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800/60 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-100 dark:border-stone-700">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-900 text-amber-300 font-bold text-lg flex items-center justify-center shadow-xs shrink-0">
                      {currentB2bCustomer.companyName.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100">
                          {currentB2bCustomer.companyName}
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 dark:bg-indigo-500/20 text-indigo-800 dark:text-indigo-300">
                          {currentB2bCustomer.tierLabel || currentB2bCustomer.tier}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            currentB2bCustomer.status === 'ACTIVE'
                              ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                              : 'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300'
                          }`}
                        >
                          {currentB2bCustomer.status}
                        </span>
                      </div>
                      <p className="text-xs text-stone-500 dark:text-stone-400 font-mono mt-0.5">
                        Account ID: {currentB2bCustomer.id} · Terdaftar sejak 2023
                      </p>
                    </div>
                  </div>

                  {/* B2B Customer Selector Dropdown */}
                  {b2bCustomers.length > 1 && onSelectB2bCustomerId && (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-stone-500 dark:text-stone-400 hidden sm:inline">Ganti Akun:</span>
                      <select
                        value={selectedB2bCustomerId}
                        onChange={(e) => onSelectB2bCustomerId(e.target.value)}
                        className="text-xs font-semibold py-1.5 px-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-indigo-600 cursor-pointer"
                      >
                        {b2bCustomers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.companyName} ({c.tier})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Grid: Legal & Entity Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-900/70 border border-stone-200 dark:border-stone-700 space-y-2.5">
                    <h4 className="font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-indigo-700 dark:text-indigo-400" />
                      <span>Informasi Legalitas &amp; Pajak (Tax / e-Faktur)</span>
                    </h4>
                    <div className="space-y-1.5 text-stone-700 dark:text-stone-300">
                      <div className="flex justify-between py-1 border-b border-stone-200/60 dark:border-stone-700/60">
                        <span className="text-stone-500 dark:text-stone-400">Nama Badan Usaha:</span>
                        <span className="font-semibold text-stone-900 dark:text-stone-100">{currentB2bCustomer.companyName}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-stone-200/60 dark:border-stone-700/60">
                        <span className="text-stone-500 dark:text-stone-400">NPWP Perusahaan (16 Digit):</span>
                        <span className="font-mono font-bold text-indigo-900 dark:text-indigo-300">{currentB2bCustomer.npwp || '01.345.678.9-012.000'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-stone-200/60 dark:border-stone-700/60">
                        <span className="text-stone-500 dark:text-stone-400">Alamat Faktur Pajak:</span>
                        <span className="text-right max-w-xs">{currentB2bCustomer.address}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-stone-500 dark:text-stone-400">Status Validasi e-Faktur DJP:</span>
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Terverifikasi DJP
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-900/70 border border-stone-200 dark:border-stone-700 space-y-2.5">
                    <h4 className="font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                      <User className="w-4 h-4 text-indigo-700 dark:text-indigo-400" />
                      <span>Kontak PIC &amp; Assigned Key Account Manager</span>
                    </h4>
                    <div className="space-y-1.5 text-stone-700 dark:text-stone-300">
                      <div className="flex justify-between py-1 border-b border-stone-200/60 dark:border-stone-700/60">
                        <span className="text-stone-500 dark:text-stone-400">PIC Pembelian (Buyer):</span>
                        <span className="font-semibold text-stone-900 dark:text-stone-100">{currentB2bCustomer.contactPerson}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-stone-200/60 dark:border-stone-700/60">
                        <span className="text-stone-500 dark:text-stone-400">Nomor Telepon / WhatsApp:</span>
                        <span className="font-mono">{currentB2bCustomer.phone}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-stone-200/60 dark:border-stone-700/60">
                        <span className="text-stone-500 dark:text-stone-400">Email Faktur &amp; Tagihan:</span>
                        <span className="font-mono">{currentB2bCustomer.email}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-stone-500 dark:text-stone-400">Key Account Manager (KAM):</span>
                        <span className="font-semibold text-stone-900 dark:text-stone-100">Hendro Kusumo (Senior Wholesale KAM)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Allowed Payment Terms Badges */}
                <div className="pt-2">
                  <span className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-2">
                    Fasilitas Metode Pembayaran yang Diizinkan (Approved Credit Terms):
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {currentB2bCustomer.paymentTermsAllowed.map((term) => (
                      <span
                        key={term}
                        className="px-3 py-1 rounded-lg text-xs font-mono font-bold bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-500/30 text-indigo-900 dark:text-indigo-300 uppercase"
                      >
                        ✓ {term.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Interactive Request Credit Limit Increase Form */}
              <div className="p-5 sm:p-6 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800/60 shadow-xs space-y-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-stone-100 dark:border-stone-700">
                  <TrendingUp className="w-5 h-5 text-indigo-700 dark:text-indigo-400" />
                  <div>
                    <h4 className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100">
                      Pengajuan Kenaikan Plafond Kredit (Credit Limit Increase)
                    </h4>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      Ajukan penambahan limit fasilitas belanja tempo untuk mendukung lonjakan volume usaha Anda.
                    </p>
                  </div>
                </div>

                {creditLimitSuccessMsg ? (
                  <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-bold">Pengajuan Berhasil Dikirimkan!</div>
                      <p>{creditLimitSuccessMsg}</p>
                      <button
                        type="button"
                        onClick={() => setCreditLimitSuccessMsg(null)}
                        className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 underline mt-1 cursor-pointer"
                      >
                        Buat Pengajuan Lain
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleCreditIncreaseSubmit} className="space-y-4 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-stone-600 dark:text-stone-400 font-semibold mb-1">
                          Plafond Kredit Saat Ini (Current Limit):
                        </label>
                        <input
                          type="text"
                          disabled
                          value={formatIDR(currentB2bCustomer.creditLimit)}
                          className="w-full px-3 py-2 rounded-xl bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 font-mono font-bold text-stone-800 dark:text-stone-300"
                        />
                      </div>
                      <div>
                        <label className="block text-stone-600 dark:text-stone-400 font-semibold mb-1">
                          Plafond Baru yang Diajukan (Requested Limit IDR):
                        </label>
                        <input
                          type="number"
                          step="5000000"
                          min={currentB2bCustomer.creditLimit + 5000000}
                          value={requestedLimit}
                          onChange={(e) => setRequestedLimit(Number(e.target.value))}
                          placeholder="cth. 150000000"
                          required
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 font-mono font-bold text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-stone-600 dark:text-stone-400 font-semibold mb-1">
                          Alasan Pengajuan Tambahan Limit:
                        </label>
                        <select
                          value={creditIncreaseReason}
                          onChange={(e) => setCreditIncreaseReason(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-indigo-600 cursor-pointer"
                        >
                          <option value="Persiapan Stok Menjelang Peak Season (Ramadan/Idul Fitri/Tahun Baru)">
                            Persiapan Stok Menjelang Peak Season (Ramadan/Idul Fitri/Tahun Baru)
                          </option>
                          <option value="Ekspansi Cabang Baru / Gerai Tambahan">
                            Ekspansi Cabang Baru / Gerai Tambahan
                          </option>
                          <option value="Peningkatan Omzet &amp; Kontrak Katering / HoReCa">
                            Peningkatan Omzet &amp; Kontrak Katering / HoReCa
                          </option>
                          <option value="Kebutuhan Pasokan Rutin Volume Besar (Pallet Order)">
                            Kebutuhan Pasokan Rutin Volume Besar (Pallet Order)
                          </option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-stone-600 dark:text-stone-400 font-semibold mb-1">
                          Lampiran Dokumen Finansial Pendukung:
                        </label>
                        <div className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-dashed border-stone-300 dark:border-stone-700 text-stone-500 dark:text-stone-400 flex items-center justify-between">
                          <span className="truncate">Rekening Koran 3 Bln / Laporan Keuangan</span>
                          <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/20 px-2 py-0.5 rounded">
                            Lampirkan
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        className="px-5 py-2.5 rounded-xl bg-indigo-900 hover:bg-indigo-800 text-white font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center gap-2"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Kirim Permohonan ke Komite Kredit</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* Printable B2B Receipt Modal */}
          {activeB2bReceiptOrder && typeof document !== 'undefined' && createPortal(
            <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 dark:border-stone-800 space-y-4 max-h-[90vh] my-auto overflow-y-auto">
                <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
                  <div>
                    <h3 className="font-bold text-base text-stone-900 dark:text-stone-100">FAKTUR PENJUALAN GROSIR</h3>
                    <p className="text-xs text-stone-500 dark:text-stone-400 font-mono">{activeB2bReceiptOrder.id}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveB2bReceiptOrder(null)}
                    className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="text-xs space-y-1.5 p-3 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300">
                  <div className="flex justify-between">
                    <span className="text-stone-500 dark:text-stone-400">Pelanggan:</span>
                    <span className="font-bold text-stone-900 dark:text-stone-100">{activeB2bReceiptOrder.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500 dark:text-stone-400">Metode Bayar:</span>
                    <span className="font-mono font-semibold uppercase">{activeB2bReceiptOrder.paymentMethod.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500 dark:text-stone-400">Tgl Order:</span>
                    <span className="font-mono">{new Date(activeB2bReceiptOrder.orderDate).toLocaleString()}</span>
                  </div>
                </div>

                <div className="space-y-2 border-y border-stone-200 dark:border-stone-800 py-3 text-xs">
                  {activeB2bReceiptOrder.items.map((it, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <div>
                        <div className="font-semibold text-stone-900 dark:text-stone-100">{it.product.name}</div>
                        <div className="text-[11px] text-stone-500 dark:text-stone-400 font-mono">
                          {it.quantity} {it.selectedUoM} ({it.baseUnitsCalculated} base units)
                        </div>
                      </div>
                      <span className="font-mono font-bold text-stone-800 dark:text-stone-200">{formatIDR(it.lineTotal)}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5 text-xs text-stone-700 dark:text-stone-300">
                  <div className="flex justify-between">
                    <span className="text-stone-500 dark:text-stone-400">Subtotal:</span>
                    <span className="font-mono font-semibold">{formatIDR(activeB2bReceiptOrder.subtotalIDR)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500 dark:text-stone-400">PPN (11%):</span>
                    <span className="font-mono font-semibold">{formatIDR(activeB2bReceiptOrder.taxPPN11IDR)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold pt-2 border-t border-stone-200 dark:border-stone-800 text-emerald-800 dark:text-emerald-400">
                    <span>Total Pembayaran:</span>
                    <span className="font-mono">{formatIDR(activeB2bReceiptOrder.totalAmountIDR)}</span>
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      triggerPrint({
                        type: 'b2b_invoice',
                        format: 'a4',
                        order: activeB2bReceiptOrder,
                      })
                    }
                    className="px-4 py-2 border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Cetak Faktur</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveB2bReceiptOrder(null)}
                    className="px-4 py-2 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Tutup Faktur
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}

          {/* Viewing Bilyet Giro Physical Slip Modal */}
          {viewingGiroSlip && typeof document !== 'undefined' && createPortal(
            <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 dark:border-stone-800 space-y-4 my-auto animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-indigo-700 dark:text-indigo-400" />
                    <div>
                      <h3 className="font-bold text-sm text-stone-900 dark:text-stone-100">Bukti Fisik Warkat Bilyet Giro</h3>
                      <p className="text-[11px] font-mono text-stone-500 dark:text-stone-400">{viewingGiroSlip.giroNumber}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewingGiroSlip(null)}
                    className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-stone-500 dark:text-stone-400">Bank Penerbit:</span>
                      <span className="font-bold text-stone-900 dark:text-stone-100">{viewingGiroSlip.issuingBank}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500 dark:text-stone-400">Tgl Jatuh Tempo:</span>
                      <span className="font-mono font-bold text-stone-900 dark:text-stone-100">{viewingGiroSlip.clearingDueDate}</span>
                    </div>
                    <div className="flex justify-between text-sm pt-1 border-t border-stone-200 dark:border-stone-700">
                      <span className="text-stone-600 dark:text-stone-300 font-semibold">Nominal Warkat:</span>
                      <span className="font-mono font-extrabold text-emerald-800 dark:text-emerald-400">{formatIDR(viewingGiroSlip.amountIDR)}</span>
                    </div>
                  </div>

                  {viewingGiroSlip.slipPhotoUrl && (
                    <div className="space-y-1">
                      <span className="text-[11px] text-stone-500 dark:text-stone-400 font-medium block">Foto Warkat Giro:</span>
                      <img
                        src={viewingGiroSlip.slipPhotoUrl}
                        alt={viewingGiroSlip.giroNumber}
                        className="w-full h-48 object-cover rounded-xl border border-stone-200 dark:border-stone-700 shadow-inner"
                      />
                    </div>
                  )}
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      triggerPrint({
                        type: 'bilyet_giro_slip',
                        format: 'a4',
                        giro: viewingGiroSlip,
                      })
                    }
                    className="flex-1 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Cetak Slip</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewingGiroSlip(null)}
                    className="flex-1 py-2.5 rounded-xl bg-stone-900 dark:bg-stone-100 hover:bg-stone-800 dark:hover:bg-white text-white dark:text-stone-900 text-xs font-bold cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}

        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(portalModal, document.body) : portalModal;
};