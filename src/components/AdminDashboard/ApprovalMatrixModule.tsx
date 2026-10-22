import React, { useState, useEffect } from 'react';
import type {
  ApprovalTierRule,
  ApprovalRequest,
  ApprovalModuleType,
} from '../../types/index.ts';
import { formatIDR } from '../../utils/formatters';
import { apiClient } from '../../services/apiClient';
import {
  FileCheck2,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Sliders,
  Save,
  RefreshCw,
  Search,
  Filter,
  Check,
  ArrowRight,
  UserCheck,
  Lock,
} from 'lucide-react';

interface ApprovalMatrixModuleProps {
  theme: 'light' | 'dark';
  selectedStore?: string;
  approvalRules?: ApprovalTierRule[];
  approvalQueue?: ApprovalRequest[];
  onRefreshData?: () => void;
  onShowToast: (title: string, message: string) => void;
}

export const ApprovalMatrixModule: React.FC<ApprovalMatrixModuleProps> = ({
  theme,
  selectedStore = 'CONSOLIDATED',
  approvalRules,
  approvalQueue,
  onRefreshData,
  onShowToast,
}) => {
  const isLight = theme === 'light';

  // Sub-tabs: 'queue' | 'rules'
  const [subTab, setSubTab] = useState<'queue' | 'rules'>('queue');
  const [selectedModule, setSelectedModule] = useState<'ALL' | ApprovalModuleType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');

  // Internal data loading if not supplied by parent
  const [internalRules, setInternalRules] = useState<ApprovalTierRule[]>(approvalRules || []);
  const [internalQueue, setInternalQueue] = useState<ApprovalRequest[]>(approvalQueue || []);

  const loadApprovalData = async () => {
    try {
      if (!approvalRules) {
        const rules = await apiClient.getApprovalRules();
        setInternalRules(rules);
        setRulesState(rules);
      }
      if (!approvalQueue) {
        const queue = await apiClient.getApprovalQueue(selectedStore);
        setInternalQueue(queue);
      }
    } catch (err) {
      console.error('Failed to load approval data:', err);
    }
  };

  useEffect(() => {
    loadApprovalData();
  }, [selectedStore]);

  useEffect(() => {
    if (approvalRules) {
      setInternalRules(approvalRules);
      setRulesState(approvalRules);
    }
  }, [approvalRules]);

  useEffect(() => {
    if (approvalQueue) {
      setInternalQueue(approvalQueue);
    }
  }, [approvalQueue]);

  const activeRules = approvalRules || internalRules;
  const activeQueue = approvalQueue || internalQueue;

  // Action Modal State
  const [activeActionRequest, setActiveActionRequest] = useState<ApprovalRequest | null>(null);
  const [actionType, setActionType] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [actionComment, setActionComment] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Editable rules state
  const [rulesState, setRulesState] = useState<ApprovalTierRule[]>(approvalRules || []);
  const [isSavingRules, setIsSavingRules] = useState<boolean>(false);

  const handleOpenAction = (req: ApprovalRequest, type: 'APPROVED' | 'REJECTED') => {
    setActiveActionRequest(req);
    setActionType(type);
    setActionComment(type === 'APPROVED' ? 'Approved based on operational review and budget availability.' : 'Rejected due to budget constraints or excess stock.');
  };

  const handleExecuteAction = async () => {
    if (!activeActionRequest) return;
    setIsProcessing(true);
    try {
      const res = await apiClient.processApprovalAction(
        activeActionRequest.id,
        actionType,
        actionComment
      );
      onShowToast('Approval Action Executed', res.message);
      setActiveActionRequest(null);
      if (onRefreshData) onRefreshData();
      else loadApprovalData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Action Failed', msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveRules = async () => {
    setIsSavingRules(true);
    try {
      const res = await apiClient.updateApprovalRules(rulesState);
      onShowToast('Approval Rules Saved', res.message);
      if (onRefreshData) onRefreshData();
      else loadApprovalData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Save Failed', msg);
    } finally {
      setIsSavingRules(false);
    }
  };

  // Filtered queue
  const filteredQueue = activeQueue.filter((req) => {
    if (statusFilter !== 'ALL' && req.status !== statusFilter) return false;
    if (selectedModule !== 'ALL' && req.module !== selectedModule) return false;
    if (selectedStore !== 'ALL' && selectedStore !== 'CONSOLIDATED' && req.storeId !== selectedStore) return false;
    return true;
  });

  const pendingCount = activeQueue.filter((r) => r.status === 'PENDING').length;

  const cardClass = `rounded-2xl border transition-all ${
    isLight
      ? 'bg-white border-gray-200/90 shadow-[0_4px_16px_rgba(0,0,0,0.03)]'
      : 'bg-zinc-900/90 border-zinc-800 shadow-[0_4px_16px_rgba(0,0,0,0.2)]'
  }`;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header & Sub-Nav */}
      <div className={`${cardClass} p-5 sm:p-6 space-y-6`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 flex items-center justify-center shadow-xs">
              <FileCheck2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                  Governance &amp; Controls
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-800 dark:text-indigo-300">
                  Multi-Tier Authorization Matrix
                </span>
              </div>
              <h1 className={`text-xl font-bold mt-1 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                Approval Workflow &amp; Threshold Matrix
              </h1>
              <p className={`text-xs mt-0.5 max-w-2xl ${isLight ? "text-slate-600" : "text-zinc-300"}`}>
                Configure authorization levels for Procurement Requests, Purchase Orders, Physical Stocktake Adjustments, and Waste Write-Offs with strict audit sign-offs.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSubTab('queue')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                subTab === 'queue'
                  ? 'bg-[#0F4C3A] text-white shadow-xs'
                  : isLight
                  ? 'text-gray-600 hover:bg-gray-100'
                  : 'text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Pending Queue ({pendingCount})</span>
            </button>

            <button
              onClick={() => setSubTab('rules')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                subTab === 'rules'
                  ? 'bg-[#0F4C3A] text-white shadow-xs'
                  : isLight
                  ? 'text-gray-600 hover:bg-gray-100'
                  : 'text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Matrix Rules Config</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. APPROVAL QUEUE TAB */}
      {/* ========================================================================= */}
      {subTab === 'queue' && (
        <div className={cardClass}>
          <div className={`p-5 border-b ${isLight ? 'border-gray-200 bg-gray-50/50' : 'border-zinc-800 bg-zinc-900/50'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-white'} flex items-center gap-2`}>
                  <CheckCircle2 className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
                  <span>Pending Document Approvals</span>
                </h3>
                <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-zinc-300'} mt-0.5`}>
                  Documents routed to your managerial tier for review and clearance
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={selectedModule}
                  onChange={(e) => setSelectedModule(e.target.value as any)}
                  className={`px-3 py-1.5 text-xs rounded-xl border font-semibold ${
                    isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-zinc-800 border-zinc-700 text-white'
                  }`}
                >
                  <option value="ALL">All Modules</option>
                  <option value="procurement_pr">Procurement Requests (PR)</option>
                  <option value="procurement_po">Purchase Orders (PO)</option>
                  <option value="stock_adjustment">Stock Adjustments</option>
                  <option value="waste_write_off">Waste Write-Offs</option>
                </select>

                <div className="flex items-center gap-1">
                  {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all capitalize ${
                        statusFilter === st
                          ? 'bg-[#0F4C3A] text-white shadow-xs'
                          : isLight
                          ? 'text-gray-600 hover:bg-gray-100'
                          : 'text-zinc-400 hover:bg-zinc-800'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-zinc-800">
            {filteredQueue.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-500 dark:text-zinc-300">
                No approval requests matching current criteria.
              </div>
            ) : (
              filteredQueue.map((req) => (
                <div
                  key={req.id}
                  className={`p-5 transition-colors ${
                    isLight ? 'hover:bg-gray-50/60' : 'hover:bg-zinc-800/40'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-[#0F4C3A] dark:text-emerald-400">
                          {req.documentId}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-mono">
                          {req.module.replace(/_/g, ' ').toUpperCase()}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            req.status === 'APPROVED'
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                              : req.status === 'REJECTED'
                              ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
                              : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          {req.status}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold">{req.documentTitle}</h4>
                      <p className={`text-xs ${isLight ? "text-slate-600" : "text-zinc-300"}`}>
                        Requested by <strong className="text-gray-900 dark:text-white">{req.requestedBy}</strong> at {req.storeName} ({new Date(req.requestedAt).toLocaleDateString()})
                      </p>

                      {/* Tier Step Progress Indicator */}
                      <div className="flex items-center gap-2 pt-2 text-xs">
                        <span className="font-semibold text-slate-700 dark:text-zinc-300">Authorization Step:</span>
                        <div className="flex items-center gap-1.5 font-mono">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                              req.currentTierLevel >= 1
                                ? 'bg-emerald-500 text-white'
                                : 'bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-zinc-300'
                            }`}
                          >
                            Tier 1 (Supervisor)
                          </span>
                          <ArrowRight className="w-3 h-3 text-gray-400" />
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                              req.currentTierLevel >= 2
                                ? 'bg-emerald-500 text-white'
                                : req.requiredTierLevel >= 2
                                ? 'bg-amber-500 text-zinc-950 font-black animate-pulse'
                                : 'bg-gray-200 dark:bg-zinc-700 text-gray-500 opacity-60'
                            }`}
                          >
                            Tier 2 (Branch GM)
                          </span>
                          {req.requiredTierLevel >= 3 && (
                            <>
                              <ArrowRight className="w-3 h-3 text-gray-400" />
                              <span
                                className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                  req.currentTierLevel >= 3
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-zinc-300'
                                }`}
                              >
                                Tier 3 (CFO / Director)
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* History Log */}
                      {req.history.length > 0 && (
                        <div className="pt-2 pl-3 border-l-2 border-emerald-500 text-xs space-y-1">
                          {req.history.map((h, idx) => (
                            <div key={idx} className="text-[11px] text-gray-600 dark:text-zinc-300">
                              <strong className="text-emerald-700 dark:text-emerald-400">{h.action}</strong> by {h.approverName} ({h.approverRole}): &quot;{h.comments}&quot;
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Amount & Actions */}
                    <div className="flex flex-col lg:items-end justify-between gap-3 flex-shrink-0">
                      <div className="text-left lg:text-right">
                        <span className="text-[11px] text-gray-400 block">Total Authorization Amount:</span>
                        <span className="font-mono text-base font-bold text-[#0F4C3A] dark:text-emerald-400">
                          {formatIDR(req.amountIDR)}
                        </span>
                      </div>

                      {req.status === 'PENDING' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenAction(req, 'REJECTED')}
                            className="px-3 py-1.5 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all cursor-pointer"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => handleOpenAction(req, 'APPROVED')}
                            className="px-4 py-1.5 rounded-xl bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve Tier {req.currentTierLevel}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. MATRIX RULES CONFIGURATION TAB */}
      {/* ========================================================================= */}
      {subTab === 'rules' && (
        <div className={`${cardClass} p-5 sm:p-6 space-y-6`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 border-gray-100 dark:border-zinc-800">
            <div>
              <h3 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                Authorization Threshold Matrix
              </h3>
              <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-zinc-300'} mt-0.5`}>
                Set multi-tier financial thresholds and managerial role clearances per operational domain
              </p>
            </div>

            <button
              onClick={handleSaveRules}
              disabled={isSavingRules}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSavingRules ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Approval Matrix</span>
            </button>
          </div>

          <div className="space-y-4">
            {rulesState.map((rule, idx) => (
              <div
                key={rule.id}
                className={`p-4 rounded-xl border space-y-3 ${
                  isLight ? 'bg-gray-50/70 border-gray-200' : 'bg-zinc-800/60 border-zinc-700'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#0F4C3A] text-white">
                      Tier {rule.tierLevel}
                    </span>
                    <span className="font-bold text-xs">{rule.tierName}</span>
                    <span className="text-[11px] text-gray-500">({rule.module.replace(/_/g, ' ')})</span>
                  </div>

                  <span className="text-xs font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                    Threshold: {formatIDR(rule.minThresholdIDR)} {rule.maxThresholdIDR ? `- ${formatIDR(rule.maxThresholdIDR)}` : 'and above'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-200 mb-1">Required Approver Role</label>
                    <select
                      value={rule.requiredRole}
                      onChange={(e) => {
                        const copy = [...rulesState];
                        copy[idx].requiredRole = e.target.value;
                        setRulesState(copy);
                      }}
                      className={`w-full px-2.5 py-1.5 rounded-lg border text-xs ${
                        isLight ? 'bg-white border-gray-300' : 'bg-zinc-800 border-zinc-600'
                      }`}
                    >
                      <option value="store_manager">Store Manager / Supervisor</option>
                      <option value="admin">Supply Chain VP / Admin</option>
                      <option value="auditor">Inventory QA Auditor</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-200 mb-1">Min Threshold (IDR)</label>
                    <input
                      type="number"
                      value={rule.minThresholdIDR}
                      onChange={(e) => {
                        const copy = [...rulesState];
                        copy[idx].minThresholdIDR = Number(e.target.value);
                        setRulesState(copy);
                      }}
                      className={`w-full px-2.5 py-1.5 rounded-lg border font-mono text-xs ${
                        isLight ? 'bg-white border-gray-300' : 'bg-zinc-800 border-zinc-600'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-200 mb-1">Manager PIN Clearance</label>
                    <div className="flex items-center gap-2 pt-1.5">
                      <input
                        type="checkbox"
                        checked={rule.requiresPin}
                        onChange={(e) => {
                          const copy = [...rulesState];
                          copy[idx].requiresPin = e.target.checked;
                          setRulesState(copy);
                        }}
                        className="rounded"
                      />
                      <span className="text-xs">Require Manager PIN Verification</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Confirmation Modal */}
      {activeActionRequest && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md p-6 rounded-2xl border shadow-2xl space-y-4 ${
              isLight ? 'bg-white border-gray-200 text-gray-900' : 'bg-zinc-900 border-zinc-800 text-white'
            }`}
          >
            <div className="flex items-center gap-2 border-b pb-3">
              {actionType === 'APPROVED' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-600" />
              )}
              <h3 className="font-bold text-base">
                Confirm {actionType === 'APPROVED' ? 'Approval' : 'Rejection'}
              </h3>
            </div>

            <p className="text-xs text-gray-600 dark:text-zinc-300">
              You are about to execute <strong>{actionType}</strong> on{' '}
              <strong className="font-mono text-[#0F4C3A] dark:text-emerald-400">
                {activeActionRequest.documentId}
              </strong>{' '}
              ({formatIDR(activeActionRequest.amountIDR)}).
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-200 mb-1">Approval Review Commentary</label>
              <textarea
                rows={3}
                value={actionComment}
                onChange={(e) => setActionComment(e.target.value)}
                className={`w-full px-3 py-2 text-xs rounded-xl border ${
                  isLight ? 'bg-white border-gray-300' : 'bg-zinc-800 border-zinc-700'
                }`}
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                onClick={() => setActiveActionRequest(null)}
                className="px-4 py-2 rounded-xl border text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteAction}
                disabled={isProcessing}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-50 ${
                  actionType === 'APPROVED' ? 'bg-[#0F4C3A] hover:bg-[#0b382b]' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {isProcessing ? 'Processing...' : `Confirm ${actionType}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
