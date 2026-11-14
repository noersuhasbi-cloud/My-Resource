import React, { useMemo, useState } from 'react';
import { Layers, PackagePlus, RefreshCw, Scissors, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { InventoryBatch, StoreInventoryStock, WarehouseRackConfig } from '../../types/index.ts';
import { apiClient } from '../../services/apiClient';
import { formatIDR } from '../../utils/formatters';

interface RepackBundlePanelProps {
  theme: 'light' | 'dark';
  selectedStore: string;
  inventoryTiers: StoreInventoryStock[];
  batches: InventoryBatch[];
  racks: WarehouseRackConfig[];
  onCompleted: () => void;
  onShowToast?: (title: string, message: string) => void;
}

export const RepackBundlePanel: React.FC<RepackBundlePanelProps> = ({
  theme,
  selectedStore,
  inventoryTiers,
  batches,
  racks,
  onCompleted,
  onShowToast,
}) => {
  const isLight = theme === 'light';
  const effectiveStoreId =
    selectedStore && selectedStore !== 'ALL' && selectedStore !== 'CONSOLIDATED'
      ? selectedStore
      : 'store-jkt-senopati';

  const [mode, setMode] = useState<'REPACK' | 'BUNDLE'>('REPACK');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const storeTiers = useMemo(
    () => inventoryTiers.filter((t) => t.storeId === effectiveStoreId && t.availableStock > 0),
    [inventoryTiers, effectiveStoreId]
  );

  const storeRacks = useMemo(
    () => racks.filter((r) => r.storeId === effectiveStoreId && r.storageZone !== 'Quarantine Hold Cage'),
    [racks, effectiveStoreId]
  );

  // REPACK state
  const [sourceSku, setSourceSku] = useState<string>(() => storeTiers[0]?.sku || 'SKU-PRD-001');
  const [sourceQty, setSourceQty] = useState<number>(1);
  const [targetSku, setTargetSku] = useState<string>('SKU-RPK-001');
  const [targetName, setTargetName] = useState<string>('Retail Fresh Repack Pack');
  const [targetUnit, setTargetUnit] = useState<string>('pack');
  const [targetQtyProduced, setTargetQtyProduced] = useState<number>(10);
  const [targetSellingPriceIDR, setTargetSellingPriceIDR] = useState<number>(18000);
  const [packagingFeeIDR, setPackagingFeeIDR] = useState<number>(0);
  const [targetRackBinCode, setTargetRackBinCode] = useState<string>('');

  // BUNDLE state
  const [bundleSku, setBundleSku] = useState<string>('SKU-BND-HMP01');
  const [bundleName, setBundleName] = useState<string>('Fresh Healthy Breakfast Hamper');
  const [bundleQty, setBundleQty] = useState<number>(2);
  const [bundleSellingPriceIDR, setBundleSellingPriceIDR] = useState<number>(145000);
  const [bundleRackBinCode, setBundleRackBinCode] = useState<string>('');
  const [components, setComponents] = useState<Array<{ sku: string; qtyPerBundle: number }>>(() => [
    { sku: storeTiers[0]?.sku || 'SKU-PRD-001', qtyPerBundle: 1 },
    { sku: storeTiers[1]?.sku || storeTiers[0]?.sku || 'SKU-DAI-001', qtyPerBundle: 1 },
  ]);

  const activeSourceTier = storeTiers.find((t) => t.sku === sourceSku);
  const sourceBatches = useMemo(
    () =>
      batches.filter(
        (b) =>
          b.sku === sourceSku &&
          b.storeId === effectiveStoreId &&
          b.currentStock > 0 &&
          b.status !== 'quarantined' &&
          b.status !== 'recalled' &&
          b.status !== 'expired'
      ),
    [batches, sourceSku, effectiveStoreId]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const res =
        mode === 'REPACK'
          ? await apiClient.executeRepackOrBundle({
              mode: 'REPACK',
              storeId: effectiveStoreId,
              sourceSku,
              sourceQty,
              targetSku,
              targetName,
              targetUnit,
              targetQtyProduced,
              targetSellingPriceIDR,
              packagingFeeIDR,
              targetRackBinCode: targetRackBinCode || undefined,
            })
          : await apiClient.executeRepackOrBundle({
              mode: 'BUNDLE',
              storeId: effectiveStoreId,
              bundleSku,
              bundleName,
              bundleQty,
              bundleSellingPriceIDR,
              bundleRackBinCode: bundleRackBinCode || undefined,
              components,
            });
      setFeedback({ type: 'ok', text: res.message });
      onShowToast?.(mode === 'REPACK' ? 'Repack Completed' : 'Bundle Assembled', res.message);
      onCompleted();
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'Operation failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = `w-full px-3 py-2 rounded-xl border text-xs ${
    isLight ? 'bg-white border-stone-300 text-stone-900' : 'bg-zinc-950 border-zinc-700 text-zinc-100'
  }`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-500" />
            <span>Warehouse Repacking (Break-Bulk) &amp; Bundle Assembly</span>
          </h3>
          <p className={`text-xs ${isLight ? 'text-stone-500' : 'text-zinc-400'}`}>
            Converts bulk SKUs into retail packs or assembles hampers while inheriting parent/earliest expiry dates and posting balanced #1040 GL.
          </p>
        </div>

        <div className={`inline-flex rounded-xl border p-1 ${isLight ? 'bg-stone-100 border-stone-200' : 'bg-zinc-950 border-zinc-800'}`}>
          <button
            type="button"
            onClick={() => setMode('REPACK')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
              mode === 'REPACK'
                ? 'bg-emerald-600 text-white'
                : isLight
                ? 'text-stone-600 hover:bg-white'
                : 'text-zinc-400 hover:bg-zinc-900'
            }`}
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Break-Bulk Repack</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('BUNDLE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
              mode === 'BUNDLE'
                ? 'bg-emerald-600 text-white'
                : isLight
                ? 'text-stone-600 hover:bg-white'
                : 'text-zinc-400 hover:bg-zinc-900'
            }`}
          >
            <PackagePlus className="w-3.5 h-3.5" />
            <span>Hamper / Bundle</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
            feedback.type === 'ok'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
          }`}
        >
          {feedback.type === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span>{feedback.text}</span>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className={`p-4 rounded-2xl border space-y-4 ${
          isLight ? 'bg-white border-stone-200' : 'bg-zinc-900/70 border-zinc-800'
        }`}
      >
        {mode === 'REPACK' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold mb-1">Source Bulk SKU ({effectiveStoreId})</label>
              <select
                value={sourceSku}
                onChange={(e) => setSourceSku(e.target.value)}
                className={inputCls}
              >
                {storeTiers.map((t) => (
                  <option key={t.id} value={t.sku}>
                    {t.sku} — {t.productName} (ATP: {t.availableStock} {t.unit})
                  </option>
                ))}
              </select>
              {activeSourceTier && (
                <p className="text-[10px] opacity-70 mt-1 font-mono">
                  Cost {formatIDR(activeSourceTier.unitCost)}/{activeSourceTier.unit} • Nearest Lot Exp:{' '}
                  {sourceBatches[0]?.expiryDate?.slice(0, 10) || 'Auto'}
                </p>
              )}
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1">Source Qty Consumed</label>
              <input
                type="number"
                min={0.1}
                step="0.1"
                value={sourceQty}
                onChange={(e) => setSourceQty(Number(e.target.value))}
                className={inputCls}
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1">Packaging Cost Added (IDR)</label>
              <input
                type="number"
                min={0}
                value={packagingFeeIDR}
                onChange={(e) => setPackagingFeeIDR(Number(e.target.value))}
                className={inputCls}
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold mb-1">Target Retail SKU</label>
              <input
                type="text"
                value={targetSku}
                onChange={(e) => setTargetSku(e.target.value)}
                className={`${inputCls} font-mono`}
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1">Target Retail Product Name</label>
              <input
                type="text"
                value={targetName}
                onChange={(e) => setTargetName(e.target.value)}
                className={inputCls}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold mb-1">Qty Produced</label>
                <input
                  type="number"
                  min={1}
                  value={targetQtyProduced}
                  onChange={(e) => setTargetQtyProduced(Number(e.target.value))}
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1">Unit</label>
                <input
                  type="text"
                  value={targetUnit}
                  onChange={(e) => setTargetUnit(e.target.value)}
                  className={inputCls}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold mb-1">Retail Selling Price (IDR)</label>
              <input
                type="number"
                min={100}
                value={targetSellingPriceIDR}
                onChange={(e) => setTargetSellingPriceIDR(Number(e.target.value))}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1">Destination Rack / Bin (Optional Auto)</label>
              <select
                value={targetRackBinCode}
                onChange={(e) => setTargetRackBinCode(e.target.value)}
                className={inputCls}
              >
                <option value="">Auto-Slot via Directed Putaway</option>
                {storeRacks.map((r) => (
                  <option key={r.id} value={r.rackBinCode}>
                    {r.rackBinCode} ({r.storageZone})
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold mb-1">Bundle SKU</label>
                <input
                  type="text"
                  value={bundleSku}
                  onChange={(e) => setBundleSku(e.target.value)}
                  className={`${inputCls} font-mono`}
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[11px] font-semibold mb-1">Bundle / Hamper Name</label>
                <input
                  type="text"
                  value={bundleName}
                  onChange={(e) => setBundleName(e.target.value)}
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1">Bundles to Assemble</label>
                <input
                  type="number"
                  min={1}
                  value={bundleQty}
                  onChange={(e) => setBundleQty(Number(e.target.value))}
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1">Bundle Selling Price (IDR)</label>
                <input
                  type="number"
                  min={100}
                  value={bundleSellingPriceIDR}
                  onChange={(e) => setBundleSellingPriceIDR(Number(e.target.value))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1">Target Rack / Bin</label>
                <select
                  value={bundleRackBinCode}
                  onChange={(e) => setBundleRackBinCode(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Auto-Slot via Directed Putaway</option>
                  {storeRacks.map((r) => (
                    <option key={r.id} value={r.rackBinCode}>
                      {r.rackBinCode} ({r.storageZone})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">Component BOM (Min 2 SKUs)</span>
                <button
                  type="button"
                  onClick={() =>
                    setComponents((prev) => [
                      ...prev,
                      { sku: storeTiers[0]?.sku || 'SKU-PRD-001', qtyPerBundle: 1 },
                    ])
                  }
                  className="text-xs font-bold text-emerald-500 hover:underline cursor-pointer"
                >
                  + Add Component
                </button>
              </div>
              {components.map((comp, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-8">
                    <select
                      value={comp.sku}
                      onChange={(e) => {
                        const next = [...components];
                        next[idx].sku = e.target.value;
                        setComponents(next);
                      }}
                      className={inputCls}
                    >
                      {storeTiers.map((t) => (
                        <option key={t.id} value={t.sku}>
                          {t.sku} — {t.productName} (ATP: {t.availableStock} {t.unit})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <input
                      type="number"
                      min={0.1}
                      step="0.1"
                      value={comp.qtyPerBundle}
                      onChange={(e) => {
                        const next = [...components];
                        next[idx].qtyPerBundle = Number(e.target.value);
                        setComponents(next);
                      }}
                      className={inputCls}
                      placeholder="Qty/bundle"
                    />
                  </div>
                  <div className="col-span-1 text-right">
                    {components.length > 2 && (
                      <button
                        type="button"
                        onClick={() => setComponents(components.filter((_, i) => i !== idx))}
                        className="text-xs text-rose-500 font-bold cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
          >
            {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>{mode === 'REPACK' ? 'Execute Break-Bulk Repack' : 'Assemble Bundle & Mint Batch'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
