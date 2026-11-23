export function formatIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount).replace('Rp', 'Rp ');
}

export function generateOrderId(): string {
  const year = new Date().getFullYear();
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `GCM-${year}-${randomNum}`;
}

export function generateQrisReference(): string {
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let ref = 'QRIS-GCM-';
  for (let i = 0; i < 8; i++) {
    ref += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return ref;
}

export function isSafeLogoUrl(raw?: string | null): string | null {
  const val = String(raw || '').trim();
  if (!val) return null;
  if (/^(javascript|vbscript|data:text\/html|data:image\/svg\+xml)/i.test(val)) return null;
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(val)) {
    return val.length <= 2_800_000 ? val : null;
  }
  return /^https?:\/\/[^\s"'<>]+$/i.test(val) || /^\/[A-Za-z0-9._\-\/]+$/.test(val) ? val : null;
}

export function getCompanyMonogram(name?: string | null): string {
  const cleaned = String(name || '')
    .replace(/\b(PT|CV|TBK|UD|PD)\b/gi, '')
    .trim();
  if (!cleaned) return 'GM';
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}
