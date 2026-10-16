import React from 'react';
import type {
  StoreOperationalStatus,
  StoreOutletSchedule,
} from '../../types/index.ts';
import {
  Store,
  AlertTriangle,
  Edit3,
  X,
} from 'lucide-react';

interface StoreOperationsTabProps {
  storeStatus: StoreOperationalStatus | null;
  storeOutlets: StoreOutletSchedule[];
  bannerInput: string;
  setBannerInput: (val: string) => void;
  reopenInput: string;
  setReopenInput: (val: string) => void;
  isUpdatingStatus: boolean;
  handleToggleStoreOpen: () => void;
  handleSaveBanner: () => void;
  handleToggleOutletEmergency: (outlet: StoreOutletSchedule, forceClosure?: boolean) => void;
  editingOutlet: StoreOutletSchedule | null;
  setEditingOutlet: (outlet: StoreOutletSchedule | null) => void;
  handleSaveOutletHours: () => void;
}

export const StoreOperationsTab: React.FC<StoreOperationsTabProps> = ({
  storeStatus,
  storeOutlets,
  bannerInput,
  setBannerInput,
  reopenInput,
  setReopenInput,
  isUpdatingStatus,
  handleToggleStoreOpen,
  handleSaveBanner,
  handleToggleOutletEmergency,
  editingOutlet,
  setEditingOutlet,
  handleSaveOutletHours,
}) => {
  const cardClass =
    'bg-white dark:bg-stone-900/90 border border-gray-200/90 dark:border-stone-800 shadow-[0_4px_12px_rgba(0,0,0,0.03)] text-gray-900 dark:text-stone-100 rounded-2xl';
  const subCardClass =
    'bg-white dark:bg-stone-800/80 border border-gray-200 dark:border-stone-700 text-gray-900 dark:text-stone-100 rounded-xl shadow-xs';
  const textTitle = 'text-gray-900 dark:text-white';
  const textMuted = 'text-gray-500 dark:text-stone-400';
  const inputClass =
    'bg-white dark:bg-stone-800 border border-gray-300 dark:border-stone-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-[#0F4C3A] dark:focus:border-emerald-500 focus:ring-1 focus:ring-[#0F4C3A]';
  const modalClass =
    'bg-white dark:bg-stone-900 border border-gray-200 dark:border-stone-700 text-gray-900 dark:text-white shadow-2xl rounded-2xl';

  return (
    <div className="space-y-6">
      {/* Network Master Switch & Announcement Banner */}
      <div className={`${cardClass} p-6`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-stone-200 dark:border-stone-800">
          <div>
            <h2 className={`text-base font-bold ${textTitle} flex items-center gap-2`}>
              <Store className="w-5 h-5 text-[#0F4C3A] dark:text-emerald-400" />
              Company-Wide Storefront Network Status
            </h2>
            <p className={`text-xs ${textMuted} mt-0.5`}>
              Control all 34 outlets simultaneously or override specific store hubs.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-stone-700 dark:text-stone-300">
                {storeStatus?.isOpen ? 'Network Online' : 'Network Closed'}
              </span>
              <button
                onClick={handleToggleStoreOpen}
                disabled={isUpdatingStatus}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                  storeStatus?.isOpen ? 'bg-[#0F4C3A] dark:bg-emerald-600' : 'bg-red-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    storeStatus?.isOpen ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Custom Banner Editor */}
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold mb-1 text-stone-700 dark:text-stone-300">
                Customer Notice Banner (Displayed on Storefront Header)
              </label>
              <input
                type="text"
                value={bannerInput}
                onChange={(e) => setBannerInput(e.target.value)}
                placeholder="e.g. Fresh harvest arrives daily from Lembang! Open 07:00 - 22:00 WIB."
                className={`w-full px-3.5 py-2 text-xs rounded-xl ${inputClass}`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-stone-700 dark:text-stone-300">
                Estimated Operating Window
              </label>
              <input
                type="text"
                value={reopenInput}
                onChange={(e) => setReopenInput(e.target.value)}
                placeholder="Open 07:00 - 22:00 Daily"
                className={`w-full px-3.5 py-2 text-xs rounded-xl ${inputClass}`}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSaveBanner}
              disabled={isUpdatingStatus}
              className="px-4 py-2 bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-semibold rounded-xl transition-all shadow-sm disabled:opacity-50 cursor-pointer"
            >
              Save &amp; Broadcast Banner
            </button>
          </div>
        </div>
      </div>

      {/* Granular Outlets Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className={`text-base font-bold ${textTitle}`}>Store Outlets Schedule &amp; Closure Control</h2>
            <p className={`text-xs ${textMuted}`}>Configure operating hours, local timezone, and emergency closure per location</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {storeOutlets.map((outlet) => {
            const isClosed = outlet.isEmergencyClosed || !storeStatus?.isOpen;
            return (
              <div
                key={outlet.storeId}
                className={`border rounded-2xl p-5 transition-all space-y-4 ${
                  isClosed
                    ? 'border-rose-200 dark:border-red-900/50 bg-rose-50/40 dark:bg-red-950/10 text-stone-900 dark:text-white'
                    : cardClass
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${textTitle} text-sm`}>{outlet.storeName}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700">
                        {outlet.timezone}
                      </span>
                    </div>
                    <p className={`text-xs ${textMuted} mt-0.5`}>{outlet.district}, {outlet.city}</p>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      isClosed
                        ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
                        : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                    }`}
                  >
                    {isClosed ? 'CLOSED' : 'OPEN'}
                  </span>
                </div>

                <div className={`p-3 ${subCardClass} space-y-1.5 text-xs`}>
                  <div className="flex justify-between">
                    <span className={textMuted}>Operating Hours:</span>
                    <span className={`font-semibold ${textTitle}`}>{outlet.openTime} - {outlet.closeTime} {outlet.timezone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={textMuted}>Days Active:</span>
                    <span className="text-stone-700 dark:text-stone-300">{outlet.daysOpen}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={textMuted}>Contact:</span>
                    <span className="font-mono text-stone-700 dark:text-stone-400">{outlet.contactPhone}</span>
                  </div>
                </div>

                {outlet.isEmergencyClosed && outlet.closureReason && (
                  <div className="p-2.5 bg-rose-50 dark:bg-red-950/40 border border-rose-200 dark:border-red-800/40 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                    <span>Emergency Note: {outlet.closureReason}</span>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-stone-200 dark:border-stone-800">
                  <button
                    onClick={() => handleToggleOutletEmergency(outlet)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                      outlet.isEmergencyClosed
                        ? 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 hover:bg-emerald-600/20'
                        : 'bg-rose-600/10 text-rose-700 dark:text-rose-300 border-rose-500/40 hover:bg-rose-600/20'
                    }`}
                  >
                    {outlet.isEmergencyClosed ? 'Restore Open' : 'Emergency Close'}
                  </button>

                  <button
                    onClick={() => setEditingOutlet(outlet)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 border bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit Schedule
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Outlet Modal */}
      {editingOutlet && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`${modalClass} max-w-lg w-full p-6 space-y-4`}>
            <div className="flex items-center justify-between border-b pb-3 border-stone-200 dark:border-stone-800">
              <h3 className={`text-base font-bold ${textTitle}`}>Edit Schedule: {editingOutlet.storeName}</h3>
              <button
                onClick={() => setEditingOutlet(null)}
                className="p-1.5 rounded-lg transition-colors hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 dark:text-stone-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1 text-stone-700 dark:text-stone-300">Open Time</label>
                <input
                  type="time"
                  value={editingOutlet.openTime}
                  onChange={(e) => setEditingOutlet({ ...editingOutlet, openTime: e.target.value })}
                  className={`w-full px-3 py-2 text-xs rounded-xl ${inputClass}`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-stone-700 dark:text-stone-300">Close Time</label>
                <input
                  type="time"
                  value={editingOutlet.closeTime}
                  onChange={(e) => setEditingOutlet({ ...editingOutlet, closeTime: e.target.value })}
                  className={`w-full px-3 py-2 text-xs rounded-xl ${inputClass}`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-stone-700 dark:text-stone-300">Days Open</label>
              <input
                type="text"
                value={editingOutlet.daysOpen}
                onChange={(e) => setEditingOutlet({ ...editingOutlet, daysOpen: e.target.value })}
                className={`w-full px-3 py-2 text-xs rounded-xl ${inputClass}`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-stone-700 dark:text-stone-300">Emergency Closure Reason (Optional)</label>
              <input
                type="text"
                value={editingOutlet.closureReason || ''}
                onChange={(e) => setEditingOutlet({ ...editingOutlet, closureReason: e.target.value })}
                placeholder="e.g. Sub-zero walk-in chiller routine servicing"
                className={`w-full px-3 py-2 text-xs rounded-xl ${inputClass}`}
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-stone-200 dark:border-stone-800">
              <button
                onClick={() => setEditingOutlet(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border transition-colors bg-white dark:bg-stone-800 border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveOutletHours}
                className="px-4 py-2 text-xs font-semibold bg-[#0F4C3A] hover:bg-[#0b382b] text-white rounded-xl shadow-sm transition-all cursor-pointer"
              >
                Save Operating Hours
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
