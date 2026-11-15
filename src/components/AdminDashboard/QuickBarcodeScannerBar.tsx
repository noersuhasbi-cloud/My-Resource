import React, { useEffect, useRef, useState } from 'react';
import {
  Barcode,
  Camera,
  CameraOff,
  CheckCircle2,
  Minus,
  Plus,
  Volume2,
  VolumeX,
  XCircle,
} from 'lucide-react';
import { playScannerBeep } from '../../utils/scannerAudio';

export interface QuickScanResult {
  matched: boolean;
  label?: string;
  detail?: string;
}

interface QuickBarcodeScannerBarProps {
  theme: 'light' | 'dark';
  title?: string;
  placeholder?: string;
  allowDecrement?: boolean;
  defaultMode?: 'increment' | 'decrement';
  sampleCodes?: Array<{ label: string; code: string }>;
  onScan: (code: string, mode: 'increment' | 'decrement') => QuickScanResult;
}

export const QuickBarcodeScannerBar: React.FC<QuickBarcodeScannerBarProps> = ({
  theme,
  title = 'Quick Barcode / QR Scanner Mode',
  placeholder = 'Scan EAN-13, QR, SKU, or Batch # (Enter)...',
  allowDecrement = true,
  defaultMode = 'increment',
  sampleCodes = [],
  onScan,
}) => {
  const isLight = theme === 'light';
  const [scanInput, setScanInput] = useState<string>('');
  const [scanMode, setScanMode] = useState<'increment' | 'decrement'>(defaultMode);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string>('');
  const [lastFeedback, setLastFeedback] = useState<{
    ok: boolean;
    code: string;
    message: string;
    at: string;
  } | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastCamScanRef = useRef<{ code: string; ts: number }>({ code: '', ts: 0 });

  const stopCamera = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const executeScan = (rawCode: string) => {
    const clean = rawCode.trim();
    if (!clean) return;
    const effectiveMode = allowDecrement ? scanMode : 'increment';
    const result = onScan(clean, effectiveMode);
    if (audioEnabled) {
      playScannerBeep(result.matched ? 'success' : 'error');
    }
    setLastFeedback({
      ok: result.matched,
      code: clean,
      message: result.matched
        ? `${effectiveMode === 'increment' ? '+1' : '-1'} ${result.label || clean}${result.detail ? ` • ${result.detail}` : ''}`
        : result.detail || `No item matched code "${clean}"`,
      at: new Date().toLocaleTimeString(),
    });
    setScanInput('');
    inputRef.current?.focus();
  };

  const startCamera = async () => {
    setCameraError('');
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Browser camera API unavailable. Use handheld scanner or type barcode above.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 50);

      const BarcodeDetectorCtor = (window as unknown as {
        BarcodeDetector?: new (opts?: { formats?: string[] }) => {
          detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
        };
      }).BarcodeDetector;

      if (BarcodeDetectorCtor) {
        const detector = new BarcodeDetectorCtor({
          formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'upc_a'],
        });
        const tick = async () => {
          if (!streamRef.current || !videoRef.current) return;
          try {
            if (videoRef.current.readyState >= 2) {
              const codes = await detector.detect(videoRef.current);
              const hit = codes.find((c) => c.rawValue)?.rawValue;
              if (hit) {
                const now = Date.now();
                if (
                  lastCamScanRef.current.code !== hit ||
                  now - lastCamScanRef.current.ts > 1400
                ) {
                  lastCamScanRef.current = { code: hit, ts: now };
                  executeScan(hit);
                }
              }
            }
          } catch {
            // frame detect retry
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setCameraError(
          'Live camera preview active. Native BarcodeDetector not supported in this browser — pair with handheld wedge scanner or enter code manually.'
        );
      }
    } catch {
      setCameraError('Camera permission denied or no camera device detected. Handheld scanner input remains active.');
      stopCamera();
    }
  };

  const containerClass = isLight
    ? 'bg-emerald-50/60 border-emerald-200 text-slate-900'
    : 'bg-emerald-950/20 border-emerald-800/50 text-zinc-100';
  const inputClass = isLight
    ? 'bg-white border-emerald-300 text-slate-900 placeholder:text-slate-400 focus:border-[#0F4C3A] focus:ring-1 focus:ring-[#0F4C3A]'
    : 'bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-400 focus:border-emerald-500';

  return (
    <div className={`p-3.5 rounded-xl border space-y-2.5 ${containerClass}`}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#0F4C3A] text-white shrink-0">
            <Barcode className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-xs font-bold flex items-center gap-2">
              <span>{title}</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-[#0F4C3A]/15 text-[#0F4C3A] dark:text-emerald-300">
                Handheld + Camera
              </span>
            </div>
            <p className={`text-[10px] ${isLight ? 'text-slate-600' : 'text-zinc-300'}`}>
              Focus input for USB/Bluetooth scanner wedge or activate device camera with audio beep confirmation.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {allowDecrement && (
            <div
              className={`inline-flex items-center p-0.5 rounded-lg border ${
                isLight ? 'bg-white border-emerald-200' : 'bg-zinc-900 border-zinc-700'
              }`}
            >
              <button
                type="button"
                onClick={() => setScanMode('increment')}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  scanMode === 'increment'
                    ? 'bg-[#0F4C3A] text-white'
                    : isLight
                    ? 'text-slate-600 hover:bg-slate-100'
                    : 'text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                <Plus className="w-3 h-3" />
                +1 Count
              </button>
              <button
                type="button"
                onClick={() => setScanMode('decrement')}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  scanMode === 'decrement'
                    ? 'bg-rose-600 text-white'
                    : isLight
                    ? 'text-slate-600 hover:bg-slate-100'
                    : 'text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                <Minus className="w-3 h-3" />
                -1 Adjust
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setAudioEnabled((v) => !v)}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
              isLight
                ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                : 'bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800'
            }`}
            title="Toggle scanner beep audio"
          >
            {audioEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-600" /> : <VolumeX className="w-3.5 h-3.5 text-slate-400" />}
            <span>{audioEnabled ? 'Beep On' : 'Muted'}</span>
          </button>

          <button
            type="button"
            onClick={() => (cameraActive ? stopCamera() : void startCamera())}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
              cameraActive
                ? 'bg-rose-600 border-rose-600 text-white'
                : isLight
                ? 'bg-white border-emerald-300 text-[#0F4C3A] hover:bg-emerald-50'
                : 'bg-zinc-900 border-emerald-700 text-emerald-300 hover:bg-zinc-800'
            }`}
          >
            {cameraActive ? <CameraOff className="w-3.5 h-3.5" /> : <Camera className="w-3.5 h-3.5" />}
            <span>{cameraActive ? 'Stop Camera' : 'Camera Scan'}</span>
          </button>
        </div>
      </div>

      {/* Handheld Wedge / Keyboard Barcode Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          executeScan(scanInput);
        }}
        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
      >
        <div className="relative flex-1">
          <Barcode className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 absolute left-3 top-2.5" />
          <input
            ref={inputRef}
            type="text"
            autoFocus
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            placeholder={placeholder}
            className={`w-full pl-9 pr-3 py-1.5 text-xs font-mono rounded-xl border focus:outline-none ${inputClass}`}
          />
        </div>
        <button
          type="submit"
          disabled={!scanInput.trim()}
          className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#0F4C3A] hover:bg-[#0b382b] text-white disabled:opacity-50 transition-all cursor-pointer shrink-0"
        >
          Apply Scan ({allowDecrement && scanMode === 'decrement' ? '-1' : '+1'})
        </button>
      </form>

      {/* Quick Test Chips for Immediate Desk Verification */}
      {sampleCodes.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[10px] font-semibold ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
            Quick Tap Code:
          </span>
          {sampleCodes.slice(0, 4).map((sc) => (
            <button
              key={sc.code}
              type="button"
              onClick={() => executeScan(sc.code)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-mono border transition-colors cursor-pointer ${
                isLight
                  ? 'bg-white border-emerald-200 text-[#0F4C3A] hover:bg-emerald-100/70'
                  : 'bg-zinc-900 border-zinc-700 text-emerald-300 hover:bg-zinc-800'
              }`}
              title={`Simulate scan for ${sc.label}`}
            >
              {sc.code} ({sc.label})
            </button>
          ))}
        </div>
      )}

      {/* Optional Live Camera Viewfinder */}
      {cameraActive && (
        <div className="relative rounded-xl overflow-hidden border border-emerald-500/40 bg-black max-w-sm">
          <video ref={videoRef} muted playsInline className="w-full h-40 object-cover" />
          <div className="absolute inset-x-4 top-1/2 h-0.5 bg-emerald-400/80 shadow-[0_0_8px_#34d399]" />
        </div>
      )}

      {cameraError && (
        <p className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
          {cameraError}
        </p>
      )}

      {/* Last Scan Feedback */}
      {lastFeedback && (
        <div
          className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold border ${
            lastFeedback.ok
              ? isLight
                ? 'bg-emerald-100/70 border-emerald-300 text-emerald-900'
                : 'bg-emerald-950/50 border-emerald-700 text-emerald-200'
              : isLight
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-rose-950/40 border-rose-800 text-rose-200'
          }`}
        >
          <span className="inline-flex items-center gap-1.5">
            {lastFeedback.ok ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>{lastFeedback.message}</span>
          </span>
          <span className="font-mono text-[10px] opacity-75">{lastFeedback.at}</span>
        </div>
      )}
    </div>
  );
};
