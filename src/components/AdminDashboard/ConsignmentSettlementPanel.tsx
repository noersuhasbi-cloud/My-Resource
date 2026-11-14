import React, { useEffect, useState } from 'react';
import { CheckCircle2, FileCheck2, Handshake, RefreshCw, RotateCcw } from 'lucide-react';
import type { ConsignmentLedgerEntry, InventoryBatch } from '../../types/index.ts';
import { apiClient } from '../../services/apiClient';
import { formatIDR } from '../../utils/formatters';

interface ConsignmentSettlementPanelProps {
  theme: 'light' | 'dark';
  selectedStore: string;
  onSettled?: () => void;
  onShowToast?: (title: string, message: string) => void;
}

export const ConsignmentSettlementPanel: React.FC<ConsignmentSettlementPanelProps> = ({
  theme,
  selectedStore,
  onSettled,
  onShowToast,
}) => {
  const isLight = theme === 'light';
  const [loading, setLoading] = useState(true);
  const [settlingSupplier, setSettlingSupplier] = useState<string | null>(null);
  const [returningBatchId, setReturningBatchId] = useState<string | null>(null);
  const [data, setData] = useState<{
    summary: {
      unsettledPayableIDR: number;
      settledTotalIDR: number;
      totalStoreCommissionIDR: number;
      totalUnsoldUnits: number;
      activeBatchesCount: number;
    };
    suppliers: string[];
    activeStock: InventoryBatch[];
    salesLedger: ConsignmentLedgerEntry[];
  }>({
    summary: {
      unsettledPayableIDR: 0,
      settledTotalIDR: 0,
      totalStoreCommissionIDR: 0,
      totalUnsoldUnits: 0,
      activeBatchesCount: 0,
    },
    suppliers: [],
    activeStock: [],
    salesLedger: [],
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiClient.getConsignmentDashboard(selectedStore);
      setData(res);
    } catch (err: any) {
      onShowToast?.('Consignment Load Failed', err?.message || 'Unable to load consignment ledger.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedStore]);

  const handleSettleSupplier = async (supplierName: string) => {
    setSettlingSupplier(supplierName);
    try {
      const res = await apiClient.settleConsignmentSupplier({ supplierName });
      onShowToast?.('Consignment Settled to Vendor Bill', res.message);
      await loadData();
      onSettled?.();
    } catch (err: any) {
      onShowToast?.('Settlement Failed', err?.message || 'Could not settle supplier consignment.');
    } finally {
      setSettlingSupplier(null);
    }
  };

  const handleReturnUnsold = async (batch: InventoryBatch) => {
    setReturningBatchId(batch.batchId);
    try {
      const res = await apiClient.returnConsignmentStockRtv({
        batchId: batch.batchId,
        quantity: batch.currentStock,
        reason: 'Unsold Titip Jual Return to UMKM Partner',
      });
      onShowToast?.('Consignment RTV Returned', res.message);
      await loadData();
      onSettled?.();
    } catch (err: any) {
      onShowToast?.('RTV Return Failed', err?.message || 'Could not return unsold stock.');
    } finally {
      setReturningBatchId(null);
    }
  };

  const unsettledBySupplier = data.suppliers
    .map((sup) => {
      const rows = data.salesLedger.filter((l) => l.supplierName === sup && l.status === 'UNSETTLED');
      return {
        supplierName: sup,
        count: rows.length,
        payableIDR: rows.reduce((s, r) => s + r.payableToVendorIDR, 0),
      };
    })
    .filter((s) => s.count > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Handshake className="w-4 h-4 text-emerald-500" />
            <span>Consignment (Titip Jual UMKM) Stock &amp; Sales-Based Settlement</span>
          </h3>
          <p className={`text-xs ${isLight ? 'text-stone-500' : 'text-zinc-400'}`}>
            Zero balance-sheet #1040/#2010 posting on receipt; Payable (#2015) accrues only when sold at POS/B2B and clears into Vendor Bills (#2010).
          </p>
        </div>
        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
            isLight ? 'border-stone-300 bg-white hover:bg-stone-50' : 'border-zinc-700 bg-zinc-900 hover:bg-zinc-800'
          }`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-white border-stone-200' : 'bg-zinc-900/70 border-zinc-800'}`}>
          <div className="text-[11px] opacity-70">Unsettled Payable (#2015)</div>
          <div className="text-base font-black font-mono text-amber-500 mt-0.5">
            {formatIDR(data.summary.unsettledPayableIDR)}
          </div>
        </div>
        <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-white border-stone-200' : 'bg-zinc-900/70 border-zinc-800'}`}>
          <div className="text-[11px] opacity-70">Store Margin Earned</div>
          <div className="text-base font-black font-mono text-emerald-500 mt-0.5">
            {formatIDR(data.summary.totalStoreCommissionIDR)}
          </div>
        </div>
        <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-white border-stone-200' : 'bg-zinc-900/70 border-zinc-800'}`}>
          <div className="text-[11px] opacity-70">Settled to Vendor Bills</div>
          <div className="text-base font-black font-mono mt-0.5">
            {formatIDR(data.summary.settledTotalIDR)}
          </div>
        </div>
        <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-white border-stone-200' : 'bg-zinc-900/70 border-zinc-800'}`}>
          <div className="text-[11px] opacity-70">Unsold Consignment Stock</div>
          <div className="text-base font-black font-mono mt-0.5">
            {data.summary.totalUnsoldUnits} u ({data.summary.activeBatchesCount} lots)
          </div>
        </div>
      </div>

      {/* Pending Settlements by Supplier */}
      {unsettledBySupplier.length > 0 && (
        <div className={`p-4 rounded-2xl border space-y-2 ${isLight ? 'bg-amber-50/70 border-amber-200' : 'bg-amber-500/5 border-amber-500/20'}`}>
          <div className="text-xs font-bold text-amber-600 dark:text-amber-400">
            Ready for Period-End Vendor Bill Settlement (DR 2015 / CR 2010)
          </div>
          <div className="flex flex-wrap gap-2">
            {unsettledBySupplier.map((sup) => (
              <button
                key={sup.supplierName}
                type="button"
                disabled={settlingSupplier === sup.supplierName}
                onClick={() => handleSettleSupplier(sup.supplierName)}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>
                  {settlingSupplier === sup.supplierName
                    ? 'Settling...'
                    : `Settle ${sup.supplierName} (${sup.count} sales • ${formatIDR(sup.payableIDR)})`}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active Unsold Consignment Batches */}
      <div className={`rounded-2xl border overflow-hidden ${isLight ? 'bg-white border-stone-200' : 'bg-zinc-900/70 border-zinc-800'}`}>
        <div className={`px-4 py-2.5 border-b text-xs font-bold ${isLight ? 'bg-stone-50 border-stone-200' : 'bg-zinc-950 border-zinc-800'}`}>
          Active Titip Jual Shelf Holdings ({data.activeStock.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className={isLight ? 'bg-stone-50 text-stone-500' : 'bg-zinc-950/60 text-zinc-400'}>
              <tr>
                <th className="px-3 py-2">SKU / Product</th>
                <th className="px-3 py-2">UMKM Partner</th>
                <th className="px-3 py-2">Outlet / Lot</th>
                <th className="px-3 py-2 text-right">Unsold Qty</th>
                <th className="px-3 py-2 text-right">Comm %</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200/60 dark:divide-zinc-800">
              {data.activeStock.map((b) => (
                <tr key={b.batchId}>
                  <td className="px-3 py-2">
                    <div className="font-semibold">{b.productName}</div>
                    <div className="font-mono text-[10px] opacity-70">{b.sku}</div>
                  </td>
                  <td className="px-3 py-2">{b.consignmentSupplier || b.supplierName}</td>
                  <td className="px-3 py-2 font-mono text-[11px]">
                    {b.storeName} • {b.lotNumber}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-bold">{b.currentStock}</td>
                  <td className="px-3 py-2 text-right font-mono">{b.consignmentCommissionPercent ?? 20}%</td>
                  <td className="px-3 py-2 text-right">
                    {b.currentStock > 0 ? (
                      <button
                        type="button"
                        disabled={returningBatchId === b.batchId}
                        onClick={() => handleReturnUnsold(b)}
                        className="px-2.5 py-1 rounded-lg border border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>{returningBatchId === b.batchId ? 'Returning...' : 'Return Unsold (RTV)'}</span>
                      </button>
                    ) : (
                      <span className="text-[11px] opacity-50">Depleted</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Consignment Sales Ledger */}
      <div className={`rounded-2xl border overflow-hidden ${isLight ? 'bg-white border-stone-200' : 'bg-zinc-900/70 border-zinc-800'}`}>
        <div className={`px-4 py-2.5 border-b text-xs font-bold ${isLight ? 'bg-stone-50 border-stone-200' : 'bg-zinc-950 border-zinc-800'}`}>
          Sold Consignment Ledger ({data.salesLedger.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className={isLight ? 'bg-stone-50 text-stone-500' : 'bg-zinc-950/60 text-zinc-400'}>
              <tr>
                <th className="px-3 py-2">Ref # / Channel</th>
                <th className="px-3 py-2">Product / Partner</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Gross Sales</th>
                <th className="px-3 py-2 text-right">Store Margin</th>
                <th className="px-3 py-2 text-right">Vendor Payable</th>
                <th className="px-3 py-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200/60 dark:divide-zinc-800">
              {data.salesLedger.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center opacity-60">
                    No Titip Jual sales logged yet. Sell SKU-CSG-001 or SKU-CSG-002 at POS or B2B to accrue #2015 payables.
                  </td>
                </tr>
              ) : (
                data.salesLedger.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2 font-mono">
                      <div className="font-bold">{row.referenceId}</div>
                      <div className="text-[10px] opacity-70">{row.channel} • {row.storeName}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-semibold">{row.productName}</div>
                      <div className="text-[10px] opacity-70">{row.supplierName}</div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{row.quantitySold}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatIDR(row.grossSalesIDR)}</td>
                    <td className="px-3 py-2 text-right font-mono text-emerald-500">{formatIDR(row.storeMarginIDR)}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold">{formatIDR(row.payableToVendorIDR)}</td>
                    <td className="px-3 py-2 text-right">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          row.status === 'SETTLED'
                            ? 'bg-emerald-500/15 text-emerald-500'
                            : 'bg-amber-500/15 text-amber-500'
                        }`}
                      >
                        {row.status === 'SETTLED' && <CheckCircle2 className="w-3 h-3" />}
                        <span>{row.status === 'SETTLED' ? `SETTLED (${row.vendorBillId || ''})` : 'UNSETTLED'}</span>
                      </span>
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
