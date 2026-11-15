import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PromotionRule, PromotionType, StaffShiftSession } from '../../types/index.ts';
import { apiClient } from '../../services/apiClient';
import { formatIDR } from '../../utils/formatters';
import { normalizeEnterpriseRole } from '../../utils/rbac';
import {
  Clock,
  Gift,
  Layers,
  Percent,
  Plus,
  RefreshCw,
  Tag,
  Ticket,
  ToggleLeft,
  ToggleRight,
  X,
  Zap,
} from 'lucide-react';

interface PromoVoucherRulesTabProps {
  theme: 'light' | 'dark';
  activeStaffSession?: StaffShiftSession | null;
  onShowToast: (title: string, message: string) => void;
}

const PROMO_TYPE_META: Record<
  PromotionType,
  { label: string; badgeClass: string; icon: any }
> = {
  BOGO: {
    label: 'Buy X Get Y',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    icon: Gift,
  },
  MIX_AND_MATCH: {
    label: 'Mix & Match',
    badgeClass: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
    icon: Layers,
  },
  HAPPY_HOUR: {
    label: 'Happy Hour',
    badgeClass: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
    icon: Clock,
  },
  CRM_VOUCHER: {
    label: 'CRM Voucher',
    badgeClass: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
    icon: Ticket,
  },
  MEMBER_TIER: {
    label: 'Member Tier',
    badgeClass: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
    icon: Tag,
  },
  PERCENTAGE_DISCOUNT: {
    label: '% Discount',
    badgeClass: 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30',
    icon: Percent,
  },
  FIXED_DISCOUNT: {
    label: 'Fixed Voucher',
    badgeClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
    icon: Ticket,
  },
  CATEGORY_BUNDLE: {
    label: 'Bundle',
    badgeClass: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
    icon: Layers,
  },
};

export const PromoVoucherRulesTab: React.FC<PromoVoucherRulesTabProps> = ({
  theme,
  activeStaffSession,
  onShowToast,
}) => {
  const isLight = theme === 'light';
  const canManagePromotions =
    !activeStaffSession ||
    ['store_manager', 'coo', 'super_admin'].includes(normalizeEnterpriseRole(activeStaffSession.userRole));
  const cardClass = `rounded-2xl border transition-all ${
    isLight
      ? 'bg-white border-slate-200/90 shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
      : 'bg-[#12141C] border-slate-800/80'
  }`;
  const subCardClass = `rounded-xl border ${
    isLight ? 'bg-slate-50/70 border-slate-200' : 'bg-[#090A0F] border-slate-800/80'
  }`;
  const inputClass = `border focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${
    isLight
      ? 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
      : 'bg-[#090A0F] border-slate-800/80 text-slate-100 placeholder:text-slate-500'
  }`;
  const textTitle = isLight ? 'text-slate-900' : 'text-slate-100';
  const textMuted = isLight ? 'text-slate-500' : 'text-slate-400';

  const [promotions, setPromotions] = useState<PromotionRule[]>([]);
  const [stats, setStats] = useState({ activeCount: 0, totalRedemptions: 0, happyHourActiveCount: 0 });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [busyRuleId, setBusyRuleId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<'ALL' | PromotionType>('ALL');
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);

  const [formState, setFormState] = useState<{
    name: string;
    code: string;
    type: PromotionType;
    targetType: 'ALL' | 'CATEGORY' | 'SKU';
    targetValue: string;
    discountType: 'percent' | 'fixed';
    discountPercent: number;
    discountAmountIDR: number;
    minOrderSubtotalIDR: number;
    minQty: number;
    buyQty: number;
    getQty: number;
    getDiscountPercent: number;
    happyHourStart: string;
    happyHourEnd: string;
    simulateHappyHourActive: boolean;
    endDate: string;
    description: string;
  }>({
    name: '',
    code: '',
    type: 'CRM_VOUCHER',
    targetType: 'ALL',
    targetValue: 'ALL',
    discountType: 'percent',
    discountPercent: 15,
    discountAmountIDR: 20000,
    minOrderSubtotalIDR: 75000,
    minQty: 3,
    buyQty: 2,
    getQty: 1,
    getDiscountPercent: 100,
    happyHourStart: '19:00',
    happyHourEnd: '21:00',
    simulateHappyHourActive: true,
    endDate: '2026-12-31',
    description: '',
  });

  const loadPromotions = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.getCrmPromotions();
      setPromotions(res.promotions || []);
      setStats(res.stats || { activeCount: 0, totalRedemptions: 0, happyHourActiveCount: 0 });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Promo Load Error', msg || 'Failed to load promo rules.');
    } finally {
      setIsLoading(false);
    }
  }, [onShowToast]);

  useEffect(() => {
    loadPromotions();
  }, [loadPromotions]);

  const filteredPromotions = useMemo(() => {
    if (typeFilter === 'ALL') return promotions;
    return promotions.filter((p) => p.type === typeFilter);
  }, [promotions, typeFilter]);

  const handleToggleActive = async (rule: PromotionRule) => {
    setBusyRuleId(rule.id);
    try {
      const res = await apiClient.saveCrmPromotion({
        id: rule.id,
        active: !rule.active,
      });
      onShowToast('Promo Updated', res.message);
      await loadPromotions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Update Failed', msg);
    } finally {
      setBusyRuleId(null);
    }
  };

  const handleToggleHappyHourSim = async (rule: PromotionRule) => {
    setBusyRuleId(`sim-${rule.id}`);
    try {
      const res = await apiClient.saveCrmPromotion({
        id: rule.id,
        simulateHappyHourActive: !rule.simulateHappyHourActive,
      });
      onShowToast(
        'Happy Hour Window Updated',
        `${rule.code} manual override is now ${!rule.simulateHappyHourActive ? 'ACTIVE' : 'SCHEDULED ONLY'}.`
      );
      if (res.rule) {
        await loadPromotions();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Toggle Failed', msg);
    } finally {
      setBusyRuleId(null);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.name.trim() || !formState.code.trim()) {
      onShowToast('Missing Fields', 'Please provide both a Rule Name and Promo/Voucher Code.');
      return;
    }

    setBusyRuleId('create-new');
    try {
      const payload: Partial<PromotionRule> = {
        name: formState.name.trim(),
        code: formState.code.trim().toUpperCase(),
        type: formState.type,
        targetType: formState.type === 'CRM_VOUCHER' ? 'ALL' : formState.targetType,
        targetValue:
          formState.type === 'CRM_VOUCHER'
            ? 'ALL'
            : formState.targetValue.trim() || 'produce',
        active: true,
        endDate: formState.endDate,
        description: formState.description.trim() || `${formState.name.trim()} (${formState.code.trim().toUpperCase()})`,
      };

      if (formState.type === 'BOGO') {
        payload.buyQty = formState.buyQty;
        payload.getQty = formState.getQty;
        payload.getDiscountPercent = formState.getDiscountPercent;
      } else if (formState.type === 'MIX_AND_MATCH') {
        payload.minQty = formState.minQty;
        payload.discountPercent = formState.discountPercent;
      } else if (formState.type === 'HAPPY_HOUR') {
        payload.discountPercent = formState.discountPercent;
        payload.happyHourStart = formState.happyHourStart;
        payload.happyHourEnd = formState.happyHourEnd;
        payload.simulateHappyHourActive = formState.simulateHappyHourActive;
      } else {
        if (formState.discountType === 'percent') {
          payload.discountPercent = formState.discountPercent;
        } else {
          payload.discountAmountIDR = formState.discountAmountIDR;
        }
        payload.minOrderSubtotalIDR = formState.minOrderSubtotalIDR;
      }

      const res = await apiClient.saveCrmPromotion(payload);
      onShowToast('Promotional Rule Published', res.message);
      setIsCreateOpen(false);
      setFormState((p) => ({ ...p, name: '', code: '', description: '' }));
      await loadPromotions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Create Promo Failed', msg);
    } finally {
      setBusyRuleId(null);
    }
  };

  const renderRuleCondition = (rule: PromotionRule) => {
    if (rule.type === 'BOGO') {
      return `Buy ${rule.buyQty || 2} Get ${rule.getQty || 1} (${rule.getDiscountPercent ?? 100}% off) on ${rule.targetValue}`;
    }
    if (rule.type === 'MIX_AND_MATCH') {
      return `Buy any ${rule.minQty || 3}+ items in [${rule.targetValue}] → ${rule.discountPercent || 15}% off`;
    }
    if (rule.type === 'HAPPY_HOUR') {
      return `${rule.discountPercent || 25}% off [${rule.targetValue}] (${rule.happyHourStart || '19:00'}–${rule.happyHourEnd || '21:00'} WIB)`;
    }
    if (rule.type === 'MEMBER_TIER') {
      return `${rule.memberTier || 'GOLD'} Member auto-perk → ${rule.discountPercent || 10}% off cart`;
    }
    const valStr = rule.discountPercent
      ? `${rule.discountPercent}% off`
      : `${formatIDR(rule.discountAmountIDR || 0)} off`;
    const minStr = rule.minOrderSubtotalIDR ? ` · Min ${formatIDR(rule.minOrderSubtotalIDR)}` : '';
    return `${valStr}${minStr}${rule.endDate ? ` · Exp ${rule.endDate}` : ''}`;
  };

  return (
    <div className="space-y-4">
      {/* Header & Summary Strip */}
      <div className={`${cardClass} p-4 sm:p-5 space-y-4`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className={`text-sm sm:text-base font-extrabold flex items-center gap-2 ${textTitle}`}>
              <Ticket className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
              <span>Promotional Mechanics &amp; CRM Voucher Rules</span>
            </h3>
            <p className={`text-xs mt-0.5 ${textMuted}`}>
              Configure live POS Buy X Get Y, Mix &amp; Match category bundles, Perishable Happy Hour windows, and unique CRM Vouchers (applied pre-VAT with GL parity).
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={loadPromotions}
              disabled={isLoading}
              className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                isLight ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50' : 'bg-slate-900/90 border-slate-800/80 text-slate-200 hover:bg-slate-800'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            {canManagePromotions && (
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Promo / Voucher</span>
              </button>
            )}
          </div>
        </div>

        {/* 3 Mini KPI Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className={`${subCardClass} p-3`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${textMuted}`}>
              Active Live Rules
            </span>
            <p className={`text-xl font-extrabold font-mono mt-0.5 ${textTitle}`}>
              {stats.activeCount} / {promotions.length}
            </p>
          </div>
          <div className={`${subCardClass} p-3`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${textMuted}`}>
              Cumulative Redemptions
            </span>
            <p className="text-xl font-extrabold font-mono mt-0.5 text-emerald-600 dark:text-emerald-400">
              {stats.totalRedemptions.toLocaleString('id-ID')}x
            </p>
          </div>
          <div className={`${subCardClass} p-3`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${textMuted}`}>
              Happy Hour Windows Active Now
            </span>
            <p className="text-xl font-extrabold font-mono mt-0.5 text-amber-600 dark:text-amber-400">
              {stats.happyHourActiveCount} Active
            </p>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(
            [
              { id: 'ALL', label: 'All Mechanics' },
              { id: 'BOGO', label: 'Buy X Get Y' },
              { id: 'MIX_AND_MATCH', label: 'Mix & Match' },
              { id: 'HAPPY_HOUR', label: 'Happy Hour' },
              { id: 'CRM_VOUCHER', label: 'CRM Vouchers' },
              { id: 'MEMBER_TIER', label: 'VIP Tier Perks' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setTypeFilter(f.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                typeFilter === f.id
                  ? 'bg-[#0F4C3A] text-white border-[#0F4C3A]'
                  : isLight
                  ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  : 'bg-[#090A0F] border-slate-800/80 text-slate-300 hover:bg-slate-900/60'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rules Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        {filteredPromotions.map((rule) => {
          const meta = PROMO_TYPE_META[rule.type] || PROMO_TYPE_META.CRM_VOUCHER;
          const Icon = meta.icon;
          return (
            <div key={rule.id} className={`${cardClass} p-4 flex flex-col justify-between gap-3`}>
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${meta.badgeClass}`}>
                        <Icon className="w-3 h-3" />
                        {meta.label}
                      </span>
                      <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#090A0F] border border-transparent dark:border-slate-800/80 text-slate-800 dark:text-slate-200">
                        {rule.code}
                      </span>
                    </div>
                    <h4 className={`text-sm font-extrabold mt-1.5 ${textTitle}`}>{rule.name}</h4>
                  </div>

                  <button
                    type="button"
                    disabled={busyRuleId === rule.id || !canManagePromotions}
                    onClick={() => handleToggleActive(rule)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border flex items-center gap-1 cursor-pointer shrink-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      rule.active
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                        : 'bg-slate-100 border-slate-200 text-slate-500 dark:bg-[#090A0F] dark:border-slate-800/80 dark:text-slate-400'
                    }`}
                  >
                    {rule.active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                    <span>{rule.active ? 'Active' : 'Paused'}</span>
                  </button>
                </div>

                <p className={`text-xs font-medium ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  {renderRuleCondition(rule)}
                </p>
                <p className={`text-[11px] ${textMuted}`}>{rule.description}</p>
              </div>

              <div className="pt-2.5 border-t border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
                <span className={`text-[11px] font-mono ${textMuted}`}>
                  Used: <strong className={textTitle}>{rule.usageCount}x</strong> · Target: {rule.targetType}
                </span>

                {rule.type === 'HAPPY_HOUR' && (
                  <button
                    type="button"
                    disabled={busyRuleId === `sim-${rule.id}` || !canManagePromotions}
                    onClick={() => handleToggleHappyHourSim(rule)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      rule.simulateHappyHourActive
                        ? 'bg-amber-500 text-white border-amber-500 shadow-2xs'
                        : isLight
                        ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                    }`}
                  >
                    <Zap className="w-3 h-3" />
                    <span>
                      {rule.simulateHappyHourActive ? 'Simulate Active: ON' : 'Simulate Happy Hour Now'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Promo / Voucher Modal */}
      {isCreateOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
            onClick={() => setIsCreateOpen(false)}
          >
            <form
              onSubmit={handleCreateRule}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-lg rounded-2xl border p-5 shadow-2xl space-y-3.5 my-auto ${
                isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#12141C] border-slate-800/80 text-slate-100'
              }`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800/80">
                <div>
                  <h3 className="text-sm font-extrabold">Create Promotional Rule / CRM Voucher</h3>
                  <p className={`text-[11px] ${textMuted}`}>Syncs immediately to POS Cashier Register &amp; GL engine.</p>
                </div>
                <button type="button" onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-200 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {(
                  [
                    { id: 'CRM_VOUCHER', label: 'CRM Voucher' },
                    { id: 'BOGO', label: 'Buy X Get Y' },
                    { id: 'MIX_AND_MATCH', label: 'Mix & Match' },
                    { id: 'HAPPY_HOUR', label: 'Happy Hour' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      setFormState((p) => ({
                        ...p,
                        type: t.id,
                        targetType: t.id === 'CRM_VOUCHER' ? 'ALL' : t.id === 'BOGO' ? 'SKU' : 'CATEGORY',
                        targetValue:
                          t.id === 'CRM_VOUCHER'
                            ? 'ALL'
                            : t.id === 'BOGO'
                            ? 'SKU-PRD-001'
                            : t.id === 'HAPPY_HOUR'
                            ? 'bakery,produce'
                            : 'produce',
                      }))
                    }
                    className={`py-2 px-2 rounded-xl text-[11px] font-bold border cursor-pointer ${
                      formState.type === t.id
                        ? 'bg-[#0F4C3A] text-white border-[#0F4C3A]'
                        : isLight
                        ? 'bg-slate-50 border-slate-200 text-slate-700'
                        : 'bg-[#090A0F] border-slate-800/80 text-slate-300 hover:bg-slate-900/60'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold mb-1">Rule / Campaign Name *</label>
                    <input
                      required
                      type="text"
                      value={formState.name}
                      onChange={(e) => setFormState((p) => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Weekend Fresh Payday 20%"
                      className={`w-full px-3 py-2 rounded-xl ${inputClass}`}
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">Promo / Voucher Code *</label>
                    <input
                      required
                      type="text"
                      value={formState.code}
                      onChange={(e) => setFormState((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                      placeholder="e.g. PAYDAY20"
                      className={`w-full px-3 py-2 rounded-xl font-mono uppercase ${inputClass}`}
                    />
                  </div>
                </div>

                {formState.type !== 'CRM_VOUCHER' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block font-bold mb-1">Target Scope</label>
                      <select
                        value={formState.targetType}
                        onChange={(e) =>
                          setFormState((p) => ({ ...p, targetType: e.target.value as 'ALL' | 'CATEGORY' | 'SKU' }))
                        }
                        className={`w-full px-3 py-2 rounded-xl ${inputClass}`}
                      >
                        <option value="CATEGORY">Category (e.g. produce, bakery)</option>
                        <option value="SKU">Specific SKU (e.g. SKU-PRD-001)</option>
                        <option value="ALL">All Store SKUs</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold mb-1">Target Category or SKU</label>
                      <input
                        type="text"
                        value={formState.targetValue}
                        onChange={(e) => setFormState((p) => ({ ...p, targetValue: e.target.value }))}
                        placeholder="produce or SKU-PRD-001"
                        className={`w-full px-3 py-2 rounded-xl font-mono ${inputClass}`}
                      />
                    </div>
                  </div>
                )}

                {formState.type === 'BOGO' && (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block font-bold mb-1">Buy Qty (X)</label>
                      <input
                        type="number"
                        min={1}
                        value={formState.buyQty}
                        onChange={(e) => setFormState((p) => ({ ...p, buyQty: Number(e.target.value) }))}
                        className={`w-full px-3 py-2 rounded-xl font-mono ${inputClass}`}
                      />
                    </div>
                    <div>
                      <label className="block font-bold mb-1">Get Qty (Y)</label>
                      <input
                        type="number"
                        min={1}
                        value={formState.getQty}
                        onChange={(e) => setFormState((p) => ({ ...p, getQty: Number(e.target.value) }))}
                        className={`w-full px-3 py-2 rounded-xl font-mono ${inputClass}`}
                      />
                    </div>
                    <div>
                      <label className="block font-bold mb-1">Get % Off</label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={formState.getDiscountPercent}
                        onChange={(e) => setFormState((p) => ({ ...p, getDiscountPercent: Number(e.target.value) }))}
                        className={`w-full px-3 py-2 rounded-xl font-mono ${inputClass}`}
                      />
                    </div>
                  </div>
                )}

                {formState.type === 'MIX_AND_MATCH' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-bold mb-1">Min Units in Basket</label>
                      <input
                        type="number"
                        min={2}
                        value={formState.minQty}
                        onChange={(e) => setFormState((p) => ({ ...p, minQty: Number(e.target.value) }))}
                        className={`w-full px-3 py-2 rounded-xl font-mono ${inputClass}`}
                      />
                    </div>
                    <div>
                      <label className="block font-bold mb-1">Bundle Discount (%)</label>
                      <input
                        type="number"
                        min={1}
                        max={90}
                        value={formState.discountPercent}
                        onChange={(e) => setFormState((p) => ({ ...p, discountPercent: Number(e.target.value) }))}
                        className={`w-full px-3 py-2 rounded-xl font-mono ${inputClass}`}
                      />
                    </div>
                  </div>
                )}

                {formState.type === 'HAPPY_HOUR' && (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block font-bold mb-1">Start (WIB)</label>
                      <input
                        type="time"
                        value={formState.happyHourStart}
                        onChange={(e) => setFormState((p) => ({ ...p, happyHourStart: e.target.value }))}
                        className={`w-full px-3 py-2 rounded-xl font-mono ${inputClass}`}
                      />
                    </div>
                    <div>
                      <label className="block font-bold mb-1">End (WIB)</label>
                      <input
                        type="time"
                        value={formState.happyHourEnd}
                        onChange={(e) => setFormState((p) => ({ ...p, happyHourEnd: e.target.value }))}
                        className={`w-full px-3 py-2 rounded-xl font-mono ${inputClass}`}
                      />
                    </div>
                    <div>
                      <label className="block font-bold mb-1">Markdown %</label>
                      <input
                        type="number"
                        min={1}
                        max={90}
                        value={formState.discountPercent}
                        onChange={(e) => setFormState((p) => ({ ...p, discountPercent: Number(e.target.value) }))}
                        className={`w-full px-3 py-2 rounded-xl font-mono ${inputClass}`}
                      />
                    </div>
                  </div>
                )}

                {formState.type === 'CRM_VOUCHER' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block font-bold mb-1">Discount Type</label>
                      <select
                        value={formState.discountType}
                        onChange={(e) =>
                          setFormState((p) => ({ ...p, discountType: e.target.value as 'percent' | 'fixed' }))
                        }
                        className={`w-full px-3 py-2 rounded-xl ${inputClass}`}
                      >
                        <option value="percent">Percentage (%)</option>
                        <option value="fixed">Fixed Nominal (IDR)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold mb-1">
                        {formState.discountType === 'percent' ? 'Percent Off (%)' : 'Amount Off (IDR)'}
                      </label>
                      {formState.discountType === 'percent' ? (
                        <input
                          type="number"
                          min={1}
                          max={90}
                          value={formState.discountPercent}
                          onChange={(e) => setFormState((p) => ({ ...p, discountPercent: Number(e.target.value) }))}
                          className={`w-full px-3 py-2 rounded-xl font-mono ${inputClass}`}
                        />
                      ) : (
                        <input
                          type="number"
                          min={1000}
                          step={1000}
                          value={formState.discountAmountIDR}
                          onChange={(e) => setFormState((p) => ({ ...p, discountAmountIDR: Number(e.target.value) }))}
                          className={`w-full px-3 py-2 rounded-xl font-mono ${inputClass}`}
                        />
                      )}
                    </div>
                    <div>
                      <label className="block font-bold mb-1">Min Spend (IDR)</label>
                      <input
                        type="number"
                        min={0}
                        step={5000}
                        value={formState.minOrderSubtotalIDR}
                        onChange={(e) => setFormState((p) => ({ ...p, minOrderSubtotalIDR: Number(e.target.value) }))}
                        className={`w-full px-3 py-2 rounded-xl font-mono ${inputClass}`}
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold mb-1">Expiry Date</label>
                    <input
                      type="date"
                      value={formState.endDate}
                      onChange={(e) => setFormState((p) => ({ ...p, endDate: e.target.value }))}
                      className={`w-full px-3 py-2 rounded-xl ${inputClass}`}
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">Rule Note</label>
                    <input
                      type="text"
                      value={formState.description}
                      onChange={(e) => setFormState((p) => ({ ...p, description: e.target.value }))}
                      placeholder="Optional POS note"
                      className={`w-full px-3 py-2 rounded-xl ${inputClass}`}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800/80 text-xs font-bold dark:text-slate-300 hover:dark:bg-slate-900/60 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busyRuleId === 'create-new'}
                  className="px-4 py-2 rounded-xl bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-bold cursor-pointer"
                >
                  {busyRuleId === 'create-new' ? 'Publishing...' : 'Publish Promo Rule'}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}
    </div>
  );
};
