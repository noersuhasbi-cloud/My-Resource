import React, { useState } from 'react';
import type {
  EnterpriseSettingsConfig,
  VendorBill,
  PurchaseOrder,
  GoodsReceiptRecord,
} from '../../types/index.ts';
import { formatIDR } from '../../utils/formatters';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Save,
  RefreshCw,
  Sliders,
  Scale,
  Lock,
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

  const cardClass = `rounded-xl border transition-all ${
    isLight
      ? 'bg-white border-slate-200 shadow-xs hover:border-slate-300 text-slate-900'
      : 'bg-zinc-900 border-zinc-800 shadow-xs hover:border-zinc-700 text-zinc-100'
  }`;

  const inputClass = `w-full px-3.5 py-2 text-xs rounded-xl font-medium transition-all ${
    isLight
      ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600'
      : 'bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
  } focus:outline-hidden`;

  const labelClass = `block text-xs font-bold mb-1.5 ${isLight ? 'text-slate-800' : 'text-zinc-100'} dark:text-zinc-100`;

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
              <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-[#0F4C3A] border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30 uppercase tracking-wider">
                  Accounts Payable Control
                </span>
                <span className="text-xs text-gray-500 dark:text-zinc-300 font-medium">
                  Internal Controls &amp; SOX Compliance
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold mt-1 text-gray-900 dark:text-zinc-100">
                Procurement 3-Way Matching Controls
              </h2>
              <p className="text-xs mt-0.5 max-w-2xl text-gray-500 dark:text-zinc-300 leading-relaxed">
                Enforce automatic mathematical validation between Purchase Orders (PO), Goods Receipts (GR), and Vendor Bills. Prevent unauthorized supplier overpayments and quantity variances before disbursement.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {onOpenVendorBillsModal && (
              <button
                onClick={onOpenVendorBillsModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <Receipt className="w-4 h-4 text-emerald-400" />
                <span>Open AP Vendor Bills</span>
              </button>
            )}
            <button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
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
          <div className="flex items-center justify-between pb-3.5 border-b border-gray-100 dark:border-zinc-800">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-100">
                  Matching Rules &amp; Tolerance Thresholds
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-zinc-300">
                  Configure variance buffers and payment freezes
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
              Active Control
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <label className={labelClass}>3-Way Matching Enforcement Mode</label>
              <select
                value={config.enforcementMode}
                onChange={(e) => setConfig({ ...config, enforcementMode: e.target.value as any })}
                className={inputClass}
              >
                <option value="TOLERANCE_3_WAY" className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100">Toleranced 3-Way (Recommended: Perishable Variance Buffers)</option>
                <option value="STRICT_3_WAY" className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100">Strict 3-Way (Zero Tolerance: PO = GR = Invoice required)</option>
                <option value="TWO_WAY" className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100">2-Way Matching (Bypass GR, validate PO price vs Bill only)</option>
              </select>
              <p className="text-[11px] mt-1.5 text-gray-500 dark:text-zinc-300">
                {config.enforcementMode === 'TOLERANCE_3_WAY'
                  ? 'Permits minor moisture transpiration or scale discrepancies within set percentage buffers.'
                  : config.enforcementMode === 'STRICT_3_WAY'
                  ? 'Exact mathematical equivalence required. Any price or quantity deviation holds invoice.'
                  : 'Allows booking bills without formal receiving dock inspection receipts.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
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
                    className={`font-mono font-bold ${inputClass}`}
                  />
                  <span className="text-xs font-bold text-gray-500 dark:text-zinc-300 shrink-0">%</span>
                </div>
                <span className="text-[10px] text-gray-500 dark:text-zinc-300 mt-1 block">Max allowable GR vs Billed Qty discrepancy</span>
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
                    className={`font-mono font-bold ${inputClass}`}
                  />
                  <span className="text-xs font-bold text-gray-500 dark:text-zinc-300 shrink-0">%</span>
                </div>
                <span className="text-[10px] text-gray-500 dark:text-zinc-300 mt-1 block">Max allowable PO Unit Cost vs Invoice Cost</span>
              </div>
            </div>

            {/* Block Switches */}
            <div className="space-y-3 pt-1">
              <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 transition-all ${
                isLight ? 'bg-gray-50/70 border-gray-200 hover:border-gray-300' : 'bg-zinc-800/40 border-zinc-800 hover:border-zinc-700'
              }`}>
                <div>
                  <h4 className="text-xs font-bold flex items-center gap-1.5 text-gray-900 dark:text-zinc-100">
                    <Lock className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span>Block Payment Disbursement on Mismatch</span>
                  </h4>
                  <p className="text-[11px] mt-0.5 text-gray-500 dark:text-zinc-300">
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
                  <div className="w-10 h-5.5 bg-gray-200 dark:bg-zinc-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all after:shadow-xs peer-checked:bg-[#0F4C3A] dark:peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 transition-all ${
                isLight ? 'bg-gray-50/70 border-gray-200 hover:border-gray-300' : 'bg-zinc-800/40 border-zinc-800 hover:border-zinc-700'
              }`}>
                <div>
                  <h4 className="text-xs font-bold flex items-center gap-1.5 text-gray-900 dark:text-zinc-100">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span>Require Store Manager Override for Variances</span>
                  </h4>
                  <p className="text-[11px] mt-0.5 text-gray-500 dark:text-zinc-300">
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
                  <div className="w-10 h-5.5 bg-gray-200 dark:bg-zinc-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all after:shadow-xs peer-checked:bg-[#0F4C3A] dark:peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Live Matching Simulator */}
        <div className={`${cardClass} p-5 sm:p-6 space-y-4`}>
          <div className="flex items-center justify-between pb-3.5 border-b border-gray-100 dark:border-zinc-800">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                <Scale className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-100">
                  Live 3-Way Matching Test Simulator
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-zinc-300">
                  Verify tolerance triggers and variance formulas
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-500/20">
              Interactive Test
            </span>
          </div>

          <div className="space-y-4">
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
                className={`font-mono ${inputClass}`}
              >
                {purchaseOrders.map((p) => (
                  <option key={p.id} value={p.id} className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100">
                    {p.id} - {p.supplierName} ({p.items[0]?.productName?.slice(0, 24)})
                  </option>
                ))}
              </select>
            </div>

            {/* 3 Columns Comparison */}
            <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-gray-50/70 dark:bg-zinc-800/40 border border-gray-200 dark:border-zinc-800 text-xs">
              <div className="text-center p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-700/80">
                <span className="text-[10px] text-gray-400 dark:text-zinc-300 block uppercase font-bold">1. PO Ordered</span>
                <div className="font-mono font-bold mt-1 text-[#0F4C3A] dark:text-emerald-400">{poQty} units</div>
                <div className="text-[10px] text-gray-500 dark:text-zinc-300 font-mono mt-0.5">@{formatIDR(poPrice)}</div>
              </div>
              <div className="text-center p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-700/80">
                <span className="text-[10px] text-gray-400 dark:text-zinc-300 block uppercase font-bold">2. GR Received</span>
                <div className="font-mono font-bold mt-1 text-blue-600 dark:text-blue-400">{grQty} units</div>
                <div className="text-[10px] text-gray-500 dark:text-zinc-300 font-mono mt-0.5">Verified dock</div>
              </div>
              <div className="text-center p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-700/80">
                <span className="text-[10px] text-amber-600 dark:text-amber-400 block uppercase font-bold">3. Invoice Billed</span>
                <div className="font-mono font-bold mt-1 text-amber-700 dark:text-amber-300">{simBilledQty} units</div>
                <div className="text-[10px] font-mono text-gray-500 dark:text-zinc-300 mt-0.5">@{formatIDR(simBilledPrice)}</div>
              </div>
            </div>

            {/* Tweak Billed Values */}
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className={labelClass}>Simulated Billed Qty</label>
                <input
                  type="number"
                  value={simBilledQty}
                  onChange={(e) => setSimBilledQty(Number(e.target.value))}
                  className={`font-mono font-bold ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>Simulated Billed Price (IDR)</label>
                <input
                  type="number"
                  step="500"
                  value={simBilledPrice}
                  onChange={(e) => setSimBilledPrice(Number(e.target.value))}
                  className={`font-mono font-bold ${inputClass}`}
                />
              </div>
            </div>

            {/* Matching Result Box */}
            <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
              isPassed
                ? 'bg-emerald-50/80 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-200'
                : 'bg-rose-50/80 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40 text-rose-900 dark:text-rose-200'
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
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold font-mono border shrink-0 ${
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3.5 border-b border-gray-100 dark:border-zinc-800">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2 text-gray-900 dark:text-zinc-100">
              <FileCheck2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Live 3-Way Matching Vendor Bills Audit</span>
            </h3>
            <p className="text-xs mt-0.5 text-gray-500 dark:text-zinc-300">
              Reconciled supplier invoices mapped against warehouse receiving slips and purchase orders.
            </p>
          </div>
          <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 border border-gray-200 dark:border-zinc-700">
            {vendorBills.length} Bills in Accounts Payable
          </span>
        </div>

        {vendorBills.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-500 dark:text-zinc-300">
            No vendor bills recorded. Use the Accounts Payable suite or click &quot;Open AP Vendor Bills&quot; to test matching.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-zinc-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/70 dark:bg-zinc-800/60 border-b border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-300 uppercase text-[10px] font-bold">
                <tr>
                  <th className="py-3 px-3.5">Bill ID &amp; Invoice #</th>
                  <th className="py-3 px-3.5">Supplier Partner</th>
                  <th className="py-3 px-3.5">PO &amp; GR Links</th>
                  <th className="py-3 px-3.5 font-mono">Invoice Amount</th>
                  <th className="py-3 px-3.5">3-Way Match Status</th>
                  <th className="py-3 px-3.5">Payment Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800 font-medium">
                {vendorBills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3.5 px-3.5">
                      <div className="font-mono font-bold text-[#0F4C3A] dark:text-emerald-400">{bill.id}</div>
                      <div className="text-[11px] text-gray-500 dark:text-zinc-300 font-mono mt-0.5">{bill.billNumber}</div>
                    </td>
                    <td className="py-3.5 px-3.5 font-semibold text-gray-900 dark:text-zinc-100">
                      {bill.supplierName}
                    </td>
                    <td className="py-3.5 px-3.5 font-mono text-[11px]">
                      <div className="text-emerald-700 dark:text-emerald-400">{bill.poId}</div>
                      <div className="text-blue-600 dark:text-blue-400">{bill.goodsReceiptId}</div>
                    </td>
                    <td className="py-3.5 px-3.5 font-mono font-bold text-gray-900 dark:text-zinc-100">
                      {formatIDR(bill.grandTotalIDR)}
                    </td>
                    <td className="py-3.5 px-3.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        bill.status === 'MATCHED' || bill.status === 'APPROVED' || bill.status === 'PAID'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                          : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/20'
                      }`}>
                        {bill.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-3.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
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
