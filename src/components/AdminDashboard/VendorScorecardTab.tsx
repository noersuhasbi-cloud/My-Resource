import React, { useMemo, useState } from 'react';
import type { VendorScorecardResponse, VendorScorecardRecord } from '../../types/index.ts';
import { formatIDR } from '../../utils/formatters';
import {
  Award,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Search,
  RefreshCw,
  FilePlus2,
} from 'lucide-react';

interface VendorScorecardTabProps {
  theme: 'light' | 'dark';
  data: VendorScorecardResponse | null;
  isLoading: boolean;
  canCreateDirectPO?: boolean;
  onRefresh: () => void;
  onIssueDirectPO?: (supplierName: string) => void;
}

export const VendorScorecardTab: React.FC<VendorScorecardTabProps> = ({
  theme,
  data,
  isLoading,
  canCreateDirectPO = false,
  onRefresh,
  onIssueDirectPO,
}) => {
  const isLight = theme === 'light';
  const [gradeFilter, setGradeFilter] = useState<'ALL' | 'A' | 'B' | 'C'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredScorecards = useMemo(() => {
    const list = data?.scorecards || [];
    return list.filter((row) => {
      if (gradeFilter !== 'ALL' && row.grade !== gradeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          row.supplierName.toLowerCase().includes(q) ||
          row.advisoryNote.toLowerCase().includes(q) ||
          row.gradeLabel.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [data, gradeFilter, searchQuery]);

  const summary = data?.summary;

  const getGradeBadgeClasses = (grade: VendorScorecardRecord['grade']) => {
    if (grade === 'A') {
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
    }
    if (grade === 'B') {
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';
    }
    return 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30';
  };

  const renderMetricCell = (val: number | null) => {
    if (val === null || val === undefined) {
      return (
        <span className={`font-mono tabular-nums text-xs ${isLight ? 'text-gray-400' : 'text-slate-500'}`}>
          N/A
        </span>
      );
    }
    const colorClass =
      val >= 90
        ? 'text-emerald-600 dark:text-emerald-400'
        : val >= 75
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-rose-600 dark:text-rose-400';
    return <span className={`font-mono tabular-nums font-bold ${colorClass}`}>{val.toFixed(1)}%</span>;
  };

  return (
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
            <h3 className={`text-base font-bold flex items-center gap-2 ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
              <Award className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
              Automated Vendor Scorecard &amp; SRM Intelligence
            </h3>
            <p className={`text-xs mt-0.5 ${isLight ? 'text-gray-500' : 'text-slate-300'}`}>
              Dynamic weighted scoring: On-Time Delivery (35%) · QC &amp; Cold-Chain Pass (40%) · 3-Way Match Accuracy ≤0.5% (25%). Missing metrics normalize automatically.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                isLight
                  ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 shadow-2xs'
                  : 'bg-slate-900/90 border-slate-800/80 text-slate-200 hover:bg-slate-800'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Recalculate Scores
            </button>
          </div>
        </div>

        {/* Summary KPI Strip */}
        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
            <div className={`p-3 rounded-xl border ${isLight ? 'bg-white border-gray-200/80' : 'bg-[#12141C] border-slate-800/80'}`}>
              <div className={`text-[11px] font-medium ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                Tracked Suppliers
              </div>
              <div className={`text-lg font-bold font-mono tabular-nums mt-0.5 ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                {summary.totalVendors} Vendors
              </div>
              <div className={`text-[10px] ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                Network Avg Score: <strong className="font-mono">{summary.avgCompositeScore}/100</strong>
              </div>
            </div>

            <div className={`p-3 rounded-xl border ${isLight ? 'bg-white border-gray-200/80' : 'bg-[#12141C] border-slate-800/80'}`}>
              <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
                <span>Grade A · Preferred</span>
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
                {summary.gradeACount}
              </div>
              <div className={`text-[10px] ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                Score ≥ 90 · Priority replenishment
              </div>
            </div>

            <div className={`p-3 rounded-xl border ${isLight ? 'bg-white border-gray-200/80' : 'bg-[#12141C] border-slate-800/80'}`}>
              <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400 flex items-center justify-between">
                <span>Grade B · Standard</span>
                <ShieldAlert className="w-3.5 h-3.5" />
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-amber-600 dark:text-amber-300 mt-0.5">
                {summary.gradeBCount}
              </div>
              <div className={`text-[10px] ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                Score 75–89 · Standard SLA
              </div>
            </div>

            <div className={`p-3 rounded-xl border ${isLight ? 'bg-white border-gray-200/80' : 'bg-[#12141C] border-slate-800/80'}`}>
              <div className="text-[11px] font-medium text-rose-600 dark:text-rose-400 flex items-center justify-between">
                <span>Grade C · Probation</span>
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400 mt-0.5">
                {summary.gradeCCount}
              </div>
              <div className={`text-[10px] ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                Score &lt; 75 · Review terms
              </div>
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 pt-3 border-t border-gray-200 dark:border-slate-800/80">
          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                { id: 'ALL', label: 'All Grades' },
                { id: 'A', label: 'Grade A (Preferred)' },
                { id: 'B', label: 'Grade B (Standard)' },
                { id: 'C', label: 'Grade C (Probation)' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setGradeFilter(opt.id)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  gradeFilter === opt.id
                    ? 'bg-[#0F4C3A] text-white shadow-xs'
                    : isLight
                    ? 'text-gray-600 hover:bg-gray-100'
                    : 'text-slate-400 hover:bg-slate-900/90 hover:text-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-gray-400 dark:text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search supplier or warning..."
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

      {/* Scorecard Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-xs">
          <thead>
            <tr
              className={`border-b text-[10px] uppercase font-semibold tracking-wider ${
                isLight ? 'border-gray-200 bg-gray-50/70 text-gray-500' : 'border-slate-800/80 bg-[#090A0F] text-slate-400'
              }`}
            >
              <th className="py-3 px-4">Supplier &amp; Advisory</th>
              <th className="py-3 px-3 text-center">PO / GR / Bills</th>
              <th className="py-3 px-3 text-right">OTD % (35%)</th>
              <th className="py-3 px-3 text-right">QC Pass % (40%)</th>
              <th className="py-3 px-3 text-right">3-Way Match % (25%)</th>
              <th className="py-3 px-3 text-center">RTVs</th>
              <th className="py-3 px-3 text-right">PO Volume</th>
              <th className="py-3 px-3 text-center">SRM Score</th>
              <th className="py-3 px-4">Tier Grade</th>
              {canCreateDirectPO && onIssueDirectPO && <th className="py-3 px-4 text-right">Action</th>}
            </tr>
          </thead>
          <tbody className={`divide-y ${isLight ? 'divide-gray-200' : 'divide-slate-800/80'}`}>
            {isLoading && !data ? (
              <tr>
                <td colSpan={canCreateDirectPO && onIssueDirectPO ? 10 : 9} className="py-10 text-center text-slate-400">
                  Calculating supplier scorecards from live PO, GR, QC &amp; AP ledgers...
                </td>
              </tr>
            ) : filteredScorecards.length === 0 ? (
              <tr>
                <td colSpan={canCreateDirectPO && onIssueDirectPO ? 10 : 9} className={`py-10 text-center ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                  No suppliers match the selected SRM filter.
                </td>
              </tr>
            ) : (
              filteredScorecards.map((v) => (
                <tr
                  key={v.supplierName}
                  className={`transition-colors ${isLight ? 'hover:bg-gray-50/80' : 'hover:bg-slate-900/60'}`}
                >
                  <td className="py-3.5 px-4 max-w-xs">
                    <div className={`font-bold ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                      {v.supplierName}
                    </div>
                    <div className={`text-[11px] mt-0.5 ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                      {v.advisoryNote}
                    </div>
                  </td>

                  <td className="py-3.5 px-3 text-center font-mono tabular-nums">
                    <span className={isLight ? 'text-gray-800' : 'text-slate-200'}>
                      {v.totalPOs} / {v.completedGRs} / {v.totalBills}
                    </span>
                  </td>

                  <td className="py-3.5 px-3 text-right">{renderMetricCell(v.onTimeDeliveryRate)}</td>
                  <td className="py-3.5 px-3 text-right">{renderMetricCell(v.qcPassRate)}</td>
                  <td className="py-3.5 px-3 text-right">{renderMetricCell(v.billingAccuracyRate)}</td>

                  <td className="py-3.5 px-3 text-center font-mono tabular-nums">
                    {v.rtvCount > 0 ? (
                      <span className="font-bold text-rose-600 dark:text-rose-400">{v.rtvCount}</span>
                    ) : (
                      <span className={isLight ? 'text-gray-400' : 'text-slate-500'}>0</span>
                    )}
                  </td>

                  <td className={`py-3.5 px-3 text-right font-mono tabular-nums font-semibold ${isLight ? 'text-gray-800' : 'text-slate-200'}`}>
                    {formatIDR(v.totalSpendIDR)}
                  </td>

                  <td className="py-3.5 px-3 text-center">
                    <span
                      className={`font-mono tabular-nums text-sm font-extrabold ${
                        v.grade === 'A'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : v.grade === 'B'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {v.compositeScore}
                    </span>
                    <span className={`text-[10px] font-mono ${isLight ? 'text-gray-400' : 'text-slate-500'}`}>/100</span>
                  </td>

                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getGradeBadgeClasses(
                        v.grade
                      )}`}
                    >
                      {v.gradeLabel}
                    </span>
                  </td>

                  {canCreateDirectPO && onIssueDirectPO && (
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onIssueDirectPO(v.supplierName)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                          isLight
                            ? 'bg-white border-gray-200 text-[#0F4C3A] hover:bg-emerald-50'
                            : 'bg-slate-900/90 border-slate-800/80 text-emerald-400 hover:bg-slate-800'
                        }`}
                      >
                        <FilePlus2 className="w-3 h-3" />
                        Direct PO
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
