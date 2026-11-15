import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRightLeft,
  Check,
  Copy,
  MapPin,
  Sparkles,
  Tag,
  X,
  Zap,
} from 'lucide-react';
import type {
  InventoryBatch,
  InventoryItem,
  WarehouseRackConfig,
} from '../../types/index.ts';
import { apiClient } from '../../services/apiClient';
import { formatIDR } from '../../utils/formatters';

interface FlashSaleClearanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
  batch: InventoryBatch | null;
  inventory?: InventoryItem[];
  racks?: WarehouseRackConfig[];
  onCompleted: () => Promise<void> | void;
  onShowToast: (title: string, message: string) => void;
}

const mapBatchZone = (
  zone: InventoryBatch['storageZone']
): WarehouseRackConfig['storageZone'] => {
  if (zone === 'cold_chilled') return 'Chilled Walk-In (2°C–4°C)';
  if (zone === 'freezer') return 'Deep Freeze (-20°C)';
  return 'Ambient Dry';
};

export const FlashSaleClearanceModal: React.FC<FlashSaleClearanceModalProps> = ({
  isOpen,
  onClose,
  theme,
  batch,
  inventory = [],
  racks = [],
  onCompleted,
  onShowToast,
}) => {
  const isLight = theme === 'light';
  const [rotateToFrontRack, setRotateToFrontRack] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [copiedPromo, setCopiedPromo] = useState<boolean>(false);

  if (!isOpen || !batch || typeof document === 'undefined') return null;

  const normalPrice = batch.sellingPrice || Math.round(batch.unitCost * 1.35);
  const flashSalePrice = Math.round(normalPrice * 0.5);
  const potentialRecovery = Math.round(flashSalePrice * batch.currentStock);
  const promoCode = `KILAT50-${batch.sku.replace(/[^A-Z0-9]/g, '').slice(-4)}-${batch.batchId.slice(-3)}`;
  const isExpired = batch.daysUntilExpiry <= 0 || batch.status === 'expired';
  const countdownText =
    batch.daysUntilExpiry <= 0
      ? 'Kedaluwarsa (HACCP Guard)'
      : batch.daysUntilExpiry === 1
      ? 'Berlaku 24 Jam (H-1)'
      : `Sisa ${batch.daysUntilExpiry} Hari`;

  const handleCopyPromo = () => {
    const caption = `⚡ OBRAR KILAT 50% GROCEMART! ${batch.productName} (Lot ${batch.lotNumber}) hanya ${formatIDR(flashSalePrice)} (harga normal ${formatIDR(normalPrice)}). Kode POS: ${promoCode}. Stok terbatas ${batch.currentStock} unit!`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(caption).catch(() => {});
    }
    setCopiedPromo(true);
    window.setTimeout(() => setCopiedPromo(false), 1800);
    onShowToast('Teks Promo Disalin', 'Caption Obrar Kilat 50% siap dibagikan ke WhatsApp & display toko.');
  };

  const handleConfirmFlashSale = async () => {
    setIsProcessing(true);
    try {
      const mdRes = await apiClient.applyDynamicBatchMarkdowns([batch.batchId], 50);

      let rotationNote = '';
      if (rotateToFrontRack && !isExpired) {
        const invItem = inventory.find((i) => i.sku === batch.sku);
        const isNonHalal = invItem?.halalStatus === 'NON_HALAL';
        const targetHalalZone = isNonHalal ? 'NON_HALAL_SEGREGATED' : 'HALAL_DEDICATED';
        const desiredStorageZone = mapBatchZone(batch.storageZone);
        const storeRacks =
          racks.length > 0
            ? racks.filter((r) => r.storeId === batch.storeId)
            : (await apiClient.getWarehouseRacks(batch.storeId)).racks || [];

        const isFront = (code: string, notes?: string) =>
          /FRONT|DISP|R01|B01/i.test(code) || /front|display|primary|depan/i.test(notes || '');

        let targetRack = storeRacks.find(
          (r) =>
            r.rackBinCode !== batch.rackBinCode &&
            r.storageZone === desiredStorageZone &&
            (isNonHalal ? r.rackHalalZone === 'NON_HALAL_SEGREGATED' : r.rackHalalZone !== 'NON_HALAL_SEGREGATED') &&
            isFront(r.rackBinCode, r.notes)
        );

        if (!targetRack) {
          const prefix =
            batch.storeId.replace('store-', '').split('-').pop()?.toUpperCase().slice(0, 3) || 'STR';
          const zoneCode =
            batch.storageZone === 'cold_chilled'
              ? 'CHL'
              : batch.storageZone === 'freezer'
              ? 'FRZ'
              : 'AMB';
          const frontCode = `${prefix}-${zoneCode}-FRONT-01`;
          const existing = storeRacks.find((r) => r.rackBinCode === frontCode);
          if (existing) {
            targetRack = existing;
          } else {
            const saved = await apiClient.saveWarehouseRack({
              rackBinCode: frontCode,
              storeId: batch.storeId,
              storageZone: desiredStorageZone,
              rotationPolicy: 'STRICT_FEFO',
              maxCapacity: 250,
              rackHalalZone: targetHalalZone,
              notes: 'Rak Depan Prioritas Obrar Kilat 50% (FEFO Clearance)',
            });
            targetRack = saved.rack;
          }
        }

        if (targetRack && targetRack.rackBinCode !== batch.rackBinCode) {
          await apiClient.assignSkuBatchToRack({
            storeId: batch.storeId,
            sku: batch.sku,
            rackBinCode: targetRack.rackBinCode,
            rotationStrategy: 'FEFO',
            batchId: batch.batchId,
          });
          rotationNote = ` & dipindahkan ke Rak Depan (${targetRack.rackBinCode})`;
        } else {
          rotationNote = ` & rotasi FEFO tercatat`;
        }
      }

      if (mdRes.appliedCount > 0) {
        onShowToast(
          'Obrar Kilat 50% Aktif',
          `${batch.productName} (${batch.lotNumber}) kini ${formatIDR(flashSalePrice)} di POS${rotationNote}.`
        );
      } else {
        onShowToast('HACCP Safety Guard', mdRes.message);
      }

      await onCompleted();
      onClose();
    } catch (err: unknown) {
      onShowToast(
        'Gagal Mengaktifkan Obrar Kilat',
        err instanceof Error ? err.message : 'Terjadi kesalahan saat memperbarui harga markdown.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return createPortal(
    <div className={`${theme === 'dark' ? 'dark' : ''} fixed inset-0 z-[120] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto`}>
      <div
        className="max-w-lg w-full rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#12141C] text-slate-900 dark:text-slate-100 p-5 sm:p-6 space-y-4 shadow-2xl my-auto transition-colors animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800/80">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-[#164E29] text-white dark:bg-emerald-950/80 dark:text-emerald-300 dark:border dark:border-emerald-800/50">
                <Zap className="w-3 h-3" />
                1-Click Flash Sale Generator
              </span>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                {batch.batchId}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold mt-1 text-slate-900 dark:text-slate-100">
              Preview Poster &amp; Aktivasi Obrar Kilat 50%
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200 ease-out hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
            aria-label="Tutup modal promo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Generated Promotional Poster / Shelf Badge Preview */}
        <div className="rounded-xl border-2 border-dashed border-[#164E29]/40 dark:border-[#22C55E]/40 bg-emerald-50/70 dark:bg-emerald-950/30 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#164E29] dark:bg-[#22C55E] text-white dark:text-slate-950 text-xs font-extrabold tracking-wide">
              <Sparkles className="w-3.5 h-3.5" />
              OBRAR KILAT 50% OFF
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                isExpired
                  ? 'bg-[#FEE2E2] text-[#991B1B]'
                  : batch.daysUntilExpiry <= 2
                  ? 'bg-[#FEE2E2] text-[#991B1B]'
                  : 'bg-[#FEF3C7] text-[#92400E]'
              }`}
            >
              {countdownText}
            </span>
          </div>

          <div>
            <div className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white leading-snug">
              {batch.productName}
            </div>
            <div className="text-xs font-mono text-slate-600 dark:text-slate-300 mt-0.5">
              SKU: {batch.sku} · Lot: {batch.lotNumber} · Stok: {batch.currentStock} unit
            </div>
          </div>

          <div className="flex items-end justify-between gap-3 pt-2 border-t border-emerald-200 dark:border-emerald-800/60">
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 line-through font-mono">
                Normal: {formatIDR(normalPrice)}
              </div>
              <div className="text-2xl font-black font-mono tabular-nums text-[#164E29] dark:text-[#22C55E]">
                {formatIDR(flashSalePrice)}
              </div>
            </div>

            <div className="text-right">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Kode Promo POS
              </div>
              <div className="font-mono text-xs font-extrabold px-2.5 py-1 rounded bg-white dark:bg-[#090A0F] border border-slate-200 dark:border-slate-800/80 text-slate-900 dark:text-slate-100 mt-0.5">
                {promoCode}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300 pt-1">
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3 h-3 text-[#164E29] dark:text-[#22C55E]" />
              {batch.storeName} ({batch.rackBinCode || 'Rak Utama'})
            </span>
            <span className="font-mono font-semibold">
              Potensi Penyelamatan: {formatIDR(potentialRecovery)}
            </span>
          </div>
        </div>

        {/* Rotation Option */}
        {!isExpired && (
          <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/80 dark:bg-[#090A0F] cursor-pointer">
            <input
              type="checkbox"
              checked={rotateToFrontRack}
              onChange={(e) => setRotateToFrontRack(e.target.checked)}
              className="mt-0.5 rounded accent-[#164E29]"
            />
            <div className="text-xs">
              <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <ArrowRightLeft className="w-3.5 h-3.5 text-[#164E29] dark:text-[#22C55E]" />
                Log Rotasi &amp; Pindahkan ke Rak Depan (Display Clearance)
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Otomatis mencatat rotasi batch FEFO dan memindahkan lot ke rak display terdepan yang sesuai zona suhu &amp; Halal.
              </div>
            </div>
          </label>
        )}

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800/80">
          <button
            type="button"
            onClick={handleCopyPromo}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-800/80 bg-white dark:bg-[#090A0F] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900/90 transition-all duration-200 ease-out hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
          >
            {copiedPromo ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedPromo ? 'Tersalin!' : 'Salin Teks Promo'}</span>
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-800/80 bg-white dark:bg-[#090A0F] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/90 transition-all duration-200 ease-out hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleConfirmFlashSale}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-md shadow-amber-900/20 transition-all duration-200 ease-out hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>
                {isProcessing
                  ? 'Memproses...'
                  : isExpired
                  ? 'Verifikasi Status HACCP'
                  : 'Aktifkan Diskon POS 50% & Log Rotasi'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
