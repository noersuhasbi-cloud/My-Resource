import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import type {
  ChartOfAccount,
  CoaMappingConfig,
  PosCheckoutConfig,
  PosRoundingRule,
  BulkInventoryImportRow,
  InventoryImportDraft,
  InventoryImportDraftRow,
  StockOpnameSession,
  StockOpnameItem,
  StockTransferRecord,
  StoreOutletSchedule,
  WarehouseZone,
  StoreInventoryStock,
  ApprovalTierRule,
  ApprovalRequest,
  PromotionRule,
  PromotionType,
  MemberLoyaltyTier,
  EnterpriseSettingsConfig,
  LandedCostRecord,
  WarehouseBinLocation,
  WarehouseMultiStepRoute,
  VendorBill,
  PurchaseOrder,
  GoodsReceiptRecord,
  StaffShiftSession,
  BranchMonitorResponse,
  OperatorBranchAssignment,
  UserRole,
  DivisionRoleCode,
  ModulePermissionAction,
  ModulePermissionKey,
  ModulePermissionsMap,
  SystemUserAccount,
  ErpConfigurationSettings,
  OutletType,
  BranchMonitorHubSummary,
  ItemClassification,
  TrialGovernanceStatusSnapshot,
  ImportExportDiagnosticReport,
} from '../../types/index.ts';
import { TrialGovernancePanel } from './TrialGovernancePanel';
import {
  analyzeSnapshotRestorePayload,
  buildDiagnosticFromError,
} from '../../utils/importExportDiagnostics';
import {
  INITIAL_ENTERPRISE_SETTINGS,
  INITIAL_ERP_SETTINGS,
  INITIAL_LANDED_COSTS,
  INITIAL_WAREHOUSE_BINS,
  INITIAL_WAREHOUSE_ROUTES,
  INITIAL_INVENTORY,
} from '../../data/inventoryData';
import { apiClient } from '../../services/apiClient';
import { formatIDR } from '../../utils/formatters';
import {
  normalizeEnterpriseRole,
  getRoleDisplayLabel,
  isBranchScopedRole,
  isSessionBranchScoped,
  getSessionAssignedBranchId,
  DIVISION_ROLE_CODES,
  DIVISION_ROLE_PRESETS,
  MODULE_PERMISSION_META,
  ACCOUNTING_SUB_FLAGS,
  getDefaultModulePermissions,
} from '../../utils/rbac';
import {
  Settings,
  Building2,
  CreditCard,
  Boxes,
  Truck,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Save,
  Download,
  Upload,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  ReceiptText,
  DollarSign,
  Percent,
  Sliders,
  Sparkles,
  ArrowRightLeft,
  FileCheck2,
  Clock,
  ShieldCheck,
  Check,
  Search,
  Plus,
  Trash2,
  Edit3,
  X,
  Printer,
  FileText,
  Tag,
  Gift,
  Zap,
  Scale,
  Warehouse,
  Layers,
  BarChart3,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  Users,
  PackageCheck,
  MapPin,
  Mail,
  History,
  Barcode,
} from 'lucide-react';
import { ApprovalMatrixModule } from './ApprovalMatrixModule';
import { ValuationCostingSettingsTab } from './ValuationCostingSettingsTab';
import { WarehouseRoutingSettingsTab } from './WarehouseRoutingSettingsTab';
import { ThreeWayMatchingSettingsTab } from './ThreeWayMatchingSettingsTab';
import { BlindOpnamePanel } from './BlindOpnamePanel';
import { IndonesianTaxRulesPanel } from './IndonesianTaxRulesPanel';
import { CommunicationGatewaySettingsTab } from './CommunicationGatewaySettingsTab';
import { AuditTrailKpiTab } from './AuditTrailKpiTab';
import { QuickBarcodeScannerBar } from './QuickBarcodeScannerBar';

export type SettingsSubTab =
  | 'enterprise'
  | 'branch_monitor'
  | 'valuation'
  | 'warehouse'
  | 'matching'
  | 'coa'
  | 'pos'
  | 'promotions'
  | 'import_opname'
  | 'transfer'
  | 'approval_matrix'
  | 'communication_gateway'
  | 'audit_kpis';

interface SettingsModuleProps {
  theme: 'light' | 'dark';
  activeStaffSession?: StaffShiftSession | null;
  chartOfAccounts: ChartOfAccount[];
  storeOutlets: StoreOutletSchedule[];
  warehouseZones: WarehouseZone[];
  inventoryTiers: StoreInventoryStock[];
  initialSubTab?: SettingsSubTab;
  standaloneMode?: 'transfer' | 'import_opname';
  onShowToast: (title: string, message: string) => void;
  onRefreshData?: () => void;
  onOperatorAssignmentsUpdated?: (data: {
    currentSession: StaffShiftSession;
    availableProfiles: StaffShiftSession[];
  }) => void;
  onNavigateToVendorBills?: () => void;
  onNavigateToAnalytic?: () => void;
  onNavigateToMargin?: () => void;
  onNavigateToQuotations?: () => void;
  onTrialGovernanceUpdated?: (snapshot: TrialGovernanceStatusSnapshot) => void;
}

export const SettingsModule: React.FC<SettingsModuleProps> = ({
  theme,
  activeStaffSession,
  chartOfAccounts,
  storeOutlets,
  warehouseZones,
  inventoryTiers,
  initialSubTab,
  standaloneMode,
  onShowToast,
  onRefreshData,
  onOperatorAssignmentsUpdated,
  onNavigateToVendorBills,
  onNavigateToAnalytic,
  onNavigateToMargin,
  onNavigateToQuotations,
  onTrialGovernanceUpdated,
}) => {
  const isLight = theme === 'light';
  const currentRole = normalizeEnterpriseRole(activeStaffSession?.userRole);
  const isSuperAdmin = currentRole === 'super_admin';
  const isCoo = currentRole === 'coo';
  const isAdminRole = currentRole === 'admin';
  const canViewBranchMonitor = isSuperAdmin || isCoo || isAdminRole;
  const canViewAuditAndKpis = isSuperAdmin || isCoo;
  const canConfirmArrivals = isSuperAdmin || isCoo || currentRole === 'warehouse' || currentRole === 'store_manager';
  const canManagePromotions = isSuperAdmin || isCoo || currentRole === 'store_manager';
  const canMutateStock = isSuperAdmin || isCoo || currentRole === 'warehouse' || currentRole === 'store_manager';
  const isReadOnlyPolicyRole = isAdminRole;
  const isBranchScoped = isSessionBranchScoped(activeStaffSession);
  const lockedBranchId = getSessionAssignedBranchId(activeStaffSession) || 'store-jkt-senopati';

  // Active Sub-Tab
  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>(
    standaloneMode || initialSubTab || 'enterprise'
  );

  useEffect(() => {
    const nextTab = standaloneMode || initialSubTab;
    if (nextTab && nextTab !== activeSubTab) {
      setActiveSubTab(nextTab);
    }
  }, [standaloneMode, initialSubTab, activeSubTab]);

  useEffect(() => {
    if (!standaloneMode && (activeSubTab === 'transfer' || activeSubTab === 'import_opname')) {
      setActiveSubTab('enterprise');
      return;
    }
    if (activeSubTab === 'audit_kpis' && !canViewAuditAndKpis) {
      setActiveSubTab('enterprise');
    }
  }, [standaloneMode, activeSubTab, canViewAuditAndKpis]);

  const [opnameSubTab, setOpnameSubTab] = useState<'stocktake' | 'bulk_import'>('stocktake');
  const [opnameAuditMode, setOpnameAuditMode] = useState<'standard' | 'blind'>('standard');

  // Enterprise Settings & Related Logistics State
  const [enterpriseSettings, setEnterpriseSettings] = useState<EnterpriseSettingsConfig>(INITIAL_ENTERPRISE_SETTINGS);
  const [erpConfigDraft, setErpConfigDraft] = useState<ErpConfigurationSettings>(INITIAL_ERP_SETTINGS);
  const [isSavingErpConfig, setIsSavingErpConfig] = useState<boolean>(false);
  const [isDownloadingBackup, setIsDownloadingBackup] = useState<boolean>(false);
  const [isRestoringSnapshot, setIsRestoringSnapshot] = useState<boolean>(false);
  const [isInitializingProduction, setIsInitializingProduction] = useState<boolean>(false);
  const [isResettingDemo, setIsResettingDemo] = useState<boolean>(false);
  const [confirmSystemAction, setConfirmSystemAction] = useState<'init_production' | 'reset_demo' | null>(null);
  const restoreFileInputRef = useRef<HTMLInputElement>(null);
  const [landedCosts, setLandedCosts] = useState<LandedCostRecord[]>(INITIAL_LANDED_COSTS);
  const [warehouseBins, setWarehouseBins] = useState<WarehouseBinLocation[]>(INITIAL_WAREHOUSE_BINS);
  const [warehouseRoutes, setWarehouseRoutes] = useState<WarehouseMultiStepRoute[]>(INITIAL_WAREHOUSE_ROUTES);
  const [vendorBills, setVendorBills] = useState<VendorBill[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [goodsReceipts, setGoodsReceipts] = useState<GoodsReceiptRecord[]>([]);
  const [isSavingEnterprise, setIsSavingEnterprise] = useState<boolean>(false);
  const [enterpriseQuickFilter, setEnterpriseQuickFilter] = useState<
    'ALL' | 'VALUATION' | 'WAREHOUSE' | 'ANALYTICS' | 'QUOTATIONS' | 'MATCHING' | 'TAX' | 'ERP_CONFIG' | 'TRIAL_GOV'
  >('ALL');
  const [snapshotDiagnosticReport, setSnapshotDiagnosticReport] = useState<ImportExportDiagnosticReport | null>(null);
  const [bulkImportDiagnosticReport, setBulkImportDiagnosticReport] = useState<ImportExportDiagnosticReport | null>(null);
  const [diagnosticRefreshKey, setDiagnosticRefreshKey] = useState<number>(0);

  // Configurable 14-Division System Users & Per-Module Permission Matrix State
  const [systemUsersList, setSystemUsersList] = useState<SystemUserAccount[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [userDivisionFilter, setUserDivisionFilter] = useState<string>('ALL');
  const [isUserModalOpen, setIsUserModalOpen] = useState<boolean>(false);
  const [editingSystemUser, setEditingSystemUser] = useState<SystemUserAccount | null>(null);
  const [userFormFullName, setUserFormFullName] = useState<string>('');
  const [userFormEmail, setUserFormEmail] = useState<string>('');
  const [userFormPassword, setUserFormPassword] = useState<string>('');
  const [showUserFormPassword, setShowUserFormPassword] = useState<boolean>(false);
  const [userFormRoleCode, setUserFormRoleCode] = useState<DivisionRoleCode>('POS_CASHIER');
  const [userFormBranchId, setUserFormBranchId] = useState<string>('store-jkt-senopati');
  const [userFormIsActive, setUserFormIsActive] = useState<boolean>(true);
  const [userFormSupervisorPin, setUserFormSupervisorPin] = useState<string>('');
  const [userFormViewCost, setUserFormViewCost] = useState<boolean>(false);
  const [userFormApplyPresetOnSave, setUserFormApplyPresetOnSave] = useState<boolean>(false);
  const [isSavingSystemUser, setIsSavingSystemUser] = useState<boolean>(false);
  const [permModalUser, setPermModalUser] = useState<SystemUserAccount | null>(null);
  const [permDraft, setPermDraft] = useState<ModulePermissionsMap | null>(null);
  const [isSavingPermMatrix, setIsSavingPermMatrix] = useState<boolean>(false);

  // Loading states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSavingCoa, setIsSavingCoa] = useState<boolean>(false);
  const [isSavingPos, setIsSavingPos] = useState<boolean>(false);
  const [isReconciling, setIsReconciling] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [isTransferring, setIsTransferring] = useState<boolean>(false);

  // 0B. Multi-Branch Monitor (Cabang, Omzet & Barang Datang) + Operator Assignments State
  const [branchMonitorData, setBranchMonitorData] = useState<BranchMonitorResponse | null>(null);
  const [isLoadingMonitor, setIsLoadingMonitor] = useState<boolean>(false);
  const [confirmingArrivalId, setConfirmingArrivalId] = useState<string | null>(null);
  const [operatorAssignments, setOperatorAssignments] = useState<OperatorBranchAssignment[]>([]);
  const [branchAssignmentOptions, setBranchAssignmentOptions] = useState<
    { storeId: string; storeName: string; hubType: string }[]
  >([]);
  const [savingAssignmentUserId, setSavingAssignmentUserId] = useState<string | null>(null);
  const [operatorPinDrafts, setOperatorPinDrafts] = useState<Record<string, string>>({});

  // Outlet Profile Create / Edit Modal State
  const [isOutletModalOpen, setIsOutletModalOpen] = useState<boolean>(false);
  const [editingOutletProfile, setEditingOutletProfile] = useState<BranchMonitorHubSummary | null>(null);
  const [outletFormBranchCode, setOutletFormBranchCode] = useState<string>('');
  const [outletFormName, setOutletFormName] = useState<string>('');
  const [outletFormType, setOutletFormType] = useState<OutletType>('FLAGSHIP_STORE');
  const [outletFormCity, setOutletFormCity] = useState<string>('Jakarta');
  const [outletFormDistrict, setOutletFormDistrict] = useState<string>('Central');
  const [outletFormAddress, setOutletFormAddress] = useState<string>('');
  const [outletFormPhone, setOutletFormPhone] = useState<string>('+62 21 5550199');
  const [outletFormTargetOmzetIDR, setOutletFormTargetOmzetIDR] = useState<number>(35000000);
  const [outletFormReceiptNote, setOutletFormReceiptNote] = useState<string>(
    'Terima kasih telah berbelanja di GroceMart Indonesia!'
  );
  const [outletFormOpenTime, setOutletFormOpenTime] = useState<string>('07:00');
  const [outletFormCloseTime, setOutletFormCloseTime] = useState<string>('22:00');
  const [outletFormTimezone, setOutletFormTimezone] = useState<'WIB' | 'WITA' | 'WIT'>('WIB');
  const [outletFormIsActive, setOutletFormIsActive] = useState<boolean>(true);
  const [isSavingOutletProfile, setIsSavingOutletProfile] = useState<boolean>(false);

  // 1. COA Management & Mapping State
  const [coaViewMode, setCoaViewMode] = useState<'directory' | 'mapping'>('directory');
  const [isAddingCoa, setIsAddingCoa] = useState<boolean>(false);
  const [editingCoa, setEditingCoa] = useState<ChartOfAccount | null>(null);
  const [newCoaCode, setNewCoaCode] = useState<string>('');
  const [newCoaName, setNewCoaName] = useState<string>('');
  const [newCoaCategory, setNewCoaCategory] = useState<'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense'>('Asset');
  const [newCoaNormalBal, setNewCoaNormalBal] = useState<'Debit' | 'Credit'>('Debit');
  const [newCoaBalance, setNewCoaBalance] = useState<number>(0);
  const [newCoaStore, setNewCoaStore] = useState<string>('CONSOLIDATED');
  const [newCoaDesc, setNewCoaDesc] = useState<string>('');
  const [isSavingAccount, setIsSavingAccount] = useState<boolean>(false);

  const [coaConfig, setCoaConfig] = useState<CoaMappingConfig>({
    posRevenueAccountCode: '4010',
    posRevenueAccountName: 'Grocery Sales Revenue - Retail Storefront',
    inventoryAssetAccountCode: '1040',
    inventoryAssetAccountName: 'Merchandise Inventory Asset',
    shrinkageExpenseAccountCode: '5030',
    shrinkageExpenseAccountName: 'Waste, Spoilage & Shrinkage Expense',
    cogsAccountCode: '5010',
    cogsAccountName: 'Cost of Goods Sold (COGS) - FIFO / WAC',
    cashClearingAccountCode: '1010',
    cashClearingAccountName: 'Cash & Register Drawer Clearing',
    qrisClearingAccountCode: '1030',
    qrisClearingAccountName: 'QRIS Settlement Receivable (ASPI Clearing)',
    edcClearingAccountCode: '1020',
    edcClearingAccountName: 'Bank BCA Operational Clearing (EDC Card)',
    taxPayableAccountCode: '2020',
    taxPayableAccountName: 'Value-Added Tax (PPN) Output Payable',
    updatedAt: new Date().toISOString(),
    updatedBy: 'Siti Rahmawati',
  });

  // 2. POS Configuration State
  const [posConfig, setPosConfig] = useState<PosCheckoutConfig>({
    roundingRule: 'nearest_100',
    ppnTaxPercent: 11,
    isTaxInclusive: false,
    maxCashierDiscountPercent: 15,
    enableVivoNearExpiryDiscount: true,
    vivoNearExpiryDiscountPercent: 25,
    cashDrawerFloatIDR: 500000,
    loyaltyPointsPer1000IDR: 1,
    requireManagerPinForVoid: true,
    storeReceiptFooterText: 'Thank you for shopping at GroceMart! Fresh harvest daily.',
    updatedAt: new Date().toISOString(),
    updatedBy: 'Budi Santoso',
  });

  // 3. Stock Opname State
  const [opnameStoreId, setOpnameStoreId] = useState<string>(
    isBranchScoped ? lockedBranchId : 'store-jkt-senopati'
  );
  const [opnameCategoryFilter, setOpnameCategoryFilter] = useState<string>('ALL');
  const [opnameZoneFilter, setOpnameZoneFilter] = useState<string>('ALL');
  const [opnameSearch, setOpnameSearch] = useState<string>('');
  const [isPartialCycleMode, setIsPartialCycleMode] = useState<boolean>(false);
  const [showOpnameBarcodeScanner, setShowOpnameBarcodeScanner] = useState<boolean>(false);
  const [opnameItems, setOpnameItems] = useState<Record<string, number>>({});
  const [opnameNotes, setOpnameNotes] = useState<Record<string, string>>({});
  const [opnameSessions, setOpnameSessions] = useState<StockOpnameSession[]>([]);

  // 4. Bulk Import Draft Staging State (Rack, Lot & Serial Number SN)
  const [csvText, setCsvText] = useState<string>('');
  const [parsedImportRows, setParsedImportRows] = useState<BulkInventoryImportRow[]>([]);
  const [importTargetStoreId, setImportTargetStoreId] = useState<string>(
    isBranchScoped ? lockedBranchId : 'store-jkt-senopati'
  );

  useEffect(() => {
    if (isBranchScoped && lockedBranchId) {
      setOpnameStoreId((prev) => (prev === lockedBranchId ? prev : lockedBranchId));
      setImportTargetStoreId((prev) => (prev === lockedBranchId ? prev : lockedBranchId));
    }
  }, [isBranchScoped, lockedBranchId]);
  const bulkImportFileInputRef = useRef<HTMLInputElement>(null);
  const [importDraftsList, setImportDraftsList] = useState<InventoryImportDraft[]>([]);
  const [activeImportDraft, setActiveImportDraft] = useState<InventoryImportDraft | null>(null);
  const [draftEditableRows, setDraftEditableRows] = useState<InventoryImportDraftRow[]>([]);
  const [draftSnTextMap, setDraftSnTextMap] = useState<Record<string, string>>({});
  const [isStagingDraft, setIsStagingDraft] = useState<boolean>(false);
  const [isSavingDraft, setIsSavingDraft] = useState<boolean>(false);
  const [isApplyingDraft, setIsApplyingDraft] = useState<boolean>(false);
  const [isDiscardingDraft, setIsDiscardingDraft] = useState<boolean>(false);
  const [lastImportFilename, setLastImportFilename] = useState<string>('');

  // 5. Stock Transfer State
  const [transferRecords, setTransferRecords] = useState<StockTransferRecord[]>([]);
  const [transferSku, setTransferSku] = useState<string>('SKU-PRD-001');
  const [transferSourceStore, setTransferSourceStore] = useState<string>('store-jkt-senopati');
  const [transferDestStore, setTransferDestStore] = useState<string>('store-jkt-pik');
  const [transferQty, setTransferQty] = useState<number>(10);
  const [transferNotes, setTransferNotes] = useState<string>('Weekly stock rebalance');
  const [transferFilterStatus, setTransferFilterStatus] = useState<string>('ALL');
  const [transferAssetType, setTransferAssetType] = useState<string>('NONE');
  const [transferAssetIds, setTransferAssetIds] = useState<string>('');
  const [transferAssetQty, setTransferAssetQty] = useState<number>(2);
  const [returningAssetTransferId, setReturningAssetTransferId] = useState<string | null>(null);

  // 6. Approval Matrix State
  const [approvalRules, setApprovalRules] = useState<ApprovalTierRule[]>([]);
  const [approvalQueue, setApprovalQueue] = useState<ApprovalRequest[]>([]);

  // 7. Promotions & Loyalty Engine State
  const [promotions, setPromotions] = useState<PromotionRule[]>([]);
  const [isCreatingPromo, setIsCreatingPromo] = useState<boolean>(false);
  const [promoTypeFilter, setPromoTypeFilter] = useState<string>('ALL');
  const [promoSearch, setPromoSearch] = useState<string>('');

  // New Promotion Form Fields
  const [newPromoName, setNewPromoName] = useState<string>('');
  const [newPromoCode, setNewPromoCode] = useState<string>('');
  const [newPromoType, setNewPromoType] = useState<PromotionType>('PERCENTAGE_DISCOUNT');
  const [newPromoTargetType, setNewPromoTargetType] = useState<'ALL' | 'CATEGORY' | 'SKU'>('CATEGORY');
  const [newPromoTargetValue, setNewPromoTargetValue] = useState<string>('produce');
  const [newPromoDiscountPercent, setNewPromoDiscountPercent] = useState<number>(20);
  const [newPromoDiscountAmount, setNewPromoDiscountAmount] = useState<number>(0);
  const [newPromoMinSpend, setNewPromoMinSpend] = useState<number>(50000);
  const [newPromoBuyQty, setNewPromoBuyQty] = useState<number>(2);
  const [newPromoGetQty, setNewPromoGetQty] = useState<number>(1);
  const [newPromoMemberTier, setNewPromoMemberTier] = useState<MemberLoyaltyTier>('GOLD');
  const [newPromoDesc, setNewPromoDesc] = useState<string>('');
  const [isSavingPromo, setIsSavingPromo] = useState<boolean>(false);

  // Load configs on mount
  const fetchAllSettings = async () => {
    setIsLoading(true);
    try {
      const [
        coaRes,
        posRes,
        opnameRes,
        transferRes,
        rulesRes,
        queueRes,
        promoRes,
        entRes,
        lcRes,
        binsRes,
        routesRes,
        billsRes,
        poRes,
        grRes,
        monitorRes,
        assignRes,
      ] = await Promise.all([
        apiClient.getCoaMapping().catch(() => null),
        apiClient.getPosConfig().catch(() => null),
        apiClient.getStockOpnameSessions().catch(() => []),
        apiClient.getStockTransfers().catch(() => []),
        apiClient.getApprovalRules().catch(() => []),
        apiClient.getApprovalQueue().catch(() => []),
        apiClient.getPromotions().catch(() => []),
        apiClient.getEnterpriseSettings().catch(() => INITIAL_ENTERPRISE_SETTINGS),
        apiClient.getLandedCosts().catch(() => INITIAL_LANDED_COSTS),
        apiClient.getWarehouseBins().catch(() => INITIAL_WAREHOUSE_BINS),
        apiClient.getWarehouseRoutes().catch(() => INITIAL_WAREHOUSE_ROUTES),
        apiClient.getVendorBills().catch(() => []),
        apiClient.getPurchaseOrders().catch(() => []),
        apiClient.getGoodsReceipts().catch(() => []),
        canViewBranchMonitor ? apiClient.getBranchMonitor().catch(() => null) : Promise.resolve(null),
        canViewBranchMonitor ? apiClient.getOperatorAssignments().catch(() => null) : Promise.resolve(null),
      ]);

      if (coaRes) setCoaConfig(coaRes);
      if (posRes) setPosConfig(posRes);
      if (opnameRes) setOpnameSessions(opnameRes);
      if (transferRes) setTransferRecords(transferRes);
      if (rulesRes) setApprovalRules(rulesRes);
      if (queueRes) setApprovalQueue(queueRes);
      if (promoRes) setPromotions(promoRes);
      if (entRes) {
        setEnterpriseSettings(entRes);
        if (entRes.erpSettings) {
          setErpConfigDraft({
            ...INITIAL_ERP_SETTINGS,
            ...entRes.erpSettings,
            ojolChannelRates: {
              ...INITIAL_ERP_SETTINGS.ojolChannelRates,
              ...(entRes.erpSettings.ojolChannelRates || {}),
            },
          });
        }
      }
      apiClient
        .getErpSettingsConfig()
        .then((cfgRes) => {
          const cfg = cfgRes?.config || cfgRes?.erpSettings;
          if (cfg) {
            setErpConfigDraft({
              ...INITIAL_ERP_SETTINGS,
              ...cfg,
              ojolChannelRates: {
                ...INITIAL_ERP_SETTINGS.ojolChannelRates,
                ...(cfg.ojolChannelRates || {}),
              },
            });
          }
        })
        .catch(() => {});
      if (lcRes) setLandedCosts(lcRes);
      if (binsRes) setWarehouseBins(binsRes);
      if (routesRes) setWarehouseRoutes(routesRes);
      if (billsRes) setVendorBills(billsRes);
      if (poRes) setPurchaseOrders(poRes);
      if (grRes) setGoodsReceipts(grRes);
      if (monitorRes) setBranchMonitorData(monitorRes);
      if (assignRes) {
        const list = assignRes.assignments || [];
        setOperatorAssignments(list);
        setBranchAssignmentOptions(assignRes.branchOptions || []);
        const pinMap: Record<string, string> = {};
        list.forEach((op) => {
          if (op.loginPin) pinMap[op.userId] = op.loginPin;
        });
        setOperatorPinDrafts(pinMap);
      }
    } catch (err) {
      console.error('Failed to load Settings & Configuration:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadBranchMonitorData = async () => {
    if (!canViewBranchMonitor) return;
    setIsLoadingMonitor(true);
    try {
      const [monitorRes, assignRes, sysUsersRes] = await Promise.all([
        apiClient.getBranchMonitor().catch(() => null),
        apiClient.getOperatorAssignments().catch(() => null),
        apiClient.getSystemUsers().catch(() => null),
      ]);
      if (monitorRes) setBranchMonitorData(monitorRes);
      if (assignRes) {
        const list = assignRes.assignments || [];
        setOperatorAssignments(list);
        setBranchAssignmentOptions(assignRes.branchOptions || []);
        const pinMap: Record<string, string> = {};
        list.forEach((op) => {
          if (op.loginPin) pinMap[op.userId] = op.loginPin;
        });
        setOperatorPinDrafts(pinMap);
      }
      if (sysUsersRes?.users) {
        setSystemUsersList(sysUsersRes.users);
        if (sysUsersRes.branchOptions?.length && branchAssignmentOptions.length === 0) {
          setBranchAssignmentOptions(sysUsersRes.branchOptions);
        }
      }
    } finally {
      setIsLoadingMonitor(false);
    }
  };

  useEffect(() => {
    if (canViewBranchMonitor) {
      apiClient
        .getSystemUsers()
        .then((res) => {
          if (res?.users) setSystemUsersList(res.users);
        })
        .catch(() => {});
    }
  }, [canViewBranchMonitor]);

  const openCreateSystemUserModal = () => {
    const defaultRole: DivisionRoleCode = 'POS_CASHIER';
    const preset = DIVISION_ROLE_PRESETS[defaultRole];
    setEditingSystemUser(null);
    setUserFormFullName('');
    setUserFormEmail('');
    setUserFormPassword('');
    setShowUserFormPassword(false);
    setUserFormRoleCode(defaultRole);
    setUserFormBranchId(preset.defaultBranchId);
    setUserFormIsActive(true);
    setUserFormSupervisorPin(preset.defaultSupervisorPin || '');
    setUserFormViewCost(preset.defaultViewCost);
    setUserFormApplyPresetOnSave(true);
    setIsUserModalOpen(true);
  };

  const openEditSystemUserModal = (user: SystemUserAccount) => {
    setEditingSystemUser(user);
    setUserFormFullName(user.fullName);
    setUserFormEmail(user.email);
    setUserFormPassword('');
    setShowUserFormPassword(false);
    setUserFormRoleCode(user.roleCode);
    setUserFormBranchId(user.branchId || 'ALL');
    setUserFormIsActive(user.isActive !== false);
    setUserFormSupervisorPin(user.supervisorPin || '');
    setUserFormViewCost(user.viewCost ?? DIVISION_ROLE_PRESETS[user.roleCode]?.defaultViewCost ?? true);
    setUserFormApplyPresetOnSave(false);
    setIsUserModalOpen(true);
  };

  const handleSaveSystemUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) return;
    setIsSavingSystemUser(true);
    try {
      if (editingSystemUser) {
        const patch: Parameters<typeof apiClient.updateSystemUser>[1] = {
          fullName: userFormFullName.trim(),
          email: userFormEmail.trim().toLowerCase(),
          roleCode: userFormRoleCode,
          branchId: userFormBranchId,
          isActive: userFormIsActive,
          supervisorPin: userFormSupervisorPin.trim(),
          viewCost: userFormViewCost,
          hideFinancialCost: !userFormViewCost,
        };
        if (userFormPassword.trim().length > 0) {
          patch.password = userFormPassword;
        }
        if (userFormApplyPresetOnSave || userFormRoleCode !== editingSystemUser.roleCode) {
          patch.modulePermissions = getDefaultModulePermissions(userFormRoleCode);
        }
        const res = await apiClient.updateSystemUser(editingSystemUser.id, patch);
        setSystemUsersList(res.users || []);
        setDiagnosticRefreshKey((k) => k + 1);
        apiClient.getTrialGovernance().then((g) => g?.governance && onTrialGovernanceUpdated?.(g.governance)).catch(() => {});
        onShowToast('Akun User Diperbarui', res.message);
      } else {
        const res = await apiClient.createSystemUser({
          fullName: userFormFullName.trim(),
          email: userFormEmail.trim().toLowerCase(),
          password: userFormPassword,
          roleCode: userFormRoleCode,
          branchId: userFormBranchId,
          isActive: userFormIsActive,
          supervisorPin: userFormSupervisorPin.trim() || undefined,
          viewCost: userFormViewCost,
          hideFinancialCost: !userFormViewCost,
          modulePermissions: getDefaultModulePermissions(userFormRoleCode),
        });
        setSystemUsersList(res.users || []);
        setDiagnosticRefreshKey((k) => k + 1);
        apiClient.getTrialGovernance().then((g) => g?.governance && onTrialGovernanceUpdated?.(g.governance)).catch(() => {});
        onShowToast('Akun User Ditambahkan', res.message);
      }
      setIsUserModalOpen(false);
      setEditingSystemUser(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Gagal Menyimpan User', msg);
    } finally {
      setIsSavingSystemUser(false);
    }
  };

  const openCreateOutletModal = () => {
    setEditingOutletProfile(null);
    setOutletFormBranchCode('');
    setOutletFormName('');
    setOutletFormType('FLAGSHIP_STORE');
    setOutletFormCity('Jakarta');
    setOutletFormDistrict('Central');
    setOutletFormAddress('');
    setOutletFormPhone('+62 21 5550199');
    setOutletFormTargetOmzetIDR(35000000);
    setOutletFormReceiptNote('Terima kasih telah berbelanja di GroceMart Indonesia!');
    setOutletFormOpenTime('07:00');
    setOutletFormCloseTime('22:00');
    setOutletFormTimezone('WIB');
    setOutletFormIsActive(true);
    setIsOutletModalOpen(true);
  };

  const openEditOutletModal = (branch: BranchMonitorHubSummary) => {
    const matchedSched = storeOutlets.find((s) => s.storeId === branch.storeId);
    setEditingOutletProfile(branch);
    setOutletFormBranchCode(branch.branchCode || matchedSched?.branchCode || '');
    setOutletFormName(branch.storeName || matchedSched?.name || '');
    setOutletFormType(
      branch.outletType ||
        matchedSched?.outletType ||
        (branch.hubType === 'Dark Store'
          ? 'DARK_STORE'
          : branch.hubType === 'Central CDC'
          ? 'CENTRAL_HUB'
          : branch.hubType === 'Express Mart'
          ? 'EXPRESS_MART'
          : 'FLAGSHIP_STORE')
    );
    setOutletFormCity(branch.city || matchedSched?.city || 'Jakarta');
    setOutletFormDistrict(branch.district || matchedSched?.district || 'Central');
    setOutletFormAddress(branch.address || matchedSched?.address || '');
    setOutletFormPhone(branch.phone || matchedSched?.phone || matchedSched?.contactPhone || '+62 21 5550199');
    setOutletFormTargetOmzetIDR(
      branch.targetDailyOmzetIDR ?? matchedSched?.targetDailyOmzetIDR ?? 35000000
    );
    setOutletFormReceiptNote(
      branch.receiptHeaderNote ??
        matchedSched?.receiptHeaderNote ??
        'Terima kasih telah berbelanja di GroceMart Indonesia!'
    );
    setOutletFormOpenTime(branch.openTime || matchedSched?.openTime || '07:00');
    setOutletFormCloseTime(branch.closeTime || matchedSched?.closeTime || '22:00');
    setOutletFormTimezone(
      (branch.timezone || matchedSched?.timezone || 'WIB') as 'WIB' | 'WITA' | 'WIT'
    );
    setOutletFormIsActive(branch.isActive !== false && matchedSched?.isActive !== false);
    setIsOutletModalOpen(true);
  };

  const handleSaveOutletProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) return;
    setIsSavingOutletProfile(true);
    try {
      if (editingOutletProfile) {
        const res = await apiClient.updateAdminOutlet(editingOutletProfile.storeId, {
          branchCode: outletFormBranchCode.trim().toUpperCase(),
          name: outletFormName.trim(),
          outletType: outletFormType,
          city: outletFormCity.trim(),
          district: outletFormDistrict.trim(),
          address: outletFormAddress.trim(),
          phone: outletFormPhone.trim(),
          targetDailyOmzetIDR: Math.max(0, Math.round(Number(outletFormTargetOmzetIDR) || 0)),
          receiptHeaderNote: outletFormReceiptNote.trim(),
          openTime: outletFormOpenTime.trim(),
          closeTime: outletFormCloseTime.trim(),
          timezone: outletFormTimezone,
          isActive: outletFormIsActive,
        });
        if (res.branchOptions?.length) setBranchAssignmentOptions(res.branchOptions);
        onShowToast('Profil Outlet Diperbarui', res.message);
      } else {
        const res = await apiClient.createAdminOutlet({
          branchCode: outletFormBranchCode.trim().toUpperCase(),
          name: outletFormName.trim(),
          outletType: outletFormType,
          city: outletFormCity.trim(),
          district: outletFormDistrict.trim(),
          address: outletFormAddress.trim() || `${outletFormDistrict.trim()}, ${outletFormCity.trim()}`,
          phone: outletFormPhone.trim(),
          targetDailyOmzetIDR: Math.max(0, Math.round(Number(outletFormTargetOmzetIDR) || 0)),
          receiptHeaderNote: outletFormReceiptNote.trim(),
          openTime: outletFormOpenTime.trim(),
          closeTime: outletFormCloseTime.trim(),
          timezone: outletFormTimezone,
          isActive: outletFormIsActive,
        });
        if (res.branchOptions?.length) setBranchAssignmentOptions(res.branchOptions);
        onShowToast('Outlet Baru Ditambahkan', res.message);
      }
      setIsOutletModalOpen(false);
      setEditingOutletProfile(null);
      await loadBranchMonitorData();
      onRefreshData?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Gagal Menyimpan Outlet', msg);
    } finally {
      setIsSavingOutletProfile(false);
    }
  };

  const openPermissionMatrixModal = (user: SystemUserAccount) => {
    setPermModalUser(user);
    setPermDraft(JSON.parse(JSON.stringify(user.modulePermissions || getDefaultModulePermissions(user.roleCode))));
  };

  const handleToggleModulePermissionCell = (modKey: ModulePermissionKey, action: ModulePermissionAction) => {
    setPermDraft((prev) => {
      if (!prev) return prev;
      const currentSet = prev[modKey] || { view: false, create: false, edit: false, approve: false, export: false };
      const nextVal = !currentSet[action];
      return {
        ...prev,
        [modKey]: {
          ...currentSet,
          [action]: nextVal,
          ...(action !== 'view' && nextVal ? { view: true } : {}),
        },
      };
    });
  };

  const handleToggleAccountingSubFlag = (
    flagKey: 'canAccessAR' | 'canAccessAP' | 'canAccessGLTax' | 'canApprovePayments' | 'canLockPeriod'
  ) => {
    setPermDraft((prev) => {
      if (!prev) return prev;
      const currentAcct = prev.accounting || {
        view: false,
        create: false,
        edit: false,
        approve: false,
        export: false,
      };
      const nextVal = !(currentAcct[flagKey] === true);
      return {
        ...prev,
        accounting: {
          ...currentAcct,
          [flagKey]: nextVal,
          ...(nextVal ? { view: true } : {}),
        },
      };
    });
  };

  const handleSavePermissionMatrix = async () => {
    if (!permModalUser || !permDraft || !isSuperAdmin) return;
    setIsSavingPermMatrix(true);
    try {
      const res = await apiClient.updateSystemUser(permModalUser.id, {
        modulePermissions: permDraft,
      });
      setSystemUsersList(res.users || []);
      setDiagnosticRefreshKey((k) => k + 1);
      apiClient.getTrialGovernance().then((g) => g?.governance && onTrialGovernanceUpdated?.(g.governance)).catch(() => {});
      onShowToast('Hak Akses Modul Disimpan', `Matriks izin ${permModalUser.fullName} berhasil diperbarui.`);
      setPermModalUser(null);
      setPermDraft(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Gagal Menyimpan Hak Akses', msg);
    } finally {
      setIsSavingPermMatrix(false);
    }
  };

  const handleConfirmArrival = async (type: 'TRANSFER' | 'PO', id: string) => {
    setConfirmingArrivalId(`${type}:${id}`);
    try {
      const res = await apiClient.confirmBranchArrival({ type, id });
      onShowToast('Arrival Confirmed', res.message);
      await loadBranchMonitorData();
      onRefreshData?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Confirm Arrival Failed', msg);
    } finally {
      setConfirmingArrivalId(null);
    }
  };

  const handleUpdateOperatorAssignment = async (
    userId: string,
    patch: { storeId?: string; userRole?: UserRole; isActive?: boolean; loginPin?: string }
  ) => {
    setSavingAssignmentUserId(userId);
    try {
      const res = await apiClient.updateOperatorAssignment({ userId, ...patch });
      const list = res.assignments || [];
      setOperatorAssignments(list);
      const pinMap: Record<string, string> = {};
      list.forEach((op) => {
        if (op.loginPin) pinMap[op.userId] = op.loginPin;
      });
      setOperatorPinDrafts((prev) => ({ ...prev, ...pinMap }));
      onShowToast('Operator Governance Updated', res.message);
      onOperatorAssignmentsUpdated?.({
        currentSession: res.currentSession,
        availableProfiles: res.availableProfiles,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Assignment Update Blocked', msg);
    } finally {
      setSavingAssignmentUserId(null);
    }
  };

  const handleUpdateEnterpriseSettings = async (updated: Partial<EnterpriseSettingsConfig>) => {
    setIsSavingEnterprise(true);
    try {
      const res = await apiClient.updateEnterpriseSettings(updated);
      if (res.success && res.settings) {
        setEnterpriseSettings(res.settings);
        if (res.settings.erpSettings) {
          setErpConfigDraft((prev) => ({ ...prev, ...res.settings.erpSettings }));
        }
        onShowToast('Enterprise Settings Updated', 'System configurations synchronized across all modules.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Error', msg);
    } finally {
      setIsSavingEnterprise(false);
    }
  };

  const handleSaveErpConfig = async () => {
    setIsSavingErpConfig(true);
    try {
      const res = await apiClient.updateErpSettingsConfig(erpConfigDraft);
      if (res.success) {
        setErpConfigDraft({
          ...INITIAL_ERP_SETTINGS,
          ...(res.config || res.erpSettings),
          ojolChannelRates: {
            ...INITIAL_ERP_SETTINGS.ojolChannelRates,
            ...((res.config || res.erpSettings)?.ojolChannelRates || {}),
          },
        });
        if (res.settings) setEnterpriseSettings(res.settings);
        onShowToast('ERP Policy Parameters Saved', res.message || 'Dynamic tax, POS treasury, compliance, and period lock parameters updated.');
        onRefreshData?.();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Save ERP Parameters Failed', msg);
    } finally {
      setIsSavingErpConfig(false);
    }
  };

  const handleRefreshLandedCosts = async () => {
    try {
      const res = await apiClient.getLandedCosts();
      setLandedCosts(res);
    } catch {
      // ignore
    }
  };

  const handleRefreshBins = async () => {
    try {
      const res = await apiClient.getWarehouseBins();
      setWarehouseBins(res);
    } catch {
      // ignore
    }
  };

  const handleRefreshRoutes = async () => {
    try {
      const res = await apiClient.getWarehouseRoutes();
      setWarehouseRoutes(res);
    } catch {
      // ignore
    }
  };

  const handleTogglePromoActive = async (rule: PromotionRule) => {
    try {
      const res = await apiClient.updatePromotion(rule.id, { active: !rule.active });
      if (res.success) {
        setPromotions((prev) => prev.map((r) => (r.id === rule.id ? res.rule : r)));
        onShowToast('Promotion Updated', `[${res.rule.code}] is now ${res.rule.active ? 'ACTIVE' : 'PAUSED'}.`);
      }
    } catch (err: any) {
      onShowToast('Error', err.message || 'Failed to update promotion');
    }
  };

  const handleDeletePromo = async (id: string) => {
    try {
      const res = await apiClient.deletePromotion(id);
      if (res.success) {
        setPromotions((prev) => prev.map((r) => (r.id === id ? { ...r, active: false } : r)));
        onShowToast('Promotion Deactivated', res.message);
      }
    } catch (err: any) {
      onShowToast('Error', err.message || 'Failed to deactivate promotion');
    }
  };

  const handleSavePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromoName.trim() || !newPromoCode.trim()) {
      onShowToast('Validation Error', 'Promotion Name and Promo Code are required.');
      return;
    }
    setIsSavingPromo(true);
    try {
      const payload: Partial<PromotionRule> = {
        name: newPromoName.trim(),
        code: newPromoCode.trim().toUpperCase(),
        type: newPromoType,
        targetType: newPromoTargetType,
        targetValue: newPromoTargetValue,
        discountPercent: newPromoType === 'PERCENTAGE_DISCOUNT' || newPromoType === 'MEMBER_TIER' || newPromoType === 'CATEGORY_BUNDLE' ? Number(newPromoDiscountPercent) : undefined,
        discountAmountIDR: newPromoType === 'FIXED_DISCOUNT' ? Number(newPromoDiscountAmount) : undefined,
        minOrderSubtotalIDR: Number(newPromoMinSpend) || undefined,
        buyQty: newPromoType === 'BOGO' ? Number(newPromoBuyQty) : undefined,
        getQty: newPromoType === 'BOGO' ? Number(newPromoGetQty) : undefined,
        getDiscountPercent: 100,
        memberTier: newPromoType === 'MEMBER_TIER' ? newPromoMemberTier : undefined,
        active: true,
        description: newPromoDesc.trim() || `${newPromoName} retail promotion`,
      };

      const res = await apiClient.createPromotion(payload);
      if (res.success) {
        setPromotions((prev) => [res.rule, ...prev]);
        setIsCreatingPromo(false);
        setNewPromoName('');
        setNewPromoCode('');
        setNewPromoDesc('');
        onShowToast('Promotion Rule Created', `Active coupon [${res.rule.code}] live across POS and Storefront.`);
      }
    } catch (err: any) {
      onShowToast('Error', err.message || 'Failed to create promotion rule');
    } finally {
      setIsSavingPromo(false);
    }
  };

  useEffect(() => {
    fetchAllSettings();
  }, []);

  // Initialize stock opname counted quantities when store changes or tiers change
  useEffect(() => {
    const storeTiers = inventoryTiers.filter(
      (t) => t.storeId === opnameStoreId || (!inventoryTiers.some((x) => x.storeId === opnameStoreId) && t.storeId === 'store-jkt-senopati')
    );
    const initialCounts: Record<string, number> = {};
    const initialNotes: Record<string, string> = {};

    storeTiers.forEach((tier) => {
      initialCounts[tier.sku] = tier.physicalStock;
      initialNotes[tier.sku] = '';
    });

    setOpnameItems(initialCounts);
    setOpnameNotes(initialNotes);
  }, [opnameStoreId, inventoryTiers]);

  // Handle Save COA Mapping
  const handleSaveCoa = async () => {
    setIsSavingCoa(true);
    try {
      const res = await apiClient.updateCoaMapping(coaConfig);
      if (res.success) {
        setCoaConfig(res.config);
        onShowToast('COA Mapping Saved', 'Dynamic General Ledger accounts mapped for POS and Inventory.');
      }
    } catch (err: any) {
      onShowToast('Save Error', err.message || 'Failed to save COA mapping');
    } finally {
      setIsSavingCoa(false);
    }
  };

  // Handle Create or Update COA Account (Manual COA Management)
  const handleSaveCoaAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCoaCode.trim() || !newCoaName.trim()) {
      onShowToast('Validation Error', 'Account Code and Name are required.');
      return;
    }
    setIsSavingAccount(true);
    try {
      if (editingCoa) {
        const res = await apiClient.updateCoaAccount(editingCoa.accountCode, {
          accountName: newCoaName,
          category: newCoaCategory,
          normalBalance: newCoaNormalBal,
          description: newCoaDesc,
          balance: newCoaBalance,
        });
        if (res.success) {
          onShowToast('Account Updated', `Account [${res.account.accountCode}] ${res.account.accountName} updated.`);
          setEditingCoa(null);
          setIsAddingCoa(false);
          if (onRefreshData) onRefreshData();
        }
      } else {
        const res = await apiClient.createCoaAccount({
          accountCode: newCoaCode.trim(),
          accountName: newCoaName.trim(),
          category: newCoaCategory,
          storeId: newCoaStore,
          normalBalance: newCoaNormalBal,
          balance: Number(newCoaBalance) || 0,
          description: newCoaDesc,
        });
        if (res.success) {
          onShowToast('Account Created', `Created COA account [${res.account.accountCode}] ${res.account.accountName}.`);
          setIsAddingCoa(false);
          setNewCoaCode('');
          setNewCoaName('');
          setNewCoaDesc('');
          setNewCoaBalance(0);
          if (onRefreshData) onRefreshData();
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Error', msg);
    } finally {
      setIsSavingAccount(false);
    }
  };

  const openCreateAccountModal = () => {
    setEditingCoa(null);
    setNewCoaCode('');
    setNewCoaName('');
    setNewCoaCategory('Asset');
    setNewCoaNormalBal('Debit');
    setNewCoaBalance(0);
    setNewCoaDesc('');
    setIsAddingCoa(true);
  };

  const openEditAccountModal = (account: ChartOfAccount) => {
    setEditingCoa(account);
    setNewCoaCode(account.accountCode);
    setNewCoaName(account.accountName);
    setNewCoaCategory(account.category);
    setNewCoaNormalBal(account.normalBalance);
    setNewCoaBalance(account.balance);
    setNewCoaDesc(account.description || '');
    setIsAddingCoa(true);
  };

  // Handle Save POS Configuration
  const handleSavePosConfig = async () => {
    setIsSavingPos(true);
    try {
      const res = await apiClient.updatePosConfig(posConfig);
      if (res.success) {
        setPosConfig(res.config);
        onShowToast('POS Rules Saved', 'Rounding, tax, discount limits & float updated for all registers.');
      }
    } catch (err: any) {
      onShowToast('Save Error', err.message || 'Failed to save POS configuration');
    } finally {
      setIsSavingPos(false);
    }
  };

  const syncActiveDraftState = (draft: InventoryImportDraft | null) => {
    setActiveImportDraft(draft);
    if (!draft) {
      setDraftEditableRows([]);
      setDraftSnTextMap({});
      return;
    }
    setDraftEditableRows(draft.rows || []);
    const snMap: Record<string, string> = {};
    (draft.rows || []).forEach((r) => {
      snMap[r.rowId] = Array.isArray(r.serialNumbers) ? r.serialNumbers.join(', ') : '';
    });
    setDraftSnTextMap(snMap);
  };

  const loadImportDrafts = async () => {
    try {
      const res = await apiClient.getInventoryImportDrafts();
      const drafts = res.drafts || [];
      setImportDraftsList(drafts);
      if (!activeImportDraft) {
        const pending = drafts.find((d) => d.status === 'DRAFT') || null;
        if (pending) syncActiveDraftState(pending);
      }
    } catch {
      // silent if read restricted
    }
  };

  useEffect(() => {
    if (activeSubTab === 'import_opname' && opnameSubTab === 'bulk_import') {
      void loadImportDrafts();
    }
  }, [activeSubTab, opnameSubTab]);

  const inferSmartExpiryDate = (category: string): string => {
    const cat = String(category || '').toLowerCase();
    const days =
      cat.includes('produce') || cat.includes('bakery') || cat.includes('fresh')
        ? 14
        : cat.includes('dairy') || cat.includes('egg') || cat.includes('meat') || cat.includes('seafood')
        ? 30
        : 180;
    return new Date(Date.now() + days * 86400000).toISOString().split('T')[0];
  };

  const parseCsvLineQuoted = (line: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        out.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out;
  };

  const parseTabularRowsToDraftInput = (matrix: string[][]): Partial<InventoryImportDraftRow>[] => {
    if (matrix.length < 2) return [];
    const headers = matrix[0].map((h) => String(h || '').trim().toLowerCase());
    const findCol = (patterns: string[], fallbackIdx: number): number => {
      const idx = headers.findIndex((h) => patterns.some((p) => h.includes(p)));
      return idx >= 0 ? idx : fallbackIdx;
    };

    const skuIdx = findCol(['sku', 'kode'], 0);
    const nameIdx = findCol(['product', 'nama', 'name'], 1);
    const catIdx = findCol(['cat', 'kategori'], 2);
    const stockIdx = findCol(['stock', 'qty', 'stok', 'jumlah'], 3);
    const costIdx = findCol(['cost', 'hpp', 'beli'], 4);
    const priceIdx = findCol(['sell', 'jual', 'price', 'harga'], 5);
    const minIdx = findCol(['min', 'thresh'], 6);
    const unitIdx = findCol(['unit', 'uom', 'satuan'], 7);
    const supIdx = findCol(['supp', 'vendor', 'pemasok'], 8);
    const rackIdx = findCol(['rack', 'bin', 'rak', 'lokasi'], 9);
    const lotIdx = findCol(['lot', 'batch'], 10);
    const expIdx = findCol(['exp', 'kadaluarsa', 'ed'], 11);
    const snIdx = findCol(['serial', 'sn'], 12);
    const classIdx = headers.findIndex((h) =>
      ['class', 'klasifikasi', 'item_class', 'asset_type'].some((p) => h.includes(p))
    );

    const normalizeDraftClass = (raw: string): ItemClassification => {
      const up = raw.trim().toUpperCase().replace(/[\s-]+/g, '_');
      if (up === 'FIXED_ASSET' || up === 'ASSET' || up === 'ASET_TETAP' || up === 'EQUIPMENT') {
        return 'FIXED_ASSET';
      }
      if (up === 'CONSUMABLE' || up === 'SUPPLIES' || up === 'BAHAN_HABIS_PAKAI') {
        return 'CONSUMABLE';
      }
      return 'MERCHANDISE';
    };

    const todayStamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const parsed: Partial<InventoryImportDraftRow>[] = [];

    for (let i = 1; i < matrix.length; i++) {
      const cells = matrix[i];
      if (!cells || cells.every((c) => !String(c || '').trim())) continue;
      const getVal = (idx: number) => (idx >= 0 && idx < cells.length ? String(cells[idx] ?? '').trim() : '');
      const sku = getVal(skuIdx).toUpperCase();
      if (!sku) continue;
      const seq = String(parsed.length + 1).padStart(2, '0');
      const category = getVal(catIdx) || 'produce';
      const unitCost = Math.round(Number(getVal(costIdx).replace(/[^0-9.-]/g, '')) || 0);
      const rawPrice = getVal(priceIdx).replace(/[^0-9.-]/g, '');
      const sellingPrice = rawPrice ? Math.round(Number(rawPrice)) : Math.round(Math.max(0, unitCost) * 1.4);
      const physicalStock = Number(getVal(stockIdx).replace(/[^0-9.-]/g, '')) || 0;
      const minimumThreshold = Math.round(Number(getVal(minIdx).replace(/[^0-9.-]/g, '')) || 10);
      const rawSn = getVal(snIdx);
      const serialNumbers = rawSn
        ? Array.from(new Set(rawSn.split(/[;,|]+/).map((s) => s.trim()).filter(Boolean)))
        : [];
      const rawClassVal = classIdx >= 0 ? getVal(classIdx) : '';
      const itemClassification: ItemClassification | undefined = rawClassVal
        ? normalizeDraftClass(rawClassVal)
        : undefined;

      parsed.push({
        sku,
        productName: getVal(nameIdx) || `Product ${sku}`,
        category,
        itemClassification,
        physicalStock,
        unitCost,
        sellingPrice,
        minimumThreshold,
        unit: getVal(unitIdx) || 'pack',
        supplierName: getVal(supIdx) || 'Local Farm Coop',
        rackLocation: (getVal(rackIdx) || 'RACK-GEN-01').toUpperCase(),
        lotNumber: getVal(lotIdx) || `LOT-IMP-${todayStamp}-${seq}`,
        expiryDate: getVal(expIdx) || inferSmartExpiryDate(category),
        serialNumbers,
      });
    }
    return parsed;
  };

  const stageRowsAsServerDraft = async (
    rowsToStage: Partial<InventoryImportDraftRow>[],
    sourceFilename?: string,
    targetStoreOverride?: string
  ) => {
    if (rowsToStage.length === 0) {
      onShowToast('No Valid Rows', 'Enter or upload at least 1 valid inventory row to stage a draft.');
      return;
    }
    setIsStagingDraft(true);
    setBulkImportDiagnosticReport(null);
    try {
      const res = await apiClient.createInventoryImportDraft({
        storeId: targetStoreOverride || importTargetStoreId,
        sourceFilename,
        rows: rowsToStage,
      });
      if (res.diagnosticReport && (res.diagnosticReport.errorCount > 0 || res.diagnosticReport.warningCount > 0)) {
        setBulkImportDiagnosticReport(res.diagnosticReport);
        setDiagnosticRefreshKey((k) => k + 1);
      }
      if (res.success && res.draft) {
        syncActiveDraftState(res.draft);
        setImportDraftsList((prev) => [res.draft, ...prev.filter((d) => d.id !== res.draft.id)]);
        onShowToast('Import Draft Staged', res.message);
      }
    } catch (err: any) {
      const diag = buildDiagnosticFromError({
        operation: 'IMPORT',
        source: sourceFilename || 'bulk_inventory_import.csv',
        error: err,
        totalRecords: rowsToStage.length,
        actorName: activeStaffSession?.userName,
      });
      setBulkImportDiagnosticReport(diag);
      if (!err?.diagnosticReport) {
        apiClient.recordImportExportDiagnostic(diag).catch(() => {});
      }
      setDiagnosticRefreshKey((k) => k + 1);
      onShowToast('Draft Staging Failed', err.message || 'Could not create import draft');
    } finally {
      setIsStagingDraft(false);
    }
  };

  // Handle Parse CSV for Bulk Import (updates local preview; staging happens via Draft endpoint)
  const handleParseCsv = (rawText: string) => {
    setCsvText(rawText);
    const lines = rawText
      .replace(/\r\n/g, '\n')
      .trim()
      .split('\n')
      .filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      setParsedImportRows([]);
      return;
    }

    const matrix = lines.map(parseCsvLineQuoted);
    const draftInput = parseTabularRowsToDraftInput(matrix);
    const store = storeOutlets.find((s) => s.storeId === importTargetStoreId);
    const defaultStoreName = store?.storeName || 'Senopati Flagship';

    const preview: BulkInventoryImportRow[] = draftInput.map((d) => ({
      sku: d.sku || '',
      productName: d.productName || '',
      category: d.category || 'produce',
      storeId: importTargetStoreId,
      storeName: defaultStoreName,
      warehouseZoneId: store?.activeWarehouses[0] || 'WH-JKT-SEN-AMB',
      storageType:
        d.category === 'produce' || d.category === 'dairy_eggs'
          ? 'cold_chilled'
          : d.category === 'meat_seafood'
          ? 'freezer'
          : 'ambient',
      physicalStock: d.physicalStock || 0,
      unitCost: d.unitCost || 0,
      sellingPrice: d.sellingPrice || 0,
      minimumThreshold: d.minimumThreshold || 10,
      unit: d.unit || 'pack',
      supplierName: d.supplierName || 'Local Farm Coop',
      rackLocation: d.rackLocation,
      lotNumber: d.lotNumber,
      expiryDate: d.expiryDate,
      serialNumbers: d.serialNumbers,
    }));

    setParsedImportRows(preview);
  };

  const handleBulkImportFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLastImportFilename(file.name);
    try {
      const lowerName = file.name.toLowerCase();
      let matrix: string[][] = [];
      if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const firstSheet = wb.SheetNames[0];
        if (!firstSheet) throw new Error('Excel workbook contains no sheets.');
        const aoa = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[firstSheet], { header: 1, raw: false });
        matrix = aoa.map((row) => (Array.isArray(row) ? row.map((c) => String(c ?? '').trim()) : []));
        const csvPreview = matrix.map((r) => r.join(',')).join('\n');
        setCsvText(csvPreview);
      } else {
        const text = await file.text();
        setCsvText(text);
        matrix = text
          .replace(/\r\n/g, '\n')
          .trim()
          .split('\n')
          .filter((l) => l.trim().length > 0)
          .map(parseCsvLineQuoted);
      }

      const draftRows = parseTabularRowsToDraftInput(matrix);
      if (draftRows.length === 0) {
        const emptyDiag = buildDiagnosticFromError({
          operation: 'IMPORT',
          source: file.name,
          error: new Error('No valid data rows found in the uploaded file. Verify column headers (SKU, Product Name, Stock, Unit Cost).'),
          totalRecords: 0,
          actorName: activeStaffSession?.userName,
        });
        setBulkImportDiagnosticReport(emptyDiag);
        apiClient.recordImportExportDiagnostic(emptyDiag).catch(() => {});
        setDiagnosticRefreshKey((k) => k + 1);
        onShowToast('Empty File', 'No valid data rows found in the uploaded file.');
        return;
      }
      await stageRowsAsServerDraft(draftRows, file.name);
    } catch (err: any) {
      const parseDiag = buildDiagnosticFromError({
        operation: 'IMPORT',
        source: file.name,
        error: err,
        totalRecords: 0,
        actorName: activeStaffSession?.userName,
      });
      setBulkImportDiagnosticReport(parseDiag);
      apiClient.recordImportExportDiagnostic(parseDiag).catch(() => {});
      setDiagnosticRefreshKey((k) => k + 1);
      onShowToast('File Parse Error', err.message || 'Failed to read .CSV / .XLSX file');
    } finally {
      if (bulkImportFileInputRef.current) bulkImportFileInputRef.current.value = '';
    }
  };

  // Sample CSV generator (stages directly as a safe DRAFT for inline review)
  const handleLoadSampleCsv = async () => {
    const todayStamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const expFresh = inferSmartExpiryDate('produce');
    const expCold = inferSmartExpiryDate('dairy_eggs');
    const sample = `SKU,Product Name,Category,Physical Stock,Unit Cost (IDR),Selling Price (IDR),Min Threshold,Unit,Supplier,Rack Location,Lot Number,Expiry Date,Serial Numbers (SN)
SKU-PRD-001,Organic Hydroponic Butterhead Lettuce,produce,65,11000,18500,20,250g head,Kebun Lembang Eco,CHILL-A1,LOT-IMP-${todayStamp}-01,${expFresh},
SKU-PRD-002,Heirloom Vine-Ripened Sweet Tomatoes,produce,30,14500,24000,15,500g pack,Ciwidey Farmers,CHILL-A2,LOT-IMP-${todayStamp}-02,${expFresh},
SKU-DAI-001,Pastured Free-Range Omega-3 Eggs,dairy_eggs,45,22000,34000,20,10-pack tray,Bogor Pastures,CHILL-B1,LOT-IMP-${todayStamp}-03,${expCold},
SKU-MEA-001,Grass-Fed Angus Ribeye Steak,meat_seafood,18,78000,125000,10,250g cut,Santosa Prime Butchery,FREEZ-C1,LOT-IMP-${todayStamp}-04,${expCold},SN-RIB-001;SN-RIB-002
SKU-BAK-001,Artisan Country Sourdough Loaf,bakery,28,24000,40000,10,650g loaf,Heritage Woodfire Oven,AMB-D1,LOT-IMP-${todayStamp}-05,${expFresh},`;

    setLastImportFilename('sample_inventory_matrix.csv');
    handleParseCsv(sample);
    const matrix = sample
      .trim()
      .split('\n')
      .map(parseCsvLineQuoted);
    await stageRowsAsServerDraft(parseTabularRowsToDraftInput(matrix), 'sample_inventory_matrix.csv');
  };

  const handleStagePastedCsvAsDraft = async () => {
    const lines = csvText
      .replace(/\r\n/g, '\n')
      .trim()
      .split('\n')
      .filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      onShowToast('Invalid CSV', 'Paste a header row plus at least 1 data row first.');
      return;
    }
    const matrix = lines.map(parseCsvLineQuoted);
    await stageRowsAsServerDraft(parseTabularRowsToDraftInput(matrix), lastImportFilename || 'pasted_csv_import.csv');
  };

  const revalidateDraftRowLocal = (row: InventoryImportDraftRow): InventoryImportDraftRow => {
    const todayStr = new Date().toISOString().split('T')[0];
    const errors: string[] = [];
    if (!row.sku.trim()) errors.push('SKU required');
    if (!row.productName.trim()) errors.push('Product Name required');
    if (!Number.isFinite(row.physicalStock) || row.physicalStock <= 0) errors.push('Qty > 0');
    if (!Number.isFinite(row.unitCost) || row.unitCost <= 0) errors.push('Cost > 0');
    if (!Number.isFinite(row.sellingPrice) || row.sellingPrice < 0) errors.push('Price >= 0');
    if (!row.rackLocation.trim()) errors.push('Rack required');
    if (!row.lotNumber.trim()) errors.push('Lot required');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.expiryDate)) {
      errors.push('Expiry YYYY-MM-DD');
    } else if (row.expiryDate < todayStr) {
      errors.push('Expired date');
    }
    const existsInStore = inventoryTiers.some(
      (t) => t.sku === row.sku.trim().toUpperCase() && t.storeId === (activeImportDraft?.storeId || importTargetStoreId)
    );
    return {
      ...row,
      status: errors.length > 0 ? 'VALIDATION_ERROR' : existsInStore ? 'RESTOCK' : 'NEW_SKU',
      validationError: errors.length > 0 ? errors.join('; ') : undefined,
    };
  };

  const handleDraftRowFieldChange = <K extends keyof InventoryImportDraftRow>(
    rowId: string,
    field: K,
    value: InventoryImportDraftRow[K]
  ) => {
    setDraftEditableRows((prev) =>
      prev.map((row) => {
        if (row.rowId !== rowId) return row;
        const updated = { ...row, [field]: value };
        return revalidateDraftRowLocal(updated);
      })
    );
  };

  const handleDraftSnChange = (rowId: string, rawText: string) => {
    setDraftSnTextMap((prev) => ({ ...prev, [rowId]: rawText }));
    const parsedSns = Array.from(
      new Set(
        rawText
          .split(/[;,|\n]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      )
    );
    handleDraftRowFieldChange(rowId, 'serialNumbers', parsedSns);
  };

  const handleRemoveDraftRow = (rowId: string) => {
    setDraftEditableRows((prev) => prev.filter((r) => r.rowId !== rowId));
  };

  const handleSaveDraftEdits = async () => {
    if (!activeImportDraft || activeImportDraft.status !== 'DRAFT') return;
    setIsSavingDraft(true);
    try {
      const res = await apiClient.updateInventoryImportDraft(activeImportDraft.id, {
        storeId: importTargetStoreId,
        rows: draftEditableRows,
      });
      if (res.success && res.draft) {
        syncActiveDraftState(res.draft);
        setImportDraftsList((prev) => prev.map((d) => (d.id === res.draft.id ? res.draft : d)));
        onShowToast('Draft Saved', res.message);
      }
    } catch (err: any) {
      onShowToast('Save Draft Failed', err.message || 'Could not update draft');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleDiscardImportDraft = async () => {
    if (!activeImportDraft || activeImportDraft.status !== 'DRAFT') return;
    setIsDiscardingDraft(true);
    try {
      const res = await apiClient.discardInventoryImportDraft(activeImportDraft.id);
      if (res.success) {
        setImportDraftsList((prev) => prev.map((d) => (d.id === res.draft.id ? res.draft : d)));
        syncActiveDraftState(null);
        setCsvText('');
        setParsedImportRows([]);
        onShowToast('Draft Discarded', res.message);
      }
    } catch (err: any) {
      onShowToast('Discard Failed', err.message || 'Could not discard draft');
    } finally {
      setIsDiscardingDraft(false);
    }
  };

  const handleApplyImportDraft = async () => {
    if (!activeImportDraft || activeImportDraft.status !== 'DRAFT' || isApplyingDraft) return;
    const errorRows = draftEditableRows.filter((r) => r.status === 'VALIDATION_ERROR');
    if (draftEditableRows.length === 0) {
      onShowToast('Empty Draft', 'Draft must contain at least 1 valid row before applying.');
      return;
    }
    if (errorRows.length > 0) {
      onShowToast('Validation Errors Present', `Resolve or remove ${errorRows.length} invalid row(s) before applying.`);
      return;
    }

    setIsApplyingDraft(true);
    setIsImporting(true);
    try {
      // Persist latest target store if changed before atomic apply
      if (importTargetStoreId !== activeImportDraft.storeId) {
        await apiClient.updateInventoryImportDraft(activeImportDraft.id, {
          storeId: importTargetStoreId,
          rows: draftEditableRows,
        });
      }
      const res = await apiClient.applyInventoryImportDraft(activeImportDraft.id, draftEditableRows);
      if (res.success && res.draft) {
        setImportDraftsList((prev) => prev.map((d) => (d.id === res.draft.id ? res.draft : d)));
        syncActiveDraftState(null);
        setCsvText('');
        setParsedImportRows([]);
        onShowToast('Draft Applied to Live Inventory', res.message);
        if (onRefreshData) onRefreshData();
      }
    } catch (err: any) {
      const diag = buildDiagnosticFromError({
        operation: 'IMPORT',
        source: activeImportDraft.sourceFilename || activeImportDraft.id,
        error: err,
        totalRecords: draftEditableRows.length,
        actorName: activeStaffSession?.userName,
      });
      setBulkImportDiagnosticReport(diag);
      if (!err?.diagnosticReport) {
        apiClient.recordImportExportDiagnostic(diag).catch(() => {});
      }
      setDiagnosticRefreshKey((k) => k + 1);
      onShowToast('Apply Draft Failed', err.message || 'Failed to apply draft to live inventory');
    } finally {
      setIsApplyingDraft(false);
      setIsImporting(false);
    }
  };

  // Handle Execute Stock Opname Reconcile (supports Partial Cycle Counting partition)
  const handleExecuteOpname = async () => {
    const targetStore = storeOutlets.find((s) => s.storeId === opnameStoreId);
    const storeName = targetStore?.storeName || 'Senopati Flagship';

    const storeTiers = inventoryTiers.filter((t) => t.storeId === opnameStoreId);
    const usePartition =
      isPartialCycleMode ||
      opnameCategoryFilter !== 'ALL' ||
      opnameZoneFilter !== 'ALL' ||
      opnameSearch.trim().length > 0;
    const relevantTiers = usePartition ? filteredOpnameTiers : storeTiers;

    if (relevantTiers.length === 0) {
      onShowToast('No Items', `No inventory items matched for cycle count at ${storeName}`);
      return;
    }

    const payloadItems: StockOpnameItem[] = relevantTiers.map((tier) => {
      const counted = opnameItems[tier.sku] !== undefined ? opnameItems[tier.sku] : tier.physicalStock;
      const variance = Number((counted - tier.physicalStock).toFixed(2));
      const financialVariance = Math.round(variance * tier.unitCost);

      return {
        sku: tier.sku,
        productName: tier.productName,
        category: tier.category,
        storeId: opnameStoreId,
        storeName,
        warehouseZoneId: tier.warehouseZoneId,
        systemStock: tier.physicalStock,
        countedStock: counted,
        varianceQty: variance,
        unitCost: tier.unitCost,
        financialVarianceIDR: financialVariance,
        notes: opnameNotes[tier.sku] || (variance === 0 ? 'Verified' : variance < 0 ? 'Shortage adjustment' : 'Surplus receipt'),
        status: variance === 0 ? 'matched' : variance < 0 ? 'shortage' : 'surplus',
      };
    });

    setIsReconciling(true);
    try {
      const res = await apiClient.reconcileStockOpname({
        storeId: opnameStoreId,
        storeName,
        warehouseZoneId: opnameZoneFilter !== 'ALL' ? opnameZoneFilter : relevantTiers[0]?.warehouseZoneId || 'WH-JKT-SEN-COLD',
        items: payloadItems,
        notes: usePartition
          ? `Partial Cycle Opname (${relevantTiers.length} of ${storeTiers.length} warehouse SKUs) for ${storeName}`
          : `Periodic physical stocktake cycle count for ${storeName}`,
      });

      if (res.success) {
        onShowToast('Stock Opname Reconciled', res.message);
        setOpnameSessions((prev) => [res.session, ...prev]);
        if (onRefreshData) onRefreshData();
      }
    } catch (err: any) {
      onShowToast('Stock Opname Error', err.message || 'Failed to reconcile stock opname');
    } finally {
      setIsReconciling(false);
    }
  };

  // Handle Inter-Store Stock Transfer
  const handleExecuteTransfer = async () => {
    if (transferSourceStore === transferDestStore) {
      onShowToast('Invalid Transfer', 'Source and destination outlet must be different.');
      return;
    }

    if (transferQty <= 0) {
      onShowToast('Invalid Quantity', 'Transfer quantity must be greater than 0.');
      return;
    }

    setIsTransferring(true);
    try {
      const hasReturnable = transferAssetType !== 'NONE' && transferAssetQty > 0;
      const res = await apiClient.transferStock({
        sku: transferSku,
        sourceStoreId: transferSourceStore,
        destinationStoreId: transferDestStore,
        quantity: transferQty,
        notes: transferNotes,
        ...(hasReturnable
          ? {
              returnableAsset: {
                assetType: transferAssetType,
                assetIds: transferAssetIds.trim() || undefined,
                quantity: transferAssetQty,
              },
            }
          : {}),
      });

      if (res.success) {
        onShowToast('Stock Transfer Completed', res.message);
        setTransferRecords((prev) => [res.record, ...prev]);
        setTransferAssetIds('');
        if (onRefreshData) onRefreshData();
      }
    } catch (err: any) {
      onShowToast('Transfer Error', err.message || 'Failed to execute stock transfer');
    } finally {
      setIsTransferring(false);
    }
  };

  const opnameStoreTiers = inventoryTiers.filter((t) => t.storeId === opnameStoreId);
  const opnameAvailableZones = Array.from(new Set(opnameStoreTiers.map((t) => t.warehouseZoneId).filter(Boolean)));

  // Filtered stock opname rows
  const filteredOpnameTiers = opnameStoreTiers
    .filter((t) => (opnameZoneFilter === 'ALL' ? true : t.warehouseZoneId === opnameZoneFilter))
    .filter((t) => (opnameCategoryFilter === 'ALL' ? true : t.category === opnameCategoryFilter))
    .filter((t) =>
      opnameSearch ? t.productName.toLowerCase().includes(opnameSearch.toLowerCase()) || t.sku.toLowerCase().includes(opnameSearch.toLowerCase()) : true
    );

  // Unique SKUs for transfer selection (avoids multi-store tier SKU duplicate key warning)
  const uniqueTransferSkuTiers = React.useMemo(() => {
    const seen = new Set<string>();
    return inventoryTiers.filter((t) => {
      if (seen.has(t.sku)) return false;
      seen.add(t.sku);
      return true;
    });
  }, [inventoryTiers]);

  // Calculate live opname variance stats (Dynamic Surplus / Deficit Breakdown)
  const opnameStats = React.useMemo(() => {
    let totalSys = 0;
    let totalCounted = 0;
    let netVarianceQty = 0;
    let netFinancialIDR = 0;
    let shortageCount = 0;
    let surplusCount = 0;
    let matchedCount = 0;
    let totalSurplusQty = 0;
    let totalSurplusIDR = 0;
    let totalDeficitQty = 0;
    let totalDeficitIDR = 0;

    filteredOpnameTiers.forEach((tier) => {
      const sys = tier.physicalStock;
      const counted = opnameItems[tier.sku] !== undefined ? opnameItems[tier.sku] : sys;
      const diff = counted - sys;
      const costDiff = Math.round(diff * tier.unitCost);
      totalSys += sys;
      totalCounted += counted;
      netVarianceQty += diff;
      netFinancialIDR += costDiff;

      if (diff === 0) {
        matchedCount++;
      } else if (diff < 0) {
        shortageCount++;
        totalDeficitQty += Math.abs(diff);
        totalDeficitIDR += Math.abs(costDiff);
      } else {
        surplusCount++;
        totalSurplusQty += diff;
        totalSurplusIDR += costDiff;
      }
    });

    return {
      totalSys,
      totalCounted,
      netVarianceQty,
      netFinancialIDR,
      shortageCount,
      surplusCount,
      matchedCount,
      totalSurplusQty,
      totalSurplusIDR,
      totalDeficitQty,
      totalDeficitIDR,
    };
  }, [filteredOpnameTiers, opnameItems]);

  // Card styling tokens
  const cardClass = `rounded-xl border transition-all ${
    isLight
      ? 'bg-white border-slate-200 shadow-xs hover:border-slate-300 text-slate-900'
      : 'bg-[#12141C] border-slate-800/80 shadow-xs hover:border-slate-700/80 text-slate-100'
  }`;

  const subCardClass = `rounded-xl border p-4 transition-all ${
    isLight
      ? 'bg-slate-50/80 border-slate-200 text-slate-900'
      : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
  }`;

  const inputClass = `w-full px-3.5 py-2 text-xs rounded-xl font-medium transition-all ${
    isLight
      ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600'
      : 'bg-[#090A0F] border-slate-800/80 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
  } focus:outline-hidden`;

  const labelClass = `block text-xs font-bold mb-1.5 ${isLight ? 'text-slate-800' : 'text-slate-100'} dark:text-slate-100`;

  return (
    <div className="space-y-6">
      {/* Module Header & Top Breadcrumb */}
      {standaloneMode === 'transfer' && (
        <div className={`${cardClass} p-5 sm:p-6`}>
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 min-w-0">
            <div className="flex items-start gap-3.5 min-w-0 flex-1">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 flex items-center justify-center shadow-xs shrink-0">
                <ArrowRightLeft className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                    Inter-Warehouse Operations
                  </span>
                  <span className="inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-800 dark:text-indigo-300 border border-indigo-500/25">
                    Double Sign-Off Audit Trail
                  </span>
                </div>
                <h1 className="text-lg sm:text-xl font-bold mt-1 text-slate-900 dark:text-slate-100 break-words">
                  Official Inter-Warehouse Stock Transfer &amp; Allocation
                </h1>
                <p className="text-xs mt-0.5 max-w-2xl text-slate-500 dark:text-slate-400 leading-relaxed break-words">
                  Safely relocate inventory stock between store outlets with double-sign-off audit trail. Strictly isolates quantities to eliminate multi-warehouse inventory overlap bleed.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0 max-w-full">
              <span className={`text-[11px] font-mono px-3 py-1.5 rounded-xl border inline-flex items-center gap-1.5 max-w-full break-words ${
                isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-[#090A0F] border-slate-800/80 text-slate-300'
              }`}>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Strict Warehouse Isolation Active</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {!standaloneMode && (
      <div className={`${cardClass} p-5 sm:p-6`}>
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 min-w-0">
          <div className="flex items-start gap-3.5 min-w-0 flex-1">
            <div className="p-3 rounded-xl bg-[#0F4C3A] text-white shadow-xs shrink-0">
              <Settings className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center whitespace-nowrap text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-[#0F4C3A] border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30 uppercase tracking-wider">
                  ERP Hub
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Enterprise System Architecture v4.2
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold mt-1 text-slate-900 dark:text-slate-100 break-words">
                Settings &amp; Configuration Hub
              </h1>
              <p className="text-xs mt-0.5 max-w-2xl text-slate-500 dark:text-slate-400 leading-relaxed break-words">
                Centralized enterprise administration: configure product valuation, multi-step warehouse routes, department cost centers, quotation rules, frontline POS controls, and dynamic COA mappings.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 max-w-full">
            <span className={`text-[11px] font-mono px-3 py-1.5 rounded-xl border inline-flex items-center gap-1.5 max-w-full break-words ${
              isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-[#090A0F] border-slate-800/80 text-slate-300'
            }`}>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Strict Warehouse Isolation Active</span>
            </span>
          </div>
        </div>

        {/* Primary Sub-Tab Navigation Bar */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-5 border-t border-slate-200 dark:border-slate-800/80">
          <button
            onClick={() => setActiveSubTab('enterprise')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'enterprise'
                ? 'bg-[#0F4C3A] text-white shadow-xs'
                : isLight
                ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/90'
            }`}
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Enterprise SaaS Config</span>
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] font-bold border whitespace-nowrap ${
                activeSubTab === 'enterprise'
                  ? 'bg-white/15 text-emerald-100 border-white/25'
                  : 'bg-emerald-500/15 text-[#0F4C3A] border-emerald-500/25 dark:text-emerald-300'
              }`}
            >
              Hub
            </span>
          </button>

          {canViewBranchMonitor && (
            <button
              onClick={() => {
                setActiveSubTab('branch_monitor');
                loadBranchMonitorData();
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeSubTab === 'branch_monitor'
                  ? 'bg-[#0F4C3A] text-white shadow-xs'
                  : isLight
                  ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/90'
              }`}
            >
              <MapPin className="w-4 h-4 text-emerald-500" />
              <span>Branches, Omzet &amp; Access</span>
            </button>
          )}

          <button
            onClick={() => setActiveSubTab('valuation')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'valuation'
                ? 'bg-[#0F4C3A] text-white shadow-xs'
                : isLight
                ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/90'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>Valuation &amp; Costing</span>
          </button>

          <button
            onClick={() => setActiveSubTab('warehouse')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'warehouse'
                ? 'bg-[#0F4C3A] text-white shadow-xs'
                : isLight
                ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/90'
            }`}
          >
            <Warehouse className="w-4 h-4" />
            <span>Warehouse Routing</span>
          </button>

          <button
            onClick={() => setActiveSubTab('matching')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'matching'
                ? 'bg-[#0F4C3A] text-white shadow-xs'
                : isLight
                ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/90'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <span>3-Way Matching AP</span>
          </button>

          <button
            onClick={() => setActiveSubTab('coa')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'coa'
                ? 'bg-[#0F4C3A] text-white shadow-xs'
                : isLight
                ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/90'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Chart of Accounts</span>
          </button>

          <button
            onClick={() => setActiveSubTab('pos')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'pos'
                ? 'bg-[#0F4C3A] text-white shadow-xs'
                : isLight
                ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/90'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>POS &amp; Checkout Rules</span>
          </button>

          <button
            onClick={() => setActiveSubTab('promotions')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'promotions'
                ? 'bg-[#0F4C3A] text-white shadow-xs'
                : isLight
                ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/90'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Promotions &amp; Loyalty</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold border whitespace-nowrap ${
                activeSubTab === 'promotions'
                  ? 'bg-white/15 text-amber-100 border-white/25'
                  : 'bg-amber-500/15 text-amber-800 border-amber-500/30 dark:text-amber-300'
              }`}
            >
              {promotions.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('approval_matrix')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'approval_matrix'
                ? 'bg-[#0F4C3A] text-white shadow-xs'
                : isLight
                ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/90'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Approval Matrix</span>
          </button>

          <button
            onClick={() => setActiveSubTab('communication_gateway')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'communication_gateway'
                ? 'bg-[#0F4C3A] text-white shadow-xs'
                : isLight
                ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/90'
            }`}
          >
            <Mail className="w-4 h-4 text-emerald-500" />
            <span>Email (SMTP) &amp; WhatsApp Gateway</span>
          </button>

          {canViewAuditAndKpis && (
            <button
              onClick={() => setActiveSubTab('audit_kpis')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeSubTab === 'audit_kpis'
                  ? 'bg-[#0F4C3A] text-white shadow-xs'
                  : isLight
                  ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/90'
              }`}
            >
              <History className="w-4 h-4 text-amber-500" />
              <span>Audit Trail &amp; Operator KPIs</span>
            </button>
          )}
        </div>
      </div>
      )}

      <div key={activeSubTab} className="gm-tab-enter">
      {/* ========================================================================= */}
      {/* 0. ENTERPRISE CONFIGURATION HUB (GRID-ALIGNED SECTIONS) */}
      {/* ========================================================================= */}
      {activeSubTab === 'enterprise' && (
        <div className="space-y-6 animate-fadeIn">
          {isReadOnlyPolicyRole && (
            <div className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs ${
              isLight ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-amber-950/30 border-amber-800/40 text-amber-200'
            }`}>
              <Lock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Read-Only Governance Mode (Admin):</strong> You can inspect Enterprise &amp; POS policy configurations, while system-wide policy updates require COO or Super Admin clearance.
              </span>
            </div>
          )}
          {/* Quick Filter Pill Bar */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider shrink-0 mr-1">
              Filter Sections:
            </span>
            {(
              [
                { id: 'ALL', label: 'All Enterprise Panels' },
                { id: 'VALUATION', label: 'Valuation & Costing' },
                { id: 'WAREHOUSE', label: 'Warehouse & Routes' },
                { id: 'ANALYTICS', label: 'Analytic Cost Centers' },
                { id: 'QUOTATIONS', label: 'Quotations & Policies' },
                { id: 'MATCHING', label: '3-Way Matching' },
                { id: 'TAX', label: 'Indonesian Tax & NPWP' },
                { id: 'ERP_CONFIG', label: 'ERP Rules & Period Lock' },
                { id: 'TRIAL_GOV', label: 'Trial & Demo Governance' },
              ] as const
            ).map((filter) => (
              <button
                key={filter.id}
                onClick={() => setEnterpriseQuickFilter(filter.id)}
                className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  enterpriseQuickFilter === filter.id
                    ? 'bg-[#0F4C3A] text-white shadow-xs'
                    : isLight
                    ? 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                    : 'bg-slate-900/90 border border-slate-800/80 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* SECTION 1: VALUATION & LANDED COST */}
            {(enterpriseQuickFilter === 'ALL' || enterpriseQuickFilter === 'VALUATION') && (
              <div className={`${cardClass} p-5 sm:p-6 space-y-4`}>
                <div className="flex items-center justify-between pb-3.5 border-b border-gray-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                      <Scale className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100">
                        Product Valuation &amp; Landed Costs
                      </h3>
                      <p className="text-[11px] text-gray-500 dark:text-slate-400">
                        Absorb freight, customs &amp; handling into stock assets
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      disabled={isReadOnlyPolicyRole}
                      checked={enterpriseSettings.landedCosts.enabled}
                      onChange={(e) =>
                        handleUpdateEnterpriseSettings({
                          landedCosts: { ...enterpriseSettings.landedCosts, enabled: e.target.checked },
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5.5 bg-gray-200 dark:bg-slate-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all after:shadow-xs peer-checked:bg-[#0F4C3A] dark:peer-checked:bg-emerald-600 peer-disabled:opacity-50"></div>
                  </label>
                </div>

                <div className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Default Allocation Method</label>
                      <select
                        disabled={isReadOnlyPolicyRole}
                        value={enterpriseSettings.landedCosts.defaultAllocationMethod}
                        onChange={(e) =>
                          handleUpdateEnterpriseSettings({
                            landedCosts: {
                              ...enterpriseSettings.landedCosts,
                              defaultAllocationMethod: e.target.value as any,
                            },
                          })
                        }
                        className={`${inputClass} disabled:opacity-60`}
                      >
                        <option value="BY_QUANTITY" className="bg-white dark:bg-[#090A0F] text-gray-900 dark:text-slate-100">By Quantity (Per piece)</option>
                        <option value="BY_VALUE" className="bg-white dark:bg-[#090A0F] text-gray-900 dark:text-slate-100">By Value (Invoice proportion)</option>
                        <option value="EQUAL" className="bg-white dark:bg-[#090A0F] text-gray-900 dark:text-slate-100">Equal Line Split</option>
                        <option value="BY_WEIGHT" className="bg-white dark:bg-[#090A0F] text-gray-900 dark:text-slate-100">By Weight (Kilograms)</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Accounting Journal</label>
                      <select
                        disabled={isReadOnlyPolicyRole}
                        value={enterpriseSettings.landedCosts.defaultJournal}
                        onChange={(e) =>
                          handleUpdateEnterpriseSettings({
                            landedCosts: {
                              ...enterpriseSettings.landedCosts,
                              defaultJournal: e.target.value,
                            },
                          })
                        }
                        className={`${inputClass} disabled:opacity-60`}
                      >
                        <option value="MISC_OPERATIONS" className="bg-white dark:bg-[#090A0F] text-gray-900 dark:text-slate-100">Operations &amp; Landed Costs</option>
                        <option value="GENERAL_JOURNAL" className="bg-white dark:bg-[#090A0F] text-gray-900 dark:text-slate-100">General Standard Journal</option>
                        <option value="PURCHASE_JOURNAL" className="bg-white dark:bg-[#090A0F] text-gray-900 dark:text-slate-100">Vendor Procurement Journal</option>
                      </select>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-gray-50/70 dark:bg-[#090A0F] border border-gray-200 dark:border-slate-800/80 text-xs space-y-2">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-gray-500 dark:text-slate-400">Inbound Freight Account:</span>
                      <span className="font-mono font-bold text-gray-900 dark:text-slate-100">
                        [{enterpriseSettings.landedCosts.freightExpenseAccountCode}] {enterpriseSettings.landedCosts.freightExpenseAccountName}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-gray-500 dark:text-slate-400">Clearing / Accrual Account:</span>
                      <span className="font-mono font-bold text-gray-900 dark:text-slate-100">
                        [{enterpriseSettings.landedCosts.clearingAccountCode}] {enterpriseSettings.landedCosts.clearingAccountName}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-gray-500 dark:text-slate-400">
                      {landedCosts.length} historical entries applied
                    </span>
                    <button
                      onClick={() => setActiveSubTab('valuation')}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      <span>Open Full Valuation Panel</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 2: WAREHOUSE MULTI-STEP LOGISTICS */}
            {(enterpriseQuickFilter === 'ALL' || enterpriseQuickFilter === 'WAREHOUSE') && (
              <div className={`${cardClass} p-5 sm:p-6 space-y-4`}>
                <div className="flex items-center justify-between pb-3.5 border-b border-gray-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400">
                      <Warehouse className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100">
                        Warehouse Advanced Routing &amp; Bins
                      </h3>
                      <p className="text-[11px] text-gray-500 dark:text-slate-400">
                        Multi-step staging, catch-weight pack, and shelf bins
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      disabled={isReadOnlyPolicyRole}
                      checked={enterpriseSettings.warehouseRouting.multiStepRoutingEnabled}
                      onChange={(e) =>
                        handleUpdateEnterpriseSettings({
                          warehouseRouting: {
                            ...enterpriseSettings.warehouseRouting,
                            multiStepRoutingEnabled: e.target.checked,
                          },
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5.5 bg-gray-200 dark:bg-slate-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all after:shadow-xs peer-checked:bg-[#0F4C3A] dark:peer-checked:bg-emerald-600 peer-disabled:opacity-50"></div>
                  </label>
                </div>

                <div className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Default Fulfillment Route</label>
                      <select
                        disabled={isReadOnlyPolicyRole}
                        value={enterpriseSettings.warehouseRouting.defaultRouteSteps}
                        onChange={(e) =>
                          handleUpdateEnterpriseSettings({
                            warehouseRouting: {
                              ...enterpriseSettings.warehouseRouting,
                              defaultRouteSteps: e.target.value as any,
                            },
                          })
                        }
                        className={`${inputClass} disabled:opacity-60`}
                      >
                        <option value="THREE_STEP" className="bg-white dark:bg-[#090A0F] text-gray-900 dark:text-slate-100">3-Step (Intake &rarr; QC &rarr; Chilled Putaway)</option>
                        <option value="TWO_STEP" className="bg-white dark:bg-[#090A0F] text-gray-900 dark:text-slate-100">2-Step (Pallet Scan &rarr; Shelf Putaway)</option>
                        <option value="DIRECT" className="bg-white dark:bg-[#090A0F] text-gray-900 dark:text-slate-100">1-Step Direct Dock-to-Shelf</option>
                      </select>
                    </div>
                    <div className="flex flex-col justify-end">
                      <div className="flex items-center justify-between p-2.5 rounded-xl border border-gray-200 dark:border-slate-800/80 bg-gray-50/50 dark:bg-[#090A0F]">
                        <span className="text-xs font-semibold text-gray-700 dark:text-slate-400">Auto Putaway Bins</span>
                        <input
                          type="checkbox"
                          disabled={isReadOnlyPolicyRole}
                          checked={enterpriseSettings.warehouseRouting.autoAssignPutawayBin}
                          onChange={(e) =>
                            handleUpdateEnterpriseSettings({
                              warehouseRouting: {
                                ...enterpriseSettings.warehouseRouting,
                                autoAssignPutawayBin: e.target.checked,
                              },
                            })
                          }
                          className="w-4 h-4 text-[#0F4C3A] rounded disabled:opacity-50"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    {enterpriseSettings.warehouseRouting.zones.map((z) => (
                      <div key={z.zoneId} className="p-2.5 rounded-xl bg-gray-50/70 dark:bg-[#090A0F] border border-gray-200 dark:border-slate-800/80">
                        <span className="text-[10px] text-gray-500 dark:text-slate-400 block font-mono">{z.routeType}</span>
                        <span className="font-bold text-xs text-gray-900 dark:text-slate-100 block mt-0.5 truncate">{z.zoneName.split(' ')[0]}</span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">{z.activeBinsCount} Bins Active</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-gray-500 dark:text-slate-400">
                      {warehouseBins.length} Storage Bins Mapped
                    </span>
                    <button
                      onClick={() => setActiveSubTab('warehouse')}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-700 dark:text-cyan-400 hover:underline cursor-pointer"
                    >
                      <span>Open Storage Bins &amp; Routes</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 3: COST CENTERS & ANALYTIC ACCOUNTING */}
            {(enterpriseQuickFilter === 'ALL' || enterpriseQuickFilter === 'ANALYTICS') && (
              <div className={`${cardClass} p-5 sm:p-6 space-y-4`}>
                <div className="flex items-center justify-between pb-3.5 border-b border-gray-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
                      <BarChart3 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100">
                        Cost Centers &amp; Analytic Accounting
                      </h3>
                      <p className="text-[11px] text-gray-500 dark:text-slate-400">
                        Departmental budget consumption and margin warning guards
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      disabled={isReadOnlyPolicyRole}
                      checked={enterpriseSettings.analyticAccounting.enabled}
                      onChange={(e) =>
                        handleUpdateEnterpriseSettings({
                          analyticAccounting: {
                            ...enterpriseSettings.analyticAccounting,
                            enabled: e.target.checked,
                          },
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5.5 bg-gray-200 dark:bg-slate-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all after:shadow-xs peer-checked:bg-[#0F4C3A] dark:peer-checked:bg-emerald-600 peer-disabled:opacity-50"></div>
                  </label>
                </div>

                <div className="space-y-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <label className={labelClass}>Default Department</label>
                      <select
                        disabled={isReadOnlyPolicyRole}
                        value={enterpriseSettings.analyticAccounting.defaultDepartment}
                        onChange={(e) =>
                          handleUpdateEnterpriseSettings({
                            analyticAccounting: {
                              ...enterpriseSettings.analyticAccounting,
                              defaultDepartment: e.target.value,
                            },
                          })
                        }
                        className={`${inputClass} disabled:opacity-60`}
                      >
                        {enterpriseSettings.analyticAccounting.departments.map((dept) => (
                          <option key={dept.id} value={dept.id} className="bg-white dark:bg-[#090A0F] text-gray-900 dark:text-slate-100">
                            {dept.code} - {dept.name} ({dept.manager})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-36">
                      <label className={labelClass}>Margin Warning (%)</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="5"
                          max="50"
                          disabled={isReadOnlyPolicyRole}
                          value={enterpriseSettings.analyticAccounting.marginWarningThresholdPercent}
                          onChange={(e) =>
                            handleUpdateEnterpriseSettings({
                              analyticAccounting: {
                                ...enterpriseSettings.analyticAccounting,
                                marginWarningThresholdPercent: Number(e.target.value) || 25,
                              },
                            })
                          }
                          className={`font-mono font-bold ${inputClass} disabled:opacity-60`}
                        />
                        <span className="text-xs font-bold text-gray-500 dark:text-slate-400">%</span>
                      </div>
                    </div>
                  </div>

                  {/* Department Budgets List */}
                  <div className="space-y-2 border border-gray-200 dark:border-slate-800/80 rounded-xl p-3 bg-gray-50/50 dark:bg-[#090A0F] text-xs">
                    {enterpriseSettings.analyticAccounting.departments.map((dept) => {
                      const utilPct = dept.annualBudgetIDR > 0 ? Math.round((dept.actualCostIDR / dept.annualBudgetIDR) * 100) : 0;
                      return (
                        <div key={dept.id} className="space-y-1 pb-1.5 border-b border-gray-100 dark:border-slate-800/80 last:border-b-0 last:pb-0">
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-gray-900 dark:text-slate-100">{dept.name}</span>
                            <span className="font-mono text-[11px] text-gray-500 dark:text-slate-400">
                              {formatIDR(dept.actualCostIDR)} / {formatIDR(dept.annualBudgetIDR)} ({utilPct}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                utilPct > 85 ? 'bg-rose-500' : 'bg-purple-600 dark:bg-purple-500'
                              }`}
                              style={{ width: `${Math.min(100, utilPct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {(onNavigateToAnalytic || onNavigateToMargin) && (
                    <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100 dark:border-slate-800/80">
                      {onNavigateToAnalytic && (
                        <button
                          type="button"
                          onClick={onNavigateToAnalytic}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700 dark:text-purple-400 hover:underline cursor-pointer"
                        >
                          <span>Manage Analytic Budgets</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onNavigateToMargin && (
                        <button
                          type="button"
                          onClick={onNavigateToMargin}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer ml-auto"
                        >
                          <span>Live Margin Analysis</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SECTION 4: QUOTATIONS & SALES POLICIES */}
            {(enterpriseQuickFilter === 'ALL' || enterpriseQuickFilter === 'QUOTATIONS') && (
              <div className={`${cardClass} p-5 sm:p-6 space-y-4`}>
                <div className="flex items-center justify-between pb-3.5 border-b border-gray-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100">
                        Quotations &amp; Sales Policies
                      </h3>
                      <p className="text-[11px] text-gray-500 dark:text-slate-400">
                        Mandatory perishable packaging and payment terms
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      disabled={isReadOnlyPolicyRole}
                      checked={enterpriseSettings.quotationsAndSales.mandatoryProductsEnabled}
                      onChange={(e) =>
                        handleUpdateEnterpriseSettings({
                          quotationsAndSales: {
                            ...enterpriseSettings.quotationsAndSales,
                            mandatoryProductsEnabled: e.target.checked,
                          },
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5.5 bg-gray-200 dark:bg-slate-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all after:shadow-xs peer-checked:bg-[#0F4C3A] dark:peer-checked:bg-emerald-600 peer-disabled:opacity-50"></div>
                  </label>
                </div>

                <div className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Payment Confirmation Threshold</label>
                      <select
                        disabled={isReadOnlyPolicyRole}
                        value={enterpriseSettings.quotationsAndSales.paymentConfirmationThreshold}
                        onChange={(e) =>
                          handleUpdateEnterpriseSettings({
                            quotationsAndSales: {
                              ...enterpriseSettings.quotationsAndSales,
                              paymentConfirmationThreshold: e.target.value as any,
                            },
                          })
                        }
                        className={`${inputClass} disabled:opacity-60`}
                      >
                        <option value="DEPOSIT_50" className="bg-white dark:bg-[#090A0F] text-gray-900 dark:text-slate-100">50% Deposit Required</option>
                        <option value="FULL_100" className="bg-white dark:bg-[#090A0F] text-gray-900 dark:text-slate-100">100% Full Payment Upfront</option>
                        <option value="PAY_ON_DELIVERY" className="bg-white dark:bg-[#090A0F] text-gray-900 dark:text-slate-100">Pay on Delivery (COD / Net 7)</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Quote Validity (Days)</label>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        disabled={isReadOnlyPolicyRole}
                        value={enterpriseSettings.quotationsAndSales.defaultValidityDays}
                        onChange={(e) =>
                          handleUpdateEnterpriseSettings({
                            quotationsAndSales: {
                              ...enterpriseSettings.quotationsAndSales,
                              defaultValidityDays: Number(e.target.value) || 14,
                            },
                          })
                        }
                        className={`font-mono font-bold ${inputClass} disabled:opacity-60`}
                      />
                    </div>
                  </div>

                  {/* Mandatory Packaging Rules */}
                  <div className="space-y-2 p-3.5 rounded-xl border border-gray-200 dark:border-slate-800/80 bg-gray-50/50 dark:bg-[#090A0F] text-xs">
                    <span className="font-semibold text-gray-900 dark:text-slate-100 block text-[11px]">
                      Mandatory HACCP Packaging Add-Ons:
                    </span>
                    {enterpriseSettings.quotationsAndSales.mandatoryRules.map((rule) => (
                      <div key={rule.id} className="flex justify-between items-start gap-2 pt-1 border-t border-gray-100 dark:border-slate-800/80">
                        <div>
                          <span className="font-bold text-gray-900 dark:text-slate-100">{rule.mandatoryProductName}</span>
                          <span className="text-[10px] text-gray-500 dark:text-slate-400 block">{rule.reason}</span>
                        </div>
                        <span className="font-mono font-bold text-amber-700 dark:text-amber-400 shrink-0">
                          +{formatIDR(rule.mandatoryPriceIDR)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-4 text-xs pt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={isReadOnlyPolicyRole}
                        checked={enterpriseSettings.quotationsAndSales.onlineSignaturesRequired}
                        onChange={(e) =>
                          handleUpdateEnterpriseSettings({
                            quotationsAndSales: {
                              ...enterpriseSettings.quotationsAndSales,
                              onlineSignaturesRequired: e.target.checked,
                            },
                          })
                        }
                        className="w-4 h-4 text-[#0F4C3A] rounded disabled:opacity-50"
                      />
                      <span className="text-gray-700 dark:text-slate-400">Digital Signatures</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={isReadOnlyPolicyRole}
                        checked={enterpriseSettings.quotationsAndSales.autoGeneratePdfQuote}
                        onChange={(e) =>
                          handleUpdateEnterpriseSettings({
                            quotationsAndSales: {
                              ...enterpriseSettings.quotationsAndSales,
                              autoGeneratePdfQuote: e.target.checked,
                            },
                          })
                        }
                        className="w-4 h-4 text-[#0F4C3A] rounded disabled:opacity-50"
                      />
                      <span className="text-gray-700 dark:text-slate-400">Auto PDF Generation</span>
                    </label>
                  </div>

                  {onNavigateToQuotations && (
                    <div className="flex items-center justify-end pt-2 border-t border-gray-100 dark:border-slate-800/80">
                      <button
                        type="button"
                        onClick={onNavigateToQuotations}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
                      >
                        <span>Open Quotations &amp; Pro Forma Engine</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SECTION 5: 3-WAY MATCHING CONTROLS */}
            {(enterpriseQuickFilter === 'ALL' || enterpriseQuickFilter === 'MATCHING') && (
              <div className={`${cardClass} p-5 sm:p-6 space-y-4 lg:col-span-2`}>
                <div className="flex items-center justify-between pb-3.5 border-b border-gray-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100">
                        Procurement 3-Way Matching AP Controls
                      </h3>
                      <p className="text-[11px] text-gray-500 dark:text-slate-400">
                        Cross-validation of Purchase Orders, Dock Goods Receipts, and Invoices
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center whitespace-nowrap px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 font-mono">
                    {enterpriseSettings.threeWayMatching.enforcementMode}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="space-y-1">
                    <span className="text-gray-500 dark:text-slate-400">Quantity Discrepancy Buffer:</span>
                    <div className="font-mono font-bold text-base text-gray-900 dark:text-slate-100">
                      &plusmn;{enterpriseSettings.threeWayMatching.quantityTolerancePercent}%
                    </div>
                    <span className="text-[10px] text-gray-500 dark:text-slate-400">Moisture transpiration &amp; scales</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-gray-500 dark:text-slate-400">Price Variance Discrepancy:</span>
                    <div className="font-mono font-bold text-base text-gray-900 dark:text-slate-100">
                      &plusmn;{enterpriseSettings.threeWayMatching.priceTolerancePercent}%
                    </div>
                    <span className="text-[10px] text-gray-500 dark:text-slate-400">Unit rate deviation limit</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-gray-500 dark:text-slate-400">Payment Freezes:</span>
                    <div className="font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 mt-0.5">
                      <Lock className="w-4 h-4" />
                      <span>{enterpriseSettings.threeWayMatching.blockPaymentOnMismatch ? 'Automatic Block Active' : 'Unblocked'}</span>
                    </div>
                    <span className="text-[10px] text-gray-500 dark:text-slate-400">Treasury wire lock on variance</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-slate-800/80">
                  <span className="text-xs text-gray-500 dark:text-slate-400">
                    {vendorBills.length} AP Bills evaluated
                  </span>
                  <button
                    onClick={() => setActiveSubTab('matching')}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    <span>Launch Live 3-Way Matching Simulator</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* SECTION 6: INDONESIAN TAXATION, PPN 11%/12% & NPWP/NIK VALIDATOR */}
            {(enterpriseQuickFilter === 'ALL' || enterpriseQuickFilter === 'TAX') && (
              <div className="lg:col-span-2">
                <IndonesianTaxRulesPanel theme={theme} canEdit={isSuperAdmin} onShowToast={onShowToast} />
              </div>
            )}

            {/* SECTION 7: RETAIL & WHOLESALE ERP PARAMETERS (TAX, TREASURY, COLD-CHAIN, LOYALTY & PERIOD LOCK) */}
            {(enterpriseQuickFilter === 'ALL' || enterpriseQuickFilter === 'ERP_CONFIG') && (
              <div className={`${cardClass} p-5 sm:p-6 space-y-5 lg:col-span-2`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-gray-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
                      <Sliders className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100">
                        Retail &amp; Wholesale ERP Policy Parameters
                      </h3>
                      <p className="text-[11px] text-gray-500 dark:text-slate-400">
                        Dynamic Coretax rates, POS Safe Drop &amp; MDR fees, Ojol markups, Halal/shrinkage tolerances, Loyalty ratios &amp; Accounting Period Lock
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isReadOnlyPolicyRole || isSavingErpConfig}
                    onClick={handleSaveErpConfig}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSavingErpConfig ? 'Saving Parameters...' : 'Save ERP Parameters'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Group 1: Indonesian Tax & Coretax */}
                  <div className={`${subCardClass} space-y-3`}>
                    <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                      1. Indonesian Tax &amp; Coretax
                    </div>
                    <div className="grid grid-cols-3 gap-2.5">
                      <div>
                        <label className={labelClass}>Active PPN (%)</label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="25"
                          disabled={isReadOnlyPolicyRole}
                          value={erpConfigDraft.activeVatRatePct}
                          onChange={(e) => setErpConfigDraft((p) => ({ ...p, activeVatRatePct: Number(e.target.value) || 0 }))}
                          className={`${inputClass} border font-mono`}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>PPh 22 (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="15"
                          disabled={isReadOnlyPolicyRole}
                          value={erpConfigDraft.pph22RatePct}
                          onChange={(e) => setErpConfigDraft((p) => ({ ...p, pph22RatePct: Number(e.target.value) || 0 }))}
                          className={`${inputClass} border font-mono`}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>PPh 23 (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="15"
                          disabled={isReadOnlyPolicyRole}
                          value={erpConfigDraft.pph23RatePct}
                          onChange={(e) => setErpConfigDraft((p) => ({ ...p, pph23RatePct: Number(e.target.value) || 0 }))}
                          className={`${inputClass} border font-mono`}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className={labelClass}>Company NPWP (16-Digit)</label>
                        <input
                          type="text"
                          disabled={isReadOnlyPolicyRole}
                          value={erpConfigDraft.companyNpwp}
                          onChange={(e) => setErpConfigDraft((p) => ({ ...p, companyNpwp: e.target.value }))}
                          className={`${inputClass} border font-mono`}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>e-Faktur Signer</label>
                        <input
                          type="text"
                          disabled={isReadOnlyPolicyRole}
                          value={erpConfigDraft.efakturSignerName}
                          onChange={(e) => setErpConfigDraft((p) => ({ ...p, efakturSignerName: e.target.value }))}
                          className={`${inputClass} border`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Group 2: POS Treasury, MDR & Quick-Commerce */}
                  <div className={`${subCardClass} space-y-3`}>
                    <div className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                      2. POS Treasury, MDR &amp; Quick-Commerce
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className={labelClass}>Safe Drop Threshold (IDR)</label>
                        <input
                          type="number"
                          step="100000"
                          min="100000"
                          disabled={isReadOnlyPolicyRole}
                          value={erpConfigDraft.safeDropThresholdIDR}
                          onChange={(e) => setErpConfigDraft((p) => ({ ...p, safeDropThresholdIDR: Math.max(0, Number(e.target.value) || 0) }))}
                          className={`${inputClass} border font-mono`}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Paid-Out Max No PIN (IDR)</label>
                        <input
                          type="number"
                          step="25000"
                          min="0"
                          disabled={isReadOnlyPolicyRole}
                          value={erpConfigDraft.pettyCashMaxWithoutPinIDR}
                          onChange={(e) => setErpConfigDraft((p) => ({ ...p, pettyCashMaxWithoutPinIDR: Math.max(0, Number(e.target.value) || 0) }))}
                          className={`${inputClass} border font-mono`}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className={labelClass}>QRIS MDR (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="10"
                          disabled={isReadOnlyPolicyRole}
                          value={erpConfigDraft.qrisMdrPct}
                          onChange={(e) => setErpConfigDraft((p) => ({ ...p, qrisMdrPct: Math.max(0, Number(e.target.value) || 0) }))}
                          className={`${inputClass} border font-mono`}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>EDC Card MDR (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="10"
                          disabled={isReadOnlyPolicyRole}
                          value={erpConfigDraft.edcCardMdrPct}
                          onChange={(e) => setErpConfigDraft((p) => ({ ...p, edcCardMdrPct: Math.max(0, Number(e.target.value) || 0) }))}
                          className={`${inputClass} border font-mono`}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2.5">
                      <div>
                        <label className={labelClass}>Dynamic Margin Floor Min (%) Above WAC</label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="50"
                          disabled={isReadOnlyPolicyRole}
                          value={erpConfigDraft.minMarginFloorPct ?? 2.0}
                          onChange={(e) =>
                            setErpConfigDraft((p) => ({
                              ...p,
                              minMarginFloorPct: Math.max(0, Math.min(50, Number(e.target.value) || 0)),
                            }))
                          }
                          className={`${inputClass} border font-mono`}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      <div>
                        <label className={labelClass}>GrabMart Mkp/Comm %</label>
                        <div className="flex gap-1">
                          <input
                            type="number"
                            step="1"
                            min="0"
                            max="50"
                            disabled={isReadOnlyPolicyRole}
                            value={erpConfigDraft.ojolChannelRates.grabMart.markupPct}
                            onChange={(e) =>
                              setErpConfigDraft((p) => ({
                                ...p,
                                ojolChannelRates: {
                                  ...p.ojolChannelRates,
                                  grabMart: { ...p.ojolChannelRates.grabMart, markupPct: Number(e.target.value) || 0 },
                                },
                              }))
                            }
                            className={`${inputClass} border font-mono px-2`}
                            title="GrabMart Markup %"
                          />
                          <input
                            type="number"
                            step="1"
                            min="0"
                            max="50"
                            disabled={isReadOnlyPolicyRole}
                            value={erpConfigDraft.ojolChannelRates.grabMart.commissionPct}
                            onChange={(e) =>
                              setErpConfigDraft((p) => ({
                                ...p,
                                ojolChannelRates: {
                                  ...p.ojolChannelRates,
                                  grabMart: { ...p.ojolChannelRates.grabMart, commissionPct: Number(e.target.value) || 0 },
                                },
                              }))
                            }
                            className={`${inputClass} border font-mono px-2`}
                            title="GrabMart Commission %"
                          />
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>GoMart Mkp/Comm %</label>
                        <div className="flex gap-1">
                          <input
                            type="number"
                            step="1"
                            min="0"
                            max="50"
                            disabled={isReadOnlyPolicyRole}
                            value={erpConfigDraft.ojolChannelRates.goMart.markupPct}
                            onChange={(e) =>
                              setErpConfigDraft((p) => ({
                                ...p,
                                ojolChannelRates: {
                                  ...p.ojolChannelRates,
                                  goMart: { ...p.ojolChannelRates.goMart, markupPct: Number(e.target.value) || 0 },
                                },
                              }))
                            }
                            className={`${inputClass} border font-mono px-2`}
                            title="GoMart Markup %"
                          />
                          <input
                            type="number"
                            step="1"
                            min="0"
                            max="50"
                            disabled={isReadOnlyPolicyRole}
                            value={erpConfigDraft.ojolChannelRates.goMart.commissionPct}
                            onChange={(e) =>
                              setErpConfigDraft((p) => ({
                                ...p,
                                ojolChannelRates: {
                                  ...p.ojolChannelRates,
                                  goMart: { ...p.ojolChannelRates.goMart, commissionPct: Number(e.target.value) || 0 },
                                },
                              }))
                            }
                            className={`${inputClass} border font-mono px-2`}
                            title="GoMart Commission %"
                          />
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>ShopeeFood Mkp/Comm %</label>
                        <div className="flex gap-1">
                          <input
                            type="number"
                            step="1"
                            min="0"
                            max="50"
                            disabled={isReadOnlyPolicyRole}
                            value={erpConfigDraft.ojolChannelRates.shopeeFood.markupPct}
                            onChange={(e) =>
                              setErpConfigDraft((p) => ({
                                ...p,
                                ojolChannelRates: {
                                  ...p.ojolChannelRates,
                                  shopeeFood: { ...p.ojolChannelRates.shopeeFood, markupPct: Number(e.target.value) || 0 },
                                },
                              }))
                            }
                            className={`${inputClass} border font-mono px-2`}
                            title="ShopeeFood Markup %"
                          />
                          <input
                            type="number"
                            step="1"
                            min="0"
                            max="50"
                            disabled={isReadOnlyPolicyRole}
                            value={erpConfigDraft.ojolChannelRates.shopeeFood.commissionPct}
                            onChange={(e) =>
                              setErpConfigDraft((p) => ({
                                ...p,
                                ojolChannelRates: {
                                  ...p.ojolChannelRates,
                                  shopeeFood: { ...p.ojolChannelRates.shopeeFood, commissionPct: Number(e.target.value) || 0 },
                                },
                              }))
                            }
                            className={`${inputClass} border font-mono px-2`}
                            title="ShopeeFood Commission %"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Group 3: Warehouse, Cold-Chain & Halal Compliance */}
                  <div className={`${subCardClass} space-y-3`}>
                    <div className="text-xs font-bold text-cyan-700 dark:text-cyan-400 uppercase tracking-wider">
                      3. Warehouse, Cold-Chain &amp; Halal Compliance
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className={labelClass}>Susut Timbang Cap (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="15"
                          disabled={isReadOnlyPolicyRole}
                          value={erpConfigDraft.naturalMoistureShrinkageTolerancePct}
                          onChange={(e) =>
                            setErpConfigDraft((p) => ({
                              ...p,
                              naturalMoistureShrinkageTolerancePct: Math.max(0.1, Number(e.target.value) || 2.5),
                            }))
                          }
                          className={`${inputClass} border font-mono`}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>BPJPH Alert (Days)</label>
                        <input
                          type="number"
                          step="1"
                          min="1"
                          max="365"
                          disabled={isReadOnlyPolicyRole}
                          value={erpConfigDraft.halalCertExpiryWarningDays}
                          onChange={(e) =>
                            setErpConfigDraft((p) => ({
                              ...p,
                              halalCertExpiryWarningDays: Math.max(1, Number(e.target.value) || 30),
                            }))
                          }
                          className={`${inputClass} border font-mono`}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>3-Way Tolerance (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="10"
                          disabled={isReadOnlyPolicyRole}
                          value={erpConfigDraft.threeWayMatchTolerancePct}
                          onChange={(e) =>
                            setErpConfigDraft((p) => ({
                              ...p,
                              threeWayMatchTolerancePct: Math.max(0, Number(e.target.value) || 0),
                            }))
                          }
                          className={`${inputClass} border font-mono`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Group 4: CRM Loyalty & Accounting Period Lock */}
                  <div className={`${subCardClass} space-y-3`}>
                    <div className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
                      4. CRM Loyalty &amp; Accounting Period Lock
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className={labelClass}>Spend / 1 Pt (IDR)</label>
                        <input
                          type="number"
                          step="1000"
                          min="1000"
                          disabled={isReadOnlyPolicyRole}
                          value={erpConfigDraft.loyaltySpendPerPointIDR}
                          onChange={(e) =>
                            setErpConfigDraft((p) => ({
                              ...p,
                              loyaltySpendPerPointIDR: Math.max(100, Number(e.target.value) || 10000),
                            }))
                          }
                          className={`${inputClass} border font-mono`}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Redeem / Pt (IDR)</label>
                        <input
                          type="number"
                          step="10"
                          min="1"
                          disabled={isReadOnlyPolicyRole}
                          value={erpConfigDraft.loyaltyPointRedeemValueIDR}
                          onChange={(e) =>
                            setErpConfigDraft((p) => ({
                              ...p,
                              loyaltyPointRedeemValueIDR: Math.max(1, Number(e.target.value) || 100),
                            }))
                          }
                          className={`${inputClass} border font-mono`}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Period Lock Before</label>
                        <input
                          type="date"
                          disabled={isReadOnlyPolicyRole}
                          value={erpConfigDraft.accountingLockBeforeDate || ''}
                          onChange={(e) =>
                            setErpConfigDraft((p) => ({
                              ...p,
                              accountingLockBeforeDate: e.target.value,
                            }))
                          }
                          className={`${inputClass} border font-mono`}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className={labelClass}>GOLD Tier Threshold (IDR)</label>
                        <input
                          type="number"
                          step="500000"
                          min="0"
                          disabled={isReadOnlyPolicyRole}
                          value={erpConfigDraft.goldTierThresholdIDR}
                          onChange={(e) =>
                            setErpConfigDraft((p) => ({
                              ...p,
                              goldTierThresholdIDR: Math.max(0, Number(e.target.value) || 0),
                            }))
                          }
                          className={`${inputClass} border font-mono`}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>PLATINUM Tier Threshold (IDR)</label>
                        <input
                          type="number"
                          step="1000000"
                          min="0"
                          disabled={isReadOnlyPolicyRole}
                          value={erpConfigDraft.platinumTierThresholdIDR}
                          onChange={(e) =>
                            setErpConfigDraft((p) => ({
                              ...p,
                              platinumTierThresholdIDR: Math.max(0, Number(e.target.value) || 0),
                            }))
                          }
                          className={`${inputClass} border font-mono`}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Max Allowed Outlets (Quota)</label>
                        <input
                          type="number"
                          step="1"
                          min="1"
                          max="500"
                          disabled={!isSuperAdmin}
                          title={!isSuperAdmin ? 'Hanya Super Admin yang dapat mengubah kuota outlet' : 'Batas maksimal outlet aktif'}
                          value={erpConfigDraft.maxAllowedOutlets ?? 10}
                          onChange={(e) =>
                            setErpConfigDraft((p) => ({
                              ...p,
                              maxAllowedOutlets: Math.max(1, Math.min(500, Math.round(Number(e.target.value) || 1))),
                            }))
                          }
                          className={`${inputClass} border font-mono`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Off-Site Backup, Restore & Store Mode Initialization (Super Admin) */}
            {(enterpriseQuickFilter === 'ALL' || enterpriseQuickFilter === 'ERP_CONFIG') && (
              <div className={`${cardClass} p-5`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800/80">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:text-slate-200">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        System Snapshot Backup, Restore &amp; Store Lifecycle
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Export full ERP state snapshots (.JSON), restore validated backups, or initialize a clean production store.
                      </p>
                    </div>
                  </div>
                  {!isSuperAdmin && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      <Lock className="w-3.5 h-3.5" /> Super Admin Only
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {/* Off-Site Backup & Restore Card */}
                  <div className={`${subCardClass} space-y-3`}>
                    <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                      Off-Site Snapshot Backup &amp; Restore
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Download a timestamped snapshot of all ledgers, batches, COA, and ERP settings, or restore a previously exported `.json` backup with schema validation.
                    </p>
                    <input
                      ref={restoreFileInputRef}
                      type="file"
                      accept=".json,application/json"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file) return;
                        setIsRestoringSnapshot(true);
                        setSnapshotDiagnosticReport(null);
                        try {
                          const rawText = await file.text();
                          const { parsed, report } = analyzeSnapshotRestorePayload(
                            rawText,
                            file.name,
                            activeStaffSession?.userName
                          );
                          if (!parsed || report.errorCount > 0) {
                            setSnapshotDiagnosticReport(report);
                            apiClient.recordImportExportDiagnostic(report).catch(() => {});
                            setDiagnosticRefreshKey((k) => k + 1);
                            throw new Error(report.issues[0]?.rootCause || 'Selected file failed snapshot schema validation.');
                          }
                          const res = await apiClient.restoreSystemSnapshot(parsed);
                          if (report.warningCount > 0) {
                            setSnapshotDiagnosticReport(report);
                            apiClient.recordImportExportDiagnostic(report).catch(() => {});
                            setDiagnosticRefreshKey((k) => k + 1);
                          }
                          onShowToast('Snapshot Restored', res.message);
                          onRefreshData?.();
                        } catch (err: any) {
                          const diag = buildDiagnosticFromError({
                            operation: 'IMPORT',
                            source: file.name,
                            error: err,
                            actorName: activeStaffSession?.userName,
                          });
                          setSnapshotDiagnosticReport((prev) => prev || diag);
                          if (!err?.diagnosticReport) {
                            apiClient.recordImportExportDiagnostic(diag).catch(() => {});
                          }
                          setDiagnosticRefreshKey((k) => k + 1);
                          onShowToast('Restore Failed', err?.message || 'Failed to validate or restore snapshot.');
                        } finally {
                          setIsRestoringSnapshot(false);
                        }
                      }}
                    />
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        disabled={!isSuperAdmin || isDownloadingBackup}
                        onClick={async () => {
                          setIsDownloadingBackup(true);
                          setSnapshotDiagnosticReport(null);
                          try {
                            const { blob, filename } = await apiClient.downloadSystemBackup();
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = filename;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                            onShowToast('Backup Downloaded', `Saved ${filename} cleanly.`);
                          } catch (err: any) {
                            const diag = buildDiagnosticFromError({
                              operation: 'EXPORT',
                              source: 'system_backup.json',
                              error: err,
                              actorName: activeStaffSession?.userName,
                            });
                            setSnapshotDiagnosticReport(diag);
                            if (!err?.diagnosticReport) {
                              apiClient.recordImportExportDiagnostic(diag).catch(() => {});
                            }
                            setDiagnosticRefreshKey((k) => k + 1);
                            onShowToast('Backup Failed', err?.message || 'Failed to download backup snapshot.');
                          } finally {
                            setIsDownloadingBackup(false);
                          }
                        }}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#0F4C3A] hover:bg-[#0b3a2c] text-white disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer transition-all"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{isDownloadingBackup ? 'Exporting...' : 'Download Backup (.JSON)'}</span>
                      </button>

                      <button
                        type="button"
                        disabled={!isSuperAdmin || isRestoringSnapshot}
                        onClick={() => restoreFileInputRef.current?.click()}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer transition-all"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{isRestoringSnapshot ? 'Validating & Restoring...' : 'Restore Snapshot (.JSON)'}</span>
                      </button>
                    </div>
                    {snapshotDiagnosticReport && (snapshotDiagnosticReport.errorCount > 0 || snapshotDiagnosticReport.warningCount > 0) && (
                      <div className="mt-2 p-3 rounded-xl border border-rose-200 dark:border-rose-800/60 bg-rose-50/70 dark:bg-rose-950/25 space-y-1.5 text-[11px]">
                        <div className="flex items-center justify-between gap-2 font-bold text-rose-700 dark:text-rose-300">
                          <span>
                            Diagnostic Report ({snapshotDiagnosticReport.errorCount} error / {snapshotDiagnosticReport.warningCount} warning)
                          </span>
                          <button
                            type="button"
                            onClick={() => setSnapshotDiagnosticReport(null)}
                            className="text-[10px] underline cursor-pointer"
                          >
                            Dismiss
                          </button>
                        </div>
                        {snapshotDiagnosticReport.issues.slice(0, 4).map((iss, idx) => (
                          <div key={idx} className="space-y-0.5 text-slate-700 dark:text-slate-200">
                            <div>
                              <span className="font-mono font-bold text-rose-700 dark:text-rose-300">[{iss.errorType}]</span>{' '}
                              <span className="font-semibold">{iss.reference}:</span> {iss.rootCause}
                            </div>
                            <div className="text-emerald-800 dark:text-emerald-300">
                              Fix: {iss.remediationHint}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Store Lifecycle: Initialize Clean Production Store & Reset Demo Data */}
                  <div className={`${subCardClass} space-y-3`}>
                    <div className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                      Store Lifecycle Initialization
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Start a live store with zeroed balances (preserving Indonesian COA, Coretax/PPN settings &amp; RBAC roles) or restore the fresh demo seed baseline.
                    </p>
                    {confirmSystemAction ? (
                      <div className="p-2.5 rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50/70 dark:bg-amber-950/30 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-amber-900 dark:text-amber-200 inline-flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          {confirmSystemAction === 'init_production'
                            ? 'Confirm wiping demo transactions & zeroing COA balances for live production?'
                            : 'Confirm resetting all records back to the demo seed baseline?'}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setConfirmSystemAction(null)}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={isInitializingProduction || isResettingDemo}
                            onClick={async () => {
                              const action = confirmSystemAction;
                              setConfirmSystemAction(null);
                              if (action === 'init_production') {
                                setIsInitializingProduction(true);
                                try {
                                  const res = await apiClient.initProductionStore();
                                  setDiagnosticRefreshKey((k) => k + 1);
                                  apiClient.getTrialGovernance().then((g) => g?.governance && onTrialGovernanceUpdated?.(g.governance)).catch(() => {});
                                  onShowToast('Clean Production Store Ready', res.message);
                                  onRefreshData?.();
                                } catch (err: any) {
                                  onShowToast('Initialization Failed', err?.message || 'Failed to initialize production store.');
                                } finally {
                                  setIsInitializingProduction(false);
                                }
                              } else {
                                setIsResettingDemo(true);
                                try {
                                  const res = await apiClient.resetDemoData();
                                  setDiagnosticRefreshKey((k) => k + 1);
                                  apiClient.getTrialGovernance().then((g) => g?.governance && onTrialGovernanceUpdated?.(g.governance)).catch(() => {});
                                  onShowToast('Demo Data Restored', res.message);
                                  onRefreshData?.();
                                } catch (err: any) {
                                  onShowToast('Reset Failed', err?.message || 'Failed to reset demo data.');
                                } finally {
                                  setIsResettingDemo(false);
                                }
                              }
                            }}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 cursor-pointer"
                          >
                            Confirm
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          disabled={!isSuperAdmin || isInitializingProduction}
                          onClick={() => setConfirmSystemAction('init_production')}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer transition-all"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>{isInitializingProduction ? 'Initializing...' : 'Initialize Clean Production Store'}</span>
                        </button>

                        <button
                          type="button"
                          disabled={!isSuperAdmin || isResettingDemo}
                          onClick={() => setConfirmSystemAction('reset_demo')}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer transition-all"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isResettingDemo ? 'animate-spin' : ''}`} />
                          <span>{isResettingDemo ? 'Resetting...' : 'Reset Demo Data'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 8 (ADDITIVE): TRIAL / DEMO GOVERNANCE, GRANULAR SUB-ROLE RESTRICTIONS & IMPORT/EXPORT DIAGNOSTICS */}
            {(enterpriseQuickFilter === 'ALL' || enterpriseQuickFilter === 'TRIAL_GOV') && (
              <TrialGovernancePanel
                isLight={isLight}
                isSuperAdmin={isSuperAdmin}
                cardClass={cardClass}
                subCardClass={subCardClass}
                inputClass={inputClass}
                labelClass={labelClass}
                onShowToast={onShowToast}
                onGovernanceUpdated={onTrialGovernanceUpdated}
                externalDiagnosticRefreshKey={diagnosticRefreshKey}
              />
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 0B. MULTI-BRANCH MONITOR (CABANG, OMZET & BARANG DATANG) + OPERATOR ASSIGNMENTS */}
      {/* ========================================================================= */}
      {activeSubTab === 'branch_monitor' && canViewBranchMonitor && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header & Refresh Bar */}
          <div className={`${cardClass} p-5 sm:p-6`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800/80">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#0F4C3A] text-white">
                    Network Control Tower
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {branchMonitorData?.totals.openBranches ?? storeOutlets.length} / {branchMonitorData?.totals.totalBranches ?? storeOutlets.length} Hubs Open
                  </span>
                </div>
                <h2 className={`text-base sm:text-lg font-bold mt-1 ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                  Cabang, Omzet &amp; Barang Datang (Multi-Branch Monitor)
                </h2>
                <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Real-time branch revenue (POS + B2C + B2B), inventory asset valuation, incoming goods dock arrivals, and RBAC operator branch assignments.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-emerald-500/10 text-[#0F4C3A] dark:text-emerald-300 border border-emerald-500/25 whitespace-nowrap">
                  Aktif: {branchMonitorData?.quota?.activeOutlets ?? storeOutlets.filter((s) => s.isActive !== false).length} / {branchMonitorData?.quota?.maxAllowedOutlets ?? erpConfigDraft.maxAllowedOutlets ?? 10} Kuota Outlet
                </span>
                {isSuperAdmin && (
                  <button
                    type="button"
                    disabled={
                      (branchMonitorData?.quota?.activeOutlets ?? storeOutlets.filter((s) => s.isActive !== false).length) >=
                      (branchMonitorData?.quota?.maxAllowedOutlets ?? erpConfigDraft.maxAllowedOutlets ?? 10)
                    }
                    onClick={openCreateOutletModal}
                    title={
                      (branchMonitorData?.quota?.activeOutlets ?? storeOutlets.filter((s) => s.isActive !== false).length) >=
                      (branchMonitorData?.quota?.maxAllowedOutlets ?? erpConfigDraft.maxAllowedOutlets ?? 10)
                        ? 'Kuota outlet penuh — naikkan Max Allowed Outlets di Enterprise SaaS Config'
                        : 'Tambah cabang / outlet baru'
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#0F4C3A] hover:bg-[#0b382b] text-white transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Tambah Outlet</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={loadBranchMonitorData}
                  disabled={isLoadingMonitor}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    isLight
                      ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      : 'bg-slate-900/90 border-slate-800/80 text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMonitor ? 'animate-spin' : ''}`} />
                  <span>Refresh Monitor</span>
                </button>
              </div>
            </div>

            {/* 4 Network KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-4">
              <div className={subCardClass}>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
                  Active Store &amp; Warehouse Hubs
                </span>
                <span className="text-lg font-bold font-mono tabular-nums mt-1 block">
                  {branchMonitorData?.totals.openBranches ?? 0} / {branchMonitorData?.totals.totalBranches ?? 6} Open
                </span>
              </div>
              <div className={subCardClass}>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
                  Live Network Omzet (POS + B2C + B2B)
                </span>
                <span className="text-lg font-bold font-mono tabular-nums text-[#0F4C3A] dark:text-emerald-400 mt-1 block">
                  {formatIDR(branchMonitorData?.totals.totalLiveOmzetIDR ?? 0)}
                </span>
              </div>
              <div className={subCardClass}>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
                  Consolidated Stock Valuation
                </span>
                <span className="text-lg font-bold font-mono tabular-nums mt-1 block">
                  {formatIDR(branchMonitorData?.totals.totalStockValuationIDR ?? 0)}
                </span>
              </div>
              <div className={subCardClass}>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
                  Pending Barang Datang (PO + Transit)
                </span>
                <span className="text-lg font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1 block">
                  {(branchMonitorData?.totals.openPoCount ?? 0)} POs · {(branchMonitorData?.totals.inTransitCount ?? 0)} Transit
                </span>
              </div>
            </div>
          </div>

          {/* 1. Branch Directory & Live Omzet Table */}
          <div className={`${cardClass} p-5 sm:p-6 space-y-4`}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h3 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                  <Building2 className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
                  <span>Network Branches &amp; Live Omzet</span>
                </h3>
                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Live revenue breakdown per outlet across retail POS, online B2C express, and wholesale B2B channels
                </p>
              </div>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                {branchMonitorData?.totals.totalOrders ?? 0} total settled orders
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800/80">
              <table className="w-full text-left text-xs min-w-[760px]">
                <thead>
                  <tr className={`border-b text-[10px] font-bold uppercase tracking-wider ${
                    isLight ? 'bg-slate-50 text-slate-500 border-slate-200' : 'bg-[#090A0F] text-slate-400 border-slate-800/80'
                  }`}>
                    <th className="py-3 px-3.5">Branch Code &amp; Name</th>
                    <th className="py-3 px-3">Hub Type</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-center">Orders</th>
                    <th className="py-3 px-3 text-right">Live Omzet (IDR)</th>
                    <th className="py-3 px-3 text-right">Stock Valuation</th>
                    <th className="py-3 px-3 text-center">Incoming</th>
                    {isSuperAdmin && <th className="py-3 px-3 text-right">Profil</th>}
                  </tr>
                </thead>
                <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-slate-800/80'}`}>
                  {(branchMonitorData?.branches || []).map((branch) => (
                    <tr key={branch.storeId} className={isLight ? 'hover:bg-slate-50/80' : 'hover:bg-slate-900/60'}>
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300">
                            {branch.branchCode}
                          </span>
                          <span className="font-bold">{branch.storeName}</span>
                        </div>
                        <div className={`text-[11px] mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                          {branch.district}, {branch.city}
                          {branch.targetDailyOmzetIDR ? ` · Target ${formatIDR(branch.targetDailyOmzetIDR)}/hari` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 whitespace-nowrap">
                          {branch.hubType}
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            branch.status === 'Open'
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
                              : branch.status === 'Holiday Mode'
                              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25'
                              : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25'
                          }`}
                        >
                          {branch.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold tabular-nums">
                        {branch.orderCount}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums">
                        <div className="font-bold text-[#0F4C3A] dark:text-emerald-400">
                          {formatIDR(branch.liveOmzetIDR)}
                        </div>
                        <div className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                          POS {formatIDR(branch.posOmzetIDR)} · B2C {formatIDR(branch.b2cOmzetIDR)} · B2B {formatIDR(branch.b2bOmzetIDR)}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums">
                        <div className="font-bold">{formatIDR(branch.stockValuationIDR)}</div>
                        <div className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                          {branch.totalStockUnits.toLocaleString('id-ID')} units
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-[11px]">
                        <span className="text-amber-600 dark:text-amber-400 font-bold">{branch.incomingPoCount} PO</span>
                        <span className="mx-1 text-slate-400">·</span>
                        <span className="text-sky-600 dark:text-sky-400 font-bold">{branch.inTransitTransferCount} Trf</span>
                      </td>
                      {isSuperAdmin && (
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openEditOutletModal(branch)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                              isLight
                                ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                                : 'bg-[#090A0F] border-slate-700 text-slate-200 hover:bg-slate-800'
                            }`}
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit Profil Outlet</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {(!branchMonitorData || branchMonitorData.branches.length === 0) && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-slate-400">
                        {isLoadingMonitor ? 'Loading multi-branch metrics...' : 'No branch telemetry available.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. Incoming Goods & In-Transit Deliveries (Barang Datang) */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Open Purchase Orders */}
            <div className={`${cardClass} p-5 space-y-4`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                    <PackageCheck className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
                    <span>Incoming Vendor Purchase Orders (Barang Datang)</span>
                  </h3>
                  <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Open or partial PO shipments awaiting dock receipt &amp; COA #1040 capitalization
                  </p>
                </div>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300">
                  {branchMonitorData?.openPurchaseOrders.length ?? 0} Open
                </span>
              </div>

              <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                {(branchMonitorData?.openPurchaseOrders || []).map((po) => (
                  <div key={po.poId} className={`${subCardClass} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-xs text-[#0F4C3A] dark:text-emerald-400">{po.poId}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300">
                          {po.status}
                        </span>
                        <span className="text-[11px] font-semibold">{po.destinationBranchName}</span>
                      </div>
                      <div className="text-xs font-semibold truncate">{po.supplierName}</div>
                      <div className={`text-[11px] line-clamp-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        {po.itemsSummary}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                        Backorder: <strong>{po.remainingBackorderQty}</strong> / {po.expectedUnitsQty} units · Value: <strong>{formatIDR(po.incomingValueIDR)}</strong>
                      </div>
                    </div>

                    {canConfirmArrivals ? (
                      <button
                        type="button"
                        disabled={confirmingArrivalId === `PO:${po.poId}`}
                        onClick={() => handleConfirmArrival('PO', po.poId)}
                        className="px-3 py-1.5 rounded-xl bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-bold transition-all disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {confirmingArrivalId === `PO:${po.poId}` ? 'Receiving...' : 'Confirm Arrival'}
                      </button>
                    ) : (
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-slate-200/70 dark:bg-slate-900/90 text-slate-600 dark:text-slate-300 whitespace-nowrap shrink-0">
                        Read-Only
                      </span>
                    )}
                  </div>
                ))}
                {(branchMonitorData?.openPurchaseOrders.length ?? 0) === 0 && (
                  <p className="text-xs text-slate-400 py-6 text-center italic">
                    All vendor purchase orders have been received at dock.
                  </p>
                )}
              </div>
            </div>

            {/* In-Transit Inter-Warehouse Transfers */}
            <div className={`${cardClass} p-5 space-y-4`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                    <Truck className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                    <span>In-Transit Inter-Branch Transfers</span>
                  </h3>
                  <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Dispatched cold-chain sprinter shipments awaiting destination receiving confirmation
                  </p>
                </div>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-300">
                  {branchMonitorData?.inTransitTransfers.length ?? 0} In Transit
                </span>
              </div>

              <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                {(branchMonitorData?.inTransitTransfers || []).map((tr) => (
                  <div key={tr.transferId} className={`${subCardClass} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-xs text-sky-700 dark:text-sky-400">{tr.transferId}</span>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-900/90">
                          {tr.waybillNumber}
                        </span>
                      </div>
                      <div className="text-xs font-bold truncate">
                        {tr.quantity}x {tr.productName} ({tr.sku})
                      </div>
                      <div className={`text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                        {tr.originBranchName} <ArrowRight className="w-3 h-3 inline mx-1" /> <strong>{tr.destinationBranchName}</strong>
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                        Transfer Value: <strong>{formatIDR(tr.totalTransferValueIDR)}</strong>
                      </div>
                    </div>

                    {canConfirmArrivals ? (
                      <button
                        type="button"
                        disabled={confirmingArrivalId === `TRANSFER:${tr.transferId}`}
                        onClick={() => handleConfirmArrival('TRANSFER', tr.transferId)}
                        className="px-3 py-1.5 rounded-xl bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-bold transition-all disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {confirmingArrivalId === `TRANSFER:${tr.transferId}` ? 'Stocking...' : 'Confirm Arrival'}
                      </button>
                    ) : (
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-slate-200/70 dark:bg-slate-900/90 text-slate-600 dark:text-slate-300 whitespace-nowrap shrink-0">
                        Read-Only
                      </span>
                    )}
                  </div>
                ))}
                {(branchMonitorData?.inTransitTransfers.length ?? 0) === 0 && (
                  <p className="text-xs text-slate-400 py-6 text-center italic">
                    No active inter-branch transfers currently in transit.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 3. Operator Role & Branch Assignment Configuration */}
          <div className={`${cardClass} p-5 sm:p-6 space-y-4`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800/80">
              <div>
                <h3 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                  <Users className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
                  <span>Operator Role &amp; Branch Assignment Configuration</span>
                </h3>
                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Only Super Admin can configure an operator&apos;s Enterprise Role, Assigned Outlet / Hub, Active Status, and Login PIN. All active sessions remain strictly locked until Lock / Sign Out.
                </p>
              </div>
              {!isSuperAdmin ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25 whitespace-nowrap">
                  <Lock className="w-3.5 h-3.5" />
                  Super Admin Only
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-emerald-500/10 text-[#0F4C3A] dark:text-emerald-300 border border-emerald-500/25 whitespace-nowrap">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Super Admin Governance Active
                </span>
              )}
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800/80">
              <table className="w-full text-left text-xs min-w-[960px]">
                <thead>
                  <tr className={`border-b text-[10px] font-bold uppercase tracking-wider ${
                    isLight ? 'bg-slate-50 text-slate-500 border-slate-200' : 'bg-[#090A0F] text-slate-400 border-slate-800/80'
                  }`}>
                    <th className="py-3 px-3.5">Operator Profile</th>
                    <th className="py-3 px-3">Assigned Role</th>
                    <th className="py-3 px-3">Scope Mode</th>
                    <th className="py-3 px-3">Assigned Branch / Hub</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Login PIN</th>
                    <th className="py-3 px-3 text-right">Last Updated</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-slate-800/80'}`}>
                  {operatorAssignments.map((op) => {
                    const scoped = op.isBranchScoped || isBranchScopedRole(op.userRole);
                    const allowedOptions = scoped
                      ? branchAssignmentOptions.filter((b) => b.storeId !== 'ALL')
                      : branchAssignmentOptions;
                    const isSelf = op.userId === activeStaffSession?.userId;
                    const isActiveOp = op.isActive !== false;
                    const pinDraft = operatorPinDrafts[op.userId] ?? op.loginPin ?? '';
                    const isSavingOp = savingAssignmentUserId === op.userId;

                    return (
                      <tr key={op.userId} className={isLight ? 'hover:bg-slate-50/80' : 'hover:bg-slate-900/60'}>
                        <td className="py-3 px-3.5">
                          <div className="font-bold">{op.userName}</div>
                          <div className="font-mono text-[10px] text-slate-400">{op.userId}</div>
                        </td>
                        <td className="py-3 px-3 min-w-[165px]">
                          {isSuperAdmin ? (
                            <select
                              disabled={isSelf || isSavingOp}
                              value={normalizeEnterpriseRole(op.userRole)}
                              onChange={(e) =>
                                handleUpdateOperatorAssignment(op.userId, {
                                  userRole: e.target.value as UserRole,
                                })
                              }
                              className={`w-full px-2.5 py-1.5 text-xs rounded-xl font-semibold border ${
                                isSelf ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'
                              } ${inputClass}`}
                              title={isSelf ? 'Cannot demote your own active Super Admin account' : 'Assign Enterprise Role'}
                            >
                              <option value="cashier">Cashier</option>
                              <option value="warehouse">Warehouse Ops</option>
                              <option value="purchasing">Purchasing</option>
                              <option value="store_manager">Store Manager</option>
                              <option value="admin">Back-Office Admin</option>
                              <option value="coo">COO</option>
                              <option value="super_admin">Super Admin</option>
                            </select>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-emerald-500/10 text-[#0F4C3A] dark:text-emerald-300 border border-emerald-500/20 whitespace-nowrap">
                              {getRoleDisplayLabel(op.userRole)}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {scoped ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25">
                              <Lock className="w-3 h-3" />
                              Locked to Branch
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/25">
                              Multi-Branch Network
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 min-w-[220px]">
                          <select
                            disabled={!isSuperAdmin || isSavingOp}
                            value={op.storeId}
                            onChange={(e) =>
                              handleUpdateOperatorAssignment(op.userId, { storeId: e.target.value })
                            }
                            className={`w-full px-3 py-1.5 text-xs rounded-xl font-semibold border ${
                              !isSuperAdmin ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'
                            } ${inputClass}`}
                          >
                            {allowedOptions.map((opt) => (
                              <option key={opt.storeId} value={opt.storeId}>
                                {opt.storeName} ({opt.hubType})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <button
                            type="button"
                            disabled={!isSuperAdmin || isSelf || isSavingOp}
                            onClick={() =>
                              handleUpdateOperatorAssignment(op.userId, { isActive: !isActiveOp })
                            }
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
                              isActiveOp
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
                                : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25'
                            } ${!isSuperAdmin || isSelf ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:opacity-90'}`}
                            title={
                              !isSuperAdmin
                                ? 'Super Admin Only'
                                : isSelf
                                ? 'Cannot deactivate your own active session'
                                : isActiveOp
                                ? 'Click to suspend operator login'
                                : 'Click to reactivate operator login'
                            }
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isActiveOp ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            {isActiveOp ? 'Active' : 'Suspended'}
                          </button>
                        </td>
                        <td className="py-3 px-3 min-w-[165px]">
                          {isSuperAdmin ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={pinDraft}
                                disabled={isSavingOp}
                                onChange={(e) =>
                                  setOperatorPinDrafts((prev) => ({ ...prev, [op.userId]: e.target.value }))
                                }
                                placeholder="PIN (min 4)"
                                maxLength={32}
                                className={`w-24 px-2.5 py-1 text-xs font-mono rounded-lg border ${inputClass}`}
                              />
                              <button
                                type="button"
                                disabled={
                                  isSavingOp ||
                                  !pinDraft.trim() ||
                                  pinDraft.trim().length < 4 ||
                                  pinDraft.trim() === (op.loginPin || '8821')
                                }
                                onClick={() =>
                                  handleUpdateOperatorAssignment(op.userId, { loginPin: pinDraft.trim() })
                                }
                                className="px-2 py-1 rounded-lg text-[10px] font-bold bg-[#0F4C3A] text-white hover:bg-[#0b382b] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                              >
                                Save
                              </button>
                            </div>
                          ) : (
                            <span className="font-mono text-[11px] text-slate-400 inline-flex items-center gap-1">
                              <Lock className="w-3 h-3" />
                              {op.hasCustomPin ? 'Custom PIN' : 'Standard'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-[10px] text-slate-500 dark:text-slate-400">
                          {op.updatedAt ? (
                            <>
                              <div>{new Date(op.updatedAt).toLocaleString()}</div>
                              <div>by {op.updatedBy || 'System'}</div>
                            </>
                          ) : (
                            <span>Default Roster</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4. Manajemen User, Email/Password & Hak Akses Per Modul (14-Division RBAC) */}
          <div className={`${cardClass} p-5 sm:p-6 space-y-4`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800/80">
              <div className="min-w-0 flex-1">
                <h3 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                  <KeyRound className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400 shrink-0" />
                  <span>Manajemen User, Email/Password &amp; Hak Akses Per Modul</span>
                </h3>
                <p className={`text-xs mt-0.5 break-words ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Kelola akun 14 divisi operasional (Email, Password, Cabang, Status Aktif) serta atur matriks hak akses granular (View, Create, Edit, Approve, Export) pada seluruh 13 modul ERP.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <span className="font-mono text-[11px] font-bold px-2.5 py-1 rounded-xl bg-emerald-500/10 text-[#0F4C3A] dark:text-emerald-300 border border-emerald-500/20">
                  {systemUsersList.length} Akun Terdaftar
                </span>
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={openCreateSystemUserModal}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Akun User</span>
                  </button>
                )}
              </div>
            </div>

            {/* Search & Division Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
              <div className="relative flex-1 min-w-0">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="Cari nama, email, ID, atau divisi..."
                  className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border ${inputClass}`}
                />
              </div>
              <select
                value={userDivisionFilter}
                onChange={(e) => setUserDivisionFilter(e.target.value)}
                className={`sm:w-64 px-3 py-2 text-xs rounded-xl border cursor-pointer ${inputClass}`}
              >
                <option value="ALL">Semua Divisi (14 Role)</option>
                {DIVISION_ROLE_CODES.map((code) => (
                  <option key={code} value={code}>
                    {DIVISION_ROLE_PRESETS[code].divisionLabel} ({code})
                  </option>
                ))}
              </select>
            </div>

            {/* System Users Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800/80">
              <table className="w-full text-left text-xs min-w-[1020px]">
                <thead>
                  <tr
                    className={`border-b text-[10px] font-bold uppercase tracking-wider ${
                      isLight ? 'bg-slate-50 text-slate-500 border-slate-200' : 'bg-[#090A0F] text-slate-400 border-slate-800/80'
                    }`}
                  >
                    <th className="py-3 px-3.5">Nama &amp; ID</th>
                    <th className="py-3 px-3">Divisi / Role</th>
                    <th className="py-3 px-3">Email &amp; Password</th>
                    <th className="py-3 px-3">Cabang / Hub</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Modul Aktif</th>
                    <th className="py-3 px-3.5 text-right">Aksi Pengaturan</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-slate-800/80'}`}>
                  {systemUsersList
                    .filter((u) => {
                      if (userDivisionFilter !== 'ALL' && u.roleCode !== userDivisionFilter) return false;
                      const q = userSearchQuery.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        u.fullName.toLowerCase().includes(q) ||
                        u.email.toLowerCase().includes(q) ||
                        u.id.toLowerCase().includes(q) ||
                        u.divisionLabel.toLowerCase().includes(q) ||
                        u.roleCode.toLowerCase().includes(q)
                      );
                    })
                    .map((u) => {
                      const activeModulesCount = MODULE_PERMISSION_META.filter(
                        (m) => u.modulePermissions?.[m.key]?.view
                      ).length;
                      const approveModulesCount = MODULE_PERMISSION_META.filter(
                        (m) => u.modulePermissions?.[m.key]?.approve
                      ).length;

                      return (
                        <tr key={u.id} className={isLight ? 'hover:bg-slate-50/80' : 'hover:bg-slate-900/60'}>
                          <td className="py-3 px-3.5">
                            <div className="font-bold text-slate-900 dark:text-slate-100">{u.fullName}</div>
                            <div className="font-mono text-[10px] text-slate-400 flex items-center gap-1.5">
                              <span>{u.id}</span>
                              {u.supervisorPin && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25">
                                  PIN: {u.supervisorPin}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider ${
                                u.roleCode === 'SUPER_ADMIN'
                                  ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25'
                                  : u.roleCode.includes('WAREHOUSE') || u.roleCode === 'QC_INSPECTOR'
                                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25'
                                  : u.roleCode.includes('PURCHASING')
                                  ? 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/25'
                                  : u.roleCode.includes('POS') || u.roleCode === 'STORE_MANAGER'
                                  ? 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/25'
                                  : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/25'
                              }`}
                            >
                              {u.divisionLabel}
                            </span>
                            <div className="font-mono text-[10px] text-slate-400 mt-0.5">{u.roleCode}</div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">{u.email}</div>
                            <div className="font-mono text-[10px] text-slate-400">
                              Pass: {u.maskedPassword || '••••••••'}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-medium text-xs text-slate-700 dark:text-slate-300">
                              {u.branchName || u.branchId}
                            </div>
                            <div className="font-mono text-[10px] text-slate-400">
                              {u.viewCost === false ? 'Cost Tersembunyi' : 'Cost Visible'}
                            </div>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                u.isActive
                                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
                                  : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                              {u.isActive ? 'Active' : 'Suspended'}
                            </span>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <div className="font-mono text-xs font-bold text-[#0F4C3A] dark:text-emerald-400">
                              {activeModulesCount} / {MODULE_PERMISSION_META.length} Modul
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Approve: {approveModulesCount} modul
                            </div>
                          </td>
                          <td className="py-3 px-3.5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={!isSuperAdmin}
                                onClick={() => openEditSystemUserModal(u)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${
                                  isSuperAdmin
                                    ? isLight
                                      ? 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700 cursor-pointer'
                                      : 'bg-[#090A0F] hover:bg-slate-800 border-slate-700 text-slate-200 cursor-pointer'
                                    : 'opacity-50 cursor-not-allowed border-slate-200 dark:border-slate-800 text-slate-400'
                                }`}
                                title={isSuperAdmin ? 'Ubah Email, Password, Role & Status' : 'Super Admin Only'}
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Edit Akun &amp; Password</span>
                              </button>
                              <button
                                type="button"
                                disabled={!isSuperAdmin}
                                onClick={() => openPermissionMatrixModal(u)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                                  isSuperAdmin
                                    ? 'bg-[#0F4C3A] hover:bg-[#0b382b] text-white cursor-pointer shadow-2xs'
                                    : 'opacity-50 cursor-not-allowed bg-slate-200 dark:bg-slate-800 text-slate-400'
                                }`}
                                title={isSuperAdmin ? 'Atur Checkbox View/Create/Edit/Approve/Export per Modul' : 'Super Admin Only'}
                              >
                                <Sliders className="w-3 h-3" />
                                <span>Atur Hak Akses Modul</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal 1: Edit Akun & Password / Tambah Akun User */}
          {isUserModalOpen &&
            createPortal(
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
                <div
                  className={`w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden ${
                    isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#12141C] border-slate-800 text-slate-100'
                  }`}
                >
                  <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#0F4C3A]/10 text-[#0F4C3A] dark:text-emerald-400 flex items-center justify-center">
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold">
                          {editingSystemUser ? 'Edit Akun, Email & Password' : 'Tambah Akun User Divisi Baru'}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {editingSystemUser ? `${editingSystemUser.id} • ${editingSystemUser.divisionLabel}` : 'Otomatis mengisi matriks hak akses sesuai preset divisi'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsUserModalOpen(false)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveSystemUser} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="sm:col-span-2">
                        <label className={labelClass}>Nama Lengkap</label>
                        <input
                          type="text"
                          required
                          value={userFormFullName}
                          onChange={(e) => setUserFormFullName(e.target.value)}
                          placeholder="e.g. Budi Santoso (Staf Gudang)"
                          className={`w-full ${inputClass}`}
                        />
                      </div>

                      <div>
                        <label className={labelClass}>Email Login (Unik)</label>
                        <input
                          type="email"
                          required
                          value={userFormEmail}
                          onChange={(e) => setUserFormEmail(e.target.value)}
                          placeholder="nama@grocematrix.id"
                          className={`w-full font-mono ${inputClass}`}
                        />
                      </div>

                      <div>
                        <label className={labelClass}>
                          {editingSystemUser ? 'Password Baru (Kosongkan jika tetap)' : 'Password (Min 6 karakter)'}
                        </label>
                        <div className="relative">
                          <input
                            type={showUserFormPassword ? 'text' : 'password'}
                            required={!editingSystemUser}
                            minLength={editingSystemUser && !userFormPassword ? undefined : 6}
                            value={userFormPassword}
                            onChange={(e) => setUserFormPassword(e.target.value)}
                            placeholder={editingSystemUser ? 'Isi untuk reset password' : 'Min. 6 karakter'}
                            className={`w-full pr-9 font-mono ${inputClass}`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowUserFormPassword((v) => !v)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                          >
                            {showUserFormPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className={labelClass}>Preset Role Divisi (14 Divisi)</label>
                        <select
                          value={userFormRoleCode}
                          onChange={(e) => {
                            const nextRole = e.target.value as DivisionRoleCode;
                            const preset = DIVISION_ROLE_PRESETS[nextRole];
                            setUserFormRoleCode(nextRole);
                            setUserFormViewCost(preset.defaultViewCost);
                            if (preset.defaultSupervisorPin && !userFormSupervisorPin) {
                              setUserFormSupervisorPin(preset.defaultSupervisorPin);
                            }
                            setUserFormApplyPresetOnSave(true);
                          }}
                          className={`w-full cursor-pointer ${inputClass}`}
                        >
                          {DIVISION_ROLE_CODES.map((code) => (
                            <option key={code} value={code}>
                              {DIVISION_ROLE_PRESETS[code].divisionLabel} ({code})
                            </option>
                          ))}
                        </select>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                          {DIVISION_ROLE_PRESETS[userFormRoleCode]?.description}
                        </p>
                      </div>

                      <div>
                        <label className={labelClass}>Assigned Branch / Outlet</label>
                        <select
                          value={userFormBranchId}
                          onChange={(e) => setUserFormBranchId(e.target.value)}
                          className={`w-full cursor-pointer ${inputClass}`}
                        >
                          <option value="ALL">All Outlets (Consolidated)</option>
                          {storeOutlets.map((st) => (
                            <option key={st.storeId} value={st.storeId}>
                              {st.storeName} ({st.city})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className={labelClass}>Supervisor PIN (Opsional)</label>
                        <input
                          type="text"
                          value={userFormSupervisorPin}
                          onChange={(e) => setUserFormSupervisorPin(e.target.value)}
                          placeholder="e.g. 1234 (Store Manager)"
                          maxLength={12}
                          className={`w-full font-mono ${inputClass}`}
                        />
                      </div>

                      <div className="flex flex-col justify-center gap-2 pt-2">
                        <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={userFormIsActive}
                            onChange={(e) => setUserFormIsActive(e.target.checked)}
                            className="w-4 h-4 rounded text-[#0F4C3A]"
                          />
                          <span>Akun Aktif (Diizinkan Login)</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={userFormViewCost}
                            onChange={(e) => setUserFormViewCost(e.target.checked)}
                            className="w-4 h-4 rounded text-[#0F4C3A]"
                          />
                          <span>Boleh Melihat HPP / Cost &amp; Valuasi</span>
                        </label>
                      </div>
                    </div>

                    {editingSystemUser && (
                      <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 pt-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={userFormApplyPresetOnSave}
                          onChange={(e) => setUserFormApplyPresetOnSave(e.target.checked)}
                          className="w-4 h-4 rounded text-[#0F4C3A]"
                        />
                        <span>Auto-fill ulang seluruh checkbox hak akses modul sesuai preset divisi yang dipilih</span>
                      </label>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setIsUserModalOpen(false)}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold border cursor-pointer ${
                          isLight
                            ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                            : 'bg-[#090A0F] border-slate-700 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingSystemUser}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#0F4C3A] hover:bg-[#0b382b] text-white shadow-xs disabled:opacity-50 cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{isSavingSystemUser ? 'Menyimpan...' : 'Simpan Perubahan Akun'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>,
              document.body
            )}

          {/* Modal 2: Granular 13-Module Permission Matrix */}
          {permModalUser &&
            permDraft &&
            createPortal(
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
                <div
                  className={`w-full max-w-4xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[88vh] ${
                    isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#12141C] border-slate-800 text-slate-100'
                  }`}
                >
                  <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-[#0F4C3A]/10 text-[#0F4C3A] dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold truncate">
                          Matriks Hak Akses Per Modul — {permModalUser.fullName}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                          {permModalUser.email} • {permModalUser.divisionLabel} ({permModalUser.roleCode})
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPermDraft(getDefaultModulePermissions(permModalUser.roleCode))}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border cursor-pointer ${
                          isLight
                            ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                            : 'bg-[#090A0F] hover:bg-slate-800 border-slate-700 text-slate-300'
                        }`}
                      >
                        Reset ke Preset Divisi
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPermModalUser(null);
                          setPermDraft(null);
                        }}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="p-5 overflow-y-auto flex-1">
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800/80">
                      <table className="w-full text-left text-xs min-w-[680px]">
                        <thead>
                          <tr
                            className={`border-b text-[10px] font-bold uppercase tracking-wider ${
                              isLight ? 'bg-slate-50 text-slate-500 border-slate-200' : 'bg-[#090A0F] text-slate-400 border-slate-800/80'
                            }`}
                          >
                            <th className="py-3 px-3.5">Modul ERP ({MODULE_PERMISSION_META.length} Modul)</th>
                            <th className="py-3 px-3 text-center">View</th>
                            <th className="py-3 px-3 text-center">Create</th>
                            <th className="py-3 px-3 text-center">Edit</th>
                            <th className="py-3 px-3 text-center">Approve</th>
                            <th className="py-3 px-3 text-center">Export</th>
                          </tr>
                        </thead>
                        <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-slate-800/80'}`}>
                          {MODULE_PERMISSION_META.map((mod) => {
                            const p = permDraft[mod.key] || {
                              view: false,
                              create: false,
                              edit: false,
                              approve: false,
                              export: false,
                            };
                            return (
                              <React.Fragment key={mod.key}>
                                <tr className={isLight ? 'hover:bg-slate-50/80' : 'hover:bg-slate-900/60'}>
                                  <td className="py-2.5 px-3.5">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-900 dark:text-slate-100">{mod.label}</span>
                                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                                        {mod.category}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400">{mod.description}</div>
                                  </td>
                                  {(['view', 'create', 'edit', 'approve', 'export'] as ModulePermissionAction[]).map((act) => (
                                    <td key={act} className="py-2.5 px-3 text-center">
                                      <input
                                        type="checkbox"
                                        checked={p[act] === true}
                                        onChange={() => handleToggleModulePermissionCell(mod.key, act)}
                                        className="w-4 h-4 rounded text-[#0F4C3A] focus:ring-[#0F4C3A] cursor-pointer"
                                        aria-label={`${mod.label} ${act}`}
                                      />
                                    </td>
                                  ))}
                                </tr>
                                {mod.key === 'accounting' && (
                                  <tr className={isLight ? 'bg-emerald-50/40' : 'bg-emerald-950/15'}>
                                    <td colSpan={6} className="py-2 px-4">
                                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px]">
                                        <span className="font-bold text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                                          Granular Finance Sub-Flags:
                                        </span>
                                        {ACCOUNTING_SUB_FLAGS.map((sf) => (
                                          <label
                                            key={sf.key}
                                            title={sf.description}
                                            className="inline-flex items-center gap-1.5 cursor-pointer select-none text-slate-700 dark:text-slate-300"
                                          >
                                            <input
                                              type="checkbox"
                                              checked={p[sf.key] === true}
                                              onChange={() => handleToggleAccountingSubFlag(sf.key)}
                                              className="w-3.5 h-3.5 rounded text-[#0F4C3A] focus:ring-[#0F4C3A] cursor-pointer"
                                            />
                                            <span className="font-semibold">{sf.label}</span>
                                          </label>
                                        ))}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Perubahan langsung berlaku pada middleware RBAC &amp; dicatat di Immutable Audit Trail.
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPermModalUser(null);
                          setPermDraft(null);
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold border cursor-pointer ${
                          isLight
                            ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                            : 'bg-[#090A0F] border-slate-700 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        disabled={isSavingPermMatrix}
                        onClick={handleSavePermissionMatrix}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#0F4C3A] hover:bg-[#0b382b] text-white shadow-xs disabled:opacity-50 cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{isSavingPermMatrix ? 'Menyimpan...' : 'Simpan Hak Akses Modul'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>,
              document.body
            )}

          {/* Modal 3: Create / Edit Outlet Profile (Super Admin) */}
          {isOutletModalOpen &&
            createPortal(
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
                <div
                  className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
                    isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#12141C] border-slate-800 text-slate-100'
                  }`}
                >
                  <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
                        <span>
                          {editingOutletProfile
                            ? `Edit Profil Outlet — ${editingOutletProfile.storeName}`
                            : 'Tambah Cabang / Outlet Baru'}
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Kelola identitas cabang, alamat struk POS, tipe hub, target omzet harian, serta status aktif operasional.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsOutletModalOpen(false)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveOutletProfile} className="p-5 space-y-4 overflow-y-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className={labelClass}>Kode Cabang *</label>
                        <input
                          type="text"
                          required
                          placeholder="JKT-KMG-01"
                          value={outletFormBranchCode}
                          onChange={(e) => setOutletFormBranchCode(e.target.value.toUpperCase())}
                          className={`${inputClass} border font-mono uppercase`}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className={labelClass}>Nama Outlet *</label>
                        <input
                          type="text"
                          required
                          placeholder="GroceMart Kemang Raya"
                          value={outletFormName}
                          onChange={(e) => setOutletFormName(e.target.value)}
                          className={`${inputClass} border`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className={labelClass}>Tipe Outlet</label>
                        <select
                          value={outletFormType}
                          onChange={(e) => setOutletFormType(e.target.value as OutletType)}
                          className={`${inputClass} border`}
                        >
                          <option value="FLAGSHIP_STORE">Flagship Store</option>
                          <option value="DARK_STORE">Dark Store</option>
                          <option value="CENTRAL_HUB">Central Hub / CDC</option>
                          <option value="EXPRESS_MART">Express Mart</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Kota *</label>
                        <input
                          type="text"
                          required
                          value={outletFormCity}
                          onChange={(e) => setOutletFormCity(e.target.value)}
                          className={`${inputClass} border`}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Kecamatan / Area</label>
                        <input
                          type="text"
                          value={outletFormDistrict}
                          onChange={(e) => setOutletFormDistrict(e.target.value)}
                          className={`${inputClass} border`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>Nomor Telepon Outlet</label>
                        <input
                          type="text"
                          value={outletFormPhone}
                          onChange={(e) => setOutletFormPhone(e.target.value)}
                          className={`${inputClass} border font-mono`}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Target Omzet Harian (IDR)</label>
                        <input
                          type="number"
                          min="0"
                          step="500000"
                          value={outletFormTargetOmzetIDR}
                          onChange={(e) => setOutletFormTargetOmzetIDR(Math.max(0, Number(e.target.value) || 0))}
                          className={`${inputClass} border font-mono`}
                        />
                      </div>
                    </div>

                    <div>
                      <label className={labelClass}>Alamat Lengkap (Struk POS &amp; Surat Jalan)</label>
                      <input
                        type="text"
                        required
                        placeholder="Jl. Kemang Raya No. 45, Jakarta Selatan"
                        value={outletFormAddress}
                        onChange={(e) => setOutletFormAddress(e.target.value)}
                        className={`${inputClass} border`}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Catatan Header / Footer Struk POS</label>
                      <input
                        type="text"
                        value={outletFormReceiptNote}
                        onChange={(e) => setOutletFormReceiptNote(e.target.value)}
                        className={`${inputClass} border`}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className={labelClass}>Jam Buka</label>
                        <input
                          type="text"
                          value={outletFormOpenTime}
                          onChange={(e) => setOutletFormOpenTime(e.target.value)}
                          className={`${inputClass} border font-mono`}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Jam Tutup</label>
                        <input
                          type="text"
                          value={outletFormCloseTime}
                          onChange={(e) => setOutletFormCloseTime(e.target.value)}
                          className={`${inputClass} border font-mono`}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Zona Waktu</label>
                        <select
                          value={outletFormTimezone}
                          onChange={(e) => setOutletFormTimezone(e.target.value as 'WIB' | 'WITA' | 'WIT')}
                          className={`${inputClass} border`}
                        >
                          <option value="WIB">WIB</option>
                          <option value="WITA">WITA</option>
                          <option value="WIT">WIT</option>
                        </select>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-xs font-semibold pt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={outletFormIsActive}
                        onChange={(e) => setOutletFormIsActive(e.target.checked)}
                        className="w-4 h-4 rounded text-[#0F4C3A]"
                      />
                      <span>Outlet Aktif Beroperasi (Diblokir otomatis jika masih ada Shift POS OPEN)</span>
                    </label>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setIsOutletModalOpen(false)}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold border cursor-pointer ${
                          isLight
                            ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                            : 'bg-[#090A0F] border-slate-700 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingOutletProfile}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#0F4C3A] hover:bg-[#0b382b] text-white shadow-xs disabled:opacity-50 cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{isSavingOutletProfile ? 'Menyimpan...' : 'Simpan Profil Outlet'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>,
              document.body
            )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 0B. DEDICATED VALUATION & COSTING TAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'valuation' && (
        <ValuationCostingSettingsTab
          theme={theme}
          settings={enterpriseSettings}
          landedCosts={landedCosts}
          inventoryTiers={inventoryTiers}
          chartOfAccounts={chartOfAccounts}
          purchaseOrders={purchaseOrders}
          isReadOnly={isReadOnlyPolicyRole}
          onUpdateSettings={handleUpdateEnterpriseSettings}
          onRefreshLandedCosts={handleRefreshLandedCosts}
          onShowToast={onShowToast}
        />
      )}

      {/* ========================================================================= */}
      {/* 0C. DEDICATED WAREHOUSE ROUTING & BINS TAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'warehouse' && (
        <WarehouseRoutingSettingsTab
          theme={theme}
          settings={enterpriseSettings}
          bins={warehouseBins}
          routes={warehouseRoutes}
          inventoryTiers={inventoryTiers}
          isReadOnly={isReadOnlyPolicyRole}
          onUpdateSettings={handleUpdateEnterpriseSettings}
          onRefreshBins={handleRefreshBins}
          onRefreshRoutes={handleRefreshRoutes}
          onShowToast={onShowToast}
        />
      )}

      {/* ========================================================================= */}
      {/* 0D. DEDICATED 3-WAY MATCHING AP CONTROLS TAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'matching' && (
        <ThreeWayMatchingSettingsTab
          theme={theme}
          settings={enterpriseSettings}
          vendorBills={vendorBills}
          purchaseOrders={purchaseOrders}
          goodsReceipts={goodsReceipts}
          isReadOnly={isReadOnlyPolicyRole}
          onUpdateSettings={handleUpdateEnterpriseSettings}
          onRefreshData={fetchAllSettings}
          onOpenVendorBillsModal={onNavigateToVendorBills}
          onShowToast={onShowToast}
        />
      )}

      {/* ========================================================================= */}
      {/* 1. CHART OF ACCOUNTS (COA) DIRECTORY & MAPPING TAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'coa' && (
        <div className="space-y-6 animate-fadeIn">
          {/* View Mode Switcher Header */}
          <div className={`${cardClass} p-5 sm:p-6 space-y-4`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-slate-800/80">
              <div>
                <h2 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-slate-100'} flex items-center gap-2`}>
                  <Building2 className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                  Chart of Accounts (COA) Management &amp; Mapping
                </h2>
                <p className={`text-xs mt-0.5 ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                  Create and manage master ledger accounts, configure standard debit/credit rules, and map automated POS &amp; Inventory accounting linkages.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                <div className={`p-1 rounded-xl border flex items-center gap-1 ${isLight ? 'bg-gray-100 border-gray-200' : 'bg-[#090A0F] border-slate-800/80'}`}>
                  <button
                    onClick={() => setCoaViewMode('directory')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      coaViewMode === 'directory'
                        ? 'bg-[#0F4C3A] text-white shadow-xs'
                        : isLight
                        ? 'text-gray-600 hover:text-gray-900'
                        : 'text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    COA Directory
                  </button>
                  <button
                    onClick={() => setCoaViewMode('mapping')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      coaViewMode === 'mapping'
                        ? 'bg-[#0F4C3A] text-white shadow-xs'
                        : isLight
                        ? 'text-gray-600 hover:text-gray-900'
                        : 'text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    Automated Mapping
                  </button>
                </div>

                {coaViewMode === 'directory' ? (
                  <button
                    onClick={openCreateAccountModal}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Account</span>
                  </button>
                ) : (
                  <button
                    onClick={handleSaveCoa}
                    disabled={isSavingCoa || isReadOnlyPolicyRole}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-semibold rounded-xl shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isSavingCoa ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span>{isReadOnlyPolicyRole ? 'Read-Only (COO / Super Admin)' : 'Save COA Mapping'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* DIRECTORY VIEW: Manual COA Management */}
            {coaViewMode === 'directory' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Master Chart of Accounts ({chartOfAccounts.length} Total Accounts)
                    </span>
                  </div>
                  <span className={`text-[11px] ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                    Indonesian GAAP (PSAK 101) Compliant
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-gray-200/90 dark:border-slate-800/80">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className={`border-b text-[11px] font-bold tracking-wider uppercase ${
                        isLight ? 'bg-gray-50/80 text-gray-500 border-gray-200' : 'bg-[#090A0F] text-slate-400 border-slate-800/80'
                      }`}>
                        <th className="py-3 px-3.5">Code</th>
                        <th className="py-3 px-3.5">Account Name</th>
                        <th className="py-3 px-3 text-center">Category</th>
                        <th className="py-3 px-3 text-center">Normal Balance</th>
                        <th className="py-3 px-3 text-right">Current Balance</th>
                        <th className="py-3 px-3">Description</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isLight ? 'divide-gray-100' : 'divide-slate-800/80'}`}>
                      {chartOfAccounts.map((acc) => (
                        <tr
                          key={acc.accountCode}
                          className={`transition-colors ${
                            isLight ? 'hover:bg-gray-50/80' : 'hover:bg-slate-900/60'
                          }`}
                        >
                          <td className="py-3 px-3.5 font-mono font-bold text-[#0F4C3A] dark:text-emerald-400">
                            {acc.accountCode}
                          </td>
                          <td className={`py-3 px-3.5 font-semibold ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                            {acc.accountName}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                              acc.category === 'Asset'
                                ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
                                : acc.category === 'Liability'
                                ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
                                : acc.category === 'Equity'
                                ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300'
                                : acc.category === 'Revenue'
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                            }`}>
                              {acc.category}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-mono text-[11px] text-gray-500 dark:text-slate-400">
                            {acc.normalBalance}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold">
                            {formatIDR(acc.balance)}
                          </td>
                          <td className={`py-3 px-3 text-[11px] truncate max-w-xs ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                            {acc.description}
                          </td>
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <button
                              onClick={() => openEditAccountModal(acc)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all cursor-pointer ${
                                isLight
                                  ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                                  : 'bg-slate-900/90 border-slate-800/80 text-slate-300 hover:bg-slate-800'
                              }`}
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* MAPPING VIEW: Dynamic Automated Accounting Rules */}
            {coaViewMode === 'mapping' && (
              <div className="space-y-6">
                {/* Core Revenue, Asset & Expense Mapping Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* POS Revenue Account */}
              <div className={subCardClass}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4" />
                    POS Sales Revenue (Credit)
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-bold">
                    Revenue
                  </span>
                </div>
                <label className={labelClass}>Target Revenue Account</label>
                <select
                  disabled={isReadOnlyPolicyRole}
                  value={coaConfig.posRevenueAccountCode}
                  onChange={(e) => {
                    const found = chartOfAccounts.find((c) => c.accountCode === e.target.value);
                    setCoaConfig({
                      ...coaConfig,
                      posRevenueAccountCode: e.target.value,
                      posRevenueAccountName: found?.accountName || 'Sales Revenue',
                    });
                  }}
                  className={`w-full ${inputClass} disabled:opacity-60`}
                >
                  {chartOfAccounts
                    .filter((c) => c.category === 'Revenue')
                    .map((coa) => (
                      <option key={coa.accountCode} value={coa.accountCode}>
                        [{coa.accountCode}] {coa.accountName} • Bal: {formatIDR(coa.balance)}
                      </option>
                    ))}
                </select>
                <p className={`text-[11px] mt-2 ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                  Credited on every completed POS checkout for the gross merchandise value.
                </p>
              </div>

              {/* Merchandise Inventory Asset Account */}
              <div className={subCardClass}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                    <Boxes className="w-4 h-4" />
                    Merchandise Inventory Asset (Credit / Relief)
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-800 dark:text-blue-300 font-bold">
                    Asset
                  </span>
                </div>
                <label className={labelClass}>Target Inventory Asset Account</label>
                <select
                  disabled={isReadOnlyPolicyRole}
                  value={coaConfig.inventoryAssetAccountCode}
                  onChange={(e) => {
                    const found = chartOfAccounts.find((c) => c.accountCode === e.target.value);
                    setCoaConfig({
                      ...coaConfig,
                      inventoryAssetAccountCode: e.target.value,
                      inventoryAssetAccountName: found?.accountName || 'Inventory Asset',
                    });
                  }}
                  className={`w-full ${inputClass} disabled:opacity-60`}
                >
                  {chartOfAccounts
                    .filter((c) => c.category === 'Asset')
                    .map((coa) => (
                      <option key={coa.accountCode} value={coa.accountCode}>
                        [{coa.accountCode}] {coa.accountName} • Bal: {formatIDR(coa.balance)}
                      </option>
                    ))}
                </select>
                <p className={`text-[11px] mt-2 ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                  Credited to relieve physical inventory value when items are sold or written off.
                </p>
              </div>

              {/* Cost of Goods Sold (COGS / HPP) Account */}
              <div className={subCardClass}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <ReceiptText className="w-4 h-4" />
                    Cost of Goods Sold (COGS / HPP - Debit)
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-800 dark:text-amber-300 font-bold">
                    Expense
                  </span>
                </div>
                <label className={labelClass}>Target COGS Account</label>
                <select
                  disabled={isReadOnlyPolicyRole}
                  value={coaConfig.cogsAccountCode}
                  onChange={(e) => {
                    const found = chartOfAccounts.find((c) => c.accountCode === e.target.value);
                    setCoaConfig({
                      ...coaConfig,
                      cogsAccountCode: e.target.value,
                      cogsAccountName: found?.accountName || 'Cost of Goods Sold',
                    });
                  }}
                  className={`w-full ${inputClass} disabled:opacity-60`}
                >
                  {chartOfAccounts
                    .filter((c) => c.category === 'Expense')
                    .map((coa) => (
                      <option key={coa.accountCode} value={coa.accountCode}>
                        [{coa.accountCode}] {coa.accountName} • Bal: {formatIDR(coa.balance)}
                      </option>
                    ))}
                </select>
                <p className={`text-[11px] mt-2 ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                  Debited when merchandise is sold to recognize true FIFO batch procurement cost.
                </p>
              </div>

              {/* Shrinkage & Spoilage Write-Off Account */}
              <div className={subCardClass}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                    <TrendingDown className="w-4 h-4" />
                    Shrinkage &amp; Spoilage Loss (Debit)
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-800 dark:text-rose-300 font-bold">
                    Expense
                  </span>
                </div>
                <label className={labelClass}>Target Shrinkage Write-off Account</label>
                <select
                  disabled={isReadOnlyPolicyRole}
                  value={coaConfig.shrinkageExpenseAccountCode}
                  onChange={(e) => {
                    const found = chartOfAccounts.find((c) => c.accountCode === e.target.value);
                    setCoaConfig({
                      ...coaConfig,
                      shrinkageExpenseAccountCode: e.target.value,
                      shrinkageExpenseAccountName: found?.accountName || 'Shrinkage Expense',
                    });
                  }}
                  className={`w-full ${inputClass} disabled:opacity-60`}
                >
                  {chartOfAccounts
                    .filter((c) => c.category === 'Expense')
                    .map((coa) => (
                      <option key={coa.accountCode} value={coa.accountCode}>
                        [{coa.accountCode}] {coa.accountName} • Bal: {formatIDR(coa.balance)}
                      </option>
                    ))}
                </select>
                <p className={`text-[11px] mt-2 ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                  Debited when stock opname reveals inventory shortages or perishable spoilage.
                </p>
              </div>
            </div>

            {/* Clearing Accounts for Payment Channels */}
            <div className="pt-4 border-t border-gray-100 dark:border-slate-800/80">
              <h3 className={`text-sm font-bold mb-3 ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                Frontline Tender &amp; Clearing Accounts
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Cash Drawer Clearing */}
                <div className={subCardClass}>
                  <label className={labelClass}>Cash Drawer Clearing</label>
                  <select
                    disabled={isReadOnlyPolicyRole}
                    value={coaConfig.cashClearingAccountCode}
                    onChange={(e) => {
                      const found = chartOfAccounts.find((c) => c.accountCode === e.target.value);
                      setCoaConfig({
                        ...coaConfig,
                        cashClearingAccountCode: e.target.value,
                        cashClearingAccountName: found?.accountName || 'Cash Clearing',
                      });
                    }}
                    className={`w-full ${inputClass} disabled:opacity-60`}
                  >
                    {chartOfAccounts
                      .filter((c) => c.category === 'Asset')
                      .map((coa) => (
                        <option key={coa.accountCode} value={coa.accountCode}>
                          [{coa.accountCode}] {coa.accountName}
                        </option>
                      ))}
                  </select>
                </div>

                {/* QRIS Receivable */}
                <div className={subCardClass}>
                  <label className={labelClass}>QRIS Settlement Clearing</label>
                  <select
                    disabled={isReadOnlyPolicyRole}
                    value={coaConfig.qrisClearingAccountCode}
                    onChange={(e) => {
                      const found = chartOfAccounts.find((c) => c.accountCode === e.target.value);
                      setCoaConfig({
                        ...coaConfig,
                        qrisClearingAccountCode: e.target.value,
                        qrisClearingAccountName: found?.accountName || 'QRIS Clearing',
                      });
                    }}
                    className={`w-full ${inputClass} disabled:opacity-60`}
                  >
                    {chartOfAccounts
                      .filter((c) => c.category === 'Asset')
                      .map((coa) => (
                        <option key={coa.accountCode} value={coa.accountCode}>
                          [{coa.accountCode}] {coa.accountName}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Card / EDC Clearing */}
                <div className={subCardClass}>
                  <label className={labelClass}>EDC Card Operational Clearing</label>
                  <select
                    disabled={isReadOnlyPolicyRole}
                    value={coaConfig.edcClearingAccountCode}
                    onChange={(e) => {
                      const found = chartOfAccounts.find((c) => c.accountCode === e.target.value);
                      setCoaConfig({
                        ...coaConfig,
                        edcClearingAccountCode: e.target.value,
                        edcClearingAccountName: found?.accountName || 'EDC Card Clearing',
                      });
                    }}
                    className={`w-full ${inputClass} disabled:opacity-60`}
                  >
                    {chartOfAccounts
                      .filter((c) => c.category === 'Asset')
                      .map((coa) => (
                        <option key={coa.accountCode} value={coa.accountCode}>
                          [{coa.accountCode}] {coa.accountName}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Live Double-Entry Preview Box */}
            <div className={`p-4 rounded-xl border ${isLight ? 'bg-emerald-50/50 border-emerald-200' : 'bg-emerald-950/20 border-emerald-900/40'}`}>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
                <span className={`text-xs font-bold ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                  Live Double-Entry Journal Preview (Sample Rp 100.000 POS Sale)
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 bg-white dark:bg-[#090A0F] rounded-lg border border-gray-200 dark:border-slate-800/80 space-y-1">
                  <div className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase">1. Revenue Recognition:</div>
                  <div className="text-emerald-700 dark:text-emerald-400">Debit [{coaConfig.cashClearingAccountCode}] {coaConfig.cashClearingAccountName}: Rp 100.000</div>
                  <div className="text-teal-700 dark:text-teal-400 pl-4">Credit [{coaConfig.posRevenueAccountCode}] {coaConfig.posRevenueAccountName}: Rp 100.000</div>
                </div>
                <div className="p-3 bg-white dark:bg-[#090A0F] rounded-lg border border-gray-200 dark:border-slate-800/80 space-y-1">
                  <div className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase">2. Cost of Goods Sold (COGS):</div>
                  <div className="text-amber-700 dark:text-amber-400">Debit [{coaConfig.cogsAccountCode}] {coaConfig.cogsAccountName}: Rp 62.000</div>
                  <div className="text-blue-700 dark:text-blue-400 pl-4">Credit [{coaConfig.inventoryAssetAccountCode}] {coaConfig.inventoryAssetAccountName}: Rp 62.000</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Manual COA Create / Edit Modal */}
      {isAddingCoa && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto gm-backdrop-fade"
          onClick={() => {
            setIsAddingCoa(false);
            setEditingCoa(null);
          }}
        >
          <div 
            className={`${cardClass} max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl my-auto relative max-h-[calc(100vh-2rem)] overflow-y-auto gm-modal-pop`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between border-b pb-3 ${isLight ? 'border-gray-200' : 'border-slate-800/80'}`}>
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <h3 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                  {editingCoa ? 'Edit Chart of Accounts Entry' : 'Create New COA Account'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddingCoa(false);
                  setEditingCoa(null);
                }}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${isLight ? 'hover:bg-gray-100 text-gray-500' : 'hover:bg-slate-800 text-slate-400'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCoaAccount} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Account Code (4-digit)</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingCoa}
                    value={newCoaCode}
                    onChange={(e) => setNewCoaCode(e.target.value)}
                    placeholder="e.g. 1050 or 5040"
                    className={`w-full ${inputClass} font-mono disabled:opacity-60`}
                  />
                </div>
                <div>
                  <label className={labelClass}>Category</label>
                  <select
                    value={newCoaCategory}
                    onChange={(e) => setNewCoaCategory(e.target.value as any)}
                    className={`w-full ${inputClass}`}
                  >
                    <option value="Asset">Asset</option>
                    <option value="Liability">Liability</option>
                    <option value="Equity">Equity</option>
                    <option value="Revenue">Revenue</option>
                    <option value="Expense">Expense</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>Account Name</label>
                <input
                  type="text"
                  required
                  value={newCoaName}
                  onChange={(e) => setNewCoaName(e.target.value)}
                  placeholder="e.g. Prepaid Logistics Insurance"
                  className={`w-full ${inputClass}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Normal Balance</label>
                  <select
                    value={newCoaNormalBal}
                    onChange={(e) => setNewCoaNormalBal(e.target.value as any)}
                    className={`w-full ${inputClass}`}
                  >
                    <option value="Debit">Debit</option>
                    <option value="Credit">Credit</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Initial / Current Balance (IDR)</label>
                  <input
                    type="number"
                    value={newCoaBalance}
                    onChange={(e) => setNewCoaBalance(Number(e.target.value) || 0)}
                    className={`w-full ${inputClass} font-mono`}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Scope / Store Outlet</label>
                <select
                  value={newCoaStore}
                  onChange={(e) => setNewCoaStore(e.target.value)}
                  className={`w-full ${inputClass}`}
                >
                  <option value="CONSOLIDATED">CONSOLIDATED (All Outlets)</option>
                  {storeOutlets.map((st) => (
                    <option key={st.storeId} value={st.storeId}>
                      {st.storeName} ({st.city})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Description &amp; Operational Directive</label>
                <textarea
                  rows={2}
                  value={newCoaDesc}
                  onChange={(e) => setNewCoaDesc(e.target.value)}
                  placeholder="Operational accounting directives for this ledger code..."
                  className={`w-full ${inputClass}`}
                />
              </div>

              <div className={`flex justify-end gap-2 pt-3 border-t ${isLight ? 'border-gray-200' : 'border-slate-800/80'}`}>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingCoa(false);
                    setEditingCoa(null);
                  }}
                  className={`px-4 py-2 rounded-xl border text-xs font-semibold cursor-pointer ${
                    isLight ? 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100' : 'bg-slate-900/90 border-slate-800/80 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingAccount}
                  className="px-4 py-2 bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSavingAccount ? 'Saving...' : editingCoa ? 'Update Account' : 'Save New Account'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  )}

      {/* ========================================================================= */}
      {/* 2. POS & CHECKOUT RULES CONFIGURATION TAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'pos' && (
        <div className="space-y-6 animate-fadeIn">
          {isReadOnlyPolicyRole && (
            <div className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs ${
              isLight ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-amber-950/30 border-amber-800/40 text-amber-200'
            }`}>
              <Lock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Read-Only Governance Mode (Admin):</strong> POS checkout &amp; rounding policy changes require COO or Super Admin clearance.
              </span>
            </div>
          )}
          <div className={`${cardClass} p-5 sm:p-6 space-y-6`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100 dark:border-slate-800/80">
              <div>
                <h2 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-slate-100'} flex items-center gap-2`}>
                  <CreditCard className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  POS &amp; Frontline Cashier Configuration
                </h2>
                <p className={`text-xs mt-0.5 ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                  Control cash rounding, VAT taxation, maximum cashier discounts, near-expiry Vivo automation, and receipt printing options across all 34 outlets.
                </p>
              </div>

              <button
                onClick={handleSavePosConfig}
                disabled={isSavingPos || isReadOnlyPolicyRole}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-semibold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer self-start sm:self-auto"
              >
                {isSavingPos ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{isReadOnlyPolicyRole ? 'Read-Only (COO / Super Admin)' : 'Save POS Configuration'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Cash Rounding Rule */}
              <div className={subCardClass}>
                <div className="flex items-center gap-2 mb-2 text-indigo-700 dark:text-indigo-400 font-bold text-xs">
                  <Sliders className="w-4 h-4" />
                  <span>Cash Currency Rounding Engine</span>
                </div>
                <label className={labelClass}>Rounding Method</label>
                <select
                  disabled={isReadOnlyPolicyRole}
                  value={posConfig.roundingRule}
                  onChange={(e) => setPosConfig({ ...posConfig, roundingRule: e.target.value as PosRoundingRule })}
                  className={`w-full ${inputClass} disabled:opacity-60`}
                >
                  <option value="none">No Rounding (Exact to Rp 1)</option>
                  <option value="nearest_100">Round to Nearest Rp 100 (Standard Retail)</option>
                  <option value="nearest_500">Round to Nearest Rp 500 (Indonesian Coin standard)</option>
                  <option value="nearest_1000">Round to Nearest Rp 1.000</option>
                  <option value="ceil_1000">Ceiling Up to Next Rp 1.000</option>
                </select>
                <p className={`text-[11px] mt-2 ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                  Eliminates cashier coin shortage friction during high-volume physical checkout.
                </p>
              </div>

              {/* PPN / Value-Added Tax Rate */}
              <div className={subCardClass}>
                <div className="flex items-center gap-2 mb-2 text-teal-700 dark:text-teal-400 font-bold text-xs">
                  <Percent className="w-4 h-4" />
                  <span>Value-Added Tax (PPN / VAT)</span>
                </div>
                <label className={labelClass}>Tax Rate (%)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={30}
                    disabled={isReadOnlyPolicyRole}
                    value={posConfig.ppnTaxPercent}
                    onChange={(e) => setPosConfig({ ...posConfig, ppnTaxPercent: Math.max(0, Number(e.target.value) || 0) })}
                    className={`w-28 ${inputClass} disabled:opacity-60`}
                  />
                  <span className="text-xs font-bold text-gray-500">% Standard PPN</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="taxInclusiveCheck"
                    disabled={isReadOnlyPolicyRole}
                    checked={posConfig.isTaxInclusive}
                    onChange={(e) => setPosConfig({ ...posConfig, isTaxInclusive: e.target.checked })}
                    className="w-4 h-4 text-[#0F4C3A] rounded disabled:opacity-50"
                  />
                  <label htmlFor="taxInclusiveCheck" className={`text-xs ${isLight ? 'text-gray-700' : 'text-slate-400'}`}>
                    Prices displayed are tax-inclusive
                  </label>
                </div>
              </div>

              {/* Cashier Manual Discount Limit */}
              <div className={subCardClass}>
                <div className="flex items-center gap-2 mb-2 text-amber-700 dark:text-amber-400 font-bold text-xs">
                  <DollarSign className="w-4 h-4" />
                  <span>Cashier Discount Governance</span>
                </div>
                <label className={labelClass}>Max Cashier Manual Discount</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={50}
                    disabled={isReadOnlyPolicyRole}
                    value={posConfig.maxCashierDiscountPercent}
                    onChange={(e) => setPosConfig({ ...posConfig, maxCashierDiscountPercent: Math.max(0, Number(e.target.value) || 0) })}
                    className={`w-28 ${inputClass} disabled:opacity-60`}
                  />
                  <span className="text-xs font-bold text-gray-500">% without Manager PIN</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="managerPinCheck"
                    disabled={isReadOnlyPolicyRole}
                    checked={posConfig.requireManagerPinForVoid}
                    onChange={(e) => setPosConfig({ ...posConfig, requireManagerPinForVoid: e.target.checked })}
                    className="w-4 h-4 text-[#0F4C3A] rounded disabled:opacity-50"
                  />
                  <label htmlFor="managerPinCheck" className={`text-xs ${isLight ? 'text-gray-700' : 'text-slate-400'}`}>
                    Require Manager PIN for item void
                  </label>
                </div>
              </div>

              {/* Near-Expiry Vivo Markdown Automation */}
              <div className={subCardClass}>
                <div className="flex items-center gap-2 mb-2 text-rose-700 dark:text-rose-400 font-bold text-xs">
                  <Clock className="w-4 h-4" />
                  <span>Near-Expiry (Vivo Batch) Discount</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="enableVivoCheck"
                    disabled={isReadOnlyPolicyRole}
                    checked={posConfig.enableVivoNearExpiryDiscount}
                    onChange={(e) => setPosConfig({ ...posConfig, enableVivoNearExpiryDiscount: e.target.checked })}
                    className="w-4 h-4 text-[#0F4C3A] rounded disabled:opacity-50"
                  />
                  <label htmlFor="enableVivoCheck" className={`text-xs font-semibold ${isLight ? 'text-gray-800' : 'text-slate-200'}`}>
                    Enable Automatic Vivo Clearance
                  </label>
                </div>
                <label className={labelClass}>Clearance Discount Rate (%)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={5}
                    max={75}
                    disabled={isReadOnlyPolicyRole || !posConfig.enableVivoNearExpiryDiscount}
                    value={posConfig.vivoNearExpiryDiscountPercent}
                    onChange={(e) => setPosConfig({ ...posConfig, vivoNearExpiryDiscountPercent: Math.max(5, Number(e.target.value) || 25) })}
                    className={`w-28 ${inputClass} disabled:opacity-50`}
                  />
                  <span className="text-xs text-gray-500">applied to ≤3 day batches</span>
                </div>
              </div>

              {/* Cash Drawer Opening Float */}
              <div className={subCardClass}>
                <div className="flex items-center gap-2 mb-2 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                  <Boxes className="w-4 h-4" />
                  <span>Shift Cash Drawer Float</span>
                </div>
                <label className={labelClass}>Morning Starting Float (IDR)</label>
                <input
                  type="number"
                  step={50000}
                  disabled={isReadOnlyPolicyRole}
                  value={posConfig.cashDrawerFloatIDR}
                  onChange={(e) => setPosConfig({ ...posConfig, cashDrawerFloatIDR: Math.max(0, Number(e.target.value) || 0) })}
                  className={`w-full ${inputClass} disabled:opacity-60`}
                />
                <p className={`text-[11px] mt-2 ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                  Formatted: {formatIDR(posConfig.cashDrawerFloatIDR)} per register.
                </p>
              </div>

              {/* Customer Loyalty Points Multiplier */}
              <div className={subCardClass}>
                <div className="flex items-center gap-2 mb-2 text-violet-700 dark:text-violet-400 font-bold text-xs">
                  <Sparkles className="w-4 h-4" />
                  <span>Customer Loyalty Rewards</span>
                </div>
                <label className={labelClass}>Points Earning Rate</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={10}
                    disabled={isReadOnlyPolicyRole}
                    value={posConfig.loyaltyPointsPer1000IDR}
                    onChange={(e) => setPosConfig({ ...posConfig, loyaltyPointsPer1000IDR: Math.max(1, Number(e.target.value) || 1) })}
                    className={`w-28 ${inputClass} disabled:opacity-60`}
                  />
                  <span className="text-xs text-gray-500">GrocePoint per Rp 1.000 spent</span>
                </div>
              </div>
            </div>

            {/* Receipt Footer Customizer */}
            <div className={subCardClass}>
              <label className={labelClass}>Custom Store Receipt Footer Notice</label>
              <input
                type="text"
                disabled={isReadOnlyPolicyRole}
                value={posConfig.storeReceiptFooterText}
                onChange={(e) => setPosConfig({ ...posConfig, storeReceiptFooterText: e.target.value })}
                placeholder="e.g. Thank you for shopping with GroceMart! Follow @grocemart for farm updates."
                className={`w-full ${inputClass} disabled:opacity-60`}
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2B. ADVANCED PROMOTION & LOYALTY ENGINE TAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'promotions' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header Card */}
          <div className={`${cardClass} p-5 sm:p-6 space-y-4`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-slate-800/80">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 uppercase tracking-wide">
                    <Sparkles className="w-3.5 h-3.5" />
                    Central Rule Engine
                  </span>
                  <span className={`text-xs ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                    Dynamic Cart &amp; POS Evaluation
                  </span>
                </div>
                <h2 className={`text-lg font-bold mt-1.5 ${isLight ? 'text-gray-900' : 'text-slate-100'} flex items-center gap-2`}>
                  Promotion &amp; Member Loyalty Rule Engine
                </h2>
                <p className={`text-xs mt-0.5 max-w-2xl ${isLight ? 'text-gray-600' : 'text-slate-400'}`}>
                  Manage centralized retail discounts including BOGO (Buy 2 Get 1 Free), seasonal coupons, member tier perks, and category bundles. Rules evaluate dynamically at checkout without altering master inventory prices.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                {canManagePromotions && (
                  <button
                    type="button"
                    onClick={() => setIsCreatingPromo(true)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[#0F4C3A] hover:bg-[#0c3e2f] text-white flex items-center gap-2 cursor-pointer shadow-xs transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Promotion Rule</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick KPI Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-amber-50/40 border-amber-200/80' : 'bg-amber-950/20 border-amber-800/50'}`}>
                <div className={`text-xs font-medium ${isLight ? 'text-amber-800' : 'text-amber-300'}`}>Active Rules</div>
                <div className="text-2xl font-black mt-1 text-amber-700 dark:text-amber-300">
                  {promotions.filter((r) => r.active).length}
                </div>
                <div className={`text-[10px] ${isLight ? 'text-gray-500' : 'text-slate-400'} mt-0.5`}>Live across outlets</div>
              </div>

              <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-emerald-50/40 border-emerald-200/80' : 'bg-emerald-950/20 border-emerald-800/50'}`}>
                <div className={`text-xs font-medium ${isLight ? 'text-emerald-800' : 'text-emerald-300'}`}>BOGO Deals</div>
                <div className="text-2xl font-black mt-1 text-emerald-700 dark:text-emerald-300">
                  {promotions.filter((r) => r.type === 'BOGO' && r.active).length}
                </div>
                <div className={`text-[10px] ${isLight ? 'text-gray-500' : 'text-slate-400'} mt-0.5`}>Buy X Get Y Bundles</div>
              </div>

              <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-blue-50/40 border-blue-200/80' : 'bg-blue-950/20 border-blue-800/50'}`}>
                <div className={`text-xs font-medium ${isLight ? 'text-blue-800' : 'text-blue-300'}`}>VIP Loyalty Tiers</div>
                <div className="text-2xl font-black mt-1 text-blue-700 dark:text-blue-300">
                  {promotions.filter((r) => r.type === 'MEMBER_TIER' && r.active).length}
                </div>
                <div className={`text-[10px] ${isLight ? 'text-gray-500' : 'text-slate-400'} mt-0.5`}>Silver, Gold, Platinum</div>
              </div>

              <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-violet-50/40 border-violet-200/80' : 'bg-violet-950/20 border-violet-800/50'}`}>
                <div className={`text-xs font-medium ${isLight ? 'text-violet-800' : 'text-violet-300'}`}>Redemptions</div>
                <div className="text-2xl font-black mt-1 text-violet-700 dark:text-violet-300">
                  {promotions.reduce((sum, r) => sum + (r.usageCount || 0), 0).toLocaleString('id-ID')}
                </div>
                <div className={`text-[10px] ${isLight ? 'text-gray-500' : 'text-slate-400'} mt-0.5`}>Customer claims logged</div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                {(['ALL', 'BOGO', 'PERCENTAGE_DISCOUNT', 'FIXED_DISCOUNT', 'MEMBER_TIER', 'CATEGORY_BUNDLE'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setPromoTypeFilter(t)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      promoTypeFilter === t
                        ? 'bg-[#0F4C3A] text-white shadow-xs'
                        : isLight
                        ? 'text-gray-600 hover:bg-gray-100'
                        : 'text-slate-400 hover:bg-slate-900/90'
                    }`}
                  >
                    {t === 'ALL'
                      ? 'All Rules'
                      : t === 'PERCENTAGE_DISCOUNT'
                      ? 'Coupons (%)'
                      : t === 'FIXED_DISCOUNT'
                      ? 'Coupons (IDR)'
                      : t === 'MEMBER_TIER'
                      ? 'VIP Loyalty'
                      : t === 'CATEGORY_BUNDLE'
                      ? 'Category Bundles'
                      : 'BOGO'}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${isLight ? 'text-gray-400' : 'text-slate-400'}`} />
                <input
                  type="text"
                  value={promoSearch}
                  onChange={(e) => setPromoSearch(e.target.value)}
                  placeholder="Search code, name, SKU..."
                  className={`w-full pl-9 pr-3 py-1.5 text-xs rounded-xl ${inputClass}`}
                />
              </div>
            </div>
          </div>

          {/* Promotion Rules Table */}
          <div className={`${cardClass} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className={`border-b text-[10px] uppercase font-bold tracking-wider ${
                    isLight ? 'bg-gray-50 border-gray-200 text-gray-500' : 'bg-[#090A0F] border-slate-800/80 text-slate-400'
                  }`}>
                    <th className="py-3 px-4">Coupon Code &amp; Rule</th>
                    <th className="py-3 px-4">Rule Type</th>
                    <th className="py-3 px-4">Target Scope</th>
                    <th className="py-3 px-4">Benefit / Discount</th>
                    <th className="py-3 px-4">Spend Condition</th>
                    <th className="py-3 px-4 text-center">Usage Count</th>
                    <th className="py-3 px-4 text-center">Live Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800/80">
                  {promotions
                    .filter((r) => (promoTypeFilter === 'ALL' ? true : r.type === promoTypeFilter))
                    .filter((r) =>
                      promoSearch
                        ? r.name.toLowerCase().includes(promoSearch.toLowerCase()) ||
                          r.code.toLowerCase().includes(promoSearch.toLowerCase()) ||
                          r.targetValue.toLowerCase().includes(promoSearch.toLowerCase())
                        : true
                    )
                    .map((rule) => {
                      return (
                        <tr key={rule.id} className={`hover:bg-gray-50/50 dark:hover:bg-slate-900/60 transition-colors ${!rule.active ? 'opacity-60' : ''}`}>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center whitespace-nowrap font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/80 text-[#0F4C3A] dark:text-emerald-400">
                                {rule.code}
                              </span>
                              <div className="font-semibold text-gray-900 dark:text-slate-100">
                                {rule.name}
                              </div>
                            </div>
                            <div className={`text-[11px] ${isLight ? 'text-gray-500' : 'text-slate-400'} mt-0.5`}>
                              {rule.description}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className={`inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              rule.type === 'BOGO'
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                : rule.type === 'MEMBER_TIER'
                                ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30'
                                : rule.type === 'CATEGORY_BUNDLE'
                                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                                : 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/30'
                            }`}>
                              {rule.type.replace(/_/g, ' ')}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-mono text-xs text-gray-800 dark:text-slate-200">
                              {rule.targetType}: <strong className="text-[#0F4C3A] dark:text-emerald-400">{rule.targetValue}</strong>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-bold text-xs text-emerald-600 dark:text-emerald-400">
                              {rule.type === 'BOGO'
                                ? `Buy ${rule.buyQty} Get ${rule.getQty} Free`
                                : rule.discountPercent
                                ? `${rule.discountPercent}% Off`
                                : rule.discountAmountIDR
                                ? `-${formatIDR(rule.discountAmountIDR)}`
                                : '-'}
                            </div>
                            {rule.memberTier && (
                              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                {rule.memberTier} VIP Tier Only
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 font-mono text-[11px] text-gray-700 dark:text-slate-300">
                            {rule.minOrderSubtotalIDR ? `Min ${formatIDR(rule.minOrderSubtotalIDR)}` : 'No Min Spend'}
                          </td>

                          <td className="py-3.5 px-4 text-center font-bold font-mono text-xs text-gray-900 dark:text-slate-100">
                            {rule.usageCount || 0}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              disabled={!canManagePromotions}
                              onClick={() => handleTogglePromoActive(rule)}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                                rule.active
                                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                  : 'bg-slate-200 dark:bg-slate-900/90 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {rule.active ? 'ACTIVE' : 'PAUSED'}
                            </button>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              disabled={!canManagePromotions}
                              onClick={() => handleDeletePromo(rule.id)}
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              title={canManagePromotions ? 'Deactivate rule' : 'Read-Only for your role'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Create Promotion Rule Modal */}
          {isCreatingPromo && typeof document !== 'undefined' && createPortal(
            <div 
              className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto gm-backdrop-fade"
              onClick={() => setIsCreatingPromo(false)}
            >
              <div 
                className={`${cardClass} max-w-xl w-full p-5 sm:p-6 space-y-4 shadow-2xl my-auto relative max-h-[calc(100vh-2rem)] overflow-y-auto gm-modal-pop`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className={`text-sm font-bold ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>New Promotion Rule</h3>
                      <p className={`text-[11px] ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>GroceMart Retail Discount &amp; Loyalty Engine</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCreatingPromo(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSavePromo} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                        Promotion Name *
                      </label>
                      <input
                        type="text"
                        value={newPromoName}
                        onChange={(e) => setNewPromoName(e.target.value)}
                        placeholder="e.g. Organic Salad 25% Off"
                        required
                        className={`w-full px-3 py-2 rounded-xl ${inputClass}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                        Coupon Code *
                      </label>
                      <input
                        type="text"
                        value={newPromoCode}
                        onChange={(e) => setNewPromoCode(e.target.value.toUpperCase())}
                        placeholder="e.g. SALAD25"
                        required
                        className={`w-full px-3 py-2 rounded-xl font-mono uppercase ${inputClass}`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                        Rule Type
                      </label>
                      <select
                        value={newPromoType}
                        onChange={(e) => setNewPromoType(e.target.value as PromotionType)}
                        className={`w-full px-3 py-2 rounded-xl font-semibold cursor-pointer ${inputClass}`}
                      >
                        <option value="PERCENTAGE_DISCOUNT">Percentage Discount (%)</option>
                        <option value="FIXED_DISCOUNT">Fixed Spend Discount (IDR)</option>
                        <option value="BOGO">BOGO (Buy X Get Y Free)</option>
                        <option value="MEMBER_TIER">Member Loyalty Tier Discount</option>
                        <option value="CATEGORY_BUNDLE">Category Bundle Discount</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                        Target Type
                      </label>
                      <select
                        value={newPromoTargetType}
                        onChange={(e) => setNewPromoTargetType(e.target.value as any)}
                        className={`w-full px-3 py-2 rounded-xl font-semibold cursor-pointer ${inputClass}`}
                      >
                        <option value="ALL">Entire Basket (ALL)</option>
                        <option value="CATEGORY">Specific Category</option>
                        <option value="SKU">Specific Product SKU</option>
                      </select>
                    </div>
                  </div>

                  {newPromoTargetType !== 'ALL' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                        Target Value ({newPromoTargetType === 'CATEGORY' ? 'Category Name' : 'Product SKU'})
                      </label>
                      {newPromoTargetType === 'CATEGORY' ? (
                        <select
                          value={newPromoTargetValue}
                          onChange={(e) => setNewPromoTargetValue(e.target.value)}
                          className={`w-full px-3 py-2 rounded-xl font-semibold cursor-pointer ${inputClass}`}
                        >
                          <option value="produce">produce (Fresh Organic Produce)</option>
                          <option value="meat_seafood">meat_seafood (Butchery &amp; Prime Seafood)</option>
                          <option value="dairy_eggs">dairy_eggs (Artisan Dairy &amp; Poultry Eggs)</option>
                          <option value="bakery">bakery (Fresh Hearth Bakery)</option>
                          <option value="pantry_coffee">pantry_coffee (Organic Pantry &amp; Coffee)</option>
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={newPromoTargetValue}
                          onChange={(e) => setNewPromoTargetValue(e.target.value)}
                          placeholder="e.g. SKU-PRD-002"
                          className={`w-full px-3 py-2 rounded-xl font-mono ${inputClass}`}
                        />
                      )}
                    </div>
                  )}

                  {/* Dynamic Benefit Fields based on Type */}
                  {newPromoType === 'PERCENTAGE_DISCOUNT' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">Discount %</label>
                        <input
                          type="number"
                          min={1}
                          max={90}
                          value={newPromoDiscountPercent}
                          onChange={(e) => setNewPromoDiscountPercent(Number(e.target.value))}
                          className={`w-full px-3 py-2 rounded-xl ${inputClass}`}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">Min Spend (IDR)</label>
                        <input
                          type="number"
                          step={10000}
                          value={newPromoMinSpend}
                          onChange={(e) => setNewPromoMinSpend(Number(e.target.value))}
                          className={`w-full px-3 py-2 rounded-xl ${inputClass}`}
                        />
                      </div>
                    </div>
                  )}

                  {newPromoType === 'BOGO' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">Buy Quantity</label>
                        <input
                          type="number"
                          min={1}
                          value={newPromoBuyQty}
                          onChange={(e) => setNewPromoBuyQty(Number(e.target.value))}
                          className={`w-full px-3 py-2 rounded-xl ${inputClass}`}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">Get Free Units</label>
                        <input
                          type="number"
                          min={1}
                          value={newPromoGetQty}
                          onChange={(e) => setNewPromoGetQty(Number(e.target.value))}
                          className={`w-full px-3 py-2 rounded-xl ${inputClass}`}
                        />
                      </div>
                    </div>
                  )}

                  {newPromoType === 'MEMBER_TIER' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">Required VIP Tier</label>
                        <select
                          value={newPromoMemberTier}
                          onChange={(e) => setNewPromoMemberTier(e.target.value as MemberLoyaltyTier)}
                          className={`w-full px-3 py-2 rounded-xl font-semibold cursor-pointer ${inputClass}`}
                        >
                          <option value="SILVER">SILVER (5% Default)</option>
                          <option value="GOLD">GOLD (10% Default)</option>
                          <option value="PLATINUM">PLATINUM (15% Default)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">Tier Discount %</label>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={newPromoDiscountPercent}
                          onChange={(e) => setNewPromoDiscountPercent(Number(e.target.value))}
                          className={`w-full px-3 py-2 rounded-xl ${inputClass}`}
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">Description</label>
                    <textarea
                      rows={2}
                      value={newPromoDesc}
                      onChange={(e) => setNewPromoDesc(e.target.value)}
                      placeholder="Public terms or details displayed on receipt/storefront"
                      className={`w-full px-3 py-2 rounded-xl ${inputClass}`}
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => setIsCreatingPromo(false)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingPromo}
                      className="px-5 py-2 rounded-xl text-xs font-bold bg-[#0F4C3A] hover:bg-[#0c3e2f] text-white flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {isSavingPromo && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      <span>Activate Promotion Rule</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. INVENTORY BULK IMPORT & STOCK OPNAME TAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'import_opname' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Inner Tab Pill Toggle */}
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 dark:border-slate-800/80 pb-3">
            <button
              onClick={() => setOpnameSubTab('stocktake')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                opnameSubTab === 'stocktake'
                  ? 'bg-[#0F4C3A] text-white shadow-2xs'
                  : isLight
                  ? 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                  : 'bg-slate-900/90 text-slate-300 border border-slate-800/80 hover:bg-slate-800'
              }`}
            >
              <FileCheck2 className="w-4 h-4" />
              <span>Physical Stock Opname (Stocktake)</span>
            </button>

            <button
              onClick={() => setOpnameSubTab('bulk_import')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                opnameSubTab === 'bulk_import'
                  ? 'bg-[#0F4C3A] text-white shadow-2xs'
                  : isLight
                  ? 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                  : 'bg-slate-900/90 text-slate-300 border border-slate-800/80 hover:bg-slate-800'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Bulk Inventory Import (CSV/Excel)</span>
            </button>
          </div>

          {/* 3A: PHYSICAL STOCK OPNAME (STOCKTAKE) */}
          {opnameSubTab === 'stocktake' && (
            <div className="space-y-6">
              {/* Audit Mode Switcher: Standard Reconciliation vs Blind Cycle Count (Anti-Fraud) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className={`inline-flex items-center gap-1 p-1 rounded-xl border w-fit ${isLight ? 'bg-gray-100/80 border-gray-200' : 'bg-[#090A0F] border-slate-800/80'}`}>
                  <button
                    type="button"
                    onClick={() => setOpnameAuditMode('standard')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                      opnameAuditMode === 'standard'
                        ? 'bg-[#0F4C3A] text-white shadow-xs'
                        : isLight
                        ? 'text-gray-700 hover:text-gray-900'
                        : 'text-slate-300 hover:text-slate-100'
                    }`}
                  >
                    <Boxes className="w-3.5 h-3.5" />
                    <span>Standard Reconciliation</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpnameAuditMode('blind')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                      opnameAuditMode === 'blind'
                        ? 'bg-[#0F4C3A] text-white shadow-xs'
                        : isLight
                        ? 'text-gray-700 hover:text-gray-900'
                        : 'text-slate-300 hover:text-slate-100'
                    }`}
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Blind Cycle Count (Anti-Fraud)</span>
                  </button>
                </div>

                {opnameAuditMode === 'blind' && (
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${isLight ? 'text-gray-700' : 'text-slate-300'}`}>
                      Target Outlet:
                    </span>
                    <select
                      disabled={isBranchScoped}
                      value={isBranchScoped ? lockedBranchId : opnameStoreId}
                      onChange={(e) => {
                        if (isBranchScoped) return;
                        setOpnameStoreId(e.target.value);
                      }}
                      className={`px-3 py-1.5 text-xs rounded-xl font-bold ${inputClass} ${
                        isBranchScoped ? 'opacity-75 cursor-not-allowed' : ''
                      }`}
                    >
                      {storeOutlets
                        .filter((st) => !isBranchScoped || st.storeId === lockedBranchId)
                        .map((st) => (
                          <option key={st.storeId} value={st.storeId}>
                            {st.storeName} ({st.city})
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>

              {opnameAuditMode === 'blind' ? (
                <BlindOpnamePanel
                  theme={theme}
                  selectedStoreId={opnameStoreId}
                  activeStaffSession={activeStaffSession}
                  onRefreshData={onRefreshData}
                  onShowToast={onShowToast}
                />
              ) : (
                <>
                  <div className={`${cardClass} p-5 sm:p-6 space-y-5`}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                    <h3 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-slate-100'} flex items-center gap-2`}>
                      <Boxes className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      Periodic Stock Opname &amp; Discrepancy Reconciliation
                    </h3>
                    <p className={`text-xs mt-0.5 ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                      Audit real-world shelf inventory against system book balances. Discrepancies automatically trigger double-entry Shrinkage Expense adjustments.
                    </p>
                  </div>

                  {/* Store Outlet Selector */}
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-semibold ${isLight ? 'text-gray-700' : 'text-slate-300'}`}>
                      Select Store:
                    </span>
                    <select
                      disabled={isBranchScoped}
                      value={isBranchScoped ? lockedBranchId : opnameStoreId}
                      onChange={(e) => {
                        if (isBranchScoped) return;
                        setOpnameStoreId(e.target.value);
                      }}
                      className={`px-3 py-1.5 text-xs rounded-xl font-bold ${inputClass} ${
                        isBranchScoped ? 'opacity-75 cursor-not-allowed' : ''
                      }`}
                    >
                      {storeOutlets
                        .filter((st) => !isBranchScoped || st.storeId === lockedBranchId)
                        .map((st) => (
                          <option key={st.storeId} value={st.storeId}>
                            {st.storeName} ({st.city})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* Stocktake Metric Stat Cards (Dynamic Surplus & Deficit Breakdown) */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
                  <div className={subCardClass}>
                    <span className="text-[11px] text-gray-500 font-semibold block">System Book Count</span>
                    <span className={`text-base sm:text-lg font-bold font-mono mt-1 block ${isLight ? 'text-gray-900' : 'text-white'}`}>
                      {opnameStats.totalSys} units
                    </span>
                    <span className="text-[10px] text-gray-400">Total registered</span>
                  </div>

                  <div className={subCardClass}>
                    <span className="text-[11px] text-gray-500 font-semibold block">Physical Counted</span>
                    <span className="text-base sm:text-lg font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-1 block">
                      {opnameStats.totalCounted} units
                    </span>
                    <span className="text-[10px] text-gray-400">Auditor verified</span>
                  </div>

                  <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-emerald-50/60 border-emerald-200' : 'bg-emerald-950/20 border-emerald-800/40'}`}>
                    <span className="text-[11px] text-emerald-800 dark:text-emerald-300 font-bold block flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                      Surplus (Lebih)
                    </span>
                    <span className="text-base sm:text-lg font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-1 block">
                      +{opnameStats.totalSurplusQty} units
                    </span>
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium block">
                      {opnameStats.surplusCount} SKUs (+{formatIDR(opnameStats.totalSurplusIDR)})
                    </span>
                  </div>

                  <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-rose-50/60 border-rose-200' : 'bg-rose-950/20 border-rose-800/40'}`}>
                    <span className="text-[11px] text-rose-800 dark:text-rose-300 font-bold block flex items-center gap-1">
                      <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                      Deficit (Kurang)
                    </span>
                    <span className="text-base sm:text-lg font-bold font-mono text-rose-600 dark:text-rose-400 mt-1 block">
                      -{opnameStats.totalDeficitQty} units
                    </span>
                    <span className="text-[10px] text-rose-700 dark:text-rose-300 font-medium block">
                      {opnameStats.shortageCount} SKUs (-{formatIDR(opnameStats.totalDeficitIDR)})
                    </span>
                  </div>

                  <div className={subCardClass}>
                    <span className="text-[11px] text-gray-500 font-semibold block">Net GL Variance</span>
                    <span
                      className={`text-base sm:text-lg font-bold font-mono mt-1 block ${
                        opnameStats.netFinancialIDR < 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : opnameStats.netFinancialIDR > 0
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {formatIDR(opnameStats.netFinancialIDR)}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {opnameStats.netVarianceQty > 0 ? `+${opnameStats.netVarianceQty}` : opnameStats.netVarianceQty} net units
                    </span>
                  </div>
                </div>

                {/* Search, Zone/Category Partition & Barcode Scanner Toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={opnameSearch}
                        onChange={(e) => setOpnameSearch(e.target.value)}
                        placeholder="Filter SKU or item..."
                        className={`pl-8 pr-3 py-1.5 text-xs rounded-xl w-44 ${inputClass}`}
                      />
                    </div>

                    <select
                      value={opnameCategoryFilter}
                      onChange={(e) => setOpnameCategoryFilter(e.target.value)}
                      className={`px-3 py-1.5 text-xs rounded-xl ${inputClass}`}
                    >
                      <option value="ALL">All Categories</option>
                      <option value="produce">Fresh Produce</option>
                      <option value="meat_seafood">Meat &amp; Seafood</option>
                      <option value="dairy_eggs">Dairy &amp; Eggs</option>
                      <option value="bakery">Bakery</option>
                      <option value="pantry_coffee">Pantry &amp; Coffee</option>
                    </select>

                    <select
                      value={opnameZoneFilter}
                      onChange={(e) => setOpnameZoneFilter(e.target.value)}
                      className={`px-3 py-1.5 text-xs rounded-xl font-mono ${inputClass}`}
                    >
                      <option value="ALL">All Zones / Racks</option>
                      {opnameAvailableZones.map((z) => (
                        <option key={z} value={z}>
                          {z}
                        </option>
                      ))}
                    </select>

                    <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-slate-800/80 text-[11px] font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isPartialCycleMode}
                        onChange={(e) => setIsPartialCycleMode(e.target.checked)}
                        className="rounded border-gray-300 text-[#0F4C3A] focus:ring-[#0F4C3A]"
                      />
                      <span>Partial Cycle ({filteredOpnameTiers.length}/{opnameStoreTiers.length} SKUs)</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowOpnameBarcodeScanner((v) => !v)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        showOpnameBarcodeScanner
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : isLight
                          ? 'bg-white border-emerald-300 text-[#0F4C3A] hover:bg-emerald-50'
                          : 'bg-slate-900/90 border-emerald-700 text-emerald-300 hover:bg-slate-800'
                      }`}
                    >
                      <Barcode className="w-3.5 h-3.5" />
                      <span>{showOpnameBarcodeScanner ? 'Hide Scanner' : 'Quick Barcode Scan'}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const resetCounts: Record<string, number> = {};
                        filteredOpnameTiers.forEach((t) => {
                          resetCounts[t.sku] = t.physicalStock;
                        });
                        setOpnameItems(resetCounts);
                        onShowToast('Counts Matched', 'All physical inputs set to match system book levels.');
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        isLight
                          ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                          : 'bg-slate-900/90 border-slate-800/80 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      Match All to System
                    </button>

                    <button
                      onClick={handleExecuteOpname}
                      disabled={isReconciling || !canMutateStock}
                      className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {isReconciling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileCheck2 className="w-4 h-4" />}
                      <span>
                        {!canMutateStock
                          ? 'Read-Only Mode'
                          : isPartialCycleMode || opnameCategoryFilter !== 'ALL' || opnameZoneFilter !== 'ALL' || opnameSearch.trim().length > 0
                          ? `Post Partial Cycle (${filteredOpnameTiers.length} SKUs)`
                          : 'Post GL Reconciliations'}
                      </span>
                    </button>
                  </div>
                </div>

                {showOpnameBarcodeScanner && (
                  <QuickBarcodeScannerBar
                    theme={theme}
                    title="Stock Opname Quick Barcode / QR Scanner Mode"
                    sampleCodes={filteredOpnameTiers.slice(0, 4).map((t) => {
                      const invMatch = INITIAL_INVENTORY.find((i) => i.sku === t.sku);
                      return {
                        label: t.productName.split(' ').slice(0, 2).join(' '),
                        code: invMatch?.barcode || t.sku,
                      };
                    })}
                    onScan={(code, mode) => {
                      const q = code.toLowerCase();
                      const matchedTier = filteredOpnameTiers.find((t) => {
                        const invMatch = INITIAL_INVENTORY.find((i) => i.sku === t.sku);
                        return (
                          t.sku.toLowerCase() === q ||
                          (invMatch?.barcode && invMatch.barcode.toLowerCase() === q)
                        );
                      });
                      if (!matchedTier) {
                        return { matched: false, detail: `No SKU in active partition matched "${code}"` };
                      }
                      const cur =
                        opnameItems[matchedTier.sku] !== undefined
                          ? opnameItems[matchedTier.sku]
                          : matchedTier.physicalStock;
                      const nextVal = Math.max(0, Number((mode === 'increment' ? cur + 1 : cur - 1).toFixed(2)));
                      setOpnameItems((prev) => ({ ...prev, [matchedTier.sku]: nextVal }));
                      return {
                        matched: true,
                        label: `${matchedTier.productName} (${matchedTier.sku})`,
                        detail: `Physical Count = ${nextVal} ${matchedTier.unit}`,
                      };
                    }}
                  />
                )}

                {/* Stocktake Itemized Table with Live Surplus/Deficit Calculations */}
                <div className="overflow-x-auto rounded-xl border border-gray-200/90 dark:border-slate-800/80">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className={`border-b text-[11px] font-bold tracking-wider uppercase ${
                        isLight ? 'bg-gray-50/80 text-gray-500 border-gray-200' : 'bg-[#090A0F] text-slate-400 border-slate-800/80'
                      }`}>
                        <th className="py-3 px-3.5">SKU &amp; Product</th>
                        <th className="py-3 px-3">Storage Zone</th>
                        <th className="py-3 px-3 text-center">System Book</th>
                        <th className="py-3 px-3 text-center">Physical Count</th>
                        <th className="py-3 px-3 text-center">Variance (Units)</th>
                        <th className="py-3 px-3 text-center">Surplus / Deficit Status</th>
                        <th className="py-3 px-3 text-right">Cost Variance (IDR)</th>
                        <th className="py-3 px-3">Auditor Notes</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isLight ? 'divide-gray-100' : 'divide-slate-800/80'}`}>
                      {filteredOpnameTiers.map((tier) => {
                        const counted = opnameItems[tier.sku] !== undefined ? opnameItems[tier.sku] : tier.physicalStock;
                        const variance = Number((counted - tier.physicalStock).toFixed(2));
                        const varianceCost = Math.round(variance * tier.unitCost);
                        const isSurplus = variance > 0;
                        const isShortage = variance < 0;

                        return (
                          <tr
                            key={tier.id || `${tier.storeId}-${tier.sku}`}
                            className={`transition-colors ${
                              isShortage
                                ? 'bg-rose-500/5'
                                : isSurplus
                                ? 'bg-blue-500/5'
                                : isLight
                                ? 'hover:bg-gray-50/60'
                                : 'hover:bg-slate-900/60'
                            }`}
                          >
                            <td className="py-3 px-3.5">
                              <span className="font-mono text-[10px] text-gray-400 block">{tier.sku}</span>
                              <span className={`font-semibold ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                                {tier.productName}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                              {tier.warehouseZoneId}
                            </td>
                            <td className="py-3 px-3 text-center font-mono font-bold">
                              {tier.physicalStock} {tier.unit}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <input
                                type="number"
                                min={0}
                                max={9999}
                                value={counted}
                                onChange={(e) => {
                                  const val = Math.max(0, Number(e.target.value) || 0);
                                  setOpnameItems((prev) => ({ ...prev, [tier.sku]: val }));
                                }}
                                className={`w-20 px-2.5 py-1 text-center font-mono font-bold text-xs rounded-lg border ${inputClass}`}
                              />
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                                  isShortage
                                    ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                                    : isSurplus
                                    ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                                    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                }`}
                              >
                                {variance > 0 ? `+${variance}` : variance}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              {isSurplus && (
                                <span className="inline-flex items-center gap-1 whitespace-nowrap px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
                                  <TrendingUp className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                  LEBIH (+{variance} {tier.unit})
                                </span>
                              )}
                              {isShortage && (
                                <span className="inline-flex items-center gap-1 whitespace-nowrap px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-500/30">
                                  <TrendingDown className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                                  KURANG ({variance} {tier.unit})
                                </span>
                              )}
                              {!isSurplus && !isShortage && (
                                <span className="inline-flex items-center gap-1 whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700 dark:bg-slate-900/90 dark:text-slate-300 border border-gray-200 dark:border-slate-800/80">
                                  <Check className="w-3 h-3 text-emerald-500" />
                                  SESUAI (0)
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold">
                              <span className={isShortage ? 'text-rose-600 dark:text-rose-400' : isSurplus ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}>
                                {isSurplus ? `+${formatIDR(varianceCost)} (Lebih)` : isShortage ? `${formatIDR(varianceCost)} (Kurang)` : 'Rp 0'}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <input
                                type="text"
                                value={opnameNotes[tier.sku] || ''}
                                onChange={(e) => setOpnameNotes({ ...opnameNotes, [tier.sku]: e.target.value })}
                                placeholder="Audit note..."
                                className={`w-full px-2 py-1 text-[11px] rounded-lg ${inputClass}`}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* History of Past Stock Opname Sessions */}
              {opnameSessions.length > 0 && (
                <div className={`${cardClass} p-5 space-y-4`}>
                  <h4 className={`text-sm font-bold ${isLight ? 'text-gray-900' : 'text-slate-100'} flex items-center gap-2`}>
                    <FileCheck2 className="w-4 h-4 text-emerald-600" />
                    Past Physical Stocktake Audit Logs
                  </h4>
                  <div className="space-y-3">
                    {opnameSessions.map((session) => (
                      <div key={session.id} className={`${subCardClass} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs">{session.id}</span>
                            <span className="text-xs font-semibold">{session.storeName}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold uppercase">
                              {session.status}
                            </span>
                          </div>
                          <p className={`text-[11px] mt-0.5 ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                            Audited by {session.auditorName || 'System'} • {session.items?.length || 0} items counted • Variance: {session.totalVarianceUnits ?? 0} units ({formatIDR(session.netFinancialVarianceIDR ?? 0)})
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-gray-500">
                            GL: {session.glEntryIds?.length ? session.glEntryIds.join(', ') : 'N/A'}
                          </span>
                        </div>
                      </div>
                    ))}
                    </div>
                  </div>
                )}
                </>
              )}
            </div>
          )}

          {/* 3B: DRAFT-FIRST BULK INVENTORY IMPORT (CSV / EXCEL -> REVIEW & EDIT -> APPLY) */}
          {opnameSubTab === 'bulk_import' && (
            <div className="space-y-6">
              <div className={`${cardClass} p-5 sm:p-6 space-y-5`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-gray-100 dark:border-slate-800/80">
                  <div>
                    <h3 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-slate-100'} flex items-center gap-2`}>
                      <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      Bulk Inventory &amp; Stock Matrix Import
                    </h3>
                    <p className={`text-xs mt-0.5 ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                      Upload .CSV / .XLSX or paste rows to stage a safe DRAFT batch. Review and edit Rack, Qty, Lot, Expiry &amp; Serial Numbers (SN) before applying to live stock &amp; COA #1040.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={bulkImportFileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                      onChange={handleBulkImportFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => bulkImportFileInputRef.current?.click()}
                      disabled={isStagingDraft || !canMutateStock}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#0F4C3A] hover:bg-[#0b382b] text-white shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload File (.CSV / .XLSX)</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleLoadSampleCsv}
                      disabled={isStagingDraft}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer disabled:opacity-50 ${
                        isLight
                          ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                          : 'bg-slate-900/90 border-slate-800/80 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Load Sample Template</span>
                    </button>
                  </div>
                </div>

                {/* Outlet Target Selector */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className={labelClass}>Assign Target Receiving Outlet:</label>
                    <select
                      disabled={isBranchScoped}
                      value={isBranchScoped ? lockedBranchId : importTargetStoreId}
                      onChange={(e) => {
                        if (isBranchScoped) return;
                        setImportTargetStoreId(e.target.value);
                        if (csvText) handleParseCsv(csvText);
                      }}
                      className={`px-3 py-1.5 text-xs rounded-xl font-bold ${inputClass} ${
                        isBranchScoped ? 'opacity-75 cursor-not-allowed' : ''
                      }`}
                    >
                      {storeOutlets
                        .filter((st) => !isBranchScoped || st.storeId === lockedBranchId)
                        .map((st) => (
                          <option key={st.storeId} value={st.storeId}>
                            {st.storeName} ({st.city})
                          </option>
                        ))}
                    </select>
                  </div>

                  {importDraftsList.some((d) => d.status === 'DRAFT') && (
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-semibold ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                        Staged Drafts:
                      </span>
                      <select
                        value={activeImportDraft?.id || ''}
                        onChange={(e) => {
                          const found = importDraftsList.find((d) => d.id === e.target.value) || null;
                          syncActiveDraftState(found);
                          if (found) setImportTargetStoreId(found.storeId);
                        }}
                        className={`px-2.5 py-1 text-xs rounded-lg font-mono ${inputClass}`}
                      >
                        <option value="">-- Select Draft --</option>
                        {importDraftsList
                          .filter((d) => d.status === 'DRAFT')
                          .map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.id} ({d.summary.totalRows} rows · {d.storeName})
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* CSV Paste Textarea */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className={labelClass}>
                      Paste CSV Content (Columns: SKU, Product Name, Category, Stock, Unit Cost, Selling Price, Min Threshold, Unit, Supplier, Rack Location, Lot Number, Expiry Date, Serial Numbers)
                    </label>
                    {parsedImportRows.length > 0 && (
                      <button
                        type="button"
                        onClick={handleStagePastedCsvAsDraft}
                        disabled={isStagingDraft || !canMutateStock}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {isStagingDraft ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileCheck2 className="w-3.5 h-3.5" />}
                        <span>Stage {parsedImportRows.length} Row(s) as Draft</span>
                      </button>
                    )}
                  </div>
                  <textarea
                    rows={5}
                    value={csvText}
                    onChange={(e) => handleParseCsv(e.target.value)}
                    placeholder="SKU,Product Name,Category,Physical Stock,Unit Cost,Selling Price,Min Threshold,Unit,Supplier,Rack Location,Lot Number,Expiry Date,Serial Numbers (SN)&#10;SKU-PRD-001,Organic Lettuce,produce,50,11000,18500,20,head,Kebun Lembang,CHILL-A1,LOT-IMP-20261120-01,2026-12-04,SN-001;SN-002"
                    className={`w-full font-mono text-xs p-3 rounded-xl ${inputClass}`}
                  />
                </div>

                {/* DRAFT STAGING & INLINE REVIEW TABLE */}
                {activeImportDraft && activeImportDraft.status === 'DRAFT' && (() => {
                  const newCount = draftEditableRows.filter((r) => r.status === 'NEW_SKU').length;
                  const restockCount = draftEditableRows.filter((r) => r.status === 'RESTOCK').length;
                  const errorCount = draftEditableRows.filter((r) => r.status === 'VALIDATION_ERROR').length;
                  const totalUnits = draftEditableRows.reduce((s, r) => s + Math.max(0, Number(r.physicalStock) || 0), 0);
                  const totalValIDR = draftEditableRows.reduce(
                    (s, r) => s + (r.status === 'VALIDATION_ERROR' ? 0 : Math.round((Number(r.physicalStock) || 0) * (Number(r.unitCost) || 0))),
                    0
                  );
                  const est1040IDR = draftEditableRows.reduce(
                    (s, r) =>
                      s +
                      (r.status === 'VALIDATION_ERROR' || (r.itemClassification && r.itemClassification !== 'MERCHANDISE')
                        ? 0
                        : Math.round((Number(r.physicalStock) || 0) * (Number(r.unitCost) || 0))),
                    0
                  );
                  const est1510IDR = draftEditableRows.reduce(
                    (s, r) =>
                      s +
                      (r.status === 'VALIDATION_ERROR' || r.itemClassification !== 'FIXED_ASSET'
                        ? 0
                        : Math.round((Number(r.physicalStock) || 0) * (Number(r.unitCost) || 0))),
                    0
                  );
                  const est1050IDR = draftEditableRows.reduce(
                    (s, r) =>
                      s +
                      (r.status === 'VALIDATION_ERROR' || r.itemClassification !== 'CONSUMABLE'
                        ? 0
                        : Math.round((Number(r.physicalStock) || 0) * (Number(r.unitCost) || 0))),
                    0
                  );

                  return (
                    <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-slate-800/80">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            DRAFT STAGING
                          </span>
                          <span className={`text-xs font-mono font-bold ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                            {activeImportDraft.id}
                          </span>
                          {activeImportDraft.sourceFilename && (
                            <span className={`text-[11px] font-mono ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                              ({activeImportDraft.sourceFilename})
                            </span>
                          )}
                          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                            {newCount} New SKU
                          </span>
                          <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-400">
                            {restockCount} Restock
                          </span>
                          {errorCount > 0 && (
                            <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                              {errorCount} Error(s)
                            </span>
                          )}
                          <span className={`text-[11px] font-mono ${isLight ? 'text-gray-600' : 'text-slate-300'}`}>
                            · {totalUnits.toLocaleString('id-ID')} units · Total {formatIDR(totalValIDR)}
                            {est1040IDR > 0 ? ` (#1040: ${formatIDR(est1040IDR)})` : ''}
                            {est1510IDR > 0 ? ` (#1510: ${formatIDR(est1510IDR)})` : ''}
                            {est1050IDR > 0 ? ` (#1050: ${formatIDR(est1050IDR)})` : ''}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={handleSaveDraftEdits}
                            disabled={isSavingDraft || isApplyingDraft || !canMutateStock}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all disabled:opacity-50 cursor-pointer ${
                              isLight
                                ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                                : 'bg-slate-900/90 border-slate-800/80 text-slate-200 hover:bg-slate-800'
                            }`}
                          >
                            {isSavingDraft ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            <span>Save Draft</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleDiscardImportDraft}
                            disabled={isDiscardingDraft || isApplyingDraft}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all disabled:opacity-50 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Discard Draft</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleApplyImportDraft}
                            disabled={
                              isApplyingDraft ||
                              isImporting ||
                              !canMutateStock ||
                              errorCount > 0 ||
                              draftEditableRows.length === 0
                            }
                            className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                          >
                            {isApplyingDraft ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            <span>{canMutateStock ? 'Apply Draft to Live Inventory' : 'Read-Only Mode'}</span>
                          </button>
                        </div>
                      </div>

                      {bulkImportDiagnosticReport && (bulkImportDiagnosticReport.errorCount > 0 || bulkImportDiagnosticReport.warningCount > 0) && (
                        <div className="p-3 rounded-xl border border-amber-300 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/25 space-y-1.5 text-[11px]">
                          <div className="flex items-center justify-between gap-2 font-bold text-amber-900 dark:text-amber-300">
                            <span>
                              Import Diagnostic Analysis ({bulkImportDiagnosticReport.errorCount} error / {bulkImportDiagnosticReport.warningCount} warning)
                            </span>
                            <button
                              type="button"
                              onClick={() => setBulkImportDiagnosticReport(null)}
                              className="text-[10px] underline cursor-pointer"
                            >
                              Dismiss
                            </button>
                          </div>
                          {bulkImportDiagnosticReport.issues.slice(0, 6).map((iss, idx) => (
                            <div key={idx} className="space-y-0.5 text-slate-700 dark:text-slate-200">
                              <div>
                                <span className="font-mono font-bold text-rose-700 dark:text-rose-300">[{iss.errorType}]</span>{' '}
                                <span className="font-semibold">{iss.reference}:</span> {iss.rootCause}
                              </div>
                              <div className="text-emerald-800 dark:text-emerald-300">
                                Remediation: {iss.remediationHint}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800/80">
                        <table className="w-full text-left text-xs">
                          <thead className={`border-b text-[10px] uppercase font-bold ${
                            isLight ? 'bg-gray-50 text-gray-500' : 'bg-[#090A0F] text-slate-400 border-slate-800/80'
                          }`}>
                            <tr>
                              <th className="py-2.5 px-2.5">Status</th>
                              <th className="py-2.5 px-2.5">SKU &amp; Product</th>
                              <th className="py-2.5 px-2.5">Class (COA)</th>
                              <th className="py-2.5 px-2.5">Rack / Bin</th>
                              <th className="py-2.5 px-2.5">Qty</th>
                              <th className="py-2.5 px-2.5">Lot / Batch</th>
                              <th className="py-2.5 px-2.5">Expiry Date</th>
                              <th className="py-2.5 px-2.5">Serial Numbers (SN)</th>
                              <th className="py-2.5 px-2.5">Unit Cost</th>
                              <th className="py-2.5 px-2.5">Selling Price</th>
                              <th className="py-2.5 px-2.5 text-center">Del</th>
                            </tr>
                          </thead>
                          <tbody className={`divide-y ${isLight ? 'divide-gray-100' : 'divide-slate-800/80'}`}>
                            {draftEditableRows.map((row) => (
                              <tr
                                key={row.rowId}
                                className={
                                  row.status === 'VALIDATION_ERROR'
                                    ? 'bg-rose-50/60 dark:bg-rose-950/20'
                                    : isLight
                                    ? 'hover:bg-gray-50'
                                    : 'hover:bg-slate-900/60'
                                }
                              >
                                <td className="py-2 px-2.5 align-top whitespace-nowrap">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                                      row.status === 'NEW_SKU'
                                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                        : row.status === 'RESTOCK'
                                        ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400'
                                        : 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
                                    }`}
                                  >
                                    {row.status === 'NEW_SKU'
                                      ? 'NEW SKU'
                                      : row.status === 'RESTOCK'
                                      ? 'RESTOCK'
                                      : 'VALIDATION ERROR'}
                                  </span>
                                  {row.validationError && (
                                    <div className="text-[10px] text-rose-600 dark:text-rose-400 mt-1 max-w-[140px] leading-tight">
                                      {row.validationError}
                                    </div>
                                  )}
                                </td>
                                <td className="py-2 px-2.5 align-top min-w-[170px]">
                                  <div className="font-mono font-bold text-[#0F4C3A] dark:text-emerald-400">{row.sku}</div>
                                  <div className={`text-[11px] font-medium truncate max-w-[190px] ${isLight ? 'text-gray-800' : 'text-slate-200'}`}>
                                    {row.productName}
                                  </div>
                                  <div className={`text-[10px] ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                                    {row.category} · {row.unit}
                                  </div>
                                </td>
                                <td className="py-2 px-2 align-top">
                                  <select
                                    value={row.itemClassification || 'MERCHANDISE'}
                                    onChange={(e) =>
                                      handleDraftRowFieldChange(
                                        row.rowId,
                                        'itemClassification',
                                        e.target.value as ItemClassification
                                      )
                                    }
                                    className={`w-32 px-2 py-1 text-[11px] font-semibold rounded-lg ${inputClass}`}
                                  >
                                    <option value="MERCHANDISE">Merch (#1040)</option>
                                    <option value="FIXED_ASSET">Fixed Asset (#1510)</option>
                                    <option value="CONSUMABLE">Consumable (#1050)</option>
                                  </select>
                                </td>
                                <td className="py-2 px-2 align-top">
                                  <input
                                    type="text"
                                    value={row.rackLocation}
                                    onChange={(e) =>
                                      handleDraftRowFieldChange(row.rowId, 'rackLocation', e.target.value.toUpperCase())
                                    }
                                    className={`w-24 px-2 py-1 text-[11px] font-mono rounded-lg ${inputClass}`}
                                    placeholder="RACK-GEN-01"
                                  />
                                </td>
                                <td className="py-2 px-2 align-top">
                                  <input
                                    type="number"
                                    min={1}
                                    step="1"
                                    value={row.physicalStock}
                                    onChange={(e) =>
                                      handleDraftRowFieldChange(row.rowId, 'physicalStock', Number(e.target.value))
                                    }
                                    className={`w-16 px-2 py-1 text-[11px] font-mono text-right rounded-lg ${inputClass}`}
                                  />
                                </td>
                                <td className="py-2 px-2 align-top">
                                  <input
                                    type="text"
                                    value={row.lotNumber}
                                    onChange={(e) =>
                                      handleDraftRowFieldChange(row.rowId, 'lotNumber', e.target.value)
                                    }
                                    className={`w-36 px-2 py-1 text-[11px] font-mono rounded-lg ${inputClass}`}
                                  />
                                </td>
                                <td className="py-2 px-2 align-top">
                                  <input
                                    type="date"
                                    value={row.expiryDate}
                                    onChange={(e) =>
                                      handleDraftRowFieldChange(row.rowId, 'expiryDate', e.target.value)
                                    }
                                    className={`w-32 px-2 py-1 text-[11px] font-mono rounded-lg ${inputClass}`}
                                  />
                                </td>
                                <td className="py-2 px-2 align-top">
                                  <input
                                    type="text"
                                    value={draftSnTextMap[row.rowId] ?? row.serialNumbers.join(', ')}
                                    onChange={(e) => handleDraftSnChange(row.rowId, e.target.value)}
                                    placeholder="Optional: SN-01, SN-02"
                                    className={`w-36 px-2 py-1 text-[11px] font-mono rounded-lg ${inputClass}`}
                                  />
                                </td>
                                <td className="py-2 px-2 align-top">
                                  <input
                                    type="number"
                                    min={0}
                                    step={500}
                                    value={row.unitCost}
                                    onChange={(e) =>
                                      handleDraftRowFieldChange(row.rowId, 'unitCost', Math.round(Number(e.target.value) || 0))
                                    }
                                    className={`w-24 px-2 py-1 text-[11px] font-mono text-right rounded-lg ${inputClass}`}
                                  />
                                </td>
                                <td className="py-2 px-2 align-top">
                                  <input
                                    type="number"
                                    min={0}
                                    step={500}
                                    value={row.sellingPrice}
                                    onChange={(e) =>
                                      handleDraftRowFieldChange(row.rowId, 'sellingPrice', Math.round(Number(e.target.value) || 0))
                                    }
                                    className={`w-24 px-2 py-1 text-[11px] font-mono text-right rounded-lg ${inputClass}`}
                                  />
                                </td>
                                <td className="py-2 px-2 align-top text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveDraftRow(row.rowId)}
                                    title="Remove row from draft"
                                    className="p-1 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}

                {/* Recent Applied Drafts History */}
                {importDraftsList.some((d) => d.status === 'APPLIED') && (
                  <div className="pt-3 border-t border-gray-100 dark:border-slate-800/80 space-y-2">
                    <div className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                      Recently Applied Import Batches
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {importDraftsList
                        .filter((d) => d.status === 'APPLIED')
                        .slice(0, 4)
                        .map((d) => (
                          <div
                            key={d.id}
                            className={`px-3 py-2 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                              isLight ? 'bg-gray-50 border-gray-200' : 'bg-[#090A0F] border-slate-800/80'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="font-mono font-bold text-[#0F4C3A] dark:text-emerald-400 truncate">
                                {d.id} · {d.storeName}
                              </div>
                              <div className={`text-[11px] ${isLight ? 'text-gray-600' : 'text-slate-400'}`}>
                                {d.summary.totalRows} rows · {d.appliedMeta?.createdBatchesCount ?? d.summary.totalRows} lots · {formatIDR(d.appliedMeta?.totalValuationIDR ?? d.summary.totalValuationIDR)}
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 shrink-0">
                              APPLIED
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. INTER-WAREHOUSE STOCK TRANSFERS (PREVENTS GLOBAL INVENTORY BLEED) */}
      {/* ========================================================================= */}
      {activeSubTab === 'transfer' && (
        <div className="space-y-6 animate-fadeIn">
          <div className={`${cardClass} p-5 sm:p-6 space-y-6`}>
            {standaloneMode !== 'transfer' && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100 dark:border-slate-800/80 min-w-0">
                <div className="min-w-0 flex-1">
                  <h2 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-slate-100'} flex flex-wrap items-center gap-2 break-words`}>
                    <ArrowRightLeft className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span>Official Inter-Warehouse Stock Transfer &amp; Allocation</span>
                  </h2>
                  <p className={`text-xs mt-0.5 break-words ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                    Safely relocate inventory stock between store outlets with double-sign-off audit trail. Strictly isolates quantities to eliminate multi-warehouse inventory overlap bleed.
                  </p>
                </div>
              </div>
            )}

            {/* Transfer Action Card */}
            <div className={subCardClass}>
              <h3 className={`text-xs font-bold uppercase tracking-wider mb-4 ${isLight ? 'text-gray-700' : 'text-slate-300'}`}>
                Initiate New Stock Reallocation
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className={labelClass}>Select Product SKU</label>
                  <select
                    value={transferSku}
                    onChange={(e) => setTransferSku(e.target.value)}
                    className={`w-full ${inputClass}`}
                  >
                    {uniqueTransferSkuTiers.map((t, idx) => (
                      <option key={`${t.sku}-${idx}`} value={t.sku}>
                        {t.sku} - {t.productName} ({t.category})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Source Outlet (Deduct)</label>
                  <select
                    value={transferSourceStore}
                    onChange={(e) => setTransferSourceStore(e.target.value)}
                    className={`w-full ${inputClass}`}
                  >
                    {storeOutlets.map((st) => (
                      <option key={st.storeId} value={st.storeId}>
                        {st.storeName} ({st.city})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Destination Outlet (Receive)</label>
                  <select
                    value={transferDestStore}
                    onChange={(e) => setTransferDestStore(e.target.value)}
                    className={`w-full ${inputClass}`}
                  >
                    {storeOutlets.map((st) => (
                      <option key={st.storeId} value={st.storeId}>
                        {st.storeName} ({st.city})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Transfer Quantity</label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={transferQty}
                    onChange={(e) => setTransferQty(Math.max(1, Number(e.target.value) || 1))}
                    className={`w-full ${inputClass}`}
                  />
                </div>
              </div>

              {/* Secondary Non-Inventory Returnable Asset & Packaging Tracking */}
              <div className="mt-4 pt-3 border-t border-gray-200/80 dark:border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>Returnable Asset Type (Non-Inventory)</label>
                  <select
                    value={transferAssetType}
                    onChange={(e) => setTransferAssetType(e.target.value)}
                    className={`w-full ${inputClass}`}
                  >
                    <option value="NONE">None / Standard Carton</option>
                    <option value="KRAT_PLASTIK_BUAH">Plastic Crates (Krat Plastik)</option>
                    <option value="PALLET_KAYU_B2B">Warehouse Pallets</option>
                    <option value="COLD_CHAIN_THERMAL_BOX">Cold-Chain Boxes</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Asset IDs / Tag Serials</label>
                  <input
                    type="text"
                    disabled={transferAssetType === 'NONE'}
                    value={transferAssetIds}
                    onChange={(e) => setTransferAssetIds(e.target.value)}
                    placeholder={transferAssetType === 'NONE' ? 'Select asset type to link IDs...' : 'e.g. KRT-041, KRT-042'}
                    className={`w-full font-mono text-xs ${inputClass} disabled:opacity-50`}
                  />
                </div>
                <div>
                  <label className={labelClass}>Returnable Asset Qty</label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    disabled={transferAssetType === 'NONE'}
                    value={transferAssetQty}
                    onChange={(e) => setTransferAssetQty(Math.max(1, Number(e.target.value) || 1))}
                    className={`w-full font-mono ${inputClass} disabled:opacity-50`}
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <input
                  type="text"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  placeholder="Transfer notes (e.g. Refrigerated sprinter dispatch #42)..."
                  className={`w-full sm:w-96 text-xs ${inputClass}`}
                />

                <button
                  onClick={handleExecuteTransfer}
                  disabled={isTransferring || !canMutateStock}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                >
                  {isTransferring ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  <span>{canMutateStock ? 'Execute Inter-Store Transfer' : 'Read-Only Mode'}</span>
                </button>
              </div>
            </div>

            {/* Dedicated Transfer Tracking Report */}
            <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-slate-800/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                    <Truck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    Internal Transfer Logistics &amp; Tracking Report
                  </h4>
                  <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                    Formal custody handoff audit trail, delivery documentation &amp; store stock reconciliation
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={transferFilterStatus}
                    onChange={(e) => setTransferFilterStatus(e.target.value)}
                    className={`px-3 py-1.5 text-xs rounded-xl ${inputClass}`}
                  >
                    <option value="ALL">All Transfer Statuses</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="IN_TRANSIT">In Transit</option>
                  </select>
                </div>
              </div>

              {/* Transfer Metrics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className={subCardClass}>
                  <span className="text-[11px] text-gray-500 font-semibold block">Total Reallocations</span>
                  <span className={`text-base sm:text-lg font-bold font-mono mt-1 block ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                    {transferRecords.length} records
                  </span>
                </div>
                <div className={subCardClass}>
                  <span className="text-[11px] text-gray-500 font-semibold block">Total Units Moved</span>
                  <span className="text-base sm:text-lg font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-1 block">
                    {transferRecords.reduce((sum, t) => sum + t.quantity, 0)} units
                  </span>
                </div>
                <div className={subCardClass}>
                  <span className="text-[11px] text-gray-500 font-semibold block">Reallocated Inventory Value</span>
                  <span className="text-base sm:text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1 block">
                    {formatIDR(transferRecords.reduce((sum, t) => sum + (t.totalTransferValue || 0), 0))}
                  </span>
                </div>
                <div className={subCardClass}>
                  <span className="text-[11px] text-gray-500 dark:text-slate-400 font-semibold block">Active In-Transit / Returnable Pool</span>
                  <span className="text-base sm:text-lg font-bold font-mono text-blue-600 dark:text-blue-400 mt-1 block">
                    {transferRecords.filter((t) => t.status === 'in_transit').length} In Transit
                  </span>
                  <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 mt-0.5 block">
                    {transferRecords.reduce((s, t) => s + (t.returnableAssetOutstanding || 0), 0)} assets out ·{' '}
                    {transferRecords.reduce((s, t) => s + Math.max(0, (t.returnableAssetQty || 0) - (t.returnableAssetOutstanding || 0)), 0)} returned
                  </span>
                </div>
              </div>

              {/* Table of Transfers */}
              {(() => {
                const filteredTransfers = transferRecords.filter((t) => {
                  if (transferFilterStatus === 'ALL') return true;
                  return (t.status || 'completed').toUpperCase() === transferFilterStatus;
                });
                return filteredTransfers.length === 0 ? (
                <p className="text-xs text-slate-600 dark:text-slate-400 font-medium italic p-4 text-center">No transfers match the selected status filter.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200/90 dark:border-slate-800/80">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className={`border-b text-[11px] font-bold tracking-wider uppercase ${
                        isLight ? 'bg-gray-50/80 text-gray-500 border-gray-200' : 'bg-[#090A0F] text-slate-400 border-slate-800/80'
                      }`}>
                        <th className="py-3 px-3.5">Transfer Ref</th>
                        <th className="py-3 px-3">Date &amp; Time</th>
                        <th className="py-3 px-3">SKU &amp; Product</th>
                        <th className="py-3 px-3">From Outlet</th>
                        <th className="py-3 px-3">To Outlet</th>
                        <th className="py-3 px-3 text-center">Quantity</th>
                        <th className="py-3 px-3 text-right">Transfer Valuation</th>
                        <th className="py-3 px-3 text-center">Waybill / Status</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isLight ? 'divide-gray-100' : 'divide-slate-800/80'}`}>
                      {filteredTransfers.map((t) => (
                        <tr
                          key={t.id}
                          className={`transition-colors ${isLight ? 'hover:bg-gray-50/80' : 'hover:bg-slate-900/60'}`}
                        >
                          <td className="py-3 px-3.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {t.id}
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-gray-500">
                            {new Date(t.timestamp).toLocaleDateString()} {new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-mono text-[10px] text-gray-400 block">{t.sku}</span>
                            <span className={`font-semibold ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>{t.productName}</span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                              {t.sourceStoreName}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 dark:text-blue-400">
                              {t.destinationStoreName}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <span className="inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                              {t.quantity} units
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold">
                            {formatIDR(t.totalTransferValue)}
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <div className="inline-flex flex-col items-center gap-1">
                              {t.status === 'in_transit' ? (
                                <div className="inline-flex items-center gap-1.5">
                                  <span className="inline-flex items-center gap-1 whitespace-nowrap px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/25">
                                    IN TRANSIT
                                  </span>
                                  {canConfirmArrivals ? (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          const res = await apiClient.receiveStockTransfer(t.id);
                                          onShowToast('Transfer Received', res.message);
                                          fetchAllSettings();
                                          onRefreshData?.();
                                        } catch (err: any) {
                                          onShowToast('Receive Failed', err?.message || 'Error confirming transfer receipt');
                                        }
                                      }}
                                      className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-[#0F4C3A] hover:bg-[#0b382b] text-white transition-colors cursor-pointer"
                                    >
                                      Confirm Receipt
                                    </button>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-200/70 dark:bg-slate-900/90 text-slate-600 dark:text-slate-300">
                                      Read-Only
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 whitespace-nowrap px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/25">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                  COMPLETED
                                </span>
                              )}

                              {(t.returnableAssetQty || 0) > 0 && (
                                <div className="flex items-center gap-1.5 flex-wrap justify-center">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${
                                      (t.returnableAssetOutstanding || 0) > 0
                                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25'
                                        : 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20'
                                    }`}
                                    title={t.returnableAssetIds ? `Asset IDs: ${t.returnableAssetIds}` : t.returnableAssetType}
                                  >
                                    {(t.returnableAssetOutstanding || 0) > 0
                                      ? `${t.returnableAssetOutstanding}/${t.returnableAssetQty} ${t.returnableAssetType || 'Assets'} Out`
                                      : `Assets Returned (${t.returnableAssetQty})`}
                                  </span>
                                  {(t.returnableAssetOutstanding || 0) > 0 && canMutateStock && (
                                    <button
                                      type="button"
                                      disabled={returningAssetTransferId === t.id}
                                      onClick={async () => {
                                        setReturningAssetTransferId(t.id);
                                        try {
                                          const res = await apiClient.confirmTransferReturnableReturn(t.id);
                                          onShowToast('Return Confirmation Logged', res.message);
                                          fetchAllSettings();
                                          onRefreshData?.();
                                        } catch (err: any) {
                                          onShowToast('Return Failed', err?.message || 'Could not confirm asset return');
                                        } finally {
                                          setReturningAssetTransferId(null);
                                        }
                                      }}
                                      className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-colors cursor-pointer"
                                    >
                                      {returningAssetTransferId === t.id ? 'Returning...' : 'Return Confirmation'}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. APPROVAL WORKFLOW & MATRIX CONFIGURATION TAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'approval_matrix' && (
        <ApprovalMatrixModule
          theme={theme}
          activeStaffSession={activeStaffSession}
          selectedStore="CONSOLIDATED"
          approvalRules={approvalRules}
          approvalQueue={approvalQueue}
          onShowToast={onShowToast}
          onRefreshData={() => {
            fetchAllSettings();
            if (onRefreshData) onRefreshData();
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* 6. EMAIL (SMTP) & WHATSAPP BUSINESS API GATEWAY TAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'communication_gateway' && (
        <CommunicationGatewaySettingsTab
          theme={theme}
          canEditConfig={isSuperAdmin || isCoo}
          onShowToast={onShowToast}
        />
      )}

      {/* ========================================================================= */}
      {/* 7. IMMUTABLE AUDIT TRAIL & OPERATOR PRODUCTIVITY KPIs (COO / SUPER ADMIN) */}
      {/* ========================================================================= */}
      {activeSubTab === 'audit_kpis' && canViewAuditAndKpis && (
        <AuditTrailKpiTab theme={theme} onShowToast={onShowToast} />
      )}
      </div>
    </div>
  );
};
