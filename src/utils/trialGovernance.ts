import type {
  DivisionRoleCode,
  EnterpriseLicenseMode,
  GovernanceMode,
  GovernanceRbacSummary,
  ModulePermissionKey,
  SystemUserAccount,
  TrialAccountingSubAccess,
  TrialGovernanceConfig,
  TrialGovernanceStatusSnapshot,
  TrialLifecycleStatus,
  TrialManualStatusOverride,
} from '../types/index.ts';
import { DIVISION_ROLE_CODES, DIVISION_ROLE_PRESETS, isOwnerRoleCode, MODULE_PERMISSION_KEYS } from './rbac.ts';

export const TRIAL_LIFECYCLE_STATUSES: TrialLifecycleStatus[] = [
  'ACTIVE_TRIAL',
  'EXPIRING_SOON',
  'LOCKED_EXPIRED',
  'CONVERTED_PAID',
  'SUSPENDED',
];

export const GOVERNANCE_MODES: GovernanceMode[] = ['TRIAL', 'DEMO', 'PRODUCTION'];

export const ENTERPRISE_LICENSE_MODES: EnterpriseLicenseMode[] = ['ENTERPRISE_PRODUCTION', 'ACTIVE_TRIAL'];

export interface SubRoleGovernanceOption {
  roleCode: DivisionRoleCode;
  label: string;
  sublabel: string;
}

export interface SubRoleGovernanceGroup {
  groupId: 'inventory' | 'purchasing' | 'accounting' | 'store_frontline';
  title: string;
  description: string;
  moduleKey: ModulePermissionKey;
  roles: SubRoleGovernanceOption[];
}

export const SUB_ROLE_GOVERNANCE_GROUPS: SubRoleGovernanceGroup[] = [
  {
    groupId: 'inventory',
    title: 'Inventory & Warehouse Sub-Roles',
    description: 'Control Inventory Admin, Head Gudang, and Warehouse Staff operational access.',
    moduleKey: 'inventory',
    roles: [
      {
        roleCode: 'WAREHOUSE_ADMIN',
        label: 'Inventory Admin',
        sublabel: 'Admin Gudang (Stock, Draft Import, Transfers)',
      },
      {
        roleCode: 'WAREHOUSE_HEAD',
        label: 'Head Gudang',
        sublabel: 'Kepala Gudang (Opname Approval & Adjustments)',
      },
      {
        roleCode: 'WAREHOUSE_STAFF',
        label: 'Warehouse Staff',
        sublabel: 'Staf Gudang (Receiving, Blind Count, Picking)',
      },
    ],
  },
  {
    groupId: 'purchasing',
    title: 'Purchasing & Procurement Sub-Roles',
    description: 'Control Purchasing Admin and Head Purchasing vendor & PO workflows.',
    moduleKey: 'procurement',
    roles: [
      {
        roleCode: 'PURCHASING_STAFF',
        label: 'Purchasing Admin',
        sublabel: 'Admin Purchasing (PR, Draft PO, Supplier Sourcing)',
      },
      {
        roleCode: 'PURCHASING_HEAD',
        label: 'Head Purchasing',
        sublabel: 'Kepala Purchasing (PO Approval & Tolerance Override)',
      },
    ],
  },
  {
    groupId: 'accounting',
    title: 'Accounting & Finance Sub-Roles',
    description: 'Granular control across Finance, Accounting Frontline, AR, AP, and Controller.',
    moduleKey: 'accounting',
    roles: [
      {
        roleCode: 'FINANCE_MANAGER',
        label: 'Finance',
        sublabel: 'Finance Manager (Treasury, Payment Release, Giro)',
      },
      {
        roleCode: 'ACCOUNTING_TAX',
        label: 'Accounting Frontline',
        sublabel: 'Accounting & Tax (GL, COA, Coretax, PPh)',
      },
      {
        roleCode: 'AR_STAFF',
        label: 'AR (Account Receivable)',
        sublabel: 'B2B Receivables, Credit Control & Giro Masuk',
      },
      {
        roleCode: 'AP_STAFF',
        label: 'AP (Account Payable)',
        sublabel: 'Vendor Bills, 3-Way Match & Payables Queue',
      },
      {
        roleCode: 'HEAD_ACCOUNTING',
        label: 'Head Accounting',
        sublabel: 'Accounting Controller (GL Reversal & Period Lock)',
      },
    ],
  },
  {
    groupId: 'store_frontline',
    title: 'Frontline Store & Quality Sub-Roles',
    description: 'Control Store Manager, POS Cashier, and Quality Control access.',
    moduleKey: 'pos',
    roles: [
      {
        roleCode: 'STORE_MANAGER',
        label: 'Store Manager',
        sublabel: 'Kepala Toko (Branch Ops & POS Approvals)',
      },
      {
        roleCode: 'POS_CASHIER',
        label: 'POS Cashier',
        sublabel: 'Kasir POS (Register Open/Close & Retail Checkout)',
      },
      {
        roleCode: 'QC_INSPECTOR',
        label: 'QC & Halal Inspector',
        sublabel: 'Cold-Chain, BPJPH Halal & Incoming Inspection',
      },
    ],
  },
];

export const MODULE_GOVERNANCE_OPTIONS: Array<{
  key: ModulePermissionKey;
  label: string;
  category: string;
}> = [
  { key: 'dashboard', label: 'Executive Dashboard', category: 'Core' },
  { key: 'pos', label: 'POS Terminal', category: 'Sales' },
  { key: 'inventory', label: 'Inventory & Multi-Warehouse', category: 'Supply Chain' },
  { key: 'procurement', label: 'Purchasing & PO', category: 'Supply Chain' },
  { key: 'accounting', label: 'Accounting & Finance', category: 'Finance' },
  { key: 'qualityControl', label: 'Quality Control & Halal', category: 'Supply Chain' },
  { key: 'logistics', label: 'Logistics & Surat Jalan', category: 'Supply Chain' },
  { key: 'warehouseTransfers', label: 'Inter-Warehouse Transfers', category: 'Supply Chain' },
  { key: 'wasteShrinkage', label: 'Waste & Shrinkage', category: 'Supply Chain' },
  { key: 'fulfillment', label: 'Picker & Fulfillment', category: 'Supply Chain' },
  { key: 'crm', label: 'CRM & Loyalty', category: 'Sales' },
  { key: 'quotations', label: 'B2B Quotations', category: 'Sales' },
  { key: 'outlets', label: 'Store & Outlet Operations', category: 'Core' },
  { key: 'approvalMatrix', label: 'Approval Matrix', category: 'Governance' },
  { key: 'analytics', label: 'Grocery Analytics & Reports', category: 'Core' },
  { key: 'fraudRadar', label: 'Fraud Radar & Audit Trail', category: 'Governance' },
  { key: 'settings', label: 'Enterprise Settings (Non-Owner)', category: 'Governance' },
];

export function formatIsoDateYmd(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function formatWibTimestamp(ms: number): string {
  const wibDate = new Date(ms + 7 * 60 * 60 * 1000);
  return `${wibDate.toISOString().replace('T', ' ').slice(0, 19)} WIB`;
}

export function computeRbacGovernanceSummary(
  systemUsers: SystemUserAccount[] = [],
  governanceConfig?: TrialGovernanceConfig | null
): GovernanceRbacSummary {
  const activeUsers = systemUsers.filter((u) => u && u.isActive !== false);
  const sourceUsers = activeUsers.length > 0 ? activeUsers : systemUsers;

  const roleCodesSet = new Set<DivisionRoleCode>();
  DIVISION_ROLE_CODES.forEach((code) => roleCodesSet.add(code));
  sourceUsers.forEach((u) => {
    if (u?.roleCode) roleCodesSet.add(u.roleCode);
  });

  const restrictedSubRoleCodes: DivisionRoleCode[] = [];
  const restrictedModuleKeysSet = new Set<ModulePermissionKey>();
  let totalModuleRestrictionRules = 0;
  let restrictedAccountingFlagsCount = 0;

  const cfgEnforces = governanceConfig?.enforceRestrictions !== false;
  const isProdMode =
    governanceConfig?.licenseMode === 'ENTERPRISE_PRODUCTION' ||
    (governanceConfig?.mode === 'PRODUCTION' && governanceConfig?.manualStatusOverride === 'AUTO');
  const overlayApplies = cfgEnforces && !isProdMode;

  roleCodesSet.forEach((roleCode) => {
    if (isOwnerRoleCode(roleCode)) return;

    const usersForRole = sourceUsers.filter((u) => u.roleCode === roleCode);
    const presetPerms = DIVISION_ROLE_PRESETS[roleCode]?.permissions;
    const isRoleOverlayDisabled = overlayApplies && governanceConfig?.subRoleAccess?.[roleCode] === false;

    let roleHasRestriction = isRoleOverlayDisabled;

    if (usersForRole.length === 0) {
      // Fallback to canonical preset if no active account currently assigned to this division role
      MODULE_PERMISSION_KEYS.forEach((modKey) => {
        const p = presetPerms?.[modKey];
        const isModOverlayDisabled = overlayApplies && governanceConfig?.moduleAccess?.[modKey] === false;
        const isFullPerm =
          !isRoleOverlayDisabled &&
          !isModOverlayDisabled &&
          p?.view === true &&
          p?.create === true &&
          p?.edit === true &&
          p?.approve === true &&
          p?.export === true;
        if (!isFullPerm) {
          roleHasRestriction = true;
          restrictedModuleKeysSet.add(modKey);
          totalModuleRestrictionRules += 1;
        }
      });

      const acct = presetPerms?.accounting;
      const acctFlags = [
        acct?.canAccessAR === true && !(overlayApplies && governanceConfig?.accountingSubAccess?.ar === false),
        acct?.canAccessAP === true && !(overlayApplies && governanceConfig?.accountingSubAccess?.ap === false),
        acct?.canAccessGLTax === true && !(overlayApplies && governanceConfig?.accountingSubAccess?.glTax === false),
        acct?.canApprovePayments === true &&
          !(overlayApplies && governanceConfig?.accountingSubAccess?.financeApproval === false),
        acct?.canLockPeriod === true,
      ];
      acctFlags.forEach((allowed) => {
        if (!allowed || isRoleOverlayDisabled) {
          roleHasRestriction = true;
          restrictedAccountingFlagsCount += 1;
        }
      });
    } else {
      MODULE_PERMISSION_KEYS.forEach((modKey) => {
        const isModOverlayDisabled = overlayApplies && governanceConfig?.moduleAccess?.[modKey] === false;
        const anyUserRestricted = usersForRole.some((u) => {
          const p = u.modulePermissions?.[modKey] || presetPerms?.[modKey];
          return (
            isRoleOverlayDisabled ||
            isModOverlayDisabled ||
            !p ||
            p.view !== true ||
            p.create !== true ||
            p.edit !== true ||
            p.approve !== true ||
            p.export !== true
          );
        });
        if (anyUserRestricted) {
          roleHasRestriction = true;
          restrictedModuleKeysSet.add(modKey);
          totalModuleRestrictionRules += 1;
        }
      });

      const accountingFlagKeys = [
        'canAccessAR',
        'canAccessAP',
        'canAccessGLTax',
        'canApprovePayments',
        'canLockPeriod',
      ] as const;

      accountingFlagKeys.forEach((flagKey) => {
        const overlayFlagDisabled =
          overlayApplies &&
          ((flagKey === 'canAccessAR' && governanceConfig?.accountingSubAccess?.ar === false) ||
            (flagKey === 'canAccessAP' && governanceConfig?.accountingSubAccess?.ap === false) ||
            (flagKey === 'canAccessGLTax' && governanceConfig?.accountingSubAccess?.glTax === false) ||
            (flagKey === 'canApprovePayments' && governanceConfig?.accountingSubAccess?.financeApproval === false));

        const anyUserFlagRestricted = usersForRole.some((u) => {
          const acct = u.modulePermissions?.accounting || presetPerms?.accounting;
          return isRoleOverlayDisabled || overlayFlagDisabled || acct?.[flagKey] !== true;
        });
        if (anyUserFlagRestricted) {
          roleHasRestriction = true;
          restrictedAccountingFlagsCount += 1;
        }
      });

      if (usersForRole.some((u) => u.hideFinancialCost === true || u.viewCost === false)) {
        roleHasRestriction = true;
      }
    }

    if (roleHasRestriction) {
      restrictedSubRoleCodes.push(roleCode);
    }
  });

  const totalRoles = roleCodesSet.size;
  const restrictedSubRolesCount = restrictedSubRoleCodes.length;
  const unrestrictedSubRolesCount = Math.max(0, totalRoles - restrictedSubRolesCount);
  const restrictedModuleKeys = Array.from(restrictedModuleKeysSet);

  return {
    totalRoles,
    restrictedSubRolesCount,
    unrestrictedSubRolesCount,
    restrictedModulesCount: totalModuleRestrictionRules,
    restrictedModuleSlotsCount: restrictedModuleKeys.length,
    totalModuleRestrictionRules,
    restrictedAccountingFlagsCount,
    restrictedSubRoleCodes,
    restrictedModuleKeys,
    computedFrom: 'SYSTEM_USERS_RBAC',
  };
}

export function addDaysToYmd(startYmd: string, days: number): string {
  const parsed = Date.parse(`${startYmd.slice(0, 10)}T00:00:00.000Z`);
  const baseMs = Number.isFinite(parsed) ? parsed : Date.now();
  const safeDays = Math.max(0, Math.min(3650, Math.floor(days)));
  return formatIsoDateYmd(baseMs + safeDays * 24 * 60 * 60 * 1000);
}

export function parseExpirationEndMs(expirationDateIso: string, startDateIso: string, durationDays: number): number {
  const raw = String(expirationDateIso || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const endOfDay = Date.parse(`${raw}T23:59:59.999Z`);
    if (Number.isFinite(endOfDay)) return endOfDay;
  } else if (raw) {
    const exact = Date.parse(raw);
    if (Number.isFinite(exact)) return exact;
  }
  const derivedYmd = addDaysToYmd(startDateIso || formatIsoDateYmd(Date.now()), durationDays || 30);
  return Date.parse(`${derivedYmd}T23:59:59.999Z`);
}

export function createDefaultTrialGovernanceConfig(nowMs: number = Date.now()): TrialGovernanceConfig {
  const startDateIso = formatIsoDateYmd(nowMs);
  const durationDays = 30;
  const expirationDateIso = addDaysToYmd(startDateIso, durationDays);

  const moduleAccess: Partial<Record<ModulePermissionKey, boolean>> = {};
  MODULE_PERMISSION_KEYS.forEach((key) => {
    moduleAccess[key] = true;
  });

  const subRoleAccess: Partial<Record<DivisionRoleCode, boolean>> = {};
  DIVISION_ROLE_CODES.forEach((code) => {
    subRoleAccess[code] = true;
  });

  return {
    mode: 'TRIAL',
    licenseMode: 'ACTIVE_TRIAL',
    enforceRestrictions: true,
    startDateIso,
    durationDays,
    expirationDateIso,
    warningWindowDays: 5,
    graceHours: 0,
    manualStatusOverride: 'AUTO',
    allowDemoQuickFill: true,
    allowLegacyQuickIds: true,
    restrictExternalExport: false,
    maxTrialImportRows: 500,
    maskSensitiveWorkflowMetadata: false,
    enforceSingleSessionPerUser: false,
    demoSessionTimeoutMinutes: 120,
    moduleAccess,
    subRoleAccess,
    accountingSubAccess: {
      ar: true,
      ap: true,
      glTax: true,
      financeApproval: true,
    },
    updatedAt: new Date(nowMs).toISOString(),
    updatedBy: 'System Default (Non-Destructive Baseline)',
  };
}

export function normalizeTrialGovernanceConfig(
  raw: Partial<TrialGovernanceConfig> | null | undefined,
  existing?: TrialGovernanceConfig,
  nowMs: number = Date.now()
): TrialGovernanceConfig {
  const base = existing || createDefaultTrialGovernanceConfig(nowMs);
  if (!raw || typeof raw !== 'object') return base;

  const baseLicenseMode: EnterpriseLicenseMode =
    base.licenseMode === 'ENTERPRISE_PRODUCTION' || base.mode === 'PRODUCTION'
      ? 'ENTERPRISE_PRODUCTION'
      : 'ACTIVE_TRIAL';

  let mode: GovernanceMode = GOVERNANCE_MODES.includes(raw.mode as GovernanceMode)
    ? (raw.mode as GovernanceMode)
    : base.mode;

  let licenseMode: EnterpriseLicenseMode = ENTERPRISE_LICENSE_MODES.includes(raw.licenseMode as EnterpriseLicenseMode)
    ? (raw.licenseMode as EnterpriseLicenseMode)
    : baseLicenseMode;

  const explicitLicenseChanged =
    ENTERPRISE_LICENSE_MODES.includes(raw.licenseMode as EnterpriseLicenseMode) && raw.licenseMode !== baseLicenseMode;
  const explicitModeChanged = GOVERNANCE_MODES.includes(raw.mode as GovernanceMode) && raw.mode !== base.mode;

  if (explicitLicenseChanged && !explicitModeChanged) {
    mode = licenseMode === 'ENTERPRISE_PRODUCTION' ? 'PRODUCTION' : base.mode === 'DEMO' ? 'DEMO' : 'TRIAL';
  } else if (explicitModeChanged && !explicitLicenseChanged) {
    licenseMode = mode === 'PRODUCTION' ? 'ENTERPRISE_PRODUCTION' : 'ACTIVE_TRIAL';
  } else if (raw.licenseMode === 'ENTERPRISE_PRODUCTION' && raw.mode === undefined) {
    mode = 'PRODUCTION';
  } else if (raw.licenseMode === 'ACTIVE_TRIAL' && raw.mode === undefined && mode === 'PRODUCTION') {
    mode = 'TRIAL';
  } else if (raw.mode === 'PRODUCTION' && raw.licenseMode === undefined) {
    licenseMode = 'ENTERPRISE_PRODUCTION';
  }

  const validOverrides: TrialManualStatusOverride[] = ['AUTO', ...TRIAL_LIFECYCLE_STATUSES];
  let manualStatusOverride: TrialManualStatusOverride = validOverrides.includes(
    raw.manualStatusOverride as TrialManualStatusOverride
  )
    ? (raw.manualStatusOverride as TrialManualStatusOverride)
    : base.manualStatusOverride;

  if (
    licenseMode === 'ENTERPRISE_PRODUCTION' &&
    raw.manualStatusOverride === undefined &&
    base.manualStatusOverride === 'LOCKED_EXPIRED'
  ) {
    manualStatusOverride = 'AUTO';
  }

  const startDateIso =
    typeof raw.startDateIso === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw.startDateIso.trim())
      ? raw.startDateIso.trim().slice(0, 10)
      : base.startDateIso;

  const durationDays =
    typeof raw.durationDays === 'number' && Number.isFinite(raw.durationDays)
      ? Math.max(0, Math.min(3650, Math.round(raw.durationDays)))
      : base.durationDays;

  let expirationDateIso = base.expirationDateIso;
  if (typeof raw.expirationDateIso === 'string' && raw.expirationDateIso.trim().length >= 10) {
    const trimmed = raw.expirationDateIso.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed) || Number.isFinite(Date.parse(trimmed))) {
      expirationDateIso = trimmed;
    }
  } else if (raw.startDateIso !== undefined || raw.durationDays !== undefined) {
    expirationDateIso = addDaysToYmd(startDateIso, durationDays);
  }

  const warningWindowDays =
    typeof raw.warningWindowDays === 'number' && Number.isFinite(raw.warningWindowDays)
      ? Math.max(0, Math.min(90, Math.round(raw.warningWindowDays)))
      : base.warningWindowDays;

  const graceHours =
    typeof raw.graceHours === 'number' && Number.isFinite(raw.graceHours)
      ? Math.max(0, Math.min(720, Math.round(raw.graceHours)))
      : base.graceHours;

  const maxTrialImportRows =
    typeof raw.maxTrialImportRows === 'number' && Number.isFinite(raw.maxTrialImportRows)
      ? Math.max(1, Math.min(50000, Math.round(raw.maxTrialImportRows)))
      : base.maxTrialImportRows;

  const demoSessionTimeoutMinutes =
    typeof raw.demoSessionTimeoutMinutes === 'number' && Number.isFinite(raw.demoSessionTimeoutMinutes)
      ? Math.max(5, Math.min(1440, Math.round(raw.demoSessionTimeoutMinutes)))
      : base.demoSessionTimeoutMinutes;

  const moduleAccess: Partial<Record<ModulePermissionKey, boolean>> = { ...base.moduleAccess };
  if (raw.moduleAccess && typeof raw.moduleAccess === 'object') {
    MODULE_PERMISSION_KEYS.forEach((key) => {
      if (typeof raw.moduleAccess?.[key] === 'boolean') {
        moduleAccess[key] = raw.moduleAccess[key];
      }
    });
  }

  const subRoleAccess: Partial<Record<DivisionRoleCode, boolean>> = { ...base.subRoleAccess };
  if (raw.subRoleAccess && typeof raw.subRoleAccess === 'object') {
    DIVISION_ROLE_CODES.forEach((code) => {
      if (typeof raw.subRoleAccess?.[code] === 'boolean') {
        subRoleAccess[code] = raw.subRoleAccess[code];
      }
    });
  }
  // Owners can never be locked out of recovery & governance controls
  subRoleAccess.SUPER_ADMIN = true;
  subRoleAccess.PLATFORM_OWNER = true;
  subRoleAccess.CLIENT_OWNER = true;

  const accountingSubAccess: TrialAccountingSubAccess = {
    ar: typeof raw.accountingSubAccess?.ar === 'boolean' ? raw.accountingSubAccess.ar : base.accountingSubAccess.ar,
    ap: typeof raw.accountingSubAccess?.ap === 'boolean' ? raw.accountingSubAccess.ap : base.accountingSubAccess.ap,
    glTax:
      typeof raw.accountingSubAccess?.glTax === 'boolean'
        ? raw.accountingSubAccess.glTax
        : base.accountingSubAccess.glTax,
    financeApproval:
      typeof raw.accountingSubAccess?.financeApproval === 'boolean'
        ? raw.accountingSubAccess.financeApproval
        : base.accountingSubAccess.financeApproval,
  };

  return {
    mode,
    licenseMode,
    enforceRestrictions:
      typeof raw.enforceRestrictions === 'boolean' ? raw.enforceRestrictions : base.enforceRestrictions,
    startDateIso,
    durationDays,
    expirationDateIso,
    warningWindowDays,
    graceHours,
    manualStatusOverride,
    allowDemoQuickFill:
      typeof raw.allowDemoQuickFill === 'boolean' ? raw.allowDemoQuickFill : base.allowDemoQuickFill,
    allowLegacyQuickIds:
      typeof raw.allowLegacyQuickIds === 'boolean' ? raw.allowLegacyQuickIds : base.allowLegacyQuickIds,
    restrictExternalExport:
      typeof raw.restrictExternalExport === 'boolean' ? raw.restrictExternalExport : base.restrictExternalExport,
    maxTrialImportRows,
    maskSensitiveWorkflowMetadata:
      typeof raw.maskSensitiveWorkflowMetadata === 'boolean'
        ? raw.maskSensitiveWorkflowMetadata
        : base.maskSensitiveWorkflowMetadata,
    enforceSingleSessionPerUser:
      typeof raw.enforceSingleSessionPerUser === 'boolean'
        ? raw.enforceSingleSessionPerUser
        : base.enforceSingleSessionPerUser,
    demoSessionTimeoutMinutes,
    moduleAccess,
    subRoleAccess,
    accountingSubAccess,
    updatedAt: typeof raw.updatedAt === 'string' && raw.updatedAt ? raw.updatedAt : base.updatedAt,
    updatedBy: typeof raw.updatedBy === 'string' && raw.updatedBy ? raw.updatedBy : base.updatedBy,
  };
}

export function evaluateTrialGovernanceSnapshot(
  config: TrialGovernanceConfig,
  serverNowMs: number = Date.now(),
  rbacSummary?: GovernanceRbacSummary
): TrialGovernanceStatusSnapshot {
  const expiresAtMs = parseExpirationEndMs(config.expirationDateIso, config.startDateIso, config.durationDays);
  const graceEndsAtMs = expiresAtMs + Math.max(0, config.graceHours) * 60 * 60 * 1000;
  const remainingMs = expiresAtMs - serverNowMs;
  const remainingWithGraceMs = graceEndsAtMs - serverNowMs;

  const hoursRemaining = Math.ceil(remainingWithGraceMs / (60 * 60 * 1000));
  const daysRemaining = Math.ceil(remainingWithGraceMs / (24 * 60 * 60 * 1000));
  const isInGraceWindow = remainingMs < 0 && remainingWithGraceMs >= 0 && config.graceHours > 0;

  const resolvedLicenseMode: EnterpriseLicenseMode =
    config.licenseMode === 'ENTERPRISE_PRODUCTION' || config.mode === 'PRODUCTION'
      ? 'ENTERPRISE_PRODUCTION'
      : 'ACTIVE_TRIAL';

  let effectiveStatus: TrialLifecycleStatus;
  if (resolvedLicenseMode === 'ENTERPRISE_PRODUCTION') {
    effectiveStatus = config.manualStatusOverride === 'SUSPENDED' ? 'SUSPENDED' : 'CONVERTED_PAID';
  } else if (config.manualStatusOverride && config.manualStatusOverride !== 'AUTO') {
    effectiveStatus = config.manualStatusOverride;
  } else if (remainingWithGraceMs < 0) {
    effectiveStatus = 'LOCKED_EXPIRED';
  } else if (isInGraceWindow || daysRemaining <= Math.max(0, config.warningWindowDays)) {
    effectiveStatus = 'EXPIRING_SOON';
  } else {
    effectiveStatus = 'ACTIVE_TRIAL';
  }

  const isOperationalLocked =
    config.enforceRestrictions && (effectiveStatus === 'LOCKED_EXPIRED' || effectiveStatus === 'SUSPENDED');
  const isExpiringSoon = effectiveStatus === 'EXPIRING_SOON';

  let statusMessage = '';
  switch (effectiveStatus) {
    case 'CONVERTED_PAID':
      statusMessage =
        'Enterprise License Active (ENTERPRISE_PRODUCTION Mode). 31-day trial expiration lockout disabled.';
      break;
    case 'SUSPENDED':
      statusMessage =
        'Workspace access is suspended by Enterprise Governance. All operational data remains safely preserved.';
      break;
    case 'LOCKED_EXPIRED':
      statusMessage =
        'Trial / Demo evaluation period has expired. Operational access is locked while all stored data remains intact. Contact Super Admin to extend or convert.';
      break;
    case 'EXPIRING_SOON':
      statusMessage = isInGraceWindow
        ? `Trial period has ended and is currently in grace window (${Math.max(0, hoursRemaining)} hour(s) remaining before lockout).`
        : `Trial period is expiring soon (${Math.max(0, daysRemaining)} day(s) remaining until ${new Date(expiresAtMs).toISOString().slice(0, 10)}).`;
      break;
    default:
      statusMessage = `Active ${config.mode} (${resolvedLicenseMode}) access — ${Math.max(0, daysRemaining)} day(s) remaining (expires ${new Date(expiresAtMs).toISOString().slice(0, 10)}).`;
      break;
  }

  const normalizedConfig: TrialGovernanceConfig =
    config.licenseMode === resolvedLicenseMode ? config : { ...config, licenseMode: resolvedLicenseMode };

  return {
    config: normalizedConfig,
    licenseMode: resolvedLicenseMode,
    effectiveStatus,
    serverTimestampIso: new Date(serverNowMs).toISOString(),
    serverTimestampWib: formatWibTimestamp(serverNowMs),
    expiresAtIso: new Date(expiresAtMs).toISOString(),
    graceEndsAtIso: new Date(graceEndsAtMs).toISOString(),
    daysRemaining: Math.max(0, daysRemaining),
    hoursRemaining: Math.max(0, hoursRemaining),
    isOperationalLocked,
    isExpiringSoon,
    isInGraceWindow,
    statusMessage,
    ...(rbacSummary ? { rbacSummary } : {}),
  };
}

export function isSubRoleAllowedByGovernance(
  governance: TrialGovernanceStatusSnapshot | TrialGovernanceConfig | null | undefined,
  roleCode?: DivisionRoleCode | null
): boolean {
  if (!governance || !roleCode || isOwnerRoleCode(roleCode)) return true;
  const cfg = 'config' in governance ? governance.config : governance;
  if (!cfg.enforceRestrictions) return true;
  if ((cfg.mode === 'PRODUCTION' || cfg.licenseMode === 'ENTERPRISE_PRODUCTION') && cfg.manualStatusOverride === 'AUTO') {
    return true;
  }
  return cfg.subRoleAccess?.[roleCode] !== false;
}

export function isModuleAllowedByGovernance(
  governance: TrialGovernanceStatusSnapshot | TrialGovernanceConfig | null | undefined,
  moduleKey: ModulePermissionKey,
  roleCode?: DivisionRoleCode | null
): boolean {
  if (!governance || isOwnerRoleCode(roleCode)) return true;
  const cfg = 'config' in governance ? governance.config : governance;
  if (!cfg.enforceRestrictions) return true;
  if ((cfg.mode === 'PRODUCTION' || cfg.licenseMode === 'ENTERPRISE_PRODUCTION') && cfg.manualStatusOverride === 'AUTO') {
    return true;
  }
  return cfg.moduleAccess?.[moduleKey] !== false;
}

export function isAccountingAreaAllowedByGovernance(
  governance: TrialGovernanceStatusSnapshot | TrialGovernanceConfig | null | undefined,
  area: keyof TrialAccountingSubAccess,
  roleCode?: DivisionRoleCode | null
): boolean {
  if (!governance || isOwnerRoleCode(roleCode)) return true;
  const cfg = 'config' in governance ? governance.config : governance;
  if (!cfg.enforceRestrictions) return true;
  if ((cfg.mode === 'PRODUCTION' || cfg.licenseMode === 'ENTERPRISE_PRODUCTION') && cfg.manualStatusOverride === 'AUTO') {
    return true;
  }
  if (cfg.moduleAccess?.accounting === false) return false;
  return cfg.accountingSubAccess?.[area] !== false;
}

export function mapDashboardTabToGovernanceModule(tab: string): ModulePermissionKey | null {
  switch (tab) {
    case 'overview':
      return 'dashboard';
    case 'pos':
      return 'pos';
    case 'crm':
      return 'crm';
    case 'operations':
      return 'outlets';
    case 'inventory':
    case 'fefo':
      return 'inventory';
    case 'waste':
      return 'wasteShrinkage';
    case 'picker':
      return 'fulfillment';
    case 'procurement':
      return 'procurement';
    case 'quotations':
      return 'quotations';
    case 'qc':
      return 'qualityControl';
    case 'logistics':
      return 'logistics';
    case 'transfers':
      return 'warehouseTransfers';
    case 'approvals':
      return 'approvalMatrix';
    case 'reports':
      return 'analytics';
    case 'accounting':
      return 'accounting';
    case 'settings':
    case 'rbac':
      return 'settings';
    case 'audit':
      return 'fraudRadar';
    default:
      return null;
  }
}

export function mapAccountingSubTabToGovernanceArea(subTab: string): keyof TrialAccountingSubAccess | null {
  switch (subTab) {
    case 'b2b_ar':
      return 'ar';
    case 'vendor_bills':
    case 'consignment':
      return 'ap';
    case 'pnl':
    case 'balance_sheet':
    case 'cash_flow':
    case 'gl':
    case 'coa':
    case 'analytic_budgets':
    case 'margin_analysis':
      return 'glTax';
    default:
      return null;
  }
}
