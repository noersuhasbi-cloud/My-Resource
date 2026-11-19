import type {
  DivisionRoleCode,
  ModulePermissionAction,
  ModulePermissionKey,
  ModulePermissionSet,
  ModulePermissionsMap,
  StaffShiftSession,
  UserRole,
} from '../types/index.ts';
import type { AdminDashboardTab } from '../components/AdminDashboard/AdminSidebar';

export type CanonicalEnterpriseRole =
  | 'cashier'
  | 'warehouse'
  | 'purchasing'
  | 'store_manager'
  | 'admin'
  | 'coo'
  | 'super_admin';

export const MODULE_PERMISSION_KEYS: ModulePermissionKey[] = [
  'pos',
  'inventory',
  'warehouseTransfers',
  'procurement',
  'qualityControl',
  'crm',
  'logistics',
  'accounting',
  'ar',
  'ap',
  'approvalMatrix',
  'fraudRadar',
  'settings',
];

export const MODULE_PERMISSION_META: Array<{
  key: ModulePermissionKey;
  label: string;
  category: string;
  description: string;
}> = [
  { key: 'pos', label: 'POS Cashier & Register', category: 'Frontline', description: 'Checkout, Split Payment, Ojol, Scale Barcode, Z-Report & Paid-Out' },
  { key: 'inventory', label: 'Multi-Warehouse & Stock', category: 'Warehouse', description: 'Stock Quants, FEFO/FIFO, Blind Opname, Waste, Markdown & Batch Recall' },
  { key: 'warehouseTransfers', label: 'Warehouse Transfers', category: 'Warehouse', description: 'Inter-warehouse transfer dispatch, double sign-off & transfer loss' },
  { key: 'procurement', label: 'Purchasing & Procurement', category: 'Supply Chain', description: 'Demand Forecast, PR/PO, FOC/SPSI, Rafaksi Debit Notes & Goods Receipt' },
  { key: 'qualityControl', label: 'Quality Control & Halal', category: 'Quality', description: 'GR Quality/Cold-Chain/Halal BPJPH Inspection & Quarantine/Release' },
  { key: 'crm', label: 'CRM, B2B & Claims', category: 'Commercial', description: 'Member lookup, B2B Credit Limit, Quotations & Freshness Claims' },
  { key: 'logistics', label: 'Logistics & Surat Jalan', category: 'Fulfillment', description: 'Order Picking, Fulfillment, Trips, Surat Jalan & e-POD' },
  { key: 'accounting', label: 'Accounting & Tax (GL/COA)', category: 'Finance', description: 'Chart of Accounts, General Ledger, Coretax e-Faktur, P&L & Period Lock' },
  { key: 'ar', label: 'Account Receivable (AR)', category: 'Finance', description: 'B2B Invoices, AR Aging, Ojol Receivables, Giro Masuk, Safe Drop & Kasbon' },
  { key: 'ap', label: 'Account Payable (AP)', category: 'Finance', description: '3-Way Match, Vendor Bills, Input VAT, PPh 22/23 & AP Payment Release' },
  { key: 'approvalMatrix', label: 'Approval Matrix', category: 'Governance', description: 'Multi-tier approval workflow routing & authorization decisions' },
  { key: 'fraudRadar', label: 'Fraud Radar & Audit', category: 'Governance', description: 'Anomaly alerts, margin overrides, shrinkage spikes & resolution' },
  { key: 'settings', label: 'Enterprise Settings', category: 'System', description: 'SaaS Config, Branches, User Accounts, Backups & Gateway Config' },
];

const ALL_PERM = (): ModulePermissionSet => ({ view: true, create: true, edit: true, approve: true, export: true });
const NO_PERM = (): ModulePermissionSet => ({ view: false, create: false, edit: false, approve: false, export: false });
const makePerm = (p: Partial<ModulePermissionSet>): ModulePermissionSet => ({
  view: Boolean(p.view),
  create: Boolean(p.create),
  edit: Boolean(p.edit),
  approve: Boolean(p.approve),
  export: Boolean(p.export),
});

export interface DivisionRolePreset {
  roleCode: DivisionRoleCode;
  divisionLabel: string;
  canonicalRole: CanonicalEnterpriseRole;
  defaultBranchId: string;
  defaultViewCost: boolean;
  defaultSupervisorPin?: string;
  description: string;
  permissions: ModulePermissionsMap;
}

function buildModuleMap(overrides: Partial<Record<ModulePermissionKey, ModulePermissionSet>>): ModulePermissionsMap {
  return {
    pos: overrides.pos ? { ...overrides.pos } : NO_PERM(),
    inventory: overrides.inventory ? { ...overrides.inventory } : NO_PERM(),
    warehouseTransfers: overrides.warehouseTransfers ? { ...overrides.warehouseTransfers } : NO_PERM(),
    procurement: overrides.procurement ? { ...overrides.procurement } : NO_PERM(),
    qualityControl: overrides.qualityControl ? { ...overrides.qualityControl } : NO_PERM(),
    crm: overrides.crm ? { ...overrides.crm } : NO_PERM(),
    logistics: overrides.logistics ? { ...overrides.logistics } : NO_PERM(),
    accounting: overrides.accounting ? { ...overrides.accounting } : NO_PERM(),
    ar: overrides.ar ? { ...overrides.ar } : NO_PERM(),
    ap: overrides.ap ? { ...overrides.ap } : NO_PERM(),
    approvalMatrix: overrides.approvalMatrix ? { ...overrides.approvalMatrix } : NO_PERM(),
    fraudRadar: overrides.fraudRadar ? { ...overrides.fraudRadar } : NO_PERM(),
    settings: overrides.settings ? { ...overrides.settings } : NO_PERM(),
  };
}

export const DIVISION_ROLE_PRESETS: Record<DivisionRoleCode, DivisionRolePreset> = {
  SUPER_ADMIN: {
    roleCode: 'SUPER_ADMIN',
    divisionLabel: 'Owner / Super Admin',
    canonicalRole: 'super_admin',
    defaultBranchId: 'ALL',
    defaultViewCost: true,
    defaultSupervisorPin: '1234',
    description: 'Full unrestricted access across all 13 ERP modules, user management & system governance.',
    permissions: buildModuleMap({
      pos: ALL_PERM(),
      inventory: ALL_PERM(),
      warehouseTransfers: ALL_PERM(),
      procurement: ALL_PERM(),
      qualityControl: ALL_PERM(),
      crm: ALL_PERM(),
      logistics: ALL_PERM(),
      accounting: ALL_PERM(),
      ar: ALL_PERM(),
      ap: ALL_PERM(),
      approvalMatrix: ALL_PERM(),
      fraudRadar: ALL_PERM(),
      settings: ALL_PERM(),
    }),
  },
  WAREHOUSE_STAFF: {
    roleCode: 'WAREHOUSE_STAFF',
    divisionLabel: 'Staf Gudang',
    canonicalRole: 'warehouse',
    defaultBranchId: 'store-jkt-senopati',
    defaultViewCost: false,
    description: 'Blind GR physical count, Putaway, Fulfillment, Blind Stocktake; cost/valuation hidden.',
    permissions: buildModuleMap({
      inventory: makePerm({ view: true, create: true, edit: true }),
      warehouseTransfers: makePerm({ view: true }),
      procurement: makePerm({ view: true, create: true }),
      qualityControl: makePerm({ view: true }),
      logistics: makePerm({ view: true, create: true, edit: true }),
    }),
  },
  WAREHOUSE_ADMIN: {
    roleCode: 'WAREHOUSE_ADMIN',
    divisionLabel: 'Admin Gudang',
    canonicalRole: 'warehouse',
    defaultBranchId: 'store-jkt-senopati',
    defaultViewCost: false,
    description: 'Inventory, Transfers, Returnable Crates, Shelf Labels, Shrinkage draft; no Approve/Accounting.',
    permissions: buildModuleMap({
      inventory: makePerm({ view: true, create: true, edit: true, export: true }),
      warehouseTransfers: makePerm({ view: true, create: true, edit: true, export: true }),
      procurement: makePerm({ view: true, create: true }),
      qualityControl: makePerm({ view: true }),
      logistics: makePerm({ view: true, create: true, edit: true, export: true }),
    }),
  },
  WAREHOUSE_HEAD: {
    roleCode: 'WAREHOUSE_HEAD',
    divisionLabel: 'Head Gudang',
    canonicalRole: 'warehouse',
    defaultBranchId: 'ALL',
    defaultViewCost: true,
    description: 'Full Warehouse + Approve Opname/Waste/Transfer Loss/Trips + Batch Recall; no PO creation or GL posting.',
    permissions: buildModuleMap({
      inventory: ALL_PERM(),
      warehouseTransfers: ALL_PERM(),
      logistics: ALL_PERM(),
      qualityControl: ALL_PERM(),
      procurement: makePerm({ view: true }),
      approvalMatrix: makePerm({ view: true, approve: true }),
    }),
  },
  PURCHASING_STAFF: {
    roleCode: 'PURCHASING_STAFF',
    divisionLabel: 'Staf Purchasing',
    canonicalRole: 'purchasing',
    defaultBranchId: 'ALL',
    defaultViewCost: true,
    description: 'Demand Forecast, PR/PO draft, FOC & SPSI input, Rafaksi draft; no PO Approve or GR physical receipt.',
    permissions: buildModuleMap({
      procurement: makePerm({ view: true, create: true, edit: true, export: true }),
      inventory: makePerm({ view: true, export: true }),
      qualityControl: makePerm({ view: true }),
    }),
  },
  PURCHASING_HEAD: {
    roleCode: 'PURCHASING_HEAD',
    divisionLabel: 'Head Purchasing',
    canonicalRole: 'purchasing',
    defaultBranchId: 'ALL',
    defaultViewCost: true,
    description: 'Approve PO, Approve Rafaksi, Approve 3-Way Match price tolerance; no Stock Adjustment or Bank Payment.',
    permissions: buildModuleMap({
      procurement: ALL_PERM(),
      ap: makePerm({ view: true, approve: true, export: true }),
      inventory: makePerm({ view: true, export: true }),
      qualityControl: makePerm({ view: true, export: true }),
      approvalMatrix: makePerm({ view: true, approve: true }),
    }),
  },
  QC_INSPECTOR: {
    roleCode: 'QC_INSPECTOR',
    divisionLabel: 'QC & Halal Inspector',
    canonicalRole: 'warehouse',
    defaultBranchId: 'store-jkt-senopati',
    defaultViewCost: false,
    description: 'GR Quality/Cold-Chain/Halal BPJPH inspection, Quarantine/Release, Customer Freshness Claims.',
    permissions: buildModuleMap({
      qualityControl: ALL_PERM(),
      inventory: makePerm({ view: true, edit: true, export: true }),
      crm: makePerm({ view: true, create: true, edit: true, approve: true }),
      procurement: makePerm({ view: true }),
    }),
  },
  POS_CASHIER: {
    roleCode: 'POS_CASHIER',
    divisionLabel: 'Kasir POS',
    canonicalRole: 'cashier',
    defaultBranchId: 'store-jkt-senopati',
    defaultViewCost: false,
    description: 'POS Checkout, Split Payment, Ojol, Scale Barcode, Z-Report, CRM Member lookup; no cost/P&L/settings.',
    permissions: buildModuleMap({
      pos: makePerm({ view: true, create: true, edit: true, export: true }),
      crm: makePerm({ view: true, create: true }),
    }),
  },
  STORE_MANAGER: {
    roleCode: 'STORE_MANAGER',
    divisionLabel: 'Store Manager / Supervisor',
    canonicalRole: 'store_manager',
    defaultBranchId: 'store-jkt-senopati',
    defaultViewCost: true,
    defaultSupervisorPin: '1234',
    description: 'POS + Supervisor PIN 1234 for Margin Floor Override/Exchange/Paid-Out + Clearance Markdown + CRM Claims.',
    permissions: buildModuleMap({
      pos: ALL_PERM(),
      inventory: ALL_PERM(),
      warehouseTransfers: makePerm({ view: true, create: true, edit: true, approve: true }),
      crm: ALL_PERM(),
      qualityControl: makePerm({ view: true, create: true, edit: true, export: true }),
      logistics: makePerm({ view: true, create: true, edit: true, export: true }),
      procurement: makePerm({ view: true, create: true }),
      approvalMatrix: makePerm({ view: true, approve: true }),
      fraudRadar: makePerm({ view: true }),
    }),
  },
  AR_STAFF: {
    roleCode: 'AR_STAFF',
    divisionLabel: 'Account Receivable',
    canonicalRole: 'admin',
    defaultBranchId: 'ALL',
    defaultViewCost: true,
    description: 'B2B Invoices, AR Aging, e-POD Credit Memos, Ojol Receivables, Bilyet Giro Masuk, Kasbon Kanvas.',
    permissions: buildModuleMap({
      ar: makePerm({ view: true, create: true, edit: true, export: true }),
      crm: makePerm({ view: true, create: true, edit: true, export: true }),
      accounting: makePerm({ view: true, export: true }),
      logistics: makePerm({ view: true, export: true }),
    }),
  },
  AP_STAFF: {
    roleCode: 'AP_STAFF',
    divisionLabel: 'Account Payable',
    canonicalRole: 'admin',
    defaultBranchId: 'ALL',
    defaultViewCost: true,
    description: '3-Way Matching, Vendor Bills, Non-Creditable Input VAT, PPh 22/23, Vendor DP deduction; no Bank Release.',
    permissions: buildModuleMap({
      ap: makePerm({ view: true, create: true, edit: true, export: true }),
      procurement: makePerm({ view: true, export: true }),
      accounting: makePerm({ view: true, export: true }),
    }),
  },
  ACCOUNTING_TAX: {
    roleCode: 'ACCOUNTING_TAX',
    divisionLabel: 'Accounting & Tax',
    canonicalRole: 'admin',
    defaultBranchId: 'ALL',
    defaultViewCost: true,
    description: 'Chart of Accounts, General Ledger, Coretax e-Faktur CSV, P&L/Balance Sheet, Inventory Valuation.',
    permissions: buildModuleMap({
      accounting: makePerm({ view: true, create: true, edit: true, export: true }),
      ar: makePerm({ view: true, export: true }),
      ap: makePerm({ view: true, export: true }),
      inventory: makePerm({ view: true, export: true }),
    }),
  },
  FINANCE_MANAGER: {
    roleCode: 'FINANCE_MANAGER',
    divisionLabel: 'Finance Manager',
    canonicalRole: 'admin',
    defaultBranchId: 'ALL',
    defaultViewCost: true,
    description: 'Approve AP Payment Release, Bilyet Giro Keluar, QRIS/EDC MDR Batch Settlement, Safe Drop & Credit Limit Approval.',
    permissions: buildModuleMap({
      ap: ALL_PERM(),
      ar: ALL_PERM(),
      accounting: ALL_PERM(),
      crm: makePerm({ view: true, edit: true, approve: true, export: true }),
      procurement: makePerm({ view: true, approve: true, export: true }),
      approvalMatrix: makePerm({ view: true, approve: true, export: true }),
      fraudRadar: makePerm({ view: true, export: true }),
    }),
  },
  HEAD_ACCOUNTING: {
    roleCode: 'HEAD_ACCOUNTING',
    divisionLabel: 'Head Accounting / Controller',
    canonicalRole: 'coo',
    defaultBranchId: 'ALL',
    defaultViewCost: true,
    description: 'Full Accounting + Accounting Period Lock, GL Reversal Approval, Fraud Radar Resolution.',
    permissions: buildModuleMap({
      accounting: ALL_PERM(),
      ar: ALL_PERM(),
      ap: ALL_PERM(),
      fraudRadar: ALL_PERM(),
      approvalMatrix: ALL_PERM(),
      inventory: makePerm({ view: true, export: true }),
      procurement: makePerm({ view: true, export: true }),
      crm: makePerm({ view: true, export: true }),
      settings: makePerm({ view: true, edit: true, approve: true, export: true }),
    }),
  },
};

export const DIVISION_ROLE_CODES: DivisionRoleCode[] = Object.keys(DIVISION_ROLE_PRESETS) as DivisionRoleCode[];

export function getDefaultModulePermissions(roleCode: DivisionRoleCode): ModulePermissionsMap {
  const preset = DIVISION_ROLE_PRESETS[roleCode] || DIVISION_ROLE_PRESETS.POS_CASHIER;
  return JSON.parse(JSON.stringify(preset.permissions));
}

export function divisionRoleToCanonicalRole(roleCode?: DivisionRoleCode | string | null): CanonicalEnterpriseRole {
  if (!roleCode) return 'super_admin';
  const preset = DIVISION_ROLE_PRESETS[roleCode as DivisionRoleCode];
  if (preset) return preset.canonicalRole;
  return normalizeEnterpriseRole(roleCode);
}

export function normalizeEnterpriseRole(role?: UserRole | string | null): CanonicalEnterpriseRole {
  switch (role) {
    case 'cashier':
    case 'POS_CASHIER':
      return 'cashier';
    case 'warehouse':
    case 'warehouse_picker':
    case 'receiving_clerk':
    case 'WAREHOUSE_STAFF':
    case 'WAREHOUSE_ADMIN':
    case 'WAREHOUSE_HEAD':
    case 'QC_INSPECTOR':
      return 'warehouse';
    case 'purchasing':
    case 'PURCHASING_STAFF':
    case 'PURCHASING_HEAD':
      return 'purchasing';
    case 'store_manager':
    case 'STORE_MANAGER':
      return 'store_manager';
    case 'admin':
    case 'AR_STAFF':
    case 'AP_STAFF':
    case 'ACCOUNTING_TAX':
    case 'FINANCE_MANAGER':
      return 'admin';
    case 'coo':
    case 'executive':
    case 'HEAD_ACCOUNTING':
      return 'coo';
    case 'super_admin':
    case 'SUPER_ADMIN':
    default:
      return 'super_admin';
  }
}

export function isBranchScopedRole(role?: UserRole | string | null): boolean {
  const canonical = normalizeEnterpriseRole(role);
  return canonical === 'cashier' || canonical === 'warehouse' || canonical === 'store_manager';
}

const ROLE_ALLOWED_TABS: Record<CanonicalEnterpriseRole, AdminDashboardTab[]> = {
  cashier: ['pos'],
  warehouse: ['inventory', 'fefo', 'picker', 'procurement', 'qc', 'logistics', 'transfers'],
  purchasing: ['procurement', 'qc', 'inventory'],
  store_manager: ['overview', 'pos', 'crm', 'inventory', 'fefo', 'waste', 'picker', 'reports'],
  admin: ['overview', 'crm', 'operations', 'inventory', 'procurement', 'logistics', 'reports', 'accounting', 'settings'],
  coo: [
    'overview',
    'pos',
    'crm',
    'operations',
    'inventory',
    'fefo',
    'waste',
    'picker',
    'procurement',
    'quotations',
    'qc',
    'logistics',
    'transfers',
    'approvals',
    'reports',
    'settings',
    'accounting',
    'rbac',
    'audit',
    'openapi',
    'erd',
  ],
  super_admin: [
    'overview',
    'pos',
    'crm',
    'operations',
    'inventory',
    'fefo',
    'waste',
    'picker',
    'procurement',
    'quotations',
    'qc',
    'logistics',
    'transfers',
    'approvals',
    'reports',
    'settings',
    'accounting',
    'rbac',
    'audit',
    'openapi',
    'erd',
  ],
};

export function isModulePermissionTabAllowed(
  mp: ModulePermissionsMap,
  tab: AdminDashboardTab,
  roleCode?: DivisionRoleCode
): boolean {
  if (roleCode === 'SUPER_ADMIN') return true;
  switch (tab) {
    case 'overview':
      return Boolean(
        mp.accounting?.view ||
          mp.ar?.view ||
          mp.ap?.view ||
          mp.pos?.approve ||
          mp.inventory?.approve ||
          mp.procurement?.approve
      );
    case 'pos':
      return Boolean(mp.pos?.view);
    case 'crm':
      return Boolean(mp.crm?.view || mp.ar?.view);
    case 'operations':
      return Boolean(mp.settings?.view || mp.pos?.approve);
    case 'inventory':
      return Boolean(mp.inventory?.view);
    case 'fefo':
      return Boolean(mp.inventory?.view || mp.qualityControl?.view);
    case 'waste':
      return Boolean(mp.inventory?.edit || mp.inventory?.approve);
    case 'picker':
      return Boolean(mp.logistics?.view || mp.inventory?.create);
    case 'procurement':
      return Boolean(mp.procurement?.view || mp.ap?.view);
    case 'quotations':
      return Boolean(mp.crm?.view || mp.ar?.view);
    case 'qc':
      return Boolean(mp.qualityControl?.view);
    case 'logistics':
      return Boolean(mp.logistics?.view);
    case 'transfers':
      return Boolean(mp.warehouseTransfers?.view);
    case 'approvals':
      return Boolean(mp.approvalMatrix?.view);
    case 'reports':
      return Boolean(mp.accounting?.view || mp.ar?.view || mp.ap?.view || mp.pos?.approve || mp.inventory?.approve);
    case 'accounting':
      return Boolean(mp.accounting?.view || mp.ar?.view || mp.ap?.view);
    case 'settings':
      return Boolean(mp.settings?.view);
    case 'rbac':
      return Boolean(mp.settings?.approve);
    case 'audit':
      return Boolean(mp.fraudRadar?.view || mp.settings?.view);
    case 'openapi':
    case 'erd':
      return Boolean(mp.settings?.approve);
    default:
      return false;
  }
}

export function isRoleTabAllowed(role: UserRole | string | null | undefined, tab: AdminDashboardTab): boolean {
  if (!role) return true;
  const canonical = normalizeEnterpriseRole(role);
  return ROLE_ALLOWED_TABS[canonical].includes(tab);
}

export function getDefaultTabForRole(role?: UserRole | string | null): AdminDashboardTab {
  const canonical = normalizeEnterpriseRole(role);
  switch (canonical) {
    case 'cashier':
      return 'pos';
    case 'warehouse':
      return 'inventory';
    case 'purchasing':
      return 'procurement';
    case 'store_manager':
    case 'admin':
    case 'coo':
    case 'super_admin':
    default:
      return 'overview';
  }
}

export function getDefaultTabForSession(session?: StaffShiftSession | null): AdminDashboardTab {
  if (!session) return 'overview';
  if (session.modulePermissions) {
    if (session.roleCode === 'SUPER_ADMIN') return 'overview';
    if (session.roleCode === 'POS_CASHIER' && session.modulePermissions.pos?.view) return 'pos';
    if (session.roleCode === 'QC_INSPECTOR' && session.modulePermissions.qualityControl?.view) return 'qc';
    if (
      (session.roleCode === 'WAREHOUSE_STAFF' ||
        session.roleCode === 'WAREHOUSE_ADMIN' ||
        session.roleCode === 'WAREHOUSE_HEAD') &&
      session.modulePermissions.inventory?.view
    ) {
      return 'inventory';
    }
    if (
      (session.roleCode === 'PURCHASING_STAFF' || session.roleCode === 'PURCHASING_HEAD') &&
      session.modulePermissions.procurement?.view
    ) {
      return 'procurement';
    }
    if (
      (session.roleCode === 'AR_STAFF' ||
        session.roleCode === 'AP_STAFF' ||
        session.roleCode === 'ACCOUNTING_TAX' ||
        session.roleCode === 'FINANCE_MANAGER' ||
        session.roleCode === 'HEAD_ACCOUNTING') &&
      (session.modulePermissions.accounting?.view ||
        session.modulePermissions.ar?.view ||
        session.modulePermissions.ap?.view)
    ) {
      return 'accounting';
    }
    const ordered: AdminDashboardTab[] = [
      'overview',
      'pos',
      'inventory',
      'transfers',
      'procurement',
      'qc',
      'logistics',
      'crm',
      'accounting',
      'approvals',
      'audit',
      'settings',
    ];
    for (const tab of ordered) {
      if (isModulePermissionTabAllowed(session.modulePermissions, tab, session.roleCode)) {
        return tab;
      }
    }
  }
  return getDefaultTabForRole(session.userRole);
}

export function hasModulePermission(
  session: StaffShiftSession | null | undefined,
  moduleKey: ModulePermissionKey,
  action: ModulePermissionAction
): boolean {
  if (!session) return true;
  if (session.roleCode === 'SUPER_ADMIN' || normalizeEnterpriseRole(session.userRole) === 'super_admin') {
    return true;
  }
  if (session.modulePermissions) {
    return Boolean(session.modulePermissions[moduleKey]?.[action]);
  }
  return true;
}

export function canSessionViewValuation(session?: StaffShiftSession | null): boolean {
  if (!session) return true;
  if (session.viewCost === false) return false;
  if (session.roleCode) {
    const preset = DIVISION_ROLE_PRESETS[session.roleCode];
    if (preset && preset.defaultViewCost === false && session.viewCost !== true) return false;
    return true;
  }
  const canonical = normalizeEnterpriseRole(session.userRole);
  if (canonical === 'warehouse' || canonical === 'cashier') return false;
  return session.permissions?.canViewValuation !== false;
}

export function getRoleDisplayLabel(role?: UserRole | string | null): string {
  if (role && DIVISION_ROLE_PRESETS[role as DivisionRoleCode]) {
    return DIVISION_ROLE_PRESETS[role as DivisionRoleCode].divisionLabel;
  }
  const canonical = normalizeEnterpriseRole(role);
  switch (canonical) {
    case 'cashier':
      return 'Cashier';
    case 'warehouse':
      return 'Warehouse Ops';
    case 'purchasing':
      return 'Purchasing';
    case 'store_manager':
      return 'Store Manager';
    case 'admin':
      return 'Back-Office Admin';
    case 'coo':
      return 'COO';
    case 'super_admin':
      return 'Super Admin';
  }
}
