import React, { useState } from 'react';
import { ShoppingBag, User, Menu, X, ArrowRight, Store, BookOpen, Truck, Sparkles, ShieldCheck, AlertTriangle, CreditCard } from 'lucide-react';
import type { CartItem, StoreOperationalStatus } from '../types/index.ts';
import { formatIDR } from '../utils/formatters';

interface HeaderProps {
  cartItems: CartItem[];
  onOpenCart: () => void;
  onOpenPortal: () => void;
  storeStatus?: StoreOperationalStatus | null;
  activeSection: string;
  onNavigate: (sectionId: string) => void;
  isLoggedIn: boolean;
  customerName?: string;
  memberTier?: string;
}

export const Header: React.FC<HeaderProps> = ({
  cartItems,
  onOpenCart,
  onOpenPortal,
  storeStatus,
  activeSection,
  onNavigate,
  isLoggedIn,
  customerName,
  memberTier,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const totalItemsCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  const cartSubtotal = cartItems.reduce((acc, item) => acc + item.product.price * item.quantity, 0);

  const handleMobileNav = (sectionId: string) => {
    setMobileMenuOpen(false);
    onNavigate(sectionId);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200/80 transition-all">
      {/* Dynamic Storefront Announcement / Closure Banner */}
      {storeStatus?.noticeBanner && (
        <div className="bg-amber-500 text-stone-950 font-semibold text-xs px-4 py-2 text-center flex items-center justify-center gap-2 shadow-xs border-b border-amber-600/30">
          <AlertTriangle className="w-4 h-4 shrink-0 text-stone-950" />
          <span className="font-bold">{storeStatus.noticeBanner}</span>
          {storeStatus.reopenEstimated && (
            <span className="opacity-90 hidden sm:inline font-normal">· {storeStatus.reopenEstimated}</span>
          )}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 sm:gap-8 h-20">
          {/* Zone 1: Brand Wordmark (Strict single element) */}
          <button
            onClick={() => onNavigate('hero')}
            className="text-left group cursor-pointer focus:outline-none flex items-center gap-3 shrink-0 py-2"
            aria-label="GroceMart Home"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-800 text-amber-300 flex items-center justify-center font-bold text-xl shadow-xs group-hover:bg-emerald-900 group-hover:scale-105 transition-all">
              G
            </div>
            <div className="whitespace-nowrap shrink-0">
              <span className="text-2xl font-bold tracking-tight text-stone-900 group-hover:text-emerald-800 transition-colors font-display">
                GroceMart
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs font-semibold text-emerald-800/80 uppercase tracking-widest">
                Est. 1998
              </span>
            </div>
          </button>

          {/* Zone 2: 4-5 Clean single-line text navigation links (Desktop) */}
          <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-stone-600">
            <button
              onClick={() => onNavigate('story')}
              className={`hover:text-emerald-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer py-2 ${
                activeSection === 'story' ? 'text-emerald-800 font-semibold' : ''
              }`}
            >
              Our Heritage & Story
            </button>
            <button
              onClick={() => onNavigate('stores')}
              className={`hover:text-emerald-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer py-2 ${
                activeSection === 'stores' ? 'text-emerald-800 font-semibold' : ''
              }`}
            >
              Store Locations
            </button>
            <button
              onClick={() => onNavigate('catalog')}
              className={`hover:text-emerald-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer py-2 ${
                activeSection === 'catalog' ? 'text-emerald-800 font-semibold' : ''
              }`}
            >
              Shop Groceries
            </button>
            <button
              onClick={() => onNavigate('tracking')}
              className={`hover:text-emerald-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer py-2 ${
                activeSection === 'tracking' ? 'text-emerald-800 font-semibold' : ''
              }`}
            >
              Track Orders
            </button>
          </nav>

          {/* Zone 3: Primary Action & Portal Trigger */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Staff ERP & POS Quick Portal Button */}
            <a
              href="#admin-erp"
              className="hidden md:flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 active:scale-98 rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer min-h-[44px]"
              title="Open Staff ERP & POS Cashier Portal"
            >
              <CreditCard className="w-3.5 h-3.5 text-emerald-800" />
              <span>ERP &amp; POS</span>
            </a>

            {/* Customer Portal Button */}
            <button
              onClick={onOpenPortal}
              className="hidden sm:flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 active:scale-98 rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer min-h-[44px]"
              title="Customer Portal"
            >
              <User className="w-4 h-4 text-emerald-800" />
              <span>
                {isLoggedIn && customerName ? customerName.split(' ')[0] : 'Customer Portal'}
              </span>
              {memberTier && (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded ml-0.5">
                  Gold
                </span>
              )}
            </button>

            {/* Cart Trigger Button */}
            <button
              onClick={onOpenCart}
              className="flex items-center gap-2.5 px-4 py-2.5 text-xs sm:text-sm font-medium text-white bg-emerald-800 hover:bg-emerald-900 active:scale-95 rounded-xl shadow-xs hover:shadow transition-all whitespace-nowrap shrink-0 cursor-pointer min-h-[44px]"
              aria-label={`Shopping bag with ${totalItemsCount} items`}
            >
              <div className="relative">
                <ShoppingBag className="w-4 h-4 text-amber-300" />
                {totalItemsCount > 0 && (
                  <span className="absolute -top-2.5 -right-2.5 bg-amber-400 text-stone-950 font-bold text-[10px] w-4.5 h-4.5 rounded-full flex items-center justify-center shadow-xs animate-in zoom-in-75">
                    {totalItemsCount}
                  </span>
                )}
              </div>
              <span className="font-semibold">Cart</span>
              {totalItemsCount > 0 && (
                <span className="hidden sm:inline text-emerald-200 font-mono text-xs tabular-nums">
                  ({formatIDR(cartSubtotal)})
                </span>
              )}
            </button>

            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Slide-Down / Dropdown Navigation Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-stone-200 px-4 py-4 space-y-3 animate-in slide-in-from-top-3 duration-200">
          <div className="grid grid-cols-2 gap-2 pb-2">
            <button
              onClick={() => handleMobileNav('story')}
              className="flex items-center gap-2 p-3 rounded-xl bg-stone-50 text-stone-800 text-xs font-semibold hover:bg-stone-100 transition-colors text-left"
            >
              <BookOpen className="w-4 h-4 text-emerald-800" />
              <span>Our Heritage</span>
            </button>
            <button
              onClick={() => handleMobileNav('stores')}
              className="flex items-center gap-2 p-3 rounded-xl bg-stone-50 text-stone-800 text-xs font-semibold hover:bg-stone-100 transition-colors text-left"
            >
              <Store className="w-4 h-4 text-emerald-800" />
              <span>34 Locations</span>
            </button>
            <button
              onClick={() => handleMobileNav('catalog')}
              className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 text-emerald-900 text-xs font-semibold hover:bg-emerald-100 transition-colors text-left"
            >
              <ShoppingBag className="w-4 h-4 text-emerald-800" />
              <span>Shop Groceries</span>
            </button>
            <button
              onClick={() => handleMobileNav('tracking')}
              className="flex items-center gap-2 p-3 rounded-xl bg-stone-50 text-stone-800 text-xs font-semibold hover:bg-stone-100 transition-colors text-left"
            >
              <Truck className="w-4 h-4 text-emerald-800" />
              <span>Live Tracking</span>
            </button>
          </div>

          <div className="pt-2 border-t border-stone-100 space-y-2">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenPortal();
              }}
              className="w-full py-3 px-4 bg-stone-900 text-white rounded-xl text-xs font-semibold flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-amber-300" />
                <span>
                  {isLoggedIn && customerName ? `Account: ${customerName}` : 'Customer Sign In / Portal'}
                </span>
              </div>
              <ArrowRight className="w-4 h-4 text-stone-400" />
            </button>
            <a
              href="#admin-erp"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full py-2.5 px-4 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-800" />
                <span>Staff ERP &amp; POS Cashier Portal</span>
              </div>
              <ArrowRight className="w-4 h-4 text-emerald-700" />
            </a>
          </div>
        </div>
      )}
    </header>
  );
};
