import React from 'react';
import { Store, ArrowRight, ShieldCheck, Clock, Sparkles } from 'lucide-react';
import { heroStoreImg } from '../data/mockData';
import { SafeImage } from './SafeImage';

interface HeroSectionProps {
  onNavigateToCatalog: () => void;
  onNavigateToStores: () => void;
  onNavigateToStory: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onNavigateToCatalog,
  onNavigateToStores,
  onNavigateToStory,
}) => {
  return (
    <section id="hero" className="relative pt-6 pb-16 lg:pt-10 lg:pb-24 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Hero Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Text Column */}
          <div className="lg:col-span-6 flex flex-col justify-center">
            {/* Clean Unboxed Kicker (No Pill Badges) */}
            <div className="text-xs font-semibold text-emerald-800 tracking-wider uppercase mb-3 flex items-center gap-2">
              <span>PT Bumi Retail Sejahtera</span>
              <span aria-hidden="true">·</span>
              <span>Indonesian Grocery Chain</span>
              <span aria-hidden="true">·</span>
              <span>Established 1998</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-stone-900 leading-[1.15] font-display text-balance">
              Harvest Freshness from Local Soil to Your Neighborhood Table
            </h1>

            <p className="mt-5 text-base sm:text-lg text-stone-600 leading-relaxed text-pretty">
              Connecting 450+ Indonesian family farms directly to 34 modern supermarkets across Java, Bali, and Sumatra. Experience artisan bakeries, certified butcheries, and crisp hydroponic produce—available in-store or delivered to your door with instant QRIS checkout.
            </p>

            {/* Functional CTA row */}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                onClick={onNavigateToCatalog}
                className="px-6 py-3.5 text-sm font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Shop Online Catalog</span>
                <ArrowRight className="w-4 h-4 text-amber-300" />
              </button>
              <button
                onClick={onNavigateToStores}
                className="px-6 py-3.5 text-sm font-semibold text-stone-800 bg-white hover:bg-stone-100 border border-stone-300 rounded-lg transition-all flex items-center gap-2 cursor-pointer"
              >
                <Store className="w-4 h-4 text-emerald-800" />
                <span>Explore 34 Store Locations</span>
              </button>
              <button
                onClick={onNavigateToStory}
                className="text-xs sm:text-sm font-medium text-stone-600 hover:text-emerald-800 underline underline-offset-4 transition-colors cursor-pointer"
              >
                Read 28-Year Heritage
              </button>
            </div>
          </div>

          {/* Right Showcase Image Card */}
          <div className="lg:col-span-6">
            <div className="relative rounded-2xl overflow-hidden border border-stone-200/80 shadow-md bg-stone-100 aspect-16/10">
              <SafeImage
                src={heroStoreImg}
                fallbackSrc="/images/hero_grocemart_store_1791623358669.jpg"
                alt="GroceMart modern supermarket interior with fresh produce and artisan bakery"
                category="produce"
                className="w-full h-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950/70 via-stone-950/15 to-transparent pointer-events-none" />
              
              <div className="absolute bottom-4 left-4 right-4 p-4 rounded-xl bg-stone-900/80 backdrop-blur-md text-white border border-white/10">
                <div className="flex items-center justify-between text-xs text-stone-300 mb-1">
                  <span className="font-medium text-amber-300">Flagship Senopati Outlet</span>
                  <span>Open Daily 07:00 - 22:00</span>
                </div>
                <p className="text-sm font-semibold text-stone-100">
                  Hydroponic Live Wall & In-House Sourdough Bakery Station
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Adjacency Proof Row (Full-width 4-column strip below hero) */}
        <div className="mt-14 pt-8 border-t border-stone-200 grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-1">
            <p className="text-2xl sm:text-3xl font-bold text-stone-900 font-display tabular-nums">
              34 Outlets
            </p>
            <p className="text-xs sm:text-sm text-stone-600">
              Across Greater Jakarta, Bandung, Surabaya, Bali, Medan & Yogya
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-2xl sm:text-3xl font-bold text-stone-900 font-display tabular-nums">
              450+ Farms
            </p>
            <p className="text-xs sm:text-sm text-stone-600">
              Contracted partner cooperatives in Lembang, Bedugul & Ciwidey
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-2xl sm:text-3xl font-bold text-stone-900 font-display tabular-nums">
              &lt; 12 Hours
            </p>
            <p className="text-xs sm:text-sm text-stone-600">
              Average harvest-to-shelf duration via proprietary 4°C cold chain
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-2xl sm:text-3xl font-bold text-stone-900 font-display tabular-nums">
              Instant QRIS
            </p>
            <p className="text-xs sm:text-sm text-stone-600">
              Zero-fee cashless checkout with 1-hour doorstep express delivery
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
