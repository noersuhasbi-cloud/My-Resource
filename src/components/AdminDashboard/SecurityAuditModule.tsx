import React, { useState, useEffect } from 'react';
import type { SecurityAuditTrailRecord } from '../../types/index.ts';
import { apiClient } from '../../services/apiClient';
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  FileText,
  Clock,
  User,
  Building2,
  Calendar,
  Lock,
  Layers,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  FileCheck2,
} from 'lucide-react';

interface SecurityAuditModuleProps {
  theme: 'light' | 'dark';
  selectedStore: string;
  onShowToast: (title: string, message: string) => void;
}

export const SecurityAuditModule: React.FC<SecurityAuditModuleProps> = ({
  theme,
  selectedStore,
  onShowToast,
}) => {
  const [auditLogs, setAuditLogs] = useState<SecurityAuditTrailRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const isLight = theme === 'light';

  const loadAuditLogs = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.getSecurityAuditTrail(
        selectedStore === 'CONSOLIDATED' ? undefined : selectedStore,
        actionFilter === 'ALL' ? undefined : actionFilter
      );
      setAuditLogs(res);
    } catch (e) {
      console.error('Failed to load security audit trail:', e);
      onShowToast('Error', 'Failed to retrieve digital audit logs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, [selectedStore, actionFilter]);

  const filteredLogs = auditLogs.filter((log) => {
    const matchesStatus = statusFilter === 'ALL' || log.status === statusFilter;
    const matchesSearch =
      log.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.actionType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.resourceId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.metadata && JSON.stringify(log.metadata).toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'GOODS_RECEIPT_APPROVAL':
        return 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30';
      case 'PURCHASE_ORDER_APPROVAL':
        return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
      case 'PRICE_OVERRIDE':
        return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';
      case 'SHRINKAGE_WRITE_OFF':
        return 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30';
      case 'SUBSTITUTION_DISPATCH':
        return 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30';
      case 'STORE_EMERGENCY_OVERRIDE':
        return 'bg-rose-600/20 text-rose-800 dark:text-rose-200 border-rose-600/40';
      case 'ZONE_CONFIG_UPDATE':
        return 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30';
      default:
        return 'bg-gray-500/15 text-gray-700 dark:text-gray-300 border-gray-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div
        className={`p-5 sm:p-6 rounded-2xl border transition-colors ${
          isLight
            ? 'bg-gradient-to-r from-stone-50 via-white to-gray-50 border-gray-200/90 shadow-[0_4px_20px_rgba(0,0,0,0.03)]'
            : 'bg-stone-900/80 border-stone-800'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#0F4C3A] text-white tracking-wide uppercase">
                Digital Governance Trail
              </span>
              <span className={`text-xs ${isLight ? 'text-stone-500' : 'text-stone-400'}`}>
                WORM-Compliant Security Audit Log
              </span>
            </div>
            <h2 className={`text-xl sm:text-2xl font-bold tracking-tight ${isLight ? 'text-stone-900' : 'text-white'}`}>
              Security &amp; Administrative Audit Trail
            </h2>
            <p className={`text-xs sm:text-sm mt-1 max-w-3xl ${isLight ? 'text-stone-600' : 'text-stone-400'}`}>
              Every sensitive action across GroceMart ERP (PO Approval, Goods Receipt Certification, Shrinkage Write-Off,
              Customer Substitution Dispatches, and Physical Zone Access Attempts) is cryptographically stamped with
              the operator's User ID, active Shift ID, and Outlet ID.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={loadAuditLogs}
              disabled={isLoading}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                isLight
                  ? 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50 shadow-sm'
                  : 'bg-stone-800 border-stone-700 text-stone-200 hover:bg-stone-700'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh Trail
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div
          className={`p-4 rounded-xl border ${
            isLight ? 'bg-white border-gray-200 shadow-2xs' : 'bg-stone-900 border-stone-800'
          }`}
        >
          <span className="text-xs text-gray-400 font-medium">Total Logged Events</span>
          <div className="text-xl sm:text-2xl font-bold mt-1 text-gray-900 dark:text-white">
            {auditLogs.length} Records
          </div>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Immutable Append-Only
          </span>
        </div>

        <div
          className={`p-4 rounded-xl border ${
            isLight ? 'bg-white border-gray-200 shadow-2xs' : 'bg-stone-900 border-stone-800'
          }`}
        >
          <span className="text-xs text-gray-400 font-medium">Authorized Executions</span>
          <div className="text-xl sm:text-2xl font-bold mt-1 text-emerald-600">
            {auditLogs.filter((l) => l.status === 'AUTHORIZED_EXECUTED').length}
          </div>
          <span className="text-[11px] text-gray-400 mt-1 block">Validated by RBAC rules</span>
        </div>

        <div
          className={`p-4 rounded-xl border ${
            isLight ? 'bg-white border-gray-200 shadow-2xs' : 'bg-stone-900 border-stone-800'
          }`}
        >
          <span className="text-xs text-gray-400 font-medium">Permission Denied / Intercepts</span>
          <div className="text-xl sm:text-2xl font-bold mt-1 text-rose-500">
            {auditLogs.filter((l) => l.status === 'PERMISSION_DENIED').length}
          </div>
          <span className="text-[11px] text-gray-400 mt-1 block">Attempted unauthorized actions</span>
        </div>

        <div
          className={`p-4 rounded-xl border ${
            isLight ? 'bg-white border-gray-200 shadow-2xs' : 'bg-stone-900 border-stone-800'
          }`}
        >
          <span className="text-xs text-gray-400 font-medium">Active Governance Scope</span>
          <div className="text-xl sm:text-2xl font-bold mt-1 text-indigo-600 dark:text-indigo-400 truncate">
            {selectedStore === 'CONSOLIDATED' ? 'All Outlets' : selectedStore}
          </div>
          <span className="text-[11px] text-gray-400 mt-1 block">Multi-Warehouse ERP</span>
        </div>
      </div>

      {/* Audit Log Table Card */}
      <div
        className={`rounded-2xl border overflow-hidden transition-all ${
          isLight ? 'bg-white border-gray-200/90 shadow-[0_4px_20px_rgba(0,0,0,0.03)]' : 'bg-stone-900/90 border-stone-800'
        }`}
      >
        {/* Table Filters Header */}
        <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
              Chronological Security Trail
            </h3>
            <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
              Tamper-evident log with linked staff identity, shift identifier, and serialized metadata
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search audit ID, operator, action..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`pl-8 pr-3 py-1.5 rounded-xl text-xs border transition-colors ${
                  isLight
                    ? 'bg-gray-50 border-gray-200 text-gray-900 focus:bg-white'
                    : 'bg-stone-800 border-stone-700 text-stone-100'
                }`}
              />
            </div>

            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className={`px-3 py-1.5 rounded-xl text-xs border transition-colors ${
                isLight ? 'bg-gray-50 border-gray-200 text-gray-700' : 'bg-stone-800 border-stone-700 text-stone-200'
              }`}
            >
              <option value="ALL">All Action Types</option>
              <option value="GOODS_RECEIPT_APPROVAL">Goods Receipt Approval</option>
              <option value="PURCHASE_ORDER_APPROVAL">Purchase Order Approval</option>
              <option value="PRICE_OVERRIDE">Price Override</option>
              <option value="SHRINKAGE_WRITE_OFF">Shrinkage Write-Off</option>
              <option value="SUBSTITUTION_DISPATCH">Substitution Dispatch</option>
              <option value="STORE_EMERGENCY_OVERRIDE">Store Emergency Override</option>
              <option value="ZONE_CONFIG_UPDATE">Zone Config Update</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`px-3 py-1.5 rounded-xl text-xs border transition-colors ${
                isLight ? 'bg-gray-50 border-gray-200 text-gray-700' : 'bg-stone-800 border-stone-700 text-stone-200'
              }`}
            >
              <option value="ALL">All Outcomes</option>
              <option value="AUTHORIZED_EXECUTED">Authorized Executed</option>
              <option value="PERMISSION_DENIED">Permission Denied</option>
            </select>
          </div>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead
              className={`border-b ${
                isLight ? 'bg-gray-50/70 border-gray-200 text-gray-500' : 'bg-stone-800/50 border-stone-800 text-stone-400'
              }`}
            >
              <tr>
                <th className="py-3 px-4 font-semibold">Audit Record ID</th>
                <th className="py-3 px-4 font-semibold">Timestamp &amp; Shift</th>
                <th className="py-3 px-4 font-semibold">Operator / Role</th>
                <th className="py-3 px-4 font-semibold">Action Classification</th>
                <th className="py-3 px-4 font-semibold">Resource ID</th>
                <th className="py-3 px-4 font-semibold">Authorization Outcome</th>
                <th className="py-3 px-4 font-semibold">Metadata &amp; Context</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-stone-800">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">
                    No security audit logs match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    className={`transition-colors ${
                      isLight ? 'hover:bg-gray-50/80' : 'hover:bg-stone-800/40'
                    }`}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-gray-900 dark:text-white">
                      {log.id}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900 dark:text-stone-200">
                        {new Date(log.timestamp).toLocaleDateString('id-ID')}
                      </div>
                      <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {new Date(log.timestamp).toLocaleTimeString('id-ID')} • {log.shiftId}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {log.userName}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono">
                        {log.userRole.replace(/_/g, ' ')} ({log.userId})
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getActionBadge(log.actionType)}`}>
                        {log.actionType.replace(/_/g, ' ')}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono text-gray-600 dark:text-stone-300">
                      {log.resourceId}
                    </td>

                    <td className="py-3 px-4">
                      {log.status === 'AUTHORIZED_EXECUTED' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" /> Authorized
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                          <AlertTriangle className="w-3 h-3" /> Denied
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-[11px] text-gray-500 dark:text-stone-400 max-w-xs truncate">
                      {log.metadata ? (
                        <span title={JSON.stringify(log.metadata, null, 2)}>
                          {Object.entries(log.metadata)
                            .map(([k, v]) => `${k}: ${v}`)
                            .slice(0, 2)
                            .join(' | ')}
                        </span>
                      ) : (
                        '-'
                      )}
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
