import React, { useState } from 'react';
import type {
  EnterpriseSettingsConfig,
  VendorBill,
  PurchaseOrder,
  GoodsReceiptRecord,
} from '../../types/index.ts';
import { apiClient } from '../../services/apiClient';
import { formatIDR } from '../../utils/formatters';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Save,
  RefreshCw,
  FileText,
  Sliders,
  DollarSign,
  Scale,
  Lock,
  ArrowRight,
  ExternalLink,
  Receipt,
  FileCheck2,
} from 'lucide-react';

interface ThreeWayMatchingSettingsTabProps {
  theme: 'light' | 'dark';
  settings: EnterpriseSettingsConfig;
  vendorBills: VendorBill[];
  purchaseOrders: PurchaseOrder[];
  goodsReceipts: GoodsReceiptRecord[];
  onUpdateSettings: (updated: Partial<EnterpriseSettingsConfig>) => Promise<void>;
  onRefreshData: () => void;
  onOpenVendorBillsModal?: () => void;
  onShowToast: (title: string, message: string) => void;
}

export const ThreeWayMatchingSettingsTab: React.FC<ThreeWayMatchingSettingsTabProps> = ({
  theme,
  settings,
  vendorBills,
  purchaseOrders,
  goodsReceipts,
  onUpdateSettings,
  onRefreshData,
  onOpenVendorBillsModal,
  onShowToast,
}) => {
  const isLight = theme === 'light';

  const [config, setConfig] = useState(settings.threeWayMatching);
  const [isSaving, setIsSaving] = useState(false);

  // Simulation state
  const [simPoId, setSimPoId] = useState<string>(purchaseOrders[0]?.id || 'PO-2026-088');
  const [simBilledQty, setSimBilledQty] = useState<number>(50);
  const [simBilledPrice, setSimBilledPrice] = useState<number>(11000);

  const cardClass = `rounded-2xl border transition-all ${
    isLight
      ? 'bg-white border-gray-200/90 shadow-[0_4px_16px_rgba(0,0,0,0.03)]'
      : 'bg-stone-900/90 border-stone-800 shadow-[0_4px_16px_rgba(0,0,0,0.2)]'
  }`;

  const inputClass = `px-3.5 py-2 text-xs rounded-xl font-medium transition-all ${
    isLight
      ? 'bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-[#0F4C3A] focus:ring-1 focus:ring-[#0F4C3A]'
      : 'bg-stone-800 border border-stone-700 text-white placeholder:text-stone-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
  }`;

  const labelClass = `block text-xs font-semibold mb-1.5 ${isLight ? 'text-gray-700' : 'text-stone-300'}`;

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await onUpdateSettings({ threeWayMatching: config });
      onShowToast('Matching Rules Saved', '3-Way Matching thresholds and disbursement blockades updated.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Error', msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Find simulated PO & GR
  const activePO = purchaseOrders.find((p) => p.id === simPoId) || purchaseOrders[0];
  const activeGR = goodsReceipts.find((g) => g.poId === activePO?.id);

  const poQty = activePO?.items[0]?.orderedQuantity || 50;
  const grQty = activeGR?.items[0]?.quantityReceived || poQty;
  const poPrice = activePO?.items[0]?.unitCost || 11000;

  // Compute variance
  const qtyVariancePercent = grQty > 0 ? (Math.abs(simBilledQty - grQty) / grQty) * 100 : 0;
  const priceVariancePercent = poPrice > 0 ? (Math.abs(simBilledPrice - poPrice) / poPrice) * 100 : 0;

  const isQtyMismatch = qtyVariancePercent > (config.enforcementMode === 'STRICT_3_WAY' ? 0 : config.quantityTolerancePercent);
  const isPriceMismatch = priceVariancePercent > (config.enforcementMode === 'STRICT_3_WAY' ? 0 : config.priceTolerancePercent);
  const isPassed = !isQtyMismatch && !isPriceMismatch;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Overview Banner */}
      <div className={`${cardClass} p-5 sm:p-6`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-xl bg-[#0F4C3A] text-white shadow-xs shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-[#0F4C3A] border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30 uppercase tracking-wider">
                  Accounts Payable Control
                </span>
                <span className={`text-xs ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
                  Internal Controls &amp; SOX Compliance
                </span>
              </div>
              <h2 className={`text-base sm:text-lg font-bold mt-1 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                Procurement 3-Way Matching Controls
              </h2>
              <p className={`text-xs mt-0.5 max-w-2xl ${isLight ? 'text-gray-600' : 'text-stone-400'}`}>
                Enforce automatic mathematical validation between Purchase Orders (PO), Goods Receipts (GR), and Vendor Bills. Prevent unauthorized supplier overpayments and quantity variances before disbursement.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenVendorBillsModal && (
              <button
                onClick={onOpenVendorBillsModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-stone-800 hover:bg-stone-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <Receipt className="w-4 h-4 text-emerald-400" />
                <span>Open AP Vendor Bills</span>
              </button>
            )}
            <button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Policies</span>
            </button>
          </div>
        </div>
      </div>

      {/* Policy Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Enforcement Policy */}
        <div className={`${cardClass} p-5 sm:p-6 space-y-4`}>
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-stone-800">
            <h3 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>
              <Sliders className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Matching Rules &amp; Tolerance Thresholds
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
              Active Control
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <label className={labelClass}>3-Way Matching Enforcement Mode</label>
              <select
                value={config.enforcementMode}
                onChange={(e) => setConfig({ ...config, enforcementMode: e.target.value as any })}
                className={`w-full ${inputClass}`}
              >
                <option value="TOLERANCE_3_WAY">Toleranced 3-Way (Recommended: Perishable Variance Buffers)</option>
                <option value="STRICT_3_WAY">Strict 3-Way (Zero Tolerance: PO = GR = Invoice required)</option>
                <option value="TWO_WAY">2-Way Matching (Bypass GR, validate PO price vs Bill only)</option>
              </select>
              <p className={`text-[11px] mt-1 ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
                {config.enforcementMode === 'TOLERANCE_3_WAY'
                  ? 'Permits minor moisture transpiration or scale discrepancies within set percentage buffers.'
                  : config.enforcementMode === 'STRICT_3_WAY'
                  ? 'Exact mathematical equivalence required. Any price or quantity deviation holds invoice.'
                  : 'Allows booking bills without formal receiving dock inspection receipts.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className={labelClass}>Quantity Tolerance (%)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="15"
                    value={config.quantityTolerancePercent}
                    onChange={(e) => setConfig({ ...config, quantityTolerancePercent: Number(e.target.value) })}
                    className={`w-full font-mono font-bold ${inputClass}`}
                  />
                  <span className="text-xs font-bold text-gray-500">%</span>
                </div>
                <span className="text-[10px] text-gray-500">Max allowable GR vs Billed Qty discrepancy</span>
              </div>

              <div>
                <label className={labelClass}>Price Variance Tolerance (%)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={config.priceTolerancePercent}
                    onChange={(e) => setConfig({ ...config, priceTolerancePercent: Number(e.target.value) })}
                    className={`w-full font-mono font-bold ${inputClass}`}
                  />
                  <span className="text-xs font-bold text-gray-500">%</span>
                </div>
                <span className="text-[10px] text-gray-500">Max allowable PO Unit Cost vs Invoice Cost</span>
              </div>
            </div>

            {/* Block Switches */}
            <div className="space-y-3 pt-2">
              <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 ${
                isLight ? 'bg-gray-50/70 border-gray-200' : 'bg-stone-800/40 border-stone-700'
              }`}>
                <div>
                  <h4 className="text-xs font-bold flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-rose-500" />
                    Block Payment Disbursement on Mismatch
                  </h4>
                  <p className={`text-[11px] mt-0.5 ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
                    Freezes treasury payouts and bank wire execution until variances are resolved.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={config.blockPaymentOnMismatch}
                    onChange={(e) => setConfig({ ...config, blockPaymentOnMismatch: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0F4C3A]"></div>
                </label>
              </div>

              <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 ${
                isLight ? 'bg-gray-50/70 border-gray-200' : 'bg-stone-800/40 border-stone-700'
              }`}>
                <div>
                  <h4 className="text-xs font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                    Require Store Manager Override for Variances
                  </h4>
                  <p className={`text-[11px] mt-0.5 ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
                    Bills flagged with PRICE_VARIANCE or QTY_VARIANCE cannot be approved without Executive/Manager authorization.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={config.requireManagerApprovalForVariance}
                    onChange={(e) => setConfig({ ...config, requireManagerApprovalForVariance: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0F4C3A]"></div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Live Matching Simulator */}
        <div className={`${cardClass} p-5 sm:p-6 space-y-4`}>
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-stone-800">
            <h3 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>
              <Scale className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Live 3-Way Matching Test Simulator
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold">
              Interactive Test
            </span>
          </div>

          <div className="space-y-3.5">
            <div>
              <label className={labelClass}>Select Test Purchase Order (PO)</label>
              <select
                value={simPoId}
                onChange={(e) => {
                  setSimPoId(e.target.value);
                  const p = purchaseOrders.find((x) => x.id === e.target.value);
                  if (p?.items[0]) {
                    setSimBilledQty(p.items[0].orderedQuantity);
                    setSimBilledPrice(p.items[0].unitCost);
                  }
                }}
                className={`w-full font-mono ${inputClass}`}
              >
                {purchaseOrders.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id} - {p.supplierName} ({p.items[0]?.productName?.slice(0, 24)})
                  </option>
                ))}
              </select>
            </div>

            {/* 3 Columns Comparison */}
            <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-gray-50 dark:bg-stone-800/50 border border-gray-200 dark:border-stone-700 text-xs">
              <div className="text-center p-2 rounded-lg bg-white dark:bg-stone-900 border">
                <span className="text-[10px] text-gray-400 block uppercase font-bold">1. PO Ordered</span>
                <div className="font-mono font-bold mt-1 text-[#0F4C3A] dark:text-emerald-400">{poQty} units</div>
                <div className="text-[10px] text-gray-500 font-mono">@{formatIDR(poPrice)}</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-white dark:bg-stone-900 border">
                <span className="text-[10px] text-gray-400 block uppercase font-bold">2. GR Received</span>
                <div className="font-mono font-bold mt-1 text-blue-600 dark:text-blue-400">{grQty} units</div>
                <div className="text-[10px] text-gray-500 font-mono">Verified dock</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-white dark:bg-stone-900 border border-amber-300 dark:border-amber-700">
                <span className="text-[10px] text-amber-600 block uppercase font-bold">3. Invoice Billed</span>
                <div className="font-mono font-bold mt-1 text-amber-700 dark:text-amber-300">{simBilledQty} units</div>
                <div className="text-[10px] font-mono text-gray-500">@{formatIDR(simBilledPrice)}</div>
              </div>
            </div>

            {/* Tweak Billed Values */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className={labelClass}>Simulated Billed Qty</label>
                <input
                  type="number"
                  value={simBilledQty}
                  onChange={(e) => setSimBilledQty(Number(e.target.value))}
                  className={`w-full font-mono font-bold ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>Simulated Billed Price (IDR)</label>
                <input
                  type="number"
                  step="500"
                  value={simBilledPrice}
                  onChange={(e) => setSimBilledPrice(Number(e.target.value))}
                  className={`w-full font-mono font-bold ${inputClass}`}
                />
              </div>
            </div>

            {/* Matching Result Box */}
            <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
              isPassed
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
            }`}>
              <div className="flex items-center gap-3">
                {isPassed ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                )}
                <div>
                  <h4 className="text-xs font-bold">
                    {isPassed ? '3-WAY MATCH SUCCESSFUL (CLEARED FOR PAYMENT)' : 'VARIANCE DETECTED (DISBURSEMENT BLOCKED)'}
                  </h4>
                  <p className="text-[11px] opacity-80 mt-0.5">
                    Qty Var: {qtyVariancePercent.toFixed(1)}% (Limit: {config.quantityTolerancePercent}%) | Price Var: {priceVariancePercent.toFixed(1)}% (Limit: {config.priceTolerancePercent}%)
                  </p>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold font-mono border ${
                isPassed
                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30'
              }`}>
                {isPassed ? 'MATCHED' : isPriceMismatch ? 'PRICE_VARIANCE' : 'QTY_VARIANCE'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Vendor Bills Audited */}
      <div className={`${cardClass} p-5 sm:p-6 space-y-4`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-gray-100 dark:border-stone-800">
          <div>
            <h3 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>
              <FileCheck2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Live 3-Way Matching Vendor Bills Audit
            </h3>
            <p className={`text-xs mt-0.5 ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
              Reconciled supplier invoices mapped against warehouse receiving slips and purchase orders.
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-gray-500">
            {vendorBills.length} Bills in Accounts Payable
          </span>
        </div>

        {vendorBills.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-500">
            No vendor bills recorded. Use the Accounts Payable suite or click &quot;Open AP Vendor Bills&quot; to test matching.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className={`border-b ${isLight ? 'border-gray-200 text-gray-500' : 'border-stone-700 text-stone-400'} uppercase text-[10px] font-bold`}>
                <tr>
                  <th className="py-2.5 px-3">Bill ID &amp; Invoice #</th>
                  <th className="py-2.5 px-3">Supplier Partner</th>
                  <th className="py-2.5 px-3">PO &amp; GR Links</th>
                  <th className="py-2.5 px-3 font-mono">Invoice Amount</th>
                  <th className="py-2.5 px-3">3-Way Match Status</th>
                  <th className="py-2.5 px-3">Payment Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-stone-800 font-medium">
                {vendorBills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-gray-50/50 dark:hover:bg-stone-800/40 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-mono font-bold text-[#0F4C3A] dark:text-emerald-400">{bill.id}</div>
                      <div className="text-[11px] text-gray-500 font-mono">{bill.billNumber}</div>
                    </td>
                    <td className="py-3 px-3 font-semibold text-gray-900 dark:text-stone-100">
                      {bill.supplierName}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px]">
                      <div className="text-emerald-700 dark:text-emerald-400">{bill.poId}</div>
                      <div className="text-blue-600 dark:text-blue-400">{bill.goodsReceiptId}</div>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-gray-900 dark:text-stone-100">
                      {formatIDR(bill.grandTotalIDR)}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        bill.status === 'MATCHED' || bill.status === 'APPROVED' || bill.status === 'PAID'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                          : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/20'
                      }`}>
                        {bill.status}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        bill.paymentStatus === 'PAID'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                          : bill.paymentStatus === 'UNPAID'
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20'
                          : 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20'
                      }`}>
                        {bill.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
