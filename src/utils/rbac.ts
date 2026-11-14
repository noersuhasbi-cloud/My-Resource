import type { StaffShiftSession, UserRole } from '../types/index.ts';
import type { AdminDashboardTab } from '../components/AdminDashboard/AdminSidebar';

export type CanonicalEnterpriseRole =
  | 'cashier'
  | 'warehouse'
  | 'purchasing'
  | 'store_manager'
  | 'admin'
  | 'coo'
  | 'super_admin';

export function normalizeEnterpriseRole(role?: UserRole | string | null): CanonicalEnterpriseRole {
  switch (role) {
    case 'cashier':
      return 'cashier';
    case 'warehouse':
    case 'warehouse_picker':
    case 'receiving_clerk':
      return 'warehouse';
    case 'purchasing':
      return 'purchasing';
    case 'store_manager':
      return 'store_manager';
    case 'admin':
      return 'admin';
    case 'coo':
    case 'executive':
      return 'coo';
    case 'super_admin':
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
  store_manager: ['overview', 'pos', 'inventory', 'fefo', 'waste', 'picker', 'reports'],
  admin: ['overview', 'operations', 'inventory', 'procurement', 'logistics', 'reports', 'accounting', 'settings'],
  coo: [
    'overview',
    'pos',
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

export function canSessionViewValuation(session?: StaffShiftSession | null): boolean {
  if (!session) return true;
  const canonical = normalizeEnterpriseRole(session.userRole);
  if (canonical === 'warehouse' || canonical === 'cashier') return false;
  return session.permissions?.canViewValuation !== false;
}

export function getRoleDisplayLabel(role?: UserRole | string | null): string {
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
