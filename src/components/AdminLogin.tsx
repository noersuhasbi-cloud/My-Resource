/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import type { StaffShiftSession, UserRole, StorageZoneType } from '../types/index.ts';
import { apiClient } from '../services/apiClient';
import {
  Shield,
  ShieldCheck,
  Lock,
  Unlock,
  KeyRound,
  Users,
  Building2,
  Package,
  Layers,
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  Store,
  Sun,
  Moon,
} from 'lucide-react';

interface AdminLoginProps {
  onLoginSuccess: (session: StaffShiftSession) => void;
  onReturnToStorefront: () => void;
  onShowToast?: (title: string, message: string) => void;
}

// Fallback staff roster if backend request fails
const FALLBACK_STAFF_ROSTER: StaffShiftSession[] = [
  {
    userId: 'USR-EXEC-01',
    userName: 'Irfan Hakim (COO & VP ERP)',
    userRole: 'executive',
    storeId: 'ALL',
    storeName: 'GroceMart Consolidated Group',
    activeShiftId: 'SHIFT-EXEC-ALL-HOURS',
    shiftName: 'Morning Shift',
    assignedZones: ['ambient', 'cold_chilled', 'freezer'],
    loginTimestamp: new Date().toISOString(),
    permissions: {
      canViewPos: true,
      canViewInventory: true,
      canAdjustInventory: true,
      canPickZone: () => true,
      canReceiveGoods: true,
      canApprovePurchaseOrder: true,
      canViewFinancePnL: true,
      canManageOutlets: true,
      canOverrideStoreClosure: true,
    },
  },
  {
    userId: 'USR-MGR-01',
    userName: 'Dewi Sartika (Store Operations Manager)',
    userRole: 'store_manager',
    storeId: 'store-jkt-senopati',
    storeName: 'GroceMart Senopati Flagship',
    activeShiftId: 'SHIFT-JKT-SEN-MORNING',
    shiftName: 'Morning Shift',
    assignedZones: ['ambient', 'cold_chilled', 'freezer'],
    loginTimestamp: new Date().toISOString(),
    permissions: {
      canViewPos: true,
      canViewInventory: true,
      canAdjustInventory: true,
      canPickZone: () => true,
      canReceiveGoods: true,
      canApprovePurchaseOrder: true,
      canViewFinancePnL: true,
      canManageOutlets: true,
      canOverrideStoreClosure: true,
    },
  },
  {
    userId: 'USR-PCK-01',
    userName: 'Rudi Hermawan (Cold-Chain Picker & Receiving Clerk)',
    userRole: 'warehouse_picker',
    storeId: 'store-jkt-senopati',
    storeName: 'GroceMart Senopati Flagship',
    activeShiftId: 'SHIFT-JKT-SEN-MORNING',
    shiftName: 'Morning Shift',
    assignedZones: ['cold_chilled', 'ambient'],
    loginTimestamp: new Date().toISOString(),
    permissions: {
      canViewPos: false,
      canViewInventory: true,
      canAdjustInventory: false,
      canPickZone: (zone: StorageZoneType) => zone === 'cold_chilled' || zone === 'ambient',
      canReceiveGoods: true,
      canApprovePurchaseOrder: false,
      canViewFinancePnL: false,
      canManageOutlets: false,
      canOverrideStoreClosure: false,
    },
  },
  {
    userId: 'USR-CASH-01',
    userName: 'Andi Wijaya (Frontline Cashier)',
    userRole: 'cashier',
    storeId: 'store-jkt-senopati',
    storeName: 'GroceMart Senopati Flagship',
    activeShiftId: 'SHIFT-JKT-SEN-MORNING',
    shiftName: 'Morning Shift',
    assignedZones: ['ambient'],
    loginTimestamp: new Date().toISOString(),
    permissions: {
      canViewPos: true,
      canViewInventory: true,
      canAdjustInventory: false,
      canPickZone: () => false,
      canReceiveGoods: false,
      canApprovePurchaseOrder: false,
      canViewFinancePnL: false,
      canManageOutlets: false,
      canOverrideStoreClosure: false,
    },
  },
];

export const AdminLogin: React.FC<AdminLoginProps> = ({
  onLoginSuccess,
  onReturnToStorefront,
  onShowToast,
}) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('grocemart_admin_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {}
    return 'light';
  });

  const isLight = theme === 'light';

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    try {
      localStorage.setItem('grocemart_admin_theme', next);
    } catch {}
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    return () => {
      document.documentElement.classList.remove('dark');
    };
  }, [theme]);

  const [activeTab, setActiveTab] = useState<'roster' | 'credentials'>('roster');
  const [availableProfiles, setAvailableProfiles] = useState<StaffShiftSession[]>(FALLBACK_STAFF_ROSTER);
  const [selectedUserId, setSelectedUserId] = useState<string>('USR-EXEC-01');
  const [usernameInput, setUsernameInput] = useState<string>('USR-EXEC-01');
  const [passwordInput, setPasswordInput] = useState<string>('admin123');
  const [selectedShift, setSelectedShift] = useState<'Morning Shift' | 'Afternoon Shift' | 'Night Shift'>('Morning Shift');
  const [rememberWorkstation, setRememberWorkstation] = useState<boolean>(true);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch live available profiles from the server
  useEffect(() => {
    let isMounted = true;
    apiClient
      .getRbacSession()
      .then((res) => {
        if (isMounted && res.availableProfiles && res.availableProfiles.length > 0) {
          setAvailableProfiles(res.availableProfiles);
          if (!res.availableProfiles.some((p) => p.userId === selectedUserId)) {
            setSelectedUserId(res.availableProfiles[0].userId);
            setUsernameInput(res.availableProfiles[0].userId);
          }
        }
      })
      .catch((err) => {
        console.warn('Using local fallback staff roster:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSelectProfile = (profile: StaffShiftSession) => {
    setSelectedUserId(profile.userId);
    setUsernameInput(profile.userId);
    setErrorMessage(null);
  };

  const handleExecuteLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setIsAuthenticating(true);

    try {
      const payload =
        activeTab === 'roster'
          ? {
              userId: selectedUserId,
              shiftName: selectedShift,
            }
          : {
              username: usernameInput.trim(),
              password: passwordInput,
              shiftName: selectedShift,
            };

      const res = await apiClient.adminLogin(payload);
      if (res.success && res.session) {
        if (rememberWorkstation) {
          try {
            localStorage.setItem('grocemart_admin_session', JSON.stringify(res.session));
          } catch {}
        }
        if (onShowToast) {
          onShowToast(
            'Authentication Successful',
            `Welcome back, ${res.session.userName} (${res.session.userRole.replace(/_/g, ' ')})`
          );
        }
        onLoginSuccess(res.session);
      } else {
        throw new Error(res.message || 'Authentication rejected by security gate');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please verify credentials.');
      if (onShowToast) {
        onShowToast('Access Denied', err.message || 'Login failed');
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'executive':
        return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/60';
      case 'store_manager':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60';
      case 'warehouse_picker':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60';
      case 'cashier':
        return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/60';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700';
    }
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'executive':
        return <ShieldCheck className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0" />;
      case 'store_manager':
        return <Building2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />;
      case 'warehouse_picker':
        return <Package className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />;
      case 'cashier':
        return <Layers className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0" />;
      default:
        return <Shield className="w-5 h-5 text-gray-500 dark:text-stone-400 shrink-0" />;
    }
  };

  return (
    <div
      className={`${
        theme === 'dark' ? 'dark bg-stone-950 text-stone-100' : 'bg-[#F8FAFC] text-gray-900'
      } min-h-screen flex flex-col font-sans selection:bg-[#0F4C3A] selection:text-white relative overflow-hidden transition-colors duration-200`}
    >
      {/* Top Banner Navigation: Back to Storefront, Theme Switcher & Security Badge */}
      <header className="border-b border-gray-200/90 dark:border-stone-800/80 bg-white/90 dark:bg-stone-900/80 backdrop-blur-md px-4 sm:px-8 py-3 flex items-center justify-between z-10">
        <button
          onClick={onReturnToStorefront}
          className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-gray-700 dark:text-stone-300 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer group px-3 py-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-stone-800/70"
        >
          <ArrowLeft className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400 group-hover:-translate-x-1 transition-transform" />
          <span>Exit to Customer Storefront</span>
        </button>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500 dark:text-stone-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>ERP GATEWAY:</span>
            <span className="text-gray-800 dark:text-stone-200 font-semibold">TLS 1.3 ENCRYPTED</span>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl border border-gray-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-gray-700 dark:text-amber-400 hover:bg-gray-50 dark:hover:bg-stone-700 transition-colors cursor-pointer"
            title={isLight ? 'Switch to Dark Mode' : 'Switch to Clean Light Mode'}
            aria-label="Toggle theme"
          >
            {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Authentication Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 z-10">
        <div className="w-full max-w-4xl bg-white dark:bg-stone-900 border border-gray-200/90 dark:border-stone-800 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-2xl overflow-hidden transition-colors">
          {/* Header Card Branding */}
          <div className="p-6 sm:p-8 border-b border-gray-200 dark:border-stone-800 bg-gradient-to-r from-emerald-50/60 via-white to-gray-50/60 dark:from-stone-900 dark:via-stone-900 dark:to-emerald-950/30">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-[#0F4C3A] text-white flex items-center justify-center font-extrabold text-xl shadow-md shadow-[#0F4C3A]/20">
                  GM
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white font-display">
                      GroceMart ERP &amp; POS Suite
                    </h1>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-[#0F4C3A] border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30 font-mono">
                      v4.2 ENTERPRISE
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-stone-400 mt-0.5">
                    Multi-Outlet Cold Chain Logistics, FEFO Warehouse Picking, POS Cashier &amp; General Ledger
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto bg-gray-100 dark:bg-stone-800 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-stone-700 text-xs text-gray-700 dark:text-stone-300 font-medium">
                <Lock className="w-3.5 h-3.5 text-[#0F4C3A] dark:text-amber-400" />
                <span>Role-Based Access Gate</span>
              </div>
            </div>

            {/* Authentication Mode Switcher Tabs */}
            <div className="flex items-center gap-2 mt-6 pt-5 border-t border-gray-200/80 dark:border-stone-800/80">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('roster');
                  setErrorMessage(null);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'roster'
                    ? 'bg-[#0F4C3A] text-white shadow-xs'
                    : 'bg-gray-100 dark:bg-stone-800 text-gray-600 dark:text-stone-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/70 dark:hover:bg-stone-700'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Select Staff Profile (RBAC Roster)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('credentials');
                  setErrorMessage(null);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'credentials'
                    ? 'bg-[#0F4C3A] text-white shadow-xs'
                    : 'bg-gray-100 dark:bg-stone-800 text-gray-600 dark:text-stone-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/70 dark:hover:bg-stone-700'
                }`}
              >
                <KeyRound className="w-4 h-4" />
                <span>Employee ID &amp; Password</span>
              </button>
            </div>
          </div>

          {/* Error Notice */}
          {errorMessage && (
            <div className="mx-6 sm:mx-8 mt-6 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 flex items-start gap-3 text-xs sm:text-sm text-rose-800 dark:text-rose-200">
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold block">Authentication Rejection</span>
                <span className="text-rose-700 dark:text-rose-300 text-xs">{errorMessage}</span>
              </div>
            </div>
          )}

          {/* Tab 1: Staff Profiles RBAC Selection */}
          {activeTab === 'roster' && (
            <div className="p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-xs font-bold text-gray-500 dark:text-stone-400 uppercase tracking-wider">
                    Authorized Personnel Roster
                  </h2>
                  <p className="text-xs text-gray-600 dark:text-stone-400 mt-0.5">
                    Select a staff profile to initialize your authenticated ERP or POS Cashier session with strict role boundaries.
                  </p>
                </div>
                <span className="text-xs font-mono font-semibold text-[#0F4C3A] dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800/50">
                  {availableProfiles.length} Profiles Available
                </span>
              </div>

              {/* Profiles Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {availableProfiles.map((profile) => {
                  const isSelected = selectedUserId === profile.userId;
                  return (
                    <div
                      key={profile.userId}
                      onClick={() => handleSelectProfile(profile)}
                      className={`p-4 rounded-xl border text-left transition-all cursor-pointer relative group ${
                        isSelected
                          ? 'bg-emerald-50/40 dark:bg-stone-800/90 border-[#0F4C3A] dark:border-emerald-500 shadow-xs ring-1 ring-[#0F4C3A]/30 dark:ring-emerald-500/40'
                          : 'bg-white dark:bg-stone-800/40 border-gray-200 dark:border-stone-700/70 hover:bg-gray-50 dark:hover:bg-stone-800/70 hover:border-gray-300 dark:hover:border-stone-600'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-colors ${
                              isSelected
                                ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-500/60'
                                : 'bg-gray-50 dark:bg-stone-900 border-gray-200 dark:border-stone-700'
                            }`}
                          >
                            {getRoleIcon(profile.userRole)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-gray-900 dark:text-white group-hover:text-[#0F4C3A] dark:group-hover:text-emerald-300 transition-colors">
                                {profile.userName}
                              </span>
                            </div>
                            <span className="text-[11px] font-mono text-gray-500 dark:text-stone-400">
                              ID: {profile.userId}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${getRoleBadgeColor(
                            profile.userRole
                          )}`}
                        >
                          {profile.userRole.replace(/_/g, ' ')}
                        </span>
                      </div>

                      {/* Store & Scope */}
                      <div className="mt-3.5 pt-3 border-t border-gray-100 dark:border-stone-700/50 flex flex-wrap items-center justify-between text-[11px] text-gray-500 dark:text-stone-400 gap-2">
                        <div className="flex items-center gap-1.5">
                          <Store className="w-3.5 h-3.5 text-gray-400 dark:text-stone-500" />
                          <span className="text-gray-700 dark:text-stone-300 font-medium truncate max-w-[180px]">
                            {profile.storeName}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono text-[10px] text-gray-500 dark:text-stone-400">
                          <Clock className="w-3 h-3 text-gray-400 dark:text-stone-500" />
                          <span>{profile.shiftName}</span>
                        </div>
                      </div>

                      {/* Storage Zones & Clearance */}
                      <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-gray-400 dark:text-stone-500 uppercase font-bold">Zones:</span>
                        {profile.assignedZones.map((z) => (
                          <span
                            key={z}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-stone-900 text-gray-700 dark:text-stone-300 font-mono border border-gray-200 dark:border-stone-700/60"
                          >
                            {z.replace(/_/g, ' ')}
                          </span>
                        ))}
                        {profile.permissions.canViewPos && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-[#0F4C3A] dark:text-emerald-300 font-mono font-semibold border border-emerald-200 dark:border-emerald-800/50 ml-auto">
                            POS Authorized
                          </span>
                        )}
                      </div>

                      {isSelected && (
                        <div className="absolute top-2.5 right-2.5 sm:hidden">
                          <CheckCircle2 className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Workstation Shift & Fast Authenticate CTA */}
              <div className="pt-4 border-t border-gray-200 dark:border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <span className="text-xs text-gray-600 dark:text-stone-400 font-medium shrink-0">Active Shift:</span>
                  <select
                    value={selectedShift}
                    onChange={(e) => setSelectedShift(e.target.value as any)}
                    className="bg-white dark:bg-stone-800 border border-gray-300 dark:border-stone-700 rounded-xl px-3 py-2 text-xs font-semibold text-gray-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-[#0F4C3A] cursor-pointer w-full sm:w-auto"
                  >
                    <option value="Morning Shift">Morning Shift (06:00 - 14:00)</option>
                    <option value="Afternoon Shift">Afternoon Shift (14:00 - 22:00)</option>
                    <option value="Night Shift">Night Shift (22:00 - 06:00)</option>
                  </select>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={onReturnToStorefront}
                    className="w-1/2 sm:w-auto px-4 py-2.5 rounded-xl border border-gray-300 dark:border-stone-700 text-xs font-semibold text-gray-700 dark:text-stone-300 hover:bg-gray-100 dark:hover:bg-stone-800 transition-colors cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecuteLogin()}
                    disabled={isAuthenticating}
                    className="w-1/2 sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isAuthenticating ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Verifying Gate...</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="w-4 h-4" />
                        <span>Sign In &amp; Launch ERP</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Manual Credentials Form */}
          {activeTab === 'credentials' && (
            <form onSubmit={handleExecuteLogin} className="p-6 sm:p-8 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Employee ID */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 dark:text-stone-300 uppercase tracking-wider block">
                    Employee ID or Username
                  </label>
                  <input
                    type="text"
                    required
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="e.g. USR-EXEC-01 or USR-CASH-01"
                    className="w-full bg-white dark:bg-stone-800 border border-gray-300 dark:border-stone-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-[#0F4C3A] font-mono"
                  />
                  <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px] text-gray-500 dark:text-stone-400">
                    <span>Quick fill:</span>
                    {availableProfiles.map((p) => (
                      <button
                        key={p.userId}
                        type="button"
                        onClick={() => setUsernameInput(p.userId)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-stone-800 text-gray-700 dark:text-stone-300 hover:text-[#0F4C3A] dark:hover:text-emerald-300 border border-gray-200 dark:border-stone-700 font-mono transition-colors cursor-pointer"
                      >
                        {p.userId}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Password / Security PIN */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 dark:text-stone-300 uppercase tracking-wider block">
                    Password / Security PIN
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="Enter password or PIN"
                      className="w-full bg-white dark:bg-stone-800 border border-gray-300 dark:border-stone-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-[#0F4C3A] pr-10 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-white cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <span className="text-[11px] text-gray-500 dark:text-stone-400 block pt-1">
                    Default demo credentials: password <code className="font-mono font-bold text-gray-800 dark:text-stone-200">admin123</code> or PIN <code className="font-mono font-bold text-gray-800 dark:text-stone-200">8821</code>
                  </span>
                </div>
              </div>

              {/* Workstation Shift Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 dark:text-stone-300 uppercase tracking-wider block">
                    Workstation Shift
                  </label>
                  <select
                    value={selectedShift}
                    onChange={(e) => setSelectedShift(e.target.value as any)}
                    className="w-full bg-white dark:bg-stone-800 border border-gray-300 dark:border-stone-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-[#0F4C3A] cursor-pointer"
                  >
                    <option value="Morning Shift">Morning Shift (06:00 - 14:00)</option>
                    <option value="Afternoon Shift">Afternoon Shift (14:00 - 22:00)</option>
                    <option value="Night Shift">Night Shift (22:00 - 06:00)</option>
                  </select>
                </div>

                <div className="flex items-center sm:pt-6">
                  <label className="flex items-center gap-2.5 text-xs text-gray-700 dark:text-stone-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberWorkstation}
                      onChange={(e) => setRememberWorkstation(e.target.checked)}
                      className="w-4 h-4 rounded text-[#0F4C3A] focus:ring-[#0F4C3A] border-gray-300 dark:border-stone-700"
                    />
                    <span>Remember authenticated session on this terminal</span>
                  </label>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4 border-t border-gray-200 dark:border-stone-800 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={onReturnToStorefront}
                  className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-stone-700 text-xs font-semibold text-gray-700 dark:text-stone-300 hover:bg-gray-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAuthenticating}
                  className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {isAuthenticating ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Authenticating Credentials...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Authenticate &amp; Enter Dashboard</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Footer Security Notice */}
          <div className="p-4 bg-gray-50 dark:bg-stone-950 border-t border-gray-200/80 dark:border-stone-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500 dark:text-stone-500">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-500" />
              <span>ISO 27001 Certified · General Ledger Financial Immutability Enforced</span>
            </div>
            <span className="font-mono text-[11px]">PT Bumi Retail Sejahtera (GroceMart)</span>
          </div>
        </div>
      </main>
    </div>
  );
};
