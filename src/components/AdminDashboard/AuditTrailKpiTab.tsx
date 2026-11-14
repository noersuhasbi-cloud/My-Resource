import React, { useEffect, useMemo, useState } from 'react';
import type { AuditTrailModuleType, AuditTrailOverviewResponse } from '../../types/index.ts';
import { apiClient } from '../../services/apiClient';
import { formatIDR } from '../../utils/formatters';
import {
  ShieldCheck,
  Download,
  RefreshCw,
  Search,
  ShoppingCart,
  Warehouse,
  FileCheck2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface AuditTrailKpiTabProps {
  theme: 'light' | 'dark';
  onShowToast: (title: string, message: string) => void;
}

const MODULE_OPTIONS: Array<{ value: 'ALL' | AuditTrailModuleType; label: string }> = [
  { value: 'ALL', label: 'All Modules' },
  { value: 'FINANCE', label: 'Finance & GL' },
  { value: 'INVENTORY', label: 'Inventory & Stocktake' },
  { value: 'POS', label: 'POS & Markdowns' },
  { value: 'PROCUREMENT', label: 'Procurement (PO/GR)' },
  { value: 'QUALITY', label: 'Quality & Batch Recall' },
  { value: 'SECURITY', label: 'Settings & RBAC' },
];

export const AuditTrailKpiTab: React.FC<AuditTrailKpiTabProps> = ({ theme, onShowToast }) => {
  const isLight = theme === 'light';
  const [overview, setOverview] = useState<AuditTrailOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [moduleFilter, setModuleFilter] = useState<'ALL' | AuditTrailModuleType>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const loadAuditOverview = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.getSettingsAuditTrail();
      setOverview(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Audit Trail Unavailable', msg);
    } finally {
      setIsLoading(false);
    }
  }, [onShowToast]);

  useEffect(() => {
    loadAuditOverview();
  }, [loadAuditOverview]);

  const filteredLogs = useMemo(() => {
    const logs = overview?.logs || [];
    return logs.filter((entry) => {
      if (moduleFilter !== 'ALL' && entry.module !== moduleFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          entry.actorName.toLowerCase().includes(q) ||
          entry.actorRole.toLowerCase().includes(q) ||
          entry.referenceId.toLowerCase().includes(q) ||
          entry.action.toLowerCase().includes(q) ||
          entry.summary.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [overview, moduleFilter, searchQuery]);

  const handleExportCsv = () => {
    if (filteredLogs.length === 0) {
      onShowToast('No Rows to Export', 'Adjust filters so at least one audit entry is visible.');
      return;
    }

    const escapeCsv = (val: unknown) => {
      const str = String(val ?? '');
      if (str.includes('"') || str.includes(',') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headers = [
      'Audit ID',
      'Timestamp (ISO)',
      'Actor Name',
      'Actor Role',
      'Branch Scope',
      'Module',
      'Action',
      'Reference ID',
      'Summary',
    ];
    const lines = [
      headers.map(escapeCsv).join(','),
      ...filteredLogs.map((row) =>
        [
          row.id,
          row.timestamp,
          row.actorName,
          row.actorRole,
          row.branchScope,
          row.module,
          row.action,
          row.referenceId,
          row.summary,
        ]
          .map(escapeCsv)
          .join(',')
      ),
    ];

    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `grocematrix-audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    onShowToast('Audit Log Exported', `Downloaded ${filteredLogs.length} immutable audit log record(s) to CSV.`);
  };

  const getModuleBadgeClass = (mod: AuditTrailModuleType) => {
    switch (mod) {
      case 'FINANCE':
        return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
      case 'INVENTORY':
        return 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30';
      case 'POS':
        return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';
      case 'PROCUREMENT':
        return 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30';
      case 'QUALITY':
        return 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30';
      case 'SECURITY':
      default:
        return 'bg-slate-500/15 text-slate-700 dark:text-zinc-300 border-slate-500/30';
    }
  };

  const kpis = overview?.operatorKpis;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* OPERATOR PRODUCTIVITY & COMPLIANCE KPI CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Card 1: Frontline Cashiers */}
        <div
          className={`p-5 rounded-2xl border ${
            isLight
              ? 'bg-white border-gray-200/90 shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
              : 'bg-zinc-900/90 border-zinc-800'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <div>
                <h4 className={`text-sm font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                  Frontline Cashiers
                </h4>
                <p className={`text-[11px] ${isLight ? 'text-gray-500' : 'text-zinc-400'}`}>
                  Checkout Throughput &amp; Register Integrity
                </p>
              </div>
            </div>
            {kpis && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  kpis.cashiers.totalCashVarianceIDR === 0
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                }`}
              >
                {kpis.cashiers.totalCashVarianceIDR === 0 ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" /> 0 Cash Short
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3 h-3" /> Variance Logged
                  </>
                )}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-gray-200/70 dark:border-zinc-800">
            <div>
              <div className={`text-[11px] ${isLight ? 'text-gray-500' : 'text-zinc-400'}`}>POS Receipts</div>
              <div className={`text-base font-bold font-mono tabular-nums ${isLight ? 'text-gray-900' : 'text-white'}`}>
                {kpis ? kpis.cashiers.totalReceiptsProcessed : '—'}
              </div>
            </div>
            <div>
              <div className={`text-[11px] ${isLight ? 'text-gray-500' : 'text-zinc-400'}`}>Net POS Sales</div>
              <div className="text-base font-bold font-mono tabular-nums text-[#0F4C3A] dark:text-emerald-400">
                {kpis ? formatIDR(kpis.cashiers.totalNetSalesIDR) : '—'}
              </div>
            </div>
            <div>
              <div className={`text-[11px] ${isLight ? 'text-gray-500' : 'text-zinc-400'}`}>Avg Basket Size</div>
              <div className={`text-sm font-bold font-mono tabular-nums ${isLight ? 'text-gray-800' : 'text-zinc-200'}`}>
                {kpis ? formatIDR(kpis.cashiers.avgBasketSizeIDR) : '—'}
              </div>
            </div>
            <div>
              <div className={`text-[11px] ${isLight ? 'text-gray-500' : 'text-zinc-400'}`}>Z-Report Accuracy</div>
              <div className="text-sm font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                {kpis ? `${kpis.cashiers.shiftVarianceAccuracyPct.toFixed(1)}%` : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Warehouse & QC Team */}
        <div
          className={`p-5 rounded-2xl border ${
            isLight
              ? 'bg-white border-gray-200/90 shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
              : 'bg-zinc-900/90 border-zinc-800'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Warehouse className="w-4 h-4" />
              </div>
              <div>
                <h4 className={`text-sm font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                  Warehouse &amp; QC Team
                </h4>
                <p className={`text-[11px] ${isLight ? 'text-gray-500' : 'text-zinc-400'}`}>
                  Receiving, Cold-Chain QC &amp; Cycle Accuracy
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-gray-200/70 dark:border-zinc-800">
            <div>
              <div className={`text-[11px] ${isLight ? 'text-gray-500' : 'text-zinc-400'}`}>GRs / QC Checks</div>
              <div className={`text-base font-bold font-mono tabular-nums ${isLight ? 'text-gray-900' : 'text-white'}`}>
                {kpis ? `${kpis.warehouseQc.totalGoodsReceiptsProcessed} / ${kpis.warehouseQc.totalQcInspectionsProcessed}` : '—'}
              </div>
            </div>
            <div>
              <div className={`text-[11px] ${isLight ? 'text-gray-500' : 'text-zinc-400'}`}>Stocktake Accuracy</div>
              <div className="text-base font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                {kpis ? `${kpis.warehouseQc.stocktakeCountAccuracyPct.toFixed(1)}%` : '—'}
              </div>
            </div>
            <div>
              <div className={`text-[11px] ${isLight ? 'text-gray-500' : 'text-zinc-400'}`}>QC Cold-Chain Pass</div>
              <div className={`text-sm font-bold font-mono tabular-nums ${isLight ? 'text-gray-800' : 'text-zinc-200'}`}>
                {kpis ? `${kpis.warehouseQc.qcPassRatePct.toFixed(1)}%` : '—'}
              </div>
            </div>
            <div>
              <div className={`text-[11px] ${isLight ? 'text-gray-500' : 'text-zinc-400'}`}>Cross-Dock / Transfers</div>
              <div className={`text-sm font-bold font-mono tabular-nums ${isLight ? 'text-gray-800' : 'text-zinc-200'}`}>
                {kpis ? `${kpis.warehouseQc.crossDockDispatchesCount} / ${kpis.warehouseQc.totalTransfersCount}` : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Procurement & Finance */}
        <div
          className={`p-5 rounded-2xl border ${
            isLight
              ? 'bg-white border-gray-200/90 shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
              : 'bg-zinc-900/90 border-zinc-800'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <FileCheck2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className={`text-sm font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                  Procurement &amp; Finance
                </h4>
                <p className={`text-[11px] ${isLight ? 'text-gray-500' : 'text-zinc-400'}`}>
                  PO Velocity, 3-Way Match &amp; Matrix Approvals
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-gray-200/70 dark:border-zinc-800">
            <div>
              <div className={`text-[11px] ${isLight ? 'text-gray-500' : 'text-zinc-400'}`}>POs Issued</div>
              <div className={`text-base font-bold font-mono tabular-nums ${isLight ? 'text-gray-900' : 'text-white'}`}>
                {kpis ? kpis.procurementFinance.totalPOsIssued : '—'}
              </div>
            </div>
            <div>
              <div className={`text-[11px] ${isLight ? 'text-gray-500' : 'text-zinc-400'}`}>3-Way Auto-Match</div>
              <div className="text-base font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                {kpis ? `${kpis.procurementFinance.threeWayMatchAutoApprovalRatePct.toFixed(1)}%` : '—'}
              </div>
            </div>
            <div>
              <div className={`text-[11px] ${isLight ? 'text-gray-500' : 'text-zinc-400'}`}>Matrix Turnaround</div>
              <div className={`text-sm font-bold font-mono tabular-nums ${isLight ? 'text-gray-800' : 'text-zinc-200'}`}>
                {kpis ? `${kpis.procurementFinance.approvalMatrixTurnaroundCount} Decided` : '—'}
              </div>
            </div>
            <div>
              <div className={`text-[11px] ${isLight ? 'text-gray-500' : 'text-zinc-400'}`}>Pending Queue</div>
              <div className="text-sm font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
                {kpis ? `${kpis.procurementFinance.approvalMatrixPendingCount} Pending` : '—'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* IMMUTABLE AUDIT TRAIL EXPLORER */}
      <div
        className={`rounded-2xl border overflow-hidden ${
          isLight
            ? 'bg-white border-gray-200/90 shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
            : 'bg-zinc-900/90 border-zinc-800'
        }`}
      >
        <div className={`p-5 border-b ${isLight ? 'border-gray-200 bg-gray-50/50' : 'border-zinc-800 bg-zinc-900/50'}`}>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <h3 className={`text-base font-bold flex items-center gap-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                <ShieldCheck className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
                Immutable Financial &amp; Operational Audit Trail
              </h3>
              <p className={`text-xs mt-0.5 ${isLight ? 'text-gray-500' : 'text-zinc-400'}`}>
                Append-only log persisted in ERP snapshot across Approvals, Vendor Bills, Giro Clearing, Stocktakes, Recalls, Safe Drops &amp; RBAC.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2" />
                <input
                  type="text"
                  placeholder="Search Actor / Doc Ref #..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`pl-8 pr-3 py-1.5 text-xs rounded-xl border focus:outline-none ${
                    isLight
                      ? 'bg-white border-gray-200 text-gray-900 focus:border-[#0F4C3A]'
                      : 'bg-zinc-800 border-zinc-700 text-white focus:border-emerald-500'
                  }`}
                />
              </div>

              <select
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value as 'ALL' | AuditTrailModuleType)}
                className={`px-3 py-1.5 text-xs rounded-xl border font-semibold cursor-pointer focus:outline-none ${
                  isLight
                    ? 'bg-white border-gray-200 text-gray-700 focus:border-[#0F4C3A]'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-200 focus:border-emerald-500'
                }`}
              >
                {MODULE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={loadAuditOverview}
                disabled={isLoading}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  isLight
                    ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700'
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#0F4C3A] hover:bg-[#0b382b] text-white transition-all shadow-xs cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                Export Audit Log (.CSV)
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-xs">
            <thead>
              <tr
                className={`border-b text-[10px] uppercase font-semibold tracking-wider ${
                  isLight ? 'border-gray-200 bg-gray-50/70 text-gray-500' : 'border-zinc-800 bg-zinc-800/50 text-zinc-400'
                }`}
              >
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-3">Actor &amp; Role</th>
                <th className="py-3 px-3">Branch Scope</th>
                <th className="py-3 px-3">Module</th>
                <th className="py-3 px-3">Action</th>
                <th className="py-3 px-3">Reference ID</th>
                <th className="py-3 px-4">Summary</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isLight ? 'divide-gray-200' : 'divide-zinc-800'}`}>
              {isLoading && !overview ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-zinc-400">
                    Loading immutable governance audit trail...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className={`py-10 text-center ${isLight ? 'text-gray-500' : 'text-zinc-400'}`}>
                    No audit records match the current filter.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    className={`transition-colors ${isLight ? 'hover:bg-gray-50/80' : 'hover:bg-zinc-800/40'}`}
                  >
                    <td className="py-3 px-4 whitespace-nowrap font-mono tabular-nums text-[11px] text-gray-500 dark:text-zinc-400">
                      {new Date(log.timestamp).toLocaleString('id-ID', {
                        year: 'numeric',
                        month: 'short',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-3">
                      <div className={`font-semibold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                        {log.actorName}
                      </div>
                      <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                        {log.actorRole.replace(/_/g, ' ')}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-gray-600 dark:text-zinc-300">
                      {log.branchScope}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getModuleBadgeClass(
                          log.module
                        )}`}
                      >
                        {log.module}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] font-semibold text-gray-800 dark:text-zinc-200 whitespace-nowrap">
                      {log.action}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-[#0F4C3A] dark:text-emerald-400 whitespace-nowrap">
                      {log.referenceId}
                    </td>
                    <td className={`py-3 px-4 max-w-md ${isLight ? 'text-gray-700' : 'text-zinc-300'}`}>
                      {log.summary}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
