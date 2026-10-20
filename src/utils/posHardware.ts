// POS Hardware & Peripheral Integration Layer for GroceMart ERP
// Direct thermal printer ESC/POS command stream, Cash Drawer Kick Pulse,
// Barcode Wedge Scanner Listener, and Digital Scale RS232/USB HID bridge.

import type {
  POSHardwarePeripheralStatus,
  ThermalPrintReceiptPayload,
} from '../types/index.ts';
import { formatIDR } from './formatters';

// =============================================================
// 1. THERMAL RECEIPT PRINTER (ESC/POS COMMAND STREAM GENERATOR)
// =============================================================

export interface EscPosCommandResult {
  rawCommandHex: string;
  formattedTextLines: string[];
  paperWidthMm: 58 | 80;
  cutTriggered: boolean;
  drawerPulseTriggered: boolean;
}

/**
 * Generate standard ESC/POS command sequence and ASCII line buffer
 */
export function generateEscPosReceipt(payload: ThermalPrintReceiptPayload, paperWidthMm: 58 | 80 = 80): EscPosCommandResult {
  const colWidth = paperWidthMm === 80 ? 42 : 32;
  const divider = '='.repeat(colWidth);
  const thinDivider = '-'.repeat(colWidth);

  const lines: string[] = [];
  lines.push('       GROCEMART RETAIL INDONESIA       ');
  lines.push('   Premium Organic & Fresh Groceries    ');
  lines.push(`Outlet: ${payload.storeName}`);
  lines.push(payload.storeAddress);
  lines.push(divider);
  lines.push(`Receipt: ${payload.receiptNumber}`);
  lines.push(`Date:    ${new Date(payload.timestamp).toLocaleString('id-ID')}`);
  lines.push(`Cashier: ${payload.cashierName}`);
  lines.push(thinDivider);
  lines.push('ITEM                           QTY   TOTAL');
  lines.push(thinDivider);

  payload.items.forEach((it) => {
    const nameTruncated = it.name.length > 20 ? it.name.slice(0, 19) + '..' : it.name;
    const qtyUnit = `${it.quantity}${it.unit}`;
    const totalStr = formatIDR(it.lineTotal);
    const line = `${nameTruncated.padEnd(22)} ${qtyUnit.padStart(6)} ${totalStr.padStart(12)}`;
    lines.push(line);
    if (it.isWeighted && it.netWeightGrams) {
      lines.push(`  [Scale Weight: ${it.netWeightGrams}g]`);
    }
    if (it.discount && it.discount > 0) {
      lines.push(`  (Promo Discount: -${formatIDR(it.discount)})`);
    }
  });

  lines.push(thinDivider);
  lines.push(`Subtotal:                    ${formatIDR(payload.subtotal).padStart(14)}`);
  if (payload.discount > 0) {
    lines.push(`Total Discount Applied:     -${formatIDR(payload.discount).padStart(14)}`);
  }
  lines.push(`PPN / Sales Tax:             ${formatIDR(payload.tax).padStart(14)}`);
  lines.push(divider);
  lines.push(`GRAND TOTAL:                 ${formatIDR(payload.total).padStart(14)}`);
  if (payload.currency !== 'IDR') {
    lines.push(`FX Equiv (${payload.currency}):           ${payload.currency} ${payload.currencyTotal.toFixed(2).padStart(10)}`);
  }
  lines.push(divider);
  lines.push(`Settlement: ${payload.paymentMethod.toUpperCase()}`);
  if (payload.cashTendered !== undefined && payload.cashChange !== undefined) {
    lines.push(`Cash Tendered:               ${formatIDR(payload.cashTendered).padStart(14)}`);
    lines.push(`Change Due:                  ${formatIDR(payload.cashChange).padStart(14)}`);
  }
  if (payload.qrisRef) {
    lines.push(`QRIS Ref: ${payload.qrisRef}`);
  }
  lines.push('');
  lines.push('   Thank you for shopping at GroceMart! ');
  lines.push('  Certified HACCP & Cold-Chain Freshness');
  lines.push('      Return policy: 7 days with receipt');
  lines.push('');
  lines.push('[ESC/POS GS V 0x41 0x00 - PAPER CUT TRIGGERED]');

  // Simulated ESC/POS Byte Stream (Hex representation)
  // 1B 40 (ESC @ Init) + 1B 61 01 (Center) + Text + 1D 56 41 00 (GS V Cut)
  const rawCommandHex = `1B401B6101${Array.from(lines.join('\n')).map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('')}1D564100`;

  return {
    rawCommandHex,
    formattedTextLines: lines,
    paperWidthMm,
    cutTriggered: true,
    drawerPulseTriggered: payload.paymentMethod === 'cash',
  };
}

/**
 * Execute direct thermal receipt print (opens sanitized print dialog or raw thermal bridge)
 */
export function executeThermalReceiptPrint(payload: ThermalPrintReceiptPayload): EscPosCommandResult {
  const result = generateEscPosReceipt(payload);

  // Trigger browser print window with monospace thermal styling
  const printWindow = window.open('', '_blank', 'width=380,height=600');
  if (printWindow) {
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt ${payload.receiptNumber}</title>
          <style>
            @page { margin: 0; size: 80mm auto; }
            body {
              font-family: 'Courier New', Courier, monospace;
              font-size: 11px;
              line-height: 1.25;
              padding: 10px;
              margin: 0;
              width: 72mm;
              color: #000;
              background: #fff;
            }
            pre {
              margin: 0;
              white-space: pre-wrap;
              word-wrap: break-word;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
          </style>
        </head>
        <body>
          <pre>${result.formattedTextLines.join('\n')}</pre>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  // If cash settlement, automatically trigger drawer kick
  if (payload.paymentMethod === 'cash') {
    triggerCashDrawerKick();
  }

  return result;
}

// =============================================================
// 2. CASH DRAWER KICK PULSE TRIGGER & AUDIO FEEDBACK
// =============================================================

/**
 * Synthesize standard retail barcode scanner success beep using Web Audio API
 */
export function playBeepSuccess() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2400, ctx.currentTime);

    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch {
    // Audio context may be restricted before user gesture
  }
}

/**
 * Synthesize cash drawer mechanical kick-out chime/click using Web Audio API
 */
export function playCashDrawerChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    // Metallic solenoid pulse click
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);

    // Cash register bell chime (standard retail register sound)
    setTimeout(() => {
      const bell = ctx.createOscillator();
      const bellGain = ctx.createGain();
      bell.type = 'sine';
      bell.frequency.setValueAtTime(1760, ctx.currentTime); // High A6 bell
      bell.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.35);

      bellGain.gain.setValueAtTime(0.25, ctx.currentTime);
      bellGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

      bell.connect(bellGain);
      bellGain.connect(ctx.destination);
      bell.start();
      bell.stop(ctx.currentTime + 0.42);
    }, 70);
  } catch {
    // Audio context may be restricted before user gesture
  }
}

/**
 * Triggers electronic cash drawer kick pulse (ESC/POS `ESC p 0 25 250`)
 */
export function triggerCashDrawerKick(pin: 2 | 5 = 2): {
  success: boolean;
  command: string;
  pulseDurationMs: number;
  timestamp: string;
} {
  playCashDrawerChime();

  // ESC/POS Command: ESC p m t1 t2
  // Hex: 1B 70 00 19 FA (Pulse 50ms ON, 500ms OFF on Pin 2)
  const pinByte = pin === 2 ? '00' : '01';
  const commandHex = `1B70${pinByte}19FA`;

  return {
    success: true,
    command: `ESC p ${pin === 2 ? 0 : 1} 25 250 (HEX: ${commandHex})`,
    pulseDurationMs: 50,
    timestamp: new Date().toISOString(),
  };
}

// =============================================================
// 3. BARCODE SCANNER WEDGE (KEYBOARD HID LISTENER)
// =============================================================

export interface BarcodeScannerListenerOptions {
  onScan: (barcode: string) => void;
  maxKeystrokeIntervalMs?: number;
  minBarcodeLength?: number;
}

/**
 * Global Keyboard Wedge Listener for handheld/tabletop 1D/2D USB & Bluetooth Barcode Scanners
 */
export function setupBarcodeScannerListener(options: BarcodeScannerListenerOptions): () => void {
  const { onScan, maxKeystrokeIntervalMs = 60, minBarcodeLength = 3 } = options;

  let buffer = '';
  let lastKeyTime = 0;

  const handleKeyDown = (e: KeyboardEvent) => {
    // Ignore control keys except Enter
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') {
      return;
    }

    const currentTime = Date.now();
    const interval = currentTime - lastKeyTime;
    lastKeyTime = currentTime;

    // Barcode scanners input characters with extreme velocity (< 50ms per key)
    if (e.key === 'Enter') {
      if (buffer.length >= minBarcodeLength && interval < maxKeystrokeIntervalMs * 2.5) {
        e.preventDefault();
        const scannedCode = buffer.trim();
        buffer = '';
        if (scannedCode) {
          onScan(scannedCode);
        }
      } else {
        buffer = '';
      }
      return;
    }

    // Reset buffer if human typing speed (> 100ms between keystrokes)
    if (interval > maxKeystrokeIntervalMs * 3) {
      buffer = '';
    }

    if (e.key.length === 1) {
      buffer += e.key;
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => {
    window.removeEventListener('keydown', handleKeyDown);
  };
}

// =============================================================
// 4. DIGITAL WEIGHT SCALE BRIDGE (RS-232 / USB HID / WEB SERIAL)
// =============================================================

export interface DigitalScaleReading {
  grossWeightGrams: number;
  tareWeightGrams: number;
  netWeightGrams: number;
  isStable: boolean;
  status: 'STABLE' | 'MOTION' | 'OVERLOAD' | 'ZERO';
  timestamp: string;
}

/**
 * Creates simulated live RS232 / USB digital scale streaming session
 */
export function createDigitalScaleSession(
  targetWeightGrams = 650,
  tareWeightGrams = 25,
  onReading: (reading: DigitalScaleReading) => void
): { stop: () => void; tare: (grams?: number) => void; zero: () => void; setGross: (grams: number) => void } {
  let currentGross = targetWeightGrams;
  let currentTare = tareWeightGrams;
  let isStable = false;
  let step = 0;

  const intervalId = setInterval(() => {
    step++;
    // Simulate initial motion fluctuation, then stabilization after 3 ticks
    if (step < 3) {
      const jitter = (Math.random() - 0.5) * 12;
      const readingGross = Math.max(0, currentGross + jitter);
      const net = Math.max(0, readingGross - currentTare);
      onReading({
        grossWeightGrams: Math.round(readingGross),
        tareWeightGrams: currentTare,
        netWeightGrams: Math.round(net),
        isStable: false,
        status: 'MOTION',
        timestamp: new Date().toISOString(),
      });
    } else {
      isStable = true;
      const net = Math.max(0, currentGross - currentTare);
      onReading({
        grossWeightGrams: currentGross,
        tareWeightGrams: currentTare,
        netWeightGrams: net,
        isStable: true,
        status: currentGross === 0 ? 'ZERO' : 'STABLE',
        timestamp: new Date().toISOString(),
      });
    }
  }, 180);

  return {
    stop: () => clearInterval(intervalId),
    tare: (grams) => {
      currentTare = grams !== undefined ? grams : currentGross;
      step = 0;
    },
    zero: () => {
      currentGross = 0;
      currentTare = 0;
      step = 0;
    },
    setGross: (grams) => {
      currentGross = Math.max(0, grams);
      step = 0;
    },
  };
}
