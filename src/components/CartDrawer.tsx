import React, { useState } from 'react';
import type { CartItem, StoreLocation, StoreOperationalStatus } from '../types';
import { formatIDR } from '../utils/formatters';
import { STORE_LOCATIONS } from '../data/mockData';
import { X, Trash2, Plus, Minus, ArrowRight, Tag, Truck, Store, Clock, ShoppingBag, AlertTriangle } from 'lucide-react';
import { SafeImage } from './SafeImage';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onProceedToCheckout: () => void;
  deliveryMethod: 'instant' | 'scheduled' | 'pickup';
  onChangeDeliveryMethod: (method: 'instant' | 'scheduled' | 'pickup') => void;
  selectedPickupStore?: StoreLocation;
  onSelectPickupStore: (store: StoreLocation) => void;
  voucherCode: string;
  appliedDiscount: number;
  onApplyVoucher: (code: string) => { success: boolean; message: string };
  onRemoveVoucher: () => void;
  storeStatus?: StoreOperationalStatus | null;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onProceedToCheckout,
  deliveryMethod,
  onChangeDeliveryMethod,
  selectedPickupStore,
  onSelectPickupStore,
  voucherCode,
  appliedDiscount,
  onApplyVoucher,
  onRemoveVoucher,
  storeStatus,
}) => {
  const [voucherInput, setVoucherInput] = useState<string>('');
  const [voucherFeedback, setVoucherFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const subtotal = items.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  const deliveryFee = deliveryMethod === 'pickup' ? 0 : deliveryMethod === 'instant' ? 15000 : 10000;
  const total = Math.max(0, subtotal + deliveryFee - appliedDiscount);

  const handleApplyVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!voucherInput.trim()) return;
    const res = onApplyVoucher(voucherInput.trim().toUpperCase());
    setVoucherFeedback(res.message);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-stone-950/60 backdrop-blur-xs transition-opacity animate-in fade-in"
      />

      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="px-6 py-5 border-b border-stone-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShoppingBag className="w-5 h-5 text-emerald-800" />
              <div>
                <h2 className="text-lg font-bold text-stone-900 font-display">
                  Shopping Bag
                </h2>
                <p className="text-xs text-stone-500">
                  {items.length} {items.length === 1 ? 'grocery item' : 'grocery items'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {/* Delivery Method Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider block">
                Fulfillment Mode
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => onChangeDeliveryMethod('instant')}
                  className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 cursor-pointer ${
                    deliveryMethod === 'instant'
                      ? 'border-emerald-800 bg-emerald-50/50 text-emerald-900 font-semibold'
                      : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  <Truck className="w-4 h-4 text-emerald-800" />
                  <span className="text-[11px] leading-tight">1-Hr Express</span>
                  <span className="text-[10px] text-stone-500 font-mono">Rp 15.000</span>
                </button>

                <button
                  type="button"
                  onClick={() => onChangeDeliveryMethod('scheduled')}
                  className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 cursor-pointer ${
                    deliveryMethod === 'scheduled'
                      ? 'border-emerald-800 bg-emerald-50/50 text-emerald-900 font-semibold'
                      : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  <Clock className="w-4 h-4 text-emerald-800" />
                  <span className="text-[11px] leading-tight">Same Day</span>
                  <span className="text-[10px] text-stone-500 font-mono">Rp 10.000</span>
                </button>

                <button
                  type="button"
                  onClick={() => onChangeDeliveryMethod('pickup')}
                  className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 cursor-pointer ${
                    deliveryMethod === 'pickup'
                      ? 'border-emerald-800 bg-emerald-50/50 text-emerald-900 font-semibold'
                      : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  <Store className="w-4 h-4 text-emerald-800" />
                  <span className="text-[11px] leading-tight">Store Pickup</span>
                  <span className="text-[10px] text-emerald-700 font-bold">FREE</span>
                </button>
              </div>

              {/* Pickup branch selection if pickup chosen */}
              {deliveryMethod === 'pickup' && (
                <div className="mt-2.5 p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1.5">
                  <span className="text-[11px] font-semibold text-stone-600 block">
                    Choose Pickup Branch:
                  </span>
                  <select
                    value={selectedPickupStore?.id || STORE_LOCATIONS[0].id}
                    onChange={(e) => {
                      const found = STORE_LOCATIONS.find((s) => s.id === e.target.value);
                      if (found) onSelectPickupStore(found);
                    }}
                    className="w-full p-2 bg-white border border-stone-200 rounded-lg text-xs font-medium text-stone-800 focus:outline-none"
                  >
                    {STORE_LOCATIONS.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} ({st.city})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-stone-500">
                    Pickup orders are packaged in insulated crates within 30 minutes of payment.
                  </p>
                </div>
              )}
            </div>

            {/* Items List */}
            {items.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <ShoppingBag className="w-10 h-10 text-stone-300 mx-auto" />
                <p className="text-stone-900 font-semibold text-sm">Your Bag is Empty</p>
                <p className="text-stone-500 text-xs">
                  Discover daily farm produce and bakery loaves from our catalog.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider block">
                  Items in Basket ({items.length})
                </label>
                {items.map((item) => (
                  <div
                    key={item.product.id}
                    className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl border border-stone-200/80"
                  >
                    <SafeImage
                      src={item.product.image}
                      alt={item.product.name}
                      category={item.product.category}
                      className="w-full h-full object-cover"
                      containerClassName="w-14 h-14 rounded-lg overflow-hidden bg-stone-200 shrink-0"
                    />

                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-stone-900 truncate">
                        {item.product.name}
                      </h4>
                      <p className="text-[11px] text-stone-500">{item.product.unit}</p>
                      <p className="text-xs font-mono font-semibold text-emerald-900 tabular-nums mt-0.5">
                        {formatIDR(item.product.price)}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <div className="flex items-center gap-1.5 bg-white border border-stone-200 rounded-lg p-1">
                        <button
                          onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                          className="w-5 h-5 rounded flex items-center justify-center text-stone-600 hover:bg-stone-100"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-mono text-xs font-bold px-1 tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                          className="w-5 h-5 rounded flex items-center justify-center text-stone-600 hover:bg-stone-100"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        onClick={() => onRemoveItem(item.product.id)}
                        className="text-[10px] text-stone-400 hover:text-red-600 transition-colors flex items-center gap-0.5"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Voucher Code Form */}
            {items.length > 0 && (
              <div className="space-y-2 pt-2">
                <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider block">
                  Promo Voucher
                </label>
                {voucherCode ? (
                  <div className="flex items-center justify-between p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-900">
                    <div className="flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5 text-emerald-700" />
                      <span className="font-mono font-bold">{voucherCode}</span>
                      <span>(-{formatIDR(appliedDiscount)})</span>
                    </div>
                    <button
                      onClick={onRemoveVoucher}
                      className="text-emerald-700 hover:text-emerald-900 font-semibold underline text-[11px]"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApplyVoucher} className="flex gap-2">
                    <input
                      type="text"
                      value={voucherInput}
                      onChange={(e) => setVoucherInput(e.target.value)}
                      placeholder="Use 'GROCEFRESH' or 'FREEDELIVERY'"
                      className="flex-1 px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-mono uppercase focus:outline-none focus:ring-1 focus:ring-emerald-800"
                    />
                    <button
                      type="submit"
                      className="px-3 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Apply
                    </button>
                  </form>
                )}
                {voucherFeedback && (
                  <p className="text-[11px] text-stone-500 mt-1">{voucherFeedback}</p>
                )}
              </div>
            )}
          </div>

          {/* Footer & Pricing Summary */}
          {items.length > 0 && (
            <div className="p-6 border-t border-stone-200 bg-stone-50/70 space-y-3">
              {/* Store Closure Notice Banner */}
              {storeStatus && (!storeStatus.isOpen || storeStatus.isHolidayMode) && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Outlet Currently Closed</span>
                    <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                      {storeStatus.noticeBanner || 'This outlet is currently closed. Operating hours resume at 07:00 WIB. Catalog browsing is open, but online checkout is temporarily locked.'}
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-1.5 text-xs text-stone-600">
                <div className="flex justify-between">
                  <span>Groceries Subtotal</span>
                  <span className="font-mono tabular-nums">{formatIDR(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery ({deliveryMethod === 'pickup' ? 'Self Pickup' : deliveryMethod})</span>
                  <span className="font-mono tabular-nums">
                    {deliveryFee === 0 ? 'FREE' : formatIDR(deliveryFee)}
                  </span>
                </div>
                {appliedDiscount > 0 && (
                  <div className="flex justify-between text-emerald-800 font-semibold">
                    <span>Discount Voucher</span>
                    <span className="font-mono tabular-nums">-{formatIDR(appliedDiscount)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-stone-200 flex justify-between text-base font-bold text-stone-900">
                  <span>Total Due</span>
                  <span className="font-mono tabular-nums text-emerald-900">{formatIDR(total)}</span>
                </div>
              </div>

              <button
                onClick={onProceedToCheckout}
                disabled={!!(storeStatus && (!storeStatus.isOpen || storeStatus.isHolidayMode))}
                className="w-full py-3.5 px-4 bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-stone-400"
              >
                <span>
                  {storeStatus && (!storeStatus.isOpen || storeStatus.isHolidayMode)
                    ? 'Checkout Locked (Outlet Closed)'
                    : 'Proceed to QRIS Checkout'}
                </span>
                <ArrowRight className="w-4 h-4 text-amber-300" />
              </button>
              <p className="text-[11px] text-stone-400 text-center">
                Secure QRIS transaction protected by Bank Indonesia Standard
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
