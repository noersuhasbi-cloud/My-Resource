import React, { useState, useEffect } from 'react';
import type {
  PickerOrder,
  PickerOrderItem,
  InventoryItem,
  SubstitutionPromptRecord,
} from '../../types/index.ts';
import { apiClient } from '../../services/apiClient';
import { formatIDR } from '../../utils/formatters';
import {
  Scan,
  Scale,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Truck,
  ArrowRight,
  Clock,
  MapPin,
  Barcode,
  Search,
  Check,
  X,
  Sparkles,
  ShoppingBag,
  Bell,
  Thermometer,
  ShieldCheck,
  Layers,
  MessageCircle,
  Smartphone,
  Send,
  ThumbsUp,
  ThumbsDown,
  FileCheck2,
  AlertTriangle,
} from 'lucide-react';

interface PickerModuleProps {
  theme: 'light' | 'dark';
  selectedStore: string;
  inventory: InventoryItem[];
  onShowToast: (title: string, message: string) => void;
}

export const PickerModule: React.FC<PickerModuleProps> = ({
  theme,
  selectedStore,
  inventory,
  onShowToast,
}) => {
  // View Switcher: Active Picking Queue vs Real-Time Substitution Prompt Engine (Module 2)
  const [activeView, setActiveView] = useState<'queue' | 'prompts'>('queue');

  const [orders, setOrders] = useState<PickerOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<PickerOrder | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Scanner Simulator State
  const [activeItemToScan, setActiveItemToScan] = useState<PickerOrderItem | null>(null);
  const [scannedBarcodeInput, setScannedBarcodeInput] = useState<string>('');

  // Catch Weight Modal State
  const [catchWeightItem, setCatchWeightItem] = useState<PickerOrderItem | null>(null);
  const [scaleGramsInput, setScaleGramsInput] = useState<number>(300);

  // =============================================================
  // MODULE 2: Substitution & Customer Prompt Engine State
  // =============================================================
  const [substitutionPrompts, setSubstitutionPrompts] = useState<SubstitutionPromptRecord[]>([]);
  const [subItem, setSubItem] = useState<PickerOrderItem | null>(null);
  const [subOrder, setSubOrder] = useState<PickerOrder | null>(null);
  const [replacementSku, setReplacementSku] = useState<string>('');
  const [promptChannel, setPromptChannel] = useState<'WhatsApp' | 'InAppPush' | 'SMS'>('WhatsApp');
  const [absorbPriceDifference, setAbsorbPriceDifference] = useState<boolean>(true);
  const [isSubmittingSub, setIsSubmittingSub] = useState<boolean>(false);
  const [isSimulatingCustomerResponse, setIsSimulatingCustomerResponse] = useState<string | null>(null);

  const isLight = theme === 'light';

  const loadPickerData = async () => {
    setIsLoading(true);
    try {
      const [ordersRes, promptsRes] = await Promise.all([
        apiClient.getPickerOrders(
          selectedStore === 'CONSOLIDATED' ? 'ALL' : selectedStore,
          statusFilter === 'ALL' ? undefined : statusFilter
        ),
        apiClient.getSubstitutionPrompts(
          undefined,
          selectedStore === 'CONSOLIDATED' ? undefined : selectedStore
        ).catch(() => []),
      ]);

      setOrders(ordersRes);
      setSubstitutionPrompts(promptsRes);

      if (ordersRes.length > 0) {
        setSelectedOrder((prev) => (prev ? ordersRes.find((o) => o.orderId === prev.orderId) || ordersRes[0] : ordersRes[0]));
      } else {
        setSelectedOrder(null);
      }
    } catch (e) {
      console.error('Failed to load picker data:', e);
      onShowToast('Error', 'Failed to retrieve picker queue');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPickerData();
  }, [selectedStore, statusFilter]);

  // Handle Scan Barcode
  const handleConfirmScan = async (item: PickerOrderItem) => {
    if (!selectedOrder) return;
    try {
      await apiClient.pickOrderItem(selectedOrder.orderId, item.id, item.barcode);
      onShowToast('Item Scanned & Verified', `${item.productName} verified by EAN-13 barcode.`);
      loadPickerData();
      setActiveItemToScan(null);
      setScannedBarcodeInput('');
    } catch (err) {
      onShowToast('Scan Verification Failed', String(err));
    }
  };

  // Handle Catch Weight Scale Save
  const handleSaveCatchWeight = async () => {
    if (!selectedOrder || !catchWeightItem || scaleGramsInput <= 0) return;
    try {
      const res = await apiClient.recordCatchWeight(selectedOrder.orderId, catchWeightItem.id, scaleGramsInput);
      onShowToast(
        'Scale Weight Recorded',
        `${catchWeightItem.productName} weighed at ${scaleGramsInput}g. Price adjusted to ${formatIDR(res.item.finalPrice)}.`
      );
      setCatchWeightItem(null);
      loadPickerData();
    } catch (err) {
      onShowToast('Weight Recording Failed', String(err));
    }
  };

  // MODULE 2: Dispatch Quick Substitution Prompt to Customer
  const handleDispatchSubstitutionPrompt = async () => {
    const activeTargetOrder = subOrder || selectedOrder;
    if (!activeTargetOrder || !subItem || !replacementSku) return;
    setIsSubmittingSub(true);
    try {
      const res = await apiClient.requestSubstitutionPrompt({
        orderId: activeTargetOrder.orderId,
        itemId: subItem.id,
        replacementSku,
        channel: promptChannel,
        absorbPriceDifference,
      });

      onShowToast(
        'Customer Prompt Dispatched',
        `Prompt sent to ${res.prompt.customerName} via ${res.prompt.channel}. Awaiting buyer decision.`
      );

      setSubItem(null);
      setSubOrder(null);
      loadPickerData();
    } catch (err) {
      onShowToast('Substitution Prompt Failed', String(err));
    } finally {
      setIsSubmittingSub(false);
    }
  };

  // MODULE 2: Simulate Customer Decision (WhatsApp approval / decline)
  const handleSimulateCustomerResponse = async (promptId: string, action: 'approve' | 'decline') => {
    setIsSimulatingCustomerResponse(promptId);
    try {
      const res = await apiClient.respondSubstitutionPrompt(promptId, action);
      onShowToast(
        action === 'approve' ? 'Buyer Approved Substitution!' : 'Buyer Declined Substitution',
        res.message
      );
      loadPickerData();
    } catch (err) {
      onShowToast('Response Failed', String(err));
    } finally {
      setIsSimulatingCustomerResponse(null);
    }
  };

  // Handle Complete Order
  const handleCompleteOrder = async () => {
    if (!selectedOrder) return;
    try {
      const res = await apiClient.completePickerOrder(selectedOrder.orderId);
      onShowToast('Picking Complete', res.message);
      loadPickerData();
    } catch (err) {
      onShowToast('Failed to Complete Order', String(err));
    }
  };

  // Live price delta calculations for modal
  const targetReplacementItem = inventory.find((i) => i.sku === replacementSku);
  const originalItemPrice = subItem?.finalPrice || subItem?.pricePerUnit || 0;
  const replacementPrice = targetReplacementItem?.sellingPrice || 0;
  const priceDelta = replacementPrice - originalItemPrice;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div
        className={`p-5 sm:p-6 rounded-2xl border transition-colors ${
          isLight
            ? 'bg-gradient-to-r from-emerald-50 via-white to-stone-50 border-emerald-900/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)]'
            : 'bg-stone-900/80 border-stone-800'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#0F4C3A] text-white tracking-wide uppercase">
                Fulfillment Terminal
              </span>
              <span className={`text-xs ${isLight ? 'text-stone-500' : 'text-stone-400'}`}>
                Aisle-Optimized Barcode &amp; Catch-Weight Operations
              </span>
            </div>
            <h2 className={`text-xl sm:text-2xl font-bold tracking-tight ${isLight ? 'text-stone-900' : 'text-white'}`}>
              In-Store Fulfillment &amp; Quick Substitution
            </h2>
            <p className={`text-xs sm:text-sm mt-1 max-w-2xl ${isLight ? 'text-stone-600' : 'text-stone-400'}`}>
              High-velocity picking workflow with EAN-13 barcode verification, digital catch-weight scales,
              and real-time customer WhatsApp substitution prompts with FIFO batch reconciliation.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={loadPickerData}
              disabled={isLoading}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                isLight
                  ? 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50 shadow-sm'
                  : 'bg-stone-800 border-stone-700 text-stone-200 hover:bg-stone-700'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh Queue
            </button>
          </div>
        </div>

        {/* View Switcher Tabs (Module 2 Integration) */}
        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-gray-200/80 dark:border-stone-800 flex-wrap">
          <button
            onClick={() => setActiveView('queue')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeView === 'queue'
                ? 'bg-[#0F4C3A] text-white shadow-xs'
                : isLight
                ? 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                : 'bg-stone-800 text-stone-300 hover:bg-stone-700 border border-stone-700'
            }`}
          >
            <Scan className="w-3.5 h-3.5" />
            Active Picking Orders &amp; Scales ({orders.length})
          </button>

          <button
            onClick={() => setActiveView('prompts')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeView === 'prompts'
                ? 'bg-[#0F4C3A] text-white shadow-xs'
                : isLight
                ? 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                : 'bg-stone-800 text-stone-300 hover:bg-stone-700 border border-stone-700'
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
            Module 2: Real-Time Substitution &amp; Buyer Prompts ({substitutionPrompts.length})
          </button>
        </div>
      </div>

      {/* VIEW 1: ACTIVE ORDER QUEUE & CATCH WEIGHT */}
      {activeView === 'queue' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order Queue Column */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className={`font-bold text-sm ${isLight ? 'text-stone-900' : 'text-white'}`}>
                Assigned Orders Queue
              </h3>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`px-2 py-1 rounded-lg text-xs border ${
                  isLight ? 'bg-white border-stone-200 text-stone-700' : 'bg-stone-800 border-stone-700 text-stone-200'
                }`}
              >
                <option value="ALL">All Statuses</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="ready_for_packing">Ready to Pack</option>
                <option value="dispatched">Dispatched</option>
              </select>
            </div>

            <div className="space-y-2.5 max-h-[750px] overflow-y-auto pr-1">
              {orders.length === 0 ? (
                <div className="p-8 text-center text-xs text-stone-400 border rounded-xl">
                  No orders found in queue.
                </div>
              ) : (
                orders.map((order) => {
                  const isSelected = selectedOrder?.orderId === order.orderId;
                  const percentPicked = Math.round((order.pickedItems / order.totalItems) * 100);

                  return (
                    <div
                      key={order.orderId}
                      onClick={() => setSelectedOrder(order)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[#0F4C3A] bg-[#0F4C3A]/5 shadow-sm ring-1 ring-[#0F4C3A]'
                          : isLight
                          ? 'bg-white border-stone-200/80 hover:bg-stone-50'
                          : 'bg-stone-900 border-stone-800 hover:bg-stone-800/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-[#0F4C3A] dark:text-emerald-400">
                          {order.orderId}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            order.priority === 'express_30min'
                              ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                              : 'bg-stone-500/10 text-stone-600'
                          }`}
                        >
                          {order.priority.replace(/_/g, ' ')}
                        </span>
                      </div>

                      <div className="mt-2 text-xs font-semibold text-stone-900 dark:text-stone-100 truncate">
                        {order.customerName}
                      </div>
                      <div className="text-[11px] text-stone-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" /> {order.storeName}
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-stone-500">
                            {order.pickedItems}/{order.totalItems} Items Picked
                          </span>
                          <span className="font-bold text-[#0F4C3A] dark:text-emerald-400">{percentPicked}%</span>
                        </div>
                        <div className="w-full bg-stone-100 dark:bg-stone-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-[#0F4C3A] h-full rounded-full transition-all duration-300"
                            style={{ width: `${percentPicked}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Active Order Items Column */}
          <div className="lg:col-span-2 space-y-4">
            {selectedOrder ? (
              <div
                className={`p-5 rounded-2xl border transition-all ${
                  isLight ? 'bg-white border-stone-200/80 shadow-sm' : 'bg-stone-900 border-stone-800'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-100 dark:border-stone-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className={`text-base font-bold ${isLight ? 'text-stone-900' : 'text-white'}`}>
                        Order #{selectedOrder.orderId}
                      </h3>
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#0F4C3A]/10 text-[#0F4C3A] dark:text-emerald-400">
                        {selectedOrder.pickerStatus.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-stone-400 mt-0.5">
                      Customer: {selectedOrder.customerName} ({selectedOrder.customerPhone}) &bull; Target: {selectedOrder.targetDispatchTime}
                    </p>
                  </div>

                  {selectedOrder.pickerStatus !== 'ready_for_packing' && selectedOrder.pickerStatus !== 'completed' ? (
                    <button
                      onClick={handleCompleteOrder}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#0F4C3A] hover:bg-[#0b382b] text-white shadow-sm transition-all"
                    >
                      Complete &amp; Seal Batch
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Ready for Delivery
                    </span>
                  )}
                </div>

                {/* Items List */}
                <div className="space-y-3 mt-4">
                  {selectedOrder.items.map((item) => {
                    const isPicked = item.status === 'picked';
                    const isSubstituted = item.status === 'substituted';

                    return (
                      <div
                        key={item.id}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isPicked
                            ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-500/30'
                            : isSubstituted
                            ? 'bg-purple-50/40 dark:bg-purple-950/20 border-purple-500/30'
                            : isLight
                            ? 'bg-stone-50/60 border-stone-200'
                            : 'bg-stone-800/40 border-stone-700'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-stone-900 dark:text-white">
                                {item.productName}
                              </span>
                              {item.isCatchWeight && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300">
                                  Catch-Weight (Scale)
                                </span>
                              )}
                              {isSubstituted && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-500/20 text-purple-700 dark:text-purple-300">
                                  Substituted
                                </span>
                              )}
                            </div>

                            <div className="text-[11px] text-stone-500 flex items-center gap-3">
                              <span>SKU: {item.sku}</span>
                              <span>&bull;</span>
                              <span>Aisle: {item.aisleLocation}</span>
                              <span>&bull;</span>
                              <span>Shelf: {item.shelfLocation}</span>
                            </div>

                            {item.isCatchWeight && item.actualWeighedGrams && (
                              <div className="text-[11px] font-mono text-amber-700 dark:text-amber-300 font-semibold">
                                Certified Scale: {item.actualWeighedGrams}g &bull; Adjusted: {formatIDR(item.finalPrice)}
                              </div>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                            {item.isCatchWeight && !isPicked && (
                              <button
                                onClick={() => {
                                  setCatchWeightItem(item);
                                  setScaleGramsInput(item.actualWeighedGrams || item.estimatedWeightGrams || 300);
                                }}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-all"
                              >
                                <Scale className="w-3.5 h-3.5" />
                                Weigh Scale
                              </button>
                            )}

                            {!isPicked && (
                              <button
                                onClick={() => handleConfirmScan(item)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#0F4C3A] hover:bg-[#0b382b] text-white shadow-xs transition-all"
                              >
                                <Scan className="w-3.5 h-3.5" />
                                Scan Barcode
                              </button>
                            )}

                            {!isPicked && !isSubstituted && (
                              <button
                                onClick={() => {
                                  setSubItem(item);
                                  setSubOrder(selectedOrder);
                                  setReplacementSku(inventory.find((i) => i.sku !== item.sku)?.sku || 'SKU-PRD-002');
                                }}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                                  isLight
                                    ? 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                                    : 'bg-stone-800 border-stone-700 text-stone-200'
                                }`}
                              >
                                Quick Substitution
                              </button>
                            )}

                            {isPicked && (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold bg-emerald-600 text-white shadow-xs">
                                <Check className="w-3.5 h-3.5" /> Picked
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className={`p-12 text-center rounded-2xl border ${isLight ? 'bg-white border-stone-200' : 'bg-stone-900 border-stone-800'}`}>
                <ShoppingBag className="w-8 h-8 mx-auto text-stone-400 mb-2" />
                <h3 className="font-bold text-sm text-stone-700">Select an order to start picking</h3>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: MODULE 2 REAL-TIME SUBSTITUTION & WHATSAPP PROMPTS */}
      {activeView === 'prompts' && (
        <div className="space-y-6">
          <div
            className={`p-5 rounded-2xl border ${
              isLight ? 'bg-white border-gray-200 shadow-2xs' : 'bg-stone-900 border-stone-800'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                  Real-Time Customer Substitution Queue &amp; Approval Simulator
                </h3>
                <p className="text-xs text-gray-400">
                  When packers encounter an out-of-stock item, the engine sends instant notifications via WhatsApp/App Push.
                  Simulate buyer acceptance or decline below to verify dynamic basket recomputation and FIFO batch tracking.
                </p>
              </div>

              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                {substitutionPrompts.filter((p) => p.promptStatus === 'pending_customer_approval').length} Pending Buyer Decision
              </span>
            </div>

            {/* Prompt Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {substitutionPrompts.length === 0 ? (
                <div className="col-span-3 py-12 text-center text-gray-400 text-xs border rounded-2xl">
                  No substitution prompts dispatched yet. Click &ldquo;Quick Substitution&rdquo; on an order item to generate one.
                </div>
              ) : (
                substitutionPrompts.map((prompt) => {
                  const isPending = prompt.promptStatus === 'pending_customer_approval';
                  const isApproved = prompt.promptStatus === 'approved_by_customer' || prompt.promptStatus === 'auto_timeout_approved';
                  const isDeclined = prompt.promptStatus === 'declined_by_customer';

                  return (
                    <div
                      key={prompt.id}
                      className={`p-4 rounded-2xl border flex flex-col justify-between transition-all ${
                        isPending
                          ? 'border-amber-400/80 bg-amber-500/5 shadow-xs'
                          : isApproved
                          ? 'border-emerald-500/40 bg-emerald-500/5'
                          : 'border-rose-500/40 bg-rose-500/5'
                      }`}
                    >
                      <div>
                        {/* Header & Status */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="font-mono text-[11px] font-bold text-gray-900 dark:text-white">
                            {prompt.id}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                              isPending
                                ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                                : isApproved
                                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                                : 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
                            }`}
                          >
                            {prompt.promptStatus.replace(/_/g, ' ')}
                          </span>
                        </div>

                        {/* Customer & Order */}
                        <div className="text-xs font-bold text-gray-900 dark:text-white">
                          Order #{prompt.orderId} &bull; {prompt.customerName}
                        </div>
                        <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                          <MessageCircle className="w-3 h-3 text-emerald-500" />
                          {prompt.channel} ({prompt.customerPhone})
                        </div>

                        {/* Substitution Details */}
                        <div className="mt-3 p-3 rounded-xl bg-white dark:bg-stone-800 border border-gray-100 dark:border-stone-700 space-y-2 text-xs">
                          <div>
                            <span className="text-[10px] text-rose-500 font-semibold block uppercase">Out-of-Stock:</span>
                            <div className="font-medium text-gray-700 dark:text-stone-300">
                              {prompt.originalProductName} ({prompt.originalSku})
                            </div>
                            <div className="text-[11px] text-gray-400 font-mono">
                              Orig: {formatIDR(prompt.originalPrice)}
                            </div>
                          </div>

                          <div className="border-t border-gray-100 dark:border-stone-700 pt-1.5">
                            <span className="text-[10px] text-emerald-600 font-semibold block uppercase">Suggested Upgrade:</span>
                            <div className="font-bold text-emerald-700 dark:text-emerald-300">
                              {prompt.replacementProductName} ({prompt.replacementSku})
                            </div>
                            <div className="text-[11px] text-gray-400 font-mono">
                              New: {formatIDR(prompt.replacementPrice)}{' '}
                              {prompt.absorbPriceDifference ? (
                                <span className="text-emerald-600 font-semibold">(Store Absorbed 100%)</span>
                              ) : (
                                <span className="text-amber-600 font-semibold">(Delta: {formatIDR(prompt.priceDelta)})</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* WhatsApp Message Preview Quote */}
                        <div className="mt-2.5 p-2 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/50 text-[11px] text-emerald-900 dark:text-emerald-200 italic">
                          &ldquo;{prompt.simulationMessage}&rdquo;
                        </div>

                        {/* FIFO Batch Traceability Info */}
                        {prompt.fifoAuditLog && (
                          <div className="mt-2 text-[10px] text-gray-500 font-mono">
                            📦 {prompt.fifoAuditLog}
                          </div>
                        )}
                      </div>

                      {/* Interactive Customer Action Buttons */}
                      <div className="mt-4 pt-3 border-t border-gray-200 dark:border-stone-700">
                        {isPending ? (
                          <div className="space-y-1.5">
                            <span className="text-[10px] text-gray-400 font-semibold uppercase block">
                              Simulate Buyer Decision:
                            </span>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => handleSimulateCustomerResponse(prompt.id, 'approve')}
                                disabled={isSimulatingCustomerResponse === prompt.id}
                                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all disabled:opacity-50"
                              >
                                <ThumbsUp className="w-3.5 h-3.5" />
                                Approve
                              </button>
                              <button
                                onClick={() => handleSimulateCustomerResponse(prompt.id, 'decline')}
                                disabled={isSimulatingCustomerResponse === prompt.id}
                                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-all disabled:opacity-50"
                              >
                                <ThumbsDown className="w-3.5 h-3.5" />
                                Decline
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-gray-400">Decided:</span>
                            <span className="font-bold text-gray-700 dark:text-stone-300">
                              {prompt.decidedAt ? new Date(prompt.decidedAt).toLocaleTimeString('id-ID') : 'Resolved'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Catch-Weight Scale Modal */}
      {catchWeightItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div
            className={`w-full max-w-[95vw] sm:max-w-md rounded-2xl border shadow-2xl p-4 sm:p-5 my-auto ${
              isLight ? 'bg-white border-stone-200 text-stone-900' : 'bg-stone-900 border-stone-800 text-white'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800 mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500 text-white">
                  <Scale className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Digital Scale Weigh-In</h3>
                  <p className="text-xs text-stone-500">Variable-Weight Grocery Adjustment</p>
                </div>
              </div>
              <button onClick={() => setCatchWeightItem(null)} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 text-xs">
                <div className="font-semibold">{catchWeightItem.productName}</div>
                <div className="text-[11px] text-stone-500">Estimated: {catchWeightItem.estimatedWeightGrams || 300}g</div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Scale Reading (Grams)</label>
                <input
                  type="number"
                  min={1}
                  value={scaleGramsInput}
                  onChange={(e) => setScaleGramsInput(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl text-sm border font-mono font-bold"
                />
              </div>

              <div className="p-3 rounded-xl border text-xs flex items-center justify-between bg-amber-50 text-amber-900 border-amber-200">
                <span>Recalculated Price:</span>
                <span className="font-mono font-bold text-base">
                  {formatIDR(Math.round((scaleGramsInput / 100) * (catchWeightItem.pricePer100g || 40000)))}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCatchWeightItem(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border text-stone-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCatchWeight}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white"
                >
                  Capture Scale Weight
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODULE 2: Quick Substitution & Customer Prompt Dispatch Modal */}
      {subItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div
            className={`w-full max-w-[95vw] sm:max-w-lg rounded-2xl border shadow-2xl p-4 sm:p-5 my-auto max-h-[90vh] overflow-y-auto ${
              isLight ? 'bg-white border-stone-200 text-stone-900' : 'bg-stone-900 border-stone-800 text-white'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800 mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-600 text-white">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Module 2: Quick Substitution</h3>
                  <p className="text-xs text-stone-500">Real-Time Buyer WhatsApp / Push Notification</p>
                </div>
              </div>
              <button onClick={() => setSubItem(null)} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200">
                <span className="font-bold text-rose-900 dark:text-rose-200">
                  Out of Stock: {subItem.productName} ({subItem.sku})
                </span>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Ordered: {subItem.orderedQty} units &bull; Unit Price: {formatIDR(originalItemPrice)}
                </p>
              </div>

              <div>
                <label className="font-semibold block mb-1">Select Replacement Product</label>
                <select
                  value={replacementSku}
                  onChange={(e) => setReplacementSku(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border ${
                    isLight ? 'bg-stone-50 border-stone-200' : 'bg-stone-800 border-stone-700'
                  }`}
                >
                  {inventory
                    .filter((i) => i.sku !== subItem.sku)
                    .map((item) => (
                      <option key={item.sku} value={item.sku}>
                        {item.productName} - {formatIDR(item.sellingPrice)} (Stock: {item.currentStock})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Push Channel</label>
                  <select
                    value={promptChannel}
                    onChange={(e) => setPromptChannel(e.target.value as any)}
                    className={`w-full p-2.5 rounded-xl border ${
                      isLight ? 'bg-stone-50 border-stone-200' : 'bg-stone-800 border-stone-700'
                    }`}
                  >
                    <option value="WhatsApp">WhatsApp Message</option>
                    <option value="InAppPush">In-App Push Alert</option>
                    <option value="SMS">SMS Notification</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl border bg-gray-50 dark:bg-stone-800">
                    <input
                      type="checkbox"
                      checked={absorbPriceDifference}
                      onChange={(e) => setAbsorbPriceDifference(e.target.checked)}
                      className="rounded text-emerald-600"
                    />
                    <span className="font-semibold text-[11px]">Store Absorbs Delta (Free Upgrade)</span>
                  </label>
                </div>
              </div>

              {/* Price Delta Preview */}
              <div className="p-3 rounded-xl border bg-gray-50 dark:bg-stone-800/80 flex items-center justify-between">
                <div>
                  <span className="font-semibold">Price Delta Calculation:</span>
                  <div className="text-[11px] text-gray-500">
                    Original: {formatIDR(originalItemPrice)} &rarr; Replacement: {formatIDR(replacementPrice)}
                  </div>
                </div>
                <div className="font-mono font-bold text-sm text-emerald-600">
                  {priceDelta >= 0 ? `+${formatIDR(priceDelta)}` : formatIDR(priceDelta)}
                </div>
              </div>

              {/* Simulated Notification Message */}
              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-[11px] text-emerald-900 italic">
                &ldquo;GroceMart Notice: We ran out of {subItem.productName}. We suggested upgrading you to {targetReplacementItem?.productName || replacementSku} {absorbPriceDifference ? 'at no additional cost' : `with ${formatIDR(priceDelta)} difference`}. Tap to approve.&rdquo;
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSubItem(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border text-stone-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmittingSub}
                  onClick={handleDispatchSubstitutionPrompt}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm disabled:opacity-50"
                >
                  {isSubmittingSub ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Dispatch Prompt to Buyer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
