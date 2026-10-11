import React, { useState, useEffect } from 'react';
import type { PickerOrder, PickerOrderItem, InventoryItem } from '../../types/index.ts';
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

  // Substitution Modal State
  const [subItem, setSubItem] = useState<PickerOrderItem | null>(null);
  const [replacementSku, setReplacementSku] = useState<string>('');
  const [subReason, setSubReason] = useState<string>('Shelf stock depleted; fresh harvest alternative');
  const [isSubmittingSub, setIsSubmittingSub] = useState<boolean>(false);

  const isLight = theme === 'light';

  const loadPickerOrders = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.getPickerOrders(
        selectedStore === 'CONSOLIDATED' ? 'ALL' : selectedStore,
        statusFilter === 'ALL' ? undefined : statusFilter
      );
      setOrders(res);
      if (res.length > 0) {
        // Keep selected order updated or pick first
        setSelectedOrder((prev) => (prev ? res.find((o) => o.orderId === prev.orderId) || res[0] : res[0]));
      } else {
        setSelectedOrder(null);
      }
    } catch (e) {
      console.error('Failed to load picker orders:', e);
      onShowToast('Error', 'Failed to retrieve picker queue');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPickerOrders();
  }, [selectedStore, statusFilter]);

  // Handle Scan Barcode
  const handleConfirmScan = async (item: PickerOrderItem) => {
    if (!selectedOrder) return;
    try {
      const res = await apiClient.pickOrderItem(selectedOrder.orderId, item.id, item.barcode);
      onShowToast('Item Scanned & Verified', `${item.productName} verified by EAN-13 barcode.`);
      loadPickerOrders();
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
      loadPickerOrders();
    } catch (err) {
      onShowToast('Weight Recording Failed', String(err));
    }
  };

  // Handle Real-Time Substitution
  const handleConfirmSubstitution = async () => {
    if (!selectedOrder || !subItem || !replacementSku) return;
    setIsSubmittingSub(true);
    try {
      const res = await apiClient.substituteOrderItem(selectedOrder.orderId, subItem.id, {
        replacementSku,
        reason: subReason,
      });

      onShowToast(
        'Substitution Engine Dispatched',
        `Item substituted. Customer push notification triggered: "${res.notificationMessage}"`
      );

      setSubItem(null);
      loadPickerOrders();
    } catch (err) {
      onShowToast('Substitution Failed', String(err));
    } finally {
      setIsSubmittingSub(false);
    }
  };

  // Handle Complete Order
  const handleCompleteOrder = async () => {
    if (!selectedOrder) return;
    try {
      const res = await apiClient.completePickerOrder(selectedOrder.orderId);
      onShowToast('Picking Complete', res.message);
      loadPickerOrders();
    } catch (err) {
      onShowToast('Failed to Complete Order', String(err));
    }
  };

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
                Picker App &amp; Real-Time Fulfillment
              </span>
              <span className={`text-xs ${isLight ? 'text-stone-500' : 'text-stone-400'}`}>
                Aisle-Optimized Terminal
              </span>
            </div>
            <h2
              className={`text-xl sm:text-2xl font-bold tracking-tight ${
                isLight ? 'text-stone-900' : 'text-white'
              }`}
            >
              In-Store Picker Terminal &amp; Catch Weight
            </h2>
            <p
              className={`text-xs sm:text-sm mt-1 max-w-2xl ${
                isLight ? 'text-stone-600' : 'text-stone-400'
              }`}
            >
              Directs store floor staff through cold-chain and produce aisles with exact bay
              coordinates, barcode scanning verification, integrated digital scale weigh-in for
              catch-weight meats/fish, and automated customer substitution workflows.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadPickerOrders}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                isLight
                  ? 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50 shadow-sm'
                  : 'bg-stone-800 border-stone-700 text-stone-200 hover:bg-stone-700'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh Orders
            </button>
          </div>
        </div>
      </div>

      {/* Main Layout: Orders List (Left) + Order Detail & Picking List (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Order Queue */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className={`text-sm font-bold ${isLight ? 'text-stone-900' : 'text-white'}`}>
              Assigned Pick Orders ({orders.length})
            </h3>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`px-2 py-1 rounded-lg text-xs border ${
                isLight ? 'bg-white border-stone-200 text-stone-700' : 'bg-stone-800 border-stone-700 text-white'
              }`}
            >
              <option value="ALL">All Statuses</option>
              <option value="in_progress">In Progress</option>
              <option value="assigned">Assigned</option>
              <option value="ready_for_packing">Ready for Packing</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="space-y-2">
            {orders.length === 0 ? (
              <div
                className={`p-6 text-center rounded-xl border text-xs text-stone-500 ${
                  isLight ? 'bg-white border-stone-200' : 'bg-stone-900 border-stone-800'
                }`}
              >
                No active orders matching this filter.
              </div>
            ) : (
              orders.map((order) => {
                const isSelected = selectedOrder?.orderId === order.orderId;
                const isComplete = order.pickerStatus === 'completed';
                const isReady = order.pickerStatus === 'ready_for_packing';

                return (
                  <div
                    key={order.orderId}
                    onClick={() => setSelectedOrder(order)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? isLight
                          ? 'bg-emerald-50/70 border-emerald-600 shadow-sm ring-1 ring-emerald-600/20'
                          : 'bg-emerald-950/30 border-emerald-500 ring-1 ring-emerald-500/20'
                        : isLight
                        ? 'bg-white border-stone-200 hover:border-emerald-300 shadow-[0_2px_8px_rgba(0,0,0,0.02)]'
                        : 'bg-stone-900 border-stone-800 hover:border-stone-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs text-stone-900 dark:text-white">
                        #{order.orderId}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                          isComplete
                            ? 'bg-emerald-100 text-emerald-800'
                            : isReady
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {order.pickerStatus.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="mt-2 text-xs font-medium text-stone-800 dark:text-stone-200">
                      {order.customerName}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-stone-500 mt-2">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-stone-400" />
                        <span>Dispatch by {new Date(order.targetDispatchTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <span className="font-bold text-emerald-700">
                        {order.pickedItems} / {order.totalItems} picked
                      </span>
                    </div>

                    {order.hasCatchWeight && (
                      <div className="mt-2 flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        <Scale className="w-3 h-3" />
                        <span>Contains Catch-Weight Item (Scale Req.)</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Picking Terminal & Interactive Items Queue */}
        <div className="lg:col-span-8">
          {selectedOrder ? (
            <div
              className={`rounded-2xl border p-5 sm:p-6 transition-all ${
                isLight
                  ? 'bg-white border-stone-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)]'
                  : 'bg-stone-900/90 border-stone-800'
              }`}
            >
              {/* Order Terminal Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-stone-200 dark:border-stone-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-lg font-bold text-stone-900 dark:text-white">
                      Order #{selectedOrder.orderId}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-600 text-white">
                      {selectedOrder.priority.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-xs text-stone-500 mt-1 flex items-center gap-3">
                    <span>Customer: <strong>{selectedOrder.customerName}</strong></span>
                    <span>Picker: <strong>{selectedOrder.assignedPicker}</strong></span>
                    <span>Store: <strong>{selectedOrder.storeName}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {selectedOrder.pickerStatus === 'ready_for_packing' && (
                    <button
                      onClick={handleCompleteOrder}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Stage for Dispatch
                    </button>
                  )}
                  {selectedOrder.pickerStatus === 'completed' && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <Check className="w-4 h-4" />
                      Staged at Cold-Chain Bay
                    </span>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="py-4">
                <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                  <span>Picking Progress</span>
                  <span>
                    {selectedOrder.pickedItems} of {selectedOrder.totalItems} items completed (
                    {Math.round((selectedOrder.pickedItems / selectedOrder.totalItems) * 100)}%)
                  </span>
                </div>
                <div className="w-full bg-stone-100 dark:bg-stone-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-[#0F4C3A] rounded-full transition-all duration-300"
                    style={{
                      width: `${(selectedOrder.pickedItems / selectedOrder.totalItems) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Picking Items Queue */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                  Floor Navigation &amp; Item Verification
                </h4>

                {selectedOrder.items.map((item) => {
                  const isPicked = item.status === 'picked';
                  const isSubstituted = item.status === 'substituted';

                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isPicked
                          ? isLight
                            ? 'bg-emerald-50/40 border-emerald-200/80'
                            : 'bg-emerald-950/20 border-emerald-800/40'
                          : isSubstituted
                          ? isLight
                            ? 'bg-blue-50/40 border-blue-200/80'
                            : 'bg-blue-950/20 border-blue-800/40'
                          : isLight
                          ? 'bg-stone-50/60 border-stone-200 hover:border-emerald-300'
                          : 'bg-stone-800/50 border-stone-700'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-stone-900 dark:text-white">
                              {item.productName}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200">
                              {item.sku}
                            </span>
                            {item.isCatchWeight && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                                <Scale className="w-3 h-3" />
                                Catch Weight ({item.actualWeighedGrams ? `${item.actualWeighedGrams}g weighed` : `est. ${item.estimatedWeightGrams}g`})
                              </span>
                            )}
                          </div>

                          {/* Aisle & Shelf Wayfinding */}
                          <div className="flex items-center gap-3 text-xs text-stone-600 dark:text-stone-400">
                            <span className="flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                              <MapPin className="w-3.5 h-3.5" />
                              {item.aisleLocation}
                            </span>
                            <span>&bull;</span>
                            <span>{item.shelfLocation}</span>
                            <span>&bull;</span>
                            <span className="font-mono text-stone-500">Barcode: {item.barcode}</span>
                          </div>

                          {/* Substitution details if applied */}
                          {item.substitution && (
                            <div className="mt-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 text-xs text-blue-900 dark:text-blue-200">
                              <div className="font-semibold flex items-center gap-1">
                                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                                Real-Time Substitution Approved:
                              </div>
                              <div className="text-[11px] mt-0.5">
                                Replaced with <strong>{item.substitution.replacementName}</strong> ({item.substitution.replacementSku}). Customer notified via SMS.
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Price & Actions */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="text-right mr-2">
                            <div className="font-bold text-sm text-stone-900 dark:text-white font-mono">
                              {formatIDR(item.finalPrice)}
                            </div>
                            <div className="text-[11px] text-stone-500">
                              Qty: {item.orderedQty} {item.unit}
                            </div>
                          </div>

                          {/* Catch Weight Weigh-in Button */}
                          {item.isCatchWeight && !isPicked && (
                            <button
                              onClick={() => {
                                setCatchWeightItem(item);
                                setScaleGramsInput(item.actualWeighedGrams || item.estimatedWeightGrams || 300);
                              }}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-all"
                            >
                              <Scale className="w-3.5 h-3.5" />
                              Weigh on Scale
                            </button>
                          )}

                          {/* Barcode Scan Simulator Button */}
                          {!isPicked && (
                            <button
                              onClick={() => handleConfirmScan(item)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#0F4C3A] hover:bg-[#0b382b] text-white shadow-xs transition-all"
                            >
                              <Scan className="w-3.5 h-3.5" />
                              Scan Barcode
                            </button>
                          )}

                          {/* Substitution Button */}
                          {!isPicked && !isSubstituted && (
                            <button
                              onClick={() => {
                                setSubItem(item);
                                setReplacementSku(inventory[1]?.sku || 'SKU-PRD-002');
                              }}
                              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                                isLight
                                  ? 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                                  : 'bg-stone-800 border-stone-700 text-stone-200'
                              }`}
                            >
                              Out of Stock / Substitute
                            </button>
                          )}

                          {/* Picked Status Badge */}
                          {isPicked && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold bg-emerald-600 text-white shadow-xs">
                              <Check className="w-3.5 h-3.5" />
                              Picked
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
            <div
              className={`p-12 text-center rounded-2xl border ${
                isLight ? 'bg-white border-stone-200' : 'bg-stone-900 border-stone-800'
              }`}
            >
              <ShoppingBag className="w-8 h-8 mx-auto text-stone-400 mb-2" />
              <h3 className="font-bold text-sm text-stone-700">Select an order to start picking</h3>
              <p className="text-xs text-stone-400 mt-1">
                Choose an assigned order from the queue on the left to begin digital fulfillment.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Catch-Weight Digital Scale Modal */}
      {catchWeightItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div
            className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden transition-all ${
              isLight ? 'bg-white border-stone-200 text-stone-900' : 'bg-stone-900 border-stone-800 text-white'
            }`}
          >
            <div className="p-5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500 text-white">
                  <Scale className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Digital Scale Weigh-In</h3>
                  <p className="text-xs text-stone-500">Variable-Weight Grocery Adjustment</p>
                </div>
              </div>
              <button
                onClick={() => setCatchWeightItem(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 text-xs">
                <div className="font-semibold text-stone-900 dark:text-white">
                  {catchWeightItem.productName}
                </div>
                <div className="text-stone-500 mt-0.5">
                  Base Price: {formatIDR(catchWeightItem.pricePer100g || 40000)} per 100g &bull; Target: {catchWeightItem.estimatedWeightGrams || 300}g
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 text-stone-700 dark:text-stone-300">
                  Actual Scale Reading (Grams)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={50}
                    max={2000}
                    step={5}
                    value={scaleGramsInput}
                    onChange={(e) => setScaleGramsInput(Number(e.target.value))}
                    className={`w-full pl-4 pr-12 py-3 rounded-xl text-lg font-mono font-bold border transition-colors ${
                      isLight
                        ? 'bg-stone-50 border-stone-200 text-stone-900 focus:bg-white focus:border-amber-500'
                        : 'bg-stone-800 border-stone-700 text-white'
                    }`}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-stone-400">
                    grams
                  </span>
                </div>
              </div>

              {/* Quick weight selector chips */}
              <div className="flex items-center gap-2">
                {[280, 300, 315, 330, 350].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setScaleGramsInput(preset)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border ${
                      scaleGramsInput === preset
                        ? 'bg-amber-500 text-white border-amber-600'
                        : 'bg-stone-100 dark:bg-stone-800 border-stone-200 text-stone-600'
                    }`}
                  >
                    {preset}g
                  </button>
                ))}
              </div>

              {/* Real-Time Price Preview */}
              <div
                className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                  isLight ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-amber-950/30 border-amber-800 text-amber-200'
                }`}
              >
                <div>
                  <span className="font-semibold">Recalculated QRIS Charge:</span>
                  <div className="text-[11px] text-stone-500">
                    ({scaleGramsInput}g &divide; 100) &times; {formatIDR(catchWeightItem.pricePer100g || 40000)}
                  </div>
                </div>
                <div className="text-base font-bold text-amber-700 font-mono">
                  {formatIDR(Math.round((scaleGramsInput / 100) * (catchWeightItem.pricePer100g || 40000)))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setCatchWeightItem(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-stone-200 text-stone-700 dark:text-stone-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCatchWeight}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
                >
                  Capture Scale Weight
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Real-Time Substitution Engine Modal */}
      {subItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div
            className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden transition-all ${
              isLight ? 'bg-white border-stone-200 text-stone-900' : 'bg-stone-900 border-stone-800 text-white'
            }`}
          >
            <div className="p-5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-600 text-white">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Real-Time Substitution Engine</h3>
                  <p className="text-xs text-stone-500">Instant Customer Alert &amp; Replacement</p>
                </div>
              </div>
              <button
                onClick={() => setSubItem(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 text-xs">
                <div className="font-semibold text-rose-900 dark:text-rose-200">
                  Out of Stock: {subItem.productName} ({subItem.sku})
                </div>
                <div className="text-[11px] text-stone-500 mt-0.5">
                  Aisle {subItem.aisleLocation} has insufficient quality stock to fulfill order.
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-stone-700 dark:text-stone-300">
                  Select Approved Replacement Item
                </label>
                <select
                  value={replacementSku}
                  onChange={(e) => setReplacementSku(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl text-xs sm:text-sm border transition-colors ${
                    isLight ? 'bg-stone-50 border-stone-200 text-stone-900' : 'bg-stone-800 border-stone-700 text-white'
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

              <div>
                <label className="block text-xs font-semibold mb-1 text-stone-700 dark:text-stone-300">
                  Reason for Substitution
                </label>
                <input
                  type="text"
                  value={subReason}
                  onChange={(e) => setSubReason(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl text-xs sm:text-sm border transition-colors ${
                    isLight ? 'bg-stone-50 border-stone-200 text-stone-900' : 'bg-stone-800 border-stone-700 text-white'
                  }`}
                />
              </div>

              {/* Customer Notification Preview */}
              <div className="p-3 rounded-xl bg-stone-100 dark:bg-stone-800 border border-stone-200 text-xs space-y-1">
                <div className="flex items-center gap-1 font-semibold text-stone-800 dark:text-stone-200">
                  <Bell className="w-3.5 h-3.5 text-blue-600" />
                  SMS &amp; App Push Preview to Customer:
                </div>
                <p className="text-[11px] text-stone-600 dark:text-stone-400 italic">
                  &ldquo;GroceMart Notice: To maintain 100% farm freshness, we upgraded your {subItem.sku} to {inventory.find((i) => i.sku === replacementSku)?.productName || 'our premium alternative'} at zero price penalty. Tap to review.&rdquo;
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setSubItem(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-stone-200 text-stone-700 dark:text-stone-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmittingSub}
                  onClick={handleConfirmSubstitution}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm disabled:opacity-50"
                >
                  {isSubmittingSub ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Dispatch Substitution
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
