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
  ShieldAlert,
  Lock,
  Unlock,
  KeyRound,
  UserCheck,
  Users,
  Building2,
  Package,
  Layers,
  ArrowLeft,
  ArrowRight,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  Store,
  ChevronRight,
  Info,
  Server,
  Zap,
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
          // If current selection is in the list, keep it; else set to first
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
        return 'bg-purple-900/60 text-purple-300 border-purple-700/60';
      case 'store_manager':
        return 'bg-emerald-900/60 text-emerald-300 border-emerald-700/60';
      case 'warehouse_picker':
        return 'bg-amber-900/60 text-amber-300 border-amber-700/60';
      case 'cashier':
        return 'bg-sky-900/60 text-sky-300 border-sky-700/60';
      default:
        return 'bg-stone-800 text-stone-300 border-stone-700';
    }
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'executive':
        return <ShieldCheck className="w-5 h-5 text-purple-400 shrink-0" />;
      case 'store_manager':
        return <Building2 className="w-5 h-5 text-emerald-400 shrink-0" />;
      case 'warehouse_picker':
        return <Package className="w-5 h-5 text-amber-400 shrink-0" />;
      case 'cashier':
        return <Layers className="w-5 h-5 text-sky-400 shrink-0" />;
      default:
        return <Shield className="w-5 h-5 text-stone-400 shrink-0" />;
    }
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-sans selection:bg-emerald-700 selection:text-white relative overflow-hidden">
      {/* Background Ambient Glow Gradients */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-900/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-amber-900/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top Banner Navigation: Back to Storefront & Security Badge */}
      <header className="border-b border-stone-800/80 bg-stone-900/60 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between z-10">
        <button
          onClick={onReturnToStorefront}
          className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-stone-300 hover:text-white transition-colors cursor-pointer group px-3 py-1.5 rounded-xl hover:bg-stone-800/60"
        >
          <ArrowLeft className="w-4 h-4 text-emerald-400 group-hover:-translate-x-1 transition-transform" />
          <span>Exit to Customer Storefront</span>
        </button>

        <div className="flex items-center gap-2 text-xs text-stone-400 font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="hidden sm:inline">ERP GATEWAY:</span>
          <span className="text-stone-300 font-semibold">SECURE SSL 256-BIT</span>
        </div>
      </header>

      {/* Main Authentication Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 z-10">
        <div className="w-full max-w-4xl bg-stone-900/90 border border-stone-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl">
          {/* Header Card Branding */}
          <div className="p-6 sm:p-8 border-b border-stone-800 bg-gradient-to-r from-stone-900 via-stone-900 to-emerald-950/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-900 text-amber-300 flex items-center justify-center font-bold text-2xl shadow-lg border border-emerald-500/30">
                  G
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-display">
                      GroceMart ERP Suite
                    </h1>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                      v4.2 PROD
                    </span>
                  </div>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Multi-Outlet Cold Chain Logistics, FEFO Warehouse Picking & General Ledger System
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto bg-stone-800/80 px-3 py-1.5 rounded-xl border border-stone-700/60 text-xs text-stone-300">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Restricted Internal Access</span>
              </div>
            </div>

            {/* Authentication Mode Switcher Tabs */}
            <div className="flex items-center gap-2 mt-6 pt-5 border-t border-stone-800/80">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('roster');
                  setErrorMessage(null);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'roster'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-stone-800/80 text-stone-400 hover:text-white hover:bg-stone-800'
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
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-stone-800/80 text-stone-400 hover:text-white hover:bg-stone-800'
                }`}
              >
                <KeyRound className="w-4 h-4" />
                <span>Employee ID & Password</span>
              </button>
            </div>
          </div>

          {/* Error Notice */}
          {errorMessage && (
            <div className="mx-6 sm:mx-8 mt-6 p-3.5 rounded-xl bg-red-950/60 border border-red-800/60 flex items-start gap-3 text-xs sm:text-sm text-red-200 animate-in fade-in">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold block">Authentication Rejection</span>
                <span className="text-red-300 text-xs">{errorMessage}</span>
              </div>
            </div>
          )}

          {/* Tab 1: Staff Profiles RBAC Selection */}
          {activeTab === 'roster' && (
            <div className="p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-stone-200 uppercase tracking-wider">
                    Authorized Personnel Roster
                  </h2>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Select a staff profile to initialize your authenticated ERP workstation session with strict role boundaries.
                  </p>
                </div>
                <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-800/40">
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
                          ? 'bg-stone-800/90 border-emerald-500 shadow-md ring-1 ring-emerald-500/50'
                          : 'bg-stone-800/40 border-stone-700/60 hover:bg-stone-800/70 hover:border-stone-600'
                      }`}
                    >
                      {/* Selection Radio / Check Indicator */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-colors ${
                              isSelected
                                ? 'bg-emerald-950 border-emerald-500/60 text-emerald-400'
                                : 'bg-stone-900 border-stone-700 text-stone-400 group-hover:text-stone-200'
                            }`}
                          >
                            {getRoleIcon(profile.userRole)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-white group-hover:text-emerald-300 transition-colors">
                                {profile.userName}
                              </span>
                            </div>
                            <span className="text-[11px] font-mono text-stone-400">
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
                      <div className="mt-3.5 pt-3 border-t border-stone-700/40 flex flex-wrap items-center justify-between text-[11px] text-stone-400 gap-2">
                        <div className="flex items-center gap-1.5">
                          <Store className="w-3.5 h-3.5 text-stone-500" />
                          <span className="text-stone-300 font-medium truncate max-w-[160px]">
                            {profile.storeName}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono text-[10px] text-stone-400">
                          <Clock className="w-3 h-3 text-stone-500" />
                          <span>{profile.shiftName}</span>
                        </div>
                      </div>

                      {/* Storage Zones & Clearance */}
                      <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-stone-500 uppercase font-bold">Zones:</span>
                        {profile.assignedZones.map((z) => (
                          <span
                            key={z}
                            className="text-[10px] px-1.5 py-0.2 rounded bg-stone-900 text-stone-300 font-mono border border-stone-700/50"
                          >
                            {z.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>

                      {/* Checked Mark Badge */}
                      {isSelected && (
                        <div className="absolute top-2.5 right-2.5 sm:hidden">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Workstation Shift & Fast Authenticate CTA */}
              <div className="pt-4 border-t border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <span className="text-xs text-stone-400 font-medium shrink-0">Active Shift:</span>
                  <select
                    value={selectedShift}
                    onChange={(e) => setSelectedShift(e.target.value as any)}
                    className="bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-xs font-semibold text-stone-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer w-full sm:w-auto"
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
                    className="w-1/2 sm:w-auto px-4 py-2.5 rounded-xl border border-stone-700 text-xs font-semibold text-stone-300 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecuteLogin()}
                    disabled={isAuthenticating}
                    className="w-1/2 sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white text-xs sm:text-sm font-bold shadow-lg transition-all cursor-pointer disabled:opacity-50"
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
                  <label className="text-xs font-bold text-stone-300 uppercase tracking-wider block">
                    Employee ID or Username
                  </label>
                  <input
                    type="text"
                    required
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="e.g. USR-EXEC-01 or USR-MGR-01"
                    className="w-full bg-stone-800/80 border border-stone-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                  {/* Quick-fill helpers */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px] text-stone-400">
                    <span className="text-stone-500">Quick fill:</span>
                    {availableProfiles.map((p) => (
                      <button
                        key={p.userId}
                        type="button"
                        onClick={() => setUsernameInput(p.userId)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 text-stone-300 hover:text-emerald-300 hover:bg-stone-700 font-mono transition-colors"
                      >
                        {p.userId}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Password / Security PIN */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-300 uppercase tracking-wider block">
                    Password / Security PIN
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="Enter password or PIN"
                      className="w-full bg-stone-800/80 border border-stone-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 pr-10 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-white cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <span className="text-[11px] text-stone-500 block pt-1">
                    Default demo credentials: password <code className="text-stone-300">admin123</code> or PIN <code className="text-stone-300">8821</code>
                  </span>
                </div>
              </div>

              {/* Workstation Shift Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-300 uppercase tracking-wider block">
                    Workstation Shift
                  </label>
                  <select
                    value={selectedShift}
                    onChange={(e) => setSelectedShift(e.target.value as any)}
                    className="w-full bg-stone-800/80 border border-stone-700 rounded-xl px-3.5 py-2.5 text-sm text-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="Morning Shift">Morning Shift (06:00 - 14:00)</option>
                    <option value="Afternoon Shift">Afternoon Shift (14:00 - 22:00)</option>
                    <option value="Night Shift">Night Shift (22:00 - 06:00)</option>
                  </select>
                </div>

                <div className="flex items-center sm:pt-6">
                  <label className="flex items-center gap-2.5 text-xs text-stone-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberWorkstation}
                      onChange={(e) => setRememberWorkstation(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-stone-700 bg-stone-800"
                    />
                    <span>Remember authenticated session on this terminal</span>
                  </label>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4 border-t border-stone-800 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={onReturnToStorefront}
                  className="px-4 py-2.5 rounded-xl border border-stone-700 text-xs font-semibold text-stone-300 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAuthenticating}
                  className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white text-xs sm:text-sm font-bold shadow-lg transition-all cursor-pointer disabled:opacity-50"
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
          <div className="p-4 bg-stone-950 border-t border-stone-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-stone-500">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>ISO 27001 Certified · General Ledger Financial Immutability Enforced</span>
            </div>
            <span className="font-mono text-[11px]">PT Bumi Retail Sejahtera (GroceMart)</span>
          </div>
        </div>
      </main>
    </div>
  );
};
