import React from 'react';
import type { CompanyPublicBranding, StaffShiftSession, TrialGovernanceStatusSnapshot } from '../../types/index.ts';
import { getCompanyMonogram, isSafeLogoUrl } from '../../utils/formatters';
import {
  hasModuleAccess,
  isAccountingSubTabAllowed,
  isModulePermissionTabAllowed,
  isRoleTabAllowed,
  isOwnerRoleCode,
} from '../../utils/rbac';
import {
  isAccountingAreaAllowedByGovernance,
  isModuleAllowedByGovernance,
  isSubRoleAllowedByGovernance,
  mapAccountingSubTabToGovernanceArea,
  mapDashboardTabToGovernanceModule,
} from '../../utils/trialGovernance';
import {
  LayoutDashboard,
  Store,
  Boxes,
  Clock,
  Trash2,
  Scan,
  Truck,
  ReceiptText,
  FileCode2,
  Database,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Scale,
  DollarSign,
  Building2,
  ShieldAlert,
  PanelLeftClose,
  X,
  Store as StoreIcon,
  Sun,
  Moon,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Users,
  FileCheck2,
  LogOut,
  CreditCard,
  CheckSquare,
  ArrowRightLeft,
  BarChart3,
  FileText,
  FileSpreadsheet,
  PieChart,
  Sliders,
  Settings,
  HeartHandshake,
} from 'lucide-react';

export type AdminDashboardTab =
  | 'overview'
  | 'pos'
  | 'crm'
  | 'operations'
  | 'inventory'
  | 'fefo'
  | 'waste'
  | 'picker'
  | 'procurement'
  | 'quotations'
  | 'qc'
  | 'logistics'
  | 'transfers'
  | 'approvals'
  | 'reports'
  | 'settings'
  | 'accounting'
  | 'openapi'
  | 'erd'
  | 'rbac'
  | 'audit';

export type AccountingSubTab =
  | 'pnl'
  | 'balance_sheet'
  | 'trial_balance'
  | 'cash_flow'
  | 'gl'
  | 'coa'
  | 'vendor_bills'
  | 'b2b_ar'
  | 'analytic_budgets'
  | 'margin_analysis'
  | 'consignment';

interface AdminSidebarProps {
  theme: 'light' | 'dark';
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  activeTab: AdminDashboardTab;
  onSelectTab: (tab: AdminDashboardTab) => void;
  accountingSubTab: AccountingSubTab;
  onSelectAccountingSubTab: (sub: AccountingSubTab) => void;
  isFinanceMenuOpen: boolean;
  onToggleFinanceMenu: () => void;
  isSettingsMenuOpen: boolean;
  onToggleSettingsMenu: () => void;
  // Metrics / badges
  emergencyClosedCount: number;
  lowStockCount: number;
  partialPoCount: number;
  // Mobile drawer controls
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  // Storefront exit & logout
  onCloseToStorefront: () => void;
  onLogout?: () => void;
  activeStaffSession?: StaffShiftSession | null;
  trialGovernance?: TrialGovernanceStatusSnapshot | null;
  enableB2BAndStorefrontPortal?: boolean;
  companyBranding?: CompanyPublicBranding | null;
}

export function isDashboardTabAllowed(
  session: StaffShiftSession | null | undefined,
  tab: AdminDashboardTab,
  trialGovernance?: TrialGovernanceStatusSnapshot | null,
  enableB2BAndStorefrontPortal: boolean = false
): boolean {
  if (tab === 'quotations' && !enableB2BAndStorefrontPortal) return false;
  if (!session) return true;
  const baseAllowed = session.modulePermissions
    ? isModulePermissionTabAllowed(session.modulePermissions, tab, session.roleCode)
    : isRoleTabAllowed(session.userRole, tab);
  if (!baseAllowed) return false;
  if (trialGovernance && session.roleCode && !isOwnerRoleCode(session.roleCode)) {
    if (trialGovernance.isOperationalLocked) return false;
    if (!isSubRoleAllowedByGovernance(trialGovernance, session.roleCode)) return false;
    const modKey = mapDashboardTabToGovernanceModule(tab);
    if (modKey && !isModuleAllowedByGovernance(trialGovernance, modKey, session.roleCode)) {
      return false;
    }
  }
  return true;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  theme,
  isCollapsed,
  onToggleCollapse,
  activeTab,
  onSelectTab,
  accountingSubTab,
  onSelectAccountingSubTab,
  isFinanceMenuOpen,
  onToggleFinanceMenu,
  isSettingsMenuOpen,
  onToggleSettingsMenu,
  emergencyClosedCount,
  lowStockCount,
  partialPoCount,
  isMobileOpen,
  onCloseMobile,
  onCloseToStorefront,
  onLogout,
  activeStaffSession,
  trialGovernance,
  enableB2BAndStorefrontPortal = false,
  companyBranding,
}) => {
  const isLight = theme === 'light';
  const sidebarBrandName = companyBranding?.companyName || 'GroceMart';
  const sidebarLogo = isSafeLogoUrl(companyBranding?.logoUrl) ? companyBranding!.logoUrl! : '';
  const sidebarMonogram = getCompanyMonogram(sidebarBrandName);
  const allow = (tab: AdminDashboardTab) =>
    isDashboardTabAllowed(activeStaffSession, tab, trialGovernance, enableB2BAndStorefrontPortal);
  const allowAccountingSub = (sub: AccountingSubTab) => {
    if (sub === 'b2b_ar' && !enableB2BAndStorefrontPortal) return false;
    if (!isAccountingSubTabAllowed(activeStaffSession, sub)) return false;
    if (trialGovernance && activeStaffSession?.roleCode && !isOwnerRoleCode(activeStaffSession.roleCode)) {
      const area = mapAccountingSubTabToGovernanceArea(sub);
      if (area && !isAccountingAreaAllowedByGovernance(trialGovernance, area, activeStaffSession.roleCode)) {
        return false;
      }
    }
    return true;
  };
  const canViewStorefront =
    Boolean(enableB2BAndStorefrontPortal) &&
    (activeStaffSession ? hasModuleAccess(activeStaffSession, 'storefront', 'view') === true : true);

  const handleTabClick = (tab: AdminDashboardTab) => {
    onSelectTab(tab);
    if (window.innerWidth < 1024) {
      onCloseMobile();
    }
  };

  const handleAccountingSubClick = (sub: AccountingSubTab) => {
    onSelectAccountingSubTab(sub);
    onSelectTab('accounting');
    if (window.innerWidth < 1024) {
      onCloseMobile();
    }
  };

  const navBtnClass = (isActive: boolean, activeBg = 'bg-[#0F4C3A]') =>
    `w-full flex items-center px-4 py-2 rounded-xl relative text-xs font-semibold group ${
      isActive
        ? `${activeBg} text-white shadow-sm font-bold`
        : isLight
        ? 'text-slate-700 hover:text-slate-900 hover:bg-slate-100/90'
        : 'text-slate-300 hover:text-slate-100 hover:bg-slate-900/90'
    }`;

  const labelWrapClass = `flex-1 min-w-0 flex items-center justify-between gap-2 overflow-hidden whitespace-nowrap gm-sidebar-label ${
    isCollapsed
      ? 'ml-0 max-w-0 opacity-0 -translate-x-1.5 pointer-events-none'
      : 'ml-3 max-w-[180px] opacity-100 translate-x-0'
  }`;

  const sectionHeaderClass = `px-4 flex items-center justify-between overflow-hidden whitespace-nowrap gm-sidebar-section-header ${
    isCollapsed
      ? 'mb-0 h-0 opacity-0 -translate-x-1.5 pointer-events-none'
      : 'mb-2 h-4 opacity-100 translate-x-0'
  }`;

  const sidebarContent = (
    <div className="flex flex-col h-full select-none overflow-x-hidden">
      {/* Brand Header */}
      <div
        className={`border-b flex-shrink-0 gm-sidebar-header overflow-hidden ${
          isCollapsed
            ? 'h-[92px] py-3 px-2 flex flex-col items-center justify-center gap-2'
            : 'h-16 flex items-center justify-between px-4'
        } ${
          isLight ? 'border-slate-200 bg-white' : 'border-slate-800/80 bg-[#12141C]'
        }`}
      >
        <div className={`flex items-center min-w-0 overflow-hidden ${isCollapsed ? 'justify-center' : ''}`}>
          {sidebarLogo ? (
            <div className="w-9 h-9 rounded-xl bg-white dark:bg-[#090A0F] border border-slate-200 dark:border-slate-800/80 flex items-center justify-center p-0.5 shadow-sm flex-shrink-0 overflow-hidden">
              <img src={sidebarLogo} alt={sidebarBrandName} className="w-full h-full object-contain" />
            </div>
          ) : (
            <div className="w-9 h-9 rounded-xl bg-[#0F4C3A] flex items-center justify-center shadow-md shadow-[#0F4C3A]/25 text-white font-extrabold text-sm tracking-wider flex-shrink-0">
              {sidebarMonogram}
            </div>
          )}
          <div
            className={`min-w-0 overflow-hidden whitespace-nowrap gm-sidebar-label ${
              isCollapsed
                ? 'ml-0 max-w-0 opacity-0 -translate-x-1.5 pointer-events-none'
                : 'ml-3 max-w-[165px] opacity-100 translate-x-0'
            }`}
          >
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span
                className={`text-sm font-bold tracking-tight truncate max-w-[125px] whitespace-nowrap ${
                  isLight ? 'text-slate-900' : 'text-slate-100'
                }`}
                title={sidebarBrandName}
              >
                {sidebarBrandName}
              </span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-[#0F4C3A]/10 text-[#0F4C3A] border border-[#0F4C3A]/20 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800/50 whitespace-nowrap shrink-0">
                ERP
              </span>
            </div>
            <p className={`text-[11px] truncate whitespace-nowrap ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              {companyBranding?.partnerName || 'Enterprise Suite v4.2'}
            </p>
          </div>
        </div>

        {/* Desktop Collapse / Expand Button */}
        <button
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Perluas Sidebar' : 'Perkecil Sidebar'}
          aria-label={isCollapsed ? 'Perluas Sidebar' : 'Perkecil Sidebar'}
          aria-expanded={!isCollapsed}
          className={`hidden lg:flex items-center justify-center rounded-lg border text-xs shrink-0 cursor-pointer gm-sidebar-toggle ${
            isCollapsed ? 'w-9 h-7' : 'p-1.5'
          } ${
            isLight
              ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
              : 'bg-[#090A0F] hover:bg-slate-800/80 border-slate-800/80 text-slate-300'
          }`}
        >
          <PanelLeftClose
            className={`w-4 h-4 gm-sidebar-toggle-icon ${
              isCollapsed ? 'rotate-180' : 'rotate-0'
            }`}
          />
        </button>

        {/* Mobile Close Button */}
        <button
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 rounded-lg border border-slate-200 dark:border-slate-800/80 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Scrollable Body */}
      <nav
        className={`flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 space-y-5 ${
          isCollapsed
            ? 'no-scrollbar'
            : 'scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-slate-800'
        }`}
      >
        {/* SECTION 1: CORE OPERATIONS */}
        {(allow('overview') || allow('pos') || allow('crm') || allow('operations') || allow('inventory')) && (
        <div>
          <div className={sectionHeaderClass} aria-hidden={isCollapsed}>
            <span className={`text-[10px] font-bold tracking-wider uppercase whitespace-nowrap ${isLight ? 'text-slate-400' : 'text-slate-400'}`}>
              Core Operations
            </span>
          </div>

          <div className="space-y-1">
            {/* 1. Executive Dashboard */}
            {allow('overview') && (
            <button
              onClick={() => handleTabClick('overview')}
              title={isCollapsed ? 'Executive Dashboard' : undefined}
              className={navBtnClass(activeTab === 'overview')}
            >
              <LayoutDashboard className={`w-4 h-4 flex-shrink-0 ${activeTab === 'overview' ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`} />
              <span className={labelWrapClass}>
                <span className="truncate text-left whitespace-nowrap">Executive Dashboard</span>
              </span>
              {activeTab === 'overview' && (
                <span
                  className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 transition-all duration-150 ${
                    isCollapsed ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'
                  }`}
                />
              )}
            </button>
            )}

            {/* POS Cashier Register */}
            {allow('pos') && (
            <button
              onClick={() => handleTabClick('pos')}
              title={isCollapsed ? 'POS / Cashier Station' : undefined}
              className={navBtnClass(activeTab === 'pos', 'bg-emerald-700')}
            >
              <CreditCard className={`w-4 h-4 flex-shrink-0 ${activeTab === 'pos' ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`} />
              <span className={labelWrapClass}>
                <span className="truncate flex-1 text-left whitespace-nowrap">POS Cashier Station</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold border font-mono whitespace-nowrap shrink-0 ${
                    activeTab === 'pos'
                      ? 'bg-white/15 text-emerald-100 border-white/25'
                      : 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/25'
                  }`}
                >
                  LIVE
                </span>
              </span>
              {activeTab === 'pos' && (
                <span
                  className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 transition-all duration-150 ${
                    isCollapsed ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'
                  }`}
                />
              )}
            </button>
            )}

            {/* CRM & Loyalty 360 */}
            {allow('crm') && (
            <button
              onClick={() => handleTabClick('crm')}
              title={isCollapsed ? 'CRM & Loyalty 360' : undefined}
              className={navBtnClass(activeTab === 'crm')}
            >
              <HeartHandshake className={`w-4 h-4 flex-shrink-0 ${activeTab === 'crm' ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`} />
              <span className={labelWrapClass}>
                <span className="truncate flex-1 text-left whitespace-nowrap">CRM &amp; Loyalty 360</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold border whitespace-nowrap shrink-0 ${
                    activeTab === 'crm'
                      ? 'bg-white/15 text-emerald-100 border-white/25'
                      : 'bg-emerald-500/15 text-emerald-700 border-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/25'
                  }`}
                >
                  360°
                </span>
              </span>
              {activeTab === 'crm' && (
                <span
                  className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 transition-all duration-150 ${
                    isCollapsed ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'
                  }`}
                />
              )}
            </button>
            )}

            {/* 2. Store & Outlet Management */}
            {allow('operations') && (
            <button
              onClick={() => handleTabClick('operations')}
              title={isCollapsed ? 'Store & Outlet Management' : undefined}
              className={navBtnClass(activeTab === 'operations')}
            >
              <Store className={`w-4 h-4 flex-shrink-0 ${activeTab === 'operations' ? 'text-white' : 'text-blue-600 dark:text-blue-400'}`} />
              <span className={labelWrapClass}>
                <span className="truncate flex-1 text-left whitespace-nowrap">Store &amp; Outlets</span>
                {emergencyClosedCount > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold border whitespace-nowrap shrink-0 ${
                      activeTab === 'operations'
                        ? 'bg-white/15 text-amber-100 border-white/25'
                        : 'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25'
                    }`}
                  >
                    {emergencyClosedCount}
                  </span>
                )}
              </span>
              {emergencyClosedCount > 0 && (
                <span
                  className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 text-[10px] font-bold rounded-full flex items-center justify-center bg-amber-400 text-[#090A0F] ring-2 ring-white dark:ring-[#12141C] transition-all duration-150 ${
                    isCollapsed ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'
                  }`}
                >
                  {emergencyClosedCount}
                </span>
              )}
            </button>
            )}

            {/* 3. Inventory & Multi-Warehouse */}
            {allow('inventory') && (
            <button
              onClick={() => handleTabClick('inventory')}
              title={isCollapsed ? 'Inventory & Multi-Warehouse' : undefined}
              className={navBtnClass(activeTab === 'inventory')}
            >
              <Boxes className={`w-4 h-4 flex-shrink-0 ${activeTab === 'inventory' ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} />
              <span className={labelWrapClass}>
                <span className="truncate flex-1 text-left whitespace-nowrap">Multi-Warehouse &amp; Stock</span>
                {lowStockCount > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold border whitespace-nowrap shrink-0 ${
                      activeTab === 'inventory'
                        ? 'bg-white/15 text-amber-100 border-white/25'
                        : 'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25'
                    }`}
                  >
                    {lowStockCount}
                  </span>
                )}
              </span>
              {lowStockCount > 0 && (
                <span
                  className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 text-[10px] font-bold rounded-full flex items-center justify-center bg-amber-400 text-[#090A0F] ring-2 ring-white dark:ring-[#12141C] transition-all duration-150 ${
                    isCollapsed ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'
                  }`}
                >
                  {lowStockCount}
                </span>
              )}
            </button>
            )}
          </div>
        </div>
        )}

        {/* SECTION 2: SUPPLY CHAIN & QUALITY */}
        {(allow('fefo') ||
          allow('waste') ||
          allow('picker') ||
          allow('procurement') ||
          allow('quotations') ||
          allow('qc') ||
          allow('logistics') ||
          allow('transfers') ||
          allow('approvals') ||
          allow('reports') ||
          allow('settings')) && (
        <div>
          <div className={sectionHeaderClass} aria-hidden={isCollapsed}>
            <span className={`text-[10px] font-bold tracking-wider uppercase whitespace-nowrap ${isLight ? 'text-slate-400' : 'text-slate-400'}`}>
              Perishables &amp; Fulfillment
            </span>
          </div>

          <div className="space-y-1">
            {/* 4. FEFO & Batch Traceability */}
            {allow('fefo') && (
            <button
              onClick={() => handleTabClick('fefo')}
              title={isCollapsed ? 'FEFO & Batch Traceability' : undefined}
              className={navBtnClass(activeTab === 'fefo')}
            >
              <Clock className={`w-4 h-4 flex-shrink-0 ${activeTab === 'fefo' ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`} />
              <span className={labelWrapClass}>
                <span className="truncate flex-1 text-left whitespace-nowrap">FEFO &amp; Expiry Batches</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold border whitespace-nowrap shrink-0 ${
                    activeTab === 'fefo'
                      ? 'bg-white/15 text-emerald-100 border-white/25'
                      : 'bg-emerald-500/15 text-emerald-700 border-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/25'
                  }`}
                >
                  Auto
                </span>
              </span>
            </button>
            )}

            {/* 5. Waste & Shrinkage */}
            {allow('waste') && (
            <button
              onClick={() => handleTabClick('waste')}
              title={isCollapsed ? 'Waste & Shrinkage Management' : undefined}
              className={navBtnClass(activeTab === 'waste')}
            >
              <Trash2 className={`w-4 h-4 flex-shrink-0 ${activeTab === 'waste' ? 'text-white' : 'text-rose-600 dark:text-rose-400'}`} />
              <span className={labelWrapClass}>
                <span className="truncate flex-1 text-left whitespace-nowrap">Waste &amp; Shrinkage</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold border whitespace-nowrap shrink-0 ${
                    activeTab === 'waste'
                      ? 'bg-white/15 text-rose-100 border-white/25'
                      : 'bg-rose-500/15 text-rose-700 border-rose-500/25 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/25'
                  }`}
                >
                  Scrap
                </span>
              </span>
            </button>
            )}

            {/* 6. In-Store Picker & Catch Weight */}
            {allow('picker') && (
            <button
              onClick={() => handleTabClick('picker')}
              title={isCollapsed ? 'Fulfillment & Catch Weight' : undefined}
              className={navBtnClass(activeTab === 'picker')}
            >
              <Scan className={`w-4 h-4 flex-shrink-0 ${activeTab === 'picker' ? 'text-white' : 'text-amber-600 dark:text-amber-400'}`} />
              <span className={labelWrapClass}>
                <span className="truncate flex-1 text-left whitespace-nowrap">Fulfillment &amp; Catch Weight</span>
              </span>
            </button>
            )}

            {/* 7. Procurement & Supply Chain */}
            {allow('procurement') && (
            <button
              onClick={() => handleTabClick('procurement')}
              title={isCollapsed ? 'Procurement & Supply Chain' : undefined}
              className={navBtnClass(activeTab === 'procurement')}
            >
              <Truck className={`w-4 h-4 flex-shrink-0 ${activeTab === 'procurement' ? 'text-white' : 'text-sky-600 dark:text-sky-400'}`} />
              <span className={labelWrapClass}>
                <span className="truncate flex-1 text-left whitespace-nowrap">Procurement (PR/PO/GR)</span>
                {partialPoCount > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold border whitespace-nowrap shrink-0 ${
                      activeTab === 'procurement'
                        ? 'bg-white/15 text-sky-100 border-white/25'
                        : 'bg-blue-500/15 text-blue-700 border-blue-500/25 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/25'
                    }`}
                  >
                    Partial
                  </span>
                )}
              </span>
              {partialPoCount > 0 && (
                <span
                  className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 text-[10px] font-bold rounded-full flex items-center justify-center bg-sky-400 text-[#090A0F] ring-2 ring-white dark:ring-[#12141C] transition-all duration-150 ${
                    isCollapsed ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'
                  }`}
                >
                  {partialPoCount}
                </span>
              )}
            </button>
            )}

            {/* 7Q. B2B Quotations & Pro Forma Invoices */}
            {allow('quotations') && (
            <button
              onClick={() => handleTabClick('quotations')}
              title={isCollapsed ? 'B2B Quotations & Pro Forma Invoices' : undefined}
              className={navBtnClass(activeTab === 'quotations')}
            >
              <FileSpreadsheet className={`w-4 h-4 flex-shrink-0 ${activeTab === 'quotations' ? 'text-white' : 'text-amber-600 dark:text-amber-400'}`} />
              <span className={labelWrapClass}>
                <span className="truncate flex-1 text-left whitespace-nowrap">Quotations &amp; Pro Forma</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold border whitespace-nowrap shrink-0 ${
                    activeTab === 'quotations'
                      ? 'bg-white/15 text-amber-100 border-white/25'
                      : 'bg-amber-500/15 text-amber-700 border-amber-500/25 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25'
                  }`}
                >
                  B2B
                </span>
              </span>
            </button>
            )}

            {/* 7A. Inventory QC & Spoilage Inspections */}
            {allow('qc') && (
            <button
              onClick={() => handleTabClick('qc')}
              title={isCollapsed ? 'Quality Control (QC) & Spoilage Inspections' : undefined}
              className={navBtnClass(activeTab === 'qc')}
            >
              <CheckSquare className={`w-4 h-4 flex-shrink-0 ${activeTab === 'qc' ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`} />
              <span className={labelWrapClass}>
                <span className="truncate flex-1 text-left whitespace-nowrap">Quality Control (QC)</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold border whitespace-nowrap shrink-0 ${
                    activeTab === 'qc'
                      ? 'bg-white/15 text-emerald-100 border-white/25'
                      : 'bg-emerald-500/15 text-emerald-700 border-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/25'
                  }`}
                >
                  HACCP
                </span>
              </span>
            </button>
            )}

            {/* 7B. Logistics & Shipping Documents */}
            {allow('logistics') && (
            <button
              onClick={() => handleTabClick('logistics')}
              title={isCollapsed ? 'Logistics & Shipping Documents (Surat Jalan)' : undefined}
              className={navBtnClass(activeTab === 'logistics')}
            >
              <FileText className={`w-4 h-4 flex-shrink-0 ${activeTab === 'logistics' ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} />
              <span className={labelWrapClass}>
                <span className="truncate flex-1 text-left whitespace-nowrap">Logistics &amp; Surat Jalan</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold border whitespace-nowrap shrink-0 ${
                    activeTab === 'logistics'
                      ? 'bg-white/15 text-indigo-100 border-white/25'
                      : 'bg-indigo-500/15 text-indigo-700 border-indigo-500/25 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/25'
                  }`}
                >
                  Fleet
                </span>
              </span>
            </button>
            )}

            {/* 7C. Inter-Warehouse Transfers */}
            {allow('transfers') && (
            <button
              onClick={() => handleTabClick('transfers')}
              title={isCollapsed ? 'Inter-Warehouse Stock Transfers' : undefined}
              className={navBtnClass(activeTab === 'transfers')}
            >
              <ArrowRightLeft className={`w-4 h-4 flex-shrink-0 ${activeTab === 'transfers' ? 'text-white' : 'text-cyan-600 dark:text-cyan-400'}`} />
              <span className={labelWrapClass}>
                <span className="truncate flex-1 text-left whitespace-nowrap">Warehouse Transfers</span>
              </span>
            </button>
            )}

            {/* 7D. Approval Matrix & Authorization Queue */}
            {allow('approvals') && (
            <button
              onClick={() => handleTabClick('approvals')}
              title={isCollapsed ? 'Approval Matrix & Authorization Queue' : undefined}
              className={navBtnClass(activeTab === 'approvals')}
            >
              <ShieldCheck className={`w-4 h-4 flex-shrink-0 ${activeTab === 'approvals' ? 'text-white' : 'text-amber-600 dark:text-amber-400'}`} />
              <span className={labelWrapClass}>
                <span className="truncate flex-1 text-left whitespace-nowrap">Approval Matrix</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold border whitespace-nowrap shrink-0 ${
                    activeTab === 'approvals'
                      ? 'bg-white/15 text-amber-100 border-white/25'
                      : 'bg-amber-500/15 text-amber-700 border-amber-500/25 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25'
                  }`}
                >
                  Tiered
                </span>
              </span>
            </button>
            )}

            {/* 7E. Specialized Grocery Intelligence & Reports */}
            {allow('reports') && (
            <button
              onClick={() => handleTabClick('reports')}
              title={isCollapsed ? 'Grocery Analytics & FIFO Aging Reports' : undefined}
              className={navBtnClass(activeTab === 'reports')}
            >
              <BarChart3 className={`w-4 h-4 flex-shrink-0 ${activeTab === 'reports' ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`} />
              <span className={labelWrapClass}>
                <span className="truncate flex-1 text-left whitespace-nowrap">Grocery Analytics</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold border whitespace-nowrap shrink-0 ${
                    activeTab === 'reports'
                      ? 'bg-white/15 text-emerald-100 border-white/25'
                      : 'bg-emerald-500/15 text-emerald-700 border-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/25'
                  }`}
                >
                  FIFO
                </span>
              </span>
            </button>
            )}

            {/* 7F. Enterprise Settings Hub */}
            {allow('settings') && (
            <button
              onClick={() => handleTabClick('settings')}
              title={isCollapsed ? 'Enterprise Settings Hub' : undefined}
              className={navBtnClass(activeTab === 'settings')}
            >
              <Settings className={`w-4 h-4 flex-shrink-0 ${activeTab === 'settings' ? 'text-white' : 'text-slate-500 dark:text-slate-300'}`} />
              <span className={labelWrapClass}>
                <span className="truncate flex-1 text-left whitespace-nowrap">Enterprise Settings Hub</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold border whitespace-nowrap shrink-0 ${
                    activeTab === 'settings'
                      ? 'bg-white/15 text-purple-100 border-white/25'
                      : 'bg-purple-500/15 text-purple-700 border-purple-500/25 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/25'
                  }`}
                >
                  Config
                </span>
              </span>
            </button>
            )}
          </div>
        </div>
        )}

        {/* SECTION 3: FINANCE & CORE ACCOUNTING (Collapsible Nested Menu) */}
        {allow('accounting') && (
        <div>
          <div
            onClick={() => {
              if (!isCollapsed) onToggleFinanceMenu();
            }}
            className={`${sectionHeaderClass} ${isCollapsed ? '' : 'cursor-pointer group'}`}
            aria-hidden={isCollapsed}
          >
            <span className={`text-[10px] font-bold tracking-wider uppercase whitespace-nowrap ${isLight ? 'text-slate-400 group-hover:text-slate-600' : 'text-slate-400 group-hover:text-slate-200'}`}>
              Finance &amp; Accounting
            </span>
            <span className="text-slate-400 shrink-0">
              {isFinanceMenuOpen ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </span>
          </div>
          <div
            className={`border-t border-slate-200 dark:border-slate-800/80 mx-2 transition-all duration-200 ${
              isCollapsed ? 'my-2 opacity-100' : 'my-0 h-0 opacity-0 border-t-0 pointer-events-none'
            }`}
          />

          <div className="space-y-1">
            {/* Parent Accounting Button */}
            <button
              onClick={() => {
                handleTabClick('accounting');
                if (isCollapsed) return;
                if (!isFinanceMenuOpen) onToggleFinanceMenu();
              }}
              title={isCollapsed ? 'Finance & Core Accounting' : undefined}
              className={navBtnClass(activeTab === 'accounting')}
            >
              <ReceiptText className={`w-4 h-4 flex-shrink-0 ${activeTab === 'accounting' ? 'text-white' : 'text-teal-600 dark:text-teal-400'}`} />
              <span className={labelWrapClass}>
                <span className="truncate flex-1 text-left whitespace-nowrap">Accounting Suite</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold border font-mono whitespace-nowrap shrink-0 ${
                    activeTab === 'accounting'
                      ? 'bg-white/15 text-emerald-100 border-white/25'
                      : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-900/90 dark:text-slate-300 dark:border-slate-800/80'
                  }`}
                >
                  IDR
                </span>
              </span>
            </button>

            {/* Nested Sub-Menu (Desktop & Expanded Drawer) */}
            <div
              aria-hidden={isCollapsed || !isFinanceMenuOpen}
              className={`pl-6 pr-1 border-l-2 border-emerald-900/10 dark:border-emerald-500/20 ml-4 overflow-hidden gm-sidebar-submenu ${
                !isCollapsed && isFinanceMenuOpen
                  ? 'max-h-[520px] py-1 space-y-1 opacity-100'
                  : 'max-h-0 py-0 space-y-0 opacity-0 pointer-events-none border-l-0'
              }`}
            >
              {allowAccountingSub('pnl') && (
              <button
                onClick={() => handleAccountingSubClick('pnl')}
                tabIndex={isCollapsed || !isFinanceMenuOpen ? -1 : undefined}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12px] font-medium transition-all text-left whitespace-nowrap ${
                  activeTab === 'accounting' && accountingSubTab === 'pnl'
                    ? 'bg-emerald-500/15 text-[#0F4C3A] dark:text-emerald-300 font-semibold'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/80'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate whitespace-nowrap">P&amp;L Statement</span>
              </button>
              )}

              {allowAccountingSub('balance_sheet') && (
              <button
                onClick={() => handleAccountingSubClick('balance_sheet')}
                tabIndex={isCollapsed || !isFinanceMenuOpen ? -1 : undefined}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12px] font-medium transition-all text-left whitespace-nowrap ${
                  activeTab === 'accounting' && accountingSubTab === 'balance_sheet'
                    ? 'bg-emerald-500/15 text-[#0F4C3A] dark:text-emerald-300 font-semibold'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/80'
                }`}
              >
                <Scale className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="truncate whitespace-nowrap">Balance Sheet</span>
              </button>
              )}

              {allowAccountingSub('trial_balance') && (
              <button
                onClick={() => handleAccountingSubClick('trial_balance')}
                tabIndex={isCollapsed || !isFinanceMenuOpen ? -1 : undefined}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12px] font-medium transition-all text-left whitespace-nowrap ${
                  activeTab === 'accounting' && accountingSubTab === 'trial_balance'
                    ? 'bg-emerald-500/15 text-[#0F4C3A] dark:text-emerald-300 font-semibold'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/80'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate whitespace-nowrap">Trial Balance</span>
              </button>
              )}

              {allowAccountingSub('cash_flow') && (
              <button
                onClick={() => handleAccountingSubClick('cash_flow')}
                tabIndex={isCollapsed || !isFinanceMenuOpen ? -1 : undefined}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12px] font-medium transition-all text-left whitespace-nowrap ${
                  activeTab === 'accounting' && accountingSubTab === 'cash_flow'
                    ? 'bg-emerald-500/15 text-[#0F4C3A] dark:text-emerald-300 font-semibold'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/80'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="truncate whitespace-nowrap">Cash Flow Statement</span>
              </button>
              )}

              {allowAccountingSub('gl') && (
              <button
                onClick={() => handleAccountingSubClick('gl')}
                tabIndex={isCollapsed || !isFinanceMenuOpen ? -1 : undefined}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12px] font-medium transition-all text-left whitespace-nowrap ${
                  activeTab === 'accounting' && accountingSubTab === 'gl'
                    ? 'bg-emerald-500/15 text-[#0F4C3A] dark:text-emerald-300 font-semibold'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/80'
                }`}
              >
                <ReceiptText className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span className="truncate whitespace-nowrap">General Ledger (GL)</span>
              </button>
              )}

              {allowAccountingSub('coa') && (
              <button
                onClick={() => handleAccountingSubClick('coa')}
                tabIndex={isCollapsed || !isFinanceMenuOpen ? -1 : undefined}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12px] font-medium transition-all text-left whitespace-nowrap ${
                  activeTab === 'accounting' && accountingSubTab === 'coa'
                    ? 'bg-emerald-500/15 text-[#0F4C3A] dark:text-emerald-300 font-semibold'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/80'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span className="truncate whitespace-nowrap">Chart of Accounts (COA)</span>
              </button>
              )}

              {allowAccountingSub('vendor_bills') && (
              <button
                onClick={() => handleAccountingSubClick('vendor_bills')}
                tabIndex={isCollapsed || !isFinanceMenuOpen ? -1 : undefined}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12px] font-medium transition-all text-left whitespace-nowrap ${
                  activeTab === 'accounting' && accountingSubTab === 'vendor_bills'
                    ? 'bg-emerald-500/15 text-[#0F4C3A] dark:text-emerald-300 font-semibold'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/80'
                }`}
              >
                <FileCheck2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="truncate whitespace-nowrap">Vendor Bills &amp; AP</span>
              </button>
              )}

              {allowAccountingSub('b2b_ar') && (
              <button
                onClick={() => handleAccountingSubClick('b2b_ar')}
                tabIndex={isCollapsed || !isFinanceMenuOpen ? -1 : undefined}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12px] font-medium transition-all text-left whitespace-nowrap ${
                  activeTab === 'accounting' && accountingSubTab === 'b2b_ar'
                    ? 'bg-emerald-500/15 text-[#0F4C3A] dark:text-emerald-300 font-semibold'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/80'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate whitespace-nowrap">B2B AR &amp; Giro Clearing</span>
              </button>
              )}

              {allowAccountingSub('analytic_budgets') && (
              <button
                onClick={() => handleAccountingSubClick('analytic_budgets')}
                tabIndex={isCollapsed || !isFinanceMenuOpen ? -1 : undefined}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12px] font-medium transition-all text-left whitespace-nowrap ${
                  activeTab === 'accounting' && accountingSubTab === 'analytic_budgets'
                    ? 'bg-emerald-500/15 text-[#0F4C3A] dark:text-emerald-300 font-semibold'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/80'
                }`}
              >
                <PieChart className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span className="truncate whitespace-nowrap">Analytic Budgets</span>
              </button>
              )}

              {allowAccountingSub('margin_analysis') && (
              <button
                onClick={() => handleAccountingSubClick('margin_analysis')}
                tabIndex={isCollapsed || !isFinanceMenuOpen ? -1 : undefined}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12px] font-medium transition-all text-left whitespace-nowrap ${
                  activeTab === 'accounting' && accountingSubTab === 'margin_analysis'
                    ? 'bg-emerald-500/15 text-[#0F4C3A] dark:text-emerald-300 font-semibold'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/80'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate whitespace-nowrap">Real-Time Margin Analysis</span>
              </button>
              )}
            </div>
          </div>
        </div>
        )}

        {/* SECTION 4: SYSTEM & ARCHITECTURE */}
        {(allow('rbac') || allow('audit') || allow('openapi') || allow('erd')) && (
        <div>
          <div
            onClick={() => {
              if (!isCollapsed) onToggleSettingsMenu();
            }}
            className={`${sectionHeaderClass} ${isCollapsed ? '' : 'cursor-pointer group'}`}
            aria-hidden={isCollapsed}
          >
            <span className={`text-[10px] font-bold tracking-wider uppercase whitespace-nowrap ${isLight ? 'text-slate-400 group-hover:text-slate-600' : 'text-slate-400 group-hover:text-slate-200'}`}>
              System &amp; Specifications
            </span>
            <span className="text-slate-400 shrink-0">
              {isSettingsMenuOpen ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </span>
          </div>
          <div
            className={`border-t border-slate-200 dark:border-slate-800/80 mx-2 transition-all duration-200 ${
              isCollapsed ? 'my-2 opacity-100' : 'my-0 h-0 opacity-0 border-t-0 pointer-events-none'
            }`}
          />

          <div className="space-y-1">
            {/* 8. Roles & Shifts (RBAC) */}
            {allow('rbac') && (
            <button
              onClick={() => handleTabClick('rbac')}
              title={isCollapsed ? 'Roles & Shifts (RBAC)' : undefined}
              className={navBtnClass(activeTab === 'rbac')}
            >
              <Users className={`w-4 h-4 flex-shrink-0 ${activeTab === 'rbac' ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`} />
              <span className={labelWrapClass}>
                <span className="truncate flex-1 text-left whitespace-nowrap">Roles &amp; Shifts (RBAC)</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold border whitespace-nowrap shrink-0 ${
                    activeTab === 'rbac'
                      ? 'bg-white/15 text-emerald-100 border-white/25'
                      : 'bg-[#0F4C3A]/10 text-[#0F4C3A] border-[#0F4C3A]/20 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800/50'
                  }`}
                >
                  Shift
                </span>
              </span>
            </button>
            )}

            {/* 9. Security Audit Logs */}
            {allow('audit') && (
            <button
              onClick={() => handleTabClick('audit')}
              title={isCollapsed ? 'Security & Audit Logs' : undefined}
              className={navBtnClass(activeTab === 'audit')}
            >
              <FileCheck2 className={`w-4 h-4 flex-shrink-0 ${activeTab === 'audit' ? 'text-white' : 'text-blue-600 dark:text-blue-400'}`} />
              <span className={labelWrapClass}>
                <span className="truncate flex-1 text-left whitespace-nowrap">Security &amp; Audit Logs</span>
              </span>
            </button>
            )}

            {/* 10. QRIS OpenAPI */}
            {allow('openapi') && (
            <button
              onClick={() => handleTabClick('openapi')}
              title={isCollapsed ? 'QRIS Open API Specifications' : undefined}
              className={navBtnClass(activeTab === 'openapi')}
            >
              <FileCode2 className={`w-4 h-4 flex-shrink-0 ${activeTab === 'openapi' ? 'text-white' : 'text-violet-600 dark:text-violet-400'}`} />
              <span className={labelWrapClass}>
                <span className="truncate flex-1 text-left whitespace-nowrap">QRIS Open API Specs</span>
              </span>
            </button>
            )}

            {/* 11. ERD & Technical Architecture */}
            {allow('erd') && (
            <button
              onClick={() => handleTabClick('erd')}
              title={isCollapsed ? 'ERD & Technical Specs' : undefined}
              className={navBtnClass(activeTab === 'erd')}
            >
              <Database className={`w-4 h-4 flex-shrink-0 ${activeTab === 'erd' ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`} />
              <span className={labelWrapClass}>
                <span className="truncate flex-1 text-left whitespace-nowrap">ERD &amp; Schema Specs</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold border whitespace-nowrap shrink-0 ${
                    activeTab === 'erd'
                      ? 'bg-white/15 text-emerald-100 border-white/25'
                      : 'bg-[#0F4C3A]/10 text-[#0F4C3A] border-[#0F4C3A]/20 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800/50'
                  }`}
                >
                  Docs
                </span>
              </span>
            </button>
            )}
          </div>
        </div>
        )}
      </nav>

      {/* Footer / Storefront Exit Link */}
      <div
        className={`px-4 py-3 border-t border-slate-200 dark:border-slate-800/80 flex-shrink-0 transition-colors ${
          isLight ? 'bg-slate-50/70' : 'bg-[#090A0F]'
        }`}
      >
        <div className="space-y-1.5">
          {canViewStorefront && (
          <button
            onClick={onCloseToStorefront}
            title={isCollapsed ? 'Back to Customer Storefront' : undefined}
            className={`w-full flex items-center justify-center px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer overflow-hidden ${
              isLight
                ? 'bg-white hover:bg-slate-100 border border-slate-200 text-gray-800 shadow-2xs'
                : 'bg-[#12141C] hover:bg-slate-900/90 border border-slate-800/80 text-slate-200'
            }`}
          >
            <StoreIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span
              className={`truncate whitespace-nowrap overflow-hidden gm-sidebar-label ${
                isCollapsed
                  ? 'ml-0 max-w-0 opacity-0 -translate-x-1.5 pointer-events-none'
                  : 'ml-2 max-w-[150px] opacity-100 translate-x-0'
              }`}
            >
              Storefront View
            </span>
          </button>
          )}

          {onLogout && (
            <button
              onClick={onLogout}
              title={isCollapsed ? 'Lock ERP / Sign Out' : undefined}
              className={`w-full flex items-center justify-center px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer overflow-hidden ${
                isLight
                  ? 'bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 shadow-2xs'
                  : 'bg-rose-950/40 hover:bg-rose-900/50 border border-rose-900/50 text-rose-400'
              }`}
            >
              <LogOut className={`w-4 h-4 shrink-0 ${isLight ? 'text-red-500' : 'text-rose-400'}`} />
              <span
                className={`truncate whitespace-nowrap overflow-hidden gm-sidebar-label ${
                  isCollapsed
                    ? 'ml-0 max-w-0 opacity-0 -translate-x-1.5 pointer-events-none'
                    : 'ml-2 max-w-[150px] opacity-100 translate-x-0'
                }`}
              >
                Lock / Sign Out
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar (Collapsible: 80px icon rail vs 256px expanded) */}
      <aside
        className={`hidden lg:block print:hidden fixed inset-y-0 left-0 z-40 gm-sidebar-aside border-r gm-surface ${
          isCollapsed ? 'w-20' : 'w-64'
        } ${
          isLight
            ? 'gm-chrome-surface border-slate-200 shadow-[4px_0_24px_rgba(15,35,24,0.04)]'
            : 'bg-[#12141C] border-slate-800/80'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Off-Canvas Drawer Backdrop */}
      {isMobileOpen && (
        <div
          className="lg:hidden print:hidden fixed inset-0 z-50 bg-black/75 backdrop-blur-xs transition-opacity animate-fadeIn"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Mobile Off-Canvas Sidebar Drawer */}
      <div
        className={`lg:hidden print:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] transition-transform duration-300 ease-in-out shadow-2xl gm-surface ${
          isMobileOpen ? 'translate-x-0 pointer-events-auto' : '-translate-x-full pointer-events-none'
        } ${
          isLight ? 'gm-chrome-surface border-r border-slate-200' : 'bg-[#12141C] border-r border-slate-800/80'
        }`}
      >
        {sidebarContent}
      </div>
    </>
  );
};
