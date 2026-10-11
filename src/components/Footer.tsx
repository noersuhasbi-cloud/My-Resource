import React from 'react';
import { Store, Phone, Mail, ShieldCheck, MapPin, Heart } from 'lucide-react';

interface FooterProps {
  onNavigate: (sectionId: string) => void;
  onOpenPortal: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate, onOpenPortal }) => {
  return (
    <footer className="bg-stone-900 text-stone-300 border-t border-stone-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-700 text-amber-300 flex items-center justify-center font-bold text-lg">
                G
              </div>
              <span className="text-xl font-bold tracking-tight text-white font-display">
                GroceMart Indonesia
              </span>
            </div>
            <p className="text-xs sm:text-sm text-stone-400 leading-relaxed max-w-sm">
              PT Bumi Retail Sejahtera. Founded in 1998, GroceMart is an Indonesian grocery retail supermarket chain dedicated to farm-direct produce, unbroken 4°C cold chain logistics, and frictionless neighborhood service.
            </p>
            <div className="pt-2 text-xs text-stone-400 space-y-1">
              <p className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Halal MUI Certified · BPOM Inspected · GAP Certified</span>
              </p>
              <p className="flex items-center gap-2">
                <Store className="w-4 h-4 text-amber-400 shrink-0" />
                <span>34 Supermarket Branches Across 6 Metropolitan Regions</span>
              </p>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-stone-100">
              Corporate & Story
            </p>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li>
                <button
                  onClick={() => onNavigate('story')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Our 1998 Heritage Story
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('story')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Farmer Cooperative Network
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('stores')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  34 Store Locations
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('story')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Sustainability & Zero-Plastic
                </button>
              </li>
            </ul>
          </div>

          {/* Online Shopping & Customer */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-stone-100">
              Customer Portal
            </p>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li>
                <button
                  onClick={onOpenPortal}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Track Live Order Status
                </button>
              </li>
              <li>
                <button
                  onClick={onOpenPortal}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Sign In / Member Account
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('catalog')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Browse Fresh Produce
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('catalog')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  QRIS Payment Guide
                </button>
              </li>
            </ul>
          </div>

          {/* Head Office & Hotline */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-stone-100">
              Customer Care Hub
            </p>
            <div className="space-y-2 text-xs sm:text-sm text-stone-400">
              <p className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>+62 21 720 8891 (Toll-Free)</span>
              </p>
              <p className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>care@grocemart.co.id</span>
              </p>
              <p className="flex items-start gap-2 pt-1 text-[11px] leading-tight">
                <MapPin className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
                <span>Wisma GroceMart HQ, Jl. Senopati No. 82, Jakarta Selatan 12110</span>
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-stone-800 flex flex-col sm:flex-row items-center justify-between text-xs text-stone-500 gap-4">
          <p>© 1998 - 2026 PT Bumi Retail Sejahtera (GroceMart). All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span className="hover:text-stone-300 cursor-pointer">Privacy Charter</span>
            <span>·</span>
            <span className="hover:text-stone-300 cursor-pointer">Terms of Delivery</span>
            <span>·</span>
            <span className="hover:text-stone-300 cursor-pointer">QRIS Merchant ASPI 2026</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
