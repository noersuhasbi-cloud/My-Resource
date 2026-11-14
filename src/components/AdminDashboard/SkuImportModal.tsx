import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
  X,
} from 'lucide-react';
import type {
  IndonesianTaxCategory,
  RemovalStrategyType,
  SkuCsvImportRow,
  StaffShiftSession,
  StoreOutletSchedule,
} from '../../types/index.ts';
import { apiClient } from '../../services/apiClient';
import { formatIDR } from '../../utils/formatters';
import { canSessionViewValuation, isBranchScopedRole } from '../../utils/rbac';

interface SkuImportModalProps {
  theme: 'light' | 'dark';
  isOpen: boolean;
  onClose: () => void;
  activeStaffSession?: StaffShiftSession | null;
  storeOutlets: StoreOutletSchedule[];
  onImported: () => Promise<void> | void;
  onShowToast: (title: string, message: string) => void;
}

interface ParsedCsvRowPreview {
  rowNumber: number;
  raw: Record<string, string>;
  parsed?: SkuCsvImportRow;
  errors: string[];
  isExpired: boolean;
}

const REQUIRED_HEADERS = [
  'sku',
  'product_name',
  'category',
  'uom',
  'unit_cost_idr',
  'selling_price_idr',
  'tax_category',
  'rotation_strategy',
  'outlet_code',
  'rack_bin_code',
  'batch_lot_no',
  'expiry_date',
  'initial_qty',
] as const;

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function resolveOutletIdClient(codeOrId: string, outlets: StoreOutletSchedule[]): StoreOutletSchedule | undefined {
  const raw = String(codeOrId || '').trim();
  if (!raw) return undefined;
  const upper = raw.toUpperCase();
  const direct = outlets.find((s) => s.storeId.toLowerCase() === raw.toLowerCase());
  if (direct) return direct;
  const aliasMap: Record<string, string> = {
    SEN: 'store-jkt-senopati',
    'JKT-SEN': 'store-jkt-senopati',
    SENOPATI: 'store-jkt-senopati',
    CDC: 'store-jkt-senopati',
    'WH-CDC-01': 'store-jkt-senopati',
    PIK: 'store-jkt-pik',
    'JKT-PIK': 'store-jkt-pik',
    PIK2: 'store-jkt-pik',
    MTG: 'store-jkt-menteng',
    MENTENG: 'store-jkt-menteng',
    BDG: 'store-bdg-dago',
    DAGO: 'store-bdg-dago',
    SBY: 'store-sby-gubeng',
    GUBENG: 'store-sby-gubeng',
    DPS: 'store-dps-canggu',
    CANGGU: 'store-dps-canggu',
  };
  if (aliasMap[upper]) {
    return outlets.find((s) => s.storeId === aliasMap[upper]);
  }
  return outlets.find(
    (s) => s.storeName.toUpperCase().includes(upper) || s.city.toUpperCase().includes(upper)
  );
}

export const SkuImportModal: React.FC<SkuImportModalProps> = ({
  theme,
  isOpen,
  onClose,
  activeStaffSession,
  storeOutlets,
  onImported,
  onShowToast,
}) => {
  const isLight = theme === 'light';
  const canViewValuation = canSessionViewValuation(activeStaffSession);
  const branchScoped = isBranchScopedRole(activeStaffSession?.userRole);
  const lockedBranchId =
    branchScoped && activeStaffSession?.assignedBranchId && activeStaffSession.assignedBranchId !== 'ALL'
      ? activeStaffSession.assignedBranchId
      : branchScoped && activeStaffSession?.storeId && activeStaffSession.storeId !== 'ALL'
      ? activeStaffSession.storeId
      : null;

  const [csvText, setCsvText] = useState<string>('');
  const [postOpeningGl, setPostOpeningGl] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const parsedPreview = useMemo<ParsedCsvRowPreview[]>(() => {
    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0) return [];

    const firstCols = parseCsvLine(lines[0]).map((c) => c.toLowerCase());
    const hasHeader = firstCols.includes('sku') && firstCols.includes('product_name');
    const headers = hasHeader ? firstCols : [...REQUIRED_HEADERS];
    const dataLines = hasHeader ? lines.slice(1) : lines;

    return dataLines.map((line, index) => {
      const values = parseCsvLine(line);
      const raw: Record<string, string> = {};
      headers.forEach((h, i) => {
        raw[h] = values[i] ?? '';
      });

      const errors: string[] = [];
      const sku = (raw.sku || '').trim().toUpperCase();
      const productName = (raw.product_name || '').trim();
      const category = (raw.category || '').trim();
      const uom = (raw.uom || '').trim();
      const unitCost = Number(raw.unit_cost_idr);
      const sellingPrice = Number(raw.selling_price_idr);
      const initialQty = Number(raw.initial_qty);
      const rawTax = (raw.tax_category || '').trim().toUpperCase();
      const rawRot = (raw.rotation_strategy || '').trim().toUpperCase();
      const outletCode = (raw.outlet_code || '').trim();
      const rackBinCode = (raw.rack_bin_code || '').trim().toUpperCase();
      const batchLotNo = (raw.batch_lot_no || '').trim();
      const expiryDate = (raw.expiry_date || '').trim();

      if (!sku) errors.push('Missing SKU');
      if (!productName) errors.push('Missing product_name');
      if (!category) errors.push('Missing category');
      if (!uom) errors.push('Missing uom');
      if (!Number.isInteger(unitCost) || unitCost <= 0) {
        errors.push('unit_cost_idr must be positive integer IDR');
      }
      if (!Number.isInteger(sellingPrice) || sellingPrice < 0) {
        errors.push('selling_price_idr must be integer IDR >= 0');
      }
      if (!Number.isFinite(initialQty) || initialQty <= 0) {
        errors.push('initial_qty must be > 0');
      }
      if (!['BKP_STANDARD', 'BKP_DIBEBASKAN', 'NON_BKP_PB1'].includes(rawTax)) {
        errors.push('tax_category must be BKP_STANDARD | BKP_DIBEBASKAN | NON_BKP_PB1');
      }
      if (!['FEFO', 'FIFO', 'STRICT_FEFO', 'STRICT_FIFO'].includes(rawRot)) {
        errors.push('rotation_strategy must be FEFO or FIFO');
      }
      const matchedOutlet = resolveOutletIdClient(outletCode, storeOutlets);
      if (!matchedOutlet) {
        errors.push(`Unknown outlet_code '${outletCode || '-'}'`);
      } else if (lockedBranchId && matchedOutlet.storeId !== lockedBranchId) {
        errors.push(`Branch-locked to ${lockedBranchId} (row targets ${matchedOutlet.storeId})`);
      }
      if (!rackBinCode) errors.push('Missing rack_bin_code');
      if (!batchLotNo) errors.push('Missing batch_lot_no');

      let isExpired = false;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(expiryDate) || Number.isNaN(Date.parse(`${expiryDate}T23:59:59.000Z`))) {
        errors.push('expiry_date must be YYYY-MM-DD');
      } else if (expiryDate < todayStr) {
        isExpired = true;
        errors.push(`Expired date (${expiryDate} < ${todayStr})`);
      }

      const rotationStrategy: RemovalStrategyType = rawRot.includes('FIFO') ? 'FIFO' : 'FEFO';
      const parsed: SkuCsvImportRow | undefined =
        errors.length === 0
          ? {
              sku,
              product_name: productName,
              category,
              uom,
              unit_cost_idr: unitCost,
              selling_price_idr: sellingPrice,
              tax_category: rawTax as IndonesianTaxCategory,
              rotation_strategy: rotationStrategy,
              outlet_code: matchedOutlet ? matchedOutlet.storeId : outletCode,
              rack_bin_code: rackBinCode,
              batch_lot_no: batchLotNo,
              expiry_date: expiryDate,
              initial_qty: initialQty,
            }
          : undefined;

      return {
        rowNumber: index + 1,
        raw,
        parsed,
        errors,
        isExpired,
      };
    });
  }, [csvText, storeOutlets, lockedBranchId, todayStr]);

  const validRows = useMemo(
    () => parsedPreview.filter((r) => r.errors.length === 0 && r.parsed).map((r) => r.parsed!),
    [parsedPreview]
  );
  const errorCount = parsedPreview.length - validRows.length;

  const totalPreviewValueIDR = useMemo(
    () => validRows.reduce((sum, r) => sum + Math.round(r.initial_qty * r.unit_cost_idr), 0),
    [validRows]
  );

  if (!isOpen || typeof document === 'undefined') return null;

  const handleDownloadTemplate = () => {
    const defaultOutlet = lockedBranchId || 'store-jkt-senopati';
    const altOutlet = lockedBranchId || 'store-jkt-pik';
    const d45 = new Date(Date.now() + 45 * 86400000).toISOString().split('T')[0];
    const d180 = new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0];
    const sampleLines = [
      REQUIRED_HEADERS.join(','),
      `SKU-DAI-099,"Organic Meiji Hokkaido Milk 1L",dairy_eggs,bottle,42000,59000,BKP_DIBEBASKAN,FEFO,${defaultOutlet},SEN-CHL-R01-B02,LOT-MEIJI-26A,${d45},48`,
      `SKU-PAN-088,"Barilla Artisanal Penne Rigate 500g",pantry_staples,pack,24500,38000,BKP_STANDARD,FIFO,${altOutlet},CDC-AMB-R05-B04,LOT-BAR-26B,${d180},120`,
    ];
    const blob = new Blob([sampleLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'grocematrix_sku_batch_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onShowToast('Template Downloaded', 'CSV import template downloaded with sample FEFO & FIFO rows.');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(String(reader.result || ''));
      setSubmitError(null);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCommitImport = async () => {
    if (validRows.length === 0 || errorCount > 0) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await apiClient.importSkusCsv({
        rows: validRows,
        postOpeningBalanceGl: postOpeningGl,
      });
      await onImported();
      onShowToast('Bulk SKU Import Committed', res.message);
      setCsvText('');
      onClose();
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to commit CSV SKU/Batch import');
    } finally {
      setIsSubmitting(false);
    }
  };

  const cardBg = isLight ? 'bg-white border-slate-200' : 'bg-zinc-900 border-zinc-800';
  const subBg = isLight ? 'bg-slate-50 border-slate-200' : 'bg-zinc-950 border-zinc-800';
  const textTitle = isLight ? 'text-slate-900' : 'text-zinc-100';
  const textMuted = isLight ? 'text-slate-500' : 'text-zinc-400';

  return createPortal(
    <div
      className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Bulk SKU and Batch CSV Importer"
    >
      <div className={`${cardBg} border rounded-2xl shadow-2xl max-w-5xl w-full p-5 sm:p-6 space-y-4 my-auto`}>
        <div className={`flex items-start justify-between gap-3 border-b pb-3 ${isLight ? 'border-slate-200' : 'border-zinc-800'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0F4C3A]/10 dark:bg-emerald-500/15 text-[#0F4C3A] dark:text-emerald-400 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`text-base font-bold ${textTitle}`}>
                Bulk SKU &amp; Initial Batch Importer (CSV)
              </h3>
              <p className={`text-xs ${textMuted}`}>
                Imports SKUs, outlet tiers, rack/bin assignments, FEFO/FIFO strategies, and WAC opening stock.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                isLight
                  ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700'
              }`}
            >
              <Download className="w-3.5 h-3.5 text-[#0F4C3A] dark:text-emerald-400" />
              Download Template .CSV
            </button>

            <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[#0F4C3A] hover:bg-[#0b382b] text-white transition-all cursor-pointer shadow-xs">
              <Upload className="w-3.5 h-3.5" />
              Upload .CSV File
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30">
              Valid: {validRows.length} rows
            </span>
            <span
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${
                errorCount > 0
                  ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30'
                  : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
              }`}
            >
              Errors: {errorCount} rows
            </span>
          </div>
        </div>

        {/* Paste CSV Area */}
        <div className="space-y-1.5">
          <label className={`block text-xs font-semibold ${textTitle}`}>
            Paste CSV Rows (or upload a .csv file above)
          </label>
          <textarea
            rows={5}
            value={csvText}
            onChange={(e) => {
              setCsvText(e.target.value);
              setSubmitError(null);
            }}
            placeholder={REQUIRED_HEADERS.join(',')}
            className={`w-full rounded-xl border p-3 font-mono text-[11px] focus:outline-none focus:ring-2 focus:ring-[#0F4C3A] ${
              isLight
                ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                : 'bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600'
            }`}
          />
        </div>

        {/* Preview Table */}
        {parsedPreview.length > 0 && (
          <div className={`rounded-xl border overflow-hidden ${subBg}`}>
            <div className="max-h-60 overflow-auto">
              <table className="w-full text-left text-[11px] font-mono">
                <thead className={isLight ? 'bg-slate-100 text-slate-700' : 'bg-zinc-900 text-zinc-300'}>
                  <tr>
                    <th className="py-2 px-2.5">Row</th>
                    <th className="py-2 px-2.5">Status</th>
                    <th className="py-2 px-2.5">SKU</th>
                    <th className="py-2 px-2.5">Product Name</th>
                    <th className="py-2 px-2.5">Outlet</th>
                    <th className="py-2 px-2.5">Rack / Bin</th>
                    <th className="py-2 px-2.5">Lot #</th>
                    <th className="py-2 px-2.5">Expiry</th>
                    <th className="py-2 px-2.5 text-center">Strategy</th>
                    <th className="py-2 px-2.5 text-right">Qty</th>
                    {canViewValuation && <th className="py-2 px-2.5 text-right">Unit Cost</th>}
                  </tr>
                </thead>
                <tbody className={`divide-y ${isLight ? 'divide-slate-200' : 'divide-zinc-800'}`}>
                  {parsedPreview.map((row) => {
                    const hasErr = row.errors.length > 0;
                    return (
                      <tr
                        key={row.rowNumber}
                        className={
                          hasErr
                            ? isLight
                              ? 'bg-rose-50/70 text-rose-900'
                              : 'bg-rose-950/30 text-rose-200'
                            : isLight
                            ? 'bg-white text-slate-800'
                            : 'bg-zinc-950 text-zinc-200'
                        }
                      >
                        <td className="py-2 px-2.5 font-bold">#{row.rowNumber}</td>
                        <td className="py-2 px-2.5">
                          {hasErr ? (
                            <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              {row.errors.join('; ')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                              <CheckCircle2 className="w-3 h-3 shrink-0" />
                              Valid
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2.5 font-bold">{row.raw.sku || '-'}</td>
                        <td className="py-2 px-2.5 max-w-[180px] truncate">{row.raw.product_name || '-'}</td>
                        <td className="py-2 px-2.5">{row.parsed?.outlet_code || row.raw.outlet_code || '-'}</td>
                        <td className="py-2 px-2.5 font-bold">{row.raw.rack_bin_code || '-'}</td>
                        <td className="py-2 px-2.5">{row.raw.batch_lot_no || '-'}</td>
                        <td className={`py-2 px-2.5 ${row.isExpired ? 'text-rose-600 font-bold underline' : ''}`}>
                          {row.raw.expiry_date || '-'}
                        </td>
                        <td className="py-2 px-2.5 text-center">{row.raw.rotation_strategy || '-'}</td>
                        <td className="py-2 px-2.5 text-right font-bold">{row.raw.initial_qty || '-'}</td>
                        {canViewValuation && (
                          <td className="py-2 px-2.5 text-right">
                            {Number.isFinite(Number(row.raw.unit_cost_idr))
                              ? formatIDR(Number(row.raw.unit_cost_idr))
                              : '-'}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* GL Option & Error Banner */}
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border ${subBg}`}>
          <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={postOpeningGl}
              onChange={(e) => setPostOpeningGl(e.target.checked)}
              className="rounded border-slate-300 text-[#0F4C3A] focus:ring-[#0F4C3A]"
            />
            <span className={textTitle}>
              Post Opening Inventory Balance GL Journal (DR 1040 Merchandise Inventory / CR 3010 Opening Equity)
            </span>
          </label>
          {canViewValuation && validRows.length > 0 && (
            <span className="text-xs font-mono font-bold text-[#0F4C3A] dark:text-emerald-400">
              Opening Value: {formatIDR(totalPreviewValueIDR)}
            </span>
          )}
        </div>

        {submitError && (
          <div className="p-3 rounded-xl border border-rose-300 bg-rose-50 dark:bg-rose-950/40 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        <div className={`flex items-center justify-end gap-2 pt-2 border-t ${isLight ? 'border-slate-200' : 'border-zinc-800'}`}>
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 rounded-xl text-xs font-semibold border cursor-pointer ${
              isLight
                ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                : 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700'
            }`}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting || validRows.length === 0 || errorCount > 0}
            onClick={handleCommitImport}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#0F4C3A] hover:bg-[#0b382b] disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all cursor-pointer shadow-xs"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {isSubmitting ? 'Importing...' : `Confirm & Import to Warehouse (${validRows.length})`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
