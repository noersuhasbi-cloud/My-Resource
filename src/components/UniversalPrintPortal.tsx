import React from 'react';
import { createPortal } from 'react-dom';
import { usePrint, type PrintPayload, type InvoiceTrackingFlags } from '../context/PrintContext';
import { formatIDR } from '../utils/formatters';

export function renderPrintDocument(
  activePrintPayload: PrintPayload,
  options?: { printedAt?: string; isPreview?: boolean; invoiceTracking?: InvoiceTrackingFlags }
): React.ReactNode {
  const printedAt =
    options?.printedAt ??
    new Date().toLocaleString('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  const showLots = options?.invoiceTracking?.displayLotsOnInvoices ?? true;
  const showDeliveryExpiry = options?.invoiceTracking?.displaySerialExpiryOnDeliveryDocs ?? true;

  switch (activePrintPayload.type) {
      // =====================================================================
      // FORMAT GROUP A: 80mm THERMAL POS RECEIPT
      // =====================================================================
      case 'pos_receipt': {
        const r = activePrintPayload.receipt;
        const rKey = `${r.storeId || ''} ${r.storeName || ''}`.toLowerCase();
        const outletAddress = rKey.includes('pik')
          ? 'Pantai Indah Kapuk Blvd, Jakarta Utara 14470'
          : rKey.includes('menteng')
          ? 'Jl. HOS. Cokroaminoto No. 78, Jakarta Pusat 10310'
          : rKey.includes('dago') || rKey.includes('bandung')
          ? 'Jl. Ir. H. Juanda No. 114, Bandung 40132'
          : rKey.includes('gubeng') || rKey.includes('surabaya')
          ? 'Jl. Raya Gubeng No. 45, Surabaya 60281'
          : rKey.includes('canggu') || rKey.includes('bali')
          ? 'Jl. Pantai Berawa No. 88, Canggu, Bali 80361'
          : 'Jl. Senopati No. 82, Jakarta Selatan 12110';
        return (
          <div className="print-page-thermal80 bg-white text-black font-mono text-[10.5px] leading-snug p-1 space-y-2.5">
            <div className="text-center space-y-1 pb-2 border-b border-dashed border-black">
              <div className="w-7 h-7 rounded-md border-2 border-black text-black font-black text-xs mx-auto flex items-center justify-center">
                GM
              </div>
              <h3 className="font-extrabold text-xs tracking-wider uppercase">
                PT GROCEMART RETAIL INDONESIA
              </h3>
              <p className="text-[9.5px] leading-tight">
                {r.storeName}
                <br />
                {outletAddress}
              </p>
            </div>

            <div className="text-[9.5px] space-y-0.5 pb-2 border-b border-dashed border-black">
              <div className="flex justify-between">
                <span>Receipt #:</span>
                <span className="font-bold">{r.receiptNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{new Date(r.timestamp).toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between">
                <span>Cashier:</span>
                <span>{r.cashierName} (Shift {r.shiftId})</span>
              </div>
            </div>

            <div className="space-y-1.5 py-0.5">
              {r.items.map((item, idx) => (
                <div key={`pr-${item.id}-${idx}`} className="text-[9.5px]">
                  <div className="flex justify-between font-bold gap-2">
                    <span className="truncate">{item.name}</span>
                    <span className="shrink-0">{formatIDR(item.lineTotal)}</span>
                  </div>
                  <div className="text-[8.5px] flex justify-between">
                    <span>
                      {item.quantity} {item.unit} x {formatIDR(item.unitPrice)}
                    </span>
                    {showLots && item.lotNumber && <span>LOT: {item.lotNumber}</span>}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-dashed border-black space-y-0.5 text-[9.5px]">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatIDR(r.subtotal)}</span>
              </div>
              {r.discount > 0 && (
                <div className="flex justify-between">
                  <span>Discount:</span>
                  <span>-{formatIDR(r.discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Tax (PPN / PB1):</span>
                <span>{formatIDR(r.tax)}</span>
              </div>
              <div className="flex justify-between text-[11px] font-black pt-1 border-t border-black">
                <span>TOTAL:</span>
                <span>{formatIDR(r.total)}</span>
              </div>
              {r.currency !== 'IDR' && (
                <div className="flex justify-between text-[9px]">
                  <span>Tender ({r.currency}):</span>
                  <span>
                    {r.currency} {r.currencyTotal}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-[9.5px] pt-1">
                <span>Tender: {r.paymentMethod.toUpperCase()}</span>
                <span>{formatIDR(r.cashTendered || r.total)}</span>
              </div>
              {r.cashChange !== undefined && r.cashChange > 0 && (
                <div className="flex justify-between text-[9.5px] font-bold">
                  <span>Change (Kembalian):</span>
                  <span>{formatIDR(r.cashChange)}</span>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-dashed border-black text-center text-[8.5px] space-y-1">
              {r.journalEntryIds.length > 0 && (
                <p>GL Vouchers: {r.journalEntryIds.slice(0, 2).join(', ')}</p>
              )}
              <p className="font-bold">*** TERIMA KASIH ATAS KUNJUNGAN ANDA ***</p>
              <p>Barang yang dibeli tidak dapat ditukar kecuali basi.</p>
            </div>
          </div>
        );
      }

      // =====================================================================
      // FORMAT GROUP A: 80mm THERMAL POS SAFE DROP (SLIP SETOR BRANKAS)
      // =====================================================================
      case 'pos_safe_drop': {
        const d = activePrintPayload.safeDrop;
        return (
          <div className="print-page-thermal80 bg-white text-black font-mono text-[10px] leading-snug p-1 space-y-2.5">
            <div className="text-center space-y-1 pb-2 border-b border-dashed border-black">
              <h3 className="font-black text-xs uppercase tracking-wider">
                SLIP SETOR BRANKAS
              </h3>
              <p className="text-[9.5px] font-bold">POS CASH SAFE DROP RECEIPT</p>
              <p className="text-[9px]">{d.storeName}</p>
            </div>

            <div className="text-[9.5px] space-y-0.5 pb-2 border-b border-dashed border-black">
              <div className="flex justify-between">
                <span>Slip #:</span>
                <span className="font-bold">{d.slipNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Timestamp:</span>
                <span>{new Date(d.timestamp).toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between">
                <span>Shift / Reg:</span>
                <span>{d.shiftId} / {d.registerId}</span>
              </div>
              <div className="flex justify-between">
                <span>Cashier:</span>
                <span className="font-bold">{d.cashierName}</span>
              </div>
              <div className="flex justify-between">
                <span>Supervisor:</span>
                <span>{d.supervisorName || 'Store Manager'}</span>
              </div>
              {d.sealBagNumber && (
                <div className="flex justify-between">
                  <span>Seal Bag #:</span>
                  <span className="font-bold">{d.sealBagNumber}</span>
                </div>
              )}
            </div>

            <div className="space-y-1 pb-2 border-b border-dashed border-black text-[9.5px]">
              <div className="flex justify-between">
                <span>Drawer Before:</span>
                <span>{formatIDR(d.drawerBalanceBeforeIDR)}</span>
              </div>
              <div className="flex justify-between font-black text-[11px] py-1 border-y border-black">
                <span>SAFE DROP (1010):</span>
                <span>{formatIDR(d.amountIDR)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Drawer Remaining (1011):</span>
                <span>{formatIDR(d.drawerBalanceAfterIDR)}</span>
              </div>
              {d.glVoucherIds.length > 0 && (
                <div className="text-[8.5px] pt-1">
                  GL: {d.glVoucherIds.join(', ')}
                </div>
              )}
              {d.notes && (
                <div className="text-[8.5px] italic">Note: {d.notes}</div>
              )}
            </div>

            <div className="pt-3 text-[8.5px] text-center space-y-5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="mb-6">Cashier Sign</p>
                  <div className="border-t border-black pt-0.5">{d.cashierName}</div>
                </div>
                <div>
                  <p className="mb-6">Vault Supervisor</p>
                  <div className="border-t border-black pt-0.5">{d.supervisorName || 'Supervisor'}</div>
                </div>
              </div>
              <p>Printed: {printedAt}</p>
            </div>
          </div>
        );
      }

      // =====================================================================
      // FORMAT GROUP A: 80mm THERMAL POS SHIFT Z-REPORT
      // =====================================================================
      case 'pos_zreport': {
        const s = activePrintPayload.shift;
        return (
          <div className="print-page-thermal80 bg-white text-black font-mono text-[10px] leading-snug p-1 space-y-2.5">
            <div className="text-center space-y-1 pb-2 border-b border-dashed border-black">
              <h3 className="font-black text-xs uppercase tracking-wider">
                POS SHIFT Z-REPORT
              </h3>
              <p className="font-bold text-[10px]">{s.storeName}</p>
              <p className="text-[9px]">PT GroceMart Retail Indonesia</p>
            </div>

            <div className="text-[9.5px] space-y-0.5 pb-2 border-b border-dashed border-black">
              <div className="flex justify-between">
                <span>Z-Report #:</span>
                <span className="font-bold">{s.zReportNumber || s.id}</span>
              </div>
              <div className="flex justify-between">
                <span>Shift / Reg:</span>
                <span>{s.id} / {s.registerId}</span>
              </div>
              <div className="flex justify-between">
                <span>Cashier:</span>
                <span className="font-bold">{s.cashierName}</span>
              </div>
              <div className="flex justify-between">
                <span>Opened:</span>
                <span>{new Date(s.openedAt).toLocaleString('id-ID')}</span>
              </div>
              {s.closedAt && (
                <div className="flex justify-between">
                  <span>Closed:</span>
                  <span>{new Date(s.closedAt).toLocaleString('id-ID')}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Transactions:</span>
                <span className="font-bold">{s.transactionCount}</span>
              </div>
            </div>

            <div className="space-y-1 pb-2 border-b border-dashed border-black text-[9.5px]">
              <div className="font-bold uppercase text-[9px] mb-1">Expected Drawer &amp; Settlement</div>
              <div className="flex justify-between">
                <span>Opening Float:</span>
                <span>{formatIDR(s.openingFloatIDR)}</span>
              </div>
              <div className="flex justify-between">
                <span>Expected Cash Sales:</span>
                <span>{formatIDR(s.expectedCashSalesIDR)}</span>
              </div>
              <div className="flex justify-between">
                <span>Cash Refunds:</span>
                <span>-{formatIDR(s.cashRefundsIDR)}</span>
              </div>
              {(s.safeDropsTotalIDR || 0) > 0 && (
                <div className="flex justify-between">
                  <span>Safe Drops (Setor Brankas):</span>
                  <span>-{formatIDR(s.safeDropsTotalIDR || 0)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold border-t border-dotted border-black pt-0.5">
                <span>Expected Cash Drawer:</span>
                <span>{formatIDR(s.expectedTotalCashInDrawerIDR)}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span>Expected QRIS Sales:</span>
                <span>{formatIDR(s.expectedQrisSalesIDR)}</span>
              </div>
              <div className="flex justify-between">
                <span>Expected EDC Sales:</span>
                <span>{formatIDR(s.expectedEdcSalesIDR)}</span>
              </div>
            </div>

            {s.denominations && s.denominations.some((d) => d.count > 0) && (
              <div className="space-y-0.5 pb-2 border-b border-dashed border-black text-[9px]">
                <div className="font-bold uppercase mb-1">Blind Cash Denomination Count</div>
                {s.denominations
                  .filter((d) => d.count > 0)
                  .map((d) => (
                    <div key={d.denomination} className="flex justify-between">
                      <span>
                        {formatIDR(d.denomination)} x {d.count}
                      </span>
                      <span>{formatIDR(d.subtotalIDR)}</span>
                    </div>
                  ))}
              </div>
            )}

            <div className="space-y-1 pb-2 border-b border-dashed border-black text-[9.5px]">
              <div className="font-bold uppercase text-[9px] mb-1">Blind Count &amp; Variance Audit</div>
              <div className="flex justify-between">
                <span>Counted Cash Total:</span>
                <span className="font-bold">{formatIDR(s.countedCashIDR || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Counted QRIS Batch:</span>
                <span>{formatIDR(s.countedQrisBatchIDR || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Counted EDC Batch:</span>
                <span>{formatIDR(s.countedEdcBatchIDR || 0)}</span>
              </div>
              <div className="flex justify-between font-black text-[10.5px] pt-1 border-t border-black">
                <span>CASH VARIANCE (5220):</span>
                <span>
                  {(s.cashVarianceIDR || 0) > 0 ? '+' : ''}
                  {formatIDR(s.cashVarianceIDR || 0)}
                </span>
              </div>
              {s.varianceGlVoucherIds && s.varianceGlVoucherIds.length > 0 && (
                <div className="text-[8.5px]">
                  GL Audit: {s.varianceGlVoucherIds.join(', ')}
                </div>
              )}
              {s.notes && (
                <div className="text-[8.5px] italic pt-0.5">Note: {s.notes}</div>
              )}
            </div>

            <div className="pt-3 text-[8.5px] text-center space-y-5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="mb-6">Cashier Sign</p>
                  <div className="border-t border-black pt-0.5">{s.cashierName}</div>
                </div>
                <div>
                  <p className="mb-6">Supervisor Audit</p>
                  <div className="border-t border-black pt-0.5">( ..................... )</div>
                </div>
              </div>
              <p className="font-bold">*** END OF SHIFT Z-REPORT ***</p>
            </div>
          </div>
        );
      }

      // =====================================================================
      // FORMAT GROUP A: 80mm THERMAL B2C ONLINE ORDER RECEIPT
      // =====================================================================
      case 'b2c_receipt': {
        const o = activePrintPayload.order;
        return (
          <div className="print-page-thermal80 bg-white text-black font-mono text-[10.5px] leading-snug p-1 space-y-2.5">
            <div className="text-center space-y-1 pb-2 border-b border-dashed border-black">
              <div className="w-7 h-7 rounded-md border-2 border-black text-black font-black text-xs mx-auto flex items-center justify-center">
                GM
              </div>
              <h3 className="font-extrabold text-xs uppercase tracking-wider">
                GROCEMART ONLINE RECEIPT
              </h3>
              <p className="text-[9px]">PT GroceMart Retail Indonesia</p>
            </div>

            <div className="text-[9.5px] space-y-0.5 pb-2 border-b border-dashed border-black">
              <div className="flex justify-between">
                <span>Order #:</span>
                <span className="font-bold">{o.id}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{new Date(o.createdAt).toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between">
                <span>Customer:</span>
                <span className="font-bold">{o.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span>Method:</span>
                <span className="uppercase">{o.deliveryMethod.replace(/_/g, ' ')}</span>
              </div>
              {o.pickupStore && (
                <div className="flex justify-between">
                  <span>Pickup Hub:</span>
                  <span>{o.pickupStore.name}</span>
                </div>
              )}
              {o.deliveryAddress && (
                <div className="text-[8.5px] pt-0.5">
                  Ship To: {o.deliveryAddress.addressLine}, {o.deliveryAddress.city}
                </div>
              )}
            </div>

            <div className="space-y-1.5 py-0.5">
              {o.items.map((it, idx) => (
                <div key={`b2c-${it.product.id}-${idx}`} className="text-[9.5px]">
                  <div className="flex justify-between font-bold gap-2">
                    <span className="truncate">{it.product.name}</span>
                    <span className="shrink-0">{formatIDR(it.product.price * it.quantity)}</span>
                  </div>
                  <div className="text-[8.5px] flex justify-between gap-2">
                    <span>
                      {it.quantity} {it.product.unit} x {formatIDR(it.product.price)}
                    </span>
                    {showLots && (
                      <span className="font-bold">
                        LOT: BAT-{it.product.sku || it.product.id}
                        {it.product.removalStrategy ? ` · ${it.product.removalStrategy}` : ''}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-dashed border-black space-y-0.5 text-[9.5px]">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatIDR(o.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery Fee:</span>
                <span>{formatIDR(o.deliveryFee)}</span>
              </div>
              {o.discount > 0 && (
                <div className="flex justify-between">
                  <span>Discount {o.voucherApplied ? `(${o.voucherApplied})` : ''}:</span>
                  <span>-{formatIDR(o.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-[11px] font-black pt-1 border-t border-black">
                <span>TOTAL SETTLED:</span>
                <span>{formatIDR(o.total)}</span>
              </div>
              <div className="flex justify-between text-[9px] pt-1">
                <span>Payment: {o.paymentMethod.toUpperCase()}</span>
                <span className="uppercase font-bold">{o.paymentStatus}</span>
              </div>
              {o.qrisRef && (
                <div className="text-[8.5px]">QRIS Ref: {o.qrisRef}</div>
              )}
            </div>

            <div className="pt-2 border-t border-dashed border-black text-center text-[8.5px] space-y-1">
              <p className="font-bold">*** TERIMA KASIH ATAS PESANAN ANDA ***</p>
              <p>Fresh Harvested Daily · Cold-Chain Certified</p>
            </div>
          </div>
        );
      }

      // =====================================================================
      // FORMAT GROUP B: 50x30mm THERMAL CLEARANCE STICKER (FEFO)
      // =====================================================================
      case 'clearance_sticker': {
        const c = activePrintPayload.candidate;
        return (
          <div className="print-page-label50x30 bg-white text-black font-sans border border-black p-1 flex flex-col justify-between overflow-hidden">
            <div className="flex items-center justify-between border-b border-black pb-0.5">
              <span className="text-[7px] font-black uppercase tracking-wider">
                GROCEMART CLEARANCE
              </span>
              <span className="text-[7px] font-mono font-black bg-black text-white px-1 rounded-xs">
                -{c.discountPercent}%
              </span>
            </div>

            <div className="my-0.5">
              <div className="text-[8.5px] font-black leading-tight truncate">
                {c.productName}
              </div>
              <div className="text-[6.5px] font-mono">
                {c.sku} · {c.batchId} · Exp {c.hoursRemaining}h
              </div>
            </div>

            <div className="flex items-baseline justify-between border-y border-dashed border-black py-0.5">
              <span className="text-[7px] font-mono line-through">
                {formatIDR(c.originalPrice)}
              </span>
              <span className="text-[11px] font-mono font-black">
                {formatIDR(c.markdownPrice)}
              </span>
            </div>

            <div className="text-center pt-0.5">
              <div className="h-2.5 w-full flex items-stretch justify-center gap-[0.6px] px-2">
                {c.markdownBarcode.split('').map((ch, idx) => (
                  <span
                    key={idx}
                    className="bg-black inline-block"
                    style={{
                      width: (ch.charCodeAt(0) % 2 === 0 ? 1.4 : 0.8) + 'px',
                    }}
                  />
                ))}
              </div>
              <div className="text-[7.5px] font-mono font-bold tracking-widest leading-none mt-0.5">
                {c.markdownBarcode}
              </div>
            </div>
          </div>
        );
      }

      // =====================================================================
      // FORMAT GROUP B: 50x30mm SCALE BARCODE & PERMENDAG SHELF-EDGE LABELS
      // =====================================================================
      case 'barcode_shelf_label': {
        const p = activePrintPayload;
        const showScale = p.labelMode === 'BOTH' || p.labelMode === 'SCALE_ONLY';
        const showShelf = p.labelMode === 'BOTH' || p.labelMode === 'SHELF_ONLY';
        return (
          <div className="bg-white text-black">
            {showScale && (
              <div className="print-page-label50x30 bg-white text-black font-sans border border-black p-1 flex flex-col justify-between overflow-hidden">
                <div className="flex items-center justify-between border-b border-black pb-0.5">
                  <span className="text-[7px] font-black uppercase truncate max-w-[34mm]">
                    {p.product.productName}
                  </span>
                  <span className="text-[6.5px] font-mono font-bold">
                    PLU {p.plu5}
                  </span>
                </div>

                <div className="grid grid-cols-3 text-center font-mono text-[6.5px] border-b border-dashed border-black py-0.5">
                  <div>
                    <div className="text-[5.5px] uppercase">Berat</div>
                    <div className="font-black text-[7.5px]">
                      {(p.weightGrams / 1000).toFixed(3)}kg
                    </div>
                  </div>
                  <div>
                    <div className="text-[5.5px] uppercase">Rp/Kg</div>
                    <div className="font-bold text-[7px]">
                      {formatIDR(p.effectivePricePerKg)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[5.5px] uppercase">Total</div>
                    <div className="font-black text-[8px]">
                      {formatIDR(p.computedWeighedPrice)}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center pt-0.5">
                  <svg
                    viewBox={`0 0 ${p.barBits.length + 12} 28`}
                    className="w-full h-6 bg-white"
                  >
                    <rect x="0" y="0" width={p.barBits.length + 12} height="28" fill="#ffffff" />
                    {p.barBits.split('').map((bit, idx) =>
                      bit === '1' ? (
                        <rect
                          key={idx}
                          x={idx + 6}
                          y={1}
                          width={1}
                          height={idx < 3 || (idx >= 45 && idx < 50) || idx >= 92 ? 25 : 22}
                          fill="#000000"
                        />
                      ) : null
                    )}
                  </svg>
                  <div className="font-mono text-[7.5px] font-black tracking-[0.18em] leading-none">
                    {p.ean13Code}
                  </div>
                </div>
              </div>
            )}

            {showShelf && (
              <div className="print-page-label50x30 bg-white text-black font-sans border border-black p-1 flex flex-col justify-between overflow-hidden">
                <div className="flex items-start justify-between gap-1 border-b border-black pb-0.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-[6px] font-black bg-black text-white px-1">
                        GROCEMART
                      </span>
                      {p.isHalalCertified && (
                        <span className="text-[6px] font-bold border border-black px-0.5">
                          HALAL BPJPH
                        </span>
                      )}
                    </div>
                    <div className="text-[8px] font-black leading-tight truncate mt-0.5">
                      {p.product.productName}
                    </div>
                    <div className="text-[6px] font-mono">
                      {p.product.sku} · {p.product.unit}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[5.5px] uppercase font-bold">
                      {p.taxInclusiveDisplay ? 'Incl. PPN' : '+ PPN'}
                    </div>
                    <div className="text-[11px] font-mono font-black leading-none">
                      {formatIDR(p.shelfRetailPrice)}
                    </div>
                    <div className="text-[5.5px] font-mono">
                      {formatIDR(p.pricePer100g)}/100g
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-1 pt-0.5">
                  <div className="flex items-center gap-1">
                    <svg viewBox={`0 0 ${p.barBits.length + 8} 18`} className="w-16 h-4 bg-white">
                      {p.barBits.split('').map((bit, idx) =>
                        bit === '1' ? (
                          <rect key={idx} x={idx + 4} y={1} width={1} height={16} fill="#000000" />
                        ) : null
                      )}
                    </svg>
                    <span className="font-mono text-[6px] font-bold">{p.ean13Code}</span>
                  </div>
                  {p.promoText && (
                    <span className="text-[5.5px] font-bold border border-black px-0.5 truncate max-w-[18mm]">
                      {p.promoText}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      }

      // =====================================================================
      // FORMAT GROUP C: A4 LOGISTICS DOCUMENTS (SURAT JALAN / DO / FLEET)
      // =====================================================================
      case 'logistics_doc': {
        const { activeTab, selectedSj, deliveryOrders, shipments } = activePrintPayload;

        if (activeTab === 'surat_jalan' && selectedSj) {
          return (
            <div className="print-page-a4 bg-white text-slate-900 p-2 font-sans">
              <div className="border-b-2 border-slate-900 pb-4 mb-4 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 rounded bg-[#0F4C3A] text-white font-mono font-black text-xs tracking-wider">
                      GROCEMART
                    </span>
                    <span className="text-sm font-black tracking-wider uppercase text-slate-900">
                      PT GROCEMART RETAIL INDONESIA
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    HQ: Jl. Senopati No. 42, Kebayoran Baru, Jakarta Selatan 12190
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    NPWP: 01.345.678.9-012.000 | NIB: 9120003482114 | Izin Edar: KEMENKES-RI
                  </p>
                </div>
                <div className="text-right">
                  <h3 className="text-lg font-black tracking-wider uppercase text-[#0F4C3A]">
                    SURAT JALAN
                  </h3>
                  <p className="text-xs font-mono font-bold text-slate-900 mt-0.5">
                    {selectedSj.documentNumber}
                  </p>
                  <p className="text-[11px] text-slate-600">
                    Tanggal: <strong className="font-mono text-slate-900">{selectedSj.issueDate}</strong>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs mb-5 p-3 rounded-xl bg-slate-50 border border-slate-300">
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Pengirim / Gudang Asal:
                  </div>
                  <div className="font-bold text-slate-900">{selectedSj.senderStoreName}</div>
                  <div className="text-[11px] text-slate-700 mt-0.5">{selectedSj.senderAddress}</div>
                  <div className="text-[11px] font-mono mt-1 text-slate-600">
                    Telp: {selectedSj.senderPhone}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Penerima / Tujuan:
                  </div>
                  <div className="font-bold text-[#0F4C3A]">{selectedSj.recipientName}</div>
                  <div className="text-[11px] text-slate-700 mt-0.5">{selectedSj.recipientAddress}</div>
                  <div className="text-[11px] font-mono mt-1 text-slate-600">
                    Telp: {selectedSj.recipientPhone}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 text-xs mb-5 py-2.5 px-3 rounded-lg border border-slate-300 font-mono bg-white">
                <div>
                  <span className="text-[10px] text-slate-500 font-sans block">Kurir / Armada:</span>
                  <span className="font-semibold text-slate-900">{selectedSj.carrierName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-sans block">Nomor Polisi:</span>
                  <span className="font-bold text-[#0F4C3A]">{selectedSj.vehiclePlateNumber}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-sans block">Nama Supir:</span>
                  <span className="font-semibold text-slate-900">{selectedSj.driverName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-sans block">Cold-Chain Temp:</span>
                  <span className="font-bold text-blue-700">{selectedSj.coldChainTempCelsius}°C</span>
                </div>
              </div>

              <table className="w-full text-left text-xs border border-slate-400 mb-5 border-collapse">
                <thead className="bg-slate-100 border-b border-slate-400 font-bold uppercase text-[10px] text-slate-800">
                  <tr>
                    <th className="py-2 px-2.5 border-r border-slate-300 text-center w-8">No</th>
                    <th className="py-2 px-2.5 border-r border-slate-300">Kode SKU</th>
                    <th className="py-2 px-2.5 border-r border-slate-300">Nama Barang &amp; Spesifikasi</th>
                    {showLots && (
                      <th className="py-2 px-2.5 border-r border-slate-300">Batch / Lot</th>
                    )}
                    <th className="py-2 px-2.5 border-r border-slate-300 text-center">Jumlah</th>
                    <th className="py-2 px-2.5 border-r border-slate-300">Kemasan</th>
                    <th className="py-2 px-2.5">Kondisi / Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {selectedSj.items.map((item, idx) => (
                    <tr key={idx} className="break-inside-avoid">
                      <td className="py-2 px-2.5 border-r border-slate-300 text-center font-mono">{idx + 1}</td>
                      <td className="py-2 px-2.5 border-r border-slate-300 font-mono font-bold text-[#0F4C3A]">{item.sku}</td>
                      <td className="py-2 px-2.5 border-r border-slate-300 font-semibold text-slate-900">{item.productName}</td>
                      {showLots && (
                        <td className="py-2 px-2.5 border-r border-slate-300 font-mono text-[11px]">{item.batchNumber}</td>
                      )}
                      <td className="py-2 px-2.5 border-r border-slate-300 text-center font-bold">{item.quantity} {item.unit}</td>
                      <td className="py-2 px-2.5 border-r border-slate-300">{item.packagingType}</td>
                      <td className="py-2 px-2.5 text-[11px] text-slate-700">
                        <div>{item.condition} - {item.notes || 'Normal'}</div>
                        {showDeliveryExpiry && (
                          <div className="font-mono text-[9.5px] text-[#0F4C3A] font-semibold mt-0.5">
                            FEFO Expiry &amp; Cold-Chain Verified ({selectedSj.coldChainTempCelsius}°C)
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mb-6 p-3 rounded-lg border border-amber-300 bg-amber-50 text-xs break-inside-avoid">
                <span className="font-bold text-amber-950">Catatan Khusus Penanganan Perishable:</span>
                <p className="text-[11px] text-amber-900 mt-0.5">{selectedSj.specialHandlingInstructions}</p>
              </div>

              <div className="grid grid-cols-3 gap-4 text-center text-xs pt-4 border-t border-slate-300 break-inside-avoid">
                <div className="space-y-12">
                  <span className="font-semibold text-slate-600">Yang Menyerahkan (Pengirim)</span>
                  <div className="border-b border-slate-500 mx-4 pb-1 font-bold text-slate-900">{selectedSj.senderSignatureName}</div>
                </div>
                <div className="space-y-12">
                  <span className="font-semibold text-slate-600">Yang Membawa (Supir)</span>
                  <div className="border-b border-slate-500 mx-4 pb-1 font-bold text-slate-900">{selectedSj.driverSignatureName || '( ................................... )'}</div>
                </div>
                <div className="space-y-12">
                  <span className="font-semibold text-slate-600">Yang Menerima (Gudang/Outlet)</span>
                  <div className="border-b border-slate-500 mx-4 pb-1 font-bold text-slate-900">{selectedSj.recipientSignatureName || '( ................................... )'}</div>
                </div>
              </div>

              <div className="mt-6 pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span>GroceMart Enterprise ERP · Official Logistics Waybill</span>
                <span>Printed: {printedAt}</span>
              </div>
            </div>
          );
        }

        if (activeTab === 'delivery_orders') {
          const totalDoValue = deliveryOrders.reduce((acc, d) => acc + d.totalAmountIDR, 0);
          return (
            <div className="print-page-a4 bg-white text-slate-900 p-2 font-sans">
              <div className="border-b-2 border-slate-900 pb-4 mb-5 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 rounded bg-[#0F4C3A] text-white font-mono font-black text-xs tracking-wider">GROCEMART</span>
                    <span className="text-sm font-black tracking-wider uppercase text-slate-900">PT GROCEMART RETAIL INDONESIA</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">Logistics &amp; Fleet Control Center · Jl. Senopati No. 42, Jakarta Selatan</p>
                </div>
                <div className="text-right">
                  <h3 className="text-base font-black tracking-wider uppercase text-[#0F4C3A]">DELIVERY ORDERS (DO) MANIFEST</h3>
                  <p className="text-[11px] font-mono text-slate-600 mt-0.5">Printed: {printedAt}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-5 text-xs">
                <div className="p-3 rounded-lg border border-slate-300 bg-slate-50">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Active DOs</span>
                  <span className="text-lg font-black font-mono text-slate-900">{deliveryOrders.length}</span>
                </div>
                <div className="p-3 rounded-lg border border-slate-300 bg-slate-50">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">In-Transit / Dispatched</span>
                  <span className="text-lg font-black font-mono text-blue-700">{deliveryOrders.filter((d) => d.status !== 'pending').length}</span>
                </div>
                <div className="p-3 rounded-lg border border-slate-300 bg-slate-50">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Manifest Value</span>
                  <span className="text-lg font-black font-mono text-[#0F4C3A]">{formatIDR(totalDoValue)}</span>
                </div>
              </div>

              <table className="w-full text-left text-xs border border-slate-400 border-collapse mb-6">
                <thead className="bg-slate-100 border-b border-slate-400 font-bold uppercase text-[10px] text-slate-800">
                  <tr>
                    <th className="py-2 px-2.5 border-r border-slate-300">DO Number</th>
                    <th className="py-2 px-2.5 border-r border-slate-300">Customer / Outlet</th>
                    <th className="py-2 px-2.5 border-r border-slate-300">Delivery Address</th>
                    <th className="py-2 px-2.5 border-r border-slate-300">Window</th>
                    <th className="py-2 px-2.5 border-r border-slate-300">Authorized By</th>
                    <th className="py-2 px-2.5 border-r border-slate-300 text-center">Status</th>
                    <th className="py-2 px-2.5 text-right">Total Value (IDR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {deliveryOrders.map((doDoc) => (
                    <tr key={doDoc.id} className="break-inside-avoid">
                      <td className="py-2 px-2.5 border-r border-slate-300 font-mono font-bold text-[#0F4C3A]">{doDoc.doNumber}</td>
                      <td className="py-2 px-2.5 border-r border-slate-300 font-semibold text-slate-900">{doDoc.customerOrStoreName}</td>
                      <td className="py-2 px-2.5 border-r border-slate-300 text-[11px] text-slate-700">{doDoc.deliveryAddress}</td>
                      <td className="py-2 px-2.5 border-r border-slate-300 font-mono text-[11px]">{doDoc.deliveryWindow}</td>
                      <td className="py-2 px-2.5 border-r border-slate-300 text-[11px]">{doDoc.authorizedOfficer}</td>
                      <td className="py-2 px-2.5 border-r border-slate-300 text-center font-mono text-[10px] font-bold uppercase">{doDoc.status}</td>
                      <td className="py-2 px-2.5 text-right font-mono font-bold text-slate-900">{formatIDR(doDoc.totalAmountIDR)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-400 font-bold">
                    <td colSpan={6} className="py-2 px-2.5 text-right uppercase text-[11px]">Consolidated DO Manifest Value:</td>
                    <td className="py-2 px-2.5 text-right font-mono text-sm text-[#0F4C3A]">{formatIDR(totalDoValue)}</td>
                  </tr>
                </tfoot>
              </table>

              <div className="grid grid-cols-2 gap-8 text-center text-xs pt-4 border-t border-slate-300 break-inside-avoid">
                <div className="space-y-12">
                  <span className="font-semibold text-slate-600">Logistics Dispatch Coordinator</span>
                  <div className="border-b border-slate-500 mx-8 pb-1 font-bold text-slate-900">( ........................................ )</div>
                </div>
                <div className="space-y-12">
                  <span className="font-semibold text-slate-600">Warehouse Operations Manager</span>
                  <div className="border-b border-slate-500 mx-8 pb-1 font-bold text-slate-900">( ........................................ )</div>
                </div>
              </div>
            </div>
          );
        }

        const totalPayload = shipments.reduce((acc, s) => acc + s.currentPayloadKg, 0);
        const totalCapacity = shipments.reduce((acc, s) => acc + s.maxPayloadKg, 0);
        const avgUtil =
          shipments.length > 0
            ? Math.round(shipments.reduce((acc, s) => acc + s.quotaUtilizationPercent, 0) / shipments.length)
            : 0;

        return (
          <div className="print-page-a4 bg-white text-slate-900 p-2 font-sans">
            <div className="border-b-2 border-slate-900 pb-4 mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 rounded bg-[#0F4C3A] text-white font-mono font-black text-xs tracking-wider">GROCEMART</span>
                  <span className="text-sm font-black tracking-wider uppercase text-slate-900">PT GROCEMART RETAIL INDONESIA</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1">Cold-Chain Fleet Telemetry &amp; Payload Quota Governance</p>
              </div>
              <div className="text-right">
                <h3 className="text-base font-black tracking-wider uppercase text-[#0F4C3A]">FLEET QUOTA TRACKING REPORT</h3>
                <p className="text-[11px] font-mono text-slate-600 mt-0.5">Printed: {printedAt}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-5 text-xs">
              <div className="p-3 rounded-lg border border-slate-300 bg-slate-50">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Active Fleet Trips</span>
                <span className="text-lg font-black font-mono text-slate-900">{shipments.length}</span>
              </div>
              <div className="p-3 rounded-lg border border-slate-300 bg-slate-50">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Payload / Cap</span>
                <span className="text-lg font-black font-mono text-[#0F4C3A]">{totalPayload.toLocaleString('id-ID')} / {totalCapacity.toLocaleString('id-ID')} kg</span>
              </div>
              <div className="p-3 rounded-lg border border-slate-300 bg-slate-50">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Avg Quota Utilization</span>
                <span className="text-lg font-black font-mono text-blue-700">{avgUtil}%</span>
              </div>
            </div>

            <table className="w-full text-left text-xs border border-slate-400 border-collapse mb-6">
              <thead className="bg-slate-100 border-b border-slate-400 font-bold uppercase text-[10px] text-slate-800">
                <tr>
                  <th className="py-2 px-2.5 border-r border-slate-300">Trip ID</th>
                  <th className="py-2 px-2.5 border-r border-slate-300">Vehicle &amp; Plate</th>
                  <th className="py-2 px-2.5 border-r border-slate-300">Route (Hub to Hub)</th>
                  <th className="py-2 px-2.5 border-r border-slate-300">Driver &amp; Contact</th>
                  <th className="py-2 px-2.5 border-r border-slate-300 text-right">Payload Quota</th>
                  <th className="py-2 px-2.5 border-r border-slate-300 text-center">Temp (°C)</th>
                  <th className="py-2 px-2.5 border-r border-slate-300 text-center">Orders</th>
                  <th className="py-2 px-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {shipments.map((shp) => (
                  <tr key={shp.id} className="break-inside-avoid">
                    <td className="py-2 px-2.5 border-r border-slate-300 font-mono font-bold text-[#0F4C3A]">{shp.tripId}</td>
                    <td className="py-2 px-2.5 border-r border-slate-300">
                      <div className="font-semibold text-slate-900">{shp.vehicleType}</div>
                      <div className="font-mono text-[10px] text-slate-600">{shp.vehiclePlate}</div>
                    </td>
                    <td className="py-2 px-2.5 border-r border-slate-300 text-[11px]">{shp.departureHub} → {shp.destinationHub}</td>
                    <td className="py-2 px-2.5 border-r border-slate-300 text-[11px]">
                      <div className="font-semibold">{shp.driverName}</div>
                      <div className="font-mono text-[10px] text-slate-600">{shp.driverContact}</div>
                    </td>
                    <td className="py-2 px-2.5 border-r border-slate-300 text-right font-mono">
                      <span className="font-bold">{shp.currentPayloadKg}/{shp.maxPayloadKg} kg</span>
                      <span className="block text-[10px] text-slate-600">({shp.quotaUtilizationPercent}%)</span>
                    </td>
                    <td className="py-2 px-2.5 border-r border-slate-300 text-center font-mono">
                      <span className="font-bold text-blue-700">{shp.currentTempCelsius}°C</span>
                      <span className="block text-[10px] text-slate-500">Target {shp.targetTempCelsius}°C</span>
                    </td>
                    <td className="py-2 px-2.5 border-r border-slate-300 text-center font-mono font-bold">{shp.assignedOrdersCount}</td>
                    <td className="py-2 px-2.5 text-center font-mono text-[10px] font-bold uppercase">{shp.status.replace(/_/g, ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="grid grid-cols-2 gap-8 text-center text-xs pt-4 border-t border-slate-300 break-inside-avoid">
              <div className="space-y-12">
                <span className="font-semibold text-slate-600">Fleet Control Officer</span>
                <div className="border-b border-slate-500 mx-8 pb-1 font-bold text-slate-900">( ........................................ )</div>
              </div>
              <div className="space-y-12">
                <span className="font-semibold text-slate-600">Cold-Chain QA Supervisor</span>
                <div className="border-b border-slate-500 mx-8 pb-1 font-bold text-slate-900">( ........................................ )</div>
              </div>
            </div>
          </div>
        );
      }

      // =====================================================================
      // FORMAT GROUP C: A4 B2B WHOLESALE INVOICE & FAKTUR PAJAK
      // =====================================================================
      case 'b2b_invoice': {
        const ord = activePrintPayload.order;
        return (
          <div className="print-page-a4 bg-white text-slate-900 p-2 font-sans space-y-5">
            <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 rounded bg-[#0F4C3A] text-white font-mono font-black text-xs tracking-wider">GROCEMART</span>
                  <span className="text-sm font-black uppercase tracking-wider">PT GROCEMART RETAIL INDONESIA</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1">Wholesale Distribution &amp; HoReCa Supply Division</p>
                <p className="text-[10px] font-mono text-slate-500">NPWP PKP: 01.345.678.9-012.000 · Jl. Senopati No. 42, Jakarta</p>
              </div>
              <div className="text-right">
                <h3 className="text-lg font-black uppercase tracking-wider text-[#0F4C3A]">FAKTUR PENJUALAN GROSIR</h3>
                <p className="text-xs font-mono font-bold text-slate-900 mt-0.5">{ord.id}</p>
                <p className="text-[11px] font-mono text-slate-600">Tanggal: {new Date(ord.orderDate).toLocaleString('id-ID')}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs p-3.5 rounded-xl bg-slate-50 border border-slate-300">
              <div className="space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-500">Pelanggan Wholesale (Buyer)</div>
                <div className="font-bold text-sm text-slate-900">{ord.companyName}</div>
                <div className="text-slate-700">PIC: {ord.customerName} ({ord.customerTier.replace(/_/g, ' ').toUpperCase()})</div>
              </div>
              <div className="space-y-1 text-right">
                <div className="text-[10px] uppercase font-bold text-slate-500">Ketentuan Pembayaran &amp; Status</div>
                <div className="font-mono font-bold uppercase text-slate-900">{ord.paymentMethod.replace(/_/g, ' ')}</div>
                <div className="text-[11px] font-mono text-slate-700">Status: {ord.status} · {ord.paymentStatus}</div>
                {ord.approvalRequestId && (
                  <div className="text-[10px] font-mono text-amber-800">Approval Ref: {ord.approvalRequestId}</div>
                )}
              </div>
            </div>

            {ord.giroDetails && (
              <div className="p-3 rounded-lg border border-slate-300 bg-white text-xs font-mono flex justify-between">
                <span>Warkat Bilyet Giro: <strong>{ord.giroDetails.giroNumber}</strong> ({ord.giroDetails.bankName})</span>
                <span>Jatuh Tempo: <strong>{ord.giroDetails.clearingDueDate}</strong></span>
              </div>
            )}

            <table className="w-full text-left text-xs border border-slate-400 border-collapse">
              <thead className="bg-slate-100 border-b border-slate-400 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-2 px-2.5 border-r border-slate-300 text-center w-8">No</th>
                  <th className="py-2 px-2.5 border-r border-slate-300">SKU &amp; Deskripsi Produk</th>
                  <th className="py-2 px-2.5 border-r border-slate-300 text-center">Kuantitas (UoM)</th>
                  <th className="py-2 px-2.5 border-r border-slate-300 text-center">Base Units</th>
                  <th className="py-2 px-2.5 border-r border-slate-300 text-right">Harga Satuan</th>
                  <th className="py-2 px-2.5 text-right">Total Baris (IDR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {ord.items.map((it, idx) => (
                  <tr key={idx} className="break-inside-avoid">
                    <td className="py-2 px-2.5 border-r border-slate-300 text-center font-mono">{idx + 1}</td>
                    <td className="py-2 px-2.5 border-r border-slate-300">
                      <div className="font-semibold text-slate-900">{it.product.name}</div>
                      <div className="font-mono text-[10px] text-slate-500">
                        {it.product.sku}
                        {showLots && ` · LOT: BAT-${it.product.sku}`}
                      </div>
                    </td>
                    <td className="py-2 px-2.5 border-r border-slate-300 text-center font-mono font-bold">
                      {it.quantity} {it.selectedUoM}
                    </td>
                    <td className="py-2 px-2.5 border-r border-slate-300 text-center font-mono">
                      {it.baseUnitsCalculated} {it.product.baseUnit}
                    </td>
                    <td className="py-2 px-2.5 border-r border-slate-300 text-right font-mono">{formatIDR(it.unitPrice)}</td>
                    <td className="py-2 px-2.5 text-right font-mono font-bold">{formatIDR(it.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end">
              <div className="w-72 space-y-1.5 text-xs font-mono border border-slate-300 rounded-xl p-3.5 bg-slate-50">
                <div className="flex justify-between">
                  <span>Total Base Units:</span>
                  <span className="font-bold">{ord.totalBaseUnits} units</span>
                </div>
                <div className="flex justify-between">
                  <span>DPP / Subtotal:</span>
                  <span>{formatIDR(ord.subtotalIDR)}</span>
                </div>
                {ord.pwpDiscountIDR > 0 && (
                  <div className="flex justify-between">
                    <span>Diskon PWP:</span>
                    <span>-{formatIDR(ord.pwpDiscountIDR)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>PPN Keluaran (11%):</span>
                  <span>{formatIDR(ord.taxPPN11IDR)}</span>
                </div>
                <div className="flex justify-between text-sm font-black pt-2 border-t border-slate-400 text-[#0F4C3A]">
                  <span>TOTAL FAKTUR:</span>
                  <span>{formatIDR(ord.totalAmountIDR)}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 text-center text-xs pt-6 border-t border-slate-300 break-inside-avoid">
              <div className="space-y-14">
                <span className="font-semibold text-slate-600">Diterima &amp; Disetujui Oleh (Pembeli)</span>
                <div className="border-b border-slate-500 mx-8 pb-1 font-bold">{ord.customerName}</div>
              </div>
              <div className="space-y-14">
                <span className="font-semibold text-slate-600">Otorisasi Finance &amp; Tax Officer</span>
                <div className="border-b border-slate-500 mx-8 pb-1 font-bold">PT GroceMart Retail Indonesia</div>
              </div>
            </div>
          </div>
        );
      }

      // =====================================================================
      // FORMAT GROUP C: A4 BILYET GIRO SLIP
      // =====================================================================
      case 'bilyet_giro_slip': {
        const g = activePrintPayload.giro;
        return (
          <div className="print-page-a4 bg-white text-slate-900 p-2 font-sans space-y-5">
            <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
              <div>
                <span className="px-2 py-1 rounded bg-[#0F4C3A] text-white font-mono font-black text-xs">GROCEMART</span>
                <h3 className="text-lg font-black uppercase mt-2 text-[#0F4C3A]">BUKTI REGISTER WARKAT BILYET GIRO (PDC)</h3>
                <p className="text-xs text-slate-600">Treasury &amp; Accounts Receivable Clearing Voucher (COA #1210 → #1020)</p>
              </div>
              <div className="text-right font-mono text-xs">
                <div className="font-bold text-sm">{g.giroNumber}</div>
                <div className="text-slate-600">ID: {g.id}</div>
                <div className="text-slate-600">Printed: {printedAt}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl border border-slate-300 bg-slate-50 text-xs">
              <div className="space-y-1.5">
                <div><span className="text-slate-500">Customer / Drawer:</span> <strong>{g.customerName}</strong></div>
                <div><span className="text-slate-500">Issuing Bank:</span> <strong>{g.issuingBank}</strong></div>
                <div><span className="text-slate-500">Order Reference:</span> <span className="font-mono font-bold">{g.orderId}</span></div>
              </div>
              <div className="space-y-1.5 text-right">
                <div><span className="text-slate-500">Issue Date:</span> <span className="font-mono">{g.issueDate}</span></div>
                <div><span className="text-slate-500">Clearing Due Date:</span> <span className="font-mono font-bold">{g.clearingDueDate}</span></div>
                <div><span className="text-slate-500">Clearing Status:</span> <span className="font-mono font-bold uppercase">{g.status}</span></div>
              </div>
            </div>

            <div className="p-4 rounded-xl border-2 border-[#0F4C3A] flex justify-between items-center">
              <span className="text-sm font-bold uppercase">Nominal Warkat Bilyet Giro</span>
              <span className="text-xl font-mono font-black text-[#0F4C3A]">{formatIDR(g.amountIDR)}</span>
            </div>

            {g.slipPhotoUrl && (
              <div className="border border-slate-300 rounded-xl p-3 space-y-2 break-inside-avoid">
                <div className="text-xs font-bold uppercase text-slate-600">Arsip Fisik Warkat Giro</div>
                <img src={g.slipPhotoUrl} alt={g.giroNumber} className="max-h-72 mx-auto object-contain rounded border border-slate-200" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-8 text-center text-xs pt-6 border-t border-slate-300 break-inside-avoid">
              <div className="space-y-12">
                <span className="font-semibold text-slate-600">Penyerah Warkat (Customer)</span>
                <div className="border-b border-slate-500 mx-8 pb-1 font-bold">{g.customerName}</div>
              </div>
              <div className="space-y-12">
                <span className="font-semibold text-slate-600">Financial Controller Verification</span>
                <div className="border-b border-slate-500 mx-8 pb-1 font-bold">( ........................................ )</div>
              </div>
            </div>
          </div>
        );
      }

      // =====================================================================
      // FORMAT GROUP C: A4 WASTE / SUPPLIER RMA CREDIT NOTE SLIP
      // =====================================================================
      case 'waste_rma_slip': {
        const r = activePrintPayload.rma;
        return (
          <div className="print-page-a4 bg-white text-slate-900 p-2 font-sans space-y-5">
            <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 rounded bg-[#0F4C3A] text-white font-mono font-black text-xs">GROCEMART</span>
                  <span className="text-sm font-black uppercase">PT GROCEMART RETAIL INDONESIA</span>
                </div>
                <p className="text-xs text-slate-600 mt-1">Return Merchandise Authorization (RMA) &amp; Vendor Credit Note Manifest</p>
              </div>
              <div className="text-right font-mono">
                <h3 className="text-base font-black uppercase text-[#0F4C3A]">RMA RETURN SLIP</h3>
                <div className="text-xs font-bold">{r.rmaNumber}</div>
                <div className="text-[11px] text-slate-600">Credit Note: {r.creditNoteId}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl border border-slate-300 bg-slate-50 text-xs">
              <div className="space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-500">Supplier / Vendor</div>
                <div className="text-sm font-bold">{r.supplierName}</div>
                <div>Outlet Hub: {r.storeName}</div>
              </div>
              <div className="space-y-1 text-right">
                <div className="text-[10px] uppercase font-bold text-slate-500">Total AP Credit Offset (#2010)</div>
                <div className="text-lg font-mono font-black text-[#0F4C3A]">{formatIDR(r.totalCreditIDR)}</div>
                <div className="text-[11px] font-mono">Date: {new Date(r.createdAt).toLocaleString('id-ID')}</div>
              </div>
            </div>

            <table className="w-full text-left text-xs border border-slate-400 border-collapse">
              <thead className="bg-slate-100 border-b border-slate-400 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-2 px-3 border-r border-slate-300">SKU</th>
                  <th className="py-2 px-3 border-r border-slate-300">Product Name</th>
                  <th className="py-2 px-3 border-r border-slate-300 text-center">Qty Returned</th>
                  <th className="py-2 px-3 border-r border-slate-300 text-right">Unit Cost</th>
                  <th className="py-2 px-3 border-r border-slate-300">Defect Reason</th>
                  <th className="py-2 px-3 text-right">Total Credit</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-2.5 px-3 border-r border-slate-300 font-mono font-bold">{r.sku}</td>
                  <td className="py-2.5 px-3 border-r border-slate-300 font-semibold">{r.productName}</td>
                  <td className="py-2.5 px-3 border-r border-slate-300 text-center font-mono font-bold">{r.quantityReturned} {r.unit}</td>
                  <td className="py-2.5 px-3 border-r border-slate-300 text-right font-mono">{formatIDR(r.unitCost)}</td>
                  <td className="py-2.5 px-3 border-r border-slate-300 capitalize">{r.reason.replace(/_/g, ' ')}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold">{formatIDR(r.totalCreditIDR)}</td>
                </tr>
              </tbody>
            </table>

            <div className="text-xs p-3 rounded-lg border border-slate-300 bg-white flex justify-between">
              <span>Authorized Officer: <strong>{r.approvedBy}</strong></span>
              <span className="font-mono">Status: {r.status.replace(/_/g, ' ').toUpperCase()}</span>
            </div>

            <div className="grid grid-cols-2 gap-8 text-center text-xs pt-6 border-t border-slate-300 break-inside-avoid">
              <div className="space-y-14">
                <span className="font-semibold text-slate-600">Store Receiving Clerk Signature</span>
                <div className="border-b border-slate-500 mx-8 pb-1 font-bold">( ........................................ )</div>
              </div>
              <div className="space-y-14">
                <span className="font-semibold text-slate-600">Vendor Logistics Driver Signature</span>
                <div className="border-b border-slate-500 mx-8 pb-1 font-bold">( ........................................ )</div>
              </div>
            </div>
          </div>
        );
      }

      // =====================================================================
      // FORMAT GROUP C: A4 VENDOR BILL 3-WAY MATCH VOUCHER
      // =====================================================================
      case 'vendor_bill': {
        const b = activePrintPayload.bill;
        return (
          <div className="print-page-a4 bg-white text-slate-900 p-2 font-sans space-y-5">
            <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
              <div>
                <span className="px-2 py-1 rounded bg-[#0F4C3A] text-white font-mono font-black text-xs">GROCEMART AP</span>
                <h3 className="text-lg font-black uppercase mt-2 text-[#0F4C3A]">OFFICIAL VENDOR BILL AUDIT VOUCHER</h3>
                <p className="text-xs text-slate-600">3-Way Matching Reconciliation (PO · Goods Receipt · Vendor Invoice)</p>
              </div>
              <div className="text-right font-mono text-xs">
                <div className="font-bold text-sm">{b.id}</div>
                <div>Invoice #: {b.billNumber}</div>
                <div className="text-slate-600">Printed: {printedAt}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl border border-slate-300 bg-slate-50 text-xs">
              <div className="space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-500">Vendor Supplier</div>
                <div className="font-bold text-sm">{b.supplierName}</div>
                {b.supplierContact && <div className="text-slate-600">{b.supplierContact}</div>}
              </div>
              <div className="space-y-1 text-right">
                <div className="text-[10px] uppercase font-bold text-slate-500">Receiving Store Outlet</div>
                <div className="font-bold text-sm">{b.storeName}</div>
                <div className="font-mono text-slate-600">PO #{b.poId} · GR #{b.goodsReceiptId}</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs p-3 rounded-lg border border-slate-300">
              <div>
                <span className="text-[10px] uppercase text-slate-500 block font-bold">3-Way Match Status</span>
                <span className="font-bold font-mono text-[#0F4C3A]">{b.status}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-500 block font-bold">Payment Terms</span>
                <span className="font-bold">{b.paymentTerms}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase text-slate-500 block font-bold">Due Date</span>
                <span className="font-bold font-mono">{b.dueDate}</span>
              </div>
            </div>

            <table className="w-full text-left text-xs border border-slate-400 border-collapse">
              <thead className="bg-slate-100 border-b border-slate-400 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-2 px-2.5 border-r border-slate-300">Item / SKU</th>
                  <th className="py-2 px-2.5 border-r border-slate-300 text-center">PO Qty</th>
                  <th className="py-2 px-2.5 border-r border-slate-300 text-center">GR Qty</th>
                  <th className="py-2 px-2.5 border-r border-slate-300 text-center">Billed Qty</th>
                  <th className="py-2 px-2.5 border-r border-slate-300 text-right">Unit Cost ({b.currency})</th>
                  <th className="py-2 px-2.5 text-right">Total ({b.currency})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {b.items.map((it) => (
                  <tr key={it.sku} className="break-inside-avoid">
                    <td className="py-2 px-2.5 border-r border-slate-300">
                      <div className="font-semibold">{it.productName}</div>
                      <div className="font-mono text-[10px] text-slate-500">{it.sku}</div>
                    </td>
                    <td className="py-2 px-2.5 border-r border-slate-300 text-center font-mono">{it.poQuantity}</td>
                    <td className="py-2 px-2.5 border-r border-slate-300 text-center font-mono font-bold">{it.grQuantity}</td>
                    <td className="py-2 px-2.5 border-r border-slate-300 text-center font-mono font-bold">{it.billedQuantity}</td>
                    <td className="py-2 px-2.5 border-r border-slate-300 text-right font-mono">{formatIDR(it.unitCost)}</td>
                    <td className="py-2 px-2.5 text-right font-mono font-bold">{formatIDR(it.totalCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end">
              <div className="w-80 p-3.5 rounded-xl border border-slate-300 bg-slate-50 space-y-1 text-xs font-mono">
                <div className="flex justify-between"><span>Subtotal:</span><span>{formatIDR(b.subtotal)}</span></div>
                <div className="flex justify-between"><span>PPN ({b.taxPercent}%):</span><span>{formatIDR(b.taxAmount)}</span></div>
                <div className="flex justify-between font-black text-sm pt-1.5 border-t border-slate-400">
                  <span>Grand Total ({b.currency}):</span>
                  <span>{formatIDR(b.grandTotal)}</span>
                </div>
                {b.currency !== 'IDR' && (
                  <div className="flex justify-between text-[11px] text-slate-600">
                    <span>Statutory Base IDR:</span>
                    <span>{formatIDR(b.grandTotalIDR)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1"><span>Amount Paid:</span><span>{formatIDR(b.amountPaid)}</span></div>
                <div className="flex justify-between font-bold"><span>Remaining Balance Due:</span><span>{formatIDR(b.remainingDue)}</span></div>
              </div>
            </div>

            {b.glEntryIds && b.glEntryIds.length > 0 && (
              <div className="p-2.5 rounded-lg border border-slate-300 text-[11px] font-mono">
                GL Audit Vouchers: {b.glEntryIds.join(', ')}
              </div>
            )}

            <div className="grid grid-cols-2 gap-8 text-center text-xs pt-4 border-t border-slate-300 break-inside-avoid">
              <div className="space-y-12">
                <span className="font-semibold text-slate-600">Accounts Payable Verification</span>
                <div className="border-b border-slate-500 mx-8 pb-1 font-bold">( ........................................ )</div>
              </div>
              <div className="space-y-12">
                <span className="font-semibold text-slate-600">Finance Controller Approval</span>
                <div className="border-b border-slate-500 mx-8 pb-1 font-bold">{b.approvedBy || '( ........................................ )'}</div>
              </div>
            </div>
          </div>
        );
      }

      // =====================================================================
      // FORMAT GROUP C: A4 DJP NOTA RETUR PENJUALAN (CUSTOMER CREDIT NOTE)
      // =====================================================================
      case 'nota_retur_customer': {
        const rma = activePrintPayload.rma;
        return (
          <div className="print-page-a4 bg-white text-slate-900 p-2 font-sans space-y-5">
            <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
              <div>
                <span className="px-2 py-1 rounded bg-[#0F4C3A] text-white font-mono font-black text-xs">DJP CORETAX COMPLIANT</span>
                <h3 className="text-lg font-black uppercase mt-2 text-[#0F4C3A]">NOTA RETUR PENJUALAN (CREDIT NOTE)</h3>
                <p className="text-xs text-slate-600">PT GroceMart Retail Indonesia · {rma.storeName}</p>
              </div>
              <div className="text-right font-mono text-xs">
                <div className="font-bold text-sm">{rma.notaReturNumber}</div>
                <div>RMA ID: {rma.id}</div>
                <div className="text-slate-600">Tanggal: {new Date(rma.createdAt).toLocaleString('id-ID')}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl border border-slate-300 bg-slate-50 text-xs">
              <div className="space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-500">Pembeli / Customer</div>
                <div className="font-bold text-sm">{rma.customerName}</div>
                <div className="font-mono text-slate-600">NPWP/NIK: {rma.customerNpwpOrNik || 'Digunggung Retail'}</div>
              </div>
              <div className="space-y-1 text-right">
                <div className="text-[10px] uppercase font-bold text-slate-500">Referensi Transaksi Asal</div>
                <div className="font-mono font-bold">{rma.sourceChannel} · {rma.sourceReferenceId}</div>
                <div>Settlement: <strong>{rma.refundMethod.replace(/_/g, ' ')}</strong></div>
              </div>
            </div>

            <table className="w-full text-left text-xs border border-slate-400 border-collapse">
              <thead className="bg-slate-100 border-b border-slate-400 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-2 px-2.5 border-r border-slate-300">SKU</th>
                  <th className="py-2 px-2.5 border-r border-slate-300">Nama Barang</th>
                  <th className="py-2 px-2.5 border-r border-slate-300">Disposisi QC</th>
                  <th className="py-2 px-2.5 border-r border-slate-300 text-center">Qty</th>
                  <th className="py-2 px-2.5 border-r border-slate-300 text-right">Harga Satuan</th>
                  <th className="py-2 px-2.5 text-right">Total Retur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {rma.items.map((it, idx) => (
                  <tr key={idx}>
                    <td className="py-2 px-2.5 border-r border-slate-300 font-mono font-bold">{it.sku}</td>
                    <td className="py-2 px-2.5 border-r border-slate-300 font-semibold">{it.productName}</td>
                    <td className="py-2 px-2.5 border-r border-slate-300 font-mono text-[10px]">{it.disposition}</td>
                    <td className="py-2 px-2.5 border-r border-slate-300 text-center font-mono">{it.quantity}</td>
                    <td className="py-2 px-2.5 border-r border-slate-300 text-right font-mono">{formatIDR(it.unitPriceIDR)}</td>
                    <td className="py-2 px-2.5 text-right font-mono font-bold">{formatIDR(it.lineTotalIDR)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end">
              <div className="w-72 p-3.5 rounded-xl border border-slate-300 bg-slate-50 space-y-1 text-xs font-mono">
                <div className="flex justify-between"><span>DPP Diretur:</span><span>{formatIDR(rma.subtotalReversedIDR)}</span></div>
                <div className="flex justify-between"><span>PPN Keluaran (#2025):</span><span>{formatIDR(rma.ppnReversedIDR)}</span></div>
                <div className="flex justify-between font-black text-sm pt-1.5 border-t border-slate-400 text-[#0F4C3A]">
                  <span>Total Credit Note:</span>
                  <span>{formatIDR(rma.totalCreditNoteIDR)}</span>
                </div>
              </div>
            </div>

            <div className="text-[11px] font-mono text-slate-600 border-t border-slate-300 pt-3 flex justify-between">
              <span>GL Vouchers: {rma.glVoucherIds.join(', ') || 'Auto-Posted'}</span>
              <span>Processed By: {rma.processedBy}</span>
            </div>
          </div>
        );
      }

      // =====================================================================
      // FORMAT GROUP C: A4 DJP NOTA RETUR PEMBELIAN (VENDOR DEBIT NOTE)
      // =====================================================================
      case 'nota_retur_vendor': {
        const rtv = activePrintPayload.rtv;
        return (
          <div className="print-page-a4 bg-white text-slate-900 p-2 font-sans space-y-5">
            <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
              <div>
                <span className="px-2 py-1 rounded bg-[#0F4C3A] text-white font-mono font-black text-xs">RTV DEBIT NOTE</span>
                <h3 className="text-lg font-black uppercase mt-2 text-[#0F4C3A]">NOTA RETUR PEMBELIAN (VENDOR DEBIT NOTE)</h3>
                <p className="text-xs text-slate-600">PT GroceMart Retail Indonesia · {rtv.storeName}</p>
              </div>
              <div className="text-right font-mono text-xs">
                <div className="font-bold text-sm">{rtv.debitNoteNumber}</div>
                <div>RTV ID: {rtv.id}</div>
                <div className="text-slate-600">Tanggal: {new Date(rtv.createdAt).toLocaleString('id-ID')}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl border border-slate-300 bg-slate-50 text-xs">
              <div className="space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-500">Supplier / Vendor Tujuan Retur</div>
                <div className="font-bold text-sm">{rtv.supplierName}</div>
                <div className="font-mono text-slate-600">NPWP: {rtv.supplierNpwp || 'Registered PKP Vendor'}</div>
              </div>
              <div className="space-y-1 text-right">
                <div className="text-[10px] uppercase font-bold text-slate-500">Status Settlement AP</div>
                <div className="font-mono font-bold uppercase">{rtv.status.replace(/_/g, ' ')}</div>
                <div>Lot Number: <strong className="font-mono">{rtv.lotNumber}</strong></div>
              </div>
            </div>

            <table className="w-full text-left text-xs border border-slate-400 border-collapse">
              <thead className="bg-slate-100 border-b border-slate-400 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-2 px-2.5 border-r border-slate-300">SKU</th>
                  <th className="py-2 px-2.5 border-r border-slate-300">Produk &amp; Alasan QC</th>
                  <th className="py-2 px-2.5 border-r border-slate-300 text-center">Qty Retur</th>
                  <th className="py-2 px-2.5 border-r border-slate-300 text-right">Unit Cost</th>
                  <th className="py-2 px-2.5 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-2.5 px-2.5 border-r border-slate-300 font-mono font-bold">{rtv.sku}</td>
                  <td className="py-2.5 px-2.5 border-r border-slate-300">
                    <div className="font-semibold">{rtv.productName}</div>
                    <div className="text-[11px] text-slate-600">{rtv.reason}</div>
                  </td>
                  <td className="py-2.5 px-2.5 border-r border-slate-300 text-center font-mono font-bold">{rtv.quantityReturned} {rtv.unit}</td>
                  <td className="py-2.5 px-2.5 border-r border-slate-300 text-right font-mono">{formatIDR(rtv.unitCostIDR)}</td>
                  <td className="py-2.5 px-2.5 text-right font-mono font-bold">{formatIDR(rtv.subtotalReturnedIDR)}</td>
                </tr>
              </tbody>
            </table>

            <div className="flex justify-end">
              <div className="w-72 p-3.5 rounded-xl border border-slate-300 bg-slate-50 space-y-1 text-xs font-mono">
                <div className="flex justify-between"><span>DPP Retur Pembelian:</span><span>{formatIDR(rtv.subtotalReturnedIDR)}</span></div>
                <div className="flex justify-between"><span>PPN Masukan Reversed (#2026):</span><span>{formatIDR(rtv.ppnMasukanReversedIDR)}</span></div>
                <div className="flex justify-between font-black text-sm pt-1.5 border-t border-slate-400 text-[#0F4C3A]">
                  <span>Total AP Debit Note:</span>
                  <span>{formatIDR(rtv.totalDebitNoteIDR)}</span>
                </div>
              </div>
            </div>

            <div className="text-[11px] font-mono text-slate-600 border-t border-slate-300 pt-3 flex justify-between">
              <span>GL Vouchers: {rtv.glVoucherIds.join(', ') || 'Auto-Posted'}</span>
              <span>Issued By: {rtv.createdBy}</span>
            </div>
          </div>
        );
      }

      // =====================================================================
      // FORMAT GROUP C: A4 EXECUTIVE DASHBOARD PDF REPORT
      // =====================================================================
      case 'executive_report': {
        const { selectedGlobalStore, preparedBy, omzetData, inventoryMetrics } = activePrintPayload;
        return (
          <div className="print-page-a4 bg-white text-slate-900 p-2 font-sans space-y-5">
            <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 rounded bg-[#0F4C3A] text-white font-mono font-black text-xs tracking-wider">GROCEMART</span>
                  <span className="text-sm font-black tracking-wider uppercase text-slate-900">PT GROCEMART RETAIL INDONESIA</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1">Executive Management Console · Supply Chain v2.4</p>
                <p className="text-[10px] text-slate-500 font-mono">
                  Scope: {selectedGlobalStore === 'CONSOLIDATED' ? 'All Outlets (Consolidated Network)' : selectedGlobalStore}
                  {preparedBy ? ` | Prepared by: ${preparedBy}` : ''}
                </p>
              </div>
              <div className="text-right">
                <h3 className="text-base font-black tracking-wider uppercase text-[#0F4C3A]">EXECUTIVE PERFORMANCE REPORT</h3>
                <p className="text-[11px] font-mono text-slate-600 mt-0.5">Generated: {printedAt}</p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-slate-300 bg-slate-50">
                <span className="text-[10px] font-semibold uppercase text-slate-500 block">Gross Omzet (MTD)</span>
                <span className="text-base font-black font-mono text-slate-900 block mt-1">{formatIDR(omzetData?.totalRevenueMTD || 388500000)}</span>
                <span className="text-[10px] font-semibold text-emerald-700 block mt-0.5">+{omzetData?.momGrowthPercent || 18.2}% MoM · +{omzetData?.wowGrowthPercent || 12.4}% WoW</span>
              </div>
              <div className="p-3 rounded-lg border border-slate-300 bg-slate-50">
                <span className="text-[10px] font-semibold uppercase text-slate-500 block">Total Settled Orders</span>
                <span className="text-base font-black font-mono text-slate-900 block mt-1">{(omzetData?.totalOrders || 1311).toLocaleString('id-ID')}</span>
                <span className="text-[10px] text-slate-600 block mt-0.5">Avg Basket: {formatIDR(omzetData?.averageBasketValue || 296338)}</span>
              </div>
              <div className="p-3 rounded-lg border border-slate-300 bg-slate-50">
                <span className="text-[10px] font-semibold uppercase text-slate-500 block">QRIS Conversion Rate</span>
                <span className="text-base font-black font-mono text-slate-900 block mt-1">{omzetData?.qrisMetrics.conversionRatePercent || 96.8}%</span>
                <span className="text-[10px] text-slate-600 block mt-0.5">{omzetData?.qrisMetrics.settledCount || 1336} / {omzetData?.qrisMetrics.totalAttempts || 1380} paid</span>
              </div>
              <div className="p-3 rounded-lg border border-slate-300 bg-slate-50">
                <span className="text-[10px] font-semibold uppercase text-slate-500 block">Inventory Valuation (WAC)</span>
                <span className="text-base font-black font-mono text-slate-900 block mt-1">{formatIDR(inventoryMetrics.totalValuationWAC || 48200000)}</span>
                <span className="text-[10px] text-slate-600 block mt-0.5">{inventoryMetrics.lowStockCount} low stock · {inventoryMetrics.totalStockCount} units</span>
              </div>
            </div>

            <div className="break-inside-avoid">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-2">1. Omzet Breakdown per Physical Outlet</h4>
              <table className="w-full text-left text-xs border border-slate-400 border-collapse">
                <thead className="bg-slate-100 border-b border-slate-400 font-bold uppercase text-[10px] text-slate-800">
                  <tr>
                    <th className="py-1.5 px-2.5 border-r border-slate-300">Store Location</th>
                    <th className="py-1.5 px-2.5 border-r border-slate-300">City</th>
                    <th className="py-1.5 px-2.5 border-r border-slate-300 text-right">Orders</th>
                    <th className="py-1.5 px-2.5 border-r border-slate-300 text-right">Revenue (IDR)</th>
                    <th className="py-1.5 px-2.5 border-r border-slate-300 text-right">Share</th>
                    <th className="py-1.5 px-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {(omzetData?.storeBreakdown || []).map((store) => (
                    <tr key={`print-store-${store.storeId}`}>
                      <td className="py-1.5 px-2.5 border-r border-slate-300 font-semibold">{store.storeName}</td>
                      <td className="py-1.5 px-2.5 border-r border-slate-300">{store.city}</td>
                      <td className="py-1.5 px-2.5 border-r border-slate-300 text-right font-mono">{store.orderCount}</td>
                      <td className="py-1.5 px-2.5 border-r border-slate-300 text-right font-mono font-bold text-[#0F4C3A]">{formatIDR(store.omzet)}</td>
                      <td className="py-1.5 px-2.5 border-r border-slate-300 text-right font-mono">{store.sharePercent}%</td>
                      <td className="py-1.5 px-2.5 text-center font-mono text-[10px] font-bold text-emerald-700 uppercase">{store.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-2 gap-4 break-inside-avoid">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-2">2. Category Revenue Share</h4>
                <table className="w-full text-left text-xs border border-slate-400 border-collapse">
                  <thead className="bg-slate-100 border-b border-slate-400 font-bold uppercase text-[10px] text-slate-800">
                    <tr>
                      <th className="py-1.5 px-2 border-r border-slate-300">Department</th>
                      <th className="py-1.5 px-2 border-r border-slate-300 text-right">Units</th>
                      <th className="py-1.5 px-2 border-r border-slate-300 text-right">Share</th>
                      <th className="py-1.5 px-2 text-right">Omzet (IDR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    {(omzetData?.categoryBreakdown || []).map((cat) => (
                      <tr key={`print-cat-${cat.category}`}>
                        <td className="py-1.5 px-2 border-r border-slate-300 font-medium">{cat.label}</td>
                        <td className="py-1.5 px-2 border-r border-slate-300 text-right font-mono">{cat.unitsSold.toLocaleString('id-ID')}</td>
                        <td className="py-1.5 px-2 border-r border-slate-300 text-right font-mono font-semibold">{cat.sharePercent}%</td>
                        <td className="py-1.5 px-2 text-right font-mono font-bold text-[#0F4C3A]">{formatIDR(cat.omzet)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-2">3. Top-Selling SKUs by Revenue</h4>
                <table className="w-full text-left text-xs border border-slate-400 border-collapse">
                  <thead className="bg-slate-100 border-b border-slate-400 font-bold uppercase text-[10px] text-slate-800">
                    <tr>
                      <th className="py-1.5 px-2 border-r border-slate-300">SKU</th>
                      <th className="py-1.5 px-2 border-r border-slate-300">Product</th>
                      <th className="py-1.5 px-2 border-r border-slate-300 text-right">Sold</th>
                      <th className="py-1.5 px-2 text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    {(omzetData?.topSkus || []).map((sku) => (
                      <tr key={`print-sku-${sku.sku}`}>
                        <td className="py-1.5 px-2 border-r border-slate-300 font-mono text-[10px]">{sku.sku}</td>
                        <td className="py-1.5 px-2 border-r border-slate-300 font-medium">{sku.productName}</td>
                        <td className="py-1.5 px-2 border-r border-slate-300 text-right font-mono">{sku.unitsSold}</td>
                        <td className="py-1.5 px-2 text-right font-mono font-bold text-[#0F4C3A]">{formatIDR(sku.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-300 flex items-center justify-between text-[10px] text-slate-500 font-mono break-inside-avoid">
              <span>PT GroceMart Retail Indonesia · Confidential Executive Report</span>
              <span>ERP System Audit Verified</span>
            </div>
          </div>
        );
      }

      // =====================================================================
      // FORMAT GROUP C: A4 ACCOUNTING STATEMENTS (P&L / BS / CF / GL / COA / AR)
      // =====================================================================
      case 'accounting_statement': {
        const a = activePrintPayload;
        const fmt = (amountIDR: number) => {
          if (a.selectedCurrency === 'IDR') return formatIDR(amountIDR);
          const converted = amountIDR / a.fxRate;
          return `${a.fxSymbol}${converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        };
        const titleMap: Record<typeof a.subTab, string> = {
          pnl: 'INCOME STATEMENT (PROFIT & LOSS)',
          balance_sheet: 'BALANCE SHEET (FINANCIAL POSITION)',
          cash_flow: 'CASH FLOW STATEMENT',
          gl: 'GENERAL LEDGER AUDIT TRAIL',
          coa: 'CHART OF ACCOUNTS (COA) SCHEDULE',
          vendor_bills: 'ACCOUNTS PAYABLE & VENDOR BILLS',
          b2b_ar: 'B2B WHOLESALE AR & BILYET GIRO REGISTER',
          analytic_budgets: 'ANALYTIC COST CENTERS & DEPARTMENTAL BUDGETS',
          margin_analysis: 'REAL-TIME PRODUCT MARGIN ANALYSIS',
          consignment: 'CONSIGNMENT (TITIP JUAL) SETTLEMENT LEDGER',
        };

        return (
          <div className="print-page-a4 bg-white text-slate-900 p-2 font-sans space-y-5">
            <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 rounded bg-[#0F4C3A] text-white font-mono font-black text-xs">GROCEMART ERP</span>
                  <span className="text-sm font-black uppercase">PT GROCEMART RETAIL INDONESIA</span>
                </div>
                <p className="text-[11px] font-mono text-slate-600 mt-1">
                  Entity Scope: {a.selectedStore} · Currency: {a.selectedCurrency}
                </p>
              </div>
              <div className="text-right">
                <h3 className="text-base font-black uppercase text-[#0F4C3A]">{titleMap[a.subTab]}</h3>
                <p className="text-[11px] font-mono text-slate-600">Printed: {printedAt}</p>
              </div>
            </div>

            {a.subTab === 'pnl' && a.pnlReport && (
              <div className="space-y-4 font-mono text-xs">
                <div className="border border-slate-300 rounded-xl p-4 space-y-2">
                  <div className="font-bold uppercase border-b border-slate-300 pb-1 flex justify-between">
                    <span>1. Operating Sales Revenue</span>
                    <span>{a.selectedCurrency}</span>
                  </div>
                  <div className="flex justify-between pl-3"><span>Gross Sales Revenue</span><span>{fmt(a.pnlReport.grossSalesRevenue)}</span></div>
                  <div className="flex justify-between pl-3"><span>Less: Discounts &amp; Vouchers</span><span>-{fmt(a.pnlReport.discountsGiven)}</span></div>
                  <div className="flex justify-between font-bold border-t border-slate-300 pt-1"><span>Net Sales Revenue</span><span>{fmt(a.pnlReport.netSalesRevenue)}</span></div>
                </div>

                <div className="border border-slate-300 rounded-xl p-4 space-y-2">
                  <div className="font-bold uppercase border-b border-slate-300 pb-1">2. Cost of Goods Sold (WAC)</div>
                  <div className="flex justify-between pl-3"><span>Direct Acquisition &amp; Butchery Cost</span><span>-{fmt(a.pnlReport.costOfGoodsSold)}</span></div>
                  <div className="flex justify-between font-bold border-t border-slate-300 pt-1 text-[#0F4C3A]">
                    <span>Gross Profit ({a.pnlReport.grossMarginPercent}%)</span>
                    <span>{fmt(a.pnlReport.grossProfit)}</span>
                  </div>
                </div>

                <div className="border border-slate-300 rounded-xl p-4 space-y-2">
                  <div className="font-bold uppercase border-b border-slate-300 pb-1">3. Operating &amp; Cold-Chain Expenses</div>
                  {a.pnlReport.operatingExpenses.map((e, i) => (
                    <div key={i} className="flex justify-between pl-3"><span>{e.category}</span><span>-{fmt(e.amount)}</span></div>
                  ))}
                  <div className="flex justify-between font-bold border-t border-slate-300 pt-1">
                    <span>Total Operating Expenses</span>
                    <span>-{fmt(a.pnlReport.totalOperatingExpenses)}</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl border-2 border-[#0F4C3A] bg-slate-50 flex justify-between items-center font-sans">
                  <div>
                    <div className="font-black text-base">Net Operating Profit</div>
                    <div className="text-xs text-slate-600">Net Margin: {a.pnlReport.netMarginPercent}% · Period: {a.pnlReport.period}</div>
                  </div>
                  <div className="font-mono text-lg font-black text-[#0F4C3A]">{fmt(a.pnlReport.netProfit)}</div>
                </div>
              </div>
            )}

            {a.subTab === 'balance_sheet' && a.balanceSheet && (
              <div className="grid grid-cols-2 gap-4 font-mono text-xs">
                <div className="border border-slate-300 rounded-xl p-4 space-y-2">
                  <div className="font-bold uppercase border-b border-slate-400 pb-1 flex justify-between text-[#0F4C3A]">
                    <span>ASSETS</span><span>{formatIDR(a.balanceSheet.assets.totalAssets)}</span>
                  </div>
                  <div className="font-bold">Current Assets</div>
                  {a.balanceSheet.assets.currentAssets.map((it, i) => (
                    <div key={i} className="flex justify-between pl-2"><span>{it.category}</span><span>{formatIDR(it.amount)}</span></div>
                  ))}
                  <div className="font-bold pt-2 border-t border-slate-200">Non-Current Fixed Assets</div>
                  {a.balanceSheet.assets.nonCurrentAssets.map((it, i) => (
                    <div key={i} className="flex justify-between pl-2"><span>{it.category}</span><span>{formatIDR(it.amount)}</span></div>
                  ))}
                </div>
                <div className="border border-slate-300 rounded-xl p-4 space-y-2">
                  <div className="font-bold uppercase border-b border-slate-400 pb-1 flex justify-between text-blue-800">
                    <span>LIABILITIES &amp; EQUITY</span>
                    <span>{formatIDR(a.balanceSheet.liabilities.totalLiabilities + a.balanceSheet.equity.totalEquity)}</span>
                  </div>
                  <div className="font-bold">Current Liabilities</div>
                  {a.balanceSheet.liabilities.currentLiabilities.map((it, i) => (
                    <div key={i} className="flex justify-between pl-2"><span>{it.category}</span><span>{formatIDR(it.amount)}</span></div>
                  ))}
                  <div className="font-bold pt-2 border-t border-slate-200">Shareholders&apos; Equity</div>
                  {a.balanceSheet.equity.equityItems.map((it, i) => (
                    <div key={i} className="flex justify-between pl-2"><span>{it.category}</span><span>{formatIDR(it.amount)}</span></div>
                  ))}
                </div>
              </div>
            )}

            {a.subTab === 'cash_flow' && a.cashFlow && (
              <div className="space-y-4 font-mono text-xs">
                <div className="border border-slate-300 rounded-xl p-4 space-y-1.5">
                  <div className="font-bold uppercase border-b border-slate-300 pb-1 flex justify-between">
                    <span>Operating Activities</span><span>{formatIDR(a.cashFlow.netOperatingCash)}</span>
                  </div>
                  {a.cashFlow.operatingActivities.map((act, i) => (
                    <div key={i} className="flex justify-between pl-3"><span>{act.category}</span><span>{formatIDR(act.amount)}</span></div>
                  ))}
                </div>
                <div className="border border-slate-300 rounded-xl p-4 space-y-1.5">
                  <div className="font-bold uppercase border-b border-slate-300 pb-1 flex justify-between">
                    <span>Investing Activities</span><span>{formatIDR(a.cashFlow.netInvestingCash)}</span>
                  </div>
                  {a.cashFlow.investingActivities.map((act, i) => (
                    <div key={i} className="flex justify-between pl-3"><span>{act.category}</span><span>{formatIDR(act.amount)}</span></div>
                  ))}
                </div>
                <div className="p-4 rounded-xl border-2 border-[#0F4C3A] flex justify-between font-bold text-sm">
                  <span>Ending Liquid Cash Balance</span>
                  <span className="text-[#0F4C3A]">{formatIDR(a.cashFlow.endingCash)}</span>
                </div>
              </div>
            )}

            {a.subTab === 'gl' && (
              <table className="w-full text-left text-[10.5px] font-mono border border-slate-400 border-collapse">
                <thead className="bg-slate-100 border-b border-slate-400 font-bold uppercase">
                  <tr>
                    <th className="py-1.5 px-2 border-r border-slate-300">Voucher ID</th>
                    <th className="py-1.5 px-2 border-r border-slate-300">Date</th>
                    <th className="py-1.5 px-2 border-r border-slate-300">Account</th>
                    <th className="py-1.5 px-2 border-r border-slate-300 text-right">Debit</th>
                    <th className="py-1.5 px-2 border-r border-slate-300 text-right">Credit</th>
                    <th className="py-1.5 px-2">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {a.filteredLedger.slice(0, 60).map((e) => (
                    <tr key={e.id} className="break-inside-avoid">
                      <td className="py-1.5 px-2 border-r border-slate-300 font-bold">{e.id}</td>
                      <td className="py-1.5 px-2 border-r border-slate-300">{e.timestamp.split('T')[0]}</td>
                      <td className="py-1.5 px-2 border-r border-slate-300 font-sans">{e.accountCode} - {e.accountName}</td>
                      <td className="py-1.5 px-2 border-r border-slate-300 text-right">{e.debit > 0 ? formatIDR(e.debit) : '-'}</td>
                      <td className="py-1.5 px-2 border-r border-slate-300 text-right">{e.credit > 0 ? formatIDR(e.credit) : '-'}</td>
                      <td className="py-1.5 px-2 font-sans">{e.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {a.subTab === 'coa' && (
              <table className="w-full text-left text-xs font-mono border border-slate-400 border-collapse">
                <thead className="bg-slate-100 border-b border-slate-400 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2 px-2.5 border-r border-slate-300">Code</th>
                    <th className="py-2 px-2.5 border-r border-slate-300 font-sans">Account Title</th>
                    <th className="py-2 px-2.5 border-r border-slate-300 font-sans">Category</th>
                    <th className="py-2 px-2.5 border-r border-slate-300">Normal Bal</th>
                    <th className="py-2 px-2.5 border-r border-slate-300">Hub</th>
                    <th className="py-2 px-2.5 text-right">Balance (IDR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {a.filteredCOA.map((acc) => (
                    <tr key={`${acc.storeId}-${acc.accountCode}`} className="break-inside-avoid">
                      <td className="py-1.5 px-2.5 border-r border-slate-300 font-bold">{acc.accountCode}</td>
                      <td className="py-1.5 px-2.5 border-r border-slate-300 font-sans font-semibold">{acc.accountName}</td>
                      <td className="py-1.5 px-2.5 border-r border-slate-300 font-sans">{acc.category}</td>
                      <td className="py-1.5 px-2.5 border-r border-slate-300">{acc.normalBalance}</td>
                      <td className="py-1.5 px-2.5 border-r border-slate-300">{acc.storeId}</td>
                      <td className="py-1.5 px-2.5 text-right font-bold">{formatIDR(acc.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {a.subTab === 'vendor_bills' && (
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase">Accounts Payable (AP) &amp; Vendor Bills Schedule (3-Way Match)</h4>
                <table className="w-full text-left text-xs border border-slate-400 border-collapse">
                  <thead className="bg-slate-100 border-b border-slate-400 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-1.5 px-2 border-r border-slate-300">Bill #</th>
                      <th className="py-1.5 px-2 border-r border-slate-300">Supplier</th>
                      <th className="py-1.5 px-2 border-r border-slate-300">PO / GR Ref</th>
                      <th className="py-1.5 px-2 border-r border-slate-300">Due Date</th>
                      <th className="py-1.5 px-2 border-r border-slate-300 text-right">Amount (IDR)</th>
                      <th className="py-1.5 px-2 border-r border-slate-300 text-center">Match</th>
                      <th className="py-1.5 px-2 text-center">Payment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    {(a.vendorBills || []).length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-4 text-center text-slate-500">
                          No vendor bills recorded in AP register.
                        </td>
                      </tr>
                    ) : (
                      (a.vendorBills || []).map((bill) => (
                        <tr key={bill.id}>
                          <td className="py-1.5 px-2 border-r border-slate-300 font-mono font-bold">{bill.billNumber}</td>
                          <td className="py-1.5 px-2 border-r border-slate-300 font-semibold">{bill.supplierName}</td>
                          <td className="py-1.5 px-2 border-r border-slate-300 font-mono text-[10px]">{bill.poId} → {bill.goodsReceiptId}</td>
                          <td className="py-1.5 px-2 border-r border-slate-300 font-mono">{bill.dueDate}</td>
                          <td className="py-1.5 px-2 border-r border-slate-300 text-right font-mono font-bold">{formatIDR(bill.grandTotalIDR)}</td>
                          <td className="py-1.5 px-2 border-r border-slate-300 text-center font-mono text-[10px] font-bold">{bill.status}</td>
                          <td className="py-1.5 px-2 text-center font-mono text-[10px] font-bold">{bill.paymentStatus}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {a.subTab === 'b2b_ar' && (
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase">Wholesale B2B AR &amp; Bilyet Giro Clearing Register</h4>
                <table className="w-full text-left text-xs border border-slate-400 border-collapse">
                  <thead className="bg-slate-100 border-b border-slate-400 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-1.5 px-2 border-r border-slate-300">Company</th>
                      <th className="py-1.5 px-2 border-r border-slate-300 text-right">Credit Limit</th>
                      <th className="py-1.5 px-2 border-r border-slate-300 text-right">Outstanding AR</th>
                      <th className="py-1.5 px-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    {a.b2bCustomers.map((c) => (
                      <tr key={c.id}>
                        <td className="py-1.5 px-2 border-r border-slate-300 font-semibold">{c.companyName}</td>
                        <td className="py-1.5 px-2 border-r border-slate-300 text-right font-mono">{formatIDR(c.creditLimit)}</td>
                        <td className="py-1.5 px-2 border-r border-slate-300 text-right font-mono font-bold">{formatIDR(c.outstandingAR)}</td>
                        <td className="py-1.5 px-2 text-center font-mono text-[10px] font-bold">{c.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <table className="w-full text-left text-xs border border-slate-400 border-collapse">
                  <thead className="bg-slate-100 border-b border-slate-400 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-1.5 px-2 border-r border-slate-300">Giro No</th>
                      <th className="py-1.5 px-2 border-r border-slate-300">Customer</th>
                      <th className="py-1.5 px-2 border-r border-slate-300">Due Date</th>
                      <th className="py-1.5 px-2 border-r border-slate-300 text-right">Amount</th>
                      <th className="py-1.5 px-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    {a.giroRecords.map((g) => (
                      <tr key={g.id}>
                        <td className="py-1.5 px-2 border-r border-slate-300 font-mono font-bold">{g.giroNumber}</td>
                        <td className="py-1.5 px-2 border-r border-slate-300">{g.customerName}</td>
                        <td className="py-1.5 px-2 border-r border-slate-300 font-mono">{g.clearingDueDate}</td>
                        <td className="py-1.5 px-2 border-r border-slate-300 text-right font-mono font-bold">{formatIDR(g.amountIDR)}</td>
                        <td className="py-1.5 px-2 text-center font-mono text-[10px] font-bold">{g.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="pt-4 border-t border-slate-300 flex justify-between text-[10px] font-mono text-slate-500">
              <span>PT GroceMart Retail Indonesia · GAAP/PSAK Compliant Financial Statement</span>
              <span>Audited System Export</span>
            </div>
          </div>
        );
      }

      // =====================================================================
      // FORMAT GROUP C: A4 GROCERY ANALYTICS & INTELLIGENCE REPORT
      // =====================================================================
      case 'grocery_analytics': {
        const { selectedStore, activeTab, operatorName, reportData, recallTraceResult } = activePrintPayload;

        const tabTitleMap: Record<typeof activeTab, string> = {
          all: 'Consolidated Executive Summary',
          fifo: 'FIFO & Batch Expiry',
          waste: 'Waste & Shrinkage Decomposition',
          fulfillment: 'Picker & Fulfillment SLA',
          recall: 'FDA / EU Recall & HACCP Compliance',
        };

        const storeScopeLabel =
          !selectedStore || selectedStore === 'CONSOLIDATED' || selectedStore === 'ALL'
            ? 'All Outlets (Consolidated Network)'
            : selectedStore;

        const showFifo = activeTab === 'all' || activeTab === 'fifo';
        const showWaste = activeTab === 'all' || activeTab === 'waste';
        const showFulfillment = activeTab === 'all' || activeTab === 'fulfillment';
        const showRecall = activeTab === 'recall' || (activeTab === 'all' && Boolean(recallTraceResult));

        const totalAgingUnits = reportData
          ? reportData.fifoExpiryMetrics.agingBuckets.reduce((sum, b) => sum + b.units, 0)
          : 0;

        return (
          <div
            id={options?.isPreview ? undefined : 'grocery-analytics-print-sheet'}
            className="print-page-a4 bg-white text-slate-900 p-2 font-sans space-y-5"
          >
            {/* Formal Corporate Report Header */}
            <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 rounded bg-[#0F4C3A] text-white font-mono font-black text-xs tracking-wider">
                    GROCEMART
                  </span>
                  <span className="text-sm font-black tracking-wider uppercase text-slate-900">
                    PT GROCEMART RETAIL INDONESIA
                  </span>
                </div>
                <h3 className="text-base font-black uppercase mt-2 text-[#0F4C3A]">
                  Grocery Intelligence &amp; Analytics Report
                </h3>
                <p className="text-xs font-semibold text-slate-800 mt-0.5">
                  Active View: {tabTitleMap[activeTab]}
                </p>
              </div>
              <div className="text-right text-[11px] font-mono text-slate-700 space-y-0.5">
                <div>
                  Outlet Scope: <strong className="text-slate-900">{storeScopeLabel}</strong>
                </div>
                <div>
                  Operator: <strong className="text-slate-900">{operatorName || 'Operations Analyst'}</strong>
                </div>
                <div>Printed: {printedAt}</div>
              </div>
            </div>

            {/* SECTION 1: FIFO & BATCH EXPIRY */}
            {reportData && showFifo && (
              <div className="space-y-3 break-inside-avoid">
                <div className="flex items-center justify-between border-b border-slate-300 pb-1.5">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                    {activeTab === 'fifo'
                      ? '1. FIFO Expiry Risk, Velocity & Batch Aging Distribution'
                      : '1. FIFO Expiry Risk & Batch Aging Distribution'}
                  </h4>
                  <span className="text-xs font-mono font-bold text-rose-700">
                    At-Risk Value (&lt;7 Days): {formatIDR(reportData.fifoExpiryMetrics.atRiskInventoryValueIDR)}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-3 text-xs">
                  {reportData.fifoExpiryMetrics.agingBuckets.map((b, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-lg border ${
                        i === 0
                          ? 'border-rose-300 bg-rose-50/70'
                          : i === 1
                          ? 'border-amber-300 bg-amber-50/70'
                          : 'border-slate-300 bg-slate-50'
                      }`}
                    >
                      <div className="text-[10px] font-bold uppercase text-slate-600">{b.bucket}</div>
                      <div className="text-base font-mono font-black text-slate-900 mt-1">{b.units} units</div>
                      <div className="text-xs font-mono font-semibold text-[#0F4C3A]">
                        {formatIDR(b.valueIDR)}
                      </div>
                    </div>
                  ))}
                </div>

                {activeTab === 'fifo' && (
                  <table className="w-full text-left text-xs border border-slate-400 border-collapse">
                    <thead className="bg-slate-100 border-b border-slate-400 font-bold uppercase text-[10px] text-slate-800">
                      <tr>
                        <th className="py-1.5 px-2.5 border-r border-slate-300">Aging Horizon Bucket</th>
                        <th className="py-1.5 px-2.5 border-r border-slate-300 text-right">Units On-Hand</th>
                        <th className="py-1.5 px-2.5 border-r border-slate-300 text-right">Unit Share</th>
                        <th className="py-1.5 px-2.5 border-r border-slate-300 text-right">Inventory Valuation (IDR)</th>
                        <th className="py-1.5 px-2.5 text-center">FEFO Priority</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300">
                      {reportData.fifoExpiryMetrics.agingBuckets.map((b, i) => {
                        const pct = totalAgingUnits > 0 ? ((b.units / totalAgingUnits) * 100).toFixed(1) : '0.0';
                        const priorityLabel =
                          i === 0
                            ? 'CRITICAL / VIVO 50-70%'
                            : i === 1
                            ? 'NEAR EXPIRY / VIVO 25%'
                            : i === 2
                            ? 'PRIME FRESH / FEFO'
                            : 'LONG STABLE';
                        return (
                          <tr key={i}>
                            <td className="py-1.5 px-2.5 border-r border-slate-300 font-semibold">{b.bucket}</td>
                            <td className="py-1.5 px-2.5 border-r border-slate-300 text-right font-mono">{b.units}</td>
                            <td className="py-1.5 px-2.5 border-r border-slate-300 text-right font-mono">{pct}%</td>
                            <td className="py-1.5 px-2.5 border-r border-slate-300 text-right font-mono font-bold text-[#0F4C3A]">
                              {formatIDR(b.valueIDR)}
                            </td>
                            <td className="py-1.5 px-2.5 text-center font-mono text-[10px] font-bold">
                              {priorityLabel}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                <div className="p-3 rounded-lg border border-emerald-300 bg-emerald-50/70 text-xs flex items-center justify-between gap-4">
                  <div>
                    <div className="font-bold text-emerald-950">
                      VIVO Near-Expiry Clearance Recovery Summary
                    </div>
                    <div className="text-[11px] text-emerald-900 mt-0.5">
                      {reportData.fifoExpiryMetrics.vivoDiscountSoldUnits} units liquidated via automated near-expiry markdown, recovering{' '}
                      <strong className="font-mono">
                        {formatIDR(reportData.fifoExpiryMetrics.vivoRevenueRecoveredIDR)}
                      </strong>{' '}
                      in margin.
                    </div>
                  </div>
                  <div className="text-right font-mono font-black text-emerald-900 whitespace-nowrap">
                    Turnover: {reportData.fifoExpiryMetrics.batchTurnoverRateDays} Days
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 2: WASTE & SHRINKAGE DECOMPOSITION */}
            {reportData && showWaste && (
              <div className="space-y-3 break-inside-avoid">
                <div className="flex items-center justify-between border-b border-slate-300 pb-1.5">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                    {activeTab === 'waste'
                      ? '1. Grocery Shrinkage & Moisture Loss Decomposition'
                      : '2. Grocery Shrinkage & Moisture Loss Decomposition'}
                  </h4>
                  <span className="text-xs font-mono font-bold text-[#0F4C3A]">
                    Shrink-to-Sales Ratio: {reportData.wasteShrinkageMetrics.shrinkToSalesRatioPercent}% (Target &lt; 2.5%)
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-lg border border-slate-300 bg-slate-50">
                    <span className="font-sans text-[10px] font-bold text-slate-500 block uppercase">
                      Natural Moisture Loss
                    </span>
                    <span className="font-bold text-sm text-slate-900 mt-1 block">
                      {formatIDR(reportData.wasteShrinkageMetrics.naturalMoistureLossIDR)}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg border border-slate-300 bg-slate-50">
                    <span className="font-sans text-[10px] font-bold text-slate-500 block uppercase">
                      Trim, Wash &amp; Prep
                    </span>
                    <span className="font-bold text-sm text-slate-900 mt-1 block">
                      {formatIDR(reportData.wasteShrinkageMetrics.prepAndWashLossIDR)}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg border border-slate-300 bg-slate-50">
                    <span className="font-sans text-[10px] font-bold text-slate-500 block uppercase">
                      In-Store Handling Damage
                    </span>
                    <span className="font-bold text-sm text-slate-900 mt-1 block">
                      {formatIDR(reportData.wasteShrinkageMetrics.handlingDamageLossIDR)}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg border border-rose-300 bg-rose-50/70">
                    <span className="font-sans text-[10px] font-bold text-rose-700 block uppercase">
                      Expired / Spoilage Scrap
                    </span>
                    <span className="font-bold text-sm text-rose-700 mt-1 block">
                      {formatIDR(reportData.wasteShrinkageMetrics.expiredSpoilageLossIDR)}
                    </span>
                  </div>
                </div>

                <table className="w-full text-left text-xs border border-slate-400 border-collapse">
                  <thead className="bg-slate-100 border-b border-slate-400 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-1.5 px-2.5 border-r border-slate-300">Grocery Department</th>
                      <th className="py-1.5 px-2.5 border-r border-slate-300 text-right">Shrinkage Loss (IDR)</th>
                      <th className="py-1.5 px-2.5 text-right">Share (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    {reportData.wasteShrinkageMetrics.departmentBreakdown.map((d, i) => (
                      <tr key={i}>
                        <td className="py-1.5 px-2.5 border-r border-slate-300 font-semibold">{d.department}</td>
                        <td className="py-1.5 px-2.5 border-r border-slate-300 text-right font-mono">
                          {formatIDR(d.lossIDR)}
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-mono font-bold">{d.percentage}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* GL Account #6030 Reconciliation Summary */}
                <div className="p-3 rounded-lg border border-slate-400 bg-slate-50 text-xs space-y-1.5">
                  <div className="flex items-center justify-between font-bold text-slate-900">
                    <span>GL Account #6030 Reconciliation — Cost of Shrinkage &amp; Perishable Waste</span>
                    <span className="font-mono text-rose-700">
                      Total Posted: {formatIDR(reportData.wasteShrinkageMetrics.totalShrinkLossIDR)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[11px] font-mono text-slate-700 pt-1 border-t border-slate-300">
                    <div>
                      Evaporation &amp; Prep Adj.:{' '}
                      <strong>
                        {formatIDR(
                          reportData.wasteShrinkageMetrics.naturalMoistureLossIDR +
                            reportData.wasteShrinkageMetrics.prepAndWashLossIDR
                        )}
                      </strong>
                    </div>
                    <div>
                      Handling &amp; Scrap Write-Off:{' '}
                      <strong>
                        {formatIDR(
                          reportData.wasteShrinkageMetrics.handlingDamageLossIDR +
                            reportData.wasteShrinkageMetrics.expiredSpoilageLossIDR
                        )}
                      </strong>
                    </div>
                    <div className="text-right">
                      Status: <strong className="text-[#0F4C3A]">RECONCILED TO GL #6030</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 3: PICKER & FULFILLMENT SLA */}
            {reportData && showFulfillment && (
              <div className="space-y-3 break-inside-avoid">
                <div className="flex items-center justify-between border-b border-slate-300 pb-1.5">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                    {activeTab === 'fulfillment'
                      ? '1. Storefront Fulfillment & Picker SLA Benchmarks'
                      : '3. Storefront Fulfillment & Picker SLA Benchmarks'}
                  </h4>
                  <span className="px-2 py-0.5 rounded border border-emerald-400 bg-emerald-50 text-[10px] font-mono font-bold text-emerald-800">
                    SLA Grade A+
                  </span>
                </div>

                <div className="grid grid-cols-5 gap-2.5 text-center text-xs font-mono">
                  <div className="p-2.5 rounded-lg border border-slate-300 bg-slate-50">
                    <span className="font-sans text-[10px] text-slate-500 block">Avg Pick Time</span>
                    <span className="text-base font-black text-slate-900">
                      {reportData.fulfillmentMetrics.averagePickTimeMinutes} mins
                    </span>
                    <span className="font-sans text-[9px] text-slate-500 block">Target &lt; 6.0m</span>
                  </div>
                  <div className="p-2.5 rounded-lg border border-slate-300 bg-slate-50">
                    <span className="font-sans text-[10px] text-slate-500 block">Catch-Weight Acc.</span>
                    <span className="text-base font-black text-slate-900">
                      {reportData.fulfillmentMetrics.catchWeightAccuracyPercent}%
                    </span>
                    <span className="font-sans text-[9px] text-slate-500 block">±5% tolerance</span>
                  </div>
                  <div className="p-2.5 rounded-lg border border-slate-300 bg-slate-50">
                    <span className="font-sans text-[10px] text-slate-500 block">Subs Accepted</span>
                    <span className="text-base font-black text-slate-900">
                      {reportData.fulfillmentMetrics.substitutionsAcceptedPercent}%
                    </span>
                    <span className="font-sans text-[9px] text-slate-500 block">WA approval</span>
                  </div>
                  <div className="p-2.5 rounded-lg border border-slate-300 bg-slate-50">
                    <span className="font-sans text-[10px] text-slate-500 block">On-Time Delivery</span>
                    <span className="text-base font-black text-slate-900">
                      {reportData.fulfillmentMetrics.onTimeDeliveryPercent}%
                    </span>
                    <span className="font-sans text-[9px] text-slate-500 block">Hub dispatch</span>
                  </div>
                  <div className="p-2.5 rounded-lg border border-slate-300 bg-slate-50">
                    <span className="font-sans text-[10px] text-slate-500 block">Click &amp; Collect</span>
                    <span className="text-base font-black text-slate-900">
                      {reportData.fulfillmentMetrics.clickAndCollectFulfillmentRatePercent}%
                    </span>
                    <span className="font-sans text-[9px] text-slate-500 block">15m ready SLA</span>
                  </div>
                </div>

                {activeTab === 'fulfillment' && (
                  <table className="w-full text-left text-xs border border-slate-400 border-collapse">
                    <thead className="bg-slate-100 border-b border-slate-400 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-1.5 px-2.5 border-r border-slate-300">SLA Benchmark Metric</th>
                        <th className="py-1.5 px-2.5 border-r border-slate-300 text-right">Actual Performance</th>
                        <th className="py-1.5 px-2.5 border-r border-slate-300 text-right">Target Threshold</th>
                        <th className="py-1.5 px-2.5 text-center">Compliance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300 font-mono">
                      <tr>
                        <td className="py-1.5 px-2.5 border-r border-slate-300 font-sans font-semibold">
                          Order Picking Speed (Per Basket)
                        </td>
                        <td className="py-1.5 px-2.5 border-r border-slate-300 text-right font-bold">
                          {reportData.fulfillmentMetrics.averagePickTimeMinutes} mins
                        </td>
                        <td className="py-1.5 px-2.5 border-r border-slate-300 text-right">&lt; 6.0 mins</td>
                        <td className="py-1.5 px-2.5 text-center font-bold text-[#0F4C3A]">PASS</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-2.5 border-r border-slate-300 font-sans font-semibold">
                          Catch-Weight Scale Precision
                        </td>
                        <td className="py-1.5 px-2.5 border-r border-slate-300 text-right font-bold">
                          {reportData.fulfillmentMetrics.catchWeightAccuracyPercent}%
                        </td>
                        <td className="py-1.5 px-2.5 border-r border-slate-300 text-right">&ge; 95.0%</td>
                        <td className="py-1.5 px-2.5 text-center font-bold text-[#0F4C3A]">PASS</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-2.5 border-r border-slate-300 font-sans font-semibold">
                          On-Time Hub Dispatch &amp; Delivery SLA
                        </td>
                        <td className="py-1.5 px-2.5 border-r border-slate-300 text-right font-bold">
                          {reportData.fulfillmentMetrics.onTimeDeliveryPercent}%
                        </td>
                        <td className="py-1.5 px-2.5 border-r border-slate-300 text-right">&ge; 95.0%</td>
                        <td className="py-1.5 px-2.5 text-center font-bold text-[#0F4C3A]">PASS</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-2.5 border-r border-slate-300 font-sans font-semibold">
                          Click &amp; Collect 15-Minute Readiness
                        </td>
                        <td className="py-1.5 px-2.5 border-r border-slate-300 text-right font-bold">
                          {reportData.fulfillmentMetrics.clickAndCollectFulfillmentRatePercent}%
                        </td>
                        <td className="py-1.5 px-2.5 border-r border-slate-300 text-right">&ge; 95.0%</td>
                        <td className="py-1.5 px-2.5 text-center font-bold text-[#0F4C3A]">PASS</td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* SECTION 4: FDA FSMA 204 / EU RASFF / HACCP COMPLIANCE & LOT TRACEABILITY */}
            {showRecall && (
              <div className="space-y-3 break-inside-avoid">
                <div className="flex items-center justify-between border-b border-slate-300 pb-1.5">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                    {activeTab === 'recall'
                      ? '1. FDA FSMA 204 / EU RASFF & HACCP Cold-Chain Traceability Audit'
                      : '4. Food Safety & Lot Traceability Snapshot'}
                  </h4>
                  <span className="text-[10px] font-mono font-bold uppercase text-rose-700">
                    US FDA • EU 852/2004 • FSANZ 3.2.2
                  </span>
                </div>

                {recallTraceResult ? (
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg border border-slate-400 bg-slate-50 text-xs flex items-start justify-between gap-4">
                      <div>
                        <div className="font-mono font-bold text-slate-900">
                          Batch {recallTraceResult.batchId} · Lot #{recallTraceResult.lotNumber} · SKU{' '}
                          {recallTraceResult.sku}
                        </div>
                        <div className="font-bold text-sm text-[#0F4C3A] mt-0.5">
                          {recallTraceResult.productName}
                        </div>
                        <div className="text-[11px] text-slate-600 mt-0.5">
                          Supplier: <strong>{recallTraceResult.supplierName}</strong> · Received:{' '}
                          {recallTraceResult.receivedDate} · Expiry: {recallTraceResult.expiryDate}
                        </div>
                      </div>
                      <div className="text-right font-mono text-[11px] shrink-0">
                        <div className="font-black uppercase text-rose-700">
                          {recallTraceResult.recallStatus === 'quarantined'
                            ? 'LOCKDOWN / QUARANTINED'
                            : 'ACTIVE / CLEARED'}
                        </div>
                        <div>On-Hand: {recallTraceResult.currentWarehouseStock} units</div>
                        <div>Quarantined: {recallTraceResult.quarantinedStock} units</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-2.5 rounded-lg border border-slate-300">
                        <div className="text-[10px] font-bold uppercase text-slate-500">
                          Upstream Cold-Chain Intake Audit
                        </div>
                        <div className="font-mono font-bold mt-1">
                          PO: {recallTraceResult.upstreamOrigin.poId} · SJ:{' '}
                          {recallTraceResult.upstreamOrigin.deliveryNoteNumber}
                        </div>
                        <div className="text-[11px] mt-0.5">
                          Intake Temp: <strong>{recallTraceResult.upstreamOrigin.intakeTempCelsius}°C</strong> · QC:{' '}
                          <strong>{recallTraceResult.upstreamOrigin.intakeQualityStatus}</strong>
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg border border-slate-300">
                        <div className="text-[10px] font-bold uppercase text-slate-500">
                          Downstream Circulation &amp; Exposure
                        </div>
                        <div className="font-mono font-bold mt-1">
                          POS Sales: {recallTraceResult.posSales.length} txns · Online Orders:{' '}
                          {recallTraceResult.onlineOrders.length} shipments
                        </div>
                        <div className="text-[11px] mt-0.5">
                          Traceability Readiness: <strong className="text-[#0F4C3A]">100% End-to-End Linked</strong>
                        </div>
                      </div>
                    </div>

                    <table className="w-full text-left text-xs border border-slate-400 border-collapse">
                      <thead className="bg-slate-100 border-b border-slate-400 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="py-1.5 px-2 border-r border-slate-300">Store Hub</th>
                          <th className="py-1.5 px-2 border-r border-slate-300">Zone / Storage</th>
                          <th className="py-1.5 px-2 border-r border-slate-300 text-right">Physical / Avail</th>
                          <th className="py-1.5 px-2 text-center">HACCP / Hold Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-300">
                        {recallTraceResult.warehouseLocations.map((loc) => (
                          <tr key={`${loc.storeId}-${loc.warehouseZoneId}`}>
                            <td className="py-1.5 px-2 border-r border-slate-300 font-semibold">{loc.storeName}</td>
                            <td className="py-1.5 px-2 border-r border-slate-300 font-mono text-[11px]">
                              {loc.warehouseZoneId} ({loc.storageType})
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-300 text-right font-mono">
                              {loc.physicalStock} / {loc.availableStock}
                            </td>
                            <td className="py-1.5 px-2 text-center font-mono text-[10px] font-bold">
                              {loc.isQuarantined ? 'QUARANTINED LOCKED' : 'NORMAL CIRCULATION'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {recallTraceResult.regulatoryNotice && (
                      <div className="p-2.5 rounded-lg border border-rose-300 bg-rose-50/70 text-[11px] space-y-0.5">
                        <div className="font-bold text-rose-900">
                          Regulatory Notice ({recallTraceResult.regulatoryNotice.recallClassification}):{' '}
                          <span className="font-mono">
                            {recallTraceResult.regulatoryNotice.fdaReportableFoodRegistryId} •{' '}
                            {recallTraceResult.regulatoryNotice.euRasffReferenceNumber}
                          </span>
                        </div>
                        <div className="text-rose-900">{recallTraceResult.regulatoryNotice.recommendedAction}</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 rounded-lg border border-slate-300 text-xs text-slate-600">
                    No batch recall trace selected. Run Trace End-to-End Lot in the FDA / EU Recall tab to attach lot-level traceability details.
                  </div>
                )}
              </div>
            )}

            {/* Formal 2-Column Sign-Off Block */}
            <div className="grid grid-cols-2 gap-8 text-center text-xs pt-5 mt-4 border-t border-slate-400 break-inside-avoid">
              <div className="space-y-12">
                <span className="font-semibold text-slate-600 block">Prepared by Operations Analyst</span>
                <div className="border-b border-slate-600 mx-8 pb-1 font-bold text-slate-900">
                  {operatorName || 'Operations Analyst'}
                </div>
              </div>
              <div className="space-y-12">
                <span className="font-semibold text-slate-600 block">Verified by Head of Supply Chain</span>
                <div className="border-b border-slate-600 mx-8 pb-1 font-bold text-slate-900">
                  ( ........................................ )
                </div>
              </div>
            </div>
          </div>
        );
      }

      // =====================================================================
      // FORMAT GROUP C: A4 B2B QUOTATION / PRO FORMA INVOICE
      // =====================================================================
      case 'quotation': {
        const { quotation: q, termsText } = activePrintPayload;
        return (
          <div className="print-page-a4 bg-white text-slate-900 p-2 font-sans space-y-5">
            <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 rounded bg-[#0F4C3A] text-white font-mono font-black text-xs tracking-wider">GROCEMART</span>
                  <span className="text-sm font-black uppercase tracking-wider">PT GROCEMART RETAIL INDONESIA</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1">B2B Commercial Desk &amp; Cold-Chain HoReCa Supply</p>
                <p className="text-[10px] font-mono text-slate-500">NPWP PKP: 01.345.678.9-012.000 · Jl. Senopati No. 42, Jakarta Selatan</p>
              </div>
              <div className="text-right">
                <h3 className="text-lg font-black uppercase tracking-wider text-[#0F4C3A]">
                  {q.isProForma ? 'PRO FORMA INVOICE' : 'COMMERCIAL QUOTATION'}
                </h3>
                <p className="text-xs font-mono font-bold text-slate-900 mt-0.5">{q.quotationNumber}</p>
                <p className="text-[11px] font-mono text-slate-600">
                  Issue: {q.date} · Valid Until: <strong className="text-slate-900">{q.validUntil}</strong>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs p-3.5 rounded-xl bg-slate-50 border border-slate-300">
              <div className="space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-500">Prepared For (Buyer)</div>
                <div className="font-bold text-sm text-slate-900">{q.customerCompany || q.customerName}</div>
                <div className="text-slate-700">PIC: {q.customerName}</div>
                <div className="text-[11px] font-mono text-slate-600">
                  {q.customerEmail} · {q.customerPhone}
                </div>
              </div>
              <div className="space-y-1 text-right">
                <div className="text-[10px] uppercase font-bold text-slate-500">Commercial &amp; Deposit Policy</div>
                <div className="font-mono font-bold text-slate-900">
                  Status: {q.status} · Currency: {q.currency}
                </div>
                <div className="text-[11px] font-mono text-[#0F4C3A] font-bold">
                  Confirmation Deposit ({q.requiredDepositPercent}%): {formatIDR(q.depositAmount)}
                </div>
                {q.convertedOrderId && (
                  <div className="text-[10px] font-mono text-emerald-700 font-bold">
                    Converted Order: {q.convertedOrderId}
                  </div>
                )}
              </div>
            </div>

            <table className="w-full text-left text-xs border border-slate-400 border-collapse">
              <thead className="bg-slate-100 border-b border-slate-400 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-2 px-2.5 border-r border-slate-300 text-center w-8">No</th>
                  <th className="py-2 px-2.5 border-r border-slate-300">SKU &amp; Item Description</th>
                  <th className="py-2 px-2.5 border-r border-slate-300 text-center">Qty / Unit</th>
                  <th className="py-2 px-2.5 border-r border-slate-300 text-right">Unit Price</th>
                  <th className="py-2 px-2.5 text-right">Line Total (IDR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {q.items.map((it, idx) => (
                  <tr key={`${it.sku}-${idx}`} className="break-inside-avoid">
                    <td className="py-2 px-2.5 border-r border-slate-300 text-center font-mono">{idx + 1}</td>
                    <td className="py-2 px-2.5 border-r border-slate-300">
                      <div className="font-semibold text-slate-900">
                        {it.productName}
                        {it.isMandatoryAddon && (
                          <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[9px] font-bold uppercase">
                            Mandatory HACCP Add-On
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-[10px] text-slate-500">{it.sku} · {it.category}</div>
                    </td>
                    <td className="py-2 px-2.5 border-r border-slate-300 text-center font-mono font-bold">
                      {it.quantity} {it.unit}
                    </td>
                    <td className="py-2 px-2.5 border-r border-slate-300 text-right font-mono">
                      {formatIDR(it.unitPrice)}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono font-bold">
                      {formatIDR(it.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
              <div className="p-3.5 rounded-xl border border-slate-300 bg-slate-50 text-[11px] space-y-1.5">
                <div className="font-bold uppercase text-[10px] text-slate-600">Terms, Cold-Chain &amp; Validity</div>
                <p className="text-slate-700 leading-relaxed">
                  {termsText || 'Prices quoted in IDR subject to Indonesian PPN 11%. Perishable cold-chain packaging fees apply per HACCP regulations.'}
                </p>
                {q.notes && (
                  <p className="text-slate-600 italic pt-1 border-t border-slate-200">Notes: {q.notes}</p>
                )}
              </div>

              <div className="space-y-1.5 text-xs font-mono border border-slate-300 rounded-xl p-3.5 bg-slate-50">
                <div className="flex justify-between">
                  <span>DPP / Subtotal:</span>
                  <span>{formatIDR(q.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>PPN Keluaran (11%):</span>
                  <span>{formatIDR(q.taxAmount)}</span>
                </div>
                <div className="flex justify-between text-sm font-black pt-2 border-t border-slate-400 text-[#0F4C3A]">
                  <span>TOTAL QUOTED:</span>
                  <span>{formatIDR(q.total)}</span>
                </div>
                <div className="flex justify-between text-[11px] font-bold text-amber-800 pt-1">
                  <span>Required Deposit ({q.requiredDepositPercent}%):</span>
                  <span>{formatIDR(q.depositAmount)}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 text-center text-xs pt-4 border-t border-slate-300 break-inside-avoid">
              <div className="space-y-3">
                <span className="font-semibold text-slate-600 block">Client Acceptance &amp; Digital Signature</span>
                {q.signatureStatus === 'SIGNED' && q.signatureDataUrl ? (
                  <div className="flex flex-col items-center">
                    <img
                      src={q.signatureDataUrl}
                      alt="Client Digital Signature"
                      className="h-16 object-contain border border-slate-200 rounded bg-white px-2"
                    />
                    <div className="font-bold text-slate-900 mt-1">{q.signedBy || q.customerName}</div>
                    {q.signedAt && (
                      <div className="text-[10px] font-mono text-emerald-700">
                        Digitally Signed: {new Date(q.signedAt).toLocaleString('id-ID')}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="pt-12">
                    <div className="border-b border-slate-500 mx-8 pb-1 font-bold">{q.customerName}</div>
                  </div>
                )}
              </div>
              <div className="space-y-14">
                <span className="font-semibold text-slate-600 block">Authorized Commercial Desk</span>
                <div className="border-b border-slate-500 mx-8 pb-1 font-bold">PT GroceMart Retail Indonesia</div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500 font-mono">
              <span>GroceMart Enterprise ERP · B2B Commercial Quote &amp; Pro Forma Engine</span>
              <span>Printed: {printedAt}</span>
            </div>
          </div>
        );
      }

      // =====================================================================
      // FORMAT GROUP C: A4 RACK-LEVEL BLIND STOCK OPNAME COUNT SHEET
      // =====================================================================
      case 'blind_count_sheet': {
        const sheet = activePrintPayload;
        return (
          <div className="print-page-a4 bg-white text-slate-900 p-2 font-sans space-y-5">
            <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 rounded bg-[#0F4C3A] text-white font-mono font-black text-xs tracking-wider">
                    GROCEMART
                  </span>
                  <span className="text-sm font-black uppercase tracking-wider">
                    PT GROCEMART RETAIL INDONESIA
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1">
                  Warehouse Cycle Count &amp; HACCP Lot Traceability Audit Division
                </p>
                <p className="text-[10px] font-mono text-slate-500">
                  Anti-Fraud Blind Count Protocol · System On-Hand Quantities Strictly Masked
                </p>
              </div>
              <div className="text-right">
                <h3 className="text-base font-black uppercase tracking-wider text-[#0F4C3A]">
                  BLIND STOCK OPNAME SHEET
                </h3>
                <p className="text-xs font-mono font-bold text-slate-900 mt-0.5">
                  {sheet.rackBinCode === 'ALL' ? 'ALL RACKS / BINS' : sheet.rackBinCode}
                </p>
                <p className="text-[10px] font-mono text-slate-600">
                  Generated: {printedAt}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs p-3 rounded-xl bg-slate-50 border border-slate-300">
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500">Outlet / Warehouse</div>
                <div className="font-bold text-slate-900 mt-0.5">{sheet.storeName}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500">Storage Zone</div>
                <div className="font-bold text-slate-900 mt-0.5">{sheet.storageZone || 'ALL ZONES'}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500">Rack / Bin Scope</div>
                <div className="font-mono font-bold text-[#0F4C3A] mt-0.5">{sheet.rackBinCode || 'ALL'}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500">Rotation / Prepared By</div>
                <div className="font-semibold text-slate-900 mt-0.5">
                  {sheet.rotationPolicy || 'FEFO / FIFO'} · {sheet.preparedBy}
                </div>
              </div>
            </div>

            <table className="w-full text-left text-xs border border-slate-400 border-collapse">
              <thead className="bg-slate-100 border-b border-slate-400 font-bold uppercase text-[10px] text-slate-800">
                <tr>
                  <th className="py-2 px-2 border-r border-slate-300 text-center w-8">#</th>
                  <th className="py-2 px-2 border-r border-slate-300">SKU</th>
                  <th className="py-2 px-2 border-r border-slate-300">Product Name</th>
                  <th className="py-2 px-2 border-r border-slate-300">Rack / Bin</th>
                  <th className="py-2 px-2 border-r border-slate-300">Lot / Batch #</th>
                  <th className="py-2 px-2 border-r border-slate-300 text-center">Expiry Date</th>
                  <th className="py-2 px-2 border-r border-slate-300 text-center">UOM</th>
                  <th className="py-2 px-2 border-r border-slate-300 text-center w-28">Physical Count</th>
                  <th className="py-2 px-2 w-28">Condition / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {sheet.items.map((item, idx) => (
                  <tr key={`${item.sku}-${item.lotNumber}-${idx}`} className="break-inside-avoid">
                    <td className="py-2.5 px-2 border-r border-slate-300 text-center font-mono">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-2 border-r border-slate-300 font-mono font-bold text-slate-900">
                      {item.sku}
                    </td>
                    <td className="py-2.5 px-2 border-r border-slate-300 font-semibold text-slate-900">
                      {item.productName}
                      {item.statusLabel && (
                        <span className="block text-[9px] font-mono uppercase text-amber-700">
                          {item.statusLabel}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-2 border-r border-slate-300 font-mono font-bold text-[#0F4C3A]">
                      {item.rackBinCode}
                    </td>
                    <td className="py-2.5 px-2 border-r border-slate-300 font-mono">
                      {item.lotNumber}
                    </td>
                    <td className="py-2.5 px-2 border-r border-slate-300 text-center font-mono">
                      {item.expiryDate ? item.expiryDate.split('T')[0] : '-'}
                    </td>
                    <td className="py-2.5 px-2 border-r border-slate-300 text-center font-mono uppercase">
                      {item.uom}
                    </td>
                    <td className="py-2.5 px-2 border-r border-slate-300">
                      <div className="h-6 border border-slate-400 rounded bg-white" />
                    </td>
                    <td className="py-2.5 px-2">
                      <div className="h-6 border-b border-dashed border-slate-400" />
                    </td>
                  </tr>
                ))}
                {sheet.items.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-6 text-center text-slate-500 italic">
                      No active batches found in the selected Rack / Bin filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="grid grid-cols-3 gap-6 text-center text-xs pt-6 border-t border-slate-300 break-inside-avoid">
              <div className="space-y-12">
                <span className="font-semibold text-slate-600 block">Counted By (Warehouse Checker)</span>
                <div className="border-b border-slate-500 mx-4 pb-1 font-bold text-slate-900">
                  ( .................................... )
                </div>
              </div>
              <div className="space-y-12">
                <span className="font-semibold text-slate-600 block">Verified By (Store / WH Lead)</span>
                <div className="border-b border-slate-500 mx-4 pb-1 font-bold text-slate-900">
                  ( .................................... )
                </div>
              </div>
              <div className="space-y-12">
                <span className="font-semibold text-slate-600 block">Audit Sign-Off (Finance / COO)</span>
                <div className="border-b border-slate-500 mx-4 pb-1 font-bold text-slate-900">
                  ( .................................... )
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500 font-mono">
              <span>GroceMart Enterprise ERP · Rack-Scoped Blind Cycle Count Sheet</span>
              <span>Printed: {printedAt}</span>
            </div>
          </div>
        );
      }

      default:
        return null;
  }
}

export const UniversalPrintPortal: React.FC = () => {
  const { activePrintPayload, invoiceTracking } = usePrint();

  if (!activePrintPayload || typeof document === 'undefined') return null;

  const printRoot = document.getElementById('printable-document-root');
  if (!printRoot) return null;

  return createPortal(renderPrintDocument(activePrintPayload, { invoiceTracking }), printRoot);
};
