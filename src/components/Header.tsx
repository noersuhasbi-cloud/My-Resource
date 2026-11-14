import React, { useState } from 'react';
import { ShoppingBag, User, Menu, X, ArrowRight, Store, BookOpen, Truck, Sparkles, ShieldCheck, AlertTriangle, CreditCard } from 'lucide-react';
import type { CartItem, B2BCartItem, StoreOperationalStatus } from '../types/index.ts';
import { formatIDR } from '../utils/formatters';
import { DarkModeToggle } from './DarkModeToggle';

interface HeaderProps {
  cartItems: CartItem[];
  b2bCartItems?: B2BCartItem[];
  onOpenCart: () => void;
  onOpenPortal: () => void;
  storeStatus?: StoreOperationalStatus | null;
  activeSection: string;
  onNavigate: (sectionId: string) => void;
  isLoggedIn: boolean;
  customerName?: string;
  memberTier?: string;
  storefrontMode?: 'b2c' | 'b2b';
  onToggleStorefrontMode?: (mode: 'b2c' | 'b2b') => void;
  b2bCustomerName?: string;
  b2bCustomerTier?: string;
}

export const Header: React.FC<HeaderProps> = ({
  cartItems,
  b2bCartItems = [],
  onOpenCart,
  onOpenPortal,
  storeStatus,
  activeSection,
  onNavigate,
  isLoggedIn,
  customerName,
  memberTier,
  storefrontMode = 'b2c',
  onToggleStorefrontMode,
  b2bCustomerName,
  b2bCustomerTier,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isB2B = storefrontMode === 'b2b';
  const totalB2CItems = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  const totalB2BItems = b2bCartItems.reduce((acc, item) => acc + item.quantity, 0);
  const totalItemsCount = isB2B ? totalB2BItems : totalB2CItems;

  const b2cSubtotal = cartItems.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  const b2bSubtotal = b2bCartItems.reduce((acc, item) => acc + item.lineTotal, 0);
  const cartSubtotal = isB2B ? b2bSubtotal : b2cSubtotal;

  const handleMobileNav = (sectionId: string) => {
    setMobileMenuOpen(false);
    onNavigate(sectionId);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-stone-950/95 backdrop-blur-md border-b border-stone-200/80 dark:border-stone-800/80 transition-all">
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

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-2 sm:gap-4 h-16 sm:h-20">
          {/* Zone 1: Brand Wordmark */}
          <button
            onClick={() => onNavigate('hero')}
            className="text-left group cursor-pointer focus:outline-none flex items-center gap-2 sm:gap-3 shrink-0 py-1"
            aria-label="GroceMart Home"
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-800 text-amber-300 flex items-center justify-center font-bold text-lg sm:text-xl shadow-xs group-hover:bg-emerald-900 group-hover:scale-105 transition-all">
              G
            </div>
            <div className="whitespace-nowrap shrink-0">
              <span className="text-lg sm:text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100 group-hover:text-emerald-800 dark:group-hover:text-emerald-400 transition-colors font-display">
                GroceMart
              </span>
              <span className="hidden xl:inline-block ml-2 text-xs font-semibold text-emerald-800/80 dark:text-emerald-400/80 uppercase tracking-widest">
                Est. 1998
              </span>
            </div>
          </button>

          {/* Zone 2: Navigation Links (Desktop) */}
          <nav className="hidden lg:flex items-center gap-5 xl:gap-7 text-sm font-medium text-stone-600 dark:text-stone-300">
            <button
              onClick={() => onNavigate('story')}
              className={`hover:text-emerald-800 dark:hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer py-2 ${
                activeSection === 'story' ? 'text-emerald-800 dark:text-emerald-400 font-semibold' : ''
              }`}
            >
              Our Heritage
            </button>
            <button
              onClick={() => onNavigate('stores')}
              className={`hover:text-emerald-800 dark:hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer py-2 ${
                activeSection === 'stores' ? 'text-emerald-800 dark:text-emerald-400 font-semibold' : ''
              }`}
            >
              Store Locations
            </button>
            <button
              onClick={() => onNavigate('catalog')}
              className={`hover:text-emerald-800 dark:hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer py-2 ${
                activeSection === 'catalog' ? 'text-emerald-800 dark:text-emerald-400 font-semibold' : ''
              }`}
            >
              {isB2B ? 'Wholesale Catalog' : 'Shop Groceries'}
            </button>
            <button
              onClick={() => onNavigate('tracking')}
              className={`hover:text-emerald-800 dark:hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer py-2 ${
                activeSection === 'tracking' ? 'text-emerald-800 dark:text-emerald-400 font-semibold' : ''
              }`}
            >
              Track Orders
            </button>
          </nav>

          {/* Zone 3: Primary Action & Controls (Responsive across mobile, tablet, desktop) */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Single Source of Truth Mode Switcher (Visible on both Mobile and Desktop) */}
            {onToggleStorefrontMode && (
              <div className="flex items-center p-0.5 sm:p-1 bg-stone-100 dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => onToggleStorefrontMode('b2c')}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg transition-all cursor-pointer text-[11px] sm:text-xs ${
                    storefrontMode === 'b2c'
                      ? 'bg-white dark:bg-stone-800 text-emerald-900 dark:text-emerald-300 font-bold shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                  }`}
                  title="Switch to B2C Retail Groceries"
                >
                  <span className="inline md:hidden">B2C</span>
                  <span className="hidden md:inline">B2C Retail</span>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleStorefrontMode('b2b')}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg transition-all cursor-pointer text-[11px] sm:text-xs flex items-center gap-1 sm:gap-1.5 ${
                    storefrontMode === 'b2b'
                      ? 'bg-emerald-900 text-amber-300 font-bold shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                  }`}
                  title="Switch to B2B Wholesale Portal"
                >
                  <span className="inline md:hidden">B2B</span>
                  <span className="hidden md:inline">B2B Wholesale</span>
                  <span className="text-[9px] px-1 py-0.2 bg-amber-400 text-stone-950 rounded font-black hidden sm:inline">
                    GROSIR
                  </span>
                </button>
              </div>
            )}

            {/* Global Dark Mode Toggle */}
            <DarkModeToggle />

            {/* Staff ERP & POS Quick Portal Button (Desktop/Tablet) */}
            <a
              href="#admin-erp"
              className="hidden md:flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-900 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200/80 dark:border-emerald-800/60 active:scale-98 rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer min-h-[38px]"
              title="Open Staff ERP & POS Cashier Portal"
            >
              <CreditCard className="w-3.5 h-3.5 text-emerald-800 dark:text-emerald-400" />
              <span>ERP &amp; POS</span>
            </a>

            {/* Unified Customer Portal Button */}
            <button
              onClick={onOpenPortal}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-stone-700 dark:text-stone-200 bg-stone-100 dark:bg-stone-900 hover:bg-stone-200 dark:hover:bg-stone-800 border border-transparent dark:border-stone-800 active:scale-98 rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer min-h-[38px] sm:min-h-[42px]"
              title={isB2B ? 'Wholesale Account & Credit Facility' : 'Customer Account Portal'}
            >
              <User className="w-4 h-4 text-emerald-800 dark:text-emerald-400" />
              <span className="hidden sm:inline">
                {isB2B
                  ? (b2bCustomerName ? b2bCustomerName.split(' ')[0] : 'B2B Account')
                  : (isLoggedIn && customerName ? customerName.split(' ')[0] : 'Portal')}
              </span>
              {isB2B && b2bCustomerTier ? (
                <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-500/20 px-1.5 py-0.5 rounded hidden sm:inline">
                  {b2bCustomerTier}
                </span>
              ) : memberTier ? (
                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/20 px-1.5 py-0.5 rounded hidden sm:inline">
                  {memberTier.split(' ')[0]}
                </span>
              ) : null}
            </button>

            {/* Unified Cart Trigger Button */}
            <button
              onClick={onOpenCart}
              className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-white bg-emerald-800 hover:bg-emerald-900 dark:bg-emerald-700 dark:hover:bg-emerald-600 active:scale-95 rounded-xl shadow-xs hover:shadow transition-all whitespace-nowrap shrink-0 cursor-pointer min-h-[38px] sm:min-h-[42px]"
              aria-label={`Shopping cart with ${totalItemsCount} items`}
            >
              <div className="relative">
                <ShoppingBag className="w-4 h-4 text-amber-300" />
                {totalItemsCount > 0 && (
                  <span className="absolute -top-2.5 -right-2.5 bg-amber-400 text-stone-950 font-bold text-[10px] w-4.5 h-4.5 rounded-full flex items-center justify-center shadow-xs animate-in zoom-in-75">
                    {totalItemsCount}
                  </span>
                )}
              </div>
              <span className="font-semibold hidden xs:inline">
                {isB2B ? 'Grosir' : 'Cart'}
              </span>
              {totalItemsCount > 0 && (
                <span className="hidden md:inline text-emerald-200 font-mono text-xs tabular-nums">
                  ({formatIDR(cartSubtotal)})
                </span>
              )}
            </button>

            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors min-h-[38px] min-w-[38px] flex items-center justify-center cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Slide-Down / Dropdown Navigation Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white dark:bg-stone-950 border-b border-stone-200 dark:border-stone-800 px-4 py-4 space-y-3 animate-in slide-in-from-top-3 duration-200">
          <div className="grid grid-cols-2 gap-2 pb-2">
            <button
              onClick={() => handleMobileNav('story')}
              className="flex items-center gap-2 p-3 rounded-xl bg-stone-50 dark:bg-stone-900 text-stone-800 dark:text-stone-200 text-xs font-semibold hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-left"
            >
              <BookOpen className="w-4 h-4 text-emerald-800 dark:text-emerald-400" />
              <span>Our Heritage</span>
            </button>
            <button
              onClick={() => handleMobileNav('stores')}
              className="flex items-center gap-2 p-3 rounded-xl bg-stone-50 dark:bg-stone-900 text-stone-800 dark:text-stone-200 text-xs font-semibold hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-left"
            >
              <Store className="w-4 h-4 text-emerald-800 dark:text-emerald-400" />
              <span>34 Locations</span>
            </button>
            <button
              onClick={() => handleMobileNav('catalog')}
              className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors text-left"
            >
              <ShoppingBag className="w-4 h-4 text-emerald-800 dark:text-emerald-400" />
              <span>Shop Groceries</span>
            </button>
            <button
              onClick={() => handleMobileNav('tracking')}
              className="flex items-center gap-2 p-3 rounded-xl bg-stone-50 dark:bg-stone-900 text-stone-800 dark:text-stone-200 text-xs font-semibold hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-left"
            >
              <Truck className="w-4 h-4 text-emerald-800 dark:text-emerald-400" />
              <span>Live Tracking</span>
            </button>
          </div>

          <div className="pt-2 border-t border-stone-100 dark:border-stone-800 space-y-2">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenPortal();
              }}
              className="w-full py-3 px-4 bg-stone-900 dark:bg-stone-800 text-white rounded-xl text-xs font-semibold flex items-center justify-between"
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
              className="w-full py-2.5 px-4 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs font-semibold flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-800 dark:text-emerald-400" />
                <span>Staff ERP &amp; POS Cashier Portal</span>
              </div>
              <ArrowRight className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            </a>
          </div>
        </div>
      )}
    </header>
  );
};
