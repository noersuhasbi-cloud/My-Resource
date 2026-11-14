import type {
  CoretaxExportRow,
  IndonesianTaxCategory,
} from '../types/index.ts';

// ============================================================================
// 1. EAN-13 VARIABLE WEIGHT BARCODE GENERATOR & CHECKSUM (INDONESIAN SCALE)
// Format: [2-Digit Prefix (21)] + [5-Digit Item PLU] + [5-Digit Weight Grams] + [1-Digit EAN-13 Checksum]
// ============================================================================

export function calculateEan13CheckDigit(twelveDigits: string): string {
  const digits = twelveDigits.replace(/\D/g, '').padStart(12, '0').slice(0, 12);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const val = parseInt(digits[i], 10);
    // EAN-13 weights from left: odd positions (index 0,2,4...) x1, even positions (index 1,3,5...) x3
    sum += i % 2 === 0 ? val : val * 3;
  }
  const mod = sum % 10;
  return mod === 0 ? '0' : String(10 - mod);
}

/**
 * Derive a deterministic 5-digit numeric PLU from any SKU string (e.g. SKU-PRD-001 -> 00101)
 */
export function derivePlu5FromSku(sku: string): string {
  const explicitMap: Record<string, string> = {
    'SKU-PRD-001': '00101',
    'SKU-PRD-002': '00102',
    'SKU-PRD-003': '00103',
    'SKU-PRD-004': '00104',
    'SKU-PRD-005': '00105',
    'SKU-MEA-001': '00201',
    'SKU-MEA-002': '00202',
    'SKU-DAI-001': '00301',
    'SKU-DAI-002': '00302',
    'SKU-BAK-001': '00401',
    'SKU-BAK-002': '00402',
    'SKU-PAN-001': '00501',
    'SKU-PAN-002': '00502',
  };
  if (explicitMap[sku]) return explicitMap[sku];
  const digits = sku.replace(/\D/g, '');
  if (digits.length >= 5) return digits.slice(-5);
  if (digits.length > 0) return digits.padStart(5, '0');
  let hash = 0;
  for (let i = 0; i < sku.length; i++) {
    hash = (hash * 31 + sku.charCodeAt(i)) % 99999;
  }
  return String(Math.max(1, hash)).padStart(5, '0');
}

export function generateVariableWeightEan13(
  pluInput: string,
  weightGrams: number,
  prefix = '21'
): string {
  const cleanPrefix = (prefix || '21').replace(/\D/g, '').padStart(2, '2').slice(0, 2);
  const plu5 = /^\d{1,5}$/.test(pluInput.trim())
    ? pluInput.trim().padStart(5, '0')
    : derivePlu5FromSku(pluInput);
  const clampedGrams = Math.max(1, Math.min(99999, Math.round(weightGrams)));
  const grams5 = String(clampedGrams).padStart(5, '0');
  const twelve = `${cleanPrefix}${plu5}${grams5}`;
  const check = calculateEan13CheckDigit(twelve);
  return `${twelve}${check}`;
}

// EAN-13 bit patterns for crisp SVG vector bar rendering (95 modules)
const L_CODES = [
  '0001101', '0011001', '0010011', '0111101', '0100011',
  '0110001', '0101111', '0111011', '0110111', '0001011',
];
const G_CODES = [
  '0100111', '0110011', '0011011', '0100001', '0011101',
  '0111001', '0000101', '0010001', '0001001', '0010111',
];
const R_CODES = [
  '1110010', '1100110', '1101100', '1000010', '1011100',
  '1001110', '1010000', '1000100', '1001000', '1110100',
];
const PARITY_MAP = [
  'LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG',
  'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL',
];

export function encodeEan13Bars(ean13: string): string {
  const clean = ean13.replace(/\D/g, '').padStart(13, '0').slice(0, 13);
  const firstDigit = parseInt(clean[0], 10);
  const parity = PARITY_MAP[firstDigit] || 'LLLLLL';

  let bits = '101'; // Left guard
  for (let i = 1; i <= 6; i++) {
    const d = parseInt(clean[i], 10);
    bits += parity[i - 1] === 'L' ? L_CODES[d] : G_CODES[d];
  }
  bits += '01010'; // Center guard
  for (let i = 7; i <= 12; i++) {
    const d = parseInt(clean[i], 10);
    bits += R_CODES[d];
  }
  bits += '101'; // Right guard
  return bits;
}

// ============================================================================
// 2. INDONESIAN TAX ENGINE (PPN 11%/12%, SEMBAKO EXEMPT, PB1 10%, NPWP/NIK)
// ============================================================================

export function inferDefaultTaxCategory(category: string, productName = ''): IndonesianTaxCategory {
  const cat = (category || '').toLowerCase();
  const name = (productName || '').toLowerCase();
  if (
    cat === 'deli' ||
    cat === 'prepared_food' ||
    name.includes('ready-to-eat') ||
    name.includes('prepared') ||
    name.includes('salad bowl')
  ) {
    return 'NON_BKP_PB1';
  }
  if (
    cat === 'produce' ||
    cat === 'fresh_produce' ||
    cat === 'meat_seafood' ||
    cat === 'dairy_eggs' ||
    cat === 'pantry_staples' ||
    name.includes('beras') ||
    name.includes('rice') ||
    name.includes('telur') ||
    name.includes('egg') ||
    name.includes('daging') ||
    name.includes('beef') ||
    name.includes('chicken') ||
    name.includes('salmon') ||
    name.includes('sayur') ||
    name.includes('spinach') ||
    name.includes('avocado') ||
    name.includes('susu murni')
  ) {
    return 'BKP_DIBEBASKAN';
  }
  return 'BKP_STANDARD';
}

export function getTaxRateForCategory(category: IndonesianTaxCategory, ppnStandardRate = 11): number {
  if (category === 'BKP_DIBEBASKAN') return 0;
  if (category === 'NON_BKP_PB1') return 10;
  return ppnStandardRate;
}

export function computeIndonesianTax(
  grossOrNetAmountIDR: number,
  taxCategory: IndonesianTaxCategory,
  taxInclusive: boolean,
  ppnStandardRate = 11
): { dppIDR: number; ppnIDR: number; pb1IDR: number; totalIDR: number; ratePercent: number } {
  const rate = getTaxRateForCategory(taxCategory, ppnStandardRate);
  if (rate === 0) {
    const rounded = Math.round(grossOrNetAmountIDR);
    return { dppIDR: rounded, ppnIDR: 0, pb1IDR: 0, totalIDR: rounded, ratePercent: 0 };
  }

  let dppIDR = 0;
  let taxIDR = 0;
  let totalIDR = 0;

  if (taxInclusive) {
    totalIDR = Math.round(grossOrNetAmountIDR);
    dppIDR = Math.round(totalIDR / (1 + rate / 100));
    taxIDR = totalIDR - dppIDR;
  } else {
    dppIDR = Math.round(grossOrNetAmountIDR);
    taxIDR = Math.round((dppIDR * rate) / 100);
    totalIDR = dppIDR + taxIDR;
  }

  return {
    dppIDR,
    ppnIDR: taxCategory === 'BKP_STANDARD' ? taxIDR : 0,
    pb1IDR: taxCategory === 'NON_BKP_PB1' ? taxIDR : 0,
    totalIDR,
    ratePercent: rate,
  };
}

export function validateNpwpOrNik(raw: string): {
  valid: boolean;
  type: 'NPWP_16' | 'NIK_16' | 'NPWP_15' | 'INVALID';
  cleanDigits: string;
  formatted: string;
  error?: string;
} {
  const cleanDigits = (raw || '').replace(/\D/g, '');
  if (!cleanDigits) {
    return { valid: false, type: 'INVALID', cleanDigits: '', formatted: '', error: 'NPWP or NIK is required' };
  }
  if (/^0+$/.test(cleanDigits)) {
    return {
      valid: false,
      type: 'INVALID',
      cleanDigits,
      formatted: cleanDigits,
      error: 'NPWP/NIK cannot be all zeros for Faktur Pajak issuance',
    };
  }
  if (cleanDigits.length === 16) {
    // 16-digit Coretax NPWP / NIK format: XXXX.XXXX.XXXX.XXXX
    const formatted = cleanDigits.replace(/(\d{4})(\d{4})(\d{4})(\d{4})/, '$1.$2.$3.$4');
    const isNpwp16 = cleanDigits.startsWith('0');
    return {
      valid: true,
      type: isNpwp16 ? 'NPWP_16' : 'NIK_16',
      cleanDigits,
      formatted,
    };
  }
  if (cleanDigits.length === 15) {
    // Legacy 15-digit NPWP: XX.XXX.XXX.X-XXX.XXX (auto-convertible to 16-digit by prefixing 0)
    const formatted = cleanDigits.replace(/(\d{2})(\d{3})(\d{3})(\d{1})(\d{3})(\d{3})/, '$1.$2.$3.$4-$5.$6');
    return {
      valid: true,
      type: 'NPWP_15',
      cleanDigits,
      formatted,
    };
  }
  return {
    valid: false,
    type: 'INVALID',
    cleanDigits,
    formatted: cleanDigits,
    error: `Must be exactly 16 digits (Coretax NPWP/NIK) or 15 digits (Legacy NPWP). Got ${cleanDigits.length} digits.`,
  };
}

// ============================================================================
// 3. DJP CORETAX / E-FAKTUR CSV & XML BUILDERS
// ============================================================================

function escapeCsvCell(val: string | number): string {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function escapeXml(val: string | number): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildCoretaxCsv(rows: CoretaxExportRow[]): string {
  const headers = [
    'FK_TYPE',
    'KD_JENIS_TRANSAKSI',
    'NOMOR_DOKUMEN',
    'TANGGAL_DOKUMEN',
    'NPWP_NIK_LAWAN_TRANSAKSI',
    'VALID_NPWP_16',
    'NAMA_LAWAN_TRANSAKSI',
    'KATEGORI_PAJAK',
    'JUMLAH_DPP_IDR',
    'JUMLAH_PPN_IDR',
    'JUMLAH_PB1_IDR',
    'TOTAL_TRANSAKSI_IDR',
    'REFERENSI_ERP',
  ];

  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(
      [
        escapeCsvCell(r.documentType),
        escapeCsvCell(r.kodeTransaksi),
        escapeCsvCell(r.documentNumber),
        escapeCsvCell(r.documentDate.split('T')[0]),
        escapeCsvCell(r.npwpOrNik),
        escapeCsvCell(r.isNpwpValid ? 'VALID' : 'UNREGISTERED_DIGUNGGUNG'),
        escapeCsvCell(r.counterpartyName),
        escapeCsvCell(r.taxClassification),
        r.dppIDR,
        r.ppnIDR,
        r.pb1IDR,
        r.totalIDR,
        escapeCsvCell(r.referenceId),
      ].join(',')
    );
  }
  return lines.join('\n');
}

export function buildCoretaxXml(
  rows: CoretaxExportRow[],
  sellerNpwp = '01.884.229.1-011.000',
  sellerName = 'PT BUMI RETAIL SEJAHTERA (GROCEMART)'
): string {
  const now = new Date().toISOString();
  const taxInvoicesXml = rows
    .map(
      (r) => `    <TaxDocument>
      <DocumentType>${escapeXml(r.documentType)}</DocumentType>
      <TransactionCode>${escapeXml(r.kodeTransaksi)}</TransactionCode>
      <DocumentNumber>${escapeXml(r.documentNumber)}</DocumentNumber>
      <TaxInvoiceDate>${escapeXml(r.documentDate.split('T')[0])}</TaxInvoiceDate>
      <BuyerTIN>${escapeXml(r.npwpOrNik)}</BuyerTIN>
      <BuyerName>${escapeXml(r.counterpartyName)}</BuyerName>
      <TaxClassification>${escapeXml(r.taxClassification)}</TaxClassification>
      <TaxBase>${r.dppIDR}</TaxBase>
      <VAT>${r.ppnIDR}</VAT>
      <RegionalPB1>${r.pb1IDR}</RegionalPB1>
      <GrandTotal>${r.totalIDR}</GrandTotal>
      <ERPReference>${escapeXml(r.referenceId)}</ERPReference>
    </TaxDocument>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<TaxInvoiceBulk xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <TIN>${escapeXml(sellerNpwp.replace(/\D/g, '').padStart(16, '0'))}</TIN>
  <TaxpayerName>${escapeXml(sellerName)}</TaxpayerName>
  <GeneratedAt>${escapeXml(now)}</GeneratedAt>
  <ListOfTaxInvoice>
${taxInvoicesXml}
  </ListOfTaxInvoice>
</TaxInvoiceBulk>`;
}
