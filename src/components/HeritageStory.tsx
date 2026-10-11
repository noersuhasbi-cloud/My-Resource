import React, { useState } from 'react';
import { COMPANY_MILESTONES, heritageFarmImg } from '../data/mockData';
import { Leaf, ShieldCheck, HeartHandshake, Truck, Check } from 'lucide-react';
import { SafeImage } from './SafeImage';

export const HeritageStory: React.FC = () => {
  const [selectedMilestone, setSelectedMilestone] = useState<number>(2026);

  const activeMilestone = COMPANY_MILESTONES.find((m) => m.year === selectedMilestone) || COMPANY_MILESTONES[COMPANY_MILESTONES.length - 1];

  return (
    <section id="story" className="py-16 sm:py-24 bg-stone-100/70 border-y border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl">
          <div className="text-xs font-semibold text-emerald-800 tracking-wider uppercase mb-2">
            Company Profile · 28 Years of Freshness
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-stone-900 font-display">
            From a Family Stall in Pasar Baru to Indonesia’s Premier Fresh Grocery Chain
          </h2>
          <p className="mt-4 text-base sm:text-lg text-stone-600 leading-relaxed">
            In 1998, GroceMart began with a straightforward conviction: local consumers deserved truly crisp, freshly picked greens, while hardworking Indonesian growers deserved fair, predictable wages. Today, with 34 stores operating across the nation, that foundational pledge remains unchanged.
          </p>
        </div>

        {/* Story Spotlight: Farmer Partnership + Photo */}
        <div className="mt-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-white p-6 sm:p-8 lg:p-10 rounded-2xl border border-stone-200 shadow-xs">
          <div className="lg:col-span-6 space-y-5">
            <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
              Local Agricultural Network
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-stone-900 font-display">
              Empowering 450+ Smallholder Farming Families
            </h3>
            <p className="text-sm sm:text-base text-stone-600 leading-relaxed">
              We eliminate multiple layers of speculative middlemen by entering into long-term Fair Harvest contracts with grower cooperatives in Lembang, Ciwidey, Bedugul, and the volcanic slopes of Mount Merapi. Our agronomists provide clean seed stock and soil testing, guaranteeing certified safe produce with zero chemical residues.
            </p>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-100">
                <p className="text-xs text-stone-500 font-medium">Farmer Base Wage</p>
                <p className="text-lg font-bold text-emerald-900 font-display mt-0.5">35% Above Spot</p>
                <p className="text-xs text-stone-500 mt-1">Insulating growers from sudden market crashes</p>
              </div>
              <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-100">
                <p className="text-xs text-stone-500 font-medium">Transit Speed</p>
                <p className="text-lg font-bold text-emerald-900 font-display mt-0.5">Sub-12 Hours</p>
                <p className="text-xs text-stone-500 mt-1">Chilled trucks arrive before supermarket dawn opening</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="relative rounded-xl overflow-hidden aspect-4/3 bg-stone-200 shadow-xs">
              <img
                src="/images/about_heritage_farm_1791623371694.jpg"
                alt="Indonesian local farm partner harvesting crisp vegetables in morning light"
                className="w-full h-full object-cover"
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950/70 via-stone-950/20 to-transparent pointer-events-none" />
              <div className="absolute bottom-3 left-3 right-3 p-3 bg-stone-900/80 backdrop-blur-md rounded-lg text-white border border-white/10 text-xs">
                <p className="font-semibold text-stone-100">Kebun Sari Bumi Cooperative · Lembang</p>
                <p className="text-stone-300 text-[11px] mt-0.5">Partnered with GroceMart since 2004 for pesticide-free organic leafy greens</p>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Milestones Timeline */}
        <div className="mt-16">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl sm:text-2xl font-bold text-stone-900 font-display">
                Key Growth Milestones
              </h3>
              <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
                Explore our 28-year evolution from a 30m² stall to a national retail grocery network
              </p>
            </div>
          </div>

          {/* Interactive Year Selector (Segmented control) */}
          <div className="flex items-center gap-2 p-1.5 bg-white border border-stone-200 rounded-xl overflow-x-auto">
            {COMPANY_MILESTONES.map((m) => {
              const isSelected = m.year === selectedMilestone;
              return (
                <button
                  key={m.year}
                  onClick={() => setSelectedMilestone(m.year)}
                  className={`flex-1 min-w-[100px] py-2.5 px-3 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                  }`}
                >
                  <span className="block font-mono text-sm">{m.year}</span>
                  <span className="block text-[11px] font-normal truncate opacity-90">{m.title}</span>
                </button>
              );
            })}
          </div>

          {/* Active Milestone Card */}
          <div className="mt-6 bg-white p-6 sm:p-8 rounded-2xl border border-stone-200 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-100">
              <div>
                <span className="text-xs font-mono font-bold text-emerald-800 tracking-wider">
                  YEAR {activeMilestone.year}
                </span>
                <h4 className="text-xl font-bold text-stone-900 font-display mt-1">
                  {activeMilestone.title}
                </h4>
                <p className="text-xs text-stone-500">{activeMilestone.subtitle}</p>
              </div>
              {activeMilestone.metric && (
                <div className="px-4 py-2 bg-stone-50 rounded-lg border border-stone-200 text-xs font-medium text-stone-700 whitespace-nowrap self-start sm:self-auto">
                  {activeMilestone.metric}
                </div>
              )}
            </div>
            <p className="mt-4 text-sm sm:text-base text-stone-600 leading-relaxed">
              {activeMilestone.description}
            </p>
          </div>
        </div>

        {/* 4 Quality Standards Pillars */}
        <div className="mt-16 pt-12 border-t border-stone-200">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h3 className="text-xl sm:text-2xl font-bold text-stone-900 font-display">
              The GroceMart Freshness Guarantee
            </h3>
            <p className="text-xs sm:text-sm text-stone-500 mt-1">
              Every single product on our shelves meets stringent culinary and safety specifications
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-5 bg-white rounded-xl border border-stone-200 space-y-2">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold">
                <Truck className="w-5 h-5" />
              </div>
              <h4 className="font-semibold text-sm text-stone-900">4°C Cold Chain Protocol</h4>
              <p className="text-xs text-stone-600 leading-relaxed">
                Refrigerated supply transit ensures leafy greens never suffer wilt or enzymatic breakdown prior to reaching display decks.
              </p>
            </div>

            <div className="p-5 bg-white rounded-xl border border-stone-200 space-y-2">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h4 className="font-semibold text-sm text-stone-900">100% Halal & Lab Inspected</h4>
              <p className="text-xs text-stone-600 leading-relaxed">
                Certified Halal butcheries, separate processing counters, and routine independent laboratory testing for pesticide residue.
              </p>
            </div>

            <div className="p-5 bg-white rounded-xl border border-stone-200 space-y-2">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold">
                <HeartHandshake className="w-5 h-5" />
              </div>
              <h4 className="font-semibold text-sm text-stone-900">Fair Harvest Contract</h4>
              <p className="text-xs text-stone-600 leading-relaxed">
                Guaranteed minimum purchase agreements shield Indonesian family farmers from wholesale commodity market manipulation.
              </p>
            </div>

            <div className="p-5 bg-white rounded-xl border border-stone-200 space-y-2">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold">
                <Leaf className="w-5 h-5" />
              </div>
              <h4 className="font-semibold text-sm text-stone-900">Zero Plastic Bag Mission</h4>
              <p className="text-xs text-stone-600 leading-relaxed">
                Completely biodegradable cassava-starch bags and cardboard crate packaging across all 34 supermarkets and online deliveries.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
