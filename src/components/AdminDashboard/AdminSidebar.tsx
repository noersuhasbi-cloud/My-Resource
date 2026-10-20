import React from 'react';
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
  PanelLeft,
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
  Sliders,
  Settings,
} from 'lucide-react';

export type AdminDashboardTab =
  | 'overview'
  | 'pos'
  | 'operations'
  | 'inventory'
  | 'fefo'
  | 'waste'
  | 'picker'
  | 'procurement'
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

export type AccountingSubTab = 'pnl' | 'balance_sheet' | 'cash_flow' | 'gl' | 'coa' | 'vendor_bills';

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
}) => {
  const isLight = theme === 'light';

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

  const sidebarContent = (
    <div className="flex flex-col h-full select-none">
      {/* Brand Header */}
      <div
        className={`h-16 flex items-center justify-between px-4 border-b flex-shrink-0 transition-colors ${
          isLight ? 'border-gray-200/90 bg-white' : 'border-stone-800/90 bg-stone-900/95'
        }`}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-[#0F4C3A] flex items-center justify-center shadow-md shadow-[#0F4C3A]/25 text-white font-extrabold text-sm tracking-wider flex-shrink-0">
            GM
          </div>
          {!isCollapsed && (
            <div className="truncate animate-fadeIn">
              <div className="flex items-center gap-1.5">
                <span className={`text-sm font-bold tracking-tight ${isLight ? 'text-gray-900' : 'text-white'}`}>
                  GroceMart
                </span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-[#0F4C3A]/10 text-[#0F4C3A] dark:text-emerald-400 border border-[#0F4C3A]/20">
                  ERP
                </span>
              </div>
              <p className={`text-[11px] truncate ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
                Enterprise Suite v2.4
              </p>
            </div>
          )}
        </div>

        {/* Desktop Collapse Button */}
        <button
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expand Sidebar (Ctrl+B)' : 'Collapse Sidebar (Ctrl+B)'}
          className={`hidden lg:flex p-1.5 rounded-lg border text-xs transition-colors items-center justify-center ${
            isLight
              ? 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-600'
              : 'bg-stone-800 hover:bg-stone-700 border-stone-700 text-stone-300'
          }`}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>

        {/* Mobile Close Button */}
        <button
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 rounded-lg border text-gray-500 hover:text-gray-900 dark:hover:text-white"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Scrollable Body */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-stone-800">
        {/* SECTION 1: CORE OPERATIONS */}
        <div>
          {!isCollapsed && (
            <div className="px-3 mb-2 flex items-center justify-between">
              <span className={`text-[10px] font-bold tracking-wider uppercase ${isLight ? 'text-gray-400' : 'text-stone-500'}`}>
                Core Operations
              </span>
            </div>
          )}

          <div className="space-y-1">
            {/* 1. Executive Dashboard */}
            <button
              onClick={() => handleTabClick('overview')}
              title={isCollapsed ? 'Executive Dashboard' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all group relative ${
                activeTab === 'overview'
                  ? 'bg-[#0F4C3A] text-white shadow-sm font-bold'
                  : isLight
                  ? 'text-gray-700 hover:text-gray-900 hover:bg-gray-100/90'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800/80'
              }`}
            >
              <LayoutDashboard className={`w-4 h-4 flex-shrink-0 ${activeTab === 'overview' ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`} />
              {!isCollapsed && (
                <span className="truncate flex-1 text-left">Executive Dashboard</span>
              )}
              {isCollapsed && activeTab === 'overview' && (
                <span className="absolute right-1 top-2 w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
            </button>

            {/* POS Cashier Register */}
            <button
              onClick={() => handleTabClick('pos')}
              title={isCollapsed ? 'POS / Cashier Station' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all group relative ${
                activeTab === 'pos'
                  ? 'bg-emerald-700 text-white shadow-sm font-bold'
                  : isLight
                  ? 'text-gray-700 hover:text-gray-900 hover:bg-gray-100/90'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800/80'
              }`}
            >
              <CreditCard className={`w-4 h-4 flex-shrink-0 ${activeTab === 'pos' ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`} />
              {!isCollapsed && (
                <>
                  <span className="truncate flex-1 text-left">POS Cashier Station</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-mono">
                    LIVE
                  </span>
                </>
              )}
              {isCollapsed && activeTab === 'pos' && (
                <span className="absolute right-1 top-2 w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
            </button>

            {/* 2. Store & Outlet Management */}
            <button
              onClick={() => handleTabClick('operations')}
              title={isCollapsed ? 'Store & Outlet Management' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all group relative ${
                activeTab === 'operations'
                  ? 'bg-[#0F4C3A] text-white shadow-sm font-bold'
                  : isLight
                  ? 'text-gray-700 hover:text-gray-900 hover:bg-gray-100/90'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800/80'
              }`}
            >
              <Store className={`w-4 h-4 flex-shrink-0 ${activeTab === 'operations' ? 'text-white' : 'text-blue-600 dark:text-blue-400'}`} />
              {!isCollapsed && (
                <>
                  <span className="truncate flex-1 text-left">Store &amp; Outlets</span>
                  {emergencyClosedCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                      {emergencyClosedCount}
                    </span>
                  )}
                </>
              )}
              {isCollapsed && emergencyClosedCount > 0 && (
                <span className="absolute right-1 top-2 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>

            {/* 3. Inventory & Multi-Warehouse */}
            <button
              onClick={() => handleTabClick('inventory')}
              title={isCollapsed ? 'Inventory & Multi-Warehouse' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all group relative ${
                activeTab === 'inventory'
                  ? 'bg-[#0F4C3A] text-white shadow-sm font-bold'
                  : isLight
                  ? 'text-gray-700 hover:text-gray-900 hover:bg-gray-100/90'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800/80'
              }`}
            >
              <Boxes className={`w-4 h-4 flex-shrink-0 ${activeTab === 'inventory' ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} />
              {!isCollapsed && (
                <>
                  <span className="truncate flex-1 text-left">Multi-Warehouse &amp; Stock</span>
                  {lowStockCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                      {lowStockCount}
                    </span>
                  )}
                </>
              )}
              {isCollapsed && lowStockCount > 0 && (
                <span className="absolute right-1 top-2 w-2 h-2 rounded-full bg-amber-400" />
              )}
            </button>
          </div>
        </div>

        {/* SECTION 2: SUPPLY CHAIN & QUALITY */}
        <div>
          {!isCollapsed && (
            <div className="px-3 mb-2 flex items-center justify-between">
              <span className={`text-[10px] font-bold tracking-wider uppercase ${isLight ? 'text-gray-400' : 'text-stone-500'}`}>
                Perishables &amp; Fulfillment
              </span>
            </div>
          )}

          <div className="space-y-1">
            {/* 4. FEFO & Batch Traceability */}
            <button
              onClick={() => handleTabClick('fefo')}
              title={isCollapsed ? 'FEFO & Batch Traceability' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all group relative ${
                activeTab === 'fefo'
                  ? 'bg-[#0F4C3A] text-white shadow-sm font-bold'
                  : isLight
                  ? 'text-gray-700 hover:text-gray-900 hover:bg-gray-100/90'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800/80'
              }`}
            >
              <Clock className={`w-4 h-4 flex-shrink-0 ${activeTab === 'fefo' ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`} />
              {!isCollapsed && (
                <>
                  <span className="truncate flex-1 text-left">FEFO &amp; Expiry Batches</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                    Auto
                  </span>
                </>
              )}
            </button>

            {/* 5. Waste & Shrinkage */}
            <button
              onClick={() => handleTabClick('waste')}
              title={isCollapsed ? 'Waste & Shrinkage Management' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all group relative ${
                activeTab === 'waste'
                  ? 'bg-[#0F4C3A] text-white shadow-sm font-bold'
                  : isLight
                  ? 'text-gray-700 hover:text-gray-900 hover:bg-gray-100/90'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800/80'
              }`}
            >
              <Trash2 className={`w-4 h-4 flex-shrink-0 ${activeTab === 'waste' ? 'text-white' : 'text-rose-600 dark:text-rose-400'}`} />
              {!isCollapsed && (
                <>
                  <span className="truncate flex-1 text-left">Waste &amp; Shrinkage</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-500/20 text-rose-700 dark:text-rose-300">
                    Scrap
                  </span>
                </>
              )}
            </button>

            {/* 6. In-Store Picker & Catch Weight */}
            <button
              onClick={() => handleTabClick('picker')}
              title={isCollapsed ? 'Fulfillment & Catch Weight' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all group relative ${
                activeTab === 'picker'
                  ? 'bg-[#0F4C3A] text-white shadow-sm font-bold'
                  : isLight
                  ? 'text-gray-700 hover:text-gray-900 hover:bg-gray-100/90'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800/80'
              }`}
            >
              <Scan className={`w-4 h-4 flex-shrink-0 ${activeTab === 'picker' ? 'text-white' : 'text-amber-600 dark:text-amber-400'}`} />
              {!isCollapsed && (
                <span className="truncate flex-1 text-left">Fulfillment &amp; Catch Weight</span>
              )}
            </button>

            {/* 7. Procurement & Supply Chain */}
            <button
              onClick={() => handleTabClick('procurement')}
              title={isCollapsed ? 'Procurement & Supply Chain' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all group relative ${
                activeTab === 'procurement'
                  ? 'bg-[#0F4C3A] text-white shadow-sm font-bold'
                  : isLight
                  ? 'text-gray-700 hover:text-gray-900 hover:bg-gray-100/90'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800/80'
              }`}
            >
              <Truck className={`w-4 h-4 flex-shrink-0 ${activeTab === 'procurement' ? 'text-white' : 'text-sky-600 dark:text-sky-400'}`} />
              {!isCollapsed && (
                <>
                  <span className="truncate flex-1 text-left">Procurement (PR/PO/GR)</span>
                  {partialPoCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-500/20 text-blue-700 dark:text-blue-300">
                      Partial
                    </span>
                  )}
                </>
              )}
            </button>

            {/* 7A. Inventory QC & Spoilage Inspections */}
            <button
              onClick={() => handleTabClick('qc')}
              title={isCollapsed ? 'Quality Control (QC) & Spoilage Inspections' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all group relative ${
                activeTab === 'qc'
                  ? 'bg-[#0F4C3A] text-white shadow-sm font-bold'
                  : isLight
                  ? 'text-gray-700 hover:text-gray-900 hover:bg-gray-100/90'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800/80'
              }`}
            >
              <CheckSquare className={`w-4 h-4 flex-shrink-0 ${activeTab === 'qc' ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`} />
              {!isCollapsed && (
                <>
                  <span className="truncate flex-1 text-left">Quality Control (QC)</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                    HACCP
                  </span>
                </>
              )}
            </button>

            {/* 7B. Logistics & Shipping Documents */}
            <button
              onClick={() => handleTabClick('logistics')}
              title={isCollapsed ? 'Logistics & Shipping Documents (Surat Jalan)' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all group relative ${
                activeTab === 'logistics'
                  ? 'bg-[#0F4C3A] text-white shadow-sm font-bold'
                  : isLight
                  ? 'text-gray-700 hover:text-gray-900 hover:bg-gray-100/90'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800/80'
              }`}
            >
              <FileText className={`w-4 h-4 flex-shrink-0 ${activeTab === 'logistics' ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} />
              {!isCollapsed && (
                <>
                  <span className="truncate flex-1 text-left">Logistics &amp; Surat Jalan</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-700 dark:text-indigo-300">
                    Fleet
                  </span>
                </>
              )}
            </button>

            {/* 7C. Inter-Warehouse Transfers */}
            <button
              onClick={() => handleTabClick('transfers')}
              title={isCollapsed ? 'Inter-Warehouse Stock Transfers' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all group relative ${
                activeTab === 'transfers'
                  ? 'bg-[#0F4C3A] text-white shadow-sm font-bold'
                  : isLight
                  ? 'text-gray-700 hover:text-gray-900 hover:bg-gray-100/90'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800/80'
              }`}
            >
              <ArrowRightLeft className={`w-4 h-4 flex-shrink-0 ${activeTab === 'transfers' ? 'text-white' : 'text-cyan-600 dark:text-cyan-400'}`} />
              {!isCollapsed && (
                <span className="truncate flex-1 text-left">Warehouse Transfers</span>
              )}
            </button>

            {/* 7D. Approval Matrix & Authorization Queue */}
            <button
              onClick={() => handleTabClick('approvals')}
              title={isCollapsed ? 'Approval Matrix & Authorization Queue' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all group relative ${
                activeTab === 'approvals'
                  ? 'bg-[#0F4C3A] text-white shadow-sm font-bold'
                  : isLight
                  ? 'text-gray-700 hover:text-gray-900 hover:bg-gray-100/90'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800/80'
              }`}
            >
              <ShieldCheck className={`w-4 h-4 flex-shrink-0 ${activeTab === 'approvals' ? 'text-white' : 'text-amber-600 dark:text-amber-400'}`} />
              {!isCollapsed && (
                <>
                  <span className="truncate flex-1 text-left">Approval Matrix</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300">
                    Tiered
                  </span>
                </>
              )}
            </button>

            {/* 7E. Specialized Grocery Intelligence & Reports */}
            <button
              onClick={() => handleTabClick('reports')}
              title={isCollapsed ? 'Grocery Analytics & FIFO Aging Reports' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all group relative ${
                activeTab === 'reports'
                  ? 'bg-[#0F4C3A] text-white shadow-sm font-bold'
                  : isLight
                  ? 'text-gray-700 hover:text-gray-900 hover:bg-gray-100/90'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800/80'
              }`}
            >
              <BarChart3 className={`w-4 h-4 flex-shrink-0 ${activeTab === 'reports' ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`} />
              {!isCollapsed && (
                <>
                  <span className="truncate flex-1 text-left">Grocery Analytics</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                    FIFO
                  </span>
                </>
              )}
            </button>

            {/* 7F. Enterprise Settings Hub */}
            <button
              onClick={() => handleTabClick('settings')}
              title={isCollapsed ? 'Enterprise Settings Hub' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all group relative ${
                activeTab === 'settings'
                  ? 'bg-[#0F4C3A] text-white shadow-sm font-bold'
                  : isLight
                  ? 'text-gray-700 hover:text-gray-900 hover:bg-gray-100/90'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800/80'
              }`}
            >
              <Settings className={`w-4 h-4 flex-shrink-0 ${activeTab === 'settings' ? 'text-white' : 'text-stone-600 dark:text-stone-400'}`} />
              {!isCollapsed && (
                <>
                  <span className="truncate flex-1 text-left">Enterprise Settings Hub</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-500/20 text-purple-700 dark:text-purple-300">
                    Config
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* SECTION 3: FINANCE & CORE ACCOUNTING (Collapsible Nested Menu) */}
        <div>
          {!isCollapsed ? (
            <div
              onClick={onToggleFinanceMenu}
              className={`px-3 mb-2 flex items-center justify-between cursor-pointer group`}
            >
              <span className={`text-[10px] font-bold tracking-wider uppercase ${isLight ? 'text-gray-400 group-hover:text-gray-600' : 'text-stone-500 group-hover:text-stone-300'}`}>
                Finance &amp; Accounting
              </span>
              <span className="text-gray-400">
                {isFinanceMenuOpen ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </span>
            </div>
          ) : (
            <div className="border-t border-gray-200 dark:border-stone-800 my-2" />
          )}

          <div className="space-y-1">
            {/* Parent Accounting Button */}
            <button
              onClick={() => {
                handleTabClick('accounting');
                if (isCollapsed) return;
                if (!isFinanceMenuOpen) onToggleFinanceMenu();
              }}
              title={isCollapsed ? 'Finance & Core Accounting' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all group relative ${
                activeTab === 'accounting'
                  ? 'bg-[#0F4C3A] text-white shadow-sm font-bold'
                  : isLight
                  ? 'text-gray-700 hover:text-gray-900 hover:bg-gray-100/90'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800/80'
              }`}
            >
              <ReceiptText className={`w-4 h-4 flex-shrink-0 ${activeTab === 'accounting' ? 'text-white' : 'text-teal-600 dark:text-teal-400'}`} />
              {!isCollapsed && (
                <>
                  <span className="truncate flex-1 text-left">Accounting Suite</span>
                  <span className="text-[10px] opacity-75 font-mono">IDR</span>
                </>
              )}
            </button>

            {/* Nested Sub-Menu (Desktop & Expanded Drawer) */}
            {!isCollapsed && isFinanceMenuOpen && (
              <div className="pl-6 pr-1 py-1 space-y-1 border-l-2 border-emerald-900/10 dark:border-emerald-500/20 ml-4 animate-fadeIn">
                <button
                  onClick={() => handleAccountingSubClick('pnl')}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all text-left ${
                    activeTab === 'accounting' && accountingSubTab === 'pnl'
                      ? 'bg-emerald-500/15 text-[#0F4C3A] dark:text-emerald-300 font-bold'
                      : isLight
                      ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/70'
                      : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
                  }`}
                >
                  <TrendingUp className="w-3 h-3 text-emerald-600" />
                  <span className="truncate">P&amp;L Statement</span>
                </button>

                <button
                  onClick={() => handleAccountingSubClick('balance_sheet')}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all text-left ${
                    activeTab === 'accounting' && accountingSubTab === 'balance_sheet'
                      ? 'bg-emerald-500/15 text-[#0F4C3A] dark:text-emerald-300 font-bold'
                      : isLight
                      ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/70'
                      : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
                  }`}
                >
                  <Scale className="w-3 h-3 text-blue-600" />
                  <span className="truncate">Balance Sheet</span>
                </button>

                <button
                  onClick={() => handleAccountingSubClick('cash_flow')}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all text-left ${
                    activeTab === 'accounting' && accountingSubTab === 'cash_flow'
                      ? 'bg-emerald-500/15 text-[#0F4C3A] dark:text-emerald-300 font-bold'
                      : isLight
                      ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/70'
                      : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
                  }`}
                >
                  <DollarSign className="w-3 h-3 text-amber-600" />
                  <span className="truncate">Cash Flow Statement</span>
                </button>

                <button
                  onClick={() => handleAccountingSubClick('gl')}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all text-left ${
                    activeTab === 'accounting' && accountingSubTab === 'gl'
                      ? 'bg-emerald-500/15 text-[#0F4C3A] dark:text-emerald-300 font-bold'
                      : isLight
                      ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/70'
                      : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
                  }`}
                >
                  <ReceiptText className="w-3 h-3 text-purple-600" />
                  <span className="truncate">General Ledger (GL)</span>
                </button>

                <button
                  onClick={() => handleAccountingSubClick('coa')}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all text-left ${
                    activeTab === 'accounting' && accountingSubTab === 'coa'
                      ? 'bg-emerald-500/15 text-[#0F4C3A] dark:text-emerald-300 font-bold'
                      : isLight
                      ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/70'
                      : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
                  }`}
                >
                  <Building2 className="w-3 h-3 text-teal-600" />
                  <span className="truncate">Chart of Accounts (COA)</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 4: SYSTEM & ARCHITECTURE */}
        <div>
          {!isCollapsed ? (
            <div
              onClick={onToggleSettingsMenu}
              className={`px-3 mb-2 flex items-center justify-between cursor-pointer group`}
            >
              <span className={`text-[10px] font-bold tracking-wider uppercase ${isLight ? 'text-gray-400 group-hover:text-gray-600' : 'text-stone-500 group-hover:text-stone-300'}`}>
                System &amp; Specifications
              </span>
              <span className="text-gray-400">
                {isSettingsMenuOpen ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </span>
            </div>
          ) : (
            <div className="border-t border-gray-200 dark:border-stone-800 my-2" />
          )}

          <div className="space-y-1">
            {/* 8. Roles & Shifts (RBAC) */}
            <button
              onClick={() => handleTabClick('rbac')}
              title={isCollapsed ? 'Roles & Shifts (RBAC)' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all group relative ${
                activeTab === 'rbac'
                  ? 'bg-[#0F4C3A] text-white shadow-sm font-bold'
                  : isLight
                  ? 'text-gray-700 hover:text-gray-900 hover:bg-gray-100/90'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800/80'
              }`}
            >
              <Users className={`w-4 h-4 flex-shrink-0 ${activeTab === 'rbac' ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`} />
              {!isCollapsed && (
                <>
                  <span className="truncate flex-1 text-left">Roles &amp; Shifts (RBAC)</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#0F4C3A]/10 text-[#0F4C3A] dark:text-emerald-400">
                    Shift
                  </span>
                </>
              )}
            </button>

            {/* 9. Security Audit Logs */}
            <button
              onClick={() => handleTabClick('audit')}
              title={isCollapsed ? 'Security & Audit Logs' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all group relative ${
                activeTab === 'audit'
                  ? 'bg-[#0F4C3A] text-white shadow-sm font-bold'
                  : isLight
                  ? 'text-gray-700 hover:text-gray-900 hover:bg-gray-100/90'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800/80'
              }`}
            >
              <FileCheck2 className={`w-4 h-4 flex-shrink-0 ${activeTab === 'audit' ? 'text-white' : 'text-blue-600 dark:text-blue-400'}`} />
              {!isCollapsed && (
                <span className="truncate flex-1 text-left">Security &amp; Audit Logs</span>
              )}
            </button>

            {/* 10. QRIS OpenAPI */}
            <button
              onClick={() => handleTabClick('openapi')}
              title={isCollapsed ? 'QRIS Open API Specifications' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all group relative ${
                activeTab === 'openapi'
                  ? 'bg-[#0F4C3A] text-white shadow-sm font-bold'
                  : isLight
                  ? 'text-gray-700 hover:text-gray-900 hover:bg-gray-100/90'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800/80'
              }`}
            >
              <FileCode2 className={`w-4 h-4 flex-shrink-0 ${activeTab === 'openapi' ? 'text-white' : 'text-violet-600 dark:text-violet-400'}`} />
              {!isCollapsed && (
                <span className="truncate flex-1 text-left">QRIS Open API Specs</span>
              )}
            </button>

            {/* 11. ERD & Technical Architecture */}
            <button
              onClick={() => handleTabClick('erd')}
              title={isCollapsed ? 'ERD & Technical Specs' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all group relative ${
                activeTab === 'erd'
                  ? 'bg-[#0F4C3A] text-white shadow-sm font-bold'
                  : isLight
                  ? 'text-gray-700 hover:text-gray-900 hover:bg-gray-100/90'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800/80'
              }`}
            >
              <Database className={`w-4 h-4 flex-shrink-0 ${activeTab === 'erd' ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`} />
              {!isCollapsed && (
                <>
                  <span className="truncate flex-1 text-left">ERD &amp; Schema Specs</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#0F4C3A]/10 text-[#0F4C3A] dark:text-emerald-400">
                    Docs
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Footer / Storefront Exit Link */}
      <div
        className={`p-3 border-t flex-shrink-0 transition-colors ${
          isLight ? 'border-gray-200/90 bg-gray-50/70' : 'border-stone-800/90 bg-stone-900/60'
        }`}
      >
        <div className="space-y-1.5">
          <button
            onClick={onCloseToStorefront}
            title={isCollapsed ? 'Back to Customer Storefront' : undefined}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              isLight
                ? 'bg-white hover:bg-gray-100 border border-gray-200 text-gray-800 shadow-2xs'
                : 'bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-200'
            }`}
          >
            <StoreIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            {!isCollapsed && <span className="truncate">Storefront View</span>}
          </button>

          {onLogout && (
            <button
              onClick={onLogout}
              title={isCollapsed ? 'Lock ERP / Sign Out' : undefined}
              className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isLight
                  ? 'bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 shadow-2xs'
                  : 'bg-red-950/40 hover:bg-red-900/50 border border-red-800/40 text-red-300'
              }`}
            >
              <LogOut className="w-4 h-4 text-red-500 shrink-0" />
              {!isCollapsed && <span className="truncate">Lock / Sign Out</span>}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar (Collapsible: 64px icon rail vs 260px expanded) */}
      <aside
        className={`hidden lg:block fixed inset-y-0 left-0 z-40 transition-all duration-300 ease-in-out border-r ${
          isCollapsed ? 'w-20' : 'w-64'
        } ${
          isLight
            ? 'bg-white border-gray-200/90 shadow-[4px_0_24px_rgba(0,0,0,0.02)]'
            : 'bg-stone-900 border-stone-800/90'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Off-Canvas Drawer Backdrop */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity animate-fadeIn"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Mobile Off-Canvas Sidebar Drawer */}
      <div
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] transition-transform duration-300 ease-in-out shadow-2xl ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${
          isLight ? 'bg-white border-r border-gray-200' : 'bg-stone-900 border-r border-stone-800'
        }`}
      >
        {sidebarContent}
      </div>
    </>
  );
};
