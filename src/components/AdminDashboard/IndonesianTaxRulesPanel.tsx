import React, { useEffect, useState } from 'react';
import { CheckCircle2, FileSpreadsheet, ShieldCheck, AlertTriangle, Search } from 'lucide-react';
import type { IndonesianTaxCategory, SkuTaxRule } from '../../types/index.ts';
import { apiClient } from '../../services/apiClient';

interface IndonesianTaxRulesPanelProps {
  theme: 'light' | 'dark';
  onShowToast: (title: string, message: string) => void;
}

export const IndonesianTaxRulesPanel: React.FC<IndonesianTaxRulesPanelProps> = ({
  theme,
  onShowToast,
}) => {
  const isLight = theme === 'light';
  const [rules, setRules] = useState<SkuTaxRule[]>([]);
  const [search, setSearch] = useState<string>('');
  const [npwpTestInput, setNpwpTestInput] = useState<string>('01.308.449.2-007.000');
  const [npwpResult, setNpwpResult] = useState<{
    valid: boolean;
    type: string;
    formatted: string;
    error?: string;
  } | null>(null);

  const loadRules = async () => {
    const data = await apiClient.getSkuTaxRules();
    setRules(data);
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handleUpdateTax = async (
    rule: SkuTaxRule,
    nextCategory: IndonesianTaxCategory,
    nextRate?: number,
    b2cInclusive?: boolean
  ) => {
    try {
      const rate =
        nextRate !== undefined
          ? nextRate
          : nextCategory === 'BKP_DIBEBASKAN'
          ? 0
          : nextCategory === 'NON_BKP_PB1'
          ? 10
          : 11;
      const res = await apiClient.updateSkuTaxRule({
        sku: rule.sku,
        taxCategory: nextCategory,
        taxRatePercent: rate,
        b2cTaxInclusive: b2cInclusive ?? rule.b2cTaxInclusive,
        b2bTaxExclusive: rule.b2bTaxExclusive,
      });
      setRules(res.rules);
      onShowToast('Tax Classification Saved', res.message);
    } catch (err: any) {
      onShowToast('Update Error', err.message || 'Failed to update SKU tax rule');
    }
  };

  const handleValidateNpwp = async () => {
    const res = await apiClient.validateNpwpOrNik(npwpTestInput);
    setNpwpResult(res);
  };

  const filtered = rules.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return r.sku.toLowerCase().includes(q) || r.productName.toLowerCase().includes(q);
  });

  return (
    <div
      className={`rounded-2xl border p-5 sm:p-6 space-y-4 lg:col-span-2 ${
        isLight
          ? 'bg-white border-gray-200/90 shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
          : 'bg-zinc-900/90 border-zinc-800'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-gray-100 dark:border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-100">
              Indonesian VAT / PPN Tax Engine &amp; 16-Digit NPWP/NIK Validator
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-zinc-300">
              Configure SKU tax status: BKP Standar (PPN 11%/12%), BKP Dibebaskan PPN (Sembako), and Non-BKP PB1 10%
            </p>
          </div>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter SKU..."
            className={`pl-8 pr-3 py-1.5 text-xs rounded-xl border ${
              isLight
                ? 'bg-white border-gray-300 text-gray-900'
                : 'bg-zinc-800 border-zinc-700 text-white'
            }`}
          />
        </div>
      </div>

      {/* Quick 16-Digit NPWP / NIK Validator */}
      <div
        className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
          isLight ? 'bg-gray-50 border-gray-200' : 'bg-zinc-800/40 border-zinc-800'
        }`}
      >
        <div className="flex-1 space-y-1">
          <span className="font-bold block">DJP Coretax 16-Digit NPWP / NIK Format Validator</span>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={npwpTestInput}
              onChange={(e) => setNpwpTestInput(e.target.value)}
              placeholder="Enter 16-digit NIK/NPWP or 15-digit legacy NPWP"
              className={`flex-1 max-w-sm px-3 py-1.5 rounded-lg border font-mono ${
                isLight ? 'bg-white border-gray-300' : 'bg-zinc-900 border-zinc-700'
              }`}
            />
            <button
              type="button"
              onClick={handleValidateNpwp}
              className="px-3 py-1.5 rounded-lg bg-[#0F4C3A] text-white font-bold cursor-pointer whitespace-nowrap shrink-0"
            >
              Validate TIN
            </button>
          </div>
        </div>

        {npwpResult && (
          <div
            className={`px-3 py-2 rounded-lg border text-[11px] font-mono ${
              npwpResult.valid
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
            }`}
          >
            {npwpResult.valid ? (
              <span className="flex items-center gap-1.5 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {npwpResult.type}: {npwpResult.formatted}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-3.5 h-3.5" />
                {npwpResult.error}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Per-SKU Classification Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-zinc-800 max-h-72 overflow-y-auto">
        <table className="w-full text-left text-xs">
          <thead
            className={`sticky top-0 z-10 border-b text-[10px] font-bold uppercase tracking-wider ${
              isLight ? 'bg-gray-50 text-gray-500 border-gray-200' : 'bg-zinc-800 text-zinc-400 border-zinc-700'
            }`}
          >
            <tr>
              <th className="py-2.5 px-3">SKU &amp; Product</th>
              <th className="py-2.5 px-3">Indonesian Tax Classification</th>
              <th className="py-2.5 px-3 text-center">Tariff (%)</th>
              <th className="py-2.5 px-3 text-center">B2C Pricing Mode</th>
              <th className="py-2.5 px-3 text-center">B2B Pricing Mode</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isLight ? 'divide-gray-100' : 'divide-zinc-800'}`}>
            {filtered.slice(0, 20).map((rule) => (
              <tr key={rule.sku} className={isLight ? 'hover:bg-gray-50/70' : 'hover:bg-zinc-800/40'}>
                <td className="py-2.5 px-3">
                  <span className="font-mono text-[10px] text-gray-400 block">{rule.sku}</span>
                  <span className="font-semibold">{rule.productName}</span>
                </td>
                <td className="py-2.5 px-3">
                  <select
                    value={rule.taxCategory}
                    onChange={(e) =>
                      handleUpdateTax(rule, e.target.value as IndonesianTaxCategory)
                    }
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold ${
                      isLight ? 'bg-white border-gray-300' : 'bg-zinc-800 border-zinc-700'
                    }`}
                  >
                    <option value="BKP_STANDARD">BKP Standar (PPN 11% / 12%)</option>
                    <option value="BKP_DIBEBASKAN">BKP Dibebaskan PPN (Sembako 0%)</option>
                    <option value="NON_BKP_PB1">Non-BKP / Pajak Daerah (PB1 10%)</option>
                  </select>
                </td>
                <td className="py-2.5 px-3 text-center font-mono font-bold">
                  {rule.taxCategory === 'BKP_STANDARD' ? (
                    <select
                      value={rule.taxRatePercent}
                      onChange={(e) =>
                        handleUpdateTax(rule, rule.taxCategory, Number(e.target.value))
                      }
                      className={`px-2 py-1 rounded-lg border font-mono ${
                        isLight ? 'bg-white border-gray-300' : 'bg-zinc-800 border-zinc-700'
                      }`}
                    >
                      <option value={11}>11%</option>
                      <option value={12}>12%</option>
                    </select>
                  ) : (
                    <span>{rule.taxRatePercent}%</span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateTax(rule, rule.taxCategory, rule.taxRatePercent, !rule.b2cTaxInclusive)
                    }
                    className={`inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-bold border cursor-pointer ${
                      rule.b2cTaxInclusive
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                        : 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30'
                    }`}
                  >
                    {rule.b2cTaxInclusive ? 'Tax-Inclusive' : 'Tax-Exclusive'}
                  </button>
                </td>
                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                  <span className="inline-flex items-center gap-1 whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-600 dark:text-zinc-300 border border-slate-500/20">
                    <ShieldCheck className="w-3 h-3" />
                    Tax-Exclusive (Faktur)
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
