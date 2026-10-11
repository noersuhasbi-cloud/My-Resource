import React, { useState, useMemo } from 'react';
import { CustomerAccount, Order, OrderStatus, Product } from '../types';
import { PRODUCTS } from '../data/mockData';
import { formatIDR } from '../utils/formatters';
import {
  User, Package, Truck, CheckCircle2,
  Search, Plus, Printer,
  Sparkles, X, TrendingUp, Award, Database, LogOut
} from 'lucide-react';
import { loginWithGoogle } from '../services/firebaseService';
import { SafeImage } from './SafeImage';

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
}) => {
  const [activeTab, setActiveTab] = useState<'track' | 'orders' | 'profile' | 'suggestions'>(
    initialTrackingOrderId ? 'track' : customerAccount ? 'profile' : 'profile'
  );

  const [trackingSearchId, setTrackingSearchId] = useState<string>(
    initialTrackingOrderId || (orders.length > 0 ? orders[0].id : '')
  );
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<Order | null>(null);

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

  if (!isOpen) return null;

  const activeTrackedOrder = orders.find(
    (o) => o.id.toLowerCase() === trackingSearchId.toLowerCase().trim()
  ) || (orders.length > 0 ? orders[0] : null);

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
      setFirebaseError(err.message || 'Failed to sign in with Google');
    } finally {
      setIsFirebaseLoading(false);
    }
  };

  const handleDemoLogin = () => {
    const demoAccount: CustomerAccount = {
      id: 'cust-sarah-8821',
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
    onLogin(demoAccount);
    setActiveTab('profile');
  };

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const account: CustomerAccount = {
      id: `cust-${Date.now().toString().slice(-4)}`,
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
      id: `addr-${Date.now()}`,
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
    if (currentStatus === 'placed') next = 'paid';
    else if (currentStatus === 'paid') next = 'packing';
    else if (currentStatus === 'packing') next = 'in_transit';
    else if (currentStatus === 'in_transit') next = 'delivered';
    else if (currentStatus === 'delivered') return;
    onUpdateOrderStatus(orderId, next);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-stone-200 overflow-hidden relative max-h-[92vh] flex flex-col">
        
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-800 text-amber-300 flex items-center justify-center font-bold text-sm shadow-xs">
              G
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-stone-900 font-display">
                  GroceMart Customer Portal
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                  <Database className="w-3 h-3" />
                  <span>Firestore Synced</span>
                </span>
              </div>
              <p className="text-xs text-stone-500">
                Personalized Hub Tier Progress & Live Order Tracking
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Portal Nav Tabs */}
        <div className="px-6 pt-3 border-b border-stone-200 flex items-center justify-between gap-4 overflow-x-auto bg-white">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setActiveTab('profile')}
              className={`pb-3 text-xs sm:text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 cursor-pointer ${
                activeTab === 'profile'
                  ? 'border-emerald-800 text-emerald-800'
                  : 'border-transparent text-stone-500 hover:text-stone-900'
              }`}
            >
              <User className="w-4 h-4" />
              <span>{customerAccount ? `${customerAccount.name.split(' ')[0]}'s Profile` : 'Sign In / Account'}</span>
            </button>
            <button
              onClick={() => setActiveTab('suggestions')}
              className={`pb-3 text-xs sm:text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 cursor-pointer ${
                activeTab === 'suggestions'
                  ? 'border-emerald-800 text-emerald-800'
                  : 'border-transparent text-stone-500 hover:text-stone-900'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Recommended For You</span>
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`pb-3 text-xs sm:text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 cursor-pointer ${
                activeTab === 'orders'
                  ? 'border-emerald-800 text-emerald-800'
                  : 'border-transparent text-stone-500 hover:text-stone-900'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Orders ({orders.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('track')}
              className={`pb-3 text-xs sm:text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 cursor-pointer ${
                activeTab === 'track'
                  ? 'border-emerald-800 text-emerald-800'
                  : 'border-transparent text-stone-500 hover:text-stone-900'
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>Track Orders</span>
            </button>
          </div>
          {customerAccount && (
            <button
              onClick={onLogout}
              className="pb-3 text-xs font-medium text-stone-400 hover:text-red-600 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
          
          {/* TAB 1: PROFILE & TIER PROGRESS */}
          {activeTab === 'profile' && (
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

                  <div className="p-6 bg-stone-50 rounded-2xl border border-stone-200 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-emerald-800" />
                          <h4 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
                            Loyalty Tier Status & Next Milestone
                          </h4>
                        </div>
                        <p className="text-xs text-stone-500 mt-0.5">
                          {tierProgress.isMax
                            ? "You have reached the premier GroceMart Platinum VIP status!"
                            : `Earn ${tierProgress.pointsNeeded.toLocaleString()} more points to unlock ${tierProgress.nextTier}`}
                        </p>
                      </div>
                      <div className="px-3 py-1.5 bg-white rounded-lg border border-stone-200 text-xs font-mono font-bold text-emerald-950 self-start sm:self-auto tabular-nums">
                        {customerAccount.grocePoints.toLocaleString()} / {tierProgress.targetPoints.toLocaleString()} pts ({tierProgress.percentage}%)
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="w-full bg-stone-200 h-3.5 rounded-full overflow-hidden p-0.5">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-600 via-amber-400 to-amber-500 transition-all duration-700 shadow-xs"
                          style={{ width: `${tierProgress.percentage}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-stone-500 font-medium">
                        <span>{tierProgress.currentTier} ({tierProgress.basePoints} pts)</span>
                        <span>{tierProgress.nextTier} ({tierProgress.targetPoints} pts)</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-stone-200">
                      <p className="text-xs font-bold text-stone-700 mb-2">
                        {tierProgress.isMax ? 'Active Platinum Perks:' : `Unlocked with ${tierProgress.nextTier}:`}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {tierProgress.perks.map((perk, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-stone-700 bg-white p-2 rounded-lg border border-stone-200/80">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-800 shrink-0" />
                            <span className="truncate">{perk}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                        Saved Delivery Destinations ({customerAccount.savedAddresses.length})
                      </h4>
                      <button
                        onClick={() => setIsAddingAddress(!isAddingAddress)}
                        className="text-xs font-semibold text-emerald-800 hover:text-emerald-900 flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add New Address</span>
                      </button>
                    </div>

                    {isAddingAddress && (
                      <form onSubmit={handleSaveNewAddress} className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
                        <h5 className="text-xs font-bold text-stone-800">Add New Destination</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input
                            type="text"
                            placeholder="Address Label (e.g. Home, Office)"
                            value={newAddrLabel}
                            onChange={(e) => setNewAddrLabel(e.target.value)}
                            required
                            className="px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs"
                          />
                          <input
                            type="text"
                            placeholder="Recipient Name"
                            value={newAddrRecipient}
                            onChange={(e) => setNewAddrRecipient(e.target.value)}
                            className="px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs"
                          />
                          <div className="sm:col-span-2">
                            <input
                              type="text"
                              placeholder="Complete Street Address & Unit"
                              value={newAddrLine}
                              onChange={(e) => setNewAddrLine(e.target.value)}
                              required
                              className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setIsAddingAddress(false)}
                            className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-200 rounded-lg"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-4 py-1.5 text-xs font-semibold bg-emerald-800 text-white rounded-lg"
                          >
                            Save Address
                          </button>
                        </div>
                      </form>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {customerAccount.savedAddresses.map((addr) => (
                        <div key={addr.id} className="p-4 bg-stone-50 rounded-xl border border-stone-200 relative text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-stone-900">{addr.label}</span>
                            {addr.isDefault && (
                              <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="text-stone-700">{addr.recipient} ({addr.phone})</p>
                          <p className="text-stone-500">{addr.addressLine}, {addr.city}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="max-w-md mx-auto space-y-6">
                  <div className="p-5 bg-stone-50 rounded-2xl border border-stone-200 text-center space-y-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                      <Database className="w-5 h-5 text-emerald-800" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-stone-900">Sign In with Your Google Account</h4>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Seamlessly syncs your orders, rewards points, and addresses in Firebase Firestore
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleGoogleSignin}
                      disabled={isFirebaseLoading}
                      className="w-full py-2.5 px-4 bg-white hover:bg-stone-100 border border-stone-300 text-stone-900 text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                      <span>{isFirebaseLoading ? 'Connecting to Firebase...' : 'Continue with Google Account'}</span>
                    </button>
                    {firebaseError && <p className="text-[11px] text-red-600 mt-1">{firebaseError}</p>}

                    <div className="relative pt-2">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-stone-200" />
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="bg-stone-50 px-2 text-stone-400">or</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleDemoLogin}
                      className="w-full py-2 px-4 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <User className="w-3.5 h-3.5 text-amber-300" />
                      <span>Instant Demo Account (Sarah Wijaya Gold)</span>
                    </button>
                  </div>

                  <div className="p-5 bg-stone-50 rounded-2xl border border-stone-200 space-y-4">
                    <div className="text-center">
                      <h3 className="text-base font-bold text-stone-900 font-display">
                        {authMode === 'signin' ? 'Email Sign In' : 'Create Customer Account'}
                      </h3>
                    </div>
                    <form onSubmit={handleAuthSubmit} className="space-y-3.5">
                      <div>
                        <label className="text-xs font-medium text-stone-600 block mb-1">Email Address</label>
                        <input
                          type="email"
                          required
                          value={authEmail}
                          onChange={(e) => setAuthEmail(e.target.value)}
                          placeholder="you@domain.com"
                          className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-stone-600 block mb-1">Password</label>
                        <input
                          type="password"
                          required
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full py-2.5 px-4 bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                      >
                        Sign in with Email
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SUGGESTIONS */}
          {activeTab === 'suggestions' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-stone-200">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>AI & Order-Informed Personalization</span>
                  </div>
                  <h3 className="text-lg font-bold text-stone-900 font-display">
                    Recommended For You Based on Your Purchase History
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Curated fresh picks tailored from your frequently ordered aisles
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {suggestedProducts.map(({ product, reason }) => (
                  <div
                    key={product.id}
                    className="p-4 bg-white rounded-2xl border border-stone-200 hover:border-emerald-800/40 hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        <SafeImage
                          src={product.image}
                          alt={product.name}
                          category={product.category}
                          className="w-full h-full object-cover"
                          containerClassName="w-20 h-20 rounded-xl overflow-hidden bg-stone-100 shrink-0"
                        />
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide block truncate">
                            {reason}
                          </span>
                          <h4 className="text-sm font-bold text-stone-900 truncate mt-0.5">{product.name}</h4>
                          <p className="text-[11px] text-stone-500 truncate">{product.origin}</p>
                          <p className="text-sm font-mono font-bold text-emerald-950 mt-1 tabular-nums">
                            {formatIDR(product.price)} <span className="text-[10px] font-normal text-stone-400">/ {product.unit}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between">
                      <span className="text-[11px] text-stone-500">
                        ★ {product.rating} ({product.reviewCount} reviews)
                      </span>
                      {onAddToCart && (
                        <button
                          onClick={() => onAddToCart(product, 1)}
                          className="py-1.5 px-3 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
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

          {/* TAB 3: ORDERS */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-stone-200">
                <div>
                  <h3 className="text-lg font-bold text-stone-900 font-display">Purchase & Order History</h3>
                  <p className="text-xs text-stone-500">
                    Track existing orders or instantly re-order your favorite grocery baskets
                  </p>
                </div>
              </div>

              {orders.length === 0 ? (
                <div className="text-center py-12 bg-stone-50 rounded-2xl border border-stone-200">
                  <Package className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                  <p className="text-stone-900 font-semibold text-sm">No Orders Placed Yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="p-5 bg-white rounded-2xl border border-stone-200 hover:border-stone-300 transition-all space-y-4 shadow-xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-100">
                        <div>
                          <div className="flex items-center gap-2 text-xs font-mono text-stone-500">
                            <span>{order.id}</span>
                            <span>•</span>
                            <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                          </div>
                          <p className="text-xs text-stone-600 mt-0.5">
                            Recipient: <span className="font-semibold text-stone-800">{order.customerName}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 overflow-x-auto pb-2">
                        {order.items.map((it, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 p-1.5 bg-stone-50 rounded-lg border border-stone-200 shrink-0"
                          >
                            <SafeImage
                              src={it.product.image}
                              alt={it.product.name}
                              category={it.product.category}
                              className="w-full h-full object-cover"
                              containerClassName="w-8 h-8 rounded overflow-hidden shrink-0"
                            />
                            <div className="text-[11px] pr-1">
                              <p className="font-medium text-stone-800 truncate max-w-[120px]">{it.product.name}</p>
                              <p className="text-stone-400 font-mono">Qty: {it.quantity}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-stone-100">
                        <div>
                          <span className="text-xs text-stone-400 block">Total Settled</span>
                          <span className="text-base font-bold text-stone-900 font-mono tabular-nums">
                            {formatIDR(order.total)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setTrackingSearchId(order.id);
                              setActiveTab('track');
                            }}
                            className="py-2 px-3 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <Truck className="w-3.5 h-3.5 text-amber-300" />
                            <span>Live Tracker</span>
                          </button>
                          <button
                            onClick={() => setSelectedReceiptOrder(order)}
                            className="py-2 px-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Receipt</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: TRACKING */}
          {activeTab === 'track' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={trackingSearchId}
                    onChange={(e) => setTrackingSearchId(e.target.value)}
                    placeholder="Enter Order ID..."
                    className="w-full pl-9 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm font-mono text-stone-900"
                  />
                </div>
              </div>

              {activeTrackedOrder ? (
                <div className="space-y-6">
                  <div className="p-5 bg-stone-50 rounded-2xl border border-stone-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-mono text-stone-500 mb-1">
                        <span>Order {activeTrackedOrder.id}</span>
                      </div>
                      <h3 className="text-lg font-bold text-stone-900 font-display">
                        Fulfillment Status: <span className="text-emerald-800 capitalize">{activeTrackedOrder.status}</span>
                      </h3>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 bg-stone-50 rounded-xl border border-stone-200">
                  <Package className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                  <p className="text-stone-900 font-semibold text-sm">No Orders Found</p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};