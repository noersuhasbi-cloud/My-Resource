import React, { useState, useMemo } from 'react';
import type {
  PurchaseRequest,
  PurchaseOrder,
  GoodsReceiptRecord,
  InventoryItem,
} from '../../types/index.ts';
import { apiClient } from '../../services/apiClient';
import { formatIDR } from '../../utils/formatters';
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
} from 'lucide-react';

interface ProcurementModuleProps {
  theme: 'light' | 'dark';
  selectedStore: string;
  inventory: InventoryItem[];
  purchaseRequests: PurchaseRequest[];
  purchaseOrders: PurchaseOrder[];
  goodsReceipts: GoodsReceiptRecord[];
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
  onRefreshData,
  onShowToast,
}) => {
  const isLight = theme === 'light';

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

  // State Machine Guard: Force Close PO with Written Adjustment Notes
  const [forceClosingPO, setForceClosingPO] = useState<PurchaseOrder | null>(null);
  const [forceCloseNotes, setForceCloseNotes] = useState<string>('');
  const [isSubmittingClosePO, setIsSubmittingClosePO] = useState<boolean>(false);

  const [receivingItemsState, setReceivingItemsState] = useState<
    Record<
      string,
      {
        quantityReceived: number;
        batchNumber: string;
        expiryDate: string;
        qualityCondition: 'Cold-Chain Verified' | 'Passed - Grade A' | 'Minor Discrepancy';
        tempCheckCelsius: number;
      }
    >
  >({});

  // Filters
  const [prFilter, setPrFilter] = useState<'ALL' | 'pending' | 'approved'>('ALL');
  const [poFilter, setPoFilter] = useState<'ALL' | 'Pending' | 'Partially Received' | 'Completed'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

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
      if (poFilter !== 'ALL' && po.status !== poFilter) return false;
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
      onShowToast('Approval Failed', String(err));
    }
  };

  const openReceivingModal = (po: PurchaseOrder) => {
    setActiveReceivingPO(po);
    setDeliveryNoteInput(`SJ-VND-${Date.now().toString().slice(-5)}`);
    setReceivedByInput('Siti Rahmawati (Receiving Clerk)');
    setReceiverNotesInput('');

    const initialMap: typeof receivingItemsState = {};
    po.items.forEach((item) => {
      initialMap[item.sku] = {
        quantityReceived: item.remainingBackorder > 0 ? item.remainingBackorder : item.orderedQuantity,
        batchNumber: `BAT-${Date.now().toString().slice(-6)}`,
        expiryDate: new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString().split('T')[0],
        qualityCondition: 'Cold-Chain Verified',
        tempCheckCelsius: 3.8,
      };
    });
    setReceivingItemsState(initialMap);
  };

  const handleSubmitPartialGR = async () => {
    if (!activeReceivingPO) return;

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

    setIsSubmittingGR(true);
    try {
      const itemsPayload = Object.entries(receivingItemsState).map(([sku, data]) => ({
        sku,
        quantityReceived: data.quantityReceived,
        batchNumber: data.batchNumber,
        expiryDate: data.expiryDate,
        qualityCondition: data.qualityCondition,
        tempCheckCelsius: data.tempCheckCelsius,
      }));

      const res = await apiClient.receivePartialGoods({
        poId: activeReceivingPO.id,
        deliveryNoteNumber: deliveryNoteInput,
        receivedBy: receivedByInput,
        receiverNotes: receiverNotesInput,
        warehouseZoneId: activeReceivingPO.warehouseZoneId || 'WH-JKT-SEN-COLD',
        items: itemsPayload,
      });

      onShowToast(
        res.isPartial ? 'Partial Goods Receipt Recorded' : 'PO 100% Fulfilled',
        `GR #${res.goodsReceipt.id} processed. ${res.remainingBackorder} units backorder remaining. GL #${res.journalEntryIds[0] || 'GLE-Posted'} auto-posted.`
      );

      setActiveReceivingPO(null);
      onRefreshData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Goods Receipt Failed', msg);
    } finally {
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
        className={`p-6 rounded-2xl border transition-all ${
          isLight
            ? 'bg-white border-gray-200/90 shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
            : 'bg-stone-900/90 border-stone-800'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#0F4C3A] text-white tracking-wide">
                Procurement &amp; Supply Chain
              </span>
              <span className={`text-xs ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
                Partial Shipment &amp; Restock Engine
              </span>
            </div>
            <h2 className={`text-xl sm:text-2xl font-bold tracking-tight ${isLight ? 'text-gray-900' : 'text-white'}`}>
              Purchase Requests, Orders &amp; Partial GR
            </h2>
            <p className={`text-xs sm:text-sm mt-1 max-w-2xl ${isLight ? 'text-gray-600' : 'text-stone-400'}`}>
              End-to-end procurement cycle with automatic inventory threshold triggers, vendor order conversions,
              and enterprise split-delivery Goods Receipts (GR) linked directly to the General Ledger.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsCreatingPR(true)}
              className="px-4 py-2 bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              New Restock PR
            </button>
            <button
              onClick={onRefreshData}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                isLight
                  ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 shadow-2xs'
                  : 'bg-stone-800 border-stone-700 text-stone-200 hover:bg-stone-700'
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
              isLight ? 'bg-white border-gray-200/80 shadow-xs' : 'bg-stone-800/60 border-stone-700'
            }`}
          >
            <div className={`text-xs font-medium ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
              Pending PRs
            </div>
            <div className={`text-xl font-bold mt-1 ${isLight ? 'text-gray-900' : 'text-white'}`}>
              {pendingPRCount}
            </div>
            <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
              Awaiting PO Conversion
            </div>
          </div>

          <div
            className={`p-3.5 rounded-xl border ${
              isLight ? 'bg-white border-gray-200/80 shadow-xs' : 'bg-stone-800/60 border-stone-700'
            }`}
          >
            <div className={`text-xs font-medium ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
              Active PO Value
            </div>
            <div className={`text-xl font-bold mt-1 text-[#0F4C3A] dark:text-emerald-400 font-mono`}>
              {formatIDR(totalPOValue)}
            </div>
            <div className={`text-[11px] ${isLight ? 'text-gray-500' : 'text-stone-400'} mt-0.5`}>
              {purchaseOrders.length} Formal Vendor Orders
            </div>
          </div>

          <div
            className={`p-3.5 rounded-xl border ${
              isLight ? 'bg-white border-gray-200/80 shadow-xs' : 'bg-stone-800/60 border-stone-700'
            }`}
          >
            <div className={`text-xs font-medium ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
              Partial Deliveries
            </div>
            <div className={`text-xl font-bold mt-1 ${partialPOCount > 0 ? 'text-blue-600 dark:text-blue-400' : isLight ? 'text-gray-900' : 'text-white'}`}>
              {partialPOCount}
            </div>
            <div className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5">
              Active In-Flight Backorders
            </div>
          </div>

          <div
            className={`p-3.5 rounded-xl border ${
              isLight ? 'bg-white border-gray-200/80 shadow-xs' : 'bg-stone-800/60 border-stone-700'
            }`}
          >
            <div className={`text-xs font-medium ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
              Goods Receipts (GR)
            </div>
            <div className={`text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400`}>
              {goodsReceipts.length}
            </div>
            <div className={`text-[11px] ${isLight ? 'text-gray-500' : 'text-stone-400'} mt-0.5`}>
              Verified Surat Jalan Deliveries
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: PURCHASE REQUESTS (PR) */}
      <div
        className={`rounded-2xl border transition-all overflow-hidden ${
          isLight
            ? 'bg-white border-gray-200/90 shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
            : 'bg-stone-900/90 border-stone-800'
        }`}
      >
        <div className={`p-5 border-b ${isLight ? 'border-gray-200 bg-gray-50/50' : 'border-stone-800 bg-stone-900/50'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-white'} flex items-center gap-2`}>
                <Clock className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
                Purchase Requests (PR) Restock Triggers
              </h3>
              <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-stone-400'} mt-0.5`}>
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
                        : 'text-stone-400 hover:bg-stone-800'
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
                isLight ? 'border-gray-200 bg-gray-50/70 text-gray-500' : 'border-stone-800 bg-stone-800/50 text-stone-400'
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
            <tbody className={`divide-y ${isLight ? 'divide-gray-200' : 'divide-stone-800'}`}>
              {filteredPRs.length === 0 ? (
                <tr>
                  <td colSpan={7} className={`py-8 text-center text-xs ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
                    No purchase requests matching current criteria.
                  </td>
                </tr>
              ) : (
                filteredPRs.map((pr) => (
                  <tr
                    key={pr.id}
                    className={`transition-colors ${
                      isLight ? 'hover:bg-gray-50/80' : 'hover:bg-stone-800/40'
                    }`}
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-[#0F4C3A] dark:text-emerald-400">
                      {pr.id}
                    </td>
                    <td className={`py-3.5 px-4 ${isLight ? 'text-gray-700' : 'text-stone-300'}`}>
                      {pr.storeName || 'Senopati Flagship'}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className={`font-semibold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                        {pr.productName}
                      </div>
                      <div className={`font-mono text-[10px] ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
                        {pr.sku}
                      </div>
                    </td>
                    <td className={`py-3.5 px-4 text-center font-mono font-bold ${isLight ? 'text-gray-900' : 'text-stone-100'}`}>
                      {pr.suggestedQuantity}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-[#0F4C3A] dark:text-emerald-400">
                      {formatIDR(pr.totalEstimatedCost)}
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
                            : 'bg-stone-700 text-stone-300'
                        }`}>
                          {pr.priority}
                        </span>
                        <span className={`text-[11px] capitalize ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
                          {pr.reason.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {pr.status === 'pending' ? (
                        <button
                          onClick={() => handleApprovePR(pr.id)}
                          className="px-3 py-1 bg-[#0F4C3A] hover:bg-[#0b382b] text-white font-semibold text-xs rounded-lg transition-all shadow-xs"
                        >
                          Approve → PO
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          PO #{pr.poId}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 2: PURCHASE ORDERS WITH PARTIAL SHIPMENT SUPPORT */}
      <div
        className={`rounded-2xl border transition-all overflow-hidden ${
          isLight
            ? 'bg-white border-gray-200/90 shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
            : 'bg-stone-900/90 border-stone-800'
        }`}
      >
        <div className={`p-5 border-b ${isLight ? 'border-gray-200 bg-gray-50/50' : 'border-stone-800 bg-stone-900/50'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-white'} flex items-center gap-2`}>
                <FileCheck2 className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
                Purchase Orders (PO) &amp; Partial Shipment Tracking
              </h3>
              <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-stone-400'} mt-0.5`}>
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
                      : 'text-stone-400 hover:bg-stone-800'
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
                isLight ? 'border-gray-200 bg-gray-50/70 text-gray-500' : 'border-stone-800 bg-stone-800/50 text-stone-400'
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
            <tbody className={`divide-y ${isLight ? 'divide-gray-200' : 'divide-stone-800'}`}>
              {filteredPOs.length === 0 ? (
                <tr>
                  <td colSpan={7} className={`py-8 text-center text-xs ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
                    No purchase orders matching current criteria.
                  </td>
                </tr>
              ) : (
                filteredPOs.map((po) => {
                  const totalOrdered = po.items.reduce((s, i) => s + i.orderedQuantity, 0);
                  const totalReceived = po.items.reduce((s, i) => s + (i.receivedQuantity || 0), 0);
                  const totalBackorder = po.items.reduce((s, i) => s + (i.remainingBackorder || 0), 0);
                  const percent = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;

                  return (
                    <tr
                      key={po.id}
                      className={`transition-colors ${
                        isLight ? 'hover:bg-gray-50/80' : 'hover:bg-stone-800/40'
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-[#0F4C3A] dark:text-emerald-400">
                          {po.id}
                        </span>
                        <div className={`text-[10px] ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
                          Expected: {po.expectedDeliveryDate}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className={`font-semibold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                          {po.supplierName}
                        </div>
                        <div className={`text-[11px] ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
                          {po.storeName}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        {po.items.map((item, idx) => (
                          <div key={idx} className="text-[11px]">
                            <span className={`font-medium ${isLight ? 'text-gray-800' : 'text-stone-200'}`}>
                              {item.productName}
                            </span>
                            <span className={`ml-1 font-mono ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
                              ({item.receivedQuantity}/{item.orderedQuantity} rcvd)
                            </span>
                          </div>
                        ))}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-24 h-2 rounded-full overflow-hidden ${isLight ? 'bg-gray-200' : 'bg-stone-700'}`}>
                            <div
                              className={`h-full rounded-full transition-all ${
                                po.status === 'Completed'
                                  ? 'bg-[#0F4C3A] dark:bg-emerald-500'
                                  : 'bg-blue-500'
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <span className={`font-mono text-xs font-semibold ${isLight ? 'text-gray-700' : 'text-stone-300'}`}>
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
                            po.status === 'Completed'
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                              : po.status === 'Partially Received'
                              ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30'
                              : isLight
                              ? 'bg-gray-100 text-gray-700 border-gray-300'
                              : 'bg-stone-800 text-stone-300 border-stone-700'
                          }`}
                        >
                          {po.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {po.status !== 'Completed' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openReceivingModal(po)}
                              className="px-3 py-1 bg-[#0F4C3A] hover:bg-[#0b382b] text-white font-semibold text-xs rounded-lg transition-all shadow-xs"
                            >
                              Receive GR
                            </button>
                            {totalBackorder > 0 && (
                              <button
                                onClick={() => {
                                  setForceClosingPO(po);
                                  setForceCloseNotes('');
                                }}
                                className={`px-2 py-1 text-xs font-semibold rounded-lg border transition-all ${
                                  isLight
                                    ? 'bg-white hover:bg-gray-100 text-gray-700 border-gray-300 shadow-2xs'
                                    : 'bg-stone-800 hover:bg-stone-700 text-stone-300 border-stone-700'
                                }`}
                                title="Close unfulfilled backorder balance with written adjustment notes"
                              >
                                Close PO
                              </button>
                            )}
                          </div>
                        ) : (
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

      {/* SECTION 3: GOODS RECEIPTS (GR) LOG */}
      <div
        className={`rounded-2xl border transition-all overflow-hidden ${
          isLight
            ? 'bg-white border-gray-200/90 shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
            : 'bg-stone-900/90 border-stone-800'
        }`}
      >
        <div className={`p-5 border-b ${isLight ? 'border-gray-200 bg-gray-50/50' : 'border-stone-800 bg-stone-900/50'}`}>
          <h3 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-white'} flex items-center gap-2`}>
            <Truck className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
            Goods Receipts (GR) Delivery Log
          </h3>
          <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-stone-400'} mt-0.5`}>
            Surat Jalan records, cold-chain temperature verification, and automated General Ledger voucher links
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead>
              <tr className={`border-b text-[10px] uppercase font-semibold tracking-wider ${
                isLight ? 'border-gray-200 bg-gray-50/70 text-gray-500' : 'border-stone-800 bg-stone-800/50 text-stone-400'
              }`}>
                <th className="py-3 px-4">GR Number</th>
                <th className="py-3 px-4">Surat Jalan Note</th>
                <th className="py-3 px-4">PO Reference</th>
                <th className="py-3 px-4">Vendor / Store</th>
                <th className="py-3 px-4">Shipment Type</th>
                <th className="py-3 px-4">Officer / Temp</th>
                <th className="py-3 px-4 text-right">Linked GL Voucher</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isLight ? 'divide-gray-200' : 'divide-stone-800'}`}>
              {filteredGRs.length === 0 ? (
                <tr>
                  <td colSpan={7} className={`py-8 text-center text-xs ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
                    No goods receipts recorded yet.
                  </td>
                </tr>
              ) : (
                filteredGRs.map((gr) => (
                  <tr
                    key={gr.id}
                    className={`transition-colors ${
                      isLight ? 'hover:bg-gray-50/80' : 'hover:bg-stone-800/40'
                    }`}
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-[#0F4C3A] dark:text-emerald-400">
                      {gr.id}
                    </td>
                    <td className={`py-3.5 px-4 font-mono ${isLight ? 'text-gray-800' : 'text-stone-200'}`}>
                      {gr.deliveryNoteNumber}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-blue-600 dark:text-blue-400">
                      {gr.poId}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className={`font-semibold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                        {gr.vendorName}
                      </div>
                      <div className={`text-[10px] ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
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
                      <div className={isLight ? 'text-gray-800' : 'text-stone-200'}>{gr.receivedBy}</div>
                      <div className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        <Thermometer className="w-3 h-3" />
                        {gr.items[0]?.tempCheckCelsius ? `${gr.items[0].tempCheckCelsius}°C Verified` : 'Temp OK'}
                      </div>
                    </td>
                    <td className={`py-3.5 px-4 text-right font-mono text-[11px] ${isLight ? 'text-gray-600' : 'text-stone-400'}`}>
                      {gr.glEntryId || 'GLE-Posted'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: INTERACTIVE PARTIAL GOODS RECEIPT */}
      {activeReceivingPO && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div
            className={`border rounded-2xl w-full max-w-[95vw] sm:max-w-2xl p-4 sm:p-6 space-y-4 sm:space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto my-auto ${
              isLight ? 'bg-white border-gray-200 text-gray-900' : 'bg-stone-900 border-stone-700 text-white'
            }`}
          >
            <div className={`flex items-center justify-between border-b pb-3 ${isLight ? 'border-gray-200' : 'border-stone-800'}`}>
              <div>
                <h3 className={`text-base font-bold flex items-center gap-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                  <Truck className="w-5 h-5 text-[#0F4C3A] dark:text-emerald-400" />
                  Receive Goods: PO #{activeReceivingPO.id}
                </h3>
                <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
                  Vendor: <strong>{activeReceivingPO.supplierName}</strong> • Destination: <strong>{activeReceivingPO.storeName}</strong>
                </p>
              </div>
              <button
                onClick={() => setActiveReceivingPO(null)}
                className={`p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-stone-800 transition-colors ${
                  isLight ? 'text-gray-500' : 'text-stone-400'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-gray-700' : 'text-stone-300'}`}>
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
                      : 'bg-stone-800 border-stone-700 text-white'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-gray-700' : 'text-stone-300'}`}>
                  Receiving Officer Name
                </label>
                <input
                  type="text"
                  value={receivedByInput}
                  onChange={(e) => setReceivedByInput(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:border-[#0F4C3A] focus:ring-1 focus:ring-[#0F4C3A] ${
                    isLight
                      ? 'bg-white border-gray-300 text-gray-900'
                      : 'bg-stone-800 border-stone-700 text-white'
                  }`}
                />
              </div>
            </div>

            {/* Items with partial quantity inputs */}
            <div className="space-y-3">
              <h4 className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-gray-700' : 'text-stone-300'}`}>
                Specify Received Items (Partial Fulfillment Supported)
              </h4>

              {activeReceivingPO.items.map((item, idx) => {
                const itemState = receivingItemsState[item.sku] || {
                  quantityReceived: item.remainingBackorder,
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
                        : 'bg-stone-800/80 border-stone-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <div>
                        <h5 className={`font-bold text-xs ${isLight ? 'text-gray-900' : 'text-white'}`}>
                          {item.productName}
                        </h5>
                        <span className={`font-mono text-[10px] ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
                          {item.sku}
                        </span>
                      </div>
                      <div className={`text-xs font-mono ${isLight ? 'text-gray-600' : 'text-stone-300'}`}>
                        Ordered: <strong>{item.orderedQuantity}</strong> | Remaining: <strong className="text-amber-600 dark:text-amber-400">{item.remainingBackorder}</strong>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                      <div>
                        <label className={`block text-[10px] mb-1 ${isLight ? 'text-gray-600' : 'text-stone-400'}`}>
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
                              ? 'bg-white border-gray-300 focus:border-[#0F4C3A] focus:ring-1 focus:ring-[#0F4C3A]'
                              : 'bg-stone-900 border-stone-600'
                          }`}
                        />
                      </div>

                      <div>
                        <label className={`block text-[10px] mb-1 ${isLight ? 'text-gray-600' : 'text-stone-400'}`}>
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
                              ? 'bg-white border-gray-300 text-gray-900 focus:border-[#0F4C3A] focus:ring-1 focus:ring-[#0F4C3A]'
                              : 'bg-stone-900 border-stone-600 text-white'
                          }`}
                        />
                      </div>

                      <div>
                        <label className={`block text-[10px] mb-1 ${isLight ? 'text-gray-600' : 'text-stone-400'}`}>
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
                              ? 'bg-white border-gray-300 focus:border-[#0F4C3A] focus:ring-1 focus:ring-[#0F4C3A]'
                              : 'bg-stone-900 border-stone-600'
                          }`}
                        />
                      </div>

                      <div>
                        <label className={`block text-[10px] mb-1 ${isLight ? 'text-gray-600' : 'text-stone-400'}`}>
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
                              ? 'bg-white border-gray-300 text-gray-900 focus:border-[#0F4C3A] focus:ring-1 focus:ring-[#0F4C3A]'
                              : 'bg-stone-900 border-stone-600 text-white'
                          }`}
                        >
                          <option value="Cold-Chain Verified">Cold-Chain Verified</option>
                          <option value="Passed - Grade A">Passed - Grade A</option>
                          <option value="Minor Discrepancy">Minor Discrepancy</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <span className={isLight ? 'text-gray-500' : 'text-stone-400'}>
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

            <div>
              <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-gray-700' : 'text-stone-300'}`}>
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
                    : 'bg-stone-800 border-stone-700 text-white'
                }`}
              />
            </div>

            <div className={`p-3.5 rounded-xl border text-xs space-y-1 ${
              isLight ? 'bg-emerald-50/60 border-emerald-200 text-gray-700' : 'bg-emerald-950/20 border-emerald-800/40 text-stone-300'
            }`}>
              <p className="font-semibold flex items-center gap-1.5 text-[#0F4C3A] dark:text-emerald-400">
                <Scale className="w-3.5 h-3.5" />
                Automated Double-Entry Accounting Posting:
              </p>
              <p>• <strong>Debit 1040 Merchandise Inventory Asset</strong>: +Value of received items into store warehouse</p>
              <p>• <strong>Credit 2010 Trade Accounts Payable</strong>: +Liability recognized for vendor settlement</p>
            </div>

            <div className={`flex justify-end gap-2 pt-3 border-t ${isLight ? 'border-gray-200' : 'border-stone-800'}`}>
              <button
                onClick={() => setActiveReceivingPO(null)}
                className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                  isLight
                    ? 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 shadow-2xs'
                    : 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitPartialGR}
                disabled={isSubmittingGR}
                className="px-5 py-2 text-xs font-semibold bg-[#0F4C3A] hover:bg-[#0b382b] text-white rounded-xl shadow-sm transition-all disabled:opacity-50"
              >
                {isSubmittingGR ? 'Posting GR & Inventory...' : 'Confirm Goods Receipt & Update Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE RESTOCK PR */}
      {isCreatingPR && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div
            className={`border rounded-2xl w-full max-w-[95vw] sm:max-w-md p-4 sm:p-6 space-y-4 shadow-2xl my-auto ${
              isLight ? 'bg-white border-gray-200 text-gray-900' : 'bg-stone-900 border-stone-700 text-white'
            }`}
          >
            <div className={`flex items-center justify-between border-b pb-3 ${isLight ? 'border-gray-200' : 'border-stone-800'}`}>
              <h3 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                New Purchase Request (PR)
              </h3>
              <button
                onClick={() => setIsCreatingPR(false)}
                className={`p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-stone-800 transition-colors ${
                  isLight ? 'text-gray-500' : 'text-stone-400'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-gray-700' : 'text-stone-300'}`}>
                Target Store Hub
              </label>
              <select
                value={prStoreId}
                onChange={(e) => setPrStoreId(e.target.value)}
                className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:border-[#0F4C3A] focus:ring-1 focus:ring-[#0F4C3A] ${
                  isLight
                    ? 'bg-white border-gray-300 text-gray-900'
                    : 'bg-stone-800 border-stone-700 text-white'
                }`}
              >
                <option value="store-jkt-senopati">GroceMart Senopati Flagship (Jakarta)</option>
                <option value="store-jkt-pik">GroceMart PIK 2 The Avenue (Jakarta)</option>
                <option value="store-bdg-dago">GroceMart Dago Green Market (Bandung)</option>
                <option value="store-sby-gubeng">GroceMart Gubeng Central Hub (Surabaya)</option>
                <option value="store-bali-canggu">GroceMart Batu Bolong Organic (Bali)</option>
              </select>
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-gray-700' : 'text-stone-300'}`}>
                Select Product / SKU to Restock
              </label>
              <select
                value={selectedPrSku}
                onChange={(e) => setSelectedPrSku(e.target.value)}
                className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:border-[#0F4C3A] focus:ring-1 focus:ring-[#0F4C3A] ${
                  isLight
                    ? 'bg-white border-gray-300 text-gray-900'
                    : 'bg-stone-800 border-stone-700 text-white'
                }`}
              >
                <option value="">-- Choose Item from Inventory --</option>
                {inventory.map((item, idx) => (
                  <option key={`${item.sku}-${idx}`} value={item.sku}>
                    {item.productName} ({item.sku}) - Stock: {item.currentStock}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-gray-700' : 'text-stone-300'}`}>
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
                      : 'bg-stone-800 border-stone-700 text-white'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-gray-700' : 'text-stone-300'}`}>
                  Priority Level
                </label>
                <select
                  value={prPriority}
                  onChange={(e) => setPrPriority(e.target.value as any)}
                  className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:border-[#0F4C3A] focus:ring-1 focus:ring-[#0F4C3A] ${
                    isLight
                      ? 'bg-white border-gray-300 text-gray-900'
                      : 'bg-stone-800 border-stone-700 text-white'
                  }`}
                >
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-gray-700' : 'text-stone-300'}`}>
                Trigger Reason
              </label>
              <select
                value={prReason}
                onChange={(e) => setPrReason(e.target.value as any)}
                className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:border-[#0F4C3A] focus:ring-1 focus:ring-[#0F4C3A] ${
                  isLight
                    ? 'bg-white border-gray-300 text-gray-900'
                    : 'bg-stone-800 border-stone-700 text-white'
                }`}
              >
                <option value="manual_request">Manual Store Manager Request</option>
                <option value="low_stock_trigger">Automated Low Stock Threshold Trigger</option>
                <option value="bulk_restock">Weekend Promotional Bulk Restock</option>
              </select>
            </div>

            <div className={`flex justify-end gap-2 pt-3 border-t ${isLight ? 'border-gray-200' : 'border-stone-800'}`}>
              <button
                onClick={() => setIsCreatingPR(false)}
                className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                  isLight
                    ? 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 shadow-2xs'
                    : 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700'
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
        </div>
      )}
    </div>
  );
};
