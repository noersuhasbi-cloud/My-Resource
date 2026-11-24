import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import {
  AlertTriangle,
  Barcode,
  Camera,
  CameraOff,
  CheckCircle2,
  Delete,
  EyeOff,
  Flashlight,
  FlashlightOff,
  GitBranch,
  Keyboard,
  Loader2,
  PackageCheck,
  Plus,
  ScanLine,
  Volume2,
  VolumeX,
  X,
  XCircle,
} from 'lucide-react';
import { playScannerBeep } from '../utils/scannerAudio';

export interface ScannerCatalogItem {
  sku: string;
  productName: string;
  unit?: string;
  barcode?: string;
  outerBoxBarcode?: string;
  lotNumber?: string;
  binLocation?: string;
  currentCount?: number | null;
  maxAllowedQty?: number;
}

export interface MobileScannerCaptureResult {
  ok: boolean;
  title?: string;
  detail?: string;
  totalCount?: number;
  closeAfter?: boolean;
}

export interface MobileBarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
  mode: 'stocktake' | 'goods_receipt' | 'lookup';
  title?: string;
  subtitle?: string;
  catalogItems: ScannerCatalogItem[];
  hideSystemStock?: boolean;
  initialStocktakeMode?: 'scan_qty' | 'rapid_plus_one';
  onCaptureScan: (payload: {
    code: string;
    matchedItem?: ScannerCatalogItem;
    qty?: number;
    applyMode?: 'add' | 'set';
  }) => Promise<MobileScannerCaptureResult> | MobileScannerCaptureResult;
  onSecondaryAction?: (item: ScannerCatalogItem) => void;
  secondaryActionLabel?: string;
}

interface NativeBarcodeDetector {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
}

interface TorchMediaTrackCapabilities extends MediaTrackCapabilities {
  torch?: boolean;
}

const SUPPORTED_BARCODE_FORMATS = ['ean_13', 'ean_8', 'code_128', 'upc_a', 'upc_e', 'qr_code'];
const DUPLICATE_COOLDOWN_MS = 1200;

export const MobileBarcodeScannerModal: React.FC<MobileBarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  theme,
  mode,
  title,
  subtitle,
  catalogItems,
  hideSystemStock = false,
  initialStocktakeMode = 'scan_qty',
  onCaptureScan,
  onSecondaryAction,
  secondaryActionLabel = 'Lihat Rak, Lot & Traceability',
}) => {
  const isLight = theme === 'light';

  const [stocktakeMode, setStocktakeMode] = useState<'scan_qty' | 'rapid_plus_one'>(initialStocktakeMode);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [cameraStatus, setCameraStatus] = useState<'initializing' | 'active' | 'fallback'>('initializing');
  const [cameraErrorMessage, setCameraErrorMessage] = useState<string>('');
  const [decoderEngine, setDecoderEngine] = useState<'native' | 'zxing' | 'manual'>('manual');
  const [torchSupported, setTorchSupported] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [manualInput, setManualInput] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Scan + Input Qty dialog state
  const [pendingQtyDialog, setPendingQtyDialog] = useState<{
    code: string;
    item: ScannerCatalogItem;
    qtyText: string;
    applyMode: 'add' | 'set';
  } | null>(null);

  // Lookup matched card state
  const [lookupMatchedItem, setLookupMatchedItem] = useState<ScannerCatalogItem | null>(null);

  // Live feedback toast inside scanner modal
  const [liveToast, setLiveToast] = useState<{
    ok: boolean;
    message: string;
    detail?: string;
    at: string;
  } | null>(null);

  // Track cumulative scans within this modal session so Rapid +1 displays crisp updates
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({});

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);
  const rafRef = useRef<number | null>(null);
  const zxingControlsRef = useRef<IScannerControls | null>(null);
  const manualInputRef = useRef<HTMLInputElement | null>(null);
  const lastDetectionRef = useRef<{ code: string; ts: number }>({ code: '', ts: 0 });
  const isMountedRef = useRef<boolean>(false);

  // Refs synced to latest callbacks/state for RAF & ZXing loops
  const pausedRef = useRef<boolean>(false);
  pausedRef.current = Boolean(pendingQtyDialog) || isSaving;

  const catalogByLookup = useMemo(() => {
    const exactMap = new Map<string, ScannerCatalogItem>();
    catalogItems.forEach((item) => {
      const keys = [item.sku, item.barcode, item.outerBoxBarcode, item.lotNumber]
        .filter((k): k is string => Boolean(k && k.trim()))
        .map((k) => k.trim().toLowerCase());
      keys.forEach((k) => {
        if (!exactMap.has(k)) exactMap.set(k, item);
      });
    });
    return exactMap;
  }, [catalogItems]);

  const resolveCatalogItem = useCallback(
    (rawCode: string): ScannerCatalogItem | undefined => {
      const normalized = rawCode.trim().toLowerCase();
      if (!normalized) return undefined;
      return (
        catalogByLookup.get(normalized) ||
        catalogItems.find(
          (item) =>
            item.sku.toLowerCase() === normalized ||
            item.barcode?.toLowerCase() === normalized ||
            item.outerBoxBarcode?.toLowerCase() === normalized ||
            item.lotNumber?.toLowerCase() === normalized
        )
      );
    },
    [catalogByLookup, catalogItems]
  );

  const stopCameraResources = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (zxingControlsRef.current) {
      try {
        zxingControlsRef.current.stop();
      } catch {
        // ignore stop errors
      }
      zxingControlsRef.current = null;
    }
    if (videoTrackRef.current) {
      try {
        videoTrackRef.current.stop();
      } catch {
        // ignore
      }
      videoTrackRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => {
        try {
          tr.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setTorchOn(false);
    setTorchSupported(false);
  }, []);

  const triggerHapticAndAudio = useCallback(
    (ok: boolean) => {
      if (audioEnabled) {
        playScannerBeep(ok ? 'success' : 'error');
      }
      if (ok && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try {
          navigator.vibrate(80);
        } catch {
          // ignore vibration unsupported
        }
      }
    },
    [audioEnabled]
  );

  const handleResolvedBarcode = useCallback(
    async (rawCode: string, source: 'camera' | 'manual') => {
      const code = rawCode.trim();
      if (!code || isSaving) return;

      const now = Date.now();
      if (
        source === 'camera' &&
        lastDetectionRef.current.code.toLowerCase() === code.toLowerCase() &&
        now - lastDetectionRef.current.ts < DUPLICATE_COOLDOWN_MS
      ) {
        return;
      }
      if (source === 'camera') {
        lastDetectionRef.current = { code, ts: now };
      }

      const matched = resolveCatalogItem(code);

      // Stocktake Mode 1: Scan + Input Qty -> pause scan and open touch Numpad
      if (mode === 'stocktake' && stocktakeMode === 'scan_qty') {
        if (!matched) {
          triggerHapticAndAudio(false);
          setLiveToast({
            ok: false,
            message: `Barcode "${code}" tidak ditemukan pada sesi opname ini`,
            at: new Date().toLocaleTimeString('id-ID'),
          });
          return;
        }
        triggerHapticAndAudio(true);
        const currentBaseline = sessionCounts[matched.sku] ?? matched.currentCount ?? 0;
        setPendingQtyDialog({
          code,
          item: { ...matched, currentCount: currentBaseline },
          qtyText: '1',
          applyMode: 'add',
        });
        return;
      }

      // Stocktake Mode 2: Rapid +1 Auto-Count OR Goods Receipt OR Quick Lookup
      setIsSaving(true);
      try {
        const res = await onCaptureScan({
          code,
          matchedItem: matched,
          qty: 1,
          applyMode: 'add',
        });
        triggerHapticAndAudio(res.ok);

        if (res.ok && matched) {
          const nextCount =
            typeof res.totalCount === 'number'
              ? res.totalCount
              : (sessionCounts[matched.sku] ?? matched.currentCount ?? 0) + 1;
          setSessionCounts((prev) => ({ ...prev, [matched.sku]: nextCount }));
          if (mode === 'lookup') {
            setLookupMatchedItem({ ...matched, currentCount: nextCount });
          }
        }

        const fallbackMsg =
          mode === 'stocktake' && res.ok && matched
            ? `+1 ${matched.productName} (Total Scan: ${
                typeof res.totalCount === 'number'
                  ? res.totalCount
                  : (sessionCounts[matched.sku] ?? matched.currentCount ?? 0) + 1
              })`
            : res.title || (matched ? matched.productName : code);

        setLiveToast({
          ok: res.ok,
          message: fallbackMsg,
          detail: res.detail,
          at: new Date().toLocaleTimeString('id-ID'),
        });

        if (res.ok && res.closeAfter) {
          stopCameraResources();
          onClose();
        }
      } catch (err: unknown) {
        triggerHapticAndAudio(false);
        setLiveToast({
          ok: false,
          message: err instanceof Error ? err.message : 'Gagal memproses hasil scan barcode',
          at: new Date().toLocaleTimeString('id-ID'),
        });
      } finally {
        setIsSaving(false);
      }
    },
    [
      isSaving,
      mode,
      onCaptureScan,
      onClose,
      resolveCatalogItem,
      sessionCounts,
      stocktakeMode,
      stopCameraResources,
      triggerHapticAndAudio,
    ]
  );

  const handleBarcodeRef = useRef(handleResolvedBarcode);
  handleBarcodeRef.current = handleResolvedBarcode;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopCameraResources();
    };
  }, [stopCameraResources]);

  useEffect(() => {
    if (!isOpen) {
      stopCameraResources();
      setPendingQtyDialog(null);
      setLookupMatchedItem(null);
      setManualInput('');
      return;
    }

    setStocktakeMode(initialStocktakeMode);
    setLiveToast(null);
    setLookupMatchedItem(null);
    setSessionCounts({});
    lastDetectionRef.current = { code: '', ts: 0 };

    let cancelled = false;

    const startCameraAndDecoder = async () => {
      setCameraStatus('initializing');
      setCameraErrorMessage('');

      const isLocalhost =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1' ||
          window.location.hostname === '[::1]');

      if (typeof window !== 'undefined' && !window.isSecureContext && !isLocalhost) {
        setCameraStatus('fallback');
        setDecoderEngine('manual');
        setCameraErrorMessage('Akses kamera memerlukan koneksi HTTPS atau izin kamera browser.');
        setTimeout(() => manualInputRef.current?.focus(), 80);
        return;
      }

      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setCameraStatus('fallback');
        setDecoderEngine('manual');
        setCameraErrorMessage('Akses kamera memerlukan koneksi HTTPS atau izin kamera browser.');
        setTimeout(() => manualInputRef.current?.focus(), 80);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (cancelled || !isMountedRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        const primaryTrack = stream.getVideoTracks()[0] || null;
        videoTrackRef.current = primaryTrack;

        if (primaryTrack && typeof primaryTrack.getCapabilities === 'function') {
          try {
            const caps = primaryTrack.getCapabilities() as TorchMediaTrackCapabilities;
            setTorchSupported(Boolean(caps?.torch));
          } catch {
            setTorchSupported(false);
          }
        }

        const videoEl = videoRef.current;
        if (!videoEl) {
          setCameraStatus('fallback');
          return;
        }

        videoEl.srcObject = stream;
        try {
          await videoEl.play();
        } catch {
          // autoplay policy fallback handled silently with playsInline + muted
        }

        setCameraStatus('active');

        const NativeDetectorCtor = (window as unknown as {
          BarcodeDetector?: new (opts?: { formats?: string[] }) => NativeBarcodeDetector;
        }).BarcodeDetector;

        if (NativeDetectorCtor) {
          setDecoderEngine('native');
          const detector = new NativeDetectorCtor({
            formats: SUPPORTED_BARCODE_FORMATS,
          });
          let lastFrameCheck = 0;

          const scanFrame = async (ts: number) => {
            if (cancelled || !isMountedRef.current || !streamRef.current || !videoRef.current) return;
            if (!pausedRef.current && videoRef.current.readyState >= 2 && ts - lastFrameCheck >= 110) {
              lastFrameCheck = ts;
              try {
                const detected = await detector.detect(videoRef.current);
                const rawValue = detected.find((d) => d.rawValue)?.rawValue;
                if (rawValue) {
                  void handleBarcodeRef.current(rawValue, 'camera');
                }
              } catch {
                // ignore transient frame decoding errors
              }
            }
            rafRef.current = requestAnimationFrame(scanFrame);
          };

          rafRef.current = requestAnimationFrame(scanFrame);
        } else {
          // Automatic JS fallback decoder for iOS Safari / Firefox
          setDecoderEngine('zxing');
          const hints = new Map<DecodeHintType, unknown>();
          hints.set(DecodeHintType.POSSIBLE_FORMATS, [
            BarcodeFormat.EAN_13,
            BarcodeFormat.EAN_8,
            BarcodeFormat.CODE_128,
            BarcodeFormat.UPC_A,
            BarcodeFormat.UPC_E,
            BarcodeFormat.QR_CODE,
          ]);
          const reader = new BrowserMultiFormatReader(hints, {
            delayBetweenScanAttempts: 160,
            delayBetweenScanSuccess: DUPLICATE_COOLDOWN_MS,
          });
          const controls = await reader.decodeFromStream(stream, videoEl, (result) => {
            if (cancelled || !isMountedRef.current || pausedRef.current) return;
            const text = result?.getText();
            if (text) {
              void handleBarcodeRef.current(text, 'camera');
            }
          });
          if (cancelled || !isMountedRef.current) {
            controls.stop();
            return;
          }
          zxingControlsRef.current = controls;
        }
      } catch (err: unknown) {
        if (cancelled || !isMountedRef.current) return;
        stopCameraResources();
        setCameraStatus('fallback');
        setDecoderEngine('manual');
        const errName = err instanceof Error ? err.name : '';
        if (errName === 'NotAllowedError' || errName === 'SecurityError') {
          setCameraErrorMessage('Akses kamera memerlukan koneksi HTTPS atau izin kamera browser (izin ditolak).');
        } else {
          setCameraErrorMessage(
            'Akses kamera memerlukan koneksi HTTPS atau izin kamera browser. Gunakan input manual / scanner USB di bawah.'
          );
        }
        setTimeout(() => manualInputRef.current?.focus(), 100);
      }
    };

    void startCameraAndDecoder();

    return () => {
      cancelled = true;
      stopCameraResources();
    };
  }, [isOpen, initialStocktakeMode, stopCameraResources]);

  const handleToggleTorch = async () => {
    const track = videoTrackRef.current;
    if (!track || !torchSupported) return;
    const nextState = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: nextState } as MediaTrackConstraintSet],
      });
      setTorchOn(nextState);
    } catch {
      setLiveToast({
        ok: false,
        message: 'Senter / Flash tidak didukung oleh perangkat kamera ini.',
        at: new Date().toLocaleTimeString('id-ID'),
      });
    }
  };

  const handleConfirmQtyDialog = async () => {
    if (!pendingQtyDialog || isSaving) return;
    const parsedQty = Math.max(0, Number(pendingQtyDialog.qtyText || 0));
    if (!Number.isFinite(parsedQty) || (pendingQtyDialog.applyMode === 'add' && parsedQty <= 0)) {
      setLiveToast({
        ok: false,
        message: 'Masukkan jumlah qty fisik yang valid (> 0).',
        at: new Date().toLocaleTimeString('id-ID'),
      });
      return;
    }
    setIsSaving(true);
    try {
      const res = await onCaptureScan({
        code: pendingQtyDialog.code,
        matchedItem: pendingQtyDialog.item,
        qty: parsedQty,
        applyMode: pendingQtyDialog.applyMode,
      });
      if (res.ok) {
        const nextTotal =
          typeof res.totalCount === 'number'
            ? res.totalCount
            : pendingQtyDialog.applyMode === 'add'
            ? (pendingQtyDialog.item.currentCount || 0) + parsedQty
            : parsedQty;
        setSessionCounts((prev) => ({ ...prev, [pendingQtyDialog.item.sku]: nextTotal }));
        triggerHapticAndAudio(true);
        setLiveToast({
          ok: true,
          message:
            res.title ||
            `${pendingQtyDialog.applyMode === 'add' ? `+${parsedQty}` : `=${parsedQty}`} ${pendingQtyDialog.item.productName}`,
          detail: res.detail || `Total Scan: ${nextTotal} ${pendingQtyDialog.item.unit || 'pcs'}`,
          at: new Date().toLocaleTimeString('id-ID'),
        });
        setPendingQtyDialog(null);
      } else {
        triggerHapticAndAudio(false);
        setLiveToast({
          ok: false,
          message: res.detail || res.title || 'Gagal menyimpan jumlah opname.',
          at: new Date().toLocaleTimeString('id-ID'),
        });
      }
    } catch (err: unknown) {
      triggerHapticAndAudio(false);
      setLiveToast({
        ok: false,
        message: err instanceof Error ? err.message : 'Gagal menyimpan qty opname.',
        at: new Date().toLocaleTimeString('id-ID'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleNumpadKey = (key: string) => {
    setPendingQtyDialog((prev) => {
      if (!prev) return prev;
      if (key === 'C') return { ...prev, qtyText: '0' };
      if (key === 'BACK') {
        const sliced = prev.qtyText.slice(0, -1);
        return { ...prev, qtyText: sliced === '' ? '0' : sliced };
      }
      if (key === '.') {
        if (prev.qtyText.includes('.')) return prev;
        return { ...prev, qtyText: `${prev.qtyText || '0'}.` };
      }
      const next = prev.qtyText === '0' ? key : `${prev.qtyText}${key}`;
      if (next.length > 7) return prev;
      return { ...prev, qtyText: next };
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pendingQtyDialog) {
          setPendingQtyDialog(null);
        } else {
          stopCameraResources();
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose, pendingQtyDialog, stopCameraResources]);

  if (!isOpen || typeof document === 'undefined') return null;

  const surfaceClass = isLight
    ? 'bg-[#F7F9F8] border-[#D7E0DB] text-[#13221B]'
    : 'bg-[#12141C] border-slate-800/90 text-[#ECFDF5]';
  const cardClass = isLight
    ? 'bg-white border-[#DDE5E0] text-[#13221B]'
    : 'bg-[#090A0F] border-slate-800/80 text-[#ECFDF5]';
  const mutedText = isLight ? 'text-[#4B6156]' : 'text-slate-400';

  const defaultTitle =
    title ||
    (mode === 'stocktake'
      ? 'Scan Kamera HP — Stock Opname'
      : mode === 'goods_receipt'
      ? 'Scan Barcode GR — Terima Barang PO'
      : 'Quick Lookup & Traceability Scanner');

  const defaultSubtitle =
    subtitle ||
    (mode === 'stocktake'
      ? hideSystemStock
        ? 'Mode Buta Aktif · Stok sistem disembunyikan. Scan EAN-13 / Code-128 / QR produk.'
        : 'Arahkan kamera ke barcode kemasan atau gunakan input scanner USB.'
      : mode === 'goods_receipt'
      ? 'Scan barcode dus/produk untuk mencocokkan item PO aktif secara instan.'
      : 'Scan barcode untuk memfilter daftar stok dan membuka Rak, Lot & Traceability.');

  return createPortal(
    <div
      className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pendingQtyDialog) {
          stopCameraResources();
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={defaultTitle}
        className={`w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[94dvh] ${surfaceClass}`}
      >
        {/* Top Modal Bar */}
        <div
          className={`px-4 py-3.5 border-b flex items-center justify-between gap-3 shrink-0 ${
            isLight ? 'bg-[#EEF2F0] border-[#D7E0DB]' : 'bg-[#090A0F] border-slate-800/90'
          }`}
        >
          <div className="min-w-0 flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#0F4C3A] text-white flex items-center justify-center shrink-0">
              <ScanLine className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold truncate">{defaultTitle}</h3>
              <p className={`text-[11px] truncate ${mutedText}`}>{defaultSubtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setAudioEnabled((v) => !v)}
              aria-label={audioEnabled ? 'Matikan suara beep scanner' : 'Aktifkan suara beep scanner'}
              title={audioEnabled ? 'Beep Aktif' : 'Beep Mati'}
              className={`min-h-[44px] min-w-[44px] rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${
                isLight
                  ? 'bg-white border-[#D5DFD9] text-[#13221B] hover:bg-[#E8EFEA]'
                  : 'bg-[#12141C] border-slate-800 text-slate-200 hover:bg-slate-800'
              }`}
            >
              {audioEnabled ? (
                <Volume2 className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-400" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                stopCameraResources();
                onClose();
              }}
              aria-label="Tutup kamera scanner"
              className={`min-h-[44px] min-w-[44px] rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${
                isLight
                  ? 'bg-white border-[#D5DFD9] text-[#13221B] hover:bg-[#E8EFEA]'
                  : 'bg-[#12141C] border-slate-800 text-slate-200 hover:bg-slate-800'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {/* Stocktake Mode Switcher (Scan + Input Qty vs Rapid +1 Auto-Count) */}
          {mode === 'stocktake' && (
            <div
              className={`grid grid-cols-2 gap-1.5 p-1 rounded-xl border ${
                isLight ? 'bg-[#EAEFEA] border-[#D5DFD9]' : 'bg-[#090A0F] border-slate-800'
              }`}
            >
              <button
                type="button"
                onClick={() => setStocktakeMode('scan_qty')}
                className={`min-h-[44px] px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5 ${
                  stocktakeMode === 'scan_qty'
                    ? 'bg-[#0F4C3A] text-white shadow-xs'
                    : isLight
                    ? 'text-[#13221B] hover:bg-white/70'
                    : 'text-slate-300 hover:bg-slate-900'
                }`}
              >
                <Keyboard className="w-3.5 h-3.5 shrink-0" />
                <span>Mode 1: Scan + Input Qty</span>
              </button>
              <button
                type="button"
                onClick={() => setStocktakeMode('rapid_plus_one')}
                className={`min-h-[44px] px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5 ${
                  stocktakeMode === 'rapid_plus_one'
                    ? 'bg-[#0F4C3A] text-white shadow-xs'
                    : isLight
                    ? 'text-[#13221B] hover:bg-white/70'
                    : 'text-slate-300 hover:bg-slate-900'
                }`}
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>Mode 2: Rapid +1 Auto</span>
              </button>
            </div>
          )}

          {/* Blind Opname Privacy Strip */}
          {mode === 'stocktake' && hideSystemStock && (
            <div
              className={`px-3 py-2 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
                isLight
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-amber-950/35 border-amber-800/60 text-amber-200'
              }`}
            >
              <EyeOff className="w-4 h-4 shrink-0" />
              <span>Blind Opname Aktif · Saldo stok sistem disembunyikan hingga disetujui Supervisor.</span>
            </div>
          )}

          {/* Camera Viewfinder */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 aspect-[16/10] sm:aspect-video flex items-center justify-center">
            <video
              ref={videoRef}
              muted
              playsInline
              autoPlay
              className={`w-full h-full object-cover ${cameraStatus === 'active' ? 'opacity-100' : 'opacity-25'}`}
            />

            {/* Reticle & Scrim Overlay when Camera Active */}
            {cameraStatus === 'active' && (
              <>
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                  <div className="w-full max-w-[280px] h-28 sm:h-32 rounded-xl border-2 border-emerald-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] relative">
                    <div className="absolute inset-x-3 top-1/2 -translate-y-1/2 h-0.5 bg-emerald-400 shadow-[0_0_10px_#34d399]" />
                  </div>
                </div>

                {/* Top Overlay Controls (Engine label + Torch Button) */}
                <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-black/65 backdrop-blur-xs text-[11px] font-mono text-emerald-300 border border-emerald-500/30">
                    {pausedRef.current
                      ? 'Scan Dijeda (Input Qty)'
                      : decoderEngine === 'native'
                      ? 'Kamera Aktif · BarcodeDetector'
                      : 'Kamera Aktif · ZXing Fallback'}
                  </span>

                  <button
                    type="button"
                    onClick={handleToggleTorch}
                    disabled={!torchSupported}
                    title={
                      torchSupported
                        ? torchOn
                          ? 'Matikan Senter / Flash'
                          : 'Nyalakan Senter / Flash'
                        : 'Senter tidak tersedia pada kamera ini'
                    }
                    className={`min-h-[44px] px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 backdrop-blur-xs transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                      torchOn
                        ? 'bg-amber-400 text-slate-950 border-amber-300'
                        : 'bg-black/65 text-white border-white/20 hover:bg-black/80'
                    }`}
                  >
                    {torchOn ? <Flashlight className="w-4 h-4" /> : <FlashlightOff className="w-4 h-4" />}
                    <span>{torchSupported ? (torchOn ? 'Flash ON' : 'Senter / Flash') : 'Senter (N/A)'}</span>
                  </button>
                </div>
              </>
            )}

            {/* Initializing Overlay */}
            {cameraStatus === 'initializing' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-200 p-4 text-center">
                <Loader2 className="w-7 h-7 animate-spin text-emerald-400" />
                <span className="text-xs font-semibold">Mengaktifkan kamera belakang...</span>
              </div>
            )}

            {/* HTTPS / Permission Fallback Overlay */}
            {cameraStatus === 'fallback' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center bg-slate-950/90 text-slate-100">
                <CameraOff className="w-7 h-7 text-amber-400" />
                <p className="text-xs font-bold text-amber-300 max-w-sm">
                  {cameraErrorMessage || 'Akses kamera memerlukan koneksi HTTPS atau izin kamera browser'}
                </p>
                <p className="text-[11px] text-slate-400 max-w-xs">
                  Input barcode manual atau USB/Bluetooth scanner tetap aktif otomatis di bawah.
                </p>
              </div>
            )}
          </div>

          {/* Dedicated HTTPS / Permission Fallback Alert Banner if fallback */}
          {cameraStatus === 'fallback' && (
            <div
              className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
                isLight
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-amber-950/35 border-amber-800/60 text-amber-200'
              }`}
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <div className="font-bold">Akses kamera memerlukan koneksi HTTPS atau izin kamera browser</div>
                <div className="text-[11px] opacity-90 mt-0.5">
                  Ketik atau scan kode EAN-13 / Code-128 / SKU pada kolom input di bawah lalu tekan Enter.
                </div>
              </div>
            </div>
          )}

          {/* Live Scan Feedback Toast */}
          {liveToast && (
            <div
              className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-xs font-semibold ${
                liveToast.ok
                  ? isLight
                    ? 'bg-emerald-50 border-emerald-200 text-[#0F4C3A]'
                    : 'bg-emerald-950/45 border-emerald-800/60 text-emerald-200'
                  : isLight
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-rose-950/45 border-rose-800/60 text-rose-200'
              }`}
            >
              <div className="flex items-start gap-2 min-w-0">
                {liveToast.ok ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                )}
                <div className="min-w-0">
                  <div className="font-bold truncate">{liveToast.message}</div>
                  {liveToast.detail && <div className="text-[11px] opacity-85 font-mono">{liveToast.detail}</div>}
                </div>
              </div>
              <span className="text-[10px] font-mono tabular-nums opacity-75 shrink-0">{liveToast.at}</span>
            </div>
          )}

          {/* Quick Lookup Result Card (Lookup Mode) */}
          {mode === 'lookup' && lookupMatchedItem && (
            <div className={`p-3.5 rounded-xl border space-y-2.5 ${cardClass}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-mono text-[11px] font-bold text-[#0F4C3A] dark:text-emerald-400">
                    {lookupMatchedItem.sku}
                  </div>
                  <div className="font-bold text-sm truncate">{lookupMatchedItem.productName}</div>
                  <div className={`text-[11px] font-mono mt-0.5 ${mutedText}`}>
                    Rak: {lookupMatchedItem.binLocation || 'Warehouse Bin'} · Lot: {lookupMatchedItem.lotNumber || 'FEFO'}
                  </div>
                </div>
                <PackageCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {onSecondaryAction && (
                  <button
                    type="button"
                    onClick={() => {
                      stopCameraResources();
                      onClose();
                      onSecondaryAction(lookupMatchedItem);
                    }}
                    className="min-h-[44px] px-3 py-2 rounded-xl bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <GitBranch className="w-4 h-4" />
                    <span>{secondaryActionLabel}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    stopCameraResources();
                    onClose();
                  }}
                  className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer ${
                    isLight
                      ? 'bg-white border-[#D5DFD9] text-[#13221B] hover:bg-[#EEF2F0]'
                      : 'bg-[#12141C] border-slate-700 text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  Tutup &amp; Lihat Tabel
                </button>
              </div>
            </div>
          )}

          {/* Mode 1: Scan + Input Qty Touch Numeric Keypad Dialog */}
          {mode === 'stocktake' && pendingQtyDialog && (
            <div className={`p-4 rounded-2xl border space-y-3 ${cardClass}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-mono font-bold text-[#0F4C3A] dark:text-emerald-400">
                    {pendingQtyDialog.item.sku} · {pendingQtyDialog.item.binLocation || 'Rak Gudang'}
                  </div>
                  <div className="text-sm font-bold leading-snug">{pendingQtyDialog.item.productName}</div>
                  <div className={`text-[11px] mt-0.5 font-mono tabular-nums ${mutedText}`}>
                    Hitungan Draft Saat Ini: <strong>{pendingQtyDialog.item.currentCount ?? 0}</strong>{' '}
                    {pendingQtyDialog.item.unit || 'pcs'}
                    {hideSystemStock ? ' · Stok Sistem Disembunyikan' : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingQtyDialog(null)}
                  className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  aria-label="Batalkan input qty"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Add (+delta) vs Set Total (=qty) Toggle */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setPendingQtyDialog((p) => (p ? { ...p, applyMode: 'add' } : p))}
                  className={`min-h-[40px] rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    pendingQtyDialog.applyMode === 'add'
                      ? 'bg-[#0F4C3A] text-white border-[#0F4C3A]'
                      : isLight
                      ? 'bg-[#F7F9F8] border-[#D5DFD9] text-[#13221B]'
                      : 'bg-[#12141C] border-slate-800 text-slate-300'
                  }`}
                >
                  Tambah (+Qty)
                </button>
                <button
                  type="button"
                  onClick={() => setPendingQtyDialog((p) => (p ? { ...p, applyMode: 'set' } : p))}
                  className={`min-h-[40px] rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    pendingQtyDialog.applyMode === 'set'
                      ? 'bg-[#0F4C3A] text-white border-[#0F4C3A]'
                      : isLight
                      ? 'bg-[#F7F9F8] border-[#D5DFD9] text-[#13221B]'
                      : 'bg-[#12141C] border-slate-800 text-slate-300'
                  }`}
                >
                  Set Total (=Qty)
                </button>
              </div>

              {/* Big Readout */}
              <div
                className={`px-4 py-3 rounded-xl border flex items-center justify-between ${
                  isLight ? 'bg-[#F7F9F8] border-[#D5DFD9]' : 'bg-[#12141C] border-slate-800'
                }`}
              >
                <span className={`text-xs font-semibold ${mutedText}`}>
                  {pendingQtyDialog.applyMode === 'add' ? 'Tambah Qty:' : 'Total Fisik:'}
                </span>
                <span className="text-2xl font-bold font-mono tabular-nums text-[#0F4C3A] dark:text-emerald-400">
                  {pendingQtyDialog.applyMode === 'add' ? '+' : ''}
                  {pendingQtyDialog.qtyText} {pendingQtyDialog.item.unit || 'pcs'}
                </span>
              </div>

              {/* Touch-Friendly Numeric Keypad */}
              <div className="grid grid-cols-3 gap-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'BACK'].map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => handleNumpadKey(k)}
                    className={`min-h-[48px] rounded-xl border font-mono text-base font-bold flex items-center justify-center active:scale-[0.97] transition-transform cursor-pointer ${
                      isLight
                        ? 'bg-white border-[#D5DFD9] text-[#13221B] hover:bg-[#EEF2F0]'
                        : 'bg-[#12141C] border-slate-800 text-slate-100 hover:bg-slate-800'
                    }`}
                  >
                    {k === 'BACK' ? <Delete className="w-5 h-5" /> : k}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleNumpadKey('C')}
                  className={`min-h-[48px] rounded-xl border text-xs font-bold cursor-pointer ${
                    isLight
                      ? 'bg-white border-[#D5DFD9] text-slate-700 hover:bg-slate-100'
                      : 'bg-[#12141C] border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  Clear (C)
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleConfirmQtyDialog}
                  className="col-span-2 min-h-[48px] px-4 rounded-xl bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Simpan &amp; Lanjut Scan</span>
                </button>
              </div>
            </div>
          )}

          {/* Manual / USB Wedge Fallback Input (Always accessible) */}
          {!pendingQtyDialog && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!manualInput.trim()) return;
                const val = manualInput;
                setManualInput('');
                void handleResolvedBarcode(val, 'manual');
              }}
              className="space-y-2"
            >
              <label className={`block text-[11px] font-semibold ${mutedText}`}>
                Input Manual / USB Barcode Scanner Wedge
              </label>
              <div className="flex items-stretch gap-2">
                <div className="relative flex-1">
                  <Barcode className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    ref={manualInputRef}
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="Ketik SKU / EAN-13 / QR lalu Enter..."
                    className={`w-full min-h-[44px] pl-9 pr-3 py-2 text-xs font-mono rounded-xl border focus:outline-none focus:ring-2 focus:ring-[#0F4C3A] ${
                      isLight
                        ? 'bg-white border-[#D5DFD9] text-[#13221B]'
                        : 'bg-[#090A0F] border-slate-800 text-slate-100'
                    }`}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!manualInput.trim() || isSaving}
                  className="min-h-[44px] px-4 rounded-xl bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-bold disabled:opacity-50 cursor-pointer shrink-0 whitespace-nowrap"
                >
                  Proses Scan
                </button>
              </div>

              {catalogItems.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className={`text-[10px] font-semibold ${mutedText}`}>Contoh SKU / Barcode:</span>
                  {catalogItems.slice(0, 4).map((item) => {
                    const code = item.barcode || item.sku;
                    return (
                      <button
                        key={`${item.sku}-${code}`}
                        type="button"
                        onClick={() => void handleResolvedBarcode(code, 'manual')}
                        className={`min-h-[36px] px-2.5 py-1 rounded-lg text-[10px] font-mono border transition-colors cursor-pointer ${
                          isLight
                            ? 'bg-white border-[#D5DFD9] text-[#0F4C3A] hover:bg-[#EEF2F0]'
                            : 'bg-[#090A0F] border-slate-800 text-emerald-300 hover:bg-slate-900'
                        }`}
                      >
                        {code}
                      </button>
                    );
                  })}
                </div>
              )}
            </form>
          )}
        </div>

        {/* Bottom Sticky Action Footer (Thumb Zone) */}
        <div
          className={`px-4 py-3 border-t flex items-center justify-between gap-3 shrink-0 ${
            isLight ? 'bg-white border-[#D7E0DB]' : 'bg-[#090A0F] border-slate-800/90'
          }`}
        >
          <span className={`text-[11px] font-mono tabular-nums ${mutedText}`}>
            {Object.keys(sessionCounts).length > 0
              ? `${Object.keys(sessionCounts).length} SKU discan sesi ini`
              : `${catalogItems.length} item siap discan`}
          </span>
          <button
            type="button"
            onClick={() => {
              stopCameraResources();
              onClose();
            }}
            className={`min-h-[44px] px-5 rounded-xl border text-xs font-bold cursor-pointer whitespace-nowrap ${
              isLight
                ? 'bg-[#EEF2F0] border-[#D5DFD9] text-[#13221B] hover:bg-[#E2E9E5]'
                : 'bg-[#12141C] border-slate-700 text-slate-200 hover:bg-slate-800'
            }`}
          >
            Selesai &amp; Tutup Kamera
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
