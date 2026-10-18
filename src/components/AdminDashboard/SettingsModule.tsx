import React, { useState, useEffect } from 'react';
import type {
  ChartOfAccount,
  CoaMappingConfig,
  PosCheckoutConfig,
  PosRoundingRule,
  BulkInventoryImportRow,
  StockOpnameSession,
  StockOpnameItem,
  StockTransferRecord,
  StoreOutletSchedule,
  WarehouseZone,
  StoreInventoryStock,
} from '../../types/index.ts';
import { apiClient } from '../../services/apiClient';
import { formatIDR } from '../../utils/formatters';
import {
  Settings,
  Building2,
  CreditCard,
  Boxes,
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
} from 'lucide-react';

interface SettingsModuleProps {
  theme: 'light' | 'dark';
  chartOfAccounts: ChartOfAccount[];
  storeOutlets: StoreOutletSchedule[];
  warehouseZones: WarehouseZone[];
  inventoryTiers: StoreInventoryStock[];
  onShowToast: (title: string, message: string) => void;
  onRefreshData?: () => void;
}

export const SettingsModule: React.FC<SettingsModuleProps> = ({
  theme,
  chartOfAccounts,
  storeOutlets,
  warehouseZones,
  inventoryTiers,
  onShowToast,
  onRefreshData,
}) => {
  const isLight = theme === 'light';

  // Sub-tabs: 'coa' | 'pos' | 'import_opname' | 'transfer'
  const [activeSubTab, setActiveSubTab] = useState<'coa' | 'pos' | 'import_opname' | 'transfer'>('coa');
  const [opnameSubTab, setOpnameSubTab] = useState<'stocktake' | 'bulk_import'>('stocktake');

  // Loading states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSavingCoa, setIsSavingCoa] = useState<boolean>(false);
  const [isSavingPos, setIsSavingPos] = useState<boolean>(false);
  const [isReconciling, setIsReconciling] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [isTransferring, setIsTransferring] = useState<boolean>(false);

  // 1. COA Mapping State
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
  const [opnameStoreId, setOpnameStoreId] = useState<string>('store-jkt-senopati');
  const [opnameCategoryFilter, setOpnameCategoryFilter] = useState<string>('ALL');
  const [opnameSearch, setOpnameSearch] = useState<string>('');
  const [opnameItems, setOpnameItems] = useState<Record<string, number>>({});
  const [opnameNotes, setOpnameNotes] = useState<Record<string, string>>({});
  const [opnameSessions, setOpnameSessions] = useState<StockOpnameSession[]>([]);

  // 4. Bulk Import State
  const [csvText, setCsvText] = useState<string>('');
  const [parsedImportRows, setParsedImportRows] = useState<BulkInventoryImportRow[]>([]);
  const [importTargetStoreId, setImportTargetStoreId] = useState<string>('store-jkt-senopati');

  // 5. Stock Transfer State
  const [transferRecords, setTransferRecords] = useState<StockTransferRecord[]>([]);
  const [transferSku, setTransferSku] = useState<string>('SKU-PRD-001');
  const [transferSourceStore, setTransferSourceStore] = useState<string>('store-jkt-senopati');
  const [transferDestStore, setTransferDestStore] = useState<string>('store-jkt-pik');
  const [transferQty, setTransferQty] = useState<number>(10);
  const [transferNotes, setTransferNotes] = useState<string>('Weekly stock rebalance');

  // Load configs on mount
  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);
      try {
        const [coaRes, posRes, opnameRes, transferRes] = await Promise.all([
          apiClient.getCoaMapping().catch(() => null),
          apiClient.getPosConfig().catch(() => null),
          apiClient.getStockOpnameSessions().catch(() => []),
          apiClient.getStockTransfers().catch(() => []),
        ]);

        if (coaRes) setCoaConfig(coaRes);
        if (posRes) setPosConfig(posRes);
        if (opnameRes) setOpnameSessions(opnameRes);
        if (transferRes) setTransferRecords(transferRes);
      } catch (err) {
        console.error('Failed to load Settings & Configuration:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
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

  // Handle Parse CSV for Bulk Import
  const handleParseCsv = (rawText: string) => {
    setCsvText(rawText);
    const lines = rawText.trim().split('\n');
    if (lines.length < 2) {
      setParsedImportRows([]);
      return;
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const rows: BulkInventoryImportRow[] = [];

    const store = storeOutlets.find((s) => s.storeId === importTargetStoreId);
    const defaultStoreName = store?.storeName || 'Senopati Flagship';

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim());
      if (parts.length < 3 || !parts[0]) continue;

      const sku = parts[0];
      const name = parts[1] || `Product ${sku}`;
      const category = parts[2] || 'produce';
      const stock = Number(parts[3]) || 50;
      const cost = Number(parts[4]) || 12000;
      const price = Number(parts[5]) || Math.round(cost * 1.5);
      const minThresh = Number(parts[6]) || 10;
      const unit = parts[7] || 'pack';
      const supplier = parts[8] || 'Local Farm Coop';

      rows.push({
        sku,
        productName: name,
        category,
        storeId: importTargetStoreId,
        storeName: defaultStoreName,
        warehouseZoneId: store?.activeWarehouses[0] || 'WH-JKT-SEN-AMB',
        storageType: category === 'produce' || category === 'dairy_eggs' ? 'cold_chilled' : category === 'meat_seafood' ? 'freezer' : 'ambient',
        physicalStock: stock,
        unitCost: cost,
        sellingPrice: price,
        minimumThreshold: minThresh,
        unit,
        supplierName: supplier,
      });
    }

    setParsedImportRows(rows);
  };

  // Sample CSV generator
  const handleLoadSampleCsv = () => {
    const sample = `SKU,Product Name,Category,Physical Stock,Unit Cost (IDR),Selling Price (IDR),Min Threshold,Unit,Supplier
SKU-PRD-001,Organic Hydroponic Butterhead Lettuce,produce,65,11000,18500,20,250g head,Kebun Lembang Eco
SKU-PRD-002,Heirloom Vine-Ripened Sweet Tomatoes,produce,30,14500,24000,15,500g pack,Ciwidey Farmers
SKU-DAI-001,Pastured Free-Range Omega-3 Eggs,dairy_eggs,45,22000,34000,20,10-pack tray,Bogor Pastures
SKU-MEA-001,Grass-Fed Angus Ribeye Steak,meat_seafood,18,78000,125000,10,250g cut,Santosa Prime Butchery
SKU-BAK-001,Artisan Country Sourdough Loaf,bakery,28,24000,40000,10,650g loaf,Heritage Woodfire Oven`;

    handleParseCsv(sample);
  };

  // Commit Bulk Import
  const handleCommitBulkImport = async () => {
    if (parsedImportRows.length === 0) {
      onShowToast('Empty Import', 'Please enter or upload valid CSV rows first.');
      return;
    }

    setIsImporting(true);
    try {
      const res = await apiClient.bulkImportInventory(parsedImportRows);
      if (res.success) {
        onShowToast('Bulk Import Successful', res.message);
        setCsvText('');
        setParsedImportRows([]);
        if (onRefreshData) onRefreshData();
      }
    } catch (err: any) {
      onShowToast('Import Failed', err.message || 'Failed to commit bulk import');
    } finally {
      setIsImporting(false);
    }
  };

  // Handle Execute Stock Opname Reconcile
  const handleExecuteOpname = async () => {
    const targetStore = storeOutlets.find((s) => s.storeId === opnameStoreId);
    const storeName = targetStore?.storeName || 'Senopati Flagship';

    const relevantTiers = inventoryTiers.filter((t) => t.storeId === opnameStoreId);
    if (relevantTiers.length === 0) {
      onShowToast('No Items', `No inventory items mapped to ${storeName}`);
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
        warehouseZoneId: relevantTiers[0]?.warehouseZoneId || 'WH-JKT-SEN-COLD',
        items: payloadItems,
        notes: `Periodic physical stocktake cycle count for ${storeName}`,
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
      const res = await apiClient.transferStock({
        sku: transferSku,
        sourceStoreId: transferSourceStore,
        destinationStoreId: transferDestStore,
        quantity: transferQty,
        notes: transferNotes,
      });

      if (res.success) {
        onShowToast('Stock Transfer Completed', res.message);
        setTransferRecords((prev) => [res.record, ...prev]);
        if (onRefreshData) onRefreshData();
      }
    } catch (err: any) {
      onShowToast('Transfer Error', err.message || 'Failed to execute stock transfer');
    } finally {
      setIsTransferring(false);
    }
  };

  // Filtered stock opname rows
  const filteredOpnameTiers = inventoryTiers
    .filter((t) => t.storeId === opnameStoreId)
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

  // Calculate live opname variance stats
  const opnameStats = React.useMemo(() => {
    let totalSys = 0;
    let totalCounted = 0;
    let netVarianceQty = 0;
    let netFinancialIDR = 0;
    let shortageCount = 0;
    let surplusCount = 0;
    let matchedCount = 0;

    filteredOpnameTiers.forEach((tier) => {
      const sys = tier.physicalStock;
      const counted = opnameItems[tier.sku] !== undefined ? opnameItems[tier.sku] : sys;
      const diff = counted - sys;
      totalSys += sys;
      totalCounted += counted;
      netVarianceQty += diff;
      netFinancialIDR += diff * tier.unitCost;

      if (diff === 0) matchedCount++;
      else if (diff < 0) shortageCount++;
      else surplusCount++;
    });

    return {
      totalSys,
      totalCounted,
      netVarianceQty,
      netFinancialIDR,
      shortageCount,
      surplusCount,
      matchedCount,
    };
  }, [filteredOpnameTiers, opnameItems]);

  // Card styling tokens
  const cardClass = `rounded-2xl border transition-all ${
    isLight
      ? 'bg-white border-gray-200/90 shadow-[0_4px_16px_rgba(0,0,0,0.03)]'
      : 'bg-stone-900/90 border-stone-800 shadow-[0_4px_16px_rgba(0,0,0,0.2)]'
  }`;

  const subCardClass = `rounded-xl border p-4 transition-all ${
    isLight ? 'bg-gray-50/80 border-gray-200 text-gray-900' : 'bg-stone-800/60 border-stone-700/80 text-stone-100'
  }`;

  const inputClass = `px-3.5 py-2 text-xs rounded-xl font-medium transition-all ${
    isLight
      ? 'bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-[#0F4C3A] focus:ring-1 focus:ring-[#0F4C3A]'
      : 'bg-stone-800 border border-stone-700 text-white placeholder:text-stone-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
  }`;

  const labelClass = `block text-xs font-semibold mb-1.5 ${isLight ? 'text-gray-700' : 'text-stone-300'}`;

  return (
    <div className="space-y-6">
      {/* Module Header & Top Breadcrumb */}
      <div className={`${cardClass} p-5 sm:p-6`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-xl bg-[#0F4C3A] text-white shadow-xs shrink-0">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-[#0F4C3A] border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30 uppercase tracking-wider">
                  ERP Hub
                </span>
                <span className={`text-xs ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
                  System Architecture v4.2
                </span>
              </div>
              <h1 className={`text-lg sm:text-xl font-bold mt-1 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                Settings &amp; Configuration Hub
              </h1>
              <p className={`text-xs mt-0.5 max-w-2xl ${isLight ? 'text-gray-600' : 'text-stone-400'}`}>
                Manage dynamic Chart of Accounts (COA) mapping, frontline POS checkout rules (cash rounding, VAT, discounts), and execute periodic physical stocktakes with automatic General Ledger variance adjustments.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-mono px-3 py-1.5 rounded-xl border flex items-center gap-1.5 ${
              isLight ? 'bg-gray-50 border-gray-200 text-gray-700' : 'bg-stone-800 border-stone-700 text-stone-300'
            }`}>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Strict Warehouse Isolation Active
            </span>
          </div>
        </div>

        {/* Primary Sub-Tab Navigation Bar */}
        <div className="flex items-center gap-2 mt-6 pt-5 border-t border-gray-100 dark:border-stone-800 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveSubTab('coa')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'coa'
                ? 'bg-[#0F4C3A] text-white shadow-xs'
                : isLight
                ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                : 'text-stone-400 hover:text-white hover:bg-stone-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Chart of Accounts (COA) Mapping</span>
          </button>

          <button
            onClick={() => setActiveSubTab('pos')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'pos'
                ? 'bg-[#0F4C3A] text-white shadow-xs'
                : isLight
                ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                : 'text-stone-400 hover:text-white hover:bg-stone-800'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>POS &amp; Checkout Rules</span>
          </button>

          <button
            onClick={() => setActiveSubTab('import_opname')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'import_opname'
                ? 'bg-[#0F4C3A] text-white shadow-xs'
                : isLight
                ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                : 'text-stone-400 hover:text-white hover:bg-stone-800'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Inventory Import &amp; Stock Opname</span>
          </button>

          <button
            onClick={() => setActiveSubTab('transfer')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'transfer'
                ? 'bg-[#0F4C3A] text-white shadow-xs'
                : isLight
                ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                : 'text-stone-400 hover:text-white hover:bg-stone-800'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Inter-Warehouse Transfers</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. CHART OF ACCOUNTS (COA) MAPPING TAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'coa' && (
        <div className="space-y-6 animate-fadeIn">
          <div className={`${cardClass} p-5 sm:p-6 space-y-6`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100 dark:border-stone-800">
              <div>
                <h2 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-white'} flex items-center gap-2`}>
                  <Building2 className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                  Dynamic General Ledger &amp; POS Account Mapping
                </h2>
                <p className={`text-xs mt-0.5 ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
                  Configure which accounts are automatically debited and credited during retail checkout, waste disposals, and physical inventory reconciliations.
                </p>
              </div>

              <button
                onClick={handleSaveCoa}
                disabled={isSavingCoa}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-semibold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer self-start sm:self-auto"
              >
                {isSavingCoa ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Save COA Mapping</span>
              </button>
            </div>

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
                  value={coaConfig.posRevenueAccountCode}
                  onChange={(e) => {
                    const found = chartOfAccounts.find((c) => c.accountCode === e.target.value);
                    setCoaConfig({
                      ...coaConfig,
                      posRevenueAccountCode: e.target.value,
                      posRevenueAccountName: found?.accountName || 'Sales Revenue',
                    });
                  }}
                  className={`w-full ${inputClass}`}
                >
                  {chartOfAccounts
                    .filter((c) => c.category === 'Revenue')
                    .map((coa) => (
                      <option key={coa.accountCode} value={coa.accountCode}>
                        [{coa.accountCode}] {coa.accountName} • Bal: {formatIDR(coa.balance)}
                      </option>
                    ))}
                </select>
                <p className={`text-[11px] mt-2 ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
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
                  value={coaConfig.inventoryAssetAccountCode}
                  onChange={(e) => {
                    const found = chartOfAccounts.find((c) => c.accountCode === e.target.value);
                    setCoaConfig({
                      ...coaConfig,
                      inventoryAssetAccountCode: e.target.value,
                      inventoryAssetAccountName: found?.accountName || 'Inventory Asset',
                    });
                  }}
                  className={`w-full ${inputClass}`}
                >
                  {chartOfAccounts
                    .filter((c) => c.category === 'Asset')
                    .map((coa) => (
                      <option key={coa.accountCode} value={coa.accountCode}>
                        [{coa.accountCode}] {coa.accountName} • Bal: {formatIDR(coa.balance)}
                      </option>
                    ))}
                </select>
                <p className={`text-[11px] mt-2 ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
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
                  value={coaConfig.cogsAccountCode}
                  onChange={(e) => {
                    const found = chartOfAccounts.find((c) => c.accountCode === e.target.value);
                    setCoaConfig({
                      ...coaConfig,
                      cogsAccountCode: e.target.value,
                      cogsAccountName: found?.accountName || 'Cost of Goods Sold',
                    });
                  }}
                  className={`w-full ${inputClass}`}
                >
                  {chartOfAccounts
                    .filter((c) => c.category === 'Expense')
                    .map((coa) => (
                      <option key={coa.accountCode} value={coa.accountCode}>
                        [{coa.accountCode}] {coa.accountName} • Bal: {formatIDR(coa.balance)}
                      </option>
                    ))}
                </select>
                <p className={`text-[11px] mt-2 ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
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
                  value={coaConfig.shrinkageExpenseAccountCode}
                  onChange={(e) => {
                    const found = chartOfAccounts.find((c) => c.accountCode === e.target.value);
                    setCoaConfig({
                      ...coaConfig,
                      shrinkageExpenseAccountCode: e.target.value,
                      shrinkageExpenseAccountName: found?.accountName || 'Shrinkage Expense',
                    });
                  }}
                  className={`w-full ${inputClass}`}
                >
                  {chartOfAccounts
                    .filter((c) => c.category === 'Expense')
                    .map((coa) => (
                      <option key={coa.accountCode} value={coa.accountCode}>
                        [{coa.accountCode}] {coa.accountName} • Bal: {formatIDR(coa.balance)}
                      </option>
                    ))}
                </select>
                <p className={`text-[11px] mt-2 ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
                  Debited when stock opname reveals inventory shortages or perishable spoilage.
                </p>
              </div>
            </div>

            {/* Clearing Accounts for Payment Channels */}
            <div className="pt-4 border-t border-gray-100 dark:border-stone-800">
              <h3 className={`text-sm font-bold mb-3 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                Frontline Tender &amp; Clearing Accounts
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Cash Drawer Clearing */}
                <div className={subCardClass}>
                  <label className={labelClass}>Cash Drawer Clearing</label>
                  <select
                    value={coaConfig.cashClearingAccountCode}
                    onChange={(e) => {
                      const found = chartOfAccounts.find((c) => c.accountCode === e.target.value);
                      setCoaConfig({
                        ...coaConfig,
                        cashClearingAccountCode: e.target.value,
                        cashClearingAccountName: found?.accountName || 'Cash Clearing',
                      });
                    }}
                    className={`w-full ${inputClass}`}
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
                    value={coaConfig.qrisClearingAccountCode}
                    onChange={(e) => {
                      const found = chartOfAccounts.find((c) => c.accountCode === e.target.value);
                      setCoaConfig({
                        ...coaConfig,
                        qrisClearingAccountCode: e.target.value,
                        qrisClearingAccountName: found?.accountName || 'QRIS Clearing',
                      });
                    }}
                    className={`w-full ${inputClass}`}
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
                    value={coaConfig.edcClearingAccountCode}
                    onChange={(e) => {
                      const found = chartOfAccounts.find((c) => c.accountCode === e.target.value);
                      setCoaConfig({
                        ...coaConfig,
                        edcClearingAccountCode: e.target.value,
                        edcClearingAccountName: found?.accountName || 'EDC Card Clearing',
                      });
                    }}
                    className={`w-full ${inputClass}`}
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
                <span className={`text-xs font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                  Live Double-Entry Journal Preview (Sample Rp 100.000 POS Sale)
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 bg-white dark:bg-stone-900 rounded-lg border border-gray-200 dark:border-stone-800 space-y-1">
                  <div className="text-[11px] font-bold text-gray-500 uppercase">1. Revenue Recognition:</div>
                  <div className="text-emerald-700 dark:text-emerald-400">Debit [{coaConfig.cashClearingAccountCode}] {coaConfig.cashClearingAccountName}: Rp 100.000</div>
                  <div className="text-teal-700 dark:text-teal-400 pl-4">Credit [{coaConfig.posRevenueAccountCode}] {coaConfig.posRevenueAccountName}: Rp 100.000</div>
                </div>
                <div className="p-3 bg-white dark:bg-stone-900 rounded-lg border border-gray-200 dark:border-stone-800 space-y-1">
                  <div className="text-[11px] font-bold text-gray-500 uppercase">2. Cost of Goods Sold (COGS):</div>
                  <div className="text-amber-700 dark:text-amber-400">Debit [{coaConfig.cogsAccountCode}] {coaConfig.cogsAccountName}: Rp 62.000</div>
                  <div className="text-blue-700 dark:text-blue-400 pl-4">Credit [{coaConfig.inventoryAssetAccountCode}] {coaConfig.inventoryAssetAccountName}: Rp 62.000</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. POS & CHECKOUT RULES CONFIGURATION TAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'pos' && (
        <div className="space-y-6 animate-fadeIn">
          <div className={`${cardClass} p-5 sm:p-6 space-y-6`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100 dark:border-stone-800">
              <div>
                <h2 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-white'} flex items-center gap-2`}>
                  <CreditCard className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  POS &amp; Frontline Cashier Configuration
                </h2>
                <p className={`text-xs mt-0.5 ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
                  Control cash rounding, VAT taxation, maximum cashier discounts, near-expiry Vivo automation, and receipt printing options across all 34 outlets.
                </p>
              </div>

              <button
                onClick={handleSavePosConfig}
                disabled={isSavingPos}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-semibold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer self-start sm:self-auto"
              >
                {isSavingPos ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Save POS Configuration</span>
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
                  value={posConfig.roundingRule}
                  onChange={(e) => setPosConfig({ ...posConfig, roundingRule: e.target.value as PosRoundingRule })}
                  className={`w-full ${inputClass}`}
                >
                  <option value="none">No Rounding (Exact to Rp 1)</option>
                  <option value="nearest_100">Round to Nearest Rp 100 (Standard Retail)</option>
                  <option value="nearest_500">Round to Nearest Rp 500 (Indonesian Coin standard)</option>
                  <option value="nearest_1000">Round to Nearest Rp 1.000</option>
                  <option value="ceil_1000">Ceiling Up to Next Rp 1.000</option>
                </select>
                <p className={`text-[11px] mt-2 ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
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
                    value={posConfig.ppnTaxPercent}
                    onChange={(e) => setPosConfig({ ...posConfig, ppnTaxPercent: Math.max(0, Number(e.target.value) || 0) })}
                    className={`w-28 ${inputClass}`}
                  />
                  <span className="text-xs font-bold text-gray-500">% Standard PPN</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="taxInclusiveCheck"
                    checked={posConfig.isTaxInclusive}
                    onChange={(e) => setPosConfig({ ...posConfig, isTaxInclusive: e.target.checked })}
                    className="w-4 h-4 text-[#0F4C3A] rounded"
                  />
                  <label htmlFor="taxInclusiveCheck" className={`text-xs ${isLight ? 'text-gray-700' : 'text-stone-300'}`}>
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
                    value={posConfig.maxCashierDiscountPercent}
                    onChange={(e) => setPosConfig({ ...posConfig, maxCashierDiscountPercent: Math.max(0, Number(e.target.value) || 0) })}
                    className={`w-28 ${inputClass}`}
                  />
                  <span className="text-xs font-bold text-gray-500">% without Manager PIN</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="managerPinCheck"
                    checked={posConfig.requireManagerPinForVoid}
                    onChange={(e) => setPosConfig({ ...posConfig, requireManagerPinForVoid: e.target.checked })}
                    className="w-4 h-4 text-[#0F4C3A] rounded"
                  />
                  <label htmlFor="managerPinCheck" className={`text-xs ${isLight ? 'text-gray-700' : 'text-stone-300'}`}>
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
                    checked={posConfig.enableVivoNearExpiryDiscount}
                    onChange={(e) => setPosConfig({ ...posConfig, enableVivoNearExpiryDiscount: e.target.checked })}
                    className="w-4 h-4 text-[#0F4C3A] rounded"
                  />
                  <label htmlFor="enableVivoCheck" className={`text-xs font-semibold ${isLight ? 'text-gray-800' : 'text-stone-200'}`}>
                    Enable Automatic Vivo Clearance
                  </label>
                </div>
                <label className={labelClass}>Clearance Discount Rate (%)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={5}
                    max={75}
                    disabled={!posConfig.enableVivoNearExpiryDiscount}
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
                  value={posConfig.cashDrawerFloatIDR}
                  onChange={(e) => setPosConfig({ ...posConfig, cashDrawerFloatIDR: Math.max(0, Number(e.target.value) || 0) })}
                  className={`w-full ${inputClass}`}
                />
                <p className={`text-[11px] mt-2 ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
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
                    value={posConfig.loyaltyPointsPer1000IDR}
                    onChange={(e) => setPosConfig({ ...posConfig, loyaltyPointsPer1000IDR: Math.max(1, Number(e.target.value) || 1) })}
                    className={`w-28 ${inputClass}`}
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
                value={posConfig.storeReceiptFooterText}
                onChange={(e) => setPosConfig({ ...posConfig, storeReceiptFooterText: e.target.value })}
                placeholder="e.g. Thank you for shopping with GroceMart! Follow @grocemart for farm updates."
                className={`w-full ${inputClass}`}
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. INVENTORY BULK IMPORT & STOCK OPNAME TAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'import_opname' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Inner Tab Pill Toggle */}
          <div className="flex items-center gap-2 border-b border-gray-200 dark:border-stone-800 pb-3">
            <button
              onClick={() => setOpnameSubTab('stocktake')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                opnameSubTab === 'stocktake'
                  ? 'bg-[#0F4C3A] text-white shadow-2xs'
                  : isLight
                  ? 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                  : 'bg-stone-800 text-stone-300 border border-stone-700 hover:bg-stone-700'
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
                  : 'bg-stone-800 text-stone-300 border border-stone-700 hover:bg-stone-700'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Bulk Inventory Import (CSV/Excel)</span>
            </button>
          </div>

          {/* 3A: PHYSICAL STOCK OPNAME (STOCKTAKE) */}
          {opnameSubTab === 'stocktake' && (
            <div className="space-y-6">
              <div className={`${cardClass} p-5 sm:p-6 space-y-5`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-white'} flex items-center gap-2`}>
                      <Boxes className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      Periodic Stock Opname &amp; Discrepancy Reconciliation
                    </h3>
                    <p className={`text-xs mt-0.5 ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
                      Audit real-world shelf inventory against system book balances. Discrepancies automatically trigger double-entry Shrinkage Expense adjustments.
                    </p>
                  </div>

                  {/* Store Outlet Selector */}
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-semibold ${isLight ? 'text-gray-700' : 'text-stone-300'}`}>
                      Select Store:
                    </span>
                    <select
                      value={opnameStoreId}
                      onChange={(e) => setOpnameStoreId(e.target.value)}
                      className={`px-3 py-1.5 text-xs rounded-xl font-bold ${inputClass}`}
                    >
                      {storeOutlets.map((st) => (
                        <option key={st.storeId} value={st.storeId}>
                          {st.storeName} ({st.city})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Stocktake Metric Stat Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-2">
                  <div className={subCardClass}>
                    <span className="text-[11px] text-gray-500 font-semibold block">System Book Count</span>
                    <span className={`text-lg font-bold font-mono mt-1 block ${isLight ? 'text-gray-900' : 'text-white'}`}>
                      {opnameStats.totalSys} units
                    </span>
                  </div>

                  <div className={subCardClass}>
                    <span className="text-[11px] text-gray-500 font-semibold block">Physical Counted</span>
                    <span className="text-lg font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-1 block">
                      {opnameStats.totalCounted} units
                    </span>
                  </div>

                  <div className={subCardClass}>
                    <span className="text-[11px] text-gray-500 font-semibold block">Net Variance Units</span>
                    <span
                      className={`text-lg font-bold font-mono mt-1 block ${
                        opnameStats.netVarianceQty < 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : opnameStats.netVarianceQty > 0
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {opnameStats.netVarianceQty > 0 ? `+${opnameStats.netVarianceQty}` : opnameStats.netVarianceQty} units
                    </span>
                  </div>

                  <div className={subCardClass}>
                    <span className="text-[11px] text-gray-500 font-semibold block">Financial Impact (IDR)</span>
                    <span
                      className={`text-lg font-bold font-mono mt-1 block ${
                        opnameStats.netFinancialIDR < 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : opnameStats.netFinancialIDR > 0
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {formatIDR(opnameStats.netFinancialIDR)}
                    </span>
                  </div>
                </div>

                {/* Search & Category Filter Toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-stone-800">
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
                          : 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700'
                      }`}
                    >
                      Match All to System
                    </button>

                    <button
                      onClick={handleExecuteOpname}
                      disabled={isReconciling}
                      className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {isReconciling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileCheck2 className="w-4 h-4" />}
                      <span>Post GL Reconciliations</span>
                    </button>
                  </div>
                </div>

                {/* Stocktake Itemized Table */}
                <div className="overflow-x-auto rounded-xl border border-gray-200/90 dark:border-stone-800">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className={`border-b text-[11px] font-bold tracking-wider uppercase ${
                        isLight ? 'bg-gray-50/80 text-gray-500 border-gray-200' : 'bg-stone-800/60 text-stone-400 border-stone-800'
                      }`}>
                        <th className="py-3 px-3.5">SKU &amp; Product</th>
                        <th className="py-3 px-3">Storage Zone</th>
                        <th className="py-3 px-3 text-center">System Book</th>
                        <th className="py-3 px-3 text-center">Physical Count</th>
                        <th className="py-3 px-3 text-center">Variance (Units)</th>
                        <th className="py-3 px-3 text-right">Cost Variance (IDR)</th>
                        <th className="py-3 px-3">Auditor Notes</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isLight ? 'divide-gray-100' : 'divide-stone-800'}`}>
                      {filteredOpnameTiers.map((tier) => {
                        const counted = opnameItems[tier.sku] !== undefined ? opnameItems[tier.sku] : tier.physicalStock;
                        const variance = Number((counted - tier.physicalStock).toFixed(2));
                        const varianceCost = Math.round(variance * tier.unitCost);

                        return (
                          <tr
                            key={tier.id || `${tier.storeId}-${tier.sku}`}
                            className={`transition-colors ${
                              variance < 0
                                ? 'bg-rose-500/5'
                                : variance > 0
                                ? 'bg-blue-500/5'
                                : isLight
                                ? 'hover:bg-gray-50/60'
                                : 'hover:bg-stone-800/40'
                            }`}
                          >
                            <td className="py-3 px-3.5">
                              <span className="font-mono text-[10px] text-gray-400 block">{tier.sku}</span>
                              <span className={`font-semibold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                                {tier.productName}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-stone-500 font-mono text-[11px]">
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
                                  variance < 0
                                    ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                                    : variance > 0
                                    ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                                    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                }`}
                              >
                                {variance > 0 ? `+${variance}` : variance}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold">
                              <span className={varianceCost < 0 ? 'text-rose-600 dark:text-rose-400' : varianceCost > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}>
                                {formatIDR(varianceCost)}
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
                  <h4 className={`text-sm font-bold ${isLight ? 'text-gray-900' : 'text-white'} flex items-center gap-2`}>
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
                          <p className={`text-[11px] mt-0.5 ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
                            Audited by {session.auditorName} • {session.items.length} items counted • Variance: {session.totalVarianceUnits} units ({formatIDR(session.netFinancialVarianceIDR)})
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-gray-500">
                            GL: {session.glEntryIds.join(', ') || 'N/A'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3B: BULK INVENTORY IMPORT (CSV / EXCEL FORMAT) */}
          {opnameSubTab === 'bulk_import' && (
            <div className="space-y-6">
              <div className={`${cardClass} p-5 sm:p-6 space-y-5`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-gray-100 dark:border-stone-800">
                  <div>
                    <h3 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-white'} flex items-center gap-2`}>
                      <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      Bulk Inventory &amp; Stock Matrix Import
                    </h3>
                    <p className={`text-xs mt-0.5 ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
                      Paste or upload comma-separated inventory records (CSV) to update store warehouse tiers simultaneously without cross-location bleed.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleLoadSampleCsv}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        isLight
                          ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                          : 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700'
                      }`}
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Load Sample Template</span>
                    </button>
                  </div>
                </div>

                {/* Outlet Target Selector */}
                <div className="flex items-center gap-3">
                  <label className={labelClass}>Assign Target Receiving Outlet:</label>
                  <select
                    value={importTargetStoreId}
                    onChange={(e) => {
                      setImportTargetStoreId(e.target.value);
                      if (csvText) handleParseCsv(csvText);
                    }}
                    className={`px-3 py-1.5 text-xs rounded-xl font-bold ${inputClass}`}
                  >
                    {storeOutlets.map((st) => (
                      <option key={st.storeId} value={st.storeId}>
                        {st.storeName} ({st.city})
                      </option>
                    ))}
                  </select>
                </div>

                {/* CSV Textarea */}
                <div>
                  <label className={labelClass}>Paste CSV Content (Format: SKU, Product Name, Category, Stock, Unit Cost, Selling Price, Min Threshold, Unit, Supplier)</label>
                  <textarea
                    rows={6}
                    value={csvText}
                    onChange={(e) => handleParseCsv(e.target.value)}
                    placeholder="SKU,Product Name,Category,Physical Stock,Unit Cost,Selling Price,Min Threshold,Unit,Supplier&#10;SKU-PRD-001,Organic Lettuce,produce,50,11000,18500,20,head,Kebun Lembang"
                    className={`w-full font-mono text-xs p-3 rounded-xl ${inputClass}`}
                  />
                </div>

                {/* Parsed Preview Table */}
                {parsedImportRows.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                        Parsed Preview ({parsedImportRows.length} SKUs ready for import)
                      </span>
                      <button
                        onClick={handleCommitBulkImport}
                        disabled={isImporting}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {isImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        <span>Commit Bulk Import to Warehouse</span>
                      </button>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-stone-800">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className={`border-b text-[10px] uppercase font-bold ${
                          isLight ? 'bg-gray-50 text-gray-500' : 'bg-stone-800 text-stone-400'
                        }`}>
                          <tr>
                            <th className="py-2.5 px-3">SKU</th>
                            <th className="py-2.5 px-3">Product Name</th>
                            <th className="py-2.5 px-3">Category</th>
                            <th className="py-2.5 px-3 text-center">Stock Units</th>
                            <th className="py-2.5 px-3 text-right">Unit Cost</th>
                            <th className="py-2.5 px-3 text-right">Selling Price</th>
                            <th className="py-2.5 px-3 text-center">Min Threshold</th>
                          </tr>
                        </thead>
                        <tbody className={`divide-y ${isLight ? 'divide-gray-100' : 'divide-stone-800'}`}>
                          {parsedImportRows.map((r, i) => (
                            <tr key={i} className={isLight ? 'hover:bg-gray-50' : 'hover:bg-stone-800/40'}>
                              <td className="py-2 px-3 font-bold text-[#0F4C3A] dark:text-emerald-400">{r.sku}</td>
                              <td className="py-2 px-3">{r.productName}</td>
                              <td className="py-2 px-3 text-stone-500">{r.category}</td>
                              <td className="py-2 px-3 text-center font-bold">{r.physicalStock} {r.unit}</td>
                              <td className="py-2 px-3 text-right">{formatIDR(r.unitCost)}</td>
                              <td className="py-2 px-3 text-right">{formatIDR(r.sellingPrice)}</td>
                              <td className="py-2 px-3 text-center text-amber-600">{r.minimumThreshold}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100 dark:border-stone-800">
              <div>
                <h2 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-white'} flex items-center gap-2`}>
                  <ArrowRightLeft className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  Official Inter-Warehouse Stock Transfer &amp; Allocation
                </h2>
                <p className={`text-xs mt-0.5 ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
                  Safely relocate inventory stock between store outlets with double-sign-off audit trail. Strictly isolates quantities to eliminate multi-warehouse inventory overlap bleed.
                </p>
              </div>
            </div>

            {/* Transfer Action Card */}
            <div className={subCardClass}>
              <h3 className={`text-xs font-bold uppercase tracking-wider mb-4 ${isLight ? 'text-gray-700' : 'text-stone-300'}`}>
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
                    {uniqueTransferSkuTiers.map((t) => (
                      <option key={t.sku} value={t.sku}>
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
                  disabled={isTransferring}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap"
                >
                  {isTransferring ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  <span>Execute Inter-Store Transfer</span>
                </button>
              </div>
            </div>

            {/* Transfer Audit Logs */}
            <div className="space-y-3 pt-2">
              <h4 className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
                Inter-Warehouse Stock Transfer Audit Trail
              </h4>

              {transferRecords.length === 0 ? (
                <p className="text-xs text-stone-500 italic">No transfers executed yet.</p>
              ) : (
                transferRecords.map((t) => (
                  <div key={t.id} className={`${subCardClass} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs">{t.id}</span>
                        <span className="font-bold text-xs">{t.productName} ({t.sku})</span>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-bold uppercase">
                          {t.quantity} units
                        </span>
                      </div>
                      <p className={`text-[11px] ${isLight ? 'text-gray-600' : 'text-stone-400'}`}>
                        From: <strong className="text-emerald-700 dark:text-emerald-400">{t.sourceStoreName}</strong> → To: <strong className="text-blue-700 dark:text-blue-400">{t.destinationStoreName}</strong> • Value: {formatIDR(t.totalTransferValue)}
                      </p>
                      {t.notes && <p className="text-[11px] text-stone-500 italic">Note: {t.notes}</p>}
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-gray-400 font-mono block">{new Date(t.timestamp).toLocaleString()}</span>
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">By {t.transferredBy}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
