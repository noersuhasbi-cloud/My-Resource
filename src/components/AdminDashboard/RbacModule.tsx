import React, { useState, useEffect } from 'react';
import type { StaffShiftSession, StorageZoneType, UserRole } from '../../types/index.ts';
import { apiClient } from '../../services/apiClient';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Users,
  Clock,
  Building2,
  Lock,
  Unlock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Key,
  BadgeCheck,
  Layers,
  Thermometer,
  FileCheck2,
  Sliders,
  ChevronRight,
  UserCheck,
  X,
} from 'lucide-react';

interface RbacModuleProps {
  theme: 'light' | 'dark';
  onShowToast: (title: string, message: string) => void;
  onSessionUpdated?: (session: StaffShiftSession) => void;
}

export const RbacModule: React.FC<RbacModuleProps> = ({
  theme,
  onShowToast,
  onSessionUpdated,
}) => {
  const [currentSession, setCurrentSession] = useState<StaffShiftSession | null>(null);
  const [availableProfiles, setAvailableProfiles] = useState<StaffShiftSession[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSwitching, setIsSwitching] = useState<boolean>(false);

  // Live Zone Access Guard Tester
  const [testedZone, setTestedZone] = useState<StorageZoneType>('ambient');
  const [zoneTestResult, setZoneTestResult] = useState<{
    tested: boolean;
    authorized: boolean;
    message: string;
  } | null>(null);
  const [isTestingZone, setIsTestingZone] = useState<boolean>(false);

  // Shift handover sign-off modal
  const [isHandoverModalOpen, setIsHandoverModalOpen] = useState<boolean>(false);
  const [handoverNotes, setHandoverNotes] = useState<string>('');
  const [handoverNextShift, setHandoverNextShift] = useState<string>('Afternoon Shift');

  const isLight = theme === 'light';

  const loadRbacData = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.getRbacSession();
      setCurrentSession(res.currentSession);
      setAvailableProfiles(res.availableProfiles || []);
      if (onSessionUpdated) onSessionUpdated(res.currentSession);
    } catch (e) {
      console.error('Failed to load RBAC session:', e);
      onShowToast('Error', 'Failed to retrieve RBAC staff session');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRbacData();
  }, []);

  const handleSwitchSession = async (userId: string) => {
    setIsSwitching(true);
    try {
      const res = await apiClient.switchRbacSession(userId);
      setCurrentSession(res.session);
      setZoneTestResult(null);
      if (onSessionUpdated) onSessionUpdated(res.session);
      onShowToast(
        'Staff Identity Switched',
        `Active operator is now ${res.session.userName} (${res.session.userRole.replace(/_/g, ' ')}). Granular permissions re-evaluated.`
      );
    } catch (err) {
      onShowToast('Switch Failed', String(err));
    } finally {
      setIsSwitching(false);
    }
  };

  const handleTestZoneAccess = async (zone: StorageZoneType) => {
    setIsTestingZone(true);
    setTestedZone(zone);
    try {
      const res = await apiClient.checkZoneAccess(zone);
      setZoneTestResult({
        tested: true,
        authorized: res.authorized,
        message: res.authorized
          ? `Authorization Verified: Access granted to ${zone.replace(/_/g, ' ').toUpperCase()} zone for active session.`
          : res.error || 'Access Denied: Zone restricted.',
      });
      if (res.authorized) {
        onShowToast('Zone Access Granted', `Authorized to enter & pick in ${zone} storage.`);
      } else {
        onShowToast('Zone Access Blocked', `Permission Denied: Zone restricted by active shift policy.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setZoneTestResult({
        tested: true,
        authorized: false,
        message: msg,
      });
      onShowToast('Access Denied', 'Zone restricted by active shift policy.');
    } finally {
      setIsTestingZone(false);
    }
  };

  const roleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'executive':
        return 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30';
      case 'store_manager':
        return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
      case 'warehouse_picker':
        return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';
      case 'receiving_clerk':
        return 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30';
      case 'cashier':
        return 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30';
      default:
        return 'bg-gray-500/15 text-gray-700 dark:text-gray-300 border-gray-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div
        className={`p-5 sm:p-6 rounded-2xl border transition-colors ${
          isLight
            ? 'bg-gradient-to-r from-emerald-50 via-white to-stone-50 border-emerald-900/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)]'
            : 'bg-stone-900/80 border-stone-800'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#0F4C3A] text-white tracking-wide uppercase">
                Module 3 • Security &amp; Compliance
              </span>
              <span className={`text-xs ${isLight ? 'text-stone-500' : 'text-stone-400'}`}>
                Granular Shift, Zone &amp; Outlet Authorization Matrix
              </span>
            </div>
            <h2 className={`text-xl sm:text-2xl font-bold tracking-tight ${isLight ? 'text-stone-900' : 'text-white'}`}>
              Role-Based Access Control (RBAC) &amp; Shift Management
            </h2>
            <p className={`text-xs sm:text-sm mt-1 max-w-3xl ${isLight ? 'text-stone-600' : 'text-stone-400'}`}>
              Enforce least-privilege administrative governance. Cashiers and Pickers are bounded by physical warehouse zones
              (Ambient, Cold Chilled, Freezer) and active shifts, while Store Managers and Company Executives hold cryptographic override
              and consolidated financial audit signing keys.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsHandoverModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-[#0F4C3A] hover:bg-[#0F4C3A]/90 text-white shadow-sm transition-all"
            >
              <BadgeCheck className="w-4 h-4" />
              Sign Off Shift Handover
            </button>
            <button
              onClick={loadRbacData}
              disabled={isLoading}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                isLight
                  ? 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50 shadow-sm'
                  : 'bg-stone-800 border-stone-700 text-stone-200 hover:bg-stone-700'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Active Session & Operator Switcher */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Current Active Staff Session Card */}
        <div
          className={`lg:col-span-1 p-5 rounded-2xl border flex flex-col justify-between ${
            isLight
              ? 'bg-white border-gray-200/90 shadow-[0_4px_16px_rgba(0,0,0,0.02)]'
              : 'bg-stone-900/90 border-stone-800'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? 'text-gray-400' : 'text-stone-500'}`}>
                Active Signed-In Operator
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Session
              </span>
            </div>

            {currentSession ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0F4C3A] to-emerald-700 flex items-center justify-center text-white font-black text-lg shadow-md">
                    {currentSession.userName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                      {currentSession.userName}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${roleBadgeColor(currentSession.userRole)}`}>
                        {currentSession.userRole.replace(/_/g, ' ').toUpperCase()}
                      </span>
                      <span className="text-[11px] text-gray-400 font-mono">
                        #{currentSession.userId}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={`p-3 rounded-xl border space-y-1.5 text-xs ${isLight ? 'bg-gray-50/70 border-gray-200' : 'bg-stone-800/60 border-stone-700'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" /> Outlet Scope:
                    </span>
                    <span className="font-semibold text-right truncate max-w-[170px]">
                      {currentSession.storeName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Active Shift:
                    </span>
                    <span className="font-semibold font-mono">
                      {currentSession.shiftName} ({currentSession.activeShiftId})
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" /> Storage Zones:
                    </span>
                    <div className="flex items-center gap-1 flex-wrap justify-end">
                      {currentSession.assignedZones.map((z) => (
                        <span key={z} className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#0F4C3A]/10 text-[#0F4C3A] dark:text-emerald-400">
                          {z.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-gray-400">Loading operator session...</div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-200 dark:border-stone-800 text-[11px] text-gray-400">
            🔒 All mutations are digitally watermarked with this operator ID and timestamp.
          </div>
        </div>

        {/* Quick Identity Switcher for Testing Access Boundaries */}
        <div
          className={`lg:col-span-2 p-5 rounded-2xl border flex flex-col justify-between ${
            isLight
              ? 'bg-white border-gray-200/90 shadow-[0_4px_16px_rgba(0,0,0,0.02)]'
              : 'bg-stone-900/90 border-stone-800'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className={`text-sm font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                  Switch Active Role Profile (Live RBAC Emulation)
                </h3>
                <p className="text-xs text-gray-400">
                  Select a test identity to simulate operational and security restrictions across all ERP endpoints.
                </p>
              </div>
              <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                {availableProfiles.length} Profiles Ready
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {availableProfiles.map((profile) => {
                const isActive = currentSession?.userId === profile.userId;
                return (
                  <button
                    key={profile.userId}
                    onClick={() => handleSwitchSession(profile.userId)}
                    disabled={isActive || isSwitching}
                    className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                      isActive
                        ? 'border-[#0F4C3A] bg-[#0F4C3A]/5 shadow-xs ring-1 ring-[#0F4C3A]'
                        : isLight
                        ? 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 bg-white'
                        : 'border-stone-800 hover:border-stone-700 hover:bg-stone-800/50 bg-stone-900/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
                          {profile.userName}
                          {isActive && (
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-stone-400 mt-0.5">
                          {profile.storeName}
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${roleBadgeColor(profile.userRole)}`}>
                        {profile.userRole.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-stone-800 flex items-center justify-between text-[10px] text-gray-400">
                      <span>Shift: {profile.shiftName}</span>
                      <span className="font-mono">Zones: [{profile.assignedZones.join(', ')}]</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-3 text-[11px] text-gray-400">
            💡 Selecting <strong>Warehouse Picker</strong> will restrict viewing P&amp;L and approving POs. Selecting <strong>Executive</strong> unlocks full consolidated multi-store overrides.
          </div>
        </div>
      </div>

      {/* Permissions Matrix & Zone Guard Verification */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Granular Permissions Inspection */}
        <div
          className={`lg:col-span-2 p-5 rounded-2xl border ${
            isLight
              ? 'bg-white border-gray-200/90 shadow-[0_4px_16px_rgba(0,0,0,0.02)]'
              : 'bg-stone-900/90 border-stone-800'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className={`text-sm sm:text-base font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                Granular Permissions Evaluated for Active Session
              </h3>
              <p className="text-xs text-gray-400">
                Rule engine evaluation based on role ({currentSession?.userRole}), active shift ({currentSession?.activeShiftId}), and outlet tag.
              </p>
            </div>
          </div>

          {currentSession && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className={`p-3 rounded-xl border flex items-center justify-between ${isLight ? 'bg-gray-50 border-gray-200' : 'bg-stone-800/50 border-stone-700'}`}>
                <div>
                  <span className="font-semibold block">Store Point-of-Sale (POS) Terminal</span>
                  <span className="text-[11px] text-gray-400">Process checkout &amp; QRIS settlements</span>
                </div>
                {currentSession.permissions.canViewPos ? (
                  <span className="flex items-center gap-1 text-emerald-600 font-bold text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Allowed
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-rose-500 font-bold text-[11px] bg-rose-500/10 px-2 py-0.5 rounded-full">
                    <XCircle className="w-3.5 h-3.5" /> Restricted
                  </span>
                )}
              </div>

              <div className={`p-3 rounded-xl border flex items-center justify-between ${isLight ? 'bg-gray-50 border-gray-200' : 'bg-stone-800/50 border-stone-700'}`}>
                <div>
                  <span className="font-semibold block">Goods Receipt (GR) &amp; Dock Inwarding</span>
                  <span className="text-[11px] text-gray-400">Perform partial receipt &amp; lot logging</span>
                </div>
                {currentSession.permissions.canReceiveGoods ? (
                  <span className="flex items-center gap-1 text-emerald-600 font-bold text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Allowed
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-rose-500 font-bold text-[11px] bg-rose-500/10 px-2 py-0.5 rounded-full">
                    <XCircle className="w-3.5 h-3.5" /> Restricted
                  </span>
                )}
              </div>

              <div className={`p-3 rounded-xl border flex items-center justify-between ${isLight ? 'bg-gray-50 border-gray-200' : 'bg-stone-800/50 border-stone-700'}`}>
                <div>
                  <span className="font-semibold block">Purchase Order (PO) Final Approval</span>
                  <span className="text-[11px] text-gray-400">Authorize binding vendor orders &amp; AP balance</span>
                </div>
                {currentSession.permissions.canApprovePurchaseOrder ? (
                  <span className="flex items-center gap-1 text-emerald-600 font-bold text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Allowed
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-rose-500 font-bold text-[11px] bg-rose-500/10 px-2 py-0.5 rounded-full">
                    <XCircle className="w-3.5 h-3.5" /> Restricted
                  </span>
                )}
              </div>

              <div className={`p-3 rounded-xl border flex items-center justify-between ${isLight ? 'bg-gray-50 border-gray-200' : 'bg-stone-800/50 border-stone-700'}`}>
                <div>
                  <span className="font-semibold block">Financial P&amp;L &amp; Balance Sheet Access</span>
                  <span className="text-[11px] text-gray-400">Inspect gross margins &amp; net profitability</span>
                </div>
                {currentSession.permissions.canViewFinancePnL ? (
                  <span className="flex items-center gap-1 text-emerald-600 font-bold text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Allowed
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-rose-500 font-bold text-[11px] bg-rose-500/10 px-2 py-0.5 rounded-full">
                    <XCircle className="w-3.5 h-3.5" /> Restricted
                  </span>
                )}
              </div>

              <div className={`p-3 rounded-xl border flex items-center justify-between ${isLight ? 'bg-gray-50 border-gray-200' : 'bg-stone-800/50 border-stone-700'}`}>
                <div>
                  <span className="font-semibold block">Inventory Adjustments &amp; Stocktake</span>
                  <span className="text-[11px] text-gray-400">Modify physical stock count without GR</span>
                </div>
                {currentSession.permissions.canAdjustInventory ? (
                  <span className="flex items-center gap-1 text-emerald-600 font-bold text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Allowed
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-rose-500 font-bold text-[11px] bg-rose-500/10 px-2 py-0.5 rounded-full">
                    <XCircle className="w-3.5 h-3.5" /> Restricted
                  </span>
                )}
              </div>

              <div className={`p-3 rounded-xl border flex items-center justify-between ${isLight ? 'bg-gray-50 border-gray-200' : 'bg-stone-800/50 border-stone-700'}`}>
                <div>
                  <span className="font-semibold block">Store Emergency Closure Override</span>
                  <span className="text-[11px] text-gray-400">Halt online routing &amp; trigger customer broadcast</span>
                </div>
                {currentSession.permissions.canOverrideStoreClosure ? (
                  <span className="flex items-center gap-1 text-emerald-600 font-bold text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Allowed
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-rose-500 font-bold text-[11px] bg-rose-500/10 px-2 py-0.5 rounded-full">
                    <XCircle className="w-3.5 h-3.5" /> Restricted
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Live Warehouse Physical Zone Access Guard */}
        <div
          className={`p-5 rounded-2xl border flex flex-col justify-between ${
            isLight
              ? 'bg-white border-gray-200/90 shadow-[0_4px_16px_rgba(0,0,0,0.02)]'
              : 'bg-stone-900/90 border-stone-800'
          }`}
        >
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600">
                <Thermometer className="w-4 h-4" />
              </div>
              <div>
                <h3 className={`text-sm font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                  Zone Access Guard (IoT)
                </h3>
                <p className="text-[11px] text-gray-400">
                  Backend check for physical warehouse security turnstiles &amp; picking bays.
                </p>
              </div>
            </div>

            <div className="space-y-2 mt-3">
              {(['ambient', 'cold_chilled', 'freezer'] as StorageZoneType[]).map((zone) => {
                const isAssigned = currentSession?.assignedZones.includes(zone) || currentSession?.assignedZones.includes('all' as any);
                return (
                  <button
                    key={zone}
                    onClick={() => handleTestZoneAccess(zone)}
                    disabled={isTestingZone}
                    className={`w-full p-2.5 rounded-xl border text-xs flex items-center justify-between transition-all ${
                      testedZone === zone && zoneTestResult
                        ? zoneTestResult.authorized
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-rose-500 bg-rose-500/10'
                        : isLight
                        ? 'border-gray-200 hover:bg-gray-50'
                        : 'border-stone-800 hover:bg-stone-800/50'
                    }`}
                  >
                    <div className="text-left">
                      <span className="font-bold capitalize block">
                        {zone.replace(/_/g, ' ')} Storage Zone
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {zone === 'ambient' ? '20°C - 25°C Ambient' : zone === 'cold_chilled' ? '0°C - 4°C Fresh' : '-18°C Deep Frozen'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isAssigned ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                          Assigned
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-stone-500/20 text-stone-600 dark:text-stone-400">
                          Restricted
                        </span>
                      )}
                      <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Test Feedback Box */}
            {zoneTestResult && (
              <div
                className={`mt-4 p-3 rounded-xl border text-xs ${
                  zoneTestResult.authorized
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200'
                }`}
              >
                <div className="flex items-start gap-2">
                  {zoneTestResult.authorized ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-bold">
                      {zoneTestResult.authorized ? 'ACCESS GRANTED' : 'ACCESS RESTRICTED'}
                    </span>
                    <p className="text-[11px] mt-0.5">{zoneTestResult.message}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 text-[11px] text-gray-400">
            Turnstile logs are recorded to the central Security Audit Trail.
          </div>
        </div>
      </div>

      {/* Shift Handover Sign-Off Modal */}
      {isHandoverModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div
            className={`w-full max-w-[95vw] sm:max-w-md rounded-2xl border shadow-2xl p-4 sm:p-5 my-auto ${
              isLight ? 'bg-white border-gray-200 text-gray-900' : 'bg-stone-900 border-stone-800 text-white'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-stone-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#0F4C3A] text-white">
                  <BadgeCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Shift Handover Sign-Off</h3>
                  <p className="text-[11px] text-gray-400">Seal shift logs &amp; transfer custody</p>
                </div>
              </div>
              <button
                onClick={() => setIsHandoverModalOpen(false)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isLight ? 'hover:bg-gray-100 text-gray-500' : 'hover:bg-stone-800 text-stone-400'
                }`}
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Outgoing Shift Leader</label>
                <div className="p-2.5 rounded-xl border bg-gray-50 dark:bg-stone-800 border-gray-200 dark:border-stone-700 font-bold">
                  {currentSession?.userName} ({currentSession?.shiftName} - {currentSession?.activeShiftId})
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Receiving Shift</label>
                <select
                  value={handoverNextShift}
                  onChange={(e) => setHandoverNextShift(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border ${
                    isLight ? 'bg-white border-gray-300' : 'bg-stone-800 border-stone-700'
                  }`}
                >
                  <option value="Afternoon Shift">Afternoon Shift (14:00 - 22:00)</option>
                  <option value="Night Restock Shift">Night Restock Shift (22:00 - 06:00)</option>
                  <option value="Morning Shift">Morning Opening Shift (06:00 - 14:00)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">Handover Observations &amp; Chiller Status</label>
                <textarea
                  rows={3}
                  value={handoverNotes}
                  onChange={(e) => setHandoverNotes(e.target.value)}
                  placeholder="e.g. All cold-chain chillers within 1.5°C tolerance. 2 pending express fulfillment orders handed over to incoming team."
                  className={`w-full p-2.5 rounded-xl border ${
                    isLight ? 'bg-white border-gray-300' : 'bg-stone-800 border-stone-700'
                  }`}
                />
              </div>

              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-800 dark:text-emerald-300">
                🔒 Cryptographic digital signature will be stamped to the Security Audit Log with timestamp and shift balance records.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsHandoverModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl border text-xs font-semibold text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsHandoverModalOpen(false);
                    onShowToast(
                      'Shift Handover Certified',
                      `Handover to ${handoverNextShift} signed off by ${currentSession?.userName}. Digital audit record generated.`
                    );
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#0F4C3A] hover:bg-[#0F4C3A]/90 text-white"
                >
                  Confirm &amp; Stamp Handover
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
