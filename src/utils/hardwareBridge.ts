// POS Hardware & Peripheral Integration Layer
// Direct Thermal Receipt Printer (ESC/POS), Cash Drawer Kicks, Barcode Scanner Wedge, Digital Scale Catch-Weight

import type {
  POSHardwarePeripheralStatus,
  ThermalPrintReceiptPayload,
  POSReturnRecord,
} from '../types/index.ts';

export const INITIAL_HARDWARE_STATUS: POSHardwarePeripheralStatus = {
  thermalPrinter: {
    status: 'connected',
    model: 'Epson TM-T88VI Direct Thermal (ESC/POS)',
    paperWidthMm: 80,
    lastPrintedAt: new Date(Date.now() - 180000).toISOString(),
  },
  cashDrawer: {
    status: 'closed',
    kickPulseMs: 250,
    lastKickedAt: new Date(Date.now() - 360000).toISOString(),
  },
  barcodeScanner: {
    status: 'active_listening',
    interfaceType: 'USB-HID-Wedge',
    lastScannedBarcode: '8999909012345',
    lastScannedAt: new Date(Date.now() - 120000).toISOString(),
  },
  digitalScale: {
    status: 'stable',
    currentWeightGrams: 0,
    tareGrams: 0,
    unit: 'kg',
    isStable: true,
    lastStabilizedAt: new Date(Date.now() - 60000).toISOString(),
  },
};

/**
 * Generate formatted ASCII / ESC-POS text for 80mm or 58mm thermal receipts
 */
export function generateThermalReceiptText(payload: ThermalPrintReceiptPayload, paperWidthMm: 58 | 80 = 80): string {
  const colWidth = paperWidthMm === 58 ? 32 : 48;
  const divider = '='.repeat(colWidth);
  const thinDivider = '-'.repeat(colWidth);

  const padCenter = (str: string) => {
    const s = str.slice(0, colWidth);
    const pad = Math.max(0, Math.floor((colWidth - s.length) / 2));
    return ' '.repeat(pad) + s;
  };

  const padBetween = (left: string, right: string) => {
    const spaceCount = Math.max(1, colWidth - left.length - right.length);
    return left + ' '.repeat(spaceCount) + right;
  };

  const lines: string[] = [];
  lines.push(divider);
  lines.push(padCenter('GROCEMART ENTERPRISE ERP'));
  lines.push(padCenter(payload.storeName.toUpperCase()));
  lines.push(padCenter(payload.storeAddress));
  lines.push(padCenter('TEL: +62 21-5098-8888 | NIK/TIN: 01.345.678.9-012.000'));
  lines.push(divider);
  lines.push(padBetween(`RECEIPT: ${payload.receiptNumber}`, new Date(payload.timestamp).toLocaleDateString()));
  lines.push(padBetween(`CASHIER: ${payload.cashierName}`, new Date(payload.timestamp).toLocaleTimeString()));
  lines.push(thinDivider);
  lines.push(padBetween('ITEM & DESCRIPTION', 'AMOUNT'));
  lines.push(thinDivider);

  payload.items.forEach((item) => {
    const qtyStr = item.isWeighted
      ? `${(item.netWeightGrams! / 1000).toFixed(3)}kg @ Rp ${item.unitPrice.toLocaleString('id-ID')}/kg`
      : `${item.quantity} ${item.unit} @ Rp ${item.unitPrice.toLocaleString('id-ID')}`;
    lines.push(item.name.slice(0, colWidth));
    lines.push(padBetween(`  ${qtyStr}`, `Rp ${item.lineTotal.toLocaleString('id-ID')}`));
    if (item.discount && item.discount > 0) {
      lines.push(padBetween(`  (Promo Discount)`, `-Rp ${item.discount.toLocaleString('id-ID')}`));
    }
  });

  lines.push(thinDivider);
  lines.push(padBetween('SUBTOTAL:', `Rp ${payload.subtotal.toLocaleString('id-ID')}`));
  if (payload.discount > 0) {
    lines.push(padBetween('TOTAL PROMO SAVINGS:', `-Rp ${payload.discount.toLocaleString('id-ID')}`));
  }
  lines.push(padBetween('PPN 11% (VAT INCL):', `Rp ${payload.tax.toLocaleString('id-ID')}`));
  lines.push(divider);
  lines.push(padBetween('GRAND TOTAL IDR:', `Rp ${payload.total.toLocaleString('id-ID')}`));

  if (payload.currency !== 'IDR') {
    lines.push(padBetween(`CONVERTED (${payload.currency}):`, `${payload.currency} ${payload.currencyTotal.toFixed(2)}`));
  }

  lines.push(padBetween('PAYMENT METHOD:', payload.paymentMethod.toUpperCase()));
  if (payload.cashTendered !== undefined) {
    lines.push(padBetween('CASH TENDERED:', `Rp ${payload.cashTendered.toLocaleString('id-ID')}`));
    lines.push(padBetween('CHANGE RETURNED:', `Rp ${(payload.cashChange || 0).toLocaleString('id-ID')}`));
  }
  if (payload.qrisRef) {
    lines.push(padBetween('QRIS NTSN REF:', payload.qrisRef));
  }

  lines.push(divider);
  lines.push(padCenter('ALL FRESH PRODUCE CERTIFIED ORGANIC'));
  lines.push(padCenter(payload.footerNotes || '100% SATISFACTION OR 7-DAY RETURN GUARANTEE'));
  lines.push(padCenter('www.grocemart.id | customer@grocemart.id'));
  lines.push(divider);
  lines.push(''); // Feed paper
  lines.push(''); // Cut line

  return lines.join('\n');
}

/**
 * Generate formatted Return & Refund Receipt Slip
 */
export function generateReturnSlipText(returnRecord: POSReturnRecord, paperWidthMm: 58 | 80 = 80): string {
  const colWidth = paperWidthMm === 58 ? 32 : 48;
  const divider = '='.repeat(colWidth);
  const thinDivider = '-'.repeat(colWidth);

  const padCenter = (str: string) => {
    const s = str.slice(0, colWidth);
    const pad = Math.max(0, Math.floor((colWidth - s.length) / 2));
    return ' '.repeat(pad) + s;
  };

  const padBetween = (left: string, right: string) => {
    const spaceCount = Math.max(1, colWidth - left.length - right.length);
    return left + ' '.repeat(spaceCount) + right;
  };

  const lines: string[] = [];
  lines.push(divider);
  lines.push(padCenter('GROCEMART ENTERPRISE ERP'));
  lines.push(padCenter('*** OFFICIAL REFUND / RETURN SLIP ***'));
  lines.push(padCenter(returnRecord.storeName.toUpperCase()));
  lines.push(divider);
  lines.push(padBetween(`RETURN ID: ${returnRecord.id}`, new Date(returnRecord.timestamp).toLocaleDateString()));
  lines.push(padBetween(`ORIG RECEIPT: ${returnRecord.originalReceiptNumber}`, new Date(returnRecord.timestamp).toLocaleTimeString()));
  lines.push(padBetween(`CASHIER: ${returnRecord.processedByUserName}`, `REFUND: ${returnRecord.refundChannel}`));
  if (returnRecord.customerName) {
    lines.push(padBetween(`CUSTOMER: ${returnRecord.customerName}`, returnRecord.customerPhone || ''));
  }
  lines.push(thinDivider);
  lines.push(padBetween('RETURNED ITEMS', 'REFUND IDR'));
  lines.push(thinDivider);

  returnRecord.items.forEach((item) => {
    lines.push(`${item.returnQuantity}x ${item.productName}`);
    lines.push(padBetween(`  Reason: ${item.returnReason.replace(/_/g, ' ')}`, `Rp ${item.refundAmount.toLocaleString('id-ID')}`));
    lines.push(`  Disposition: [${item.disposition === 'RETURN_CAGE_WASTE' ? 'ROUTED TO WASTE CAGE' : 'RESTOCKED TO SHELF'}]`);
    if (item.conditionNotes) {
      lines.push(`  Notes: ${item.conditionNotes}`);
    }
  });

  lines.push(divider);
  lines.push(padBetween('TOTAL REFUNDED IDR:', `Rp ${returnRecord.totalRefundAmountIDR.toLocaleString('id-ID')}`));
  lines.push(padBetween('ACCOUNTING GL VOUCHERS:', returnRecord.glVoucherIds.join(', ')));
  if (returnRecord.wasteRecordId) {
    lines.push(padBetween('WASTE CAGE AUDIT ID:', returnRecord.wasteRecordId));
  }
  lines.push(divider);
  lines.push(padCenter('THANK YOU FOR YOUR PATRONAGE'));
  lines.push(padCenter('Audit record archived in GroceMart ERP Cloud'));
  lines.push(divider);
  lines.push('');
  lines.push('');

  return lines.join('\n');
}

/**
 * Electronic Cash Drawer Kick Command via Web Serial / Thermal Printer ESC/POS
 * ESC p m t1 t2 (27 112 0 25 250)
 */
export async function triggerPhysicalCashDrawerKick(): Promise<{
  success: boolean;
  pulseMs: number;
  timestamp: string;
}> {
  // Simulates pulse execution to direct hardware pin
  await new Promise((resolve) => setTimeout(resolve, 80));
  return {
    success: true,
    pulseMs: 250,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Digital Scale continuous weighing simulator / catch-weight parser
 */
export function parseScaleWeightData(rawGrams: number, tareGrams: number = 0): {
  grossGrams: number;
  tareGrams: number;
  netGrams: number;
  netKg: number;
  formattedKg: string;
} {
  const netGrams = Math.max(0, rawGrams - tareGrams);
  const netKg = Number((netGrams / 1000).toFixed(3));
  return {
    grossGrams: rawGrams,
    tareGrams,
    netGrams,
    netKg,
    formattedKg: `${netKg.toFixed(3)} kg`,
  };
}
