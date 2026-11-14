import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import type {
  QCInspectionRecord,
  QCDisposition,
  QCDispositionAction,
  InventoryItem,
} from '../../types/index.ts';
import { apiClient } from '../../services/apiClient';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Plus,
  Search,
  Filter,
  Thermometer,
  Sparkles,
  RefreshCw,
  FileText,
  BadgeAlert,
  ArrowRight,
  Package,
  Layers,
  Mail,
  MessageCircle,
} from 'lucide-react';
import { DocumentDispatchModal } from './DocumentDispatchModal';

interface InventoryQCModuleProps {
  theme: 'light' | 'dark';
  selectedStore: string;
  inventory: InventoryItem[];
  qcRecords?: QCInspectionRecord[];
  onRefreshData: () => void;
  onShowToast: (title: string, message: string) => void;
}

export const InventoryQCModule: React.FC<InventoryQCModuleProps> = ({
  theme,
  selectedStore,
  inventory,
  qcRecords,
  onRefreshData,
  onShowToast,
}) => {
  const isLight = theme === 'light';

  // Internal QC records if not provided by parent
  const [internalQcRecords, setInternalQcRecords] = useState<QCInspectionRecord[]>(qcRecords || []);

  const loadQcData = async () => {
    try {
      if (!qcRecords) {
        const records = await apiClient.getQCInspections(selectedStore);
        setInternalQcRecords(records);
      }
    } catch (err) {
      console.error('Failed to load QC inspections:', err);
    }
  };

  React.useEffect(() => {
    loadQcData();
  }, [selectedStore]);

  React.useEffect(() => {
    if (qcRecords) {
      setInternalQcRecords(qcRecords);
    }
  }, [qcRecords]);

  const activeQcRecords = qcRecords || internalQcRecords;

  // Filters
  const [filterDisposition, setFilterDisposition] = useState<'ALL' | QCDisposition>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [dispatchQc, setDispatchQc] = useState<{
    record: QCInspectionRecord;
    channel: 'email' | 'whatsapp';
  } | null>(null);

  // New Inspection Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form State
  const [selectedSku, setSelectedSku] = useState<string>(inventory[0]?.sku || 'SKU-PRD-001');
  React.useEffect(() => {
    if (inventory.length > 0 && !inventory.some((i) => i.sku === selectedSku)) {
      setSelectedSku(inventory[0].sku);
    }
  }, [inventory, selectedSku]);
  const [refType, setRefType] = useState<'INCOMING_PO' | 'INTER_WAREHOUSE_TRANSFER' | 'PERIODIC_SPOILAGE_CHECK'>('INCOMING_PO');
  const [refId, setRefId] = useState<string>('PO-2026-001');
  const [batchNumber, setBatchNumber] = useState<string>(`BAT-${Date.now().toString().slice(-6)}`);
  const [sampleQty, setSampleQty] = useState<number>(5);
  const [totalBatchQty, setTotalBatchQty] = useState<number>(50);
  const [visualFreshness, setVisualFreshness] = useState<'Grade A (Pristine)' | 'Grade B (Acceptable)' | 'Defective (Browning/Bruised)'>('Grade A (Pristine)');
  const [temperatureCelsius, setTemperatureCelsius] = useState<number>(3.5);
  const [packagingIntegrity, setPackagingIntegrity] = useState<'Sealed & Intact' | 'Minor Scuff' | 'Damaged/Leaking'>('Sealed & Intact');
  const [sensoryOdorCheck, setSensoryOdorCheck] = useState<'Normal & Fresh' | 'Off-Odor / Souring'>('Normal & Fresh');
  const [brixSugar, setBrixSugar] = useState<number>(5.2);
  const [disposition, setDisposition] = useState<QCDisposition>('PASSED');
  const [actionTaken, setActionTaken] = useState<QCDispositionAction>('RELEASE_TO_SHELF');
  const [notes, setNotes] = useState<string>('Standard quality inspection passed. Zero signs of bruising or pest activity.');

  // Auto-adjust disposition based on defect parameters
  const handleTempChange = (temp: number) => {
    setTemperatureCelsius(temp);
    if (temp > 6.0) {
      setDisposition('REJECTED');
      setActionTaken('RETURN_TO_VENDOR');
      setNotes('Cold-chain temperature excursion detected during receiving.');
    }
  };

  const handleVisualChange = (val: 'Grade A (Pristine)' | 'Grade B (Acceptable)' | 'Defective (Browning/Bruised)') => {
    setVisualFreshness(val);
    if (val === 'Defective (Browning/Bruised)') {
      setDisposition('REJECTED');
      setActionTaken('SCRAP_WASTE');
    } else if (val === 'Grade B (Acceptable)') {
      setDisposition('QUARANTINED');
      setActionTaken('QUARANTINE_HOLD');
    } else {
      setDisposition('PASSED');
      setActionTaken('RELEASE_TO_SHELF');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const selectedItem = inventory.find((i) => i.sku === selectedSku);
      const res = await apiClient.submitQCInspection({
        referenceType: refType,
        referenceId: refId,
        sku: selectedSku,
        productName: selectedItem?.productName || 'Produce',
        category: selectedItem?.category || 'produce',
        batchNumber,
        sampleQuantity: sampleQty,
        totalBatchQuantity: totalBatchQty,
        parameters: {
          visualFreshness,
          temperatureCelsius,
          coldChainCompliant: temperatureCelsius <= 4.5,
          packagingIntegrity,
          sensoryOdorCheck,
          brixSugarContent: brixSugar,
          weightToleranceCompliant: true,
        },
        disposition,
        actionTaken,
        notes,
      });

      onShowToast(
        'QC Inspection Logged',
        `Batch ${batchNumber} dispositioned as ${disposition} (${actionTaken.replace(/_/g, ' ')}).`
      );
      setIsModalOpen(false);
      if (onRefreshData) onRefreshData();
      loadQcData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('QC Submission Failed', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered records
  const filteredRecords = activeQcRecords.filter((rec) => {
    if (filterDisposition !== 'ALL' && rec.disposition !== filterDisposition) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        rec.id.toLowerCase().includes(q) ||
        rec.productName.toLowerCase().includes(q) ||
        rec.sku.toLowerCase().includes(q) ||
        rec.batchNumber.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const passedCount = activeQcRecords.filter((r) => r.disposition === 'PASSED').length;
  const quarantinedCount = activeQcRecords.filter((r) => r.disposition === 'QUARANTINED').length;
  const rejectedCount = activeQcRecords.filter((r) => r.disposition === 'REJECTED').length;
  const passRate = activeQcRecords.length > 0 ? Math.round((passedCount / activeQcRecords.length) * 100) : 100;

  // Card classes
  const cardClass = `rounded-2xl border transition-all ${
    isLight
      ? 'bg-white border-gray-200/90 shadow-[0_4px_16px_rgba(0,0,0,0.03)]'
      : 'bg-zinc-900/90 border-zinc-800 shadow-[0_4px_16px_rgba(0,0,0,0.2)]'
  }`;

  return (
    <>
      <div className="space-y-6 animate-fadeIn">
      {/* Top Header & Overview */}
      <div className={`${cardClass} p-5 sm:p-6 space-y-6`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-700 dark:text-teal-400 flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">
                  HACCP &amp; BPOM Standard
                </span>
                <span className="inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-800 dark:text-teal-300 border border-teal-500/25">
                  Gate 1 Quality Control
                </span>
              </div>
              <h1 className={`text-xl font-bold mt-1 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                Perishables Quality Control (QC) &amp; Disposition
              </h1>
              <p className={`text-xs mt-0.5 max-w-2xl ${isLight ? 'text-gray-600' : 'text-zinc-300'}`}>
                Audit incoming farm shipments, evaluate cold-chain temperature thresholds, and execute formal disposition (Passed to Shelf, Quarantined Hold, Return to Vendor, or Scrap Write-Off).
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>New Quality Inspection</span>
          </button>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          <div
            className={`p-4 rounded-xl border ${
              isLight ? 'bg-gray-50/70 border-gray-200' : 'bg-zinc-800/60 border-zinc-700'
            }`}
          >
            <div className={`text-xs font-semibold ${isLight ? 'text-gray-500' : 'text-zinc-300'}`}>
              Inspection Pass Rate
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
              {passRate}%
            </div>
            <div className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
              {passedCount} of {activeQcRecords.length} lots passed Grade A/B
            </div>
          </div>

          <div
            className={`p-4 rounded-xl border ${
              isLight ? 'bg-gray-50/70 border-gray-200' : 'bg-zinc-800/60 border-zinc-700'
            }`}
          >
            <div className={`text-xs font-semibold ${isLight ? 'text-gray-500' : 'text-zinc-300'}`}>
              Quarantine Isolation Hold
            </div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1 font-mono">
              {quarantinedCount} Lots
            </div>
            <div className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
              Awaiting 24h secondary re-test
            </div>
          </div>

          <div
            className={`p-4 rounded-xl border ${
              isLight ? 'bg-gray-50/70 border-gray-200' : 'bg-zinc-800/60 border-zinc-700'
            }`}
          >
            <div className={`text-xs font-semibold ${isLight ? 'text-gray-500' : 'text-zinc-300'}`}>
              Rejected / Return to Vendor (RTV)
            </div>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1 font-mono">
              {rejectedCount} Lots
            </div>
            <div className="text-[11px] text-rose-700 dark:text-rose-300 mt-0.5">
              Debit notes &amp; vendor claims generated
            </div>
          </div>

          <div
            className={`p-4 rounded-xl border ${
              isLight ? 'bg-gray-50/70 border-gray-200' : 'bg-zinc-800/60 border-zinc-700'
            }`}
          >
            <div className={`text-xs font-semibold ${isLight ? 'text-gray-500' : 'text-zinc-300'}`}>
              Active Cold-Chain Protocol
            </div>
            <div className="text-sm font-bold text-teal-700 dark:text-teal-300 mt-1 flex items-center gap-1.5">
              <Thermometer className="w-4 h-4 text-teal-600" />
              <span>Chilled: 2 - 4°C | Frozen: -18°C</span>
            </div>
            <div className="text-[11px] text-gray-500 dark:text-zinc-300 mt-0.5">
              Instant trigger on &gt;1.5°C temperature breach
            </div>
          </div>
        </div>
      </div>

      {/* QC Logs Table */}
      <div className={cardClass}>
        <div className={`p-5 border-b ${isLight ? 'border-gray-200 bg-gray-50/50' : 'border-zinc-800 bg-zinc-900/50'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-white'} flex items-center gap-2`}>
                <FileText className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
                <span>Quality Inspection Log &amp; Disposition Records</span>
              </h3>
              <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-zinc-300'} mt-0.5`}>
                Official audit trail of all produce grading, temperature verifications, and action routing
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search SKU or batch..."
                  className={`pl-8 pr-3 py-1.5 text-xs rounded-xl border focus:outline-none focus:border-[#0F4C3A] ${
                    isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-zinc-800 border-zinc-700 text-white'
                  }`}
                />
              </div>

              <div className="flex items-center gap-1">
                {(['ALL', 'PASSED', 'QUARANTINED', 'REJECTED'] as const).map((disp) => (
                  <button
                    key={disp}
                    onClick={() => setFilterDisposition(disp)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all capitalize ${
                      filterDisposition === disp
                        ? 'bg-[#0F4C3A] text-white shadow-xs'
                        : isLight
                        ? 'text-gray-600 hover:bg-gray-100'
                        : 'text-zinc-400 hover:bg-zinc-800'
                    }`}
                  >
                    {disp}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead className={`border-b text-[10px] uppercase font-bold tracking-wider ${
              isLight ? 'border-gray-200 bg-gray-50/70 text-gray-500' : 'border-zinc-800 bg-zinc-800/50 text-zinc-400'
            }`}>
              <tr>
                <th className="py-3 px-4">QC Report ID</th>
                <th className="py-3 px-4">Product / SKU</th>
                <th className="py-3 px-4">Batch / Exp</th>
                <th className="py-3 px-4 text-center">Sample / Total</th>
                <th className="py-3 px-4">Physical Test Parameters</th>
                <th className="py-3 px-4 text-center">Disposition</th>
                <th className="py-3 px-4">Action Executed</th>
                <th className="py-3 px-4">Inspector / Notes</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isLight ? 'divide-gray-200' : 'divide-zinc-800'}`}>
              {filteredRecords.map((rec) => (
                <tr
                  key={rec.id}
                  className={`transition-colors ${
                    isLight ? 'hover:bg-gray-50/80' : 'hover:bg-zinc-800/40'
                  }`}
                >
                  <td className="py-3.5 px-4 font-mono font-bold text-[#0F4C3A] dark:text-emerald-400">
                    <div>{rec.id}</div>
                    <span className="text-[10px] text-gray-400 font-sans block">{rec.referenceType}</span>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="font-bold">{rec.productName}</div>
                    <span className="font-mono text-[11px] text-gray-500">{rec.sku}</span>
                  </td>

                  <td className="py-3.5 px-4 font-mono text-[11px]">
                    <div>{rec.batchNumber}</div>
                    <span className="text-[10px] text-gray-400">Exp: {rec.expiryDate}</span>
                  </td>

                  <td className="py-3.5 px-4 text-center font-mono">
                    <span className="font-bold">{rec.sampleQuantity}</span> / {rec.totalBatchQuantity}
                  </td>

                  <td className="py-3.5 px-4 space-y-0.5 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold">{rec.parameters.visualFreshness}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-mono">
                      <Thermometer className="w-3 h-3" />
                      <span>{rec.parameters.temperatureCelsius}°C</span>
                      <span className="text-[10px] opacity-75">
                        ({rec.parameters.coldChainCompliant ? 'Compliant' : 'Breach'})
                      </span>
                    </div>
                  </td>

                  <td className="py-3.5 px-4 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        rec.disposition === 'PASSED'
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                          : rec.disposition === 'QUARANTINED'
                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                          : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {rec.disposition === 'PASSED' && <CheckCircle2 className="w-3 h-3" />}
                      {rec.disposition === 'QUARANTINED' && <AlertTriangle className="w-3 h-3" />}
                      {rec.disposition === 'REJECTED' && <XCircle className="w-3 h-3" />}
                      <span>{rec.disposition}</span>
                    </span>
                  </td>

                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 border border-gray-200 dark:border-zinc-700">
                      {rec.actionTaken.replace(/_/g, ' ')}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-[11px] max-w-xs space-y-1.5">
                    <div className="font-semibold">{rec.inspectorName}</div>
                    <p className="text-gray-500 dark:text-zinc-300 text-[10px] truncate">{rec.notes}</p>
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <button
                        type="button"
                        onClick={() => setDispatchQc({ record: rec, channel: 'email' })}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold cursor-pointer ${
                          isLight
                            ? 'border-gray-200 text-indigo-700 hover:bg-indigo-50'
                            : 'border-zinc-700 text-indigo-300 hover:bg-zinc-800'
                        }`}
                        title="Email HACCP QC & RTV Report"
                      >
                        <Mail className="w-3 h-3" />
                        <span>Email</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDispatchQc({ record: rec, channel: 'whatsapp' })}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold cursor-pointer ${
                          isLight
                            ? 'border-gray-200 text-emerald-700 hover:bg-emerald-50'
                            : 'border-zinc-700 text-emerald-400 hover:bg-zinc-800'
                        }`}
                        title="Send HACCP QC & RTV Report via WhatsApp"
                      >
                        <MessageCircle className="w-3 h-3" />
                        <span>WhatsApp</span>
                      </button>
                      {(rec.disposition === 'REJECTED' || rec.disposition === 'QUARANTINED') && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const res = await apiClient.createComplianceRtv({
                                qcInspectionId: rec.id,
                                storeId: rec.storeId,
                                storeName: rec.storeName,
                                sku: rec.sku,
                                productName: rec.productName,
                                lotNumber: rec.batchNumber,
                                quantityReturned: Math.max(1, rec.sampleQuantity || 1),
                                reason: `QC ${rec.disposition}: ${rec.notes || rec.actionTaken}`,
                              });
                              onShowToast('RTV Debit Note Issued', res.message);
                              if (onRefreshData) onRefreshData();
                            } catch (err: any) {
                              onShowToast('RTV Error', err.message || 'Failed to generate RTV Debit Note');
                            }
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold cursor-pointer whitespace-nowrap"
                        >
                          <ArrowRight className="w-3 h-3" />
                          <span>Issue RTV Debit Note</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    {/* New Quality Inspection Modal - Portaled to document.body to break out of all container/transform/overflow clipping */}
    {isModalOpen &&
      createPortal(
        <div
          className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className={`w-full max-w-xl p-5 sm:p-6 rounded-2xl border shadow-2xl space-y-4 my-auto relative ${
              isLight ? 'bg-white border-gray-200 text-gray-900' : 'bg-zinc-900 border-zinc-800 text-white'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3 border-gray-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0" />
                <div>
                  <h3 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-zinc-100'} dark:text-zinc-100`}>
                    New Perishables Quality Inspection
                  </h3>
                  <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-zinc-400'} dark:text-zinc-400`}>
                    Record physical inspection, cold-chain temperature &amp; disposition actions
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 p-1 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-slate-800' : 'text-zinc-200'} dark:text-zinc-200`}>
                    Select Item SKU
                  </label>
                  <select
                    value={selectedSku}
                    onChange={(e) => setSelectedSku(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border ${
                      isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-zinc-800 border-zinc-700 text-zinc-100'
                    } dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100`}
                  >
                    {inventory.map((i, idx) => (
                      <option key={`${i.sku}-${idx}`} value={i.sku} className="bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-200">
                        {i.sku} - {i.productName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-slate-800' : 'text-zinc-200'} dark:text-zinc-200`}>
                    Batch / Lot Number
                  </label>
                  <input
                    type="text"
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border font-mono ${
                      isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-zinc-800 border-zinc-700 text-zinc-100'
                    } dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-slate-800' : 'text-zinc-200'} dark:text-zinc-200`}>
                    Audit Source
                  </label>
                  <select
                    value={refType}
                    onChange={(e) => setRefType(e.target.value as any)}
                    className={`w-full px-3 py-2 rounded-xl border ${
                      isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-zinc-800 border-zinc-700 text-zinc-100'
                    } dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100`}
                  >
                    <option value="INCOMING_PO" className="bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-200">Incoming PO Delivery</option>
                    <option value="INTER_WAREHOUSE_TRANSFER" className="bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-200">Warehouse Transfer</option>
                    <option value="PERIODIC_SPOILAGE_CHECK" className="bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-200">Periodic Shelf Spoilage</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-slate-800' : 'text-zinc-200'} dark:text-zinc-200`}>
                    Sample Qty
                  </label>
                  <input
                    type="number"
                    value={sampleQty}
                    onChange={(e) => setSampleQty(Number(e.target.value))}
                    className={`w-full px-3 py-2 rounded-xl border font-mono ${
                      isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-zinc-800 border-zinc-700 text-zinc-100'
                    } dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-slate-800' : 'text-zinc-200'} dark:text-zinc-200`}>
                    Total Batch Qty
                  </label>
                  <input
                    type="number"
                    value={totalBatchQty}
                    onChange={(e) => setTotalBatchQty(Number(e.target.value))}
                    className={`w-full px-3 py-2 rounded-xl border font-mono ${
                      isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-zinc-800 border-zinc-700 text-zinc-100'
                    } dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100`}
                  />
                </div>
              </div>

              {/* Physical Parameters Card */}
              <div className="p-3.5 rounded-xl border border-gray-200 dark:border-zinc-700 space-y-3 bg-gray-50/50 dark:bg-zinc-800/60">
                <span className={`font-bold text-xs flex items-center gap-1.5 ${isLight ? 'text-teal-700' : 'text-teal-300'} dark:text-zinc-200`}>
                  <Sparkles className="w-3.5 h-3.5" />
                  Sensory &amp; Cold-Chain Physical Evaluation
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-[11px] font-semibold mb-1 ${isLight ? 'text-slate-800' : 'text-zinc-200'} dark:text-zinc-200`}>
                      Visual Freshness Grade
                    </label>
                    <select
                      value={visualFreshness}
                      onChange={(e) => handleVisualChange(e.target.value as any)}
                      className={`w-full px-2.5 py-1.5 rounded-lg border text-xs ${
                        isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-zinc-800 border-zinc-700 text-zinc-100'
                      } dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100`}
                    >
                      <option value="Grade A (Pristine)" className="bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-200">Grade A (Pristine)</option>
                      <option value="Grade B (Acceptable)" className="bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-200">Grade B (Acceptable)</option>
                      <option value="Defective (Browning/Bruised)" className="bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-200">Defective (Browning/Bruised)</option>
                    </select>
                  </div>

                  <div>
                    <label className={`block text-[11px] font-semibold mb-1 ${isLight ? 'text-slate-800' : 'text-zinc-200'} dark:text-zinc-200`}>
                      Cold-Chain Temp (°C)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={temperatureCelsius}
                      onChange={(e) => handleTempChange(Number(e.target.value))}
                      className={`w-full px-2.5 py-1.5 rounded-lg border font-mono text-xs ${
                        temperatureCelsius > 4.5
                          ? 'border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300 font-bold'
                          : isLight
                          ? 'bg-white border-gray-300 text-gray-900'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-100'
                      } dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-[11px] font-semibold mb-1 ${isLight ? 'text-slate-800' : 'text-zinc-200'} dark:text-zinc-200`}>
                      Packaging Integrity
                    </label>
                    <select
                      value={packagingIntegrity}
                      onChange={(e) => setPackagingIntegrity(e.target.value as any)}
                      className={`w-full px-2.5 py-1.5 rounded-lg border text-xs ${
                        isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-zinc-800 border-zinc-700 text-zinc-100'
                      } dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100`}
                    >
                      <option value="Sealed & Intact" className="bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-200">Sealed &amp; Intact</option>
                      <option value="Minor Scuff" className="bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-200">Minor Scuff</option>
                      <option value="Damaged/Leaking" className="bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-200">Damaged / Leaking</option>
                    </select>
                  </div>

                  <div>
                    <label className={`block text-[11px] font-semibold mb-1 ${isLight ? 'text-slate-800' : 'text-zinc-200'} dark:text-zinc-200`}>
                      Sensory Odor Check
                    </label>
                    <select
                      value={sensoryOdorCheck}
                      onChange={(e) => setSensoryOdorCheck(e.target.value as any)}
                      className={`w-full px-2.5 py-1.5 rounded-lg border text-xs ${
                        isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-zinc-800 border-zinc-700 text-zinc-100'
                      } dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100`}
                    >
                      <option value="Normal & Fresh" className="bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-200">Normal &amp; Fresh</option>
                      <option value="Off-Odor / Souring" className="bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-200">Off-Odor / Souring</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Disposition & Action */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-slate-800' : 'text-zinc-200'} dark:text-zinc-200`}>
                    Inspection Disposition
                  </label>
                  <select
                    value={disposition}
                    onChange={(e) => setDisposition(e.target.value as QCDisposition)}
                    className={`w-full px-3 py-2 rounded-xl border font-bold ${
                      isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-zinc-800 border-zinc-700 text-zinc-100'
                    } dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100`}
                  >
                    <option value="PASSED" className="bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-200">PASSED (Food Grade OK)</option>
                    <option value="QUARANTINED" className="bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-200">QUARANTINED (Hold for 24h)</option>
                    <option value="REJECTED" className="bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-200">REJECTED (Non-Compliant)</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-slate-800' : 'text-zinc-200'} dark:text-zinc-200`}>
                    Operational Action
                  </label>
                  <select
                    value={actionTaken}
                    onChange={(e) => setActionTaken(e.target.value as QCDispositionAction)}
                    className={`w-full px-3 py-2 rounded-xl border font-bold ${
                      isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-zinc-800 border-zinc-700 text-zinc-100'
                    } dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100`}
                  >
                    <option value="RELEASE_TO_SHELF" className="bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-200">Release to Shelf Inventory</option>
                    <option value="QUARANTINE_HOLD" className="bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-200">Quarantine Cold Cell</option>
                    <option value="RETURN_TO_VENDOR" className="bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-200">Return to Vendor (Debit Note)</option>
                    <option value="SCRAP_WASTE" className="bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-200">Scrap to Waste Expense</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-slate-800' : 'text-zinc-200'} dark:text-zinc-200`}>
                  Inspector Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Record sensory evaluation details, quarantine reasoning, or vendor credit references..."
                  className={`w-full px-3 py-2 rounded-xl border ${
                    isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-zinc-800 border-zinc-700 text-zinc-100'
                  } dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100`}
                />
                <p className={`text-[10px] mt-1 ${isLight ? 'text-slate-500' : 'text-zinc-400'} dark:text-zinc-400`}>
                  Provide audit reasoning for quarantine or vendor debit note
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 text-xs font-semibold text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {isSubmitting ? 'Recording...' : 'Submit QC Record'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
      {dispatchQc && (() => {
        const rec = dispatchQc.record;
        const total = Math.max(0, Number(rec.totalBatchQuantity) || 0);
        const passed = rec.disposition === 'PASSED' ? total : 0;
        const quarantine = rec.disposition === 'QUARANTINED' ? total : 0;
        const rejectedRtv = rec.disposition === 'REJECTED' ? total : 0;
        const passRate = total > 0 ? Math.round((passed / total) * 1000) / 10 : 0;
        return (
          <DocumentDispatchModal
            isOpen={Boolean(dispatchQc)}
            onClose={() => setDispatchQc(null)}
            theme={theme}
            initialChannel={dispatchQc.channel}
            docType="QC_REPORT"
            docId={rec.id}
            docNumber={rec.id}
            docSummary={`Product: ${rec.sku} — ${rec.productName} (Batch ${rec.batchNumber})\nCold-Chain Temp: ${rec.parameters.temperatureCelsius}°C (${rec.parameters.coldChainCompliant ? 'Compliant' : 'BREACH'})\nPassed: ${passed} | Quarantine Hold: ${quarantine} | Rejected RTV: ${rejectedRtv} | Pass Rate: ${passRate}%`}
            defaultRecipientName={`QA / Supplier Liaison (${rec.storeName})`}
            defaultRecipientEmail="qa-vendor-compliance@grocemart.co.id"
            defaultRecipientPhone="081288001122"
            onShowToast={onShowToast}
          />
        );
      })()}
  </>
);
};
