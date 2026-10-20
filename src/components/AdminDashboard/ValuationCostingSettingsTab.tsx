import React, { useState } from 'react';
import type {
  EnterpriseSettingsConfig,
  LandedCostRecord,
  StoreInventoryStock,
  ChartOfAccount,
} from '../../types/index.ts';
import { apiClient } from '../../services/apiClient';
import { formatIDR } from '../../utils/formatters';
import {
  Scale,
  Plus,
  Save,
  CheckCircle2,
  Boxes,
  Truck,
  ShieldCheck,
  RefreshCw,
  Tag,
  ReceiptText,
  Calculator,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface ValuationCostingSettingsTabProps {
  theme: 'light' | 'dark';
  settings: EnterpriseSettingsConfig;
  landedCosts: LandedCostRecord[];
  inventoryTiers: StoreInventoryStock[];
  chartOfAccounts: ChartOfAccount[];
  onUpdateSettings: (updated: Partial<EnterpriseSettingsConfig>) => Promise<void>;
  onRefreshLandedCosts: () => void;
  onShowToast: (title: string, message: string) => void;
}

export const ValuationCostingSettingsTab: React.FC<ValuationCostingSettingsTabProps> = ({
  theme,
  settings,
  landedCosts,
  inventoryTiers,
  chartOfAccounts,
  onUpdateSettings,
  onRefreshLandedCosts,
  onShowToast,
}) => {
  const isLight = theme === 'light';

  // Local settings state
  const [config, setConfig] = useState(settings.landedCosts);
  const [invoiceTracking, setInvoiceTracking] = useState(settings.invoiceTracking);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Landed Cost Entry Modal
  const [isLandedModalOpen, setIsLandedModalOpen] = useState(false);
  const [isSubmittingLanded, setIsSubmittingLanded] = useState(false);
  const [lcDescription, setLcDescription] = useState('Reefer Truck Transport & Lembang Mountain Cold Gate Intake Fee');
  const [lcPoId, setLcPoId] = useState('PO-2026-088');
  const [lcBillNumber, setLcBillNumber] = useState('INV-KSB-2026-088');
  const [lcFreightIDR, setLcFreightIDR] = useState<number>(350000);
  const [lcCustomsDutyIDR, setLcCustomsDutyIDR] = useState<number>(0);
  const [lcHandlingCostIDR, setLcHandlingCostIDR] = useState<number>(120000);
  const [lcInsuranceCostIDR, setLcInsuranceCostIDR] = useState<number>(50000);
  const [lcAllocationMethod, setLcAllocationMethod] = useState<'EQUAL' | 'BY_QUANTITY' | 'BY_VALUE' | 'BY_WEIGHT'>('BY_QUANTITY');

  // Selected SKUs for landed cost absorption
  const [selectedSkus, setSelectedSkus] = useState<Array<{ sku: string; quantity: number }>>([
    { sku: 'SKU-PRD-001', quantity: 50 },
    { sku: 'SKU-PRD-002', quantity: 40 },
    { sku: 'SKU-DAI-001', quantity: 20 },
  ]);

  const cardClass = `rounded-xl border transition-all ${
    isLight
      ? 'bg-white border-gray-200 shadow-xs hover:border-gray-300'
      : 'bg-stone-900 border-stone-800 shadow-xs hover:border-stone-700'
  }`;

  const subCardClass = `rounded-xl border p-4 transition-all ${
    isLight
      ? 'bg-gray-50/70 border-gray-200 text-gray-900'
      : 'bg-stone-800/40 border-stone-700/80 text-stone-100'
  }`;

  const inputClass = `w-full px-3.5 py-2 text-xs rounded-xl font-medium transition-all bg-white dark:bg-stone-900 border border-gray-200 dark:border-stone-700 text-gray-900 dark:text-stone-100 placeholder:text-gray-400 dark:placeholder:text-stone-500 focus:outline-hidden focus:border-[#0F4C3A] dark:focus:border-emerald-500 focus:ring-1 focus:ring-[#0F4C3A] dark:focus:ring-emerald-500`;

  const labelClass = `block text-xs font-semibold mb-1.5 text-gray-700 dark:text-stone-300`;

  const handleSaveSettings = async () => {
    setIsSavingConfig(true);
    try {
      await onUpdateSettings({
        landedCosts: config,
        invoiceTracking,
      });
      onShowToast('Settings Saved', 'Valuation & Landed Cost parameters updated across ERP.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Error', msg);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleExecuteLandedCost = async (e: React.FormEvent) => {
    e.preventDefault();
    const total = lcFreightIDR + lcCustomsDutyIDR + lcHandlingCostIDR + lcInsuranceCostIDR;
    if (total <= 0) {
      onShowToast('Validation Error', 'Total landed cost must be greater than Rp 0.');
      return;
    }
    if (selectedSkus.length === 0) {
      onShowToast('Validation Error', 'Please select at least one SKU to absorb landed cost.');
      return;
    }

    setIsSubmittingLanded(true);
    try {
      const res = await apiClient.createLandedCost({
        description: lcDescription,
        poId: lcPoId,
        billNumber: lcBillNumber,
        freightCostIDR: lcFreightIDR,
        customsDutyIDR: lcCustomsDutyIDR,
        handlingCostIDR: lcHandlingCostIDR,
        insuranceCostIDR: lcInsuranceCostIDR,
        allocationMethod: lcAllocationMethod,
        items: selectedSkus,
      });

      if (res.success) {
        onShowToast('Landed Cost Absorbed', res.message);
        setIsLandedModalOpen(false);
        onRefreshLandedCosts();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Execution Failed', msg);
    } finally {
      setIsSubmittingLanded(false);
    }
  };

  const totalCalculatedLandedCost = lcFreightIDR + lcCustomsDutyIDR + lcHandlingCostIDR + lcInsuranceCostIDR;
  const totalUnits = selectedSkus.reduce((s, it) => s + it.quantity, 0);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Overview Banner */}
      <div className={`${cardClass} p-5 sm:p-6`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-xl bg-[#0F4C3A] text-white shadow-xs shrink-0">
              <Scale className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-[#0F4C3A] border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30 uppercase tracking-wider">
                  ERP Valuation Engine
                </span>
                <span className="text-xs text-gray-500 dark:text-stone-400 font-medium">
                  Landed Costs &amp; Traceability
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold mt-1 text-gray-900 dark:text-stone-100">
                Product Valuation &amp; Landed Cost Configuration
              </h2>
              <p className="text-xs mt-0.5 max-w-2xl text-gray-500 dark:text-stone-400 leading-relaxed">
                Incorporate additional procurement costs (inbound freight, customs duties, cold-chain handling) directly into product inventory valuation and automatic General Ledger postings.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => setIsLandedModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Apply Landed Cost</span>
            </button>
            <button
              onClick={handleSaveSettings}
              disabled={isSavingConfig}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {isSavingConfig ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Rules</span>
            </button>
          </div>
        </div>
      </div>

      {/* Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost Allocation Rules */}
        <div className={`${cardClass} p-5 sm:p-6 space-y-4`}>
          <div className="flex items-center justify-between pb-3.5 border-b border-gray-100 dark:border-stone-800">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-stone-100">
                  Landed Cost Valuation Rules
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-stone-400">
                  Automate freight absorption into FIFO/WAC asset valuation
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-10 h-5.5 bg-gray-200 dark:bg-stone-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all after:shadow-xs peer-checked:bg-[#0F4C3A] dark:peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          <div className="space-y-4">
            <div>
              <label className={labelClass}>Default Allocation Method</label>
              <select
                value={config.defaultAllocationMethod}
                onChange={(e) => setConfig({ ...config, defaultAllocationMethod: e.target.value as any })}
                className={inputClass}
              >
                <option value="BY_QUANTITY" className="bg-white dark:bg-stone-900 text-gray-900 dark:text-stone-100">By Quantity (Equal cost per unit piece / pack)</option>
                <option value="BY_VALUE" className="bg-white dark:bg-stone-900 text-gray-900 dark:text-stone-100">By Value (Proportional to line item invoice value)</option>
                <option value="EQUAL" className="bg-white dark:bg-stone-900 text-gray-900 dark:text-stone-100">Equal Split (Equal amount per SKU line)</option>
                <option value="BY_WEIGHT" className="bg-white dark:bg-stone-900 text-gray-900 dark:text-stone-100">By Weight (Based on gross kilogram weight)</option>
              </select>
              <p className="text-[11px] mt-1.5 text-gray-500 dark:text-stone-400">
                Standard method applied when distributing inbound freight across PO line items.
              </p>
            </div>

            <div>
              <label className={labelClass}>Default Accounting Journal</label>
              <select
                value={config.defaultJournal}
                onChange={(e) => setConfig({ ...config, defaultJournal: e.target.value })}
                className={inputClass}
              >
                <option value="MISC_OPERATIONS" className="bg-white dark:bg-stone-900 text-gray-900 dark:text-stone-100">Operations &amp; Landed Costs Journal (MISC_OPERATIONS)</option>
                <option value="GENERAL_JOURNAL" className="bg-white dark:bg-stone-900 text-gray-900 dark:text-stone-100">General Standard Journal (GENERAL_JOURNAL)</option>
                <option value="PURCHASE_JOURNAL" className="bg-white dark:bg-stone-900 text-gray-900 dark:text-stone-100">Vendor Procurement Journal (PURCHASE_JOURNAL)</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              <div>
                <label className={labelClass}>Inbound Freight Account</label>
                <input
                  type="text"
                  value={config.freightExpenseAccountCode}
                  onChange={(e) => setConfig({ ...config, freightExpenseAccountCode: e.target.value })}
                  className={`font-mono ${inputClass}`}
                  placeholder="5040"
                />
                <span className="text-[10px] text-gray-500 dark:text-stone-400 mt-1 block truncate">{config.freightExpenseAccountName}</span>
              </div>
              <div>
                <label className={labelClass}>Customs &amp; Duty Account</label>
                <input
                  type="text"
                  value={config.customsDutyAccountCode}
                  onChange={(e) => setConfig({ ...config, customsDutyAccountCode: e.target.value })}
                  className={`font-mono ${inputClass}`}
                  placeholder="5050"
                />
                <span className="text-[10px] text-gray-500 dark:text-stone-400 mt-1 block truncate">{config.customsDutyAccountName}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className={labelClass}>Cold Handling Account</label>
                <input
                  type="text"
                  value={config.handlingAccountCode}
                  onChange={(e) => setConfig({ ...config, handlingAccountCode: e.target.value })}
                  className={`font-mono ${inputClass}`}
                  placeholder="5060"
                />
                <span className="text-[10px] text-gray-500 dark:text-stone-400 mt-1 block truncate">{config.handlingAccountName}</span>
              </div>
              <div>
                <label className={labelClass}>Landed Accrual / Clearing</label>
                <input
                  type="text"
                  value={config.clearingAccountCode}
                  onChange={(e) => setConfig({ ...config, clearingAccountCode: e.target.value })}
                  className={`font-mono ${inputClass}`}
                  placeholder="2040"
                />
                <span className="text-[10px] text-gray-500 dark:text-stone-400 mt-1 block truncate">{config.clearingAccountName}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Invoice & Document Traceability Settings */}
        <div className={`${cardClass} p-5 sm:p-6 space-y-4`}>
          <div className="flex items-center justify-between pb-3.5 border-b border-gray-100 dark:border-stone-800">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                <Tag className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-stone-100">
                  Lots &amp; Serial Numbers on Invoices
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-stone-400">
                  Perishable batch traceability &amp; audit enforcement
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
              Traceability
            </span>
          </div>

          <div className="space-y-3.5">
            <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 transition-all ${
              isLight ? 'bg-gray-50/70 border-gray-200 hover:border-gray-300' : 'bg-stone-800/40 border-stone-800 hover:border-stone-700'
            }`}>
              <div>
                <h4 className="text-xs font-bold text-gray-900 dark:text-stone-100">Display Lots &amp; Batches on Invoices</h4>
                <p className="text-[11px] mt-0.5 text-gray-500 dark:text-stone-400">
                  Prints harvest batch ID and lot numbers directly on Customer and B2B invoices.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={invoiceTracking.displayLotsOnInvoices}
                  onChange={(e) => setInvoiceTracking({ ...invoiceTracking, displayLotsOnInvoices: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-5.5 bg-gray-200 dark:bg-stone-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all after:shadow-xs peer-checked:bg-[#0F4C3A] dark:peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 transition-all ${
              isLight ? 'bg-gray-50/70 border-gray-200 hover:border-gray-300' : 'bg-stone-800/40 border-stone-800 hover:border-stone-700'
            }`}>
              <div>
                <h4 className="text-xs font-bold text-gray-900 dark:text-stone-100">Display Expiry Dates on Delivery Orders (Surat Jalan)</h4>
                <p className="text-[11px] mt-0.5 text-gray-500 dark:text-stone-400">
                  Mandatory for cold-chain compliance and receiver quality checks upon dock arrival.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={invoiceTracking.displaySerialExpiryOnDeliveryDocs}
                  onChange={(e) => setInvoiceTracking({ ...invoiceTracking, displaySerialExpiryOnDeliveryDocs: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-5.5 bg-gray-200 dark:bg-stone-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all after:shadow-xs peer-checked:bg-[#0F4C3A] dark:peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 transition-all ${
              isLight ? 'bg-gray-50/70 border-gray-200 hover:border-gray-300' : 'bg-stone-800/40 border-stone-800 hover:border-stone-700'
            }`}>
              <div>
                <h4 className="text-xs font-bold text-gray-900 dark:text-stone-100">Require Lot Barcode Scan on Fulfillment</h4>
                <p className="text-[11px] mt-0.5 text-gray-500 dark:text-stone-400">
                  Enforces warehouse pickers to physically scan batch barcodes to verify FEFO integrity.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={invoiceTracking.requireLotScanOnFulfillment}
                  onChange={(e) => setInvoiceTracking({ ...invoiceTracking, requireLotScanOnFulfillment: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-5.5 bg-gray-200 dark:bg-stone-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all after:shadow-xs peer-checked:bg-[#0F4C3A] dark:peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-xs text-emerald-900 dark:text-emerald-300 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              <span className="leading-relaxed">
                Enabled lot tracking guarantees end-to-end auditability from Lembang farm harvest batches to customer doorstep deliveries.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Historical Landed Costs Applied Log */}
      <div className={`${cardClass} p-5 sm:p-6 space-y-4`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3.5 border-b border-gray-100 dark:border-stone-800">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2 text-gray-900 dark:text-stone-100">
              <ReceiptText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Historical Landed Cost Journal Entries</span>
            </h3>
            <p className="text-xs mt-0.5 text-gray-500 dark:text-stone-400">
              Recent landed costs factored into merchandise asset accounts and General Ledger vouchers.
            </p>
          </div>
          <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-stone-800 text-gray-600 dark:text-stone-300 border border-gray-200 dark:border-stone-700">
            {landedCosts.length} Entries Recorded
          </span>
        </div>

        {landedCosts.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-500 dark:text-stone-400">
            No landed costs applied yet. Click &quot;Apply Landed Cost&quot; above to factor transport and customs into stock valuation.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-stone-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/70 dark:bg-stone-800/60 border-b border-gray-200 dark:border-stone-800 text-gray-600 dark:text-stone-300 uppercase text-[10px] font-bold">
                <tr>
                  <th className="py-3 px-3.5">Entry ID &amp; Date</th>
                  <th className="py-3 px-3.5">Description</th>
                  <th className="py-3 px-3.5">Freight &amp; Handling</th>
                  <th className="py-3 px-3.5">Total Landed (IDR)</th>
                  <th className="py-3 px-3.5">Allocated Items</th>
                  <th className="py-3 px-3.5">GL Voucher</th>
                  <th className="py-3 px-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-stone-800 font-medium">
                {landedCosts.map((lc) => (
                  <tr key={lc.id} className="hover:bg-gray-50/60 dark:hover:bg-stone-800/40 transition-colors">
                    <td className="py-3.5 px-3.5">
                      <div className="font-mono font-bold text-[#0F4C3A] dark:text-emerald-400">{lc.id}</div>
                      <div className="text-[10px] text-gray-500 dark:text-stone-400 mt-0.5">{new Date(lc.timestamp).toLocaleDateString()}</div>
                    </td>
                    <td className="py-3.5 px-3.5">
                      <div className="font-semibold text-gray-900 dark:text-stone-100">{lc.description}</div>
                      <div className="text-[10px] font-mono text-gray-500 dark:text-stone-400 mt-0.5">Ref: {lc.billNumber || lc.poId || 'Direct Allocation'}</div>
                    </td>
                    <td className="py-3.5 px-3.5 font-mono">
                      <div className="text-gray-900 dark:text-stone-200">Freight: {formatIDR(lc.freightCostIDR)}</div>
                      <div className="text-[10px] text-gray-500 dark:text-stone-400 mt-0.5">Handling: {formatIDR(lc.handlingCostIDR)}</div>
                    </td>
                    <td className="py-3.5 px-3.5 font-mono font-bold text-gray-900 dark:text-stone-100">
                      {formatIDR(lc.totalLandedCostIDR)}
                    </td>
                    <td className="py-3.5 px-3.5">
                      <div className="flex flex-wrap gap-1">
                        {lc.allocatedItems.map((it, idx) => (
                          <span
                            key={idx}
                            className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-gray-100 dark:bg-stone-800 text-gray-700 dark:text-stone-300 border border-gray-200 dark:border-stone-700"
                          >
                            {it.sku}: +{formatIDR(it.allocatedCostIDR)}/u
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-3.5 font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
                      {lc.glEntryIds.join(', ')}
                    </td>
                    <td className="py-3.5 px-3.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                        {lc.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Apply Landed Cost Allocation */}
      {isLandedModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`w-full max-w-xl p-6 rounded-2xl border shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto ${
            isLight ? 'bg-white border-gray-300' : 'bg-stone-900 border-stone-800 text-white'
          }`}>
            <div className="flex items-center justify-between pb-3.5 border-b border-gray-100 dark:border-stone-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-stone-100">Apply Landed Cost to Product Valuation</h3>
                  <p className="text-xs text-gray-500 dark:text-stone-400">Distribute transport, customs, and cold-gate intake fees</p>
                </div>
              </div>
              <button
                onClick={() => setIsLandedModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-stone-200 hover:bg-gray-100 dark:hover:bg-stone-800 text-sm font-bold transition-all"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExecuteLandedCost} className="space-y-4">
              <div>
                <label className={labelClass}>Description / Reference Reason *</label>
                <input
                  type="text"
                  required
                  value={lcDescription}
                  onChange={(e) => setLcDescription(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Inbound refrigerated carrier & customs fee"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className={labelClass}>Purchase Order Ref</label>
                  <input
                    type="text"
                    value={lcPoId}
                    onChange={(e) => setLcPoId(e.target.value)}
                    className={`font-mono ${inputClass}`}
                    placeholder="PO-2026-088"
                  />
                </div>
                <div>
                  <label className={labelClass}>Supplier Bill Number</label>
                  <input
                    type="text"
                    value={lcBillNumber}
                    onChange={(e) => setLcBillNumber(e.target.value)}
                    className={`font-mono ${inputClass}`}
                    placeholder="INV-KSB-2026-088"
                  />
                </div>
              </div>

              {/* Cost Inputs */}
              <div className="grid grid-cols-2 gap-3.5 p-4 rounded-xl border border-gray-200 dark:border-stone-800 bg-gray-50/50 dark:bg-stone-800/40">
                <div>
                  <label className={labelClass}>Freight Cost (IDR) *</label>
                  <input
                    type="number"
                    min="0"
                    value={lcFreightIDR}
                    onChange={(e) => setLcFreightIDR(Number(e.target.value))}
                    className={`font-mono font-bold ${inputClass}`}
                  />
                </div>
                <div>
                  <label className={labelClass}>Customs &amp; Tariffs (IDR)</label>
                  <input
                    type="number"
                    min="0"
                    value={lcCustomsDutyIDR}
                    onChange={(e) => setLcCustomsDutyIDR(Number(e.target.value))}
                    className={`font-mono font-bold ${inputClass}`}
                  />
                </div>
                <div>
                  <label className={labelClass}>Cold Handling / Dock (IDR)</label>
                  <input
                    type="number"
                    min="0"
                    value={lcHandlingCostIDR}
                    onChange={(e) => setLcHandlingCostIDR(Number(e.target.value))}
                    className={`font-mono font-bold ${inputClass}`}
                  />
                </div>
                <div>
                  <label className={labelClass}>Transit Insurance (IDR)</label>
                  <input
                    type="number"
                    min="0"
                    value={lcInsuranceCostIDR}
                    onChange={(e) => setLcInsuranceCostIDR(Number(e.target.value))}
                    className={`font-mono font-bold ${inputClass}`}
                  />
                </div>
              </div>

              <div className="flex justify-between items-center py-2.5 px-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-xs font-bold text-emerald-900 dark:text-emerald-300">
                <span>Total Landed Cost to Absorb:</span>
                <span className="font-mono text-sm font-black">{formatIDR(totalCalculatedLandedCost)}</span>
              </div>

              <div>
                <label className={labelClass}>Allocation Method</label>
                <select
                  value={lcAllocationMethod}
                  onChange={(e) => setLcAllocationMethod(e.target.value as any)}
                  className={inputClass}
                >
                  <option value="BY_QUANTITY" className="bg-white dark:bg-stone-900 text-gray-900 dark:text-stone-100">By Quantity (Proportional per unit)</option>
                  <option value="EQUAL" className="bg-white dark:bg-stone-900 text-gray-900 dark:text-stone-100">Equal Split across line items</option>
                  <option value="BY_VALUE" className="bg-white dark:bg-stone-900 text-gray-900 dark:text-stone-100">By Value Proportion</option>
                </select>
              </div>

              {/* Items Table */}
              <div>
                <label className={labelClass}>Target Receiving Items ({selectedSkus.length} SKUs)</label>
                <div className="border border-gray-200 dark:border-stone-700 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-stone-800 border-b border-gray-200 dark:border-stone-700 uppercase text-[10px] font-bold text-gray-600 dark:text-stone-300">
                      <tr>
                        <th className="p-2.5">SKU</th>
                        <th className="p-2.5">Quantity</th>
                        <th className="p-2.5 text-right">Est. Cost Added / Unit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-stone-800 font-mono">
                      {selectedSkus.map((item, idx) => {
                        const estimatedShare = totalUnits > 0 ? Math.round((totalCalculatedLandedCost * item.quantity) / totalUnits) : 0;
                        const perUnit = item.quantity > 0 ? Math.round(estimatedShare / item.quantity) : 0;
                        return (
                          <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-stone-800/40">
                            <td className="p-2.5 font-bold text-[#0F4C3A] dark:text-emerald-400">{item.sku}</td>
                            <td className="p-2.5 text-gray-700 dark:text-stone-300">{item.quantity} units</td>
                            <td className="p-2.5 text-right text-emerald-600 dark:text-emerald-400 font-bold">
                              +{formatIDR(perUnit)} / unit
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3.5 border-t border-gray-100 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsLandedModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 dark:text-stone-300 dark:hover:bg-stone-800 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingLanded}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#0F4C3A] hover:bg-[#0b382b] text-white shadow-xs disabled:opacity-50 flex items-center gap-1.5 transition-all"
                >
                  {isSubmittingLanded ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Absorb &amp; Post to GL</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
