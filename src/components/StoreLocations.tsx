import React, { useState, useMemo } from 'react';
import { STORE_LOCATIONS } from '../data/mockData';
import { StoreLocation } from '../types';
import { MapPin, Clock, Phone, Navigation, Search, CheckCircle2, Sparkles, X, ExternalLink } from 'lucide-react';

interface StoreLocationsProps {
  selectedPickupStore?: StoreLocation;
  onSelectPickupStore: (store: StoreLocation) => void;
  onShopStoreGroceries: (store: StoreLocation) => void;
}

export const StoreLocations: React.FC<StoreLocationsProps> = ({
  selectedPickupStore,
  onSelectPickupStore,
  onShopStoreGroceries,
}) => {
  const [selectedCity, setSelectedCity] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeModalStore, setActiveModalStore] = useState<StoreLocation | null>(null);

  const cities = ['All', 'Jakarta', 'Bandung', 'Surabaya', 'Bali', 'Yogyakarta', 'Medan'];

  const filteredStores = useMemo(() => {
    return STORE_LOCATIONS.filter((store) => {
      const matchesCity = selectedCity === 'All' || store.city === selectedCity;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        store.name.toLowerCase().includes(q) ||
        store.address.toLowerCase().includes(q) ||
        store.district.toLowerCase().includes(q) ||
        store.amenities.some((a) => a.toLowerCase().includes(q));
      return matchesCity && matchesSearch;
    });
  }, [selectedCity, searchQuery]);

  return (
    <section id="stores" className="py-16 sm:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-stone-200">
          <div>
            <div className="text-xs font-semibold text-emerald-800 tracking-wider uppercase mb-2">
              National Retail Network
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-stone-900 font-display">
              34 Supermarket Outlets Across Indonesia
            </h2>
            <p className="mt-2 text-stone-600 text-sm sm:text-base max-w-2xl">
              Locate your nearest GroceMart branch to enjoy same-day in-store shopping, drive-through Click & Collect, or ultra-fast 1-hour doorstep delivery.
            </p>
          </div>

          {/* Quick Search */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search branch or area..."
              className="w-full pl-9 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* City Filter Tabs */}
        <div className="mt-8 flex items-center gap-2 overflow-x-auto pb-2">
          {cities.map((city) => {
            const isSelected = selectedCity === city;
            const count = city === 'All'
              ? STORE_LOCATIONS.length
              : STORE_LOCATIONS.filter((s) => s.city === city).length;

            return (
              <button
                key={city}
                onClick={() => setSelectedCity(city)}
                className={`px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900'
                }`}
              >
                <span>{city}</span>
                <span className="ml-1.5 opacity-80 text-xs">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Stores Grid */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStores.map((store) => {
            const isPickupSelected = selectedPickupStore?.id === store.id;

            return (
              <div
                key={store.id}
                className={`p-6 rounded-2xl border transition-all duration-200 hover:-translate-y-1 hover:shadow-md flex flex-col justify-between ${
                  isPickupSelected
                    ? 'border-emerald-800 bg-emerald-50/20 ring-1 ring-emerald-800 shadow-xs'
                    : 'border-stone-200 bg-stone-50/50 hover:bg-white hover:border-stone-300'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-stone-500 font-medium mb-1">
                        <span>{store.city}</span>
                        <span aria-hidden="true">·</span>
                        <span>Est. {store.establishedYear}</span>
                      </div>
                      <h3 className="text-lg font-bold text-stone-900 font-display">
                        {store.name}
                      </h3>
                    </div>
                    {store.isFlagship && (
                      <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wide px-2 py-0.5 bg-emerald-100/60 rounded shrink-0">
                        Flagship
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-stone-600 leading-relaxed mt-2 flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
                    <span>{store.address}, {store.district}</span>
                  </p>

                  <div className="mt-3 flex items-center gap-2 text-xs text-stone-500 font-mono">
                    <Clock className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    <span>{store.hours}</span>
                  </div>

                  <div className="mt-1 flex items-center gap-2 text-xs text-stone-500 font-mono">
                    <Phone className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    <span>{store.phone}</span>
                  </div>

                  {/* Amenities */}
                  <div className="mt-4 pt-4 border-t border-stone-200/60">
                    <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-2">
                      Store Facilities & Highlights
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {store.amenities.slice(0, 3).map((amenity) => (
                        <span
                          key={amenity}
                          className="text-[11px] text-stone-700 bg-white border border-stone-200 px-2 py-0.5 rounded"
                        >
                          {amenity}
                        </span>
                      ))}
                      {store.amenities.length > 3 && (
                        <span className="text-[11px] text-stone-500 px-1 py-0.5">
                          +{store.amenities.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions row */}
                <div className="mt-6 pt-4 border-t border-stone-200 flex items-center gap-2">
                  <button
                    onClick={() => setActiveModalStore(store)}
                    className="flex-1 py-2 px-3 text-xs font-semibold text-stone-800 bg-white hover:bg-stone-100 active:scale-98 border border-stone-300 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[40px]"
                  >
                    <Navigation className="w-3.5 h-3.5 text-emerald-800" />
                    <span>Map & Details</span>
                  </button>

                  <button
                    onClick={() => {
                      onSelectPickupStore(store);
                      onShopStoreGroceries(store);
                    }}
                    className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[40px] ${
                      isPickupSelected
                        ? 'bg-emerald-800 text-white'
                        : 'bg-stone-900 hover:bg-stone-800 text-white'
                    }`}
                  >
                    {isPickupSelected ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-300" />
                        <span>Selected Store</span>
                      </>
                    ) : (
                      <span>Select & Shop</span>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filteredStores.length === 0 && (
          <div className="text-center py-16 bg-stone-50 rounded-2xl border border-stone-200 mt-6">
            <MapPin className="w-8 h-8 text-stone-400 mx-auto mb-2" />
            <p className="text-stone-900 font-semibold text-sm">No Store Locations Found</p>
            <p className="text-stone-500 text-xs mt-1">
              Try adjusting your city filter or search query.
            </p>
            <button
              onClick={() => {
                setSelectedCity('All');
                setSearchQuery('');
              }}
              className="mt-4 px-4 py-2 bg-stone-900 text-white rounded-lg text-xs font-semibold"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Store Location Modal */}
      {activeModalStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-stone-200 relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setActiveModalStore(null)}
              className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-stone-500 mb-1">
                <span>{activeModalStore.city}</span>
                <span aria-hidden="true">·</span>
                <span>Branch #{activeModalStore.id.toUpperCase()}</span>
              </div>
              <h3 className="text-2xl font-bold text-stone-900 font-display">
                {activeModalStore.name}
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Supermarket General Manager: {activeModalStore.manager}
              </p>
            </div>

            {/* Interactive simulated Map Preview */}
            <div className="mt-5 rounded-xl overflow-hidden border border-stone-200 bg-stone-100 relative h-48 flex items-center justify-center">
              <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px] opacity-70" />
              <div className="relative text-center p-4 bg-white/90 backdrop-blur-md rounded-xl border border-stone-200/80 shadow-xs max-w-xs">
                <MapPin className="w-6 h-6 text-emerald-800 mx-auto mb-1 animate-bounce" />
                <p className="text-xs font-semibold text-stone-900">{activeModalStore.name}</p>
                <p className="text-[11px] text-stone-500">{activeModalStore.address}</p>
                <div className="mt-2 text-[10px] font-mono text-stone-400">
                  GPS: {activeModalStore.coordinates.lat}, {activeModalStore.coordinates.lng}
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-2.5 text-xs text-stone-700">
              <div className="flex items-center justify-between py-1.5 border-b border-stone-100">
                <span className="text-stone-500">Operating Hours</span>
                <span className="font-semibold text-stone-900">{activeModalStore.hours}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-stone-100">
                <span className="text-stone-500">Customer Service Phone</span>
                <a href={`tel:${activeModalStore.phone}`} className="font-semibold text-emerald-800 hover:underline">
                  {activeModalStore.phone}
                </a>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-stone-100">
                <span className="text-stone-500">Click & Collect Service</span>
                <span className="font-semibold text-emerald-800">Ready in 30 Minutes</span>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-2">
                All Available Store Facilities
              </p>
              <div className="flex flex-wrap gap-1.5">
                {activeModalStore.amenities.map((a) => (
                  <span
                    key={a}
                    className="text-xs text-stone-800 bg-stone-100 px-2.5 py-1 rounded-md"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={() => {
                  onSelectPickupStore(activeModalStore);
                  onShopStoreGroceries(activeModalStore);
                  setActiveModalStore(null);
                }}
                className="flex-1 py-2.5 px-4 bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs rounded-lg transition-colors text-center cursor-pointer"
              >
                Shop From This Store
              </button>
              <button
                onClick={() => setActiveModalStore(null)}
                className="py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
