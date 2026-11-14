import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Barcode,
  CheckCircle2,
  Copy,
  Printer,
  Scale,
  ShieldCheck,
  Tag,
  X,
} from 'lucide-react';
import { formatIDR } from '../../utils/formatters';
import {
  derivePlu5FromSku,
  encodeEan13Bars,
  generateVariableWeightEan13,
} from '../../utils/indonesianCompliance';
import { usePrint } from '../../context/PrintContext';

export interface LabelableProductItem {
  sku: string;
  productName: string;
  category: string;
  unit: string;
  sellingPrice: number;
  pricePerKg?: number;
  isWeighted?: boolean;
  promoValidityText?: string;
}

interface BarcodeShelfLabelModalProps {
  theme: 'light' | 'dark';
  isOpen: boolean;
  onClose: () => void;
  products: LabelableProductItem[];
  initialSku?: string;
  onTestScanToPos?: (ean13Barcode: string) => void;
  onShowToast: (title: string, message: string) => void;
}

export const BarcodeShelfLabelModal: React.FC<BarcodeShelfLabelModalProps> = ({
  theme,
  isOpen,
  onClose,
  products,
  initialSku,
  onTestScanToPos,
  onShowToast,
}) => {
  const isLight = theme === 'light';
  const { triggerPrint } = usePrint();
  const [selectedSku, setSelectedSku] = useState<string>(
    initialSku || products[0]?.sku || 'SKU-PRD-005'
  );
  const [prefix, setPrefix] = useState<'21' | '20'>('21');
  const [weightGrams, setWeightGrams] = useState<number>(1985);
  const [isHalalCertified, setIsHalalCertified] = useState<boolean>(true);
  const [promoText, setPromoText] = useState<string>('Tebus Murah s/d 30 Nov 2026');
  const [taxInclusiveDisplay, setTaxInclusiveDisplay] = useState<boolean>(true);
  const [labelMode, setLabelMode] = useState<'BOTH' | 'SCALE_ONLY' | 'SHELF_ONLY'>('BOTH');

  useEffect(() => {
    if (isOpen && initialSku) {
      setSelectedSku(initialSku);
    }
  }, [isOpen, initialSku]);

  const activeProduct = useMemo(() => {
    return (
      products.find((p) => p.sku === selectedSku) ||
      products[0] || {
        sku: 'SKU-PRD-005',
        productName: 'Hass Organic Avocados (Pack)',
        category: 'produce',
        unit: 'kg',
        sellingPrice: 38500,
        pricePerKg: 77000,
        isWeighted: true,
      }
    );
  }, [products, selectedSku]);

  const plu5 = useMemo(() => derivePlu5FromSku(activeProduct.sku), [activeProduct.sku]);

  const ean13Code = useMemo(
    () => generateVariableWeightEan13(plu5, weightGrams, prefix),
    [plu5, weightGrams, prefix]
  );

  const barBits = useMemo(() => encodeEan13Bars(ean13Code), [ean13Code]);

  const effectivePricePerKg =
    activeProduct.pricePerKg ||
    (activeProduct.unit.toLowerCase().includes('kg') ? activeProduct.sellingPrice : activeProduct.sellingPrice * 4);
  const computedWeighedPrice = Math.round(effectivePricePerKg * (weightGrams / 1000));
  const shelfRetailPrice = taxInclusiveDisplay
    ? activeProduct.sellingPrice
    : Math.round(activeProduct.sellingPrice * 1.11);
  const pricePer100g = Math.round(effectivePricePerKg / 10);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-4xl rounded-2xl border p-5 sm:p-6 shadow-2xl space-y-5 my-auto relative max-h-[calc(100vh-2rem)] overflow-y-auto ${
          isLight
            ? 'bg-white border-gray-200 text-slate-900'
            : 'bg-zinc-900 border-zinc-800 text-zinc-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-3.5 border-b border-gray-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-[#0F4C3A] dark:text-emerald-400">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Permendag RI &amp; GS1 EAN-13 Variable Weight
              </span>
              <h3 className="text-base sm:text-lg font-bold">
                Bulk Scale Barcode Generator &amp; Printable Shelf-Edge Labels
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-zinc-400 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Controls (5 cols) */}
          <div className="lg:col-span-5 space-y-4 text-xs">
            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-zinc-200">
                Select Product / Bulk SKU
              </label>
              <select
                value={activeProduct.sku}
                onChange={(e) => setSelectedSku(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border font-medium ${
                  isLight
                    ? 'bg-white border-gray-300 text-slate-900'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-100'
                }`}
              >
                {products.map((p) => (
                  <option key={p.sku} value={p.sku}>
                    {p.sku} · {p.productName}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-zinc-200">
                  EAN-13 Prefix
                </label>
                <select
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value as '21' | '20')}
                  className={`w-full px-3 py-2 rounded-xl border font-mono font-bold ${
                    isLight
                      ? 'bg-white border-gray-300 text-slate-900'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-100'
                  }`}
                >
                  <option value="21">21 (Fresh Weight Standard)</option>
                  <option value="20">20 (In-Store Variable)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-zinc-200">
                  Net Weight (Grams)
                </label>
                <input
                  type="number"
                  min={50}
                  max={99999}
                  value={weightGrams}
                  onChange={(e) => setWeightGrams(Math.max(1, Math.min(99999, Number(e.target.value) || 1)))}
                  className={`w-full px-3 py-2 rounded-xl border font-mono font-bold ${
                    isLight
                      ? 'bg-white border-gray-300 text-slate-900'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-100'
                  }`}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[250, 500, 1000, 1450, 1985, 2500].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setWeightGrams(g)}
                  className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-semibold border cursor-pointer transition-colors ${
                    weightGrams === g
                      ? 'bg-[#0F4C3A] text-white border-[#0F4C3A]'
                      : isLight
                      ? 'bg-gray-50 border-gray-200 text-slate-700 hover:bg-gray-100'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  {g >= 1000 ? `${(g / 1000).toFixed(2)}kg` : `${g}g`}
                </button>
              ))}
            </div>

            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-zinc-200">
                Promo / Tebus Murah Validity Period
              </label>
              <input
                type="text"
                value={promoText}
                onChange={(e) => setPromoText(e.target.value)}
                placeholder="e.g. Tebus Murah s/d 30 Nov 2026"
                className={`w-full px-3 py-2 rounded-xl border ${
                  isLight
                    ? 'bg-white border-gray-300 text-slate-900'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-100'
                }`}
              />
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isHalalCertified}
                  onChange={(e) => setIsHalalCertified(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#0F4C3A]"
                />
                <span className="font-semibold">Halal MUI / BPJPH Badge</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={taxInclusiveDisplay}
                  onChange={(e) => setTaxInclusiveDisplay(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#0F4C3A]"
                />
                <span className="font-semibold">Price Includes PPN</span>
              </label>
            </div>

            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-zinc-200">
                Label Output Scope
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: 'BOTH', label: 'Both Labels' },
                    { id: 'SCALE_ONLY', label: 'Scale Sticker' },
                    { id: 'SHELF_ONLY', label: 'Shelf-Edge Tag' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setLabelMode(opt.id)}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border cursor-pointer ${
                      labelMode === opt.id
                        ? 'bg-[#0F4C3A] text-white border-[#0F4C3A]'
                        : isLight
                        ? 'bg-gray-50 border-gray-200 text-slate-700'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Barcode Structure Breakdown */}
            <div
              className={`p-3 rounded-xl border font-mono text-[11px] space-y-1.5 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-zinc-800/60 border-zinc-700'
              }`}
            >
              <div className="font-sans font-bold text-xs flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>EAN-13 [2][5][5][1] Bit Structure</span>
              </div>
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-700 dark:text-blue-300 font-bold">
                  Prefix: {ean13Code.slice(0, 2)}
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold">
                  PLU5: {ean13Code.slice(2, 7)}
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold">
                  Grams: {ean13Code.slice(7, 12)}
                </span>
                <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-700 dark:text-purple-300 font-bold">
                  Check: {ean13Code.slice(12, 13)}
                </span>
              </div>
            </div>
          </div>

          {/* Right Live Printable Previews (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* 1. Thermal Variable-Weight Scale Sticker */}
            {(labelMode === 'BOTH' || labelMode === 'SCALE_ONLY') && (
              <div className="rounded-xl border border-dashed border-slate-300 dark:border-zinc-700 p-4 bg-white text-slate-900 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block">
                      THERMAL SCALE STICKER · 58mm x 40mm
                    </span>
                    <h4 className="text-sm font-extrabold text-slate-900">{activeProduct.productName}</h4>
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-[10px] text-slate-500 block">PLU {plu5}</span>
                    <span className="text-xs font-bold text-emerald-700">{activeProduct.sku}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 py-1 text-center font-mono bg-slate-50 rounded-lg border border-slate-200 p-2">
                  <div>
                    <span className="text-[10px] text-slate-500 block">BERAT BERSIH</span>
                    <span className="text-sm font-black">{(weightGrams / 1000).toFixed(3)} kg</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">HARGA / KG</span>
                    <span className="text-sm font-bold">{formatIDR(effectivePricePerKg)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">TOTAL HARGA</span>
                    <span className="text-sm font-black text-emerald-700">{formatIDR(computedWeighedPrice)}</span>
                  </div>
                </div>

                {/* Crisp SVG EAN-13 Vector Barcode */}
                <div className="flex flex-col items-center pt-1">
                  <svg
                    viewBox={`0 0 ${barBits.length + 12} 44`}
                    className="w-64 h-16 bg-white"
                    role="img"
                    aria-label={`EAN-13 Barcode ${ean13Code}`}
                  >
                    <rect x="0" y="0" width={barBits.length + 12} height="44" fill="#ffffff" />
                    {barBits.split('').map((bit, idx) =>
                      bit === '1' ? (
                        <rect
                          key={idx}
                          x={idx + 6}
                          y={2}
                          width={1}
                          height={idx < 3 || (idx >= 45 && idx < 50) || idx >= 92 ? 38 : 33}
                          fill="#09090b"
                        />
                      ) : null
                    )}
                  </svg>
                  <span className="font-mono text-sm font-extrabold tracking-[0.22em] text-slate-900 mt-0.5">
                    {ean13Code}
                  </span>
                </div>
              </div>
            )}

            {/* 2. Permendag Compliant Shelf-Edge Price Tag */}
            {(labelMode === 'BOTH' || labelMode === 'SHELF_ONLY') && (
              <div className="rounded-xl border-2 border-slate-900 bg-white text-slate-900 p-4 shadow-xs space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span className="px-1.5 py-0.5 rounded bg-[#0F4C3A] text-white text-[10px] font-bold">
                        GROCEMART RETAIL
                      </span>
                      {isHalalCertified && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-extrabold">
                          <ShieldCheck className="w-3 h-3" />
                          HALAL ID BPJPH
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm sm:text-base font-black leading-tight">
                      {activeProduct.productName}
                    </h4>
                    <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                      SKU: {activeProduct.sku} · Unit: {activeProduct.unit}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-semibold uppercase text-slate-500 block">
                      {taxInclusiveDisplay ? 'Harga Jual (Termasuk PPN)' : 'Harga Jual (+ PPN)'}
                    </span>
                    <span className="text-2xl font-black font-mono tabular-nums text-[#0F4C3A]">
                      {formatIDR(shelfRetailPrice)}
                    </span>
                    <span className="text-[11px] font-mono text-slate-600 block">
                      Unit Price: {formatIDR(pricePer100g)} / 100g ({formatIDR(effectivePricePerKg)}/kg)
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-[11px]">
                  <div className="flex items-center gap-2">
                    <svg
                      viewBox={`0 0 ${barBits.length + 8} 26`}
                      className="w-32 h-8 bg-white"
                      aria-hidden="true"
                    >
                      {barBits.split('').map((bit, idx) =>
                        bit === '1' ? (
                          <rect key={idx} x={idx + 4} y={1} width={1} height={22} fill="#09090b" />
                        ) : null
                      )}
                    </svg>
                    <span className="font-mono font-bold">{ean13Code}</span>
                  </div>
                  {promoText && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold border border-amber-300">
                      <Tag className="w-3 h-3" />
                      {promoText}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(ean13Code);
                  onShowToast('Barcode Copied', `EAN-13 ${ean13Code} copied to clipboard.`);
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                  isLight
                    ? 'bg-white border-gray-300 text-slate-700 hover:bg-gray-50'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700'
                }`}
              >
                <Copy className="w-3.5 h-3.5" />
                Copy EAN-13
              </button>

              {onTestScanToPos && (
                <button
                  type="button"
                  onClick={() => {
                    onTestScanToPos(ean13Code);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Scan into Active POS Cart
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  triggerPrint({
                    type: 'barcode_shelf_label',
                    format: 'label50x30',
                    product: activeProduct,
                    ean13Code,
                    barBits,
                    plu5,
                    weightGrams,
                    effectivePricePerKg,
                    computedWeighedPrice,
                    shelfRetailPrice,
                    pricePer100g,
                    taxInclusiveDisplay,
                    isHalalCertified,
                    promoText,
                    labelMode,
                  });
                  onShowToast('Thermal Label Sent', `Printing label for ${activeProduct.productName} (${ean13Code}).`);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-bold shadow-xs cursor-pointer whitespace-nowrap shrink-0"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Thermal Labels
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
