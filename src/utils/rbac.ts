import type {
  AccountingSubFlagKey,
  DivisionRoleCode,
  ModulePermissionAction,
  ModulePermissionKey,
  ModulePermissionSet,
  ModulePermissionsMap,
  StaffShiftSession,
  UserRole,
} from '../types/index.ts';
import type { AccountingSubTab, AdminDashboardTab } from '../components/AdminDashboard/AdminSidebar';

export type CanonicalEnterpriseRole =
  | 'cashier'
  | 'warehouse'
  | 'purchasing'
  | 'store_manager'
  | 'admin'
  | 'coo'
  | 'super_admin';

export const MODULE_PERMISSION_KEYS: ModulePermissionKey[] = [
  'dashboard',
  'pos',
  'storefront',
  'crm',
  'quotations',
  'outlets',
  'inventory',
  'fefoBatches',
  'wasteShrinkage',
  'fulfillment',
  'warehouseTransfers',
  'logistics',
  'procurement',
  'qualityControl',
  'approvalMatrix',
  'analytics',
  'accounting',
  'fraudRadar',
  'settings',
];

export const ACCOUNTING_SUB_FLAGS: Array<{
  key: AccountingSubFlagKey;
  label: string;
  description: string;
}> = [
  { key: 'canAccessAR', label: 'AR & Giro Masuk', description: 'B2B AR Aging, Giro Clearing, Safe Drop & Kasbon Kanvas' },
  { key: 'canAccessAP', label: 'AP & Vendor Bills', description: '3-Way Match, Vendor Bills, Input VAT & PPh 22/23' },
  { key: 'canAccessGLTax', label: 'GL, COA & Coretax', description: 'General Ledger, COA, P&L, Balance Sheet & e-Faktur CSV' },
  { key: 'canApprovePayments', label: 'Approve Payment Release', description: 'Approve AP payment release, Giro Keluar & Settlement' },
  { key: 'canLockPeriod', label: 'Accounting Period Lock', description: 'Lock/unlock accounting cut-off period & GL reversal' },
];

export const MODULE_PERMISSION_META: Array<{
  key: ModulePermissionKey;
  label: string;
  category: string;
  description: string;
}> = [
  { key: 'dashboard', label: 'Executive Dashboard', category: 'Executive', description: 'Omzet KPIs, multi-branch sales summary & executive overview' },
  { key: 'pos', label: 'POS Cashier Station', category: 'Frontline', description: 'Checkout, Split Payment, Ojol, Scale Barcode, Z-Report & Paid-Out' },
  { key: 'storefront', label: 'Storefront View', category: 'Frontline', description: 'Switch from ERP back-office to Customer Storefront view' },
  { key: 'crm', label: 'CRM & Loyalty 360', category: 'Commercial', description: 'Customer loyalty tiers, B2B credit limit & freshness claims' },
  { key: 'quotations', label: 'Quotations & Pro Forma B2B', category: 'Commercial', description: 'B2B wholesale quotations, pro forma & order conversion' },
  { key: 'outlets', label: 'Store & Outlets', category: 'Operations', description: 'Store operating hours, emergency closure & outlet network status' },
  { key: 'inventory', label: 'Multi-Warehouse & Stock', category: 'Warehouse', description: 'Stock Quants, Stocktake/Blind Opname, Bulk Import & Markdown' },
  { key: 'fefoBatches', label: 'FEFO & Expiry Batches', category: 'Warehouse', description: 'Lot/batch expiry ledger, FEFO allocation & near-expiry alerts' },
  { key: 'wasteShrinkage', label: 'Waste & Shrinkage', category: 'Warehouse', description: 'Spoilage write-off, natural shrinkage & waste approvals' },
  { key: 'fulfillment', label: 'Fulfillment & Catch Weight', category: 'Fulfillment', description: 'Order picking, packing, catch-weight reconciliation & substitutions' },
  { key: 'warehouseTransfers', label: 'Warehouse Transfers', category: 'Warehouse', description: 'Inter-warehouse stock transfer dispatch, double sign-off & loss' },
  { key: 'logistics', label: 'Logistics & Surat Jalan', category: 'Fulfillment', description: 'Fleet trips, Surat Jalan dispatch, crates & e-POD delivery' },
  { key: 'procurement', label: 'Procurement PR/PO/GR', category: 'Supply Chain', description: 'Demand Forecast, PR/PO, FOC/SPSI, Rafaksi & Dock Goods Receipt' },
  { key: 'qualityControl', label: 'Quality Control QC', category: 'Quality', description: 'GR Quality/Cold-Chain/Halal BPJPH inspection & Batch Recall' },
  { key: 'approvalMatrix', label: 'Approval Matrix', category: 'Governance', description: 'Multi-tier approval workflow routing & authorization queue' },
  { key: 'analytics', label: 'Grocery Analytics', category: 'Analytics', description: 'Margin intelligence, branch omzet analytics & KPI exports' },
  { key: 'accounting', label: 'Accounting & Finance Suite', category: 'Finance', description: 'AR, AP, COA, General Ledger, Coretax e-Faktur, P&L & Period Lock' },
  { key: 'fraudRadar', label: 'Audit Trail & Fraud Radar', category: 'Governance', description: 'Anomaly alerts, margin overrides, shrinkage spikes & immutable audit' },
  { key: 'settings', label: 'Enterprise Settings', category: 'System', description: 'SaaS Config, Branches, User Accounts, Backups & Gateway Config' },
];

const ALL_PERM = (): ModulePermissionSet => ({ view: true, create: true, edit: true, approve: true, export: true });
const ALL_ACCOUNTING_PERM = (): ModulePermissionSet => ({
  view: true,
  create: true,
  edit: true,
  approve: true,
  export: true,
  canAccessAR: true,
  canAccessAP: true,
  canAccessGLTax: true,
  canApprovePayments: true,
  canLockPeriod: true,
});
const NO_PERM = (): ModulePermissionSet => ({ view: false, create: false, edit: false, approve: false, export: false });
const NO_ACCOUNTING_PERM = (): ModulePermissionSet => ({
  view: false,
  create: false,
  edit: false,
  approve: false,
  export: false,
  canAccessAR: false,
  canAccessAP: false,
  canAccessGLTax: false,
  canApprovePayments: false,
  canLockPeriod: false,
});

const makePerm = (p: Partial<ModulePermissionSet>): ModulePermissionSet => ({
  view: p.view === true,
  create: p.create === true,
  edit: p.edit === true,
  approve: p.approve === true,
  export: p.export === true,
});

const makeAccountingPerm = (p: Partial<ModulePermissionSet>): ModulePermissionSet => ({
  view: p.view === true,
  create: p.create === true,
  edit: p.edit === true,
  approve: p.approve === true,
  export: p.export === true,
  canAccessAR: p.canAccessAR === true,
  canAccessAP: p.canAccessAP === true,
  canAccessGLTax: p.canAccessGLTax === true,
  canApprovePayments: p.canApprovePayments === true,
  canLockPeriod: p.canLockPeriod === true,
});

export interface DivisionRolePreset {
  roleCode: DivisionRoleCode;
  divisionLabel: string;
  canonicalRole: CanonicalEnterpriseRole;
  defaultBranchId: string;
  defaultLandingTab: string;
  hideFinancialCost: boolean;
  defaultViewCost: boolean;
  defaultSupervisorPin?: string;
  description: string;
  permissions: ModulePermissionsMap;
}

function buildModuleMap(overrides: Partial<Record<ModulePermissionKey, ModulePermissionSet>>): ModulePermissionsMap {
  return {
    dashboard: overrides.dashboard ? makePerm(overrides.dashboard) : NO_PERM(),
    pos: overrides.pos ? makePerm(overrides.pos) : NO_PERM(),
    storefront: overrides.storefront ? makePerm(overrides.storefront) : NO_PERM(),
    crm: overrides.crm ? makePerm(overrides.crm) : NO_PERM(),
    quotations: overrides.quotations ? makePerm(overrides.quotations) : NO_PERM(),
    outlets: overrides.outlets ? makePerm(overrides.outlets) : NO_PERM(),
    inventory: overrides.inventory ? makePerm(overrides.inventory) : NO_PERM(),
    fefoBatches: overrides.fefoBatches ? makePerm(overrides.fefoBatches) : NO_PERM(),
    wasteShrinkage: overrides.wasteShrinkage ? makePerm(overrides.wasteShrinkage) : NO_PERM(),
    fulfillment: overrides.fulfillment ? makePerm(overrides.fulfillment) : NO_PERM(),
    warehouseTransfers: overrides.warehouseTransfers ? makePerm(overrides.warehouseTransfers) : NO_PERM(),
    logistics: overrides.logistics ? makePerm(overrides.logistics) : NO_PERM(),
    procurement: overrides.procurement ? makePerm(overrides.procurement) : NO_PERM(),
    qualityControl: overrides.qualityControl ? makePerm(overrides.qualityControl) : NO_PERM(),
    approvalMatrix: overrides.approvalMatrix ? makePerm(overrides.approvalMatrix) : NO_PERM(),
    analytics: overrides.analytics ? makePerm(overrides.analytics) : NO_PERM(),
    accounting: overrides.accounting ? makeAccountingPerm(overrides.accounting) : NO_ACCOUNTING_PERM(),
    fraudRadar: overrides.fraudRadar ? makePerm(overrides.fraudRadar) : NO_PERM(),
    settings: overrides.settings ? makePerm(overrides.settings) : NO_PERM(),
  };
}

export const DIVISION_ROLE_PRESETS: Record<DivisionRoleCode, DivisionRolePreset> = {
  SUPER_ADMIN: {
    roleCode: 'SUPER_ADMIN',
    divisionLabel: 'Owner / Super Admin',
    canonicalRole: 'super_admin',
    defaultBranchId: 'ALL',
    defaultLandingTab: 'dashboard',
    hideFinancialCost: false,
    defaultViewCost: true,
    defaultSupervisorPin: '1234',
    description: 'Full unrestricted access across all 19 ERP modules, user management & system governance.',
    permissions: buildModuleMap({
      dashboard: ALL_PERM(),
      pos: ALL_PERM(),
      storefront: ALL_PERM(),
      crm: ALL_PERM(),
      quotations: ALL_PERM(),
      outlets: ALL_PERM(),
      inventory: ALL_PERM(),
      fefoBatches: ALL_PERM(),
      wasteShrinkage: ALL_PERM(),
      fulfillment: ALL_PERM(),
      warehouseTransfers: ALL_PERM(),
      logistics: ALL_PERM(),
      procurement: ALL_PERM(),
      qualityControl: ALL_PERM(),
      approvalMatrix: ALL_PERM(),
      analytics: ALL_PERM(),
      accounting: ALL_ACCOUNTING_PERM(),
      fraudRadar: ALL_PERM(),
      settings: ALL_PERM(),
    }),
  },
  WAREHOUSE_STAFF: {
    roleCode: 'WAREHOUSE_STAFF',
    divisionLabel: 'Staf Gudang',
    canonicalRole: 'warehouse',
    defaultBranchId: 'store-jkt-senopati',
    defaultLandingTab: 'inventory',
    hideFinancialCost: true,
    defaultViewCost: false,
    description: 'Blind GR physical count, Putaway, FEFO, Fulfillment, Transfers & Blind Stocktake; cost/valuation hidden.',
    permissions: buildModuleMap({
      inventory: makePerm({ view: true, create: true, edit: true }),
      fefoBatches: makePerm({ view: true }),
      fulfillment: makePerm({ view: true, create: true, edit: true }),
      warehouseTransfers: makePerm({ view: true }),
      logistics: makePerm({ view: true, create: true, edit: true }),
      procurement: makePerm({ view: true }), // View incoming POs for dock GR; physical GR authorized via inventory.create
    }),
  },
  WAREHOUSE_ADMIN: {
    roleCode: 'WAREHOUSE_ADMIN',
    divisionLabel: 'Admin Gudang',
    canonicalRole: 'warehouse',
    defaultBranchId: 'store-jkt-senopati',
    defaultLandingTab: 'inventory',
    hideFinancialCost: true,
    defaultViewCost: false,
    description: 'Inventory, FEFO, Waste draft, Fulfillment, Transfers, Logistics & GR; cost/valuation hidden, no Approve/Accounting.',
    permissions: buildModuleMap({
      inventory: makePerm({ view: true, create: true, edit: true, export: true }),
      fefoBatches: makePerm({ view: true, create: true, edit: true, export: true }),
      wasteShrinkage: makePerm({ view: true, create: true, edit: true, export: true }),
      fulfillment: makePerm({ view: true, create: true, edit: true, export: true }),
      warehouseTransfers: makePerm({ view: true, create: true, edit: true, export: true }),
      logistics: makePerm({ view: true, create: true, edit: true, export: true }),
      procurement: makePerm({ view: true }), // View incoming POs for dock GR; physical GR authorized via inventory.create
    }),
  },
  WAREHOUSE_HEAD: {
    roleCode: 'WAREHOUSE_HEAD',
    divisionLabel: 'Head Gudang',
    canonicalRole: 'warehouse',
    defaultBranchId: 'ALL',
    defaultLandingTab: 'inventory',
    hideFinancialCost: false,
    defaultViewCost: true,
    description: 'Full Warehouse + Approve Opname/Waste/Transfer Loss/Trips + QC Batch Recall; no PO creation, CRM or GL posting.',
    permissions: buildModuleMap({
      inventory: ALL_PERM(),
      fefoBatches: ALL_PERM(),
      wasteShrinkage: ALL_PERM(),
      fulfillment: ALL_PERM(),
      warehouseTransfers: ALL_PERM(),
      logistics: ALL_PERM(),
      qualityControl: ALL_PERM(),
      procurement: makePerm({ view: true }), // View incoming POs & dock GR status; no PO creation/approval
      approvalMatrix: makePerm({ view: true, approve: true }),
    }),
  },
  PURCHASING_STAFF: {
    roleCode: 'PURCHASING_STAFF',
    divisionLabel: 'Staf Purchasing',
    canonicalRole: 'purchasing',
    defaultBranchId: 'ALL',
    defaultLandingTab: 'procurement',
    hideFinancialCost: false,
    defaultViewCost: true,
    description: 'Demand Forecast, PR/PO draft, FOC & SPSI input, Rafaksi draft; no PO Approve, physical GR, CRM or Settings.',
    permissions: buildModuleMap({
      procurement: makePerm({ view: true, create: true, edit: true, export: true }),
      inventory: makePerm({ view: true, export: true }),
      fefoBatches: makePerm({ view: true }),
    }),
  },
  PURCHASING_HEAD: {
    roleCode: 'PURCHASING_HEAD',
    divisionLabel: 'Head Purchasing',
    canonicalRole: 'purchasing',
    defaultBranchId: 'ALL',
    defaultLandingTab: 'procurement',
    hideFinancialCost: false,
    defaultViewCost: true,
    description: 'Approve PO, Approve Rafaksi, Approve 3-Way Match price tolerance; no Stock Adjustment, CRM, Bank Payment or Settings.',
    permissions: buildModuleMap({
      procurement: ALL_PERM(),
      inventory: makePerm({ view: true, export: true }),
      fefoBatches: makePerm({ view: true, export: true }),
      approvalMatrix: makePerm({ view: true, approve: true }),
      analytics: makePerm({ view: true, export: true }),
    }),
  },
  QC_INSPECTOR: {
    roleCode: 'QC_INSPECTOR',
    divisionLabel: 'QC & Halal Inspector',
    canonicalRole: 'warehouse',
    defaultBranchId: 'store-jkt-senopati',
    defaultLandingTab: 'qualityControl',
    hideFinancialCost: true,
    defaultViewCost: false,
    description: 'GR Quality/Cold-Chain/Halal BPJPH inspection, FEFO expiry quarantine & spoilage log; zero commercial/finance leakage.',
    permissions: buildModuleMap({
      qualityControl: ALL_PERM(),
      fefoBatches: makePerm({ view: true, edit: true, approve: true, export: true }),
      wasteShrinkage: makePerm({ view: true, create: true }),
    }),
  },
  POS_CASHIER: {
    roleCode: 'POS_CASHIER',
    divisionLabel: 'Kasir POS',
    canonicalRole: 'cashier',
    defaultBranchId: 'store-jkt-senopati',
    defaultLandingTab: 'pos',
    hideFinancialCost: true,
    defaultViewCost: false,
    description: 'POS Checkout, Split Payment, Ojol, Scale Barcode & Z-Report only; cost/HPP, CRM, P&L & Settings hidden.',
    permissions: buildModuleMap({
      pos: makePerm({ view: true, create: true, edit: true, export: true }),
    }),
  },
  STORE_MANAGER: {
    roleCode: 'STORE_MANAGER',
    divisionLabel: 'Store Manager / Supervisor',
    canonicalRole: 'store_manager',
    defaultBranchId: 'store-jkt-senopati',
    defaultLandingTab: 'dashboard',
    hideFinancialCost: false,
    defaultViewCost: true,
    defaultSupervisorPin: '1234',
    description: 'Branch Executive Dashboard, POS + PIN 1234 overrides, Storefront, CRM, Quotations, Outlets, Stock & Approvals; no Accounting/Settings.',
    permissions: buildModuleMap({
      dashboard: makePerm({ view: true, export: true }),
      pos: ALL_PERM(),
      storefront: makePerm({ view: true }),
      crm: ALL_PERM(),
      quotations: ALL_PERM(),
      outlets: makePerm({ view: true, edit: true, approve: true }),
      inventory: ALL_PERM(),
      fefoBatches: ALL_PERM(),
      wasteShrinkage: ALL_PERM(),
      fulfillment: ALL_PERM(),
      warehouseTransfers: makePerm({ view: true, create: true, edit: true, approve: true, export: true }),
      logistics: makePerm({ view: true, create: true, edit: true, export: true }),
      qualityControl: makePerm({ view: true, create: true, edit: true, export: true }),
      approvalMatrix: makePerm({ view: true, approve: true }),
      analytics: makePerm({ view: true, export: true }),
      fraudRadar: makePerm({ view: true }),
    }),
  },
  AR_STAFF: {
    roleCode: 'AR_STAFF',
    divisionLabel: 'Account Receivable',
    canonicalRole: 'admin',
    defaultBranchId: 'ALL',
    defaultLandingTab: 'accounting',
    hideFinancialCost: false,
    defaultViewCost: true,
    description: 'B2B Invoices, Quotations, CRM Credit Limit, AR Aging, Bilyet Giro Masuk & Kasbon Kanvas; no AP, GL edit or Settings.',
    permissions: buildModuleMap({
      accounting: makeAccountingPerm({
        view: true,
        create: true,
        edit: true,
        approve: false,
        export: true,
        canAccessAR: true,
        canAccessAP: false,
        canAccessGLTax: false,
        canApprovePayments: false,
        canLockPeriod: false,
      }),
      crm: makePerm({ view: true, create: true, edit: true, export: true }),
      quotations: makePerm({ view: true, create: true, edit: true, export: true }),
    }),
  },
  AP_STAFF: {
    roleCode: 'AP_STAFF',
    divisionLabel: 'Account Payable',
    canonicalRole: 'admin',
    defaultBranchId: 'ALL',
    defaultLandingTab: 'accounting',
    hideFinancialCost: false,
    defaultViewCost: true,
    description: '3-Way Matching, Vendor Bills, Non-Creditable Input VAT & PPh 22/23; no Bank Payment Release, CRM, Quotations or Settings.',
    permissions: buildModuleMap({
      accounting: makeAccountingPerm({
        view: true,
        create: true,
        edit: true,
        approve: false,
        export: true,
        canAccessAR: false,
        canAccessAP: true,
        canAccessGLTax: false,
        canApprovePayments: false,
        canLockPeriod: false,
      }),
      procurement: makePerm({ view: true, export: true }),
    }),
  },
  ACCOUNTING_TAX: {
    roleCode: 'ACCOUNTING_TAX',
    divisionLabel: 'Accounting & Tax',
    canonicalRole: 'admin',
    defaultBranchId: 'ALL',
    defaultLandingTab: 'accounting',
    hideFinancialCost: false,
    defaultViewCost: true,
    description: 'Chart of Accounts, General Ledger, Coretax e-Faktur CSV, P&L/Balance Sheet & Analytics; no Payment Release, Period Lock or Settings.',
    permissions: buildModuleMap({
      accounting: makeAccountingPerm({
        view: true,
        create: true,
        edit: true,
        approve: false,
        export: true,
        canAccessAR: true,
        canAccessAP: true,
        canAccessGLTax: true,
        canApprovePayments: false,
        canLockPeriod: false,
      }),
      analytics: makePerm({ view: true, export: true }),
    }),
  },
  FINANCE_MANAGER: {
    roleCode: 'FINANCE_MANAGER',
    divisionLabel: 'Finance Manager',
    canonicalRole: 'admin',
    defaultBranchId: 'ALL',
    defaultLandingTab: 'accounting',
    hideFinancialCost: false,
    defaultViewCost: true,
    description: 'Executive Dashboard, Full Finance & AP Payment Release, Settlement Approval, Approvals & Fraud Radar (view); no Period Lock or Settings.',
    permissions: buildModuleMap({
      dashboard: makePerm({ view: true, export: true }),
      accounting: makeAccountingPerm({
        view: true,
        create: true,
        edit: true,
        approve: true,
        export: true,
        canAccessAR: true,
        canAccessAP: true,
        canAccessGLTax: true,
        canApprovePayments: true,
        canLockPeriod: false,
      }),
      approvalMatrix: makePerm({ view: true, approve: true, export: true }),
      analytics: makePerm({ view: true, export: true }),
      fraudRadar: makePerm({ view: true, export: true }),
    }),
  },
  HEAD_ACCOUNTING: {
    roleCode: 'HEAD_ACCOUNTING',
    divisionLabel: 'Head Accounting / Controller',
    canonicalRole: 'coo',
    defaultBranchId: 'ALL',
    defaultLandingTab: 'accounting',
    hideFinancialCost: false,
    defaultViewCost: true,
    description: 'Executive Dashboard, Full Accounting + Period Lock, GL Reversal Approval, Approvals & Fraud Radar Resolution; no Commercial/Settings.',
    permissions: buildModuleMap({
      dashboard: makePerm({ view: true, export: true }),
      accounting: ALL_ACCOUNTING_PERM(),
      approvalMatrix: ALL_PERM(),
      analytics: makePerm({ view: true, export: true }),
      fraudRadar: ALL_PERM(),
    }),
  },
};

export const DIVISION_ROLE_CODES: DivisionRoleCode[] = Object.keys(DIVISION_ROLE_PRESETS) as DivisionRoleCode[];

export function getDefaultModulePermissions(roleCode: DivisionRoleCode): ModulePermissionsMap {
  const preset = DIVISION_ROLE_PRESETS[roleCode] || DIVISION_ROLE_PRESETS.POS_CASHIER;
  return JSON.parse(JSON.stringify(preset.permissions));
}

export function getDefaultLandingTabKey(roleCode?: DivisionRoleCode | string | null): string {
  if (!roleCode) return 'dashboard';
  const preset = DIVISION_ROLE_PRESETS[roleCode as DivisionRoleCode];
  return preset ? preset.defaultLandingTab : 'dashboard';
}

export function mapLandingKeyToDashboardTab(landingKey?: string | null): AdminDashboardTab {
  switch (landingKey) {
    case 'dashboard':
    case 'overview':
      return 'overview';
    case 'pos':
      return 'pos';
    case 'crm':
      return 'crm';
    case 'quotations':
      return 'quotations';
    case 'outlets':
    case 'operations':
      return 'operations';
    case 'inventory':
      return 'inventory';
    case 'fefoBatches':
    case 'fefo':
      return 'fefo';
    case 'wasteShrinkage':
    case 'waste':
      return 'waste';
    case 'fulfillment':
    case 'picker':
      return 'picker';
    case 'warehouseTransfers':
    case 'transfers':
      return 'transfers';
    case 'logistics':
      return 'logistics';
    case 'procurement':
      return 'procurement';
    case 'qualityControl':
    case 'qc':
      return 'qc';
    case 'approvalMatrix':
    case 'approvals':
      return 'approvals';
    case 'analytics':
    case 'reports':
      return 'reports';
    case 'accounting':
      return 'accounting';
    case 'fraudRadar':
    case 'audit':
      return 'audit';
    case 'settings':
      return 'settings';
    default:
      return 'overview';
  }
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

export function getSessionAssignedBranchId(session?: StaffShiftSession | null): string {
  if (!session) return 'ALL';
  if (session.roleCode === 'SUPER_ADMIN') return 'ALL';
  const raw = session.branchId || session.assignedBranchId || session.storeId;
  if (raw && raw !== 'ALL' && raw !== 'CONSOLIDATED') {
    return raw;
  }
  if (session.roleCode) {
    const preset = DIVISION_ROLE_PRESETS[session.roleCode];
    if (preset && preset.defaultBranchId && preset.defaultBranchId !== 'ALL') {
      return preset.defaultBranchId;
    }
  }
  if (isBranchScopedRole(session.userRole)) {
    return 'store-jkt-senopati';
  }
  return 'ALL';
}

export function isSessionBranchScoped(session?: StaffShiftSession | null): boolean {
  if (!session) return false;
  if (session.roleCode === 'SUPER_ADMIN') return false;
  const raw = session.branchId || session.assignedBranchId || session.storeId;
  if (raw && raw !== 'ALL' && raw !== 'CONSOLIDATED') {
    return true;
  }
  if (session.isBranchScoped === true) return true;
  // For 14-division system users explicitly assigned to ALL (e.g. WAREHOUSE_HEAD), do not force single-branch lock
  if (session.roleCode && (raw === 'ALL' || raw === 'CONSOLIDATED')) {
    return false;
  }
  return isBranchScopedRole(session.userRole);
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

/**
 * Strict Default-Deny helper (=== true for all non-SUPER_ADMIN users).
 * Never falls back to `!== false`.
 */
export function hasModuleAccess(
  session: StaffShiftSession | null | undefined,
  moduleKey: ModulePermissionKey,
  action: ModulePermissionAction = 'view'
): boolean {
  if (!session) return false;
  if (session.roleCode === 'SUPER_ADMIN') return true;
  if (session.modulePermissions) {
    return session.modulePermissions[moduleKey]?.[action] === true;
  }
  // Legacy session without modulePermissions map
  if (normalizeEnterpriseRole(session.userRole) === 'super_admin') return true;
  if (moduleKey === 'storefront') {
    const canonical = normalizeEnterpriseRole(session.userRole);
    return canonical === 'store_manager' || canonical === 'coo' || canonical === 'super_admin';
  }
  const tab = mapLandingKeyToDashboardTab(moduleKey);
  return isRoleTabAllowed(session.userRole, tab);
}

/**
 * Strict 1-to-1 tab visibility check using exact `=== true` default-deny evaluation.
 */
export function isModulePermissionTabAllowed(
  mp: ModulePermissionsMap,
  tab: AdminDashboardTab,
  roleCode?: DivisionRoleCode
): boolean {
  if (roleCode === 'SUPER_ADMIN') return true;
  switch (tab) {
    case 'overview':
      return mp.dashboard?.view === true;
    case 'pos':
      return mp.pos?.view === true;
    case 'crm':
      return mp.crm?.view === true;
    case 'quotations':
      return mp.quotations?.view === true;
    case 'operations':
      return mp.outlets?.view === true;
    case 'inventory':
      return mp.inventory?.view === true;
    case 'fefo':
      return mp.fefoBatches?.view === true;
    case 'waste':
      return mp.wasteShrinkage?.view === true;
    case 'picker':
      return mp.fulfillment?.view === true;
    case 'transfers':
      return mp.warehouseTransfers?.view === true;
    case 'logistics':
      return mp.logistics?.view === true;
    case 'procurement':
      return mp.procurement?.view === true;
    case 'qc':
      return mp.qualityControl?.view === true;
    case 'approvals':
      return mp.approvalMatrix?.view === true;
    case 'reports':
      return mp.analytics?.view === true;
    case 'accounting':
      return mp.accounting?.view === true;
    case 'audit':
      return mp.fraudRadar?.view === true;
    case 'settings':
      return mp.settings?.view === true;
    case 'rbac':
    case 'openapi':
    case 'erd':
      return mp.settings?.approve === true;
    default:
      return false;
  }
}

export function isAccountingSubTabAllowed(
  session: StaffShiftSession | null | undefined,
  subTab: AccountingSubTab
): boolean {
  if (!session) return false;
  if (session.roleCode === 'SUPER_ADMIN') return true;
  const acct = session.modulePermissions?.accounting;
  if (!acct) return true; // legacy session fallback
  if (acct.view !== true) return false;

  const canAR = acct.canAccessAR === true;
  const canAP = acct.canAccessAP === true;
  const canGL = acct.canAccessGLTax === true;

  switch (subTab) {
    case 'b2b_ar':
      return canAR;
    case 'vendor_bills':
      return canAP;
    case 'pnl':
    case 'balance_sheet':
    case 'cash_flow':
    case 'gl':
    case 'coa':
    case 'analytic_budgets':
    case 'margin_analysis':
    case 'consignment':
      return canGL;
    default:
      return canGL || canAR || canAP;
  }
}

export function getDefaultAccountingSubTabForSession(session?: StaffShiftSession | null): AccountingSubTab {
  if (!session || session.roleCode === 'SUPER_ADMIN') return 'pnl';
  const acct = session.modulePermissions?.accounting;
  if (!acct) return 'pnl';
  if (acct.canAccessGLTax === true) return 'pnl';
  if (acct.canAccessAR === true) return 'b2b_ar';
  if (acct.canAccessAP === true) return 'vendor_bills';
  return 'pnl';
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
  if (session.roleCode === 'SUPER_ADMIN') return 'overview';

  if (session.modulePermissions) {
    const preferredKey = session.defaultLandingTab || getDefaultLandingTabKey(session.roleCode);
    const preferredTab = mapLandingKeyToDashboardTab(preferredKey);
    if (isModulePermissionTabAllowed(session.modulePermissions, preferredTab, session.roleCode)) {
      return preferredTab;
    }

    const ordered: AdminDashboardTab[] = [
      'overview',
      'pos',
      'inventory',
      'fefo',
      'waste',
      'picker',
      'transfers',
      'logistics',
      'procurement',
      'qc',
      'crm',
      'quotations',
      'operations',
      'accounting',
      'approvals',
      'reports',
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
  return hasModuleAccess(session, moduleKey, action);
}

export function canSessionViewValuation(session?: StaffShiftSession | null): boolean {
  if (!session) return true;
  if (session.roleCode === 'SUPER_ADMIN') return true;
  if (session.hideFinancialCost === true || session.viewCost === false) return false;
  if (session.roleCode) {
    const preset = DIVISION_ROLE_PRESETS[session.roleCode];
    if (preset && preset.hideFinancialCost === true && session.viewCost !== true) return false;
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
