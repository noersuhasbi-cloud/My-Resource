import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Clock,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Save,
  FileWarning,
  ChevronDown,
  ChevronUp,
  Layers,
  Users,
} from 'lucide-react';
import type {
  DivisionRoleCode,
  EnterpriseLicenseMode,
  GovernanceMode,
  ImportExportDiagnosticReport,
  ModulePermissionKey,
  TrialAccountingSubAccess,
  TrialGovernanceConfig,
  TrialGovernanceStatusSnapshot,
  TrialManualStatusOverride,
} from '../../types/index.ts';
import { apiClient } from '../../services/apiClient';
import { isOwnerRoleCode } from '../../utils/rbac';
import {
  SUB_ROLE_GOVERNANCE_GROUPS,
  MODULE_GOVERNANCE_OPTIONS,
  addDaysToYmd,
  formatWibTimestamp,
} from '../../utils/trialGovernance';

interface TrialGovernancePanelProps {
  isLight: boolean;
  isSuperAdmin: boolean;
  cardClass: string;
  subCardClass: string;
  inputClass: string;
  labelClass: string;
  onShowToast: (title: string, message: string) => void;
  onGovernanceUpdated?: (snapshot: TrialGovernanceStatusSnapshot) => void;
  externalDiagnosticRefreshKey?: number;
}

const STATUS_BADGE_STYLES: Record<string, string> = {
  ACTIVE_TRIAL:
    'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60',
  EXPIRING_SOON:
    'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700/60',
  LOCKED_EXPIRED:
    'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-700/60',
  SUSPENDED:
    'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-700/60',
  CONVERTED_PAID:
    'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/60',
};

export const TrialGovernancePanel: React.FC<TrialGovernancePanelProps> = ({
  isLight,
  isSuperAdmin,
  cardClass,
  subCardClass,
  inputClass,
  labelClass,
  onShowToast,
  onGovernanceUpdated,
  externalDiagnosticRefreshKey = 0,
}) => {
  const [snapshot, setSnapshot] = useState<TrialGovernanceStatusSnapshot | null>(null);
  const [draftConfig, setDraftConfig] = useState<TrialGovernanceConfig | null>(null);
  const [diagnostics, setDiagnostics] = useState<ImportExportDiagnosticReport[]>([]);
  const [expandedDiagId, setExpandedDiagId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isRefreshingDiag, setIsRefreshingDiag] = useState<boolean>(false);

  const onGovernanceUpdatedRef = useRef(onGovernanceUpdated);
  onGovernanceUpdatedRef.current = onGovernanceUpdated;
  const onShowToastRef = useRef(onShowToast);
  onShowToastRef.current = onShowToast;
  const hasLoadedOnceRef = useRef(false);

  const loadGovernanceAndDiagnostics = useCallback(async () => {
    if (!hasLoadedOnceRef.current) {
      setIsLoading(true);
    }
    try {
      const [govRes, diagRes] = await Promise.all([
        apiClient.getTrialGovernance(),
        apiClient.getImportExportDiagnostics(),
      ]);
      if (govRes?.governance) {
        setSnapshot(govRes.governance);
        setDraftConfig(govRes.governance.config);
        onGovernanceUpdatedRef.current?.(govRes.governance);
      }
      if (Array.isArray(diagRes?.reports)) {
        setDiagnostics(diagRes.reports);
      }
      hasLoadedOnceRef.current = true;
    } catch (err: any) {
      onShowToastRef.current(
        'Governance Load Error',
        err?.message || 'Could not load Trial & Demo Governance settings.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshDiagnosticsOnly = useCallback(async () => {
    setIsRefreshingDiag(true);
    try {
      const [govRes, diagRes] = await Promise.all([
        apiClient.getTrialGovernance(),
        apiClient.getImportExportDiagnostics(),
      ]);
      if (govRes?.governance) {
        setSnapshot(govRes.governance);
        setDraftConfig(govRes.governance.config);
        onGovernanceUpdatedRef.current?.(govRes.governance);
      }
      if (Array.isArray(diagRes?.reports)) {
        setDiagnostics(diagRes.reports);
      }
    } finally {
      setIsRefreshingDiag(false);
    }
  }, []);

  useEffect(() => {
    loadGovernanceAndDiagnostics();
  }, [loadGovernanceAndDiagnostics]);

  useEffect(() => {
    if (externalDiagnosticRefreshKey > 0) {
      refreshDiagnosticsOnly();
    }
  }, [externalDiagnosticRefreshKey, refreshDiagnosticsOnly]);

  const handleSavePolicy = async () => {
    if (!draftConfig || !isSuperAdmin || isSaving) return;
    setIsSaving(true);
    try {
      const res = await apiClient.updateTrialGovernance(draftConfig);
      if (res.success && res.governance) {
        setSnapshot(res.governance);
        setDraftConfig(res.governance.config);
        onGovernanceUpdated?.(res.governance);
        onShowToast('Trial Governance Saved', res.message);
      }
    } catch (err: any) {
      onShowToast('Save Governance Failed', err?.message || 'Failed to persist Trial & Demo Governance policy.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = <K extends keyof TrialGovernanceConfig>(key: K, value: TrialGovernanceConfig[K]) => {
    setDraftConfig((prev) => {
      if (!prev) return prev;
      const next: TrialGovernanceConfig = { ...prev, [key]: value };
      if (key === 'startDateIso' || key === 'durationDays') {
        const start = key === 'startDateIso' ? String(value) : prev.startDateIso;
        const dur = key === 'durationDays' ? Number(value) : prev.durationDays;
        next.expirationDateIso = addDaysToYmd(start, Number.isFinite(dur) ? dur : 30);
      } else if (key === 'licenseMode') {
        const lm = value as EnterpriseLicenseMode;
        next.licenseMode = lm;
        if (lm === 'ENTERPRISE_PRODUCTION') {
          next.mode = 'PRODUCTION';
          if (prev.manualStatusOverride === 'LOCKED_EXPIRED') {
            next.manualStatusOverride = 'AUTO';
          }
        } else {
          if (prev.mode === 'PRODUCTION') {
            next.mode = 'TRIAL';
          }
        }
      } else if (key === 'mode') {
        const m = value as GovernanceMode;
        next.licenseMode = m === 'PRODUCTION' ? 'ENTERPRISE_PRODUCTION' : 'ACTIVE_TRIAL';
      }
      return next;
    });
  };

  const toggleSubRole = (roleCode: DivisionRoleCode, enabled: boolean) => {
    if (isOwnerRoleCode(roleCode)) return;
    setDraftConfig((prev) =>
      prev
        ? {
            ...prev,
            subRoleAccess: {
              ...prev.subRoleAccess,
              [roleCode]: enabled,
            },
          }
        : prev
    );
  };

  const setGroupSubRoles = (roles: DivisionRoleCode[], enabled: boolean) => {
    setDraftConfig((prev) => {
      if (!prev) return prev;
      const nextSub = { ...prev.subRoleAccess };
      roles.forEach((code) => {
        if (!isOwnerRoleCode(code)) nextSub[code] = enabled;
      });
      return { ...prev, subRoleAccess: nextSub };
    });
  };

  const toggleModuleAccess = (moduleKey: ModulePermissionKey, enabled: boolean) => {
    setDraftConfig((prev) =>
      prev
        ? {
            ...prev,
            moduleAccess: {
              ...prev.moduleAccess,
              [moduleKey]: enabled,
            },
          }
        : prev
    );
  };

  const toggleAccountingSubArea = (area: keyof TrialAccountingSubAccess, enabled: boolean) => {
    setDraftConfig((prev) =>
      prev
        ? {
            ...prev,
            accountingSubAccess: {
              ...prev.accountingSubAccess,
              [area]: enabled,
            },
          }
        : prev
    );
  };

  if (isLoading || !draftConfig || !snapshot) {
    return (
      <div className={`${cardClass} p-5 sm:p-6 lg:col-span-2`}>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Loading Trial / Demo Governance &amp; Import/Export Diagnostics...</span>
        </div>
      </div>
    );
  }

  const savedSubRoleOverlayOff = Object.entries(snapshot.config.subRoleAccess || {}).filter(
    ([code, allowed]) => !isOwnerRoleCode(code) && allowed === false
  ).length;
  const draftSubRoleOverlayOff = Object.entries(draftConfig.subRoleAccess || {}).filter(
    ([code, allowed]) => !isOwnerRoleCode(code) && allowed === false
  ).length;
  const disabledSubRoleCount = Math.max(
    draftSubRoleOverlayOff,
    (snapshot.rbacSummary?.restrictedSubRolesCount ?? savedSubRoleOverlayOff) +
      (draftSubRoleOverlayOff - savedSubRoleOverlayOff)
  );

  const savedModuleOverlayOff = Object.entries(snapshot.config.moduleAccess || {}).filter(
    ([, allowed]) => allowed === false
  ).length;
  const draftModuleOverlayOff = Object.entries(draftConfig.moduleAccess || {}).filter(
    ([, allowed]) => allowed === false
  ).length;
  const disabledModuleCount = Math.max(
    draftModuleOverlayOff,
    (snapshot.rbacSummary?.restrictedModulesCount ?? savedModuleOverlayOff) +
      (draftModuleOverlayOff - savedModuleOverlayOff)
  );

  const activeLicenseMode: EnterpriseLicenseMode =
    draftConfig.licenseMode === 'ENTERPRISE_PRODUCTION' || draftConfig.mode === 'PRODUCTION'
      ? 'ENTERPRISE_PRODUCTION'
      : 'ACTIVE_TRIAL';

  const parsedServerNowMs = Date.parse(snapshot.serverTimestampIso);
  const serverWibLabel =
    snapshot.serverTimestampWib ||
    formatWibTimestamp(Number.isFinite(parsedServerNowMs) ? parsedServerNowMs : Date.now());

  return (
    <div className={`${cardClass} p-5 sm:p-6 space-y-5 lg:col-span-2`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100">
                Trial / Demo Access Governance, Granular Sub-Role Controls &amp; Import/Export Diagnostics
              </h3>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                  STATUS_BADGE_STYLES[snapshot.effectiveStatus] || STATUS_BADGE_STYLES.ACTIVE_TRIAL
                }`}
              >
                {snapshot.effectiveStatus.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
              Server-enforced trial expiration lock, granular Inventory/Purchasing/Accounting sub-role restrictions, anti-competitor guardrails, and structured import/export error diagnostics (zero mutation on existing data).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isSuperAdmin && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <Lock className="w-3.5 h-3.5" /> Super Admin Only
            </span>
          )}
          <button
            type="button"
            disabled={!isSuperAdmin || isSaving}
            onClick={handleSavePolicy}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#0F4C3A] hover:bg-[#0b3a2c] text-white disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving Policy...' : 'Save Governance Policy'}</span>
          </button>
        </div>
      </div>

      {/* Live Authoritative Server Status Banner */}
      <div
        className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
          snapshot.isOperationalLocked
            ? 'bg-rose-50/80 border-rose-200 text-rose-900 dark:bg-rose-950/30 dark:border-rose-800/60 dark:text-rose-200'
            : snapshot.isExpiringSoon
            ? 'bg-amber-50/80 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800/60 dark:text-amber-200'
            : isLight
            ? 'bg-slate-50 border-slate-200 text-slate-800'
            : 'bg-[#090A0F] border-slate-800/80 text-slate-200'
        }`}
      >
        <div className="flex items-start gap-2.5">
          {snapshot.isOperationalLocked ? (
            <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          ) : snapshot.isExpiringSoon ? (
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          ) : (
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          )}
          <div>
            <p className="font-semibold">{snapshot.statusMessage}</p>
            <p className="text-[11px] opacity-80 mt-0.5 font-mono">
              Server Clock (UTC): {snapshot.serverTimestampIso.replace('T', ' ').slice(0, 19)} | WIB (UTC+7):{' '}
              {serverWibLabel} | Expires: {snapshot.expiresAtIso.slice(0, 10)} | Restricted Sub-Roles:{' '}
              {disabledSubRoleCount} | Restricted Modules: {disabledModuleCount}
            </p>
          </div>
        </div>
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 shrink-0">
          {snapshot.isOperationalLocked
            ? 'Locked (Data Preserved)'
            : activeLicenseMode === 'ENTERPRISE_PRODUCTION'
            ? 'Enterprise Production'
            : `${snapshot.daysRemaining}d remaining`}
        </span>
      </div>

      {/* Block 1 & Block 2: Lifecycle Controls + Security Guardrails */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 1. Trial & Demo Lifecycle Schedule */}
        <div className={`${subCardClass} space-y-3.5`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              <Clock className="w-3.5 h-3.5" />
              <span>1. Trial Duration, Expiration &amp; Lock State</span>
            </div>
            <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold cursor-pointer">
              <input
                type="checkbox"
                disabled={!isSuperAdmin}
                checked={draftConfig.enforceRestrictions}
                onChange={(e) => updateField('enforceRestrictions', e.target.checked)}
                className="rounded border-slate-300 text-[#0F4C3A] focus:ring-[#0F4C3A]"
              />
              <span>Enforce Guards</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>License Mode</label>
              <select
                disabled={!isSuperAdmin}
                value={activeLicenseMode}
                onChange={(e) => updateField('licenseMode', e.target.value as EnterpriseLicenseMode)}
                className={inputClass}
              >
                <option value="ACTIVE_TRIAL">ACTIVE_TRIAL (30/31-Day Evaluation)</option>
                <option value="ENTERPRISE_PRODUCTION">ENTERPRISE_PRODUCTION (No Trial Lockout)</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Workspace Governance Mode</label>
              <select
                disabled={!isSuperAdmin}
                value={draftConfig.mode}
                onChange={(e) => updateField('mode', e.target.value as GovernanceMode)}
                className={inputClass}
              >
                <option value="TRIAL">TRIAL (Time-Limited Evaluation)</option>
                <option value="DEMO">DEMO (Restricted External Showcase)</option>
                <option value="PRODUCTION">PRODUCTION (Converted Paid / Unrestricted)</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Manual Lock / Lifecycle State</label>
              <select
                disabled={!isSuperAdmin}
                value={draftConfig.manualStatusOverride}
                onChange={(e) => updateField('manualStatusOverride', e.target.value as TrialManualStatusOverride)}
                className={inputClass}
              >
                <option value="AUTO">AUTO (Evaluate from Server Clock)</option>
                <option value="ACTIVE_TRIAL">ACTIVE_TRIAL</option>
                <option value="EXPIRING_SOON">EXPIRING_SOON (Show Warning)</option>
                <option value="LOCKED_EXPIRED">LOCKED_EXPIRED (Lock Operations)</option>
                <option value="SUSPENDED">SUSPENDED (Hard Lock Non-Owners)</option>
                <option value="CONVERTED_PAID">CONVERTED_PAID (License Active)</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Trial Start Date</label>
              <input
                type="date"
                disabled={!isSuperAdmin}
                value={draftConfig.startDateIso.slice(0, 10)}
                onChange={(e) => updateField('startDateIso', e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Trial Duration (Days)</label>
              <input
                type="number"
                min={0}
                max={3650}
                disabled={!isSuperAdmin}
                value={draftConfig.durationDays}
                onChange={(e) => updateField('durationDays', Math.max(0, Number(e.target.value) || 0))}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Expiration Date (Authoritative UTC)</label>
              <input
                type="date"
                disabled={!isSuperAdmin}
                value={draftConfig.expirationDateIso.slice(0, 10)}
                onChange={(e) => updateField('expirationDateIso', e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>Warn Days</label>
                <input
                  type="number"
                  min={0}
                  max={90}
                  disabled={!isSuperAdmin}
                  value={draftConfig.warningWindowDays}
                  onChange={(e) => updateField('warningWindowDays', Math.max(0, Number(e.target.value) || 0))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Grace Hours</label>
                <input
                  type="number"
                  min={0}
                  max={720}
                  disabled={!isSuperAdmin}
                  value={draftConfig.graceHours}
                  onChange={(e) => updateField('graceHours', Math.max(0, Number(e.target.value) || 0))}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            Expiration is validated strictly against the backend server clock. When locked, non-owner operational access returns HTTP 403 while all stored transactions, stock, and user accounts remain untouched. Super Admin always retains recovery access.
          </p>
        </div>

        {/* 2. Anti-Competitor, Session Isolation & Demo Guardrails */}
        <div className={`${subCardClass} space-y-3.5`}>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            <Lock className="w-3.5 h-3.5" />
            <span>2. Demo Security, Session Isolation &amp; Export Guardrails</span>
          </div>

          <div className="space-y-2 text-xs">
            {[
              {
                key: 'allowDemoQuickFill' as const,
                title: 'Allow Login Quick-Fill Demo Directory (14 Divisions)',
                desc: 'Disable during external competitor evaluations to hide the demo email directory at /api/auth/demo-accounts.',
              },
              {
                key: 'allowLegacyQuickIds' as const,
                title: 'Allow Legacy Employee ID Quick Login',
                desc: 'Require Email + Password authentication instead of quick USR-* ID buttons.',
              },
              {
                key: 'restrictExternalExport' as const,
                title: 'Restrict External Data Exports (Non-Owner)',
                desc: 'Block JSON backup and Coretax CSV exports for non-Super Admin roles during trial/demo.',
              },
              {
                key: 'enforceSingleSessionPerUser' as const,
                title: 'Enforce Single Active Session per User',
                desc: 'Automatically revoke prior bearer tokens when the same account logs in from another device.',
              },
              {
                key: 'maskSensitiveWorkflowMetadata' as const,
                title: 'Mask Sensitive Workflow Metadata',
                desc: 'Minimize internal schema metadata exposure in demo/trial responses.',
              },
            ].map((item) => (
              <label
                key={item.key}
                className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-colors ${
                  isLight
                    ? 'bg-white border-slate-200 hover:bg-slate-50'
                    : 'bg-[#12141C] border-slate-800/80 hover:bg-slate-900'
                }`}
              >
                <input
                  type="checkbox"
                  disabled={!isSuperAdmin}
                  checked={Boolean(draftConfig[item.key])}
                  onChange={(e) => updateField(item.key, e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-[#0F4C3A] focus:ring-[#0F4C3A]"
                />
                <div className="leading-tight">
                  <span className="font-semibold text-gray-900 dark:text-slate-100 block">{item.title}</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">{item.desc}</span>
                </div>
              </label>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className={labelClass}>Max Trial Import Rows / Batch</label>
              <input
                type="number"
                min={1}
                max={50000}
                disabled={!isSuperAdmin}
                value={draftConfig.maxTrialImportRows}
                onChange={(e) => updateField('maxTrialImportRows', Math.max(1, Number(e.target.value) || 500))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Session Timeout (Minutes)</label>
              <input
                type="number"
                min={5}
                max={1440}
                disabled={!isSuperAdmin}
                value={draftConfig.demoSessionTimeoutMinutes}
                onChange={(e) =>
                  updateField('demoSessionTimeoutMinutes', Math.max(5, Number(e.target.value) || 120))
                }
                className={inputClass}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Block 3: Granular Sub-Role Access Matrix (Inventory, Purchasing, Accounting, Store/Frontline) */}
      <div className={`${subCardClass} space-y-4`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            <Users className="w-3.5 h-3.5" />
            <span>3. Granular Sub-Role &amp; Division Access Checkboxes (Runtime Overlay)</span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Unchecked sub-roles are blocked at login, UI navigation, and backend API middleware without modifying stored user accounts.
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {SUB_ROLE_GOVERNANCE_GROUPS.map((group) => {
            const groupCodes = group.roles.map((r) => r.roleCode);
            const allEnabled = groupCodes.every((code) => draftConfig.subRoleAccess?.[code] !== false);
            return (
              <div
                key={group.groupId}
                className={`p-3.5 rounded-xl border space-y-2.5 ${
                  isLight ? 'bg-white border-slate-200' : 'bg-[#12141C] border-slate-800/80'
                }`}
              >
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800/80">
                  <div>
                    <div className="text-xs font-bold text-gray-900 dark:text-slate-100">{group.title}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">{group.description}</div>
                  </div>
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => setGroupSubRoles(groupCodes, !allEnabled)}
                      className="px-2 py-1 rounded-lg text-[10px] font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer shrink-0"
                    >
                      {allEnabled ? 'Restrict All' : 'Enable All'}
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  {group.roles.map((role) => {
                    const isChecked = draftConfig.subRoleAccess?.[role.roleCode] !== false;
                    return (
                      <label
                        key={role.roleCode}
                        className="flex items-start justify-between gap-2 text-xs py-1 px-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900/60 cursor-pointer"
                      >
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            disabled={!isSuperAdmin}
                            checked={isChecked}
                            onChange={(e) => toggleSubRole(role.roleCode, e.target.checked)}
                            className="mt-0.5 rounded border-slate-300 text-[#0F4C3A] focus:ring-[#0F4C3A]"
                          />
                          <div className="leading-tight">
                            <span className="font-semibold text-gray-900 dark:text-slate-100">{role.label}</span>
                            <span className="text-[10px] font-mono text-slate-400 ml-1.5">{role.roleCode}</span>
                            <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                              {role.sublabel}
                            </span>
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                            isChecked
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                          }`}
                        >
                          {isChecked ? 'Allowed' : 'Restricted'}
                        </span>
                      </label>
                    );
                  })}
                </div>

                {/* Accounting Sub-Area Checkboxes inside Accounting Group */}
                {group.groupId === 'accounting' && (
                  <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800/80">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                      Accounting Sub-Module Capability Gates
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                      {(
                        [
                          { key: 'ar', label: 'AR (Receivables & Giro)' },
                          { key: 'ap', label: 'AP (Vendor Bills)' },
                          { key: 'glTax', label: 'GL, COA & Coretax' },
                          { key: 'financeApproval', label: 'Finance Payment Release' },
                        ] as const
                      ).map((sub) => (
                        <label
                          key={sub.key}
                          className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 dark:bg-[#090A0F] border border-slate-200 dark:border-slate-800/80 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            disabled={!isSuperAdmin}
                            checked={draftConfig.accountingSubAccess?.[sub.key] !== false}
                            onChange={(e) => toggleAccountingSubArea(sub.key, e.target.checked)}
                            className="rounded border-slate-300 text-[#0F4C3A] focus:ring-[#0F4C3A]"
                          />
                          <span className="font-medium text-slate-700 dark:text-slate-200 truncate">{sub.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Module-Level Feature Toggles */}
        <div className="pt-2">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
            <Layers className="w-3.5 h-3.5" />
            <span>Module-Level Trial / Demo Visibility &amp; API Gates</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {MODULE_GOVERNANCE_OPTIONS.map((mod) => {
              const isEnabled = draftConfig.moduleAccess?.[mod.key] !== false;
              return (
                <label
                  key={mod.key}
                  className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                    isEnabled
                      ? isLight
                        ? 'bg-white border-slate-200 text-slate-800'
                        : 'bg-[#12141C] border-slate-800/80 text-slate-200'
                      : 'bg-rose-50/60 border-rose-200 text-rose-800 dark:bg-rose-950/30 dark:border-rose-800/60 dark:text-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      disabled={!isSuperAdmin}
                      checked={isEnabled}
                      onChange={(e) => toggleModuleAccess(mod.key, e.target.checked)}
                      className="rounded border-slate-300 text-[#0F4C3A] focus:ring-[#0F4C3A] shrink-0"
                    />
                    <span className="font-semibold truncate">{mod.label}</span>
                  </div>
                  {isEnabled ? (
                    <Unlock className="w-3 h-3 text-emerald-600 shrink-0" />
                  ) : (
                    <Lock className="w-3 h-3 text-rose-600 shrink-0" />
                  )}
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {/* Block 4: Import & Export Error Analysis & Structured Diagnostics Log */}
      <div className={`${subCardClass} space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
            <FileWarning className="w-3.5 h-3.5" />
            <span>4. Import &amp; Export Error Analysis &amp; Diagnostic Log</span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {diagnostics.length} report(s)
            </span>
          </div>
          <button
            type="button"
            onClick={refreshDiagnosticsOnly}
            disabled={isRefreshingDiag}
            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshingDiag ? 'animate-spin' : ''}`} />
            <span>Refresh Diagnostics</span>
          </button>
        </div>

        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Every failed or partially invalid Snapshot Restore, Bulk CSV/Excel Inventory Import, or Restricted Export generates a structured root-cause and remediation report below without altering existing buttons or healthy workflows.
        </p>

        {diagnostics.length === 0 ? (
          <div
            className={`p-4 rounded-xl border text-xs flex items-center gap-2 ${
              isLight
                ? 'bg-white border-slate-200 text-slate-500'
                : 'bg-[#12141C] border-slate-800/80 text-slate-400'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>No import or export errors recorded in the current session. All operations are healthy.</span>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {diagnostics.slice(0, 15).map((rep) => {
              const isExpanded = expandedDiagId === rep.id;
              return (
                <div
                  key={rep.id}
                  className={`rounded-xl border text-xs overflow-hidden ${
                    isLight ? 'bg-white border-slate-200' : 'bg-[#12141C] border-slate-800/80'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedDiagId(isExpanded ? null : rep.id)}
                    className="w-full px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-left hover:bg-slate-50 dark:hover:bg-slate-900/60 cursor-pointer"
                  >
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          rep.operation === 'IMPORT'
                            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                            : 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                        }`}
                      >
                        {rep.operation}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          rep.errorCount > 0
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                        }`}
                      >
                        {rep.errorCount} err / {rep.warningCount} warn
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-slate-100 truncate">
                        {rep.source}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        — {rep.summary}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-[10px] font-mono text-slate-400">
                      <span>{rep.timestamp.replace('T', ' ').slice(0, 19)}</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-3.5 pb-3 pt-1 border-t border-slate-100 dark:border-slate-800/80 space-y-2 bg-slate-50/70 dark:bg-[#090A0F]">
                      {rep.issues.map((issue, idx) => (
                        <div
                          key={`${rep.id}-${idx}`}
                          className={`p-2.5 rounded-lg border text-[11px] space-y-1 ${
                            issue.severity === 'error'
                              ? 'bg-rose-50/60 border-rose-200 dark:bg-rose-950/25 dark:border-rose-900/60'
                              : 'bg-amber-50/60 border-amber-200 dark:bg-amber-950/25 dark:border-amber-900/60'
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-white/80 dark:bg-slate-900 text-rose-700 dark:text-rose-300">
                              {issue.errorType}
                            </span>
                            <span className="font-semibold text-gray-900 dark:text-slate-100">
                              {issue.reference}
                              {issue.field ? ` • field: ${issue.field}` : ''}
                            </span>
                          </div>
                          <p className="text-slate-700 dark:text-slate-200">
                            <strong>Root Cause:</strong> {issue.rootCause}
                          </p>
                          <p className="text-emerald-800 dark:text-emerald-300">
                            <strong>Remediation:</strong> {issue.remediationHint}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
