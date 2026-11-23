import React, { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import type {
  PurchaseRequest,
  PurchaseOrder,
  GoodsReceiptRecord,
  InventoryItem,
  AutoReplenishmentConsolidatedPlan,
  AutoReplenishmentItemPlan,
  VendorBill,
  StoreOutletSchedule,
  StaffShiftSession,
  VendorScorecardResponse,
  VendorScorecardRecord,
  SupplierDebitNote,
  SupplierDebitNoteCategory,
  LastPurchasePriceResponse,
  DemandForecastResponse,
  ProcurementFocusTarget,
  VendorBillBridgeTarget,
} from '../../types/index.ts';
import { apiClient } from '../../services/apiClient';
import { formatIDR } from '../../utils/formatters';
import { canSessionViewValuation, hasModuleAccess, isOwnerRoleCode, normalizeEnterpriseRole } from '../../utils/rbac';
import {
  Truck,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileCheck2,
  Thermometer,
  Scale,
  X,
  RefreshCw,
  Search,
  Filter,
  Check,
  ChevronRight,
  Package,
  Sparkles,
  Zap,
  BarChart3,
  Layers,
  ShieldAlert,
  ArrowRight,
  ShoppingCart,
  Receipt,
  FileCheck,
  Mail,
  MessageCircle,
  Award,
  TrendingUp,
  Barcode,
  History,
  ExternalLink,
  RotateCcw,
} from 'lucide-react';
import { VendorBillModule } from './VendorBillModule';
import { DocumentDispatchModal } from './DocumentDispatchModal';
import { VendorScorecardTab } from './VendorScorecardTab';
import { SmartDemandForecastTab } from './SmartDemandForecastTab';
import { QuickBarcodeScannerBar } from './QuickBarcodeScannerBar';

interface ProcurementModuleProps {
  theme: 'light' | 'dark';
  selectedStore: string;
  inventory: InventoryItem[];
  purchaseRequests: PurchaseRequest[];
  purchaseOrders: PurchaseOrder[];
  goodsReceipts: GoodsReceiptRecord[];
  vendorBills?: VendorBill[];
  storeOutlets?: StoreOutletSchedule[];
  activeStaffSession?: StaffShiftSession | null;
  focusTarget?: ProcurementFocusTarget | null;
  onClearFocusTarget?: () => void;
  vendorBillBridgeTarget?: VendorBillBridgeTarget | null;
  onClearVendorBillBridge?: () => void;
  onNavigateToVendorBill?: (bridge: Omit<VendorBillBridgeTarget, 'triggerNonce'>) => void;
  onNavigateToDoc?: (subTab: 'pr' | 'po' | 'gr', docId: string) => void;
  onRefreshData: () => void;
  onShowToast: (title: string, message: string) => void;
}

export const ProcurementModule: React.FC<ProcurementModuleProps> = ({
  theme,
  selectedStore,
  inventory,
  purchaseRequests,
  purchaseOrders,
  goodsReceipts,
  vendorBills = [],
  storeOutlets = [],
  activeStaffSession,
  focusTarget,
  onClearFocusTarget,
  vendorBillBridgeTarget,
  onClearVendorBillBridge,
  onNavigateToVendorBill,
  onNavigateToDoc,
  onRefreshData,
  onShowToast,
}) => {
  const isLight = theme === 'light';
  const canonicalRole = normalizeEnterpriseRole(activeStaffSession?.userRole);
  const canManagePrPo = ['purchasing', 'store_manager', 'coo', 'super_admin'].includes(canonicalRole);
  const canApprovePrPo =
    hasModuleAccess(activeStaffSession, 'procurement', 'approve') ||
    ['store_manager', 'coo', 'super_admin'].includes(canonicalRole);
  const canReceiveGR = ['warehouse', 'purchasing', 'store_manager', 'coo', 'super_admin'].includes(canonicalRole);
  const canCreateVendorBill = activeStaffSession?.modulePermissions
    ? Boolean(
        isOwnerRoleCode(activeStaffSession.roleCode) ||
          (activeStaffSession.modulePermissions.accounting?.view &&
            activeStaffSession.modulePermissions.accounting?.canAccessAP &&
            activeStaffSession.modulePermissions.accounting?.create)
      )
    : ['admin', 'coo', 'super_admin'].includes(canonicalRole);
  const canViewVendorBill = activeStaffSession?.modulePermissions
    ? Boolean(
        isOwnerRoleCode(activeStaffSession.roleCode) ||
          (activeStaffSession.modulePermissions.accounting?.view &&
            activeStaffSession.modulePermissions.accounting?.canAccessAP) ||
          activeStaffSession.modulePermissions.procurement?.approve
      )
    : ['purchasing', 'admin', 'coo', 'super_admin'].includes(canonicalRole);
  const isWarehouseRole = canonicalRole === 'warehouse';
  const canViewValuation = canSessionViewValuation(activeStaffSession);
  const canIssuePurchaseReturn =
    !activeStaffSession?.roleCode ||
    ['PURCHASING_HEAD', 'WAREHOUSE_HEAD', 'AP_STAFF', 'STORE_MANAGER', 'CLIENT_OWNER', 'PLATFORM_OWNER', 'SUPER_ADMIN'].includes(
      activeStaffSession.roleCode
    );
  const [approvingPoId, setApprovingPoId] = useState<string | null>(null);
  const [highlightedDocId, setHighlightedDocId] = useState<string | null>(null);

  // Purchase Return & Debit Note (NRP) Modal State
  const [returnTargetGr, setReturnTargetGr] = useState<GoodsReceiptRecord | null>(null);
  const [returnSku, setReturnSku] = useState<string>('');
  const [returnQty, setReturnQty] = useState<number>(1);
  const [returnLot, setReturnLot] = useState<string>('');
  const [returnReason, setReturnReason] = useState<string>('Damaged / Spoiled on Goods Receipt');
  const [isSubmittingPurchaseReturn, setIsSubmittingPurchaseReturn] = useState<boolean>(false);

  const openPurchaseReturnModal = (gr: GoodsReceiptRecord) => {
    const firstItem = gr.items[0];
    setReturnTargetGr(gr);
    setReturnSku(firstItem?.sku || '');
    setReturnQty(firstItem ? Math.min(1, firstItem.quantityReceived) : 1);
    setReturnLot(firstItem?.batchNumber || '');
    setReturnReason('Damaged / Spoiled on Goods Receipt');
  };

  const handleSubmitPurchaseReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnTargetGr || !returnSku) return;
    const grLine = returnTargetGr.items.find((it) => it.sku === returnSku);
    if (!grLine) {
      onShowToast('Invalid Item', 'Selected SKU is not present on this Goods Receipt.');
      return;
    }
    const qty = Number(returnQty || 0);
    if (!Number.isFinite(qty) || qty <= 0 || qty > grLine.quantityReceived) {
      onShowToast(
        'Invalid Return Quantity',
        `Return quantity must be > 0 and <= GR received quantity (${grLine.quantityReceived}).`
      );
      return;
    }
    setIsSubmittingPurchaseReturn(true);
    try {
      const res = await apiClient.createPurchaseReturn({
        grId: returnTargetGr.id,
        poId: returnTargetGr.poId,
        vendorBillId: returnTargetGr.linkedVendorBillId || returnTargetGr.linkedVendorBillIds?.[0],
        supplierName: returnTargetGr.vendorName,
        storeId: returnTargetGr.storeId,
        storeName: returnTargetGr.storeName,
        sku: grLine.sku,
        productName: grLine.productName,
        lotNumber: returnLot.trim() || grLine.batchNumber,
        quantityReturned: qty,
        reason: returnReason.trim() || 'Damaged / Spoiled on Goods Receipt',
      });
      onShowToast('Debit Note Issued', res.message);
      setReturnTargetGr(null);
      onRefreshData();
    } catch (err: any) {
      onShowToast('Purchase Return Error', err.message || 'Failed to issue Purchase Return Debit Note');
    } finally {
      setIsSubmittingPurchaseReturn(false);
    }
  };

  // Modal States
  const [isCreatingPR, setIsCreatingPR] = useState<boolean>(false);
  const [prStoreId, setPrStoreId] = useState<string>('store-jkt-senopati');
  const [selectedPrSku, setSelectedPrSku] = useState<string>('');
  const [prQuantity, setPrQuantity] = useState<number>(30);
  const [prReason, setPrReason] = useState<'low_stock_trigger' | 'manual_request' | 'bulk_restock'>('manual_request');
  const [prPriority, setPrPriority] = useState<'normal' | 'high' | 'urgent'>('high');

  // Receiving Modal State
  const [activeReceivingPO, setActiveReceivingPO] = useState<PurchaseOrder | null>(null);
  const [deliveryNoteInput, setDeliveryNoteInput] = useState<string>('');
  const [receivedByInput, setReceivedByInput] = useState<string>('');
  const [receiverNotesInput, setReceiverNotesInput] = useState<string>('');
  const [isSubmittingGR, setIsSubmittingGR] = useState<boolean>(false);
  const grSubmitLockRef = useRef<boolean>(false);
  const grIdempotencyKeyRef = useRef<string | null>(null);

  // State Machine Guard: Force Close PO with Written Adjustment Notes
  const [forceClosingPO, setForceClosingPO] = useState<PurchaseOrder | null>(null);
  const [forceCloseNotes, setForceCloseNotes] = useState<string>('');
  const [isSubmittingClosePO, setIsSubmittingClosePO] = useState<boolean>(false);

  const [receivingItemsState, setReceivingItemsState] = useState<
    Record<
      string,
      {
        quantityReceived: number;
        bonusQty: number;
        batchNumber: string;
        expiryDate: string;
        qualityCondition: 'Cold-Chain Verified' | 'Passed - Grade A' | 'Minor Discrepancy';
        tempCheckCelsius: number;
      }
    >
  >({});

  // Cross-Dock Direct Fulfillment State (inside Receive Goods Modal)
  const [receiveMode, setReceiveMode] = useState<'standard' | 'cross_dock'>('standard');
  const [crossDockDriver, setCrossDockDriver] = useState<string>('Budi Santoso');
  const [crossDockPlate, setCrossDockPlate] = useState<string>('B 9124 KXC');
  const [crossDockAllocations, setCrossDockAllocations] = useState<Record<string, Record<string, number>>>({});

  // Advanced Landed Cost & Import Allocation State (inside Stock-in / GR Modal)
  const [grFreightCost, setGrFreightCost] = useState<number>(0);
  const [grInsuranceCost, setGrInsuranceCost] = useState<number>(0);
  const [grCustomsDuty, setGrCustomsDuty] = useState<number>(0);
  const [grColdChainCost, setGrColdChainCost] = useState<number>(0);
  const [grLandedMethod, setGrLandedMethod] = useState<'BY_QUANTITY' | 'BY_VALUE'>('BY_QUANTITY');
  const [grUnloadingLaborFee, setGrUnloadingLaborFee] = useState<number>(0);
  const [grUnloadingPayerCoa, setGrUnloadingPayerCoa] = useState<'1011' | '1010' | '2010'>('1011');
  const [grCapitalizedToLandedCost, setGrCapitalizedToLandedCost] = useState<boolean>(false);

  // Direct Purchase Order Modal State
  const [isCreatingDirectPO, setIsCreatingDirectPO] = useState<boolean>(false);
  const [directPoStoreId, setDirectPoStoreId] = useState<string>('store-jkt-senopati');
  const [directPoSupplier, setDirectPoSupplier] = useState<string>('');
  const [directPoSku, setDirectPoSku] = useState<string>('');
  const [directPoQty, setDirectPoQty] = useState<number>(25);
  const [directPoBonusQty, setDirectPoBonusQty] = useState<number>(0);
  const [directPoExpectedDate, setDirectPoExpectedDate] = useState<string>(() =>
    new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0]
  );
  const [directPoPaymentTerms, setDirectPoPaymentTerms] = useState<'Net 30' | 'COD' | 'Advance Payment'>('Net 30');
  const [directPoNotes, setDirectPoNotes] = useState<string>('');
  const [isSubmittingDirectPO, setIsSubmittingDirectPO] = useState<boolean>(false);
  const [showGrScanner, setShowGrScanner] = useState<boolean>(false);
  const [lastPriceInfo, setLastPriceInfo] = useState<LastPurchasePriceResponse | null>(null);
  const [isLoadingLastPrice, setIsLoadingLastPrice] = useState<boolean>(false);
  const [reorderSuggestions, setReorderSuggestions] = useState<DemandForecastResponse | null>(null);
  const [isCreatingQuickPR, setIsCreatingQuickPR] = useState<string | null>(null);
  const [showReorderWidget, setShowReorderWidget] = useState<boolean>(true);

  // Vendor Scorecard (SRM) State
  const [scorecardData, setScorecardData] = useState<VendorScorecardResponse | null>(null);
  const [isLoadingScorecard, setIsLoadingScorecard] = useState<boolean>(false);

  // Supplier Rafaksi & Trading Term Debit Notes (Nota Debet) State
  const [debitNotesList, setDebitNotesList] = useState<SupplierDebitNote[]>([]);
  const [isLoadingDebitNotes, setIsLoadingDebitNotes] = useState<boolean>(false);
  const [isSubmittingDebitNote, setIsSubmittingDebitNote] = useState<boolean>(false);
  const [dnSupplierName, setDnSupplierName] = useState<string>('');
  const [dnCategory, setDnCategory] = useState<SupplierDebitNoteCategory>('RAFAKSI_HARGA');
  const [dnVendorBillId, setDnVendorBillId] = useState<string>('');
  const [dnSku, setDnSku] = useState<string>('');
  const [dnAmountIDR, setDnAmountIDR] = useState<number>(250000);
  const [dnDescription, setDnDescription] = useState<string>('');

  // Active Module Sub-Tab
  const [activeTab, setActiveTab] = useState<'auto_replenishment' | 'smart_forecast' | 'pr' | 'po' | 'gr' | 'vendor_bills' | 'vendor_scorecard' | 'debit_notes'>(
    canonicalRole === 'warehouse' ? 'gr' : 'auto_replenishment'
  );
  const [preselectedPoId, setPreselectedPoId] = useState<string>('');
  const [preselectedGrId, setPreselectedGrId] = useState<string>('');

  React.useEffect(() => {
    if (isWarehouseRole && (activeTab === 'auto_replenishment' || activeTab === 'smart_forecast' || activeTab === 'vendor_bills' || activeTab === 'debit_notes')) {
      setActiveTab('gr');
    }
  }, [isWarehouseRole, activeTab]);

  const jumpToSubDoc = React.useCallback((subTab: 'pr' | 'po' | 'gr', docId: string) => {
    setActiveTab(subTab);
    setPrFilter('ALL');
    setPoFilter('ALL');
    setSearchQuery('');
    setHighlightedDocId(docId);
    window.setTimeout(() => {
      const row = document.querySelector(`tr[data-doc-id="${docId}"]`);
      row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
    window.setTimeout(() => {
      setHighlightedDocId((prev) => (prev === docId ? null : prev));
    }, 4500);
    if (onNavigateToDoc) {
      onNavigateToDoc(subTab, docId);
    }
  }, [onNavigateToDoc]);

  React.useEffect(() => {
    if (!focusTarget) return;
    if (isWarehouseRole && focusTarget.subTab === 'vendor_bills') {
      onClearFocusTarget?.();
      return;
    }
    setActiveTab(focusTarget.subTab);
    setPrFilter('ALL');
    setPoFilter('ALL');
    setSearchQuery('');
    if (focusTarget.docId) {
      setHighlightedDocId(focusTarget.docId);
      window.setTimeout(() => {
        const row = document.querySelector(`tr[data-doc-id="${focusTarget.docId}"]`);
        row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 90);
      window.setTimeout(() => {
        setHighlightedDocId((prev) => (prev === focusTarget.docId ? null : prev));
      }, 4500);
    }
    onClearFocusTarget?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTarget?.triggerNonce]);

  const openVendorBillCreate = (poId: string, grId?: string, grIds?: string[]) => {
    if (onNavigateToVendorBill) {
      onNavigateToVendorBill({ mode: 'create', poId, grId, grIds });
      return;
    }
    setPreselectedPoId(poId);
    if (grId) setPreselectedGrId(grId);
    setActiveTab('vendor_bills');
  };

  const openVendorBillView = (billId: string, poId?: string) => {
    if (onNavigateToVendorBill) {
      onNavigateToVendorBill({ mode: 'view', billId, poId });
      return;
    }
    setActiveTab('vendor_bills');
  };

  // Auto-Replenishment & Min-Max Stock Planning State
  const [replenishmentPlan, setReplenishmentPlan] = useState<AutoReplenishmentConsolidatedPlan | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState<boolean>(false);
  const [isGeneratingDraftPOs, setIsGeneratingDraftPOs] = useState<boolean>(false);
  const [urgencyFilter, setUrgencyFilter] = useState<'ALL' | 'CRITICAL_OUT_OF_STOCK' | 'BELOW_SAFETY_STOCK' | 'HEALTHY_STOCK' | 'OVERSTOCKED'>('ALL');
  const [selectedReplenishmentSkus, setSelectedReplenishmentSkus] = useState<string[]>([]);

  // Filters
  const [prFilter, setPrFilter] = useState<'ALL' | 'pending' | 'approved'>('ALL');
  const [poFilter, setPoFilter] = useState<'ALL' | 'Pending' | 'Partially Received' | 'Completed'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dispatchDoc, setDispatchDoc] = useState<{
    channel: 'email' | 'whatsapp';
    docType: 'PR' | 'PO' | 'GR';
    docId: string;
    docNumber: string;
    docSummary: string;
    recipientName: string;
    recipientEmail?: string;
    recipientPhone?: string;
  } | null>(null);

  // Fetch Auto-Replenishment Plan
  const loadReplenishmentPlan = React.useCallback(async () => {
    setIsLoadingPlan(true);
    try {
      const plan = await apiClient.getReplenishmentPlan(selectedStore);
      setReplenishmentPlan(plan);
    } catch (e: any) {
      console.warn('Could not load auto-replenishment plan:', e);
    } finally {
      setIsLoadingPlan(false);
    }
  }, [selectedStore]);

  React.useEffect(() => {
    loadReplenishmentPlan();
  }, [loadReplenishmentPlan]);

  // Fetch Vendor Scorecard (SRM)
  const loadVendorScorecard = React.useCallback(async () => {
    setIsLoadingScorecard(true);
    try {
      const res = await apiClient.getVendorScorecard();
      setScorecardData(res);
    } catch (e: any) {
      console.warn('Could not load vendor scorecard:', e);
    } finally {
      setIsLoadingScorecard(false);
    }
  }, []);

  React.useEffect(() => {
    loadVendorScorecard();
  }, [loadVendorScorecard, purchaseOrders.length, goodsReceipts.length, vendorBills.length]);

  const supplierOptions = useMemo(() => {
    const names = new Set<string>();
    (scorecardData?.scorecards || []).forEach((s) => {
      if (s.supplierName) names.add(s.supplierName);
    });
    inventory.forEach((it) => {
      if (it.supplierName) names.add(it.supplierName);
    });
    purchaseOrders.forEach((po) => {
      if (po.supplierName) names.add(po.supplierName);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [scorecardData, inventory, purchaseOrders]);

  const getSrmRecord = React.useCallback(
    (supplierName?: string): VendorScorecardRecord | null => {
      if (!supplierName || !scorecardData?.scorecards?.length) return null;
      const normalize = (v: string) =>
        v
          .toLowerCase()
          .replace(/eco-farm/g, '')
          .replace(/[^a-z0-9]+/g, ' ')
          .trim();
      const target = normalize(supplierName);
      if (!target) return null;
      return (
        scorecardData.scorecards.find((s) => {
          const cand = normalize(s.supplierName);
          return cand === target || cand.includes(target) || target.includes(cand);
        }) || null
      );
    },
    [scorecardData]
  );

  const openDirectPoModal = (preselectedSupplier?: string) => {
    const fallbackSupplier = preselectedSupplier || supplierOptions[0] || '';
    const matchingInv =
      inventory.find((i) => i.supplierName && fallbackSupplier && i.supplierName.toLowerCase().includes(fallbackSupplier.toLowerCase().split(' ')[0])) ||
      inventory[0];
    setDirectPoStoreId(selectedStore !== 'CONSOLIDATED' ? selectedStore : 'store-jkt-senopati');
    setDirectPoSupplier(fallbackSupplier);
    setDirectPoSku(matchingInv?.sku || '');
    setDirectPoQty(25);
    setDirectPoBonusQty(0);
    setDirectPoExpectedDate(new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0]);
    setDirectPoPaymentTerms('Net 30');
    setDirectPoNotes('');
    setIsCreatingDirectPO(true);
  };

  const loadDebitNotes = React.useCallback(async () => {
    if (isWarehouseRole) return;
    setIsLoadingDebitNotes(true);
    try {
      const notes = await apiClient.getSupplierDebitNotes(selectedStore);
      setDebitNotesList(notes);
    } catch {
      // keep existing list
    } finally {
      setIsLoadingDebitNotes(false);
    }
  }, [isWarehouseRole, selectedStore]);

  React.useEffect(() => {
    if (activeTab === 'debit_notes') {
      loadDebitNotes();
    }
  }, [activeTab, loadDebitNotes]);

  React.useEffect(() => {
    if (!isCreatingDirectPO || !directPoSku) {
      setLastPriceInfo(null);
      return;
    }
    let cancelled = false;
    setIsLoadingLastPrice(true);
    apiClient
      .getLastPurchasePrice(directPoSku, directPoSupplier || undefined)
      .then((res) => {
        if (!cancelled) setLastPriceInfo(res);
      })
      .catch(() => {
        if (!cancelled) setLastPriceInfo(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingLastPrice(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isCreatingDirectPO, directPoSku, directPoSupplier]);

  const loadReorderSuggestions = React.useCallback(async () => {
    if (isWarehouseRole) return;
    try {
      const res = await apiClient.getDemandForecast({
        storeId: selectedStore !== 'CONSOLIDATED' ? selectedStore : undefined,
      });
      setReorderSuggestions(res);
    } catch {
      // silent fallback
    }
  }, [isWarehouseRole, selectedStore]);

  React.useEffect(() => {
    if ((activeTab === 'pr' || activeTab === 'po') && !isWarehouseRole) {
      void loadReorderSuggestions();
    }
  }, [activeTab, isWarehouseRole, loadReorderSuggestions]);

  const handleOneClickReorderPR = async (
    itemsToOrder: Array<{ sku: string; quantity?: number; supplierName?: string }>,
    keyLabel: string
  ) => {
    if (!itemsToOrder.length) return;
    setIsCreatingQuickPR(keyLabel);
    try {
      const res = await apiClient.createSmartForecastPRs({
        storeId: selectedStore !== 'CONSOLIDATED' ? selectedStore : undefined,
        items: itemsToOrder,
      });
      onShowToast(
        'Draft PR Created',
        res.message || `Generated ${res.purchaseRequests.length} Draft PR(s) with top-SRM vendor routing.`
      );
      onRefreshData();
      await loadReorderSuggestions();
    } catch (err: unknown) {
      onShowToast('Auto-PR Failed', err instanceof Error ? err.message : String(err));
    } finally {
      setIsCreatingQuickPR(null);
    }
  };

  const getLocalLastPoPrice = React.useCallback(
    (
      sku: string,
      supplierHint?: string
    ): { price: number; date: string; docRef: string; vendorName: string; matchedSameSupplier: boolean } | null => {
      const hintNorm = (supplierHint || '').toLowerCase().trim();
      const hintToken = hintNorm.split(' ').filter((w) => w.length > 2 && w !== 'pt' && w !== 'cv')[0] || hintNorm;
      const matchesSup = (vendor: string) =>
        Boolean(hintNorm && vendor.toLowerCase().includes(hintToken));

      const records: Array<{ price: number; date: string; docRef: string; vendorName: string; sameSup: boolean }> = [];

      for (const gr of goodsReceipts) {
        if (!gr.items.some((it) => it.sku === sku)) continue;
        const linkedPo = purchaseOrders.find((p) => p.id === gr.poId);
        const line = linkedPo?.items.find((it) => it.sku === sku);
        if (!line || !(line.unitCost > 0)) continue;
        const vendor = gr.vendorName || linkedPo?.supplierName || '';
        records.push({
          price: line.unitCost,
          date: gr.receivedAt.split('T')[0],
          docRef: gr.id,
          vendorName: vendor,
          sameSup: matchesSup(vendor),
        });
      }

      for (const po of purchaseOrders) {
        if (po.status === 'Cancelled') continue;
        const line = po.items.find((it) => it.sku === sku);
        if (!line || !(line.unitCost > 0)) continue;
        records.push({
          price: line.unitCost,
          date: (po.issueDate || po.createdAt).split('T')[0],
          docRef: po.id,
          vendorName: po.supplierName || '',
          sameSup: matchesSup(po.supplierName || ''),
        });
      }

      records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const sameSup = hintNorm ? records.filter((r) => r.sameSup) : [];
      const chosen = sameSup[0] || records[0];
      if (!chosen) return null;
      return {
        price: chosen.price,
        date: chosen.date,
        docRef: chosen.docRef,
        vendorName: chosen.vendorName,
        matchedSameSupplier: hintNorm ? sameSup.length > 0 : true,
      };
    },
    [goodsReceipts, purchaseOrders]
  );

  const handleCreateDirectPO = async () => {
    if (!directPoSupplier || !directPoSku || directPoQty <= 0) {
      onShowToast('Missing Order Fields', 'Select a Supplier, Product SKU, and positive quantity.');
      return;
    }
    setIsSubmittingDirectPO(true);
    try {
      const res = await apiClient.createDirectPurchaseOrder({
        storeId: directPoStoreId,
        supplierName: directPoSupplier,
        sku: directPoSku,
        quantity: directPoQty,
        bonusQty: directPoBonusQty > 0 ? directPoBonusQty : undefined,
        expectedDeliveryDate: directPoExpectedDate,
        paymentTerms: directPoPaymentTerms,
        notes: directPoNotes,
      });
      setIsCreatingDirectPO(false);
      onShowToast('Direct Purchase Order Issued', res.message || `PO ${res.purchaseOrder.id} created.`);
      onRefreshData();
      await loadVendorScorecard();
      setActiveTab('po');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Direct PO Failed', msg);
    } finally {
      setIsSubmittingDirectPO(false);
    }
  };

  // Filtered Auto-Replenishment Items
  const filteredReplenishmentItems = useMemo(() => {
    if (!replenishmentPlan?.items) return [];
    return replenishmentPlan.items.filter((item) => {
      if (urgencyFilter !== 'ALL' && item.urgencyLevel !== urgencyFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          item.sku.toLowerCase().includes(q) ||
          item.productName.toLowerCase().includes(q) ||
          item.supplierName.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [replenishmentPlan, urgencyFilter, searchQuery]);

  // Handler: 1-Click Generate Draft Purchase Orders from Replenishment
  const handleGenerateAutoPOs = async () => {
    setIsGeneratingDraftPOs(true);
    try {
      const res = await apiClient.generateReplenishmentPO({
        storeId: selectedStore,
        selectedSkus: selectedReplenishmentSkus.length > 0 ? selectedReplenishmentSkus : undefined,
      });
      if (res.success) {
        onShowToast(
          'Draft Purchase Orders Generated',
          res.message || `Created ${res.generatedOrders?.length || 0} vendor purchase orders.`
        );
        onRefreshData();
        await loadReplenishmentPlan();
        setSelectedReplenishmentSkus([]);
        setActiveTab('po');
      }
    } catch (e: any) {
      onShowToast('Error Generating POs', e.message || 'Failed to auto-generate POs');
    } finally {
      setIsGeneratingDraftPOs(false);
    }
  };

  // Toggle SKU selection
  const handleToggleSelectSku = (sku: string) => {
    setSelectedReplenishmentSkus((prev) =>
      prev.includes(sku) ? prev.filter((s) => s !== sku) : [...prev, sku]
    );
  };

  const handleSelectAllReorder = () => {
    if (!replenishmentPlan?.items) return;
    const reorderSkus = replenishmentPlan.items
      .filter((i) => i.isReorderTriggered)
      .map((i) => i.sku);
    if (selectedReplenishmentSkus.length === reorderSkus.length) {
      setSelectedReplenishmentSkus([]);
    } else {
      setSelectedReplenishmentSkus(reorderSkus);
    }
  };

  // Calculations
  const filteredPRs = useMemo(() => {
    return purchaseRequests.filter((pr) => {
      if (selectedStore !== 'CONSOLIDATED' && pr.storeId && pr.storeId !== selectedStore) return false;
      if (prFilter !== 'ALL' && pr.status !== prFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          pr.id.toLowerCase().includes(q) ||
          pr.productName.toLowerCase().includes(q) ||
          pr.sku.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [purchaseRequests, selectedStore, prFilter, searchQuery]);

  const filteredPOs = useMemo(() => {
    return purchaseOrders.filter((po) => {
      if (selectedStore !== 'CONSOLIDATED' && po.storeId && po.storeId !== selectedStore) return false;
      if (poFilter !== 'ALL') {
        if (poFilter === 'Pending') {
          if (!['Pending', 'Sent', 'Draft', 'pending_approval', 'PENDING_APPROVAL', 'APPROVED'].includes(po.status)) return false;
        } else if (po.status !== poFilter) {
          return false;
        }
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          po.id.toLowerCase().includes(q) ||
          po.supplierName.toLowerCase().includes(q) ||
          po.items.some((i) => i.productName.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [purchaseOrders, selectedStore, poFilter, searchQuery]);

  const filteredGRs = useMemo(() => {
    return goodsReceipts.filter((gr) => {
      if (selectedStore !== 'CONSOLIDATED' && gr.storeId && gr.storeId !== selectedStore) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          gr.id.toLowerCase().includes(q) ||
          gr.deliveryNoteNumber.toLowerCase().includes(q) ||
          gr.vendorName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [goodsReceipts, selectedStore, searchQuery]);

  const totalPOValue = purchaseOrders.reduce((sum, po) => sum + po.totalCost, 0);
  const pendingPRCount = purchaseRequests.filter((p) => p.status === 'pending').length;
  const partialPOCount = purchaseOrders.filter((p) => p.status === 'Partially Received').length;

  // Actions
  const handleCreatePR = async () => {
    if (!selectedPrSku) {
      onShowToast('Missing Item', 'Please select a product SKU to restock.');
      return;
    }
    try {
      const selectedItem = inventory.find((i) => i.sku === selectedPrSku);
      const res = await apiClient.createPurchaseRequest({
        sku: selectedPrSku,
        suggestedQuantity: prQuantity,
        reason: prReason,
        priority: prPriority,
        requestedBy: 'Store Operations Admin',
        storeId: prStoreId,
      });
      setIsCreatingPR(false);
      setSelectedPrSku('');
      onRefreshData();
      onShowToast(
        'Purchase Request Created',
        `PR ${res.purchaseRequest.id} generated for ${selectedItem?.productName || selectedPrSku}.`
      );
    } catch (err) {
      onShowToast('PR Failed', String(err));
    }
  };

  const handleApprovePR = async (prId: string) => {
    try {
      const res = await apiClient.approvePurchaseRequest(prId);
      onRefreshData();
      onShowToast(
        'PR Approved → PO Generated',
        `Purchase Order ${res.purchaseOrder.id} generated with automated supplier routing.`
      );
    } catch (err) {
      onShowToast('Approval Failed', err instanceof Error ? err.message : String(err));
    }
  };

  const handleApprovePO = async (poId: string) => {
    if (approvingPoId) return;
    setApprovingPoId(poId);
    try {
      const res = await apiClient.approvePurchaseOrder(poId);
      onRefreshData();
      onShowToast(
        'Purchase Order Approved',
        res.message || `PO #${poId} approved and released for Goods Receipt.`
      );
    } catch (err) {
      onShowToast('PO Approval Failed', err instanceof Error ? err.message : String(err));
    } finally {
      setApprovingPoId(null);
    }
  };

  const crossDockTargetBranches = useMemo(() => {
    const defaults = [
      { storeId: 'store-jkt-pik', storeName: 'GroceMart PIK 2 The Avenue' },
      { storeId: 'store-jkt-menteng', storeName: 'GroceMart Menteng Heritage' },
      { storeId: 'store-bdg-dago', storeName: 'GroceMart Dago Green Market' },
      { storeId: 'store-sby-gubeng', storeName: 'GroceMart Gubeng Central' },
    ];
    if (storeOutlets && storeOutlets.length > 0) {
      const branches = storeOutlets.filter((s) => s.storeId !== 'store-jkt-senopati');
      if (branches.length > 0) {
        return branches.map((b) => ({ storeId: b.storeId, storeName: b.storeName }));
      }
    }
    return defaults;
  }, [storeOutlets]);

  const openReceivingModal = (po: PurchaseOrder) => {
    setActiveReceivingPO(po);
    setReceiveMode('standard');
    setDeliveryNoteInput(`SJ-VND-${Date.now().toString().slice(-5)}`);
    setReceivedByInput('Siti Rahmawati (Receiving Clerk)');
    setReceiverNotesInput('');
    setGrFreightCost(0);
    setGrInsuranceCost(0);
    setGrCustomsDuty(0);
    setGrColdChainCost(0);
    setGrLandedMethod('BY_QUANTITY');
    setGrUnloadingLaborFee(0);
    setGrUnloadingPayerCoa('1011');
    setGrCapitalizedToLandedCost(false);

    const initialMap: typeof receivingItemsState = {};
    const initialCdMap: Record<string, Record<string, number>> = {};
    po.items.forEach((item) => {
      initialMap[item.sku] = {
        quantityReceived: item.remainingBackorder > 0 ? item.remainingBackorder : item.orderedQuantity,
        bonusQty: item.bonusQty || 0,
        batchNumber: `BAT-${Date.now().toString().slice(-6)}`,
        expiryDate: new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString().split('T')[0],
        qualityCondition: 'Cold-Chain Verified',
        tempCheckCelsius: 3.8,
      };
      const allocRow: Record<string, number> = {};
      crossDockTargetBranches.forEach((b, bIdx) => {
        allocRow[b.storeId] =
          bIdx === 0 ? (item.remainingBackorder > 0 ? item.remainingBackorder : item.orderedQuantity) : 0;
      });
      initialCdMap[item.sku] = allocRow;
    });
    setReceivingItemsState(initialMap);
    setCrossDockAllocations(initialCdMap);
  };

  const handleSubmitPartialGR = async () => {
    if (!activeReceivingPO || isSubmittingGR || grSubmitLockRef.current) return;

    // Strict State Machine Guard: Verify no line item exceeds remaining open backorder
    for (const item of activeReceivingPO.items) {
      const inputQty = receivingItemsState[item.sku]?.quantityReceived || 0;
      if (inputQty > item.remainingBackorder) {
        onShowToast(
          'Validation Error: Over-Receipt Disallowed',
          `Received quantity (${inputQty}) exceeds remaining open backorder (${item.remainingBackorder}) for ${item.productName}.`
        );
        return;
      }
    }

    grSubmitLockRef.current = true;
    setIsSubmittingGR(true);
    const grIdempotencyKey =
      grIdempotencyKeyRef.current ||
      `GR-KEY-${activeReceivingPO.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    grIdempotencyKeyRef.current = grIdempotencyKey;
    try {
      if (receiveMode === 'cross_dock') {
        const cdItems = activeReceivingPO.items
          .map((item) => {
            const itemState = receivingItemsState[item.sku];
            const branchMap = crossDockAllocations[item.sku] || {};
            const allocations = Object.entries(branchMap)
              .filter(([, q]) => Number(q) > 0)
              .map(([targetStoreId, qty]) => ({
                targetStoreId,
                targetStoreName:
                  crossDockTargetBranches.find((b) => b.storeId === targetStoreId)?.storeName || targetStoreId,
                qty: Number(qty),
              }));
            return {
              sku: item.sku,
              batchNumber: itemState?.batchNumber,
              expiryDate: itemState?.expiryDate,
              tempCheckCelsius: itemState?.tempCheckCelsius,
              allocations,
            };
          })
          .filter((it) => it.allocations.length > 0);

        if (cdItems.length === 0) {
          onShowToast('Cross-Dock Allocations Needed', 'Allocate at least 1 unit to a destination branch.');
          setIsSubmittingGR(false);
          return;
        }

        const res = await apiClient.executeCrossDock({
          poId: activeReceivingPO.id,
          deliveryNoteNumber: deliveryNoteInput,
          receivedBy: receivedByInput,
          driverName: crossDockDriver,
          vehiclePlateNumber: crossDockPlate,
          receiverNotes: receiverNotesInput,
          items: cdItems,
        });

        onShowToast('Cross-Dock Dispatched (Zero CDC Putaway)', res.message);
        setActiveReceivingPO(null);
        onRefreshData();
        return;
      }

      const itemsPayload = Object.entries(receivingItemsState).map(([sku, data]) => ({
        sku,
        quantityReceived: data.quantityReceived,
        bonusQty: data.bonusQty || 0,
        batchNumber: data.batchNumber,
        expiryDate: data.expiryDate,
        qualityCondition: data.qualityCondition,
        tempCheckCelsius: data.tempCheckCelsius,
      }));

      const totalExtras =
        (Number(grFreightCost) || 0) +
        (Number(grInsuranceCost) || 0) +
        (Number(grCustomsDuty) || 0) +
        (Number(grColdChainCost) || 0);

      const res = await apiClient.receivePartialGoods({
        poId: activeReceivingPO.id,
        deliveryNoteNumber: deliveryNoteInput,
        receivedBy: receivedByInput,
        receiverNotes: receiverNotesInput,
        warehouseZoneId: activeReceivingPO.warehouseZoneId || 'WH-JKT-SEN-COLD',
        items: itemsPayload,
        ...(totalExtras > 0
          ? {
              landedCostAllocation: {
                freightCostIDR: Number(grFreightCost) || 0,
                insuranceCostIDR: Number(grInsuranceCost) || 0,
                customsDutyIDR: Number(grCustomsDuty) || 0,
                coldChainLogisticsIDR: Number(grColdChainCost) || 0,
                allocationMethod: grLandedMethod,
              },
            }
          : {}),
        ...(Number(grUnloadingLaborFee) > 0
          ? {
              unloadingLaborFeeIDR: Number(grUnloadingLaborFee),
              unloadingFeePayerCoa: grUnloadingPayerCoa,
              capitalizedToLandedCost: grCapitalizedToLandedCost,
            }
          : {}),
        idempotencyKey: grIdempotencyKey,
      });

      const landedNote = res.landedCostSummary
        ? ` Landed Cost ${formatIDR(res.landedCostSummary.totalLandedCostIDR)} capitalized into FEFO batch HPP.`
        : '';
      const unloadingNote = res.unloadingLaborSummary
        ? ` Bongkar Muat SPSI ${formatIDR(res.unloadingLaborSummary.unloadingLaborFeeIDR)} (${
            res.unloadingLaborSummary.capitalizedToLandedCost ? 'DR 1040' : 'DR 5030'
          } / CR ${res.unloadingLaborSummary.payerCoa}).`
        : '';

      onShowToast(
        res.isPartial ? 'Partial Goods Receipt Recorded' : 'PO 100% Fulfilled',
        `GR #${res.goodsReceipt.id} processed. ${res.remainingBackorder} units backorder remaining. GL #${res.journalEntryIds[0] || 'GLE-Posted'} auto-posted.${landedNote}${unloadingNote}`
      );

      grIdempotencyKeyRef.current = null;
      setActiveReceivingPO(null);
      onRefreshData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Goods Receipt Failed', msg);
    } finally {
      grSubmitLockRef.current = false;
      setIsSubmittingGR(false);
    }
  };

  const handleForceClosePO = async () => {
    if (!forceClosingPO) return;
    if (!forceCloseNotes.trim()) {
      onShowToast('Mandatory Notes Missing', 'Please enter written adjustment notes explaining why this PO is being prematurely closed.');
      return;
    }
    setIsSubmittingClosePO(true);
    try {
      const res = await apiClient.updatePurchaseOrderStatus(forceClosingPO.id, 'Completed', forceCloseNotes);
      onShowToast('Purchase Order Closed', res.message || `PO #${forceClosingPO.id} marked as closed with written adjustment notes.`);
      setForceClosingPO(null);
      setForceCloseNotes('');
      onRefreshData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Closure Rejected', msg);
    } finally {
      setIsSubmittingClosePO(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Metrics Overview */}
      <div
        className={`p-6 rounded-2xl border transition-all gm-hero-banner ${
          isLight
            ? 'bg-white border-gray-200/90 shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
            : 'bg-emerald-950/80 border-emerald-800/50'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#0F4C3A] text-white tracking-wide">
                Procurement &amp; Supply Chain
              </span>
              <span className={`text-xs ${isLight ? 'text-gray-500' : 'text-emerald-200/80'}`}>
                Partial Shipment &amp; Restock Engine
              </span>
            </div>
            <h2 className={`text-xl sm:text-2xl font-bold tracking-tight ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
              Purchase Requests, Orders &amp; Partial GR
            </h2>
            <p className={`text-xs sm:text-sm mt-1 max-w-2xl ${isLight ? 'text-gray-600' : 'text-slate-300'}`}>
              End-to-end procurement cycle with automatic inventory threshold triggers, vendor order conversions,
              and enterprise split-delivery Goods Receipts (GR) linked directly to the General Ledger.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {canManagePrPo && (
              <>
                <button
                  onClick={() => openDirectPoModal()}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer ${
                    isLight
                      ? 'bg-white border-[#0F4C3A]/30 text-[#0F4C3A] hover:bg-emerald-50 shadow-2xs'
                      : 'bg-slate-900/90 border-emerald-500/40 text-emerald-300 hover:bg-slate-800'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  Create Direct PO
                </button>
                <button
                  onClick={() => setIsCreatingPR(true)}
                  className="px-4 py-2 bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-all shadow-sm cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  New Restock PR
                </button>
              </>
            )}
            <button
              onClick={() => {
                onRefreshData();
                loadVendorScorecard();
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                isLight
                  ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 shadow-2xs'
                  : 'bg-slate-900/90 border-slate-800/80 text-slate-200 hover:bg-slate-800'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Sync
            </button>
          </div>
        </div>

        {/* Quick KPI stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6">
          <div
            className={`p-3.5 rounded-xl border ${
              isLight ? 'bg-white border-gray-200/80 shadow-xs' : 'bg-[#090A0F] border-slate-800/80'
            }`}
          >
            <div className={`text-xs font-medium ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
              Pending PRs
            </div>
            <div className={`text-xl font-bold mt-1 ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
              {pendingPRCount}
            </div>
            <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
              Awaiting PO Conversion
            </div>
          </div>

          <div
            className={`p-3.5 rounded-xl border ${
              isLight ? 'bg-white border-gray-200/80 shadow-xs' : 'bg-[#090A0F] border-slate-800/80'
            }`}
          >
            <div className={`text-xs font-medium ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
              Active PO Value
            </div>
            <div className={`text-xl font-bold mt-1 text-[#0F4C3A] dark:text-emerald-400 font-mono`}>
              {formatIDR(totalPOValue)}
            </div>
            <div className={`text-[11px] ${isLight ? 'text-gray-500' : 'text-slate-400'} mt-0.5`}>
              {purchaseOrders.length} Formal Vendor Orders
            </div>
          </div>

          <div
            className={`p-3.5 rounded-xl border ${
              isLight ? 'bg-white border-gray-200/80 shadow-xs' : 'bg-[#090A0F] border-slate-800/80'
            }`}
          >
            <div className={`text-xs font-medium ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
              Partial Deliveries
            </div>
            <div className={`text-xl font-bold mt-1 ${partialPOCount > 0 ? 'text-blue-600 dark:text-blue-400' : isLight ? 'text-gray-900' : 'text-slate-100'}`}>
              {partialPOCount}
            </div>
            <div className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5">
              Active In-Flight Backorders
            </div>
          </div>

          <div
            className={`p-3.5 rounded-xl border ${
              isLight ? 'bg-white border-gray-200/80 shadow-xs' : 'bg-[#090A0F] border-slate-800/80'
            }`}
          >
            <div className={`text-xs font-medium ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
              Goods Receipts (GR)
            </div>
            <div className={`text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400`}>
              {goodsReceipts.length}
            </div>
            <div className={`text-[11px] ${isLight ? 'text-gray-500' : 'text-slate-400'} mt-0.5`}>
              Verified Surat Jalan Deliveries
            </div>
          </div>
        </div>
      </div>

      {/* SUB-TAB NAVIGATION BAR */}
      <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
        {!isWarehouseRole && (
          <button
            type="button"
            onClick={() => setActiveTab('auto_replenishment')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13.5px] transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'auto_replenishment'
                ? 'bg-[#0F4C3A] text-white font-semibold shadow-xs'
                : isLight
                ? 'bg-white text-gray-700 font-medium hover:bg-gray-100 border border-gray-200'
                : 'bg-slate-900/90 text-slate-300 font-medium hover:bg-slate-800 border border-slate-800/80'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Auto-Replenishment (Min-Max)</span>
            {replenishmentPlan && replenishmentPlan.skusNeedingRestockCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[11px] bg-rose-500 text-white font-semibold whitespace-nowrap">
                {replenishmentPlan.skusNeedingRestockCount}
              </span>
            )}
          </button>
        )}

        {!isWarehouseRole && (
          <button
            type="button"
            onClick={() => setActiveTab('smart_forecast')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13.5px] transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'smart_forecast'
                ? 'bg-[#0F4C3A] text-white font-semibold shadow-xs'
                : isLight
                ? 'bg-white text-gray-700 font-medium hover:bg-gray-100 border border-gray-200'
                : 'bg-slate-900/90 text-slate-300 font-medium hover:bg-slate-800 border border-slate-800/80'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-indigo-500" />
            <span>Smart Demand Forecast</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveTab('pr')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13.5px] transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'pr'
              ? 'bg-[#0F4C3A] text-white font-semibold shadow-xs'
              : isLight
              ? 'bg-white text-gray-700 font-medium hover:bg-gray-100 border border-gray-200'
              : 'bg-slate-900/90 text-slate-300 font-medium hover:bg-slate-800 border border-slate-800/80'
          }`}
        >
          <Clock className="w-4 h-4 text-emerald-500" />
          <span>Purchase Requests (PR)</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${
              activeTab === 'pr'
                ? 'bg-white/15 text-emerald-100 border-white/25'
                : 'bg-emerald-500/15 text-[#0F4C3A] border-emerald-500/25 dark:text-emerald-300'
            }`}
          >
            {pendingPRCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('po')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13.5px] transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'po'
              ? 'bg-[#0F4C3A] text-white font-semibold shadow-xs'
              : isLight
              ? 'bg-white text-gray-700 font-medium hover:bg-gray-100 border border-gray-200'
              : 'bg-slate-900/90 text-slate-300 font-medium hover:bg-slate-800 border border-slate-800/80'
          }`}
        >
          <FileCheck2 className="w-4 h-4 text-blue-500" />
          <span>Purchase Orders (PO)</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${
              activeTab === 'po'
                ? 'bg-white/15 text-sky-100 border-white/25'
                : 'bg-blue-500/15 text-blue-700 border-blue-500/25 dark:text-blue-300'
            }`}
          >
            {purchaseOrders.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('gr')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13.5px] transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'gr'
              ? 'bg-[#0F4C3A] text-white font-semibold shadow-xs'
              : isLight
              ? 'bg-white text-gray-700 font-medium hover:bg-gray-100 border border-gray-200'
              : 'bg-slate-900/90 text-slate-300 font-medium hover:bg-slate-800 border border-slate-800/80'
          }`}
        >
          <Truck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Goods Receipts (GR)</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${
              activeTab === 'gr'
                ? 'bg-white/15 text-slate-100 border-white/25'
                : 'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-900/90 dark:text-slate-300 dark:border-slate-800/80'
            }`}
          >
            {goodsReceipts.length}
          </span>
        </button>

        {!isWarehouseRole && (
          <button
            type="button"
            onClick={() => {
              setPreselectedPoId('');
              setPreselectedGrId('');
              setActiveTab('vendor_bills');
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13.5px] transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'vendor_bills'
                ? 'bg-[#0F4C3A] text-white font-semibold shadow-xs'
                : isLight
                ? 'bg-white text-gray-700 font-medium hover:bg-gray-100 border border-gray-200'
                : 'bg-slate-900/90 text-slate-300 font-medium hover:bg-slate-800 border border-slate-800/80'
            }`}
          >
            <Receipt className="w-4 h-4 text-indigo-500" />
            <span>Vendor Bills (3-Way Match)</span>
            {vendorBills.length > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${
                  activeTab === 'vendor_bills'
                    ? 'bg-white/15 text-indigo-100 border-white/25'
                    : 'bg-indigo-500/15 text-indigo-700 border-indigo-500/25 dark:text-indigo-300'
                }`}
              >
                {vendorBills.length}
              </span>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveTab('vendor_scorecard')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13.5px] transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'vendor_scorecard'
              ? 'bg-[#0F4C3A] text-white font-semibold shadow-xs'
              : isLight
              ? 'bg-white text-gray-700 font-medium hover:bg-gray-100 border border-gray-200'
              : 'bg-slate-900/90 text-slate-300 font-medium hover:bg-slate-800 border border-slate-800/80'
          }`}
        >
          <Award className="w-4 h-4 text-amber-500" />
          <span>Vendor Scorecard (SRM)</span>
          {scorecardData && (
            <span
              className={`px-1.5 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${
                activeTab === 'vendor_scorecard'
                  ? 'bg-white/15 text-amber-100 border-white/25'
                  : 'bg-amber-500/15 text-amber-800 border-amber-500/25 dark:text-amber-300'
              }`}
            >
              {scorecardData.summary.totalVendors}
            </span>
          )}
        </button>

        {!isWarehouseRole && (
          <button
            type="button"
            onClick={() => setActiveTab('debit_notes')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13.5px] transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'debit_notes'
                ? 'bg-[#0F4C3A] text-white font-semibold shadow-xs'
                : isLight
                ? 'bg-white text-gray-700 font-medium hover:bg-gray-100 border border-gray-200'
                : 'bg-slate-900/90 text-slate-300 font-medium hover:bg-slate-800 border border-slate-800/80'
            }`}
          >
            <Receipt className="w-4 h-4 text-rose-500" />
            <span>Rafaksi &amp; Nota Debet</span>
          </button>
        )}
      </div>

      <div key={activeTab} className="gm-tab-enter">
      {/* SECTION 0: PREDICTIVE AUTO-REPLENISHMENT & MIN-MAX PLANNING */}
      {(activeTab === 'auto_replenishment') && (
        <div
          className={`rounded-2xl border transition-all overflow-hidden ${
            isLight
              ? 'bg-white border-gray-200/90 shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
              : 'bg-[#12141C] border-slate-800/80'
          }`}
        >
          {/* Header */}
          <div className={`p-5 border-b ${isLight ? 'border-gray-200 bg-gray-50/50' : 'border-slate-800/80 bg-[#090A0F]'}`}>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                    Predictive Inventory Intelligence
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Outlet: {selectedStore === 'CONSOLIDATED' ? 'All Outlets (Network)' : selectedStore}
                  </span>
                </div>
                <h3 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-slate-100'} flex items-center gap-2 mt-1`}>
                  <Sparkles className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
                  Auto-Replenishment &amp; Min-Max Stock Planning
                </h3>
                <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-slate-400'} mt-0.5`}>
                  Predictive safety stock calculations, dynamic sales velocity (units/day), and automated draft Purchase Order generation
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={loadReplenishmentPlan}
                  disabled={isLoadingPlan}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    isLight ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100' : 'bg-slate-900/90 border-slate-800/80 text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPlan ? 'animate-spin' : ''}`} />
                  <span>Recalculate Stock</span>
                </button>

                <button
                  type="button"
                  onClick={handleSelectAllReorder}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    isLight ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100' : 'bg-slate-900/90 border-slate-800/80 text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>
                    {selectedReplenishmentSkus.length > 0 ? `Selected (${selectedReplenishmentSkus.length})` : 'Select All Reorder'}
                  </span>
                </button>

                {canManagePrPo && (
                  <button
                    type="button"
                    onClick={handleGenerateAutoPOs}
                    disabled={isGeneratingDraftPOs || (replenishmentPlan?.skusNeedingRestockCount === 0 && selectedReplenishmentSkus.length === 0)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all cursor-pointer shadow-sm ${
                      isGeneratingDraftPOs || (replenishmentPlan?.skusNeedingRestockCount === 0 && selectedReplenishmentSkus.length === 0)
                        ? 'bg-zinc-400 cursor-not-allowed opacity-60'
                        : 'bg-gradient-to-r from-emerald-700 to-[#0F4C3A] hover:brightness-110 active:scale-98'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-300" />
                    <span>{isGeneratingDraftPOs ? 'Generating Draft POs...' : '⚡ Generate Draft Purchase Orders'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* KPI Summary Cards */}
            {replenishmentPlan && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-slate-800/80">
                <div className={`p-3 rounded-xl border ${isLight ? 'bg-white border-gray-200/80' : 'bg-[#12141C] border-slate-800/80'}`}>
                  <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Evaluated Catalog SKUs</div>
                  <div className={`text-lg font-bold ${isLight ? 'text-gray-900' : 'text-slate-100'} mt-0.5`}>
                    {replenishmentPlan.totalSkusEvaluated} Items
                  </div>
                  <div className="text-[10px] text-slate-400">Inventory tiers active</div>
                </div>

                <div className={`p-3 rounded-xl border ${
                  replenishmentPlan.skusNeedingRestockCount > 0
                    ? 'bg-rose-500/10 border-rose-500/30'
                    : isLight ? 'bg-white border-gray-200/80' : 'bg-[#12141C] border-slate-800/80'
                }`}>
                  <div className="text-[11px] font-medium text-rose-600 dark:text-rose-400 flex items-center justify-between">
                    <span>Reorder Triggered</span>
                    <AlertTriangle className="w-3 h-3" />
                  </div>
                  <div className="text-lg font-bold text-rose-600 dark:text-rose-300 mt-0.5">
                    {replenishmentPlan.skusNeedingRestockCount} SKUs
                  </div>
                  <div className="text-[10px] text-rose-500">Stock ≤ Reorder Point</div>
                </div>

                <div className={`p-3 rounded-xl border ${
                  replenishmentPlan.criticalSkusCount > 0
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : isLight ? 'bg-white border-gray-200/80' : 'bg-[#12141C] border-slate-800/80'
                }`}>
                  <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400 flex items-center justify-between">
                    <span>Critical Out of Stock</span>
                    <ShieldAlert className="w-3 h-3" />
                  </div>
                  <div className="text-lg font-bold text-amber-600 dark:text-amber-300 mt-0.5">
                    {replenishmentPlan.criticalSkusCount} SKUs
                  </div>
                  <div className="text-[10px] text-amber-500">Available stock = 0</div>
                </div>

                <div className={`p-3 rounded-xl border ${isLight ? 'bg-white border-gray-200/80' : 'bg-[#12141C] border-slate-800/80'}`}>
                  <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Total Suggested Restock</div>
                  <div className={`text-lg font-bold text-[#0F4C3A] dark:text-emerald-400 font-mono mt-0.5`}>
                    {formatIDR(replenishmentPlan.totalSuggestedCostIDR)}
                  </div>
                  <div className="text-[10px] text-slate-400">{replenishmentPlan.bySupplier.length} Supplier batches</div>
                </div>
              </div>
            )}

            {/* Supplier Consolidation Previews */}
            {replenishmentPlan && replenishmentPlan.bySupplier.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200/60 dark:border-slate-800/80">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-2">
                  Draft PO Vendor Grouping Preview ({replenishmentPlan.bySupplier.length} Vendors):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {replenishmentPlan.bySupplier.map((sup) => {
                    const srm = getSrmRecord(sup.supplierName);
                    return (
                      <div
                        key={sup.suggestedPoId || `${sup.supplierId}-${sup.supplierName}`}
                        className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 ${
                          isLight ? 'bg-white/80 border-gray-200' : 'bg-[#12141C] border-slate-800/80'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[170px]">
                            {sup.supplierName}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {sup.suggestedPoId} • {sup.skuCount} SKUs ({sup.totalOrderQty} units)
                          </div>
                          {srm && (
                            <div
                              className={`text-[10px] font-semibold mt-0.5 truncate ${
                                srm.grade === 'A'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : srm.grade === 'B'
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              SRM {srm.compositeScore}/100 ({srm.gradeLabel})
                            </div>
                          )}
                        </div>
                        <div className="text-right font-mono font-bold text-[#0F4C3A] dark:text-emerald-400 text-xs shrink-0">
                          {formatIDR(sup.totalAmountIDR)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Filter bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 pt-3 border-t border-gray-200 dark:border-slate-800/80">
              <div className="flex items-center gap-1.5 flex-wrap">
                {(
                  [
                    { id: 'ALL', label: 'All Items' },
                    { id: 'CRITICAL_OUT_OF_STOCK', label: 'Critical (0 Stock)' },
                    { id: 'BELOW_SAFETY_STOCK', label: 'Below Safety Stock' },
                    { id: 'HEALTHY_STOCK', label: 'Healthy Stock' },
                    { id: 'OVERSTOCKED', label: 'Overstocked' },
                  ] as const
                ).map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setUrgencyFilter(u.id)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      urgencyFilter === u.id
                        ? 'bg-[#0F4C3A] text-white shadow-xs'
                        : isLight
                        ? 'text-gray-600 hover:bg-gray-100'
                        : 'text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {u.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search SKU, product or vendor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border focus:outline-none ${
                    isLight
                      ? 'bg-white border-gray-200 text-gray-900 focus:border-[#0F4C3A]'
                      : 'bg-[#090A0F] border-slate-800/80 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-xs">
              <thead>
                <tr className={`border-b text-[10px] uppercase font-semibold tracking-wider ${
                  isLight ? 'border-gray-200 bg-gray-50/70 text-gray-500' : 'border-slate-800/80 bg-[#090A0F] text-slate-400'
                }`}>
                  <th className="py-3 px-3 text-center w-10">Select</th>
                  <th className="py-3 px-4">SKU &amp; Product Details</th>
                  <th className="py-3 px-3">Category / Zone</th>
                  <th className="py-3 px-3 text-center">Available / Safety</th>
                  <th className="py-3 px-3 text-center">Velocity &amp; Lead</th>
                  <th className="py-3 px-3 text-center">Reorder Point</th>
                  <th className="py-3 px-3 text-center">Suggested PO Qty</th>
                  <th className="py-3 px-4">Est. Restock Cost</th>
                  <th className="py-3 px-3 text-center">Urgency</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isLight ? 'divide-gray-200' : 'divide-slate-800/80'}`}>
                {filteredReplenishmentItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      {isLoadingPlan ? 'Calculating replenishment algorithm...' : 'No inventory items match the selected filter.'}
                    </td>
                  </tr>
                ) : (
                  filteredReplenishmentItems.map((item) => {
                    const isSelected = selectedReplenishmentSkus.includes(item.sku);
                    return (
                      <tr
                        key={item.sku}
                        className={`transition-colors ${
                          isSelected
                            ? isLight ? 'bg-emerald-50/70' : 'bg-emerald-950/20'
                            : item.isReorderTriggered
                            ? isLight ? 'bg-rose-50/30 hover:bg-rose-50/60' : 'bg-rose-950/10 hover:bg-rose-950/20'
                            : isLight ? 'hover:bg-gray-50' : 'hover:bg-slate-900/60'
                        }`}
                      >
                        <td className="py-3 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectSku(item.sku)}
                            className="rounded border-gray-300 text-[#0F4C3A] focus:ring-[#0F4C3A] cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <div className={`font-bold ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                            {item.productName}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {item.sku} • {item.supplierName}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="capitalize font-semibold text-slate-600 dark:text-slate-300">
                            {item.category.replace('_', ' ')}
                          </span>
                          <div className="text-[10px] text-slate-400">Zone {item.warehouseZoneId}</div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`font-mono font-bold ${
                            item.availableStock === 0 ? 'text-rose-600 font-black' : item.availableStock < item.safetyStockBuffer ? 'text-amber-600' : ''
                          }`}>
                            {item.availableStock}
                          </span>
                          <span className="text-slate-400 text-[11px]"> / {item.safetyStockBuffer} min</span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="font-mono text-xs font-semibold">
                            {item.dailySalesVelocity} <span className="text-[10px] text-slate-400">units/day</span>
                          </div>
                          <div className="text-[10px] text-slate-400">Lead: {item.supplierLeadTimeDays}d</div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="font-mono font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300">
                            {item.reorderPoint}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`font-mono font-black text-sm ${item.suggestedOrderQty > 0 ? 'text-[#0F4C3A] dark:text-emerald-400' : 'text-slate-400'}`}>
                            {item.suggestedOrderQty > 0 ? `+${item.suggestedOrderQty}` : '0'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                          {canViewValuation ? (
                            <>
                              {formatIDR(item.estimatedOrderCostIDR)}
                              <div className="text-[10px] text-slate-400 font-normal">
                                @{formatIDR(item.unitCost)}/unit
                              </div>
                              {(() => {
                                const hist = getLocalLastPoPrice(item.sku, item.supplierName);
                                if (!hist) return null;
                                const diffPct =
                                  hist.price > 0 ? Math.round(((item.unitCost - hist.price) / hist.price) * 100) : 0;
                                return (
                                  <div
                                    className={`text-[10px] font-normal mt-0.5 ${
                                      diffPct > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'
                                    }`}
                                    title={`Last bought from ${hist.vendorName || item.supplierName} (${hist.docRef})`}
                                  >
                                    Last bought: {formatIDR(hist.price)} on {hist.date}
                                    {diffPct > 0 ? ` (+${diffPct}%)` : diffPct < 0 ? ` (${diffPct}%)` : ''}
                                  </div>
                                );
                              })()}
                            </>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {item.urgencyLevel === 'CRITICAL_OUT_OF_STOCK' && (
                            <span className="inline-flex items-center gap-1 whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                              <AlertTriangle className="w-3 h-3" /> Critical 0
                            </span>
                          )}
                          {item.urgencyLevel === 'BELOW_SAFETY_STOCK' && (
                            <span className="inline-flex items-center gap-1 whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                              <ShieldAlert className="w-3 h-3" /> Below Safety
                            </span>
                          )}
                          {item.urgencyLevel === 'HEALTHY_STOCK' && (
                            <span className="inline-flex items-center gap-1 whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                              <CheckCircle2 className="w-3 h-3" /> Healthy Stock
                            </span>
                          )}
                          {item.urgencyLevel === 'OVERSTOCKED' && (
                            <span className="inline-flex items-center gap-1 whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                              <Clock className="w-3 h-3" /> Overstocked
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 1: PURCHASE REQUESTS (PR) */}
      {(activeTab === 'pr') && (
      <div className="space-y-4">
        {!isWarehouseRole && reorderSuggestions && (() => {
          const urgentItems = reorderSuggestions.items
            .filter((f) => f.urgencyStatus === 'STOCKOUT_IMMINENT' || f.urgencyStatus === 'REORDER_SOON')
            .slice(0, 6);
          if (urgentItems.length === 0) return null;
          return (
            <div
              className={`rounded-2xl border p-4 space-y-3 ${
                isLight ? 'bg-amber-50/50 border-amber-200' : 'bg-amber-950/15 border-amber-800/40'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <div>
                    <h4 className={`text-xs font-bold ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                      One-Click Reorder Recommendations ({urgentItems.length} SKUs at/below safety stock)
                    </h4>
                    <p className={`text-[11px] ${isLight ? 'text-gray-600' : 'text-slate-400'}`}>
                      Based on 30-day average daily sales velocity &amp; lead time — routes automatically to top-graded SRM vendor.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {canManagePrPo && (
                    <button
                      type="button"
                      disabled={isCreatingQuickPR !== null}
                      onClick={() =>
                        handleOneClickReorderPR(
                          urgentItems.map((u) => ({
                            sku: u.sku,
                            quantity: u.recommendedReorderQty,
                            supplierName: u.recommendedSupplierName,
                          })),
                          'ALL'
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-[11px] font-bold transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-300" />
                      {isCreatingQuickPR === 'ALL' ? 'Generating...' : `Generate All ${urgentItems.length} Draft PRs`}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowReorderWidget((v) => !v)}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border cursor-pointer ${
                      isLight ? 'bg-white border-amber-200 text-gray-700' : 'bg-slate-900/90 border-slate-800/80 text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {showReorderWidget ? 'Collapse' : 'Show'}
                  </button>
                </div>
              </div>

              {showReorderWidget && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {urgentItems.map((item) => (
                    <div
                      key={item.sku}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                        isLight ? 'bg-white border-amber-200/80' : 'bg-[#12141C] border-slate-800/80'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                              item.urgencyStatus === 'STOCKOUT_IMMINENT'
                                ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                                : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {item.urgencyStatus === 'STOCKOUT_IMMINENT' ? 'Critical' : 'Reorder Soon'}
                          </span>
                          <span className="font-mono text-[10px] text-gray-500 dark:text-slate-400">{item.sku}</span>
                        </div>
                        <div className={`text-xs font-bold truncate mt-0.5 ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                          {item.productName}
                        </div>
                        <div className={`text-[10px] font-mono ${isLight ? 'text-gray-600' : 'text-slate-300'}`}>
                          ATP {item.availableStock} • Avg {item.adjustedDailySales}/day • Sugg: +{item.recommendedReorderQty}
                        </div>
                      </div>
                      {canManagePrPo && (
                        <button
                          type="button"
                          disabled={isCreatingQuickPR !== null}
                          onClick={() =>
                            handleOneClickReorderPR(
                              [
                                {
                                  sku: item.sku,
                                  quantity: item.recommendedReorderQty,
                                  supplierName: item.recommendedSupplierName,
                                },
                              ],
                              item.sku
                            )
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-[10px] font-bold whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
                        >
                          {isCreatingQuickPR === item.sku ? 'Creating...' : 'Create Draft PR'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      <div
        className={`rounded-2xl border transition-all overflow-hidden ${
          isLight
            ? 'bg-white border-gray-200/90 shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
            : 'bg-[#12141C] border-slate-800/80'
        }`}
      >
        <div className={`p-5 border-b ${isLight ? 'border-gray-200 bg-gray-50/50' : 'border-slate-800/80 bg-[#090A0F]'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-slate-100'} flex items-center gap-2`}>
                <Clock className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
                Purchase Requests (PR) Restock Triggers
              </h3>
              <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-slate-400'} mt-0.5`}>
                Automated threshold monitoring &amp; manual store manager replenishment requests
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {(['ALL', 'pending', 'approved'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setPrFilter(status)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all capitalize ${
                      prFilter === status
                        ? 'bg-[#0F4C3A] text-white shadow-xs'
                        : isLight
                        ? 'text-gray-600 hover:bg-gray-100'
                        : 'text-slate-400 hover:bg-slate-900/90'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead>
              <tr className={`border-b text-[10px] uppercase font-semibold tracking-wider ${
                isLight ? 'border-gray-200 bg-gray-50/70 text-gray-500' : 'border-slate-800/80 bg-[#090A0F] text-slate-400'
              }`}>
                <th className="py-3 px-4">PR Number</th>
                <th className="py-3 px-4">Outlet Hub</th>
                <th className="py-3 px-4">Requested Item</th>
                <th className="py-3 px-4 text-center">Quantity</th>
                <th className="py-3 px-4">Est. Cost</th>
                <th className="py-3 px-4">Trigger / Priority</th>
                <th className="py-3 px-4 text-right">Status / Action</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isLight ? 'divide-gray-200' : 'divide-slate-800/80'}`}>
              {filteredPRs.length === 0 ? (
                <tr>
                  <td colSpan={7} className={`py-8 text-center text-xs ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                    No purchase requests matching current criteria.
                  </td>
                </tr>
              ) : (
                filteredPRs.map((pr) => {
                  const linkedPoIds = Array.from(
                    new Set([...(pr.linkedPoIds || []), ...(pr.poId ? [pr.poId] : [])].filter(Boolean))
                  );
                  const isRowHighlighted = highlightedDocId === pr.id;
                  return (
                  <tr
                    key={pr.id}
                    data-doc-id={pr.id}
                    className={`transition-colors ${
                      isRowHighlighted
                        ? isLight
                          ? 'bg-emerald-50/90 ring-1 ring-inset ring-emerald-500/60'
                          : 'bg-emerald-950/35 ring-1 ring-inset ring-emerald-500/60'
                        : isLight
                        ? 'hover:bg-gray-50/80'
                        : 'hover:bg-slate-900/60'
                    }`}
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-[#0F4C3A] dark:text-emerald-400">
                      <div>{pr.id}</div>
                      {linkedPoIds.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {linkedPoIds.map((poId) => (
                            <button
                              key={poId}
                              type="button"
                              onClick={() => jumpToSubDoc('po', poId)}
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold cursor-pointer ${
                                isLight
                                  ? 'bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100'
                                  : 'bg-sky-950/40 border-sky-800/60 text-sky-300 hover:bg-sky-900/60'
                              }`}
                              title={`Jump to ${poId}`}
                            >
                              {poId}
                              <ExternalLink className="w-2.5 h-2.5" />
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className={`py-3.5 px-4 ${isLight ? 'text-gray-700' : 'text-slate-300'}`}>
                      {pr.storeName || 'Senopati Flagship'}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className={`font-semibold ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                        {pr.productName}
                      </div>
                      <div className={`font-mono text-[10px] ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                        {pr.sku}
                      </div>
                    </td>
                    <td className={`py-3.5 px-4 text-center font-mono font-bold ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                      {pr.suggestedQuantity}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-[#0F4C3A] dark:text-emerald-400">
                      <div>{formatIDR(pr.totalEstimatedCost)}</div>
                      {(() => {
                        const hist = getLocalLastPoPrice(pr.sku);
                        if (!hist || pr.suggestedQuantity <= 0) return null;
                        const estUnit = Math.round(pr.totalEstimatedCost / pr.suggestedQuantity);
                        const diffPct = hist.price > 0 ? Math.round(((estUnit - hist.price) / hist.price) * 100) : 0;
                        return (
                          <div className={`text-[10px] font-normal mt-0.5 ${diffPct > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-slate-400'}`}>
                            Last: {formatIDR(hist.price)} ({hist.date}) {diffPct > 0 ? `▲+${diffPct}%` : diffPct < 0 ? `▼${diffPct}%` : ''}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                          pr.priority === 'high'
                            ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20'
                            : pr.priority === 'medium'
                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                            : isLight
                            ? 'bg-gray-100 text-gray-700'
                            : 'bg-slate-900/90 text-slate-300 border border-slate-800/80'
                        }`}>
                          {pr.priority}
                        </span>
                        <span className={`text-[11px] capitalize ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                          {pr.reason.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {pr.status === 'pending' ? (
                          canApprovePrPo ? (
                            <button
                              onClick={() => handleApprovePR(pr.id)}
                              className="px-3 py-1 bg-[#0F4C3A] hover:bg-[#0b382b] text-white font-semibold text-xs rounded-lg transition-all shadow-xs"
                            >
                              Approve → PO
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                              Pending Approval
                            </span>
                          )
                        ) : linkedPoIds.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => jumpToSubDoc('po', linkedPoIds[0])}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            PO #{linkedPoIds[0]}
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Approved
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setDispatchDoc({
                              channel: 'email',
                              docType: 'PR',
                              docId: pr.id,
                              docNumber: pr.id,
                              docSummary: `Item: ${pr.sku} — ${pr.productName}\nQty: ${pr.suggestedQuantity} units | Est. Total: ${formatIDR(pr.totalEstimatedCost)}`,
                              recipientName: pr.requestedBy || 'Procurement Manager',
                              recipientEmail: 'procurement@grocemart.co.id',
                            })
                          }
                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                            isLight ? 'border-gray-200 text-indigo-700 hover:bg-indigo-50' : 'border-slate-800/80 text-indigo-300 hover:bg-slate-800'
                          }`}
                          title="Email Purchase Request"
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDispatchDoc({
                              channel: 'whatsapp',
                              docType: 'PR',
                              docId: pr.id,
                              docNumber: pr.id,
                              docSummary: `Item: ${pr.sku} — ${pr.productName}\nQty: ${pr.suggestedQuantity} units | Est. Total: ${formatIDR(pr.totalEstimatedCost)}`,
                              recipientName: pr.requestedBy || 'Procurement Manager',
                              recipientPhone: '081190001122',
                            })
                          }
                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                            isLight ? 'border-gray-200 text-emerald-700 hover:bg-emerald-50' : 'border-slate-800/80 text-emerald-400 hover:bg-slate-800'
                          }`}
                          title="Send Purchase Request via WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>
      )}

      {/* SECTION 2: PURCHASE ORDERS WITH PARTIAL SHIPMENT SUPPORT */}
      {(activeTab === 'po') && (
      <div
        className={`rounded-2xl border transition-all overflow-hidden ${
          isLight
            ? 'bg-white border-gray-200/90 shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
            : 'bg-[#12141C] border-slate-800/80'
        }`}
      >
        <div className={`p-5 border-b ${isLight ? 'border-gray-200 bg-gray-50/50' : 'border-slate-800/80 bg-[#090A0F]'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-slate-100'} flex items-center gap-2`}>
                <FileCheck2 className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
                Purchase Orders (PO) &amp; Partial Shipment Tracking
              </h3>
              <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-slate-400'} mt-0.5`}>
                Vendor agreements with real-time backorder tracking and split-fulfillment delivery workflows
              </p>
            </div>

            <div className="flex items-center gap-1 flex-wrap">
              {(['ALL', 'Pending', 'Partially Received', 'Completed'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setPoFilter(status)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                    poFilter === status
                      ? 'bg-[#0F4C3A] text-white shadow-xs'
                      : isLight
                      ? 'text-gray-600 hover:bg-gray-100'
                      : 'text-slate-400 hover:bg-slate-900/90'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead>
              <tr className={`border-b text-[10px] uppercase font-semibold tracking-wider ${
                isLight ? 'border-gray-200 bg-gray-50/70 text-gray-500' : 'border-slate-800/80 bg-[#090A0F] text-slate-400'
              }`}>
                <th className="py-3 px-4">PO Number</th>
                <th className="py-3 px-4">Vendor &amp; Destination</th>
                <th className="py-3 px-4">Ordered Items</th>
                <th className="py-3 px-4">Fulfillment Progress</th>
                <th className="py-3 px-4">Total Value</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isLight ? 'divide-gray-200' : 'divide-slate-800/80'}`}>
              {filteredPOs.length === 0 ? (
                <tr>
                  <td colSpan={7} className={`py-8 text-center text-xs ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                    No purchase orders matching current criteria.
                  </td>
                </tr>
              ) : (
                filteredPOs.map((po) => {
                  const totalOrdered = po.items.reduce((s, i) => s + i.orderedQuantity, 0);
                  const totalReceived = po.items.reduce((s, i) => s + (i.receivedQuantity || 0), 0);
                  const totalBackorder = po.items.reduce((s, i) => s + (i.remainingBackorder || 0), 0);
                  const percent = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;
                  const poPrId = po.sourcePrId || po.prId;
                  const poGrs = goodsReceipts.filter((g) => g.poId === po.id);
                  const linkedGrIds = Array.from(
                    new Set([...(po.linkedGrIds || []), ...(po.goodsReceiptIds || []), ...poGrs.map((g) => g.id)].filter(Boolean))
                  );
                  const activeBillsForPo = vendorBills.filter((b) => b.status !== 'VOID' && b.poId === po.id);
                  const poTotalReceivedQty = poGrs.reduce(
                    (s, g) => s + g.items.reduce((isum, it) => isum + it.quantityReceived, 0),
                    0
                  );
                  const poTotalBilledQty = activeBillsForPo.reduce(
                    (s, b) => s + b.items.reduce((isum, it) => isum + (it.billedQuantity || 0), 0),
                    0
                  );
                  const poHasUnbilledGrQty = poGrs.length > 0 && poTotalReceivedQty > poTotalBilledQty;
                  const poApprovedOrReceived = !['Draft', 'PENDING_APPROVAL', 'pending_approval', 'REJECTED', 'Cancelled'].includes(
                    po.status
                  );
                  const isRowHighlighted = highlightedDocId === po.id;

                  return (
                    <tr
                      key={po.id}
                      data-doc-id={po.id}
                      className={`transition-colors ${
                        isRowHighlighted
                          ? isLight
                            ? 'bg-emerald-50/90 ring-1 ring-inset ring-emerald-500/60'
                            : 'bg-emerald-950/35 ring-1 ring-inset ring-emerald-500/60'
                          : isLight
                          ? 'hover:bg-gray-50/80'
                          : 'hover:bg-slate-900/60'
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-[#0F4C3A] dark:text-emerald-400">
                          {po.id}
                        </span>
                        <div className={`text-[10px] ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                          Expected: {po.expectedDeliveryDate}
                        </div>
                        {(poPrId || linkedGrIds.length > 0 || (canViewVendorBill && activeBillsForPo.length > 0)) && (
                          <div className="flex flex-wrap gap-1 mt-1.5 font-mono">
                            {poPrId && (
                              <button
                                type="button"
                                onClick={() => jumpToSubDoc('pr', poPrId)}
                                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[10px] font-semibold cursor-pointer ${
                                  isLight
                                    ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                                    : 'bg-slate-900/90 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                                }`}
                                title={`Jump to PR ${poPrId}`}
                              >
                                {poPrId}
                                <ExternalLink className="w-2.5 h-2.5" />
                              </button>
                            )}
                            {linkedGrIds.map((grId) => (
                              <button
                                key={grId}
                                type="button"
                                onClick={() => jumpToSubDoc('gr', grId)}
                                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[10px] font-semibold cursor-pointer ${
                                  isLight
                                    ? 'bg-emerald-50 border-emerald-200 text-[#0F4C3A] hover:bg-emerald-100'
                                    : 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300 hover:bg-emerald-900/60'
                                }`}
                                title={`Jump to GR ${grId}`}
                              >
                                {grId}
                                <ExternalLink className="w-2.5 h-2.5" />
                              </button>
                            ))}
                            {canViewVendorBill &&
                              activeBillsForPo.map((bill) => (
                                <button
                                  key={bill.id}
                                  type="button"
                                  onClick={() => openVendorBillView(bill.id, po.id)}
                                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[10px] font-semibold cursor-pointer ${
                                    isLight
                                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                                      : 'bg-indigo-950/40 border-indigo-800/60 text-indigo-300 hover:bg-indigo-900/60'
                                  }`}
                                  title={`Open Vendor Bill ${bill.id}`}
                                >
                                  {bill.id}
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </button>
                              ))}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className={`font-semibold ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                          {po.supplierName}
                        </div>
                        <div className={`text-[11px] ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                          {po.storeName}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        {po.items.map((item, idx) => (
                          <div key={idx} className="text-[11px]">
                            <span className={`font-medium ${isLight ? 'text-gray-800' : 'text-slate-200'}`}>
                              {item.productName}
                            </span>
                            <span className={`ml-1 font-mono ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                              ({item.receivedQuantity}/{item.orderedQuantity} rcvd)
                            </span>
                          </div>
                        ))}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-24 h-2 rounded-full overflow-hidden ${isLight ? 'bg-gray-200' : 'bg-slate-800'}`}>
                            <div
                              className={`h-full rounded-full transition-all ${
                                po.status === 'Completed'
                                  ? 'bg-[#0F4C3A] dark:bg-emerald-500'
                                  : 'bg-blue-500'
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <span className={`font-mono text-xs font-semibold ${isLight ? 'text-gray-700' : 'text-slate-300'}`}>
                            {percent}%
                          </span>
                        </div>
                        {totalBackorder > 0 && (
                          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                            {totalBackorder} units backorder
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-semibold text-[#0F4C3A] dark:text-emerald-400">
                        {formatIDR(po.totalCost)}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            po.status === 'Completed' || po.status === 'APPROVED'
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                              : po.status === 'Partially Received'
                              ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30'
                              : po.status === 'REJECTED' || po.status === 'Cancelled'
                              ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
                              : po.status === 'PENDING_APPROVAL' || po.status === 'pending_approval'
                              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                              : isLight
                              ? 'bg-gray-100 text-gray-700 border-gray-300'
                              : 'bg-slate-900/90 text-slate-300 border-slate-800/80'
                          }`}
                        >
                          {po.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {po.status !== 'Completed' && po.status !== 'Cancelled' && po.status !== 'REJECTED' ? (
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {canApprovePrPo && (po.status === 'PENDING_APPROVAL' || po.status === 'pending_approval' || po.status === 'Draft') && (
                              <button
                                type="button"
                                disabled={approvingPoId === po.id}
                                onClick={() => handleApprovePO(po.id)}
                                className="px-3 py-1 bg-[#0F4C3A] hover:bg-[#0b382b] text-white font-semibold text-xs rounded-lg transition-all shadow-xs disabled:opacity-60 cursor-pointer"
                              >
                                {approvingPoId === po.id ? 'Approving...' : 'Approve PO'}
                              </button>
                            )}
                            {canReceiveGR && po.status !== 'PENDING_APPROVAL' && po.status !== 'pending_approval' && (
                              <button
                                onClick={() => openReceivingModal(po)}
                                className="px-3 py-1 bg-[#0F4C3A] hover:bg-[#0b382b] text-white font-semibold text-xs rounded-lg transition-all shadow-xs"
                              >
                                Receive GR
                              </button>
                            )}
                            {canCreateVendorBill && poApprovedOrReceived && poHasUnbilledGrQty && (
                              <button
                                type="button"
                                onClick={() => openVendorBillCreate(po.id, poGrs[0]?.id, poGrs.map((g) => g.id))}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 transition-colors cursor-pointer"
                                title="Create Vendor Bill for unbilled received goods"
                              >
                                Create Vendor Bill
                              </button>
                            )}
                            {canViewVendorBill && activeBillsForPo.length > 0 && (
                              <button
                                type="button"
                                onClick={() => openVendorBillView(activeBillsForPo[0].id, po.id)}
                                className={`px-2 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                                  isLight
                                    ? 'bg-emerald-50 text-[#0F4C3A] border-emerald-200 hover:bg-emerald-100'
                                    : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/60'
                                }`}
                                title={`View Vendor Bill #${activeBillsForPo[0].id}`}
                              >
                                View Bill (#{activeBillsForPo[0].id})
                              </button>
                            )}
                            {canManagePrPo && totalBackorder > 0 && (
                              <button
                                onClick={() => {
                                  setForceClosingPO(po);
                                  setForceCloseNotes('');
                                }}
                                className={`px-2 py-1 text-xs font-semibold rounded-lg border transition-all ${
                                  isLight
                                    ? 'bg-white hover:bg-gray-100 text-gray-700 border-gray-300 shadow-2xs'
                                    : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border-slate-800/80'
                                }`}
                                title="Close unfulfilled backorder balance with written adjustment notes"
                              >
                                Close PO
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setDispatchDoc({
                                  channel: 'email',
                                  docType: 'PO',
                                  docId: po.id,
                                  docNumber: po.poNumber || po.id,
                                  docSummary: `Supplier: ${po.supplierName}\nDestination: ${po.storeName}\nTotal Cost: ${formatIDR(po.totalCost)} (${po.items.length} items)`,
                                  recipientName: po.supplierName,
                                  recipientEmail: po.supplierContact?.includes('@') ? po.supplierContact : 'orders@vendor-partner.co.id',
                                  recipientPhone: po.supplierContact && !po.supplierContact.includes('@') ? po.supplierContact : '081288001122',
                                })
                              }
                              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                isLight ? 'border-gray-200 text-indigo-700 hover:bg-indigo-50' : 'border-slate-800/80 text-indigo-300 hover:bg-slate-800'
                              }`}
                              title="Email Purchase Order to Supplier"
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDispatchDoc({
                                  channel: 'whatsapp',
                                  docType: 'PO',
                                  docId: po.id,
                                  docNumber: po.poNumber || po.id,
                                  docSummary: `Supplier: ${po.supplierName}\nDestination: ${po.storeName}\nTotal Cost: ${formatIDR(po.totalCost)} (${po.items.length} items)`,
                                  recipientName: po.supplierName,
                                  recipientEmail: po.supplierContact?.includes('@') ? po.supplierContact : 'orders@vendor-partner.co.id',
                                  recipientPhone: po.supplierContact && !po.supplierContact.includes('@') ? po.supplierContact : '081288001122',
                                })
                              }
                              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                isLight ? 'border-gray-200 text-emerald-700 hover:bg-emerald-50' : 'border-slate-800/80 text-emerald-400 hover:bg-slate-800'
                              }`}
                              title="Send Purchase Order via WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </button>
                            {!canReceiveGR && !canCreateVendorBill && !canManagePrPo && (
                              <span className="text-[11px] text-gray-400 font-mono">View Only</span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2 flex-wrap">
                            <div>
                              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 block">
                                Completed
                              </span>
                              {po.closureNotes && (
                                <span className="text-[10px] text-amber-600 dark:text-amber-400 block max-w-xs truncate" title={po.closureNotes}>
                                  Note: {po.closureNotes}
                                </span>
                              )}
                            </div>
                            {canCreateVendorBill && poApprovedOrReceived && poHasUnbilledGrQty && (
                              <button
                                type="button"
                                onClick={() => openVendorBillCreate(po.id, poGrs[0]?.id, poGrs.map((g) => g.id))}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 transition-colors cursor-pointer"
                                title="Create Vendor Bill for unbilled received goods"
                              >
                                Create Vendor Bill
                              </button>
                            )}
                            {canViewVendorBill && activeBillsForPo.length > 0 && (
                              <button
                                type="button"
                                onClick={() => openVendorBillView(activeBillsForPo[0].id, po.id)}
                                className={`px-2 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                                  isLight
                                    ? 'bg-emerald-50 text-[#0F4C3A] border-emerald-200 hover:bg-emerald-100'
                                    : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/60'
                                }`}
                                title={`View Vendor Bill #${activeBillsForPo[0].id}`}
                              >
                                View Bill (#{activeBillsForPo[0].id})
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setDispatchDoc({
                                  channel: 'email',
                                  docType: 'PO',
                                  docId: po.id,
                                  docNumber: po.poNumber || po.id,
                                  docSummary: `Supplier: ${po.supplierName}\nDestination: ${po.storeName}\nTotal Cost: ${formatIDR(po.totalCost)} (Completed)`,
                                  recipientName: po.supplierName,
                                  recipientEmail: po.supplierContact?.includes('@') ? po.supplierContact : 'orders@vendor-partner.co.id',
                                  recipientPhone: po.supplierContact && !po.supplierContact.includes('@') ? po.supplierContact : '081288001122',
                                })
                              }
                              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                isLight ? 'border-gray-200 text-indigo-700 hover:bg-indigo-50' : 'border-slate-800/80 text-indigo-300 hover:bg-slate-800'
                              }`}
                              title="Email Purchase Order"
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDispatchDoc({
                                  channel: 'whatsapp',
                                  docType: 'PO',
                                  docId: po.id,
                                  docNumber: po.poNumber || po.id,
                                  docSummary: `Supplier: ${po.supplierName}\nDestination: ${po.storeName}\nTotal Cost: ${formatIDR(po.totalCost)} (Completed)`,
                                  recipientName: po.supplierName,
                                  recipientEmail: po.supplierContact?.includes('@') ? po.supplierContact : 'orders@vendor-partner.co.id',
                                  recipientPhone: po.supplierContact && !po.supplierContact.includes('@') ? po.supplierContact : '081288001122',
                                })
                              }
                              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                isLight ? 'border-gray-200 text-emerald-700 hover:bg-emerald-50' : 'border-slate-800/80 text-emerald-400 hover:bg-slate-800'
                              }`}
                              title="Send Purchase Order via WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* SECTION 3: GOODS RECEIPTS (GR) LOG */}
      {(activeTab === 'gr') && (
      <div
        className={`rounded-2xl border transition-all overflow-hidden ${
          isLight
            ? 'bg-white border-gray-200/90 shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
            : 'bg-[#12141C] border-slate-800/80'
        }`}
      >
        <div className={`p-5 border-b ${isLight ? 'border-gray-200 bg-gray-50/50' : 'border-slate-800/80 bg-[#090A0F]'}`}>
          <h3 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-slate-100'} flex items-center gap-2`}>
            <Truck className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
            Goods Receipts (GR) Delivery Log
          </h3>
          <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-slate-400'} mt-0.5`}>
            Surat Jalan records, cold-chain temperature verification, and automated General Ledger voucher links
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead>
              <tr className={`border-b text-[10px] uppercase font-semibold tracking-wider ${
                isLight ? 'border-gray-200 bg-gray-50/70 text-gray-500' : 'border-slate-800/80 bg-[#090A0F] text-slate-400'
              }`}>
                <th className="py-3 px-4">GR Number</th>
                <th className="py-3 px-4">Surat Jalan Note</th>
                <th className="py-3 px-4">PO Reference</th>
                <th className="py-3 px-4">Vendor / Store</th>
                <th className="py-3 px-4">Shipment Type</th>
                <th className="py-3 px-4">Officer / Temp</th>
                <th className="py-3 px-4">Linked GL Voucher</th>
                <th className="py-3 px-4 text-right">AP Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isLight ? 'divide-gray-200' : 'divide-slate-800/80'}`}>
              {filteredGRs.length === 0 ? (
                <tr>
                  <td colSpan={8} className={`py-8 text-center text-xs ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                    No goods receipts recorded yet.
                  </td>
                </tr>
              ) : (
                filteredGRs.map((gr) => {
                  const activeBillsForGr = vendorBills.filter(
                    (b) =>
                      b.status !== 'VOID' &&
                      b.poId === gr.poId &&
                      (b.goodsReceiptId === gr.id || (b.linkedGrIds || []).includes(gr.id))
                  );
                  const grTotalReceived = gr.items.reduce((s, it) => s + it.quantityReceived, 0);
                  const activeBillsForPo = vendorBills.filter((b) => b.status !== 'VOID' && b.poId === gr.poId);
                  const poGrs = goodsReceipts.filter((g) => g.poId === gr.poId);
                  const poReceivedQty = poGrs.reduce(
                    (s, g) => s + g.items.reduce((isum, it) => isum + it.quantityReceived, 0),
                    0
                  );
                  const poBilledQty = activeBillsForPo.reduce(
                    (s, b) => s + b.items.reduce((isum, it) => isum + (it.billedQuantity || 0), 0),
                    0
                  );
                  const grHasUnbilledQty = activeBillsForGr.length === 0 && grTotalReceived > 0 && poReceivedQty > poBilledQty;
                  const isRowHighlighted = highlightedDocId === gr.id;

                  return (
                  <tr
                    key={gr.id}
                    data-doc-id={gr.id}
                    className={`transition-colors ${
                      isRowHighlighted
                        ? isLight
                          ? 'bg-emerald-50/90 ring-1 ring-inset ring-emerald-500/60'
                          : 'bg-emerald-950/35 ring-1 ring-inset ring-emerald-500/60'
                        : isLight
                        ? 'hover:bg-gray-50/80'
                        : 'hover:bg-slate-900/60'
                    }`}
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-[#0F4C3A] dark:text-emerald-400">
                      <div>{gr.id}</div>
                      {canViewVendorBill && activeBillsForGr.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {activeBillsForGr.map((bill) => (
                            <button
                              key={bill.id}
                              type="button"
                              onClick={() => openVendorBillView(bill.id, gr.poId)}
                              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[10px] font-semibold cursor-pointer ${
                                isLight
                                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                                  : 'bg-indigo-950/40 border-indigo-800/60 text-indigo-300 hover:bg-indigo-900/60'
                              }`}
                              title={`Open Vendor Bill ${bill.id}`}
                            >
                              {bill.id}
                              <ExternalLink className="w-2.5 h-2.5" />
                            </button>
                          ))}
                        </div>
                      )}
                      {gr.linkedReturnIds && gr.linkedReturnIds.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {gr.linkedReturnIds.map((retId) => (
                            <span
                              key={retId}
                              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[10px] font-mono font-semibold ${
                                isLight
                                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                                  : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
                              }`}
                              title={`Coretax Purchase Return Debit Note ${retId}`}
                            >
                              {retId}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className={`py-3.5 px-4 font-mono ${isLight ? 'text-gray-800' : 'text-slate-200'}`}>
                      {gr.deliveryNoteNumber}
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      <div className="flex flex-wrap items-center gap-1">
                        {purchaseOrders.some((p) => p.id === gr.poId) ? (
                          <button
                            type="button"
                            onClick={() => jumpToSubDoc('po', gr.poId)}
                            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[10px] font-semibold cursor-pointer ${
                              isLight
                                ? 'bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100'
                                : 'bg-sky-950/40 border-sky-800/60 text-sky-300 hover:bg-sky-900/60'
                            }`}
                            title={`Jump to PO ${gr.poId}`}
                          >
                            {gr.poId}
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        ) : (
                          <span className="text-blue-600 dark:text-blue-400">{gr.poId}</span>
                        )}
                        {gr.sourcePrId && (
                          <button
                            type="button"
                            onClick={() => jumpToSubDoc('pr', gr.sourcePrId!)}
                            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[10px] font-semibold cursor-pointer ${
                              isLight
                                ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                                : 'bg-slate-900/90 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                            }`}
                            title={`Jump to PR ${gr.sourcePrId}`}
                          >
                            {gr.sourcePrId}
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className={`font-semibold ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                        {gr.vendorName}
                      </div>
                      <div className={`text-[10px] ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                        {gr.storeName}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          gr.isPartial
                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                            : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                        }`}
                      >
                        {gr.isPartial ? 'Partial Delivery' : 'Full Delivery'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className={isLight ? 'text-gray-800' : 'text-slate-200'}>{gr.receivedBy}</div>
                      <div className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        <Thermometer className="w-3 h-3" />
                        {gr.items[0]?.tempCheckCelsius ? `${gr.items[0].tempCheckCelsius}°C Verified` : 'Temp OK'}
                      </div>
                    </td>
                    <td className={`py-3.5 px-4 font-mono text-[11px] ${isLight ? 'text-gray-600' : 'text-slate-300'}`}>
                      {gr.glEntryId || 'GLE-Posted'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canCreateVendorBill && grHasUnbilledQty ? (
                          <button
                            type="button"
                            onClick={() => openVendorBillCreate(gr.poId, gr.id, [gr.id])}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 transition-colors cursor-pointer"
                            title="Create Vendor Bill for this Goods Receipt"
                          >
                            Create Vendor Bill
                          </button>
                        ) : canViewVendorBill && activeBillsForGr.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => openVendorBillView(activeBillsForGr[0].id, gr.poId)}
                            className={`px-2 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                              isLight
                                ? 'bg-emerald-50 text-[#0F4C3A] border-emerald-200 hover:bg-emerald-100'
                                : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/60'
                            }`}
                            title={`View Vendor Bill #${activeBillsForGr[0].id}`}
                          >
                            View Bill (#{activeBillsForGr[0].id})
                          </button>
                        ) : (
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                            Verified
                          </span>
                        )}
                        {canIssuePurchaseReturn && gr.items.length > 0 && (
                          <button
                            type="button"
                            onClick={() => openPurchaseReturnModal(gr)}
                            className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                              isLight
                                ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                : 'bg-rose-950/40 text-rose-300 border-rose-800/60 hover:bg-rose-900/60'
                            }`}
                            title="Issue Purchase Return & Coretax Debit Note (NRP)"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Return / Debit Note</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setDispatchDoc({
                              channel: 'email',
                              docType: 'GR',
                              docId: gr.id,
                              docNumber: gr.id,
                              docSummary: `PO Ref: ${gr.poId} | Vendor: ${gr.vendorName}\nDelivery Note: ${gr.deliveryNoteNumber} | Received By: ${gr.receivedBy}`,
                              recipientName: gr.vendorName,
                              recipientEmail: 'receiving-ack@vendor-partner.co.id',
                            })
                          }
                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                            isLight ? 'border-gray-200 text-indigo-700 hover:bg-indigo-50' : 'border-slate-800/80 text-indigo-300 hover:bg-slate-800'
                          }`}
                          title="Email Goods Receipt"
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDispatchDoc({
                              channel: 'whatsapp',
                              docType: 'GR',
                              docId: gr.id,
                              docNumber: gr.id,
                              docSummary: `PO Ref: ${gr.poId} | Vendor: ${gr.vendorName}\nDelivery Note: ${gr.deliveryNoteNumber} | Received By: ${gr.receivedBy}`,
                              recipientName: gr.vendorName,
                              recipientPhone: '081288001122',
                            })
                          }
                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                            isLight ? 'border-gray-200 text-emerald-700 hover:bg-emerald-50' : 'border-slate-800/80 text-emerald-400 hover:bg-slate-800'
                          }`}
                          title="Send Goods Receipt via WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* SECTION 4: VENDOR BILLS (3-Way Match AP) */}
      {activeTab === 'vendor_bills' && !isWarehouseRole && (
        <VendorBillModule
          theme={theme}
          selectedStore={selectedStore}
          vendorBills={vendorBills}
          purchaseOrders={purchaseOrders}
          goodsReceipts={goodsReceipts}
          onRefreshData={onRefreshData}
          onShowToast={onShowToast}
          initialPreselectedPoId={preselectedPoId}
          initialPreselectedGrId={preselectedGrId}
          activeStaffSession={activeStaffSession}
          bridgeTarget={vendorBillBridgeTarget}
          onClearBridgeTarget={onClearVendorBillBridge}
          onNavigateToProcurementDoc={jumpToSubDoc}
        />
      )}

      {/* SECTION 5: AUTOMATED VENDOR SCORECARD & SRM INTELLIGENCE */}
      {activeTab === 'vendor_scorecard' && (
        <VendorScorecardTab
          theme={theme}
          data={scorecardData}
          isLoading={isLoadingScorecard}
          canCreateDirectPO={canManagePrPo}
          onRefresh={loadVendorScorecard}
          onIssueDirectPO={(supName) => openDirectPoModal(supName)}
        />
      )}

      {/* SECTION 6: VELOCITY & SEASONALITY SMART DEMAND FORECAST */}
      {activeTab === 'smart_forecast' && !isWarehouseRole && (
        <SmartDemandForecastTab
          theme={theme}
          selectedStore={selectedStore}
          canGeneratePR={canManagePrPo}
          onShowToast={onShowToast}
          onRefreshData={onRefreshData}
          onPRCreated={() => setActiveTab('pr')}
        />
      )}

      {/* SECTION 7: SUPPLIER RAFAKSI & TRADING TERM DEBIT NOTES (NOTA DEBET) */}
      {activeTab === 'debit_notes' && !isWarehouseRole && (
        <div
          className={`rounded-2xl border p-5 space-y-5 ${
            isLight
              ? 'bg-white border-gray-200/90 shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
              : 'bg-[#12141C] border-slate-800/80'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 dark:border-slate-800/80 pb-4">
            <div>
              <h3 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                Supplier Rafaksi &amp; Trading Term Debit Notes (Nota Debet)
              </h3>
              <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                Claim post-invoice price protection (Rafaksi -&gt; DR #2010 / CR #1040) or Gondola/Listing rebates (DR #2010 / CR #4080) and automatically reduce open AP balances.
              </p>
            </div>
            <button
              type="button"
              onClick={loadDebitNotes}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer ${
                isLight ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50' : 'bg-slate-900/90 border-slate-800/80 text-slate-200 hover:bg-slate-800'
              }`}
            >
              {isLoadingDebitNotes ? 'Syncing...' : 'Refresh Nota Debet'}
            </button>
          </div>

          {canManagePrPo && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const supplier = dnSupplierName || supplierOptions[0] || '';
                if (!supplier || dnAmountIDR <= 0 || !dnDescription.trim()) {
                  onShowToast('Missing Debit Note Fields', 'Select supplier, enter amount > 0, and provide description.');
                  return;
                }
                setIsSubmittingDebitNote(true);
                try {
                  const res = await apiClient.createSupplierDebitNote({
                    storeId: selectedStore !== 'CONSOLIDATED' ? selectedStore : 'store-jkt-senopati',
                    supplierName: supplier,
                    category: dnCategory,
                    vendorBillId: dnVendorBillId || undefined,
                    sku: dnSku || undefined,
                    amountIDR: dnAmountIDR,
                    description: dnDescription.trim(),
                  });
                  onShowToast('Nota Debet Issued', res.message);
                  setDnDescription('');
                  setDnVendorBillId('');
                  setDnSku('');
                  await loadDebitNotes();
                  onRefreshData();
                } catch (err: unknown) {
                  onShowToast('Debit Note Failed', err instanceof Error ? err.message : String(err));
                } finally {
                  setIsSubmittingDebitNote(false);
                }
              }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end p-4 rounded-xl border border-gray-200 dark:border-slate-800/80 bg-gray-50/70 dark:bg-[#090A0F]"
            >
              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${isLight ? 'text-gray-700' : 'text-slate-300'}`}>
                  Supplier
                </label>
                <select
                  value={dnSupplierName || supplierOptions[0] || ''}
                  onChange={(e) => setDnSupplierName(e.target.value)}
                  className={`w-full px-2.5 py-2 rounded-lg text-xs border ${
                    isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                  }`}
                >
                  {supplierOptions.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${isLight ? 'text-gray-700' : 'text-slate-300'}`}>
                  Claim Category
                </label>
                <select
                  value={dnCategory}
                  onChange={(e) => setDnCategory(e.target.value as SupplierDebitNoteCategory)}
                  className={`w-full px-2.5 py-2 rounded-lg text-xs border ${
                    isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                  }`}
                >
                  <option value="RAFAKSI_HARGA">Rafaksi Harga (CR #1040 HPP)</option>
                  <option value="GONDOLA_REBATE">Gondola / Listing Rebate (CR #4080)</option>
                </select>
              </div>
              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${isLight ? 'text-gray-700' : 'text-slate-300'}`}>
                  Offset Vendor Bill (Optional)
                </label>
                <select
                  value={dnVendorBillId}
                  onChange={(e) => setDnVendorBillId(e.target.value)}
                  className={`w-full px-2.5 py-2 rounded-lg text-xs border ${
                    isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                  }`}
                >
                  <option value="">-- Open AP General --</option>
                  {vendorBills
                    .filter((b) => b.status !== 'VOID' && b.remainingDue > 0)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.billNumber} ({b.supplierName}) · Due {formatIDR(b.remainingDue * b.exchangeRate)}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${isLight ? 'text-gray-700' : 'text-slate-300'}`}>
                  Amount (IDR)
                </label>
                <input
                  type="number"
                  min={1000}
                  step={1000}
                  value={dnAmountIDR}
                  onChange={(e) => setDnAmountIDR(Math.max(1, Number(e.target.value) || 0))}
                  className={`w-full px-2.5 py-2 rounded-lg text-xs font-mono border ${
                    isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                  }`}
                />
              </div>
              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${isLight ? 'text-gray-700' : 'text-slate-300'}`}>
                  Claim Description / Memo
                </label>
                <input
                  type="text"
                  value={dnDescription}
                  onChange={(e) => setDnDescription(e.target.value)}
                  placeholder="e.g. Rafaksi harga promo minyak Q2"
                  className={`w-full px-2.5 py-2 rounded-lg text-xs border ${
                    isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100 dark:placeholder:text-slate-500'
                  }`}
                />
              </div>
              <button
                type="submit"
                disabled={isSubmittingDebitNote}
                className="px-3 py-2 rounded-lg text-xs font-semibold bg-[#0F4C3A] hover:bg-[#0b382b] text-white cursor-pointer disabled:opacity-50"
              >
                {isSubmittingDebitNote ? 'Posting...' : 'Post Nota Debet'}
              </button>
            </form>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className={`border-b ${isLight ? 'bg-gray-50 border-gray-200 text-gray-600' : 'bg-[#090A0F] border-slate-800/80 text-slate-400'}`}>
                <tr>
                  <th className="py-3 px-4 font-semibold">Nota Debet #</th>
                  <th className="py-3 px-4 font-semibold">Supplier</th>
                  <th className="py-3 px-4 font-semibold">Category</th>
                  <th className="py-3 px-4 font-semibold">Linked Bill</th>
                  <th className="py-3 px-4 font-semibold">Credit Account</th>
                  <th className="py-3 px-4 font-semibold">Amount (IDR)</th>
                  <th className="py-3 px-4 font-semibold">Audit &amp; Memo</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isLight ? 'divide-gray-100' : 'divide-slate-800/80'}`}>
                {debitNotesList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs text-gray-500 dark:text-slate-400">
                      No supplier Rafaksi or Trading Term Debit Notes posted yet.
                    </td>
                  </tr>
                ) : (
                  debitNotesList.map((dn) => (
                    <tr key={dn.id} className="hover:bg-slate-900/40">
                      <td className="py-3 px-4 font-mono font-bold text-[#0F4C3A] dark:text-emerald-400">{dn.id}</td>
                      <td className="py-3 px-4 font-semibold">{dn.supplierName}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300">
                          {dn.category.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px]">{dn.vendorBillId || 'General AP'}</td>
                      <td className="py-3 px-4 font-mono text-[11px]">DR 2010 / CR {dn.category === 'GONDOLA_REBATE' ? '4080' : '1040'}</td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-700 dark:text-emerald-400">{formatIDR(dn.amountIDR)}</td>
                      <td className="py-3 px-4">
                        <div className="text-xs">{dn.description}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{dn.glEntryIds.join(', ')} · {dn.issuedBy}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>

      {/* MODAL: INTERACTIVE PARTIAL GOODS RECEIPT */}
      {activeReceivingPO && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto gm-backdrop-fade">
          <div
            className={`border rounded-2xl w-full max-w-[95vw] sm:max-w-2xl p-4 sm:p-6 space-y-4 sm:space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto my-auto gm-modal-pop ${
              isLight ? 'bg-white border-gray-200 text-gray-900' : 'bg-[#12141C] border-slate-800/80 text-slate-100'
            }`}
          >
            <div className={`flex items-center justify-between border-b pb-3 ${isLight ? 'border-gray-200' : 'border-slate-800/80'}`}>
              <div>
                <h3 className={`text-base font-bold flex items-center gap-2 ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                  <Truck className="w-5 h-5 text-[#0F4C3A] dark:text-emerald-400" />
                  Receive Goods: PO #{activeReceivingPO.id}
                </h3>
                <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                  Vendor: <strong>{activeReceivingPO.supplierName}</strong> • Destination: <strong>{activeReceivingPO.storeName}</strong>
                </p>
              </div>
              <button
                onClick={() => setActiveReceivingPO(null)}
                className={`p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors ${
                  isLight ? 'text-gray-500' : 'text-slate-400'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl border border-gray-200 dark:border-slate-800/80 bg-gray-50/70 dark:bg-[#090A0F]">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setReceiveMode('standard')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    receiveMode === 'standard'
                      ? 'bg-[#0F4C3A] text-white shadow-xs'
                      : isLight
                      ? 'bg-white text-gray-700 border border-gray-200'
                      : 'bg-slate-900/90 text-slate-300 border border-slate-800/80'
                  }`}
                >
                  Standard CDC Putaway (GR)
                </button>
                <button
                  type="button"
                  onClick={() => setReceiveMode('cross_dock')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    receiveMode === 'cross_dock'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : isLight
                      ? 'bg-white text-gray-700 border border-gray-200'
                      : 'bg-slate-900/90 text-slate-300 border border-slate-800/80'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Cross-Dock Direct to Branch</span>
                </button>
              </div>
              {activeReceivingPO.items.some((it) => it.isConsignment) && (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  Consignment (Titip Jual · Zero GL #1040/#2010)
                </span>
              )}
            </div>

            {receiveMode === 'cross_dock' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/50 dark:bg-indigo-950/20">
                <div>
                  <label className="block text-[11px] font-semibold mb-1 text-indigo-900 dark:text-indigo-200">
                    Dispatch Driver Name
                  </label>
                  <input
                    type="text"
                    value={crossDockDriver}
                    onChange={(e) => setCrossDockDriver(e.target.value)}
                    className={`w-full px-3 py-1.5 text-xs rounded-lg border ${
                      isLight ? 'bg-white border-indigo-200 text-gray-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1 text-indigo-900 dark:text-indigo-200">
                    Fleet Vehicle Plate #
                  </label>
                  <input
                    type="text"
                    value={crossDockPlate}
                    onChange={(e) => setCrossDockPlate(e.target.value)}
                    className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                      isLight ? 'bg-white border-indigo-200 text-gray-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                    }`}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-gray-700' : 'text-slate-300'}`}>
                  Surat Jalan / Delivery Note #
                </label>
                <input
                  type="text"
                  value={deliveryNoteInput}
                  onChange={(e) => setDeliveryNoteInput(e.target.value)}
                  placeholder="e.g. SJ-BLC-2026-9921"
                  className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:border-[#0F4C3A] focus:ring-1 focus:ring-[#0F4C3A] ${
                    isLight
                      ? 'bg-white border-gray-300 text-gray-900'
                      : 'bg-[#090A0F] border-slate-800/80 text-slate-100 dark:placeholder:text-slate-500'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-gray-700' : 'text-slate-300'}`}>
                  Receiving Officer Name
                </label>
                <input
                  type="text"
                  value={receivedByInput}
                  onChange={(e) => setReceivedByInput(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:border-[#0F4C3A] focus:ring-1 focus:ring-[#0F4C3A] ${
                    isLight
                      ? 'bg-white border-gray-300 text-gray-900'
                      : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                  }`}
                />
              </div>
            </div>

            {/* Items with partial quantity inputs */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h4 className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-gray-700' : 'text-slate-300'}`}>
                  {receiveMode === 'cross_dock'
                    ? 'Cross-Dock Branch Allocation (Zero CDC Shelf Putaway)'
                    : 'Specify Received Items (Partial Fulfillment Supported)'}
                </h4>
                {receiveMode === 'standard' && (
                  <button
                    type="button"
                    onClick={() => setShowGrScanner((v) => !v)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer shrink-0 ${
                      showGrScanner
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : isLight
                        ? 'bg-white border-emerald-300 text-[#0F4C3A] hover:bg-emerald-50'
                        : 'bg-slate-900/90 border-emerald-800/50 text-emerald-300 hover:bg-slate-800'
                    }`}
                  >
                    <Barcode className="w-3.5 h-3.5" />
                    {showGrScanner ? 'Hide GR Barcode Scanner' : 'Quick Scan Box (+1 Receive)'}
                  </button>
                )}
              </div>

              {showGrScanner && receiveMode === 'standard' && (
                <QuickBarcodeScannerBar
                  theme={theme}
                  title="Goods Receipt Box / Carton Scanner (+1 Unit)"
                  placeholder="Scan item EAN-13 barcode or SKU to increment received qty (Enter)..."
                  allowDecrement={false}
                  sampleCodes={activeReceivingPO.items.slice(0, 4).map((it) => {
                    const invMatch = inventory.find((i) => i.sku === it.sku);
                    return {
                      label: it.productName.split(' ').slice(0, 2).join(' '),
                      code: invMatch?.barcode || it.sku,
                    };
                  })}
                  onScan={(code) => {
                    const q = code.toLowerCase();
                    const poItem = activeReceivingPO.items.find((it) => {
                      const invMatch = inventory.find((i) => i.sku === it.sku);
                      return (
                        it.sku.toLowerCase() === q ||
                        (invMatch?.barcode && invMatch.barcode.toLowerCase() === q)
                      );
                    });
                    if (!poItem) {
                      return { matched: false, detail: `Barcode "${code}" is not on PO ${activeReceivingPO.id}` };
                    }
                    const currentItem = receivingItemsState[poItem.sku];
                    const curQty = currentItem ? currentItem.quantityReceived : 0;
                    if (curQty >= poItem.remainingBackorder) {
                      return {
                        matched: false,
                        detail: `${poItem.productName} already reached max remaining qty (${poItem.remainingBackorder})`,
                      };
                    }
                    const nextQty = curQty + 1;
                    setReceivingItemsState((prev) => ({
                      ...prev,
                      [poItem.sku]: {
                        ...(prev[poItem.sku] || {
                          quantityReceived: 0,
                          bonusQty: poItem.bonusQty || 0,
                          batchNumber: `BAT-${Date.now().toString().slice(-6)}`,
                          expiryDate: new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString().split('T')[0],
                          qualityCondition: 'Cold-Chain Verified' as const,
                          tempCheckCelsius: 3.8,
                        }),
                        quantityReceived: nextQty,
                      },
                    }));
                    return {
                      matched: true,
                      label: `${poItem.productName} (${poItem.sku})`,
                      detail: `Received Qty = ${nextQty} / ${poItem.remainingBackorder}`,
                    };
                  }}
                />
              )}

              {activeReceivingPO.items.map((item, idx) => {
                const itemState = receivingItemsState[item.sku] || {
                  quantityReceived: item.remainingBackorder,
                  bonusQty: item.bonusQty || 0,
                  batchNumber: 'BAT-NEW',
                  expiryDate: '',
                  qualityCondition: 'Cold-Chain Verified' as const,
                  tempCheckCelsius: 4.0,
                };

                const currentBackorder = Math.max(0, item.remainingBackorder - itemState.quantityReceived);

                return (
                  <div
                    key={`${item.sku}-${idx}`}
                    className={`border p-4 rounded-xl space-y-3 ${
                      isLight
                        ? 'bg-white border-gray-200 shadow-2xs'
                        : 'bg-[#090A0F] border-slate-800/80'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <div>
                        <h5 className={`font-bold text-xs ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                          {item.productName}
                        </h5>
                        <span className={`font-mono text-[10px] ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                          {item.sku}
                        </span>
                      </div>
                      <div className={`text-xs font-mono ${isLight ? 'text-gray-600' : 'text-slate-300'}`}>
                        Ordered: <strong>{item.orderedQuantity}</strong>
                        {(item.bonusQty || 0) > 0 && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">
                            +{item.bonusQty} FOC
                          </span>
                        )}{' '}
                        | Remaining: <strong className="text-amber-600 dark:text-amber-400">{item.remainingBackorder}</strong>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                      <div>
                        <label className={`block text-[10px] mb-1 font-semibold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                          Quantity Received Now
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={item.remainingBackorder}
                          value={itemState.quantityReceived}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setReceivingItemsState((prev) => ({
                              ...prev,
                              [item.sku]: { ...itemState, quantityReceived: val },
                            }));
                          }}
                          className={`w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border text-[#0F4C3A] dark:text-emerald-400 ${
                            isLight
                              ? 'bg-white border-slate-300 focus:border-[#0F4C3A] focus:ring-1 focus:ring-[#0F4C3A]'
                              : 'bg-[#12141C] border-slate-800/80'
                          }`}
                        />
                      </div>

                      <div>
                        <label className={`block text-[10px] mb-1 font-semibold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                          FOC Bonus Qty (Gratis)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={itemState.bonusQty || 0}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value) || 0);
                            setReceivingItemsState((prev) => ({
                              ...prev,
                              [item.sku]: { ...itemState, bonusQty: val },
                            }));
                          }}
                          className={`w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border text-emerald-700 dark:text-emerald-300 ${
                            isLight
                              ? 'bg-white border-slate-300 focus:border-[#0F4C3A] focus:ring-1 focus:ring-[#0F4C3A]'
                              : 'bg-[#12141C] border-slate-800/80'
                          }`}
                          title="Free bonus goods dilute WAC without creating AP liability"
                        />
                      </div>

                      <div>
                        <label className={`block text-[10px] mb-1 font-semibold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                          Batch / Lot #
                        </label>
                        <input
                          type="text"
                          value={itemState.batchNumber}
                          onChange={(e) => {
                            const val = e.target.value;
                            setReceivingItemsState((prev) => ({
                              ...prev,
                              [item.sku]: { ...itemState, batchNumber: val },
                            }));
                          }}
                          className={`w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border ${
                            isLight
                              ? 'bg-white border-slate-300 text-slate-900 focus:border-[#0F4C3A] focus:ring-1 focus:ring-[#0F4C3A]'
                              : 'bg-[#12141C] border-slate-800/80 text-slate-100'
                          }`}
                        />
                      </div>

                      <div>
                        <label className={`block text-[10px] mb-1 font-semibold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                          Cold Temp (°C)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={itemState.tempCheckCelsius}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setReceivingItemsState((prev) => ({
                              ...prev,
                              [item.sku]: { ...itemState, tempCheckCelsius: val },
                            }));
                          }}
                          className={`w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border text-blue-600 dark:text-blue-300 ${
                            isLight
                              ? 'bg-white border-slate-300 focus:border-[#0F4C3A] focus:ring-1 focus:ring-[#0F4C3A]'
                              : 'bg-[#12141C] border-slate-800/80'
                          }`}
                        />
                      </div>

                      <div>
                        <label className={`block text-[10px] mb-1 font-semibold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                          Quality Status
                        </label>
                        <select
                          value={itemState.qualityCondition}
                          onChange={(e) => {
                            const val = e.target.value as any;
                            setReceivingItemsState((prev) => ({
                              ...prev,
                              [item.sku]: { ...itemState, qualityCondition: val },
                            }));
                          }}
                          className={`w-full px-2 py-1.5 text-xs rounded-lg border ${
                            isLight
                              ? 'bg-white border-slate-300 text-slate-900 focus:border-[#0F4C3A] focus:ring-1 focus:ring-[#0F4C3A]'
                              : 'bg-[#12141C] border-slate-800/80 text-slate-100'
                          }`}
                        >
                          <option value="Cold-Chain Verified">Cold-Chain Verified</option>
                          <option value="Passed - Grade A">Passed - Grade A</option>
                          <option value="Minor Discrepancy">Minor Discrepancy</option>
                        </select>
                      </div>
                    </div>

                    {receiveMode === 'cross_dock' && (
                      <div className="pt-2 border-t border-indigo-200/70 dark:border-slate-800/80 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
                          <span>Direct Branch Allocations (Zero CDC Storage):</span>
                          <span className="font-mono">
                            Allocated:{' '}
                            {Object.values(crossDockAllocations[item.sku] || {}).reduce(
                              (sum, v) => sum + (Number(v) || 0),
                              0
                            )}{' '}
                            / {item.remainingBackorder} max
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {crossDockTargetBranches.map((br) => (
                            <div key={br.storeId}>
                              <label className="block text-[10px] truncate opacity-80 mb-0.5">{br.storeName}</label>
                              <input
                                type="number"
                                min={0}
                                max={item.remainingBackorder}
                                value={crossDockAllocations[item.sku]?.[br.storeId] ?? 0}
                                onChange={(e) => {
                                  const q = Math.max(0, Number(e.target.value) || 0);
                                  setCrossDockAllocations((prev) => ({
                                    ...prev,
                                    [item.sku]: {
                                      ...(prev[item.sku] || {}),
                                      [br.storeId]: q,
                                    },
                                  }));
                                }}
                                className={`w-full px-2 py-1 text-xs font-mono font-bold rounded-lg border ${
                                  isLight ? 'bg-white border-indigo-200 text-gray-900' : 'bg-[#12141C] border-slate-800/80 text-slate-100'
                                }`}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <span className={isLight ? 'text-gray-500' : 'text-slate-400'}>
                        Resulting Backorder on PO:
                      </span>
                      <span className={`font-mono font-semibold ${currentBackorder > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {currentBackorder > 0 ? `${currentBackorder} units (Partially Received)` : '0 units (Fully Fulfilled)'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Advanced Landed Cost & Import Allocation (Updates FEFO Batch HPP / Cost Basis Only) */}
            {receiveMode === 'standard' && (() => {
              const totalLandedExtras =
                Math.max(0, Number(grFreightCost) || 0) +
                Math.max(0, Number(grInsuranceCost) || 0) +
                Math.max(0, Number(grCustomsDuty) || 0) +
                Math.max(0, Number(grColdChainCost) || 0);
              const ownedTotalQty = activeReceivingPO.items.reduce((sum, it) => {
                if (it.isConsignment) return sum;
                const st = receivingItemsState[it.sku];
                const q = (Number(st?.quantityReceived) || 0) + (Number(st?.bonusQty) || 0);
                return sum + q;
              }, 0);
              const ownedTotalBaseCost = activeReceivingPO.items.reduce((sum, it) => {
                if (it.isConsignment) return sum;
                const st = receivingItemsState[it.sku];
                return sum + (Number(st?.quantityReceived) || 0) * it.unitCost;
              }, 0);
              const avgExtraPerUnit = ownedTotalQty > 0 ? Math.round(totalLandedExtras / ownedTotalQty) : 0;

              return (
                <div
                  className={`p-3.5 rounded-xl border space-y-3 ${
                    isLight
                      ? 'bg-slate-50/90 border-slate-200'
                      : 'bg-[#090A0F] border-slate-800/80'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h5 className={`text-xs font-bold flex items-center gap-1.5 ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                        <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Import &amp; Landed Cost Allocation (HPP Basis Only)</span>
                      </h5>
                      <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        Optional freight, insurance, customs &amp; cold-chain costs update FEFO batch HPP without altering selling price.
                      </p>
                    </div>
                    <select
                      value={grLandedMethod}
                      onChange={(e) => setGrLandedMethod(e.target.value as 'BY_QUANTITY' | 'BY_VALUE')}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border ${
                        isLight
                          ? 'bg-white border-slate-300 text-slate-800'
                          : 'bg-[#12141C] border-slate-800/80 text-slate-200'
                      }`}
                    >
                      <option value="BY_QUANTITY">Allocate by Quantity</option>
                      <option value="BY_VALUE">Allocate by Value</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                    <div>
                      <label className={`block text-[10px] mb-1 font-semibold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                        Freight (IDR)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={5000}
                        value={grFreightCost || ''}
                        placeholder="0"
                        onChange={(e) => setGrFreightCost(Math.max(0, Number(e.target.value) || 0))}
                        className={`w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border ${
                          isLight
                            ? 'bg-white border-slate-300 text-slate-900'
                            : 'bg-[#12141C] border-slate-800/80 text-slate-100 dark:placeholder:text-slate-500'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block text-[10px] mb-1 font-semibold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                        Insurance (IDR)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={5000}
                        value={grInsuranceCost || ''}
                        placeholder="0"
                        onChange={(e) => setGrInsuranceCost(Math.max(0, Number(e.target.value) || 0))}
                        className={`w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border ${
                          isLight
                            ? 'bg-white border-slate-300 text-slate-900'
                            : 'bg-[#12141C] border-slate-800/80 text-slate-100 dark:placeholder:text-slate-500'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block text-[10px] mb-1 font-semibold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                        Import Duties (IDR)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={5000}
                        value={grCustomsDuty || ''}
                        placeholder="0"
                        onChange={(e) => setGrCustomsDuty(Math.max(0, Number(e.target.value) || 0))}
                        className={`w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border ${
                          isLight
                            ? 'bg-white border-slate-300 text-slate-900'
                            : 'bg-[#12141C] border-slate-800/80 text-slate-100 dark:placeholder:text-slate-500'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block text-[10px] mb-1 font-semibold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                        Cold Chain Logistics (IDR)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={5000}
                        value={grColdChainCost || ''}
                        placeholder="0"
                        onChange={(e) => setGrColdChainCost(Math.max(0, Number(e.target.value) || 0))}
                        className={`w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border ${
                          isLight
                            ? 'bg-white border-slate-300 text-slate-900'
                            : 'bg-[#12141C] border-slate-800/80 text-slate-100 dark:placeholder:text-slate-500'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Biaya Bongkar Muat SPSI */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-800/80 items-end">
                    <div>
                      <label className={`block text-[10px] mb-1 font-semibold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                        Biaya Bongkar Muat SPSI (IDR)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={5000}
                        value={grUnloadingLaborFee || ''}
                        placeholder="0"
                        onChange={(e) => setGrUnloadingLaborFee(Math.max(0, Number(e.target.value) || 0))}
                        className={`w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border ${
                          isLight
                            ? 'bg-white border-slate-300 text-slate-900'
                            : 'bg-[#12141C] border-slate-800/80 text-slate-100 dark:placeholder:text-slate-500'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block text-[10px] mb-1 font-semibold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                        Sumber Pembayaran Bongkar Muat
                      </label>
                      <select
                        value={grUnloadingPayerCoa}
                        onChange={(e) => setGrUnloadingPayerCoa(e.target.value as '1011' | '1010' | '2010')}
                        className={`w-full px-2.5 py-1.5 text-xs rounded-lg border ${
                          isLight
                            ? 'bg-white border-slate-300 text-slate-900'
                            : 'bg-[#12141C] border-slate-800/80 text-slate-100'
                        }`}
                      >
                        <option value="1011">1011 · Cash Drawer / Petty Cash</option>
                        <option value="1010">1010 · Main Bank Vault</option>
                        <option value="2010">2010 · Accounts Payable (AP)</option>
                      </select>
                    </div>
                    <label className="flex items-center gap-2 pb-1.5 cursor-pointer text-[11px] font-semibold">
                      <input
                        type="checkbox"
                        checked={grCapitalizedToLandedCost}
                        onChange={(e) => setGrCapitalizedToLandedCost(e.target.checked)}
                        className="rounded accent-[#0F4C3A]"
                      />
                      <span>Kapitalisasi ke HPP (#1040 vs #5030)</span>
                    </label>
                  </div>

                  {totalLandedExtras > 0 && (
                    <div
                      className={`pt-2 border-t flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono ${
                        isLight ? 'border-slate-200 text-slate-700' : 'border-slate-800/80 text-slate-300'
                      }`}
                    >
                      <span>
                        Total Extras: <strong className="text-emerald-600 dark:text-emerald-400">{formatIDR(totalLandedExtras)}</strong>
                        {' '}({ownedTotalQty} owned units)
                      </span>
                      <span>
                        Avg Landed +/Unit: <strong className="text-amber-600 dark:text-amber-400">+{formatIDR(avgExtraPerUnit)}</strong>
                      </span>
                      <span>
                        Actual Landed Cost Basis:{' '}
                        <strong className="text-slate-900 dark:text-slate-100">
                          {ownedTotalQty > 0
                            ? `${formatIDR(Math.round((ownedTotalBaseCost + totalLandedExtras) / ownedTotalQty))}/unit`
                            : 'Rp 0'}
                        </strong>
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

            <div>
              <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-gray-700' : 'text-slate-300'}`}>
                Receiving Remarks / Cold-Chain Notes
              </label>
              <input
                type="text"
                value={receiverNotesInput}
                onChange={(e) => setReceiverNotesInput(e.target.value)}
                placeholder="e.g. Items transferred directly to walk-in chiller WH-JKT-SEN-COLD; seals inspected."
                className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:border-[#0F4C3A] focus:ring-1 focus:ring-[#0F4C3A] ${
                  isLight
                    ? 'bg-white border-gray-300 text-gray-900'
                    : 'bg-[#090A0F] border-slate-800/80 text-slate-100 dark:placeholder:text-slate-500'
                }`}
              />
            </div>

            <div className={`p-3.5 rounded-xl border text-xs space-y-1 ${
              isLight ? 'bg-emerald-50/60 border-emerald-200 text-gray-700' : 'bg-emerald-950/30 border-emerald-800/50 text-slate-300'
            }`}>
              <p className="font-semibold flex items-center gap-1.5 text-[#0F4C3A] dark:text-emerald-400">
                <Scale className="w-3.5 h-3.5" />
                {receiveMode === 'cross_dock'
                  ? 'Cross-Dock GL & Logistics Automation:'
                  : activeReceivingPO.items.every((it) => it.isConsignment)
                  ? 'Consignment (Titip Jual) Zero-Valuation Entry:'
                  : 'Automated Double-Entry Accounting Posting:'}
              </p>
              {receiveMode === 'cross_dock' ? (
                <>
                  <p>• <strong>Bypass CDC Putaway</strong>: Creates GR + auto-issues Inter-Warehouse Transfers (`in_transit`) &amp; Surat Jalan directly to destination branches.</p>
                  <p>• <strong>Debit 1040 / Credit 2010</strong>: Recognized for owned goods (skipped for consignment SKUs).</p>
                </>
              ) : activeReceivingPO.items.every((it) => it.isConsignment) ? (
                <p>• <strong>Rp 0 GL Impact</strong>: Consignment items enter physical shelf tracking only; COGS &amp; Payable (#2015) are recognized only when sold at POS.</p>
              ) : (
                <>
                  <p>• <strong>Debit 1040 Merchandise Inventory Asset</strong>: +Value of received items into store warehouse</p>
                  <p>• <strong>Credit 2010 Trade Accounts Payable</strong>: +Liability recognized for vendor settlement</p>
                </>
              )}
            </div>

            <div className={`flex justify-end gap-2 pt-3 border-t ${isLight ? 'border-gray-200' : 'border-slate-800/80'}`}>
              <button
                onClick={() => setActiveReceivingPO(null)}
                className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                  isLight
                    ? 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 shadow-2xs'
                    : 'bg-slate-900/90 border-slate-800/80 text-slate-300 hover:bg-slate-800'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitPartialGR}
                disabled={isSubmittingGR}
                className={`px-5 py-2 text-xs font-semibold text-white rounded-xl shadow-sm transition-all disabled:opacity-50 ${
                  receiveMode === 'cross_dock'
                    ? 'bg-indigo-600 hover:bg-indigo-500'
                    : 'bg-[#0F4C3A] hover:bg-[#0b382b]'
                }`}
              >
                {isSubmittingGR
                  ? 'Processing...'
                  : receiveMode === 'cross_dock'
                  ? 'Dispatch Cross-Dock Direct to Branches'
                  : 'Confirm Goods Receipt & Update Stock'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL: CREATE RESTOCK PR */}
      {isCreatingPR && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto gm-backdrop-fade">
          <div
            className={`border rounded-2xl w-full max-w-[95vw] sm:max-w-md p-4 sm:p-6 space-y-4 shadow-2xl my-auto gm-modal-pop ${
              isLight ? 'bg-white border-gray-200 text-gray-900' : 'bg-[#12141C] border-slate-800/80 text-slate-100'
            }`}
          >
            <div className={`flex items-center justify-between border-b pb-3 ${isLight ? 'border-gray-200' : 'border-slate-800/80'}`}>
              <h3 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                New Purchase Request (PR)
              </h3>
              <button
                onClick={() => setIsCreatingPR(false)}
                className={`p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors ${
                  isLight ? 'text-gray-500' : 'text-slate-400'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-gray-700' : 'text-slate-300'}`}>
                Target Store Hub
              </label>
              <select
                value={prStoreId}
                onChange={(e) => setPrStoreId(e.target.value)}
                className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:border-[#0F4C3A] focus:ring-1 focus:ring-[#0F4C3A] ${
                  isLight
                    ? 'bg-white border-gray-300 text-gray-900'
                    : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                }`}
              >
                {storeOutlets.length > 0 ? (
                  storeOutlets.map((st) => (
                    <option key={st.storeId} value={st.storeId}>
                      {st.storeName} ({st.city})
                    </option>
                  ))
                ) : (
                  <>
                    <option value="store-jkt-senopati">GroceMart Senopati Flagship (Jakarta)</option>
                    <option value="store-jkt-pik">GroceMart PIK 2 The Avenue (Jakarta)</option>
                    <option value="store-bdg-dago">GroceMart Dago Green Market (Bandung)</option>
                    <option value="store-sby-gubeng">GroceMart Gubeng Central Hub (Surabaya)</option>
                    <option value="store-bali-canggu">GroceMart Batu Bolong Organic (Bali)</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-gray-700' : 'text-slate-300'}`}>
                Select Product / SKU to Restock
              </label>
              <select
                value={selectedPrSku}
                onChange={(e) => setSelectedPrSku(e.target.value)}
                className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:border-[#0F4C3A] focus:ring-1 focus:ring-[#0F4C3A] ${
                  isLight
                    ? 'bg-white border-gray-300 text-gray-900'
                    : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                }`}
              >
                <option value="">-- Choose Item from Inventory --</option>
                {inventory.map((item, idx) => (
                  <option key={`${item.sku}-${idx}`} value={item.sku}>
                    {item.productName} ({item.sku}) - Stock: {item.currentStock}
                  </option>
                ))}
              </select>
              {(() => {
                const selectedInv = inventory.find((i) => i.sku === selectedPrSku);
                const srm = getSrmRecord(selectedInv?.supplierName);
                if (!selectedInv?.supplierName) return null;
                return (
                  <p
                    className={`mt-1.5 text-[11px] font-medium ${
                      srm?.grade === 'C'
                        ? 'text-rose-600 dark:text-rose-400'
                        : srm?.grade === 'B'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    Vendor: {selectedInv.supplierName}
                    {srm ? ` · SRM Score: ${srm.compositeScore}/100 (${srm.gradeLabel})` : ''}
                  </p>
                );
              })()}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-gray-700' : 'text-slate-300'}`}>
                  Requested Qty
                </label>
                <input
                  type="number"
                  min={1}
                  value={prQuantity}
                  onChange={(e) => setPrQuantity(Number(e.target.value))}
                  className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:border-[#0F4C3A] focus:ring-1 focus:ring-[#0F4C3A] font-mono ${
                    isLight
                      ? 'bg-white border-gray-300 text-gray-900'
                      : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-gray-700' : 'text-slate-300'}`}>
                  Priority Level
                </label>
                <select
                  value={prPriority}
                  onChange={(e) => setPrPriority(e.target.value as any)}
                  className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:border-[#0F4C3A] focus:ring-1 focus:ring-[#0F4C3A] ${
                    isLight
                      ? 'bg-white border-gray-300 text-gray-900'
                      : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                  }`}
                >
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-gray-700' : 'text-slate-300'}`}>
                Trigger Reason
              </label>
              <select
                value={prReason}
                onChange={(e) => setPrReason(e.target.value as any)}
                className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:border-[#0F4C3A] focus:ring-1 focus:ring-[#0F4C3A] ${
                  isLight
                    ? 'bg-white border-gray-300 text-gray-900'
                    : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                }`}
              >
                <option value="manual_request">Manual Store Manager Request</option>
                <option value="low_stock_trigger">Automated Low Stock Threshold Trigger</option>
                <option value="bulk_restock">Weekend Promotional Bulk Restock</option>
              </select>
            </div>

            <div className={`flex justify-end gap-2 pt-3 border-t ${isLight ? 'border-gray-200' : 'border-slate-800/80'}`}>
              <button
                onClick={() => setIsCreatingPR(false)}
                className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                  isLight
                    ? 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 shadow-2xs'
                    : 'bg-slate-900/90 border-slate-800/80 text-slate-300 hover:bg-slate-800'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePR}
                disabled={!selectedPrSku}
                className="px-4 py-2 text-xs font-semibold bg-[#0F4C3A] hover:bg-[#0b382b] text-white rounded-xl shadow-sm transition-all disabled:opacity-50"
              >
                Submit Purchase Request
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL: CREATE DIRECT PURCHASE ORDER */}
      {isCreatingDirectPO && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto gm-backdrop-fade">
          <div
            className={`border rounded-2xl w-full max-w-[95vw] sm:max-w-lg p-4 sm:p-6 space-y-4 shadow-2xl my-auto gm-modal-pop ${
              isLight ? 'bg-white border-gray-200 text-gray-900' : 'bg-[#12141C] border-slate-800/80 text-slate-100'
            }`}
          >
            <div className={`flex items-center justify-between border-b pb-3 ${isLight ? 'border-gray-200' : 'border-slate-800/80'}`}>
              <h3 className={`text-base font-bold flex items-center gap-2 ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                <FileCheck2 className="w-5 h-5 text-[#0F4C3A] dark:text-emerald-400" />
                Create Direct Purchase Order (PO)
              </h3>
              <button
                onClick={() => setIsCreatingDirectPO(false)}
                className={`p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors ${
                  isLight ? 'text-gray-500' : 'text-slate-400'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-gray-700' : 'text-slate-300'}`}>
                Destination Store / Hub
              </label>
              <select
                value={directPoStoreId}
                onChange={(e) => setDirectPoStoreId(e.target.value)}
                className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:border-[#0F4C3A] focus:ring-1 focus:ring-[#0F4C3A] ${
                  isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                }`}
              >
                {storeOutlets.length > 0 ? (
                  storeOutlets.map((st) => (
                    <option key={st.storeId} value={st.storeId}>
                      {st.storeName} ({st.city})
                    </option>
                  ))
                ) : (
                  <>
                    <option value="store-jkt-senopati">GroceMart Senopati Flagship (Jakarta)</option>
                    <option value="store-jkt-pik">GroceMart PIK 2 The Avenue (Jakarta)</option>
                    <option value="store-bdg-dago">GroceMart Dago Green Market (Bandung)</option>
                    <option value="store-sby-gubeng">GroceMart Gubeng Central Hub (Surabaya)</option>
                    <option value="store-bali-canggu">GroceMart Batu Bolong Organic (Bali)</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-gray-700' : 'text-slate-300'}`}>
                Supplier / Vendor
              </label>
              <select
                value={directPoSupplier}
                onChange={(e) => setDirectPoSupplier(e.target.value)}
                className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:border-[#0F4C3A] focus:ring-1 focus:ring-[#0F4C3A] ${
                  isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                }`}
              >
                <option value="">-- Select Registered Supplier --</option>
                {supplierOptions.map((supName) => (
                  <option key={supName} value={supName}>
                    {supName}
                  </option>
                ))}
              </select>
              {(() => {
                const srm = getSrmRecord(directPoSupplier);
                if (!srm) return null;
                return (
                  <p
                    className={`mt-1.5 text-[11px] font-semibold ${
                      srm.grade === 'C'
                        ? 'text-rose-600 dark:text-rose-400'
                        : srm.grade === 'B'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    SRM Score: {srm.compositeScore}/100 ({srm.gradeLabel})
                    {srm.grade === 'C' ? ' — Probation Warning: Review SLA & QC before ordering' : ''}
                  </p>
                );
              })()}
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-gray-700' : 'text-slate-300'}`}>
                Product / SKU
              </label>
              <select
                value={directPoSku}
                onChange={(e) => setDirectPoSku(e.target.value)}
                className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:border-[#0F4C3A] focus:ring-1 focus:ring-[#0F4C3A] ${
                  isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                }`}
              >
                <option value="">-- Choose Product SKU --</option>
                {inventory.map((item, idx) => (
                  <option key={`${item.sku}-${idx}`} value={item.sku}>
                    {item.productName} ({item.sku}){canViewValuation ? ` · ${formatIDR(item.unitCost || 25000)}` : ' · —'}
                  </option>
                ))}
              </select>

              {/* Smart Price Comparison / Last Purchase Price Tracker */}
              {directPoSku && (() => {
                const selectedInv = inventory.find((i) => i.sku === directPoSku);
                const currentUnitCost = selectedInv?.unitCost || 25000;
                const localHist = getLocalLastPoPrice(directPoSku, directPoSupplier);
                const resolved = lastPriceInfo?.found
                  ? {
                      found: true,
                      price: lastPriceInfo.lastUnitCostIDR || currentUnitCost,
                      date: lastPriceInfo.lastOrderDate ? lastPriceInfo.lastOrderDate.split('T')[0] : '',
                      docRef: lastPriceInfo.lastPoId || '',
                      supplier: lastPriceInfo.lastVendorName || directPoSupplier,
                      matchedSameSupplier: directPoSupplier ? lastPriceInfo.matchedSameSupplier : true,
                      diffPct: lastPriceInfo.priceVariancePercent ?? 0,
                    }
                  : localHist
                  ? {
                      found: true,
                      price: localHist.price,
                      date: localHist.date,
                      docRef: localHist.docRef,
                      supplier: localHist.vendorName || directPoSupplier,
                      matchedSameSupplier: localHist.matchedSameSupplier,
                      diffPct: localHist.price > 0 ? Math.round(((currentUnitCost - localHist.price) / localHist.price) * 1000) / 10 : 0,
                    }
                  : null;

                if (isLoadingLastPrice && !resolved) {
                  return (
                    <p className="mt-1.5 text-[11px] text-gray-400 flex items-center gap-1">
                      <History className="w-3 h-3 animate-pulse" />
                      Checking historical GR/PO purchase price...
                    </p>
                  );
                }
                if (!resolved) {
                  return (
                    <p className="mt-1.5 text-[11px] text-gray-500 dark:text-slate-400 flex items-center gap-1">
                      <History className="w-3 h-3" />
                      No prior GR/PO price record found for this SKU yet.
                    </p>
                  );
                }
                const isMarkup = resolved.diffPct > 0;
                return (
                  <p
                    title={`Reference: ${resolved.docRef}${resolved.supplier ? ` · Supplier: ${resolved.supplier}` : ''}`}
                    className={`mt-1.5 text-[11px] flex items-center justify-between gap-2 ${
                      isMarkup
                        ? 'text-amber-600 dark:text-amber-400'
                        : resolved.diffPct < 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : isLight
                        ? 'text-gray-600'
                        : 'text-slate-300'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <History className="w-3 h-3 shrink-0" />
                      <span>
                        Last bought: <strong className="font-mono">{formatIDR(resolved.price)}</strong> on{' '}
                        <span className="font-mono">{resolved.date}</span>
                        {!resolved.matchedSameSupplier && resolved.supplier ? ` (via ${resolved.supplier})` : ` (${resolved.docRef})`}
                      </span>
                    </span>
                    <span className="font-mono font-semibold shrink-0">
                      {isMarkup
                        ? `▲ +${resolved.diffPct}% vs last`
                        : resolved.diffPct < 0
                        ? `▼ ${resolved.diffPct}% lower`
                        : 'Same price'}
                    </span>
                  </p>
                );
              })()}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-gray-700' : 'text-slate-300'}`}>
                  Order Qty (Paid)
                </label>
                <input
                  type="number"
                  min={1}
                  value={directPoQty}
                  onChange={(e) => setDirectPoQty(Math.max(1, Number(e.target.value) || 1))}
                  className={`w-full px-3 py-2 text-xs font-mono rounded-xl border focus:outline-none focus:border-[#0F4C3A] ${
                    isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                  }`}
                />
              </div>
              <div>
                <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-gray-700' : 'text-slate-300'}`}>
                  FOC Bonus Qty (Free)
                </label>
                <input
                  type="number"
                  min={0}
                  value={directPoBonusQty}
                  onChange={(e) => setDirectPoBonusQty(Math.max(0, Number(e.target.value) || 0))}
                  className={`w-full px-3 py-2 text-xs font-mono rounded-xl border focus:outline-none focus:border-[#0F4C3A] ${
                    isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                  }`}
                  title="Free-of-charge bonus units dilute Moving Average Cost cleanly"
                />
              </div>
              <div>
                <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-gray-700' : 'text-slate-300'}`}>
                  Expected ETA
                </label>
                <input
                  type="date"
                  value={directPoExpectedDate}
                  onChange={(e) => setDirectPoExpectedDate(e.target.value)}
                  className={`w-full px-3 py-2 text-xs font-mono rounded-xl border focus:outline-none focus:border-[#0F4C3A] ${
                    isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                  }`}
                />
              </div>
              <div>
                <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-gray-700' : 'text-slate-300'}`}>
                  Payment Terms
                </label>
                <select
                  value={directPoPaymentTerms}
                  onChange={(e) => setDirectPoPaymentTerms(e.target.value as 'Net 30' | 'COD' | 'Advance Payment')}
                  className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:border-[#0F4C3A] ${
                    isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                  }`}
                >
                  <option value="Net 30">Net 30</option>
                  <option value="COD">COD</option>
                  <option value="Advance Payment">Advance Payment</option>
                </select>
              </div>
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-gray-700' : 'text-slate-300'}`}>
                Commercial Notes (Optional)
              </label>
              <input
                type="text"
                value={directPoNotes}
                onChange={(e) => setDirectPoNotes(e.target.value)}
                placeholder="e.g. Maintain cold chain ≤4°C on arrival"
                className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:border-[#0F4C3A] ${
                  isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100 dark:placeholder:text-slate-500'
                }`}
              />
            </div>

            <div className={`flex justify-end gap-2 pt-3 border-t ${isLight ? 'border-gray-200' : 'border-slate-800/80'}`}>
              <button
                type="button"
                onClick={() => setIsCreatingDirectPO(false)}
                className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                  isLight ? 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50' : 'bg-slate-900/90 border-slate-800/80 text-slate-300 hover:bg-slate-800'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateDirectPO}
                disabled={isSubmittingDirectPO || !directPoSupplier || !directPoSku}
                className="px-4 py-2 text-xs font-semibold bg-[#0F4C3A] hover:bg-[#0b382b] text-white rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingDirectPO ? 'Issuing PO...' : 'Issue Direct Purchase Order'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {dispatchDoc && (
        <DocumentDispatchModal
          isOpen={Boolean(dispatchDoc)}
          onClose={() => setDispatchDoc(null)}
          theme={theme}
          initialChannel={dispatchDoc.channel}
          docType={dispatchDoc.docType}
          docId={dispatchDoc.docId}
          docNumber={dispatchDoc.docNumber}
          docSummary={dispatchDoc.docSummary}
          defaultRecipientName={dispatchDoc.recipientName}
          defaultRecipientEmail={dispatchDoc.recipientEmail}
          defaultRecipientPhone={dispatchDoc.recipientPhone}
          onShowToast={onShowToast}
        />
      )}

      {/* MODAL: PURCHASE RETURN TO VENDOR & CORETAX DEBIT NOTE (NRP) */}
      {returnTargetGr &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[105] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto gm-backdrop-fade"
            onClick={() => setReturnTargetGr(null)}
          >
            <div
              className={`border rounded-2xl w-full max-w-lg p-5 sm:p-6 space-y-4 shadow-2xl my-auto gm-modal-pop ${
                isLight ? 'bg-white border-gray-200 text-gray-900' : 'bg-[#12141C] border-slate-800/80 text-slate-100'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`flex items-start justify-between gap-3 border-b pb-3 ${isLight ? 'border-gray-200' : 'border-slate-800/80'}`}>
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold">Purchase Return &amp; Debit Note (NRP)</h3>
                    <p className="text-[11px] font-mono text-gray-500 dark:text-slate-400">
                      GR #{returnTargetGr.id} · PO #{returnTargetGr.poId} · {returnTargetGr.vendorName}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReturnTargetGr(null)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitPurchaseReturn} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold mb-1">Goods Receipt Line Item</label>
                  <select
                    value={returnSku}
                    onChange={(e) => {
                      const nextSku = e.target.value;
                      setReturnSku(nextSku);
                      const line = returnTargetGr.items.find((it) => it.sku === nextSku);
                      if (line) {
                        setReturnLot(line.batchNumber || '');
                        setReturnQty(Math.min(1, line.quantityReceived));
                      }
                    }}
                    className={`w-full px-3 py-2 rounded-xl border ${
                      isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                    }`}
                  >
                    {returnTargetGr.items.map((it) => (
                      <option key={it.sku} value={it.sku}>
                        {it.productName} ({it.sku}) — Received: {it.quantityReceived} · Lot: {it.batchNumber}
                      </option>
                    ))}
                  </select>
                </div>

                {(() => {
                  const selectedLine = returnTargetGr.items.find((it) => it.sku === returnSku);
                  const maxQty = selectedLine?.quantityReceived || 1;
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold mb-1">
                          Return Quantity (Max {maxQty})
                        </label>
                        <input
                          type="number"
                          min={0.01}
                          max={maxQty}
                          step="any"
                          required
                          value={returnQty}
                          onChange={(e) => setReturnQty(Math.max(0, Number(e.target.value) || 0))}
                          className={`w-full px-3 py-2 rounded-xl border font-mono font-bold ${
                            isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Batch / Lot Number</label>
                        <input
                          type="text"
                          value={returnLot}
                          onChange={(e) => setReturnLot(e.target.value)}
                          placeholder="Batch / Lot #"
                          className={`w-full px-3 py-2 rounded-xl border font-mono ${
                            isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                          }`}
                        />
                      </div>
                    </div>
                  );
                })()}

                <div>
                  <label className="block font-semibold mb-1">Return Reason &amp; Quality Notes</label>
                  <input
                    type="text"
                    required
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border ${
                      isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                    }`}
                  />
                </div>

                <div
                  className={`p-3 rounded-xl border text-[11px] leading-relaxed ${
                    isLight ? 'bg-amber-50/70 border-amber-200 text-amber-900' : 'bg-amber-950/25 border-amber-800/50 text-amber-200'
                  }`}
                >
                  Reduces Inventory (#1040) &amp; PPN Masukan (#2026) and offsets Trade AP (#2010) — or books Vendor Advance (#1150) if the linked bill is already settled — while generating a DJP Coretax Nota Retur Pembelian (<span className="font-mono font-bold">NRP-*</span>).
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => setReturnTargetGr(null)}
                    className={`px-4 py-2 rounded-xl border font-semibold cursor-pointer ${
                      isLight ? 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50' : 'bg-slate-900/90 border-slate-800/80 text-slate-300'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingPurchaseReturn}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold cursor-pointer"
                  >
                    {isSubmittingPurchaseReturn ? 'Issuing Debit Note...' : 'Issue Purchase Return (NRP)'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
