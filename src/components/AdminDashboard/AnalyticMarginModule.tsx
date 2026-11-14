import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type {
  AnalyticDepartment,
  ProductMarginRecord,
  EnterpriseSettingsConfig,
} from '../../types/index.ts';
import { apiClient } from '../../services/apiClient';
import { formatIDR } from '../../utils/formatters';
import {
  PieChart,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Edit3,
  RefreshCw,
  Search,
  DollarSign,
  Layers,
  X,
  Save,
  ArrowUpRight,
} from 'lucide-react';

interface AnalyticMarginModuleProps {
  theme: 'light' | 'dark';
  mode: 'analytic_budgets' | 'margin_analysis';
  enterpriseSettings?: EnterpriseSettingsConfig | null;
  onRefreshData?: () => void;
  onShowToast: (title: string, message: string) => void;
}

export const AnalyticMarginModule: React.FC<AnalyticMarginModuleProps> = ({
  theme,
  mode,
  enterpriseSettings,
  onRefreshData,
  onShowToast,
}) => {
  const isLight = theme === 'light';

  const [departments, setDepartments] = useState<AnalyticDepartment[]>([]);
  const [margins, setMargins] = useState<ProductMarginRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Margin filters
  const [marginSearch, setMarginSearch] = useState<string>('');
  const [marginCategory, setMarginCategory] = useState<string>('ALL');
  const [onlyLowMargin, setOnlyLowMargin] = useState<boolean>(false);

  // Edit / Create Department Modal
  const [editingDept, setEditingDept] = useState<AnalyticDepartment | null>(null);
  const [isCreatingDept, setIsCreatingDept] = useState<boolean>(false);
  const [deptForm, setDeptForm] = useState({
    code: '',
    name: '',
    manager: '',
    annualBudgetIDR: 150000000,
    actualCostIDR: 0,
    expectedRevenueIDR: 0,
    actualRevenueIDR: 0,
  });
  const [isSavingDept, setIsSavingDept] = useState<boolean>(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [deptRes, marginRes] = await Promise.all([
        apiClient.getAnalyticDepartments(),
        apiClient.getMarginAnalysis(),
      ]);
      setDepartments(deptRes);
      setMargins(marginRes);
    } catch (err) {
      console.error('Failed to load analytic & margin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openEditDept = (dept: AnalyticDepartment) => {
    setEditingDept(dept);
    setIsCreatingDept(false);
    setDeptForm({
      code: dept.code,
      name: dept.name,
      manager: dept.manager,
      annualBudgetIDR: dept.annualBudgetIDR,
      actualCostIDR: dept.actualCostIDR,
      expectedRevenueIDR: dept.expectedRevenueIDR ?? 0,
      actualRevenueIDR: dept.actualRevenueIDR ?? 0,
    });
  };

  const openCreateDept = () => {
    setEditingDept(null);
    setIsCreatingDept(true);
    setDeptForm({
      code: 'DEPT-NEW',
      name: '',
      manager: '',
      annualBudgetIDR: 150000000,
      actualCostIDR: 0,
      expectedRevenueIDR: 300000000,
      actualRevenueIDR: 0,
    });
  };

  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingDept(true);
    try {
      if (isCreatingDept) {
        const res = await apiClient.createAnalyticDepartment(deptForm);
        onShowToast('Cost Center Added', res.message);
      } else if (editingDept) {
        const res = await apiClient.updateAnalyticDepartment(editingDept.id, {
          name: deptForm.name,
          manager: deptForm.manager,
          annualBudgetIDR: Number(deptForm.annualBudgetIDR) || 0,
          actualCostIDR: Number(deptForm.actualCostIDR) || 0,
          expectedRevenueIDR: Number(deptForm.expectedRevenueIDR) || 0,
          actualRevenueIDR: Number(deptForm.actualRevenueIDR) || 0,
        });
        onShowToast('Budget Updated', res.message);
      }
      setEditingDept(null);
      setIsCreatingDept(false);
      await loadData();
      if (onRefreshData) onRefreshData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Error', msg);
    } finally {
      setIsSavingDept(false);
    }
  };

  // Department KPIs
  const deptKpis = useMemo(() => {
    const totalBudget = departments.reduce((s, d) => s + (d.annualBudgetIDR || 0), 0);
    const totalActualCost = departments.reduce((s, d) => s + (d.actualCostIDR || 0), 0);
    const totalExpectedRev = departments.reduce((s, d) => s + (d.expectedRevenueIDR || 0), 0);
    const totalActualRev = departments.reduce((s, d) => s + (d.actualRevenueIDR || 0), 0);
    const utilization = totalBudget > 0 ? (totalActualCost / totalBudget) * 100 : 0;
    return { totalBudget, totalActualCost, totalExpectedRev, totalActualRev, utilization };
  }, [departments]);

  // Margin KPIs & Filtering
  const warningThreshold = enterpriseSettings?.analyticAccounting?.marginWarningThresholdPercent ?? 25.0;

  const categories = useMemo(() => {
    const set = new Set<string>();
    margins.forEach((m) => set.add(m.category));
    return ['ALL', ...Array.from(set)];
  }, [margins]);

  const filteredMargins = useMemo(() => {
    return margins.filter((m) => {
      if (marginCategory !== 'ALL' && m.category !== marginCategory) return false;
      if (onlyLowMargin && !m.isLowMarginAlert) return false;
      if (marginSearch.trim()) {
        const q = marginSearch.toLowerCase();
        return m.name.toLowerCase().includes(q) || m.sku.toLowerCase().includes(q) || m.category.toLowerCase().includes(q);
      }
      return true;
    });
  }, [margins, marginCategory, onlyLowMargin, marginSearch]);

  const marginKpis = useMemo(() => {
    const avgMargin = margins.length > 0
      ? margins.reduce((s, m) => s + m.marginPercent, 0) / margins.length
      : 0;
    const lowAlertCount = margins.filter((m) => m.isLowMarginAlert).length;
    const totalMonthlyGP = margins.reduce((s, m) => s + m.totalGrossProfitMonth, 0);
    const landedSkuCount = margins.filter((m) => m.landedCostAbsorption > 0).length;
    return { avgMargin, lowAlertCount, totalMonthlyGP, landedSkuCount };
  }, [margins]);

  const cardClass = `rounded-xl border transition-all ${
    isLight ? 'bg-white border-gray-200/90 shadow-xs' : 'bg-zinc-900/90 border-zinc-800'
  }`;

  const inputClass = `w-full px-3 py-2 text-xs rounded-xl border transition-colors focus:outline-none focus:ring-1 focus:ring-emerald-600 ${
    isLight
      ? 'bg-white border-gray-300 text-gray-900'
      : 'bg-zinc-950 border-zinc-700 text-white'
  }`;

  if (mode === 'analytic_budgets') {
    return (
      <div className="space-y-6 animate-fadeIn">
        {/* KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className={`${cardClass} p-4`}>
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-zinc-400">
              <span>Total Departmental Budget</span>
              <PieChart className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
            </div>
            <div className={`text-xl font-bold font-mono tabular-nums mt-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>
              {formatIDR(deptKpis.totalBudget)}
            </div>
            <div className="text-[11px] text-gray-500 dark:text-zinc-400 mt-1">
              {departments.length} Active Cost Centers
            </div>
          </div>

          <div className={`${cardClass} p-4`}>
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-zinc-400">
              <span>Actual Cost Committed</span>
              <Layers className="w-4 h-4 text-amber-500" />
            </div>
            <div className={`text-xl font-bold font-mono tabular-nums mt-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>
              {formatIDR(deptKpis.totalActualCost)}
            </div>
            <div className="text-[11px] text-gray-500 dark:text-zinc-400 mt-1 font-mono tabular-nums">
              {deptKpis.utilization.toFixed(1)}% Budget Utilization
            </div>
          </div>

          <div className={`${cardClass} p-4`}>
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-zinc-400">
              <span>Remaining Budget Headroom</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-xl font-bold font-mono tabular-nums mt-2 text-emerald-700 dark:text-emerald-400">
              {formatIDR(deptKpis.totalBudget - deptKpis.totalActualCost)}
            </div>
            <div className="text-[11px] text-gray-500 dark:text-zinc-400 mt-1">
              Remaining OpEx &amp; CapEx cap
            </div>
          </div>

          <div className={`${cardClass} p-4`}>
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-zinc-400">
              <span>Actual vs Expected Revenue</span>
              <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className={`text-xl font-bold font-mono tabular-nums mt-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>
              {formatIDR(deptKpis.totalActualRev)}
            </div>
            <div className="text-[11px] text-gray-500 dark:text-zinc-400 mt-1 font-mono tabular-nums">
              Target: {formatIDR(deptKpis.totalExpectedRev)}
            </div>
          </div>
        </div>

        {/* Department Budgets Table */}
        <div className={`${cardClass} overflow-hidden`}>
          <div className={`p-5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isLight ? 'border-gray-200 bg-gray-50/50' : 'border-zinc-800 bg-zinc-900/50'}`}>
            <div>
              <h3 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                Analytic Accounting Cost Centers &amp; Departmental Budgets
              </h3>
              <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-zinc-300'} mt-0.5`}>
                Track costs, revenues, and variance limits across Store Operations, Fresh Procurement, Cold-Chain Logistics, and Retail Marketing.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadData}
                className={`p-2 rounded-lg border text-xs transition-colors ${
                  isLight ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50' : 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700'
                }`}
                title="Refresh Cost Centers"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={openCreateDept}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#0F4C3A] hover:bg-[#0b382b] text-white transition-all shadow-xs whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Add Cost Center</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-xs">
              <thead>
                <tr className={`border-b text-[10px] uppercase font-semibold tracking-wider ${
                  isLight ? 'border-gray-200 bg-gray-50/70 text-gray-500' : 'border-zinc-800 bg-zinc-800/50 text-zinc-400'
                }`}>
                  <th className="py-3 px-4">Code &amp; Cost Center</th>
                  <th className="py-3 px-4">Budget Owner</th>
                  <th className="py-3 px-4 text-right">Annual Budget</th>
                  <th className="py-3 px-4 text-right">Actual Cost</th>
                  <th className="py-3 px-4 text-right">Cost Variance</th>
                  <th className="py-3 px-4">Utilization</th>
                  <th className="py-3 px-4 text-right">Rev (Actual / Expected)</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isLight ? 'divide-gray-200' : 'divide-zinc-800'}`}>
                {departments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-xs text-gray-500 dark:text-zinc-400">
                      {isLoading ? 'Loading analytic cost centers...' : 'No department cost centers configured yet.'}
                    </td>
                  </tr>
                ) : (
                  departments.map((dept) => {
                    const util = dept.utilizationPercent ?? (dept.annualBudgetIDR > 0 ? Number(((dept.actualCostIDR / dept.annualBudgetIDR) * 100).toFixed(1)) : 0);
                    const statusLabel = dept.status === 'OVER_BUDGET' ? 'Over Budget' : dept.status === 'WARNING' ? 'Near Limit' : 'On Track';
                    return (
                      <tr key={dept.id} className={`transition-colors ${isLight ? 'hover:bg-gray-50/80' : 'hover:bg-zinc-800/40'}`}>
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-[#0F4C3A] dark:text-emerald-400">{dept.code}</div>
                          <div className={`font-semibold ${isLight ? 'text-gray-900' : 'text-white'}`}>{dept.name}</div>
                        </td>
                        <td className={`py-3.5 px-4 ${isLight ? 'text-gray-700' : 'text-zinc-300'}`}>{dept.manager}</td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold">
                          {formatIDR(dept.annualBudgetIDR)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                          {formatIDR(dept.actualCostIDR)}
                        </td>
                        <td className={`py-3.5 px-4 text-right font-mono tabular-nums font-bold ${
                          dept.varianceIDR < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'
                        }`}>
                          {dept.varianceIDR >= 0 ? `+${formatIDR(dept.varianceIDR)}` : formatIDR(dept.varianceIDR)}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="w-36 space-y-1">
                            <div className="flex justify-between text-[10px] font-mono tabular-nums">
                              <span className={dept.status === 'OVER_BUDGET' ? 'text-rose-600 font-bold' : dept.status === 'WARNING' ? 'text-amber-600 font-bold' : 'text-emerald-600 font-bold'}>
                                {statusLabel}
                              </span>
                              <span className="font-bold">{util}%</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-gray-200 dark:bg-zinc-700 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  util > 100 ? 'bg-rose-500' : util > 80 ? 'bg-amber-500' : 'bg-emerald-600'
                                }`}
                                style={{ width: `${Math.min(100, util)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[11px]">
                          <div className={`font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>{formatIDR(dept.actualRevenueIDR ?? 0)}</div>
                          <div className="text-gray-500 dark:text-zinc-400">Goal: {formatIDR(dept.expectedRevenueIDR ?? 0)}</div>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => openEditDept(dept)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                              isLight
                                ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                                : 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700'
                            }`}
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit Budget</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create / Edit Department Modal */}
        {(editingDept || isCreatingDept) && typeof document !== 'undefined' && createPortal(
          <div
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => {
              setEditingDept(null);
              setIsCreatingDept(false);
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden my-auto ${
                isLight ? 'bg-white border-gray-200 text-gray-900' : 'bg-zinc-900 border-zinc-800 text-white'
              }`}
            >
              <div className={`p-5 border-b flex items-center justify-between ${isLight ? 'border-gray-200 bg-gray-50/70' : 'border-zinc-800 bg-zinc-900/60'}`}>
                <div>
                  <h3 className="text-base font-bold">
                    {isCreatingDept ? 'Register Analytic Cost Center' : `Update Budget: ${editingDept?.code}`}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                    Synchronizes immediately with Enterprise Analytics &amp; Budget Settings
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingDept(null);
                    setIsCreatingDept(false);
                  }}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveDept} className="p-5 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-semibold mb-1">Cost Center Code *</label>
                    <input
                      type="text"
                      required
                      disabled={!isCreatingDept}
                      value={deptForm.code}
                      onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })}
                      className={`font-mono font-bold ${inputClass} ${!isCreatingDept ? 'opacity-60' : ''}`}
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Manager / Owner *</label>
                    <input
                      type="text"
                      required
                      value={deptForm.manager}
                      onChange={(e) => setDeptForm({ ...deptForm, manager: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Department / Project Name *</label>
                  <input
                    type="text"
                    required
                    value={deptForm.name}
                    onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                    className={inputClass}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-semibold mb-1">Annual Cost Budget (IDR)</label>
                    <input
                      type="number"
                      min={0}
                      value={deptForm.annualBudgetIDR}
                      onChange={(e) => setDeptForm({ ...deptForm, annualBudgetIDR: Number(e.target.value) })}
                      className={`font-mono font-bold ${inputClass}`}
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Actual Cost Committed (IDR)</label>
                    <input
                      type="number"
                      min={0}
                      value={deptForm.actualCostIDR}
                      onChange={(e) => setDeptForm({ ...deptForm, actualCostIDR: Number(e.target.value) })}
                      className={`font-mono font-bold ${inputClass}`}
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Expected Revenue Target (IDR)</label>
                    <input
                      type="number"
                      min={0}
                      value={deptForm.expectedRevenueIDR}
                      onChange={(e) => setDeptForm({ ...deptForm, expectedRevenueIDR: Number(e.target.value) })}
                      className={`font-mono font-bold ${inputClass}`}
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Actual Revenue Recognized (IDR)</label>
                    <input
                      type="number"
                      min={0}
                      value={deptForm.actualRevenueIDR}
                      onChange={(e) => setDeptForm({ ...deptForm, actualRevenueIDR: Number(e.target.value) })}
                      className={`font-mono font-bold ${inputClass}`}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingDept(null);
                      setIsCreatingDept(false);
                    }}
                    className={`px-4 py-2 rounded-xl font-semibold border ${
                      isLight ? 'border-gray-200 text-gray-700 hover:bg-gray-50' : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingDept}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold bg-[#0F4C3A] hover:bg-[#0b382b] text-white disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSavingDept ? 'Saving...' : 'Save Budget'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }

  // MODE 2: REAL-TIME PRODUCT MARGIN ANALYSIS
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Margin KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`${cardClass} p-4`}>
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-zinc-400">
            <span>Catalog Avg Gross Margin</span>
            <TrendingUp className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums mt-2 text-emerald-700 dark:text-emerald-400">
            {marginKpis.avgMargin.toFixed(1)}%
          </div>
          <div className="text-[11px] text-gray-500 dark:text-zinc-400 mt-1">
            Warning threshold: &lt;{warningThreshold}%
          </div>
        </div>

        <div className={`${cardClass} p-4`}>
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-zinc-400">
            <span>Low-Margin Alert SKUs</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className={`text-xl font-bold font-mono tabular-nums mt-2 ${marginKpis.lowAlertCount > 0 ? 'text-amber-600 dark:text-amber-400' : isLight ? 'text-gray-900' : 'text-white'}`}>
            {marginKpis.lowAlertCount}
          </div>
          <div className="text-[11px] text-gray-500 dark:text-zinc-400 mt-1">
            Requires repricing or supplier renegotiation
          </div>
        </div>

        <div className={`${cardClass} p-4`}>
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-zinc-400">
            <span>Est. Monthly Gross Profit</span>
            <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className={`text-xl font-bold font-mono tabular-nums mt-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>
            {formatIDR(marginKpis.totalMonthlyGP)}
          </div>
          <div className="text-[11px] text-gray-500 dark:text-zinc-400 mt-1">
            Inclusive of landed cost absorption
          </div>
        </div>

        <div className={`${cardClass} p-4`}>
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-zinc-400">
            <span>Landed-Cost Adjusted SKUs</span>
            <ArrowUpRight className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className={`text-xl font-bold font-mono tabular-nums mt-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>
            {marginKpis.landedSkuCount} SKUs
          </div>
          <div className="text-[11px] text-gray-500 dark:text-zinc-400 mt-1">
            Freight &amp; kuli bongkar factored into COGS
          </div>
        </div>
      </div>

      {/* Margin Analysis Data Grid */}
      <div className={`${cardClass} overflow-hidden`}>
        <div className={`p-5 border-b flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${isLight ? 'border-gray-200 bg-gray-50/50' : 'border-zinc-800 bg-zinc-900/50'}`}>
          <div>
            <h3 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
              Real-Time Product Margin Analysis (True Landed COGS)
            </h3>
            <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-zinc-300'} mt-0.5`}>
              Evaluates selling price against Base Unit Cost plus absorbed freight, customs, and cold-chain handling costs.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={marginSearch}
                onChange={(e) => setMarginSearch(e.target.value)}
                placeholder="Search SKU or product..."
                className={`pl-8 pr-3 py-1.5 text-xs rounded-xl border w-48 focus:outline-none focus:ring-1 focus:ring-emerald-600 ${
                  isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-zinc-800 border-zinc-700 text-white'
                }`}
              />
            </div>

            <select
              value={marginCategory}
              onChange={(e) => setMarginCategory(e.target.value)}
              className={`px-2.5 py-1.5 text-xs rounded-xl border font-semibold ${
                isLight ? 'bg-white border-gray-200 text-gray-800' : 'bg-zinc-800 border-zinc-700 text-white'
              }`}
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c === 'ALL' ? 'All Categories' : c.replace(/_/g, ' ')}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setOnlyLowMargin(!onlyLowMargin)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors ${
                onlyLowMargin
                  ? 'bg-amber-600 text-white border-amber-600'
                  : isLight
                  ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700'
              }`}
            >
              Low-Margin Alerts ({marginKpis.lowAlertCount})
            </button>

            <button
              type="button"
              onClick={loadData}
              className={`p-1.5 rounded-xl border ${
                isLight ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50' : 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700'
              }`}
              title="Recalculate Margins"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-xs">
            <thead>
              <tr className={`border-b text-[10px] uppercase font-semibold tracking-wider ${
                isLight ? 'border-gray-200 bg-gray-50/70 text-gray-500' : 'border-zinc-800 bg-zinc-800/50 text-zinc-400'
              }`}>
                <th className="py-3 px-4">SKU &amp; Product</th>
                <th className="py-3 px-4 text-right">Base Cost</th>
                <th className="py-3 px-4 text-right">Landed Add-On</th>
                <th className="py-3 px-4 text-right">True Unit COGS</th>
                <th className="py-3 px-4 text-right">Selling Price</th>
                <th className="py-3 px-4 text-right">Gross Profit / Unit</th>
                <th className="py-3 px-4 text-right">Margin %</th>
                <th className="py-3 px-4 text-right">Est. Monthly Profit</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isLight ? 'divide-gray-200' : 'divide-zinc-800'}`}>
              {filteredMargins.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-xs text-gray-500 dark:text-zinc-400">
                    {isLoading ? 'Computing product margins...' : 'No products match your current margin filter.'}
                  </td>
                </tr>
              ) : (
                filteredMargins.map((m) => (
                  <tr key={m.sku} className={`transition-colors ${isLight ? 'hover:bg-gray-50/80' : 'hover:bg-zinc-800/40'}`}>
                    <td className="py-3 px-4">
                      <div className={`font-semibold ${isLight ? 'text-gray-900' : 'text-white'}`}>{m.name}</div>
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-zinc-400 font-mono">
                        <span>{m.sku}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-sans capitalize">{m.category.replace(/_/g, ' ')}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{formatIDR(m.baseCost)}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {m.landedCostAbsorption > 0 ? (
                        <span className="text-blue-600 dark:text-blue-400 font-semibold">
                          +{formatIDR(m.landedCostAbsorption)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                      {formatIDR(m.totalUnitCost)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-bold">
                      {formatIDR(m.sellingPrice)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400 font-semibold">
                      {formatIDR(m.grossProfit)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      <span className={`font-bold ${
                        m.isLowMarginAlert ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'
                      }`}>
                        {m.marginPercent}%
                      </span>
                      {m.isLowMarginAlert && (
                        <div className="text-[10px] font-sans text-amber-600 dark:text-amber-400">Below {warningThreshold}%</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      <div className={`font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>{formatIDR(m.totalGrossProfitMonth)}</div>
                      <div className="text-[10px] text-gray-500 dark:text-zinc-400">{m.unitsSoldMonth} units/mo</div>
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
