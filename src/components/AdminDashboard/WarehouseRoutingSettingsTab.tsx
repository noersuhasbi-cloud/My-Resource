import React, { useState } from 'react';
import type {
  EnterpriseSettingsConfig,
  WarehouseBinLocation,
  WarehouseMultiStepRoute,
  StoreInventoryStock,
} from '../../types/index.ts';
import { apiClient } from '../../services/apiClient';
import {
  Boxes,
  Layers,
  MapPin,
  Plus,
  Save,
  CheckCircle2,
  RefreshCw,
  Search,
  Sliders,
  Check,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Thermometer,
  PackageCheck,
  Warehouse,
} from 'lucide-react';

interface WarehouseRoutingSettingsTabProps {
  theme: 'light' | 'dark';
  settings: EnterpriseSettingsConfig;
  bins: WarehouseBinLocation[];
  routes: WarehouseMultiStepRoute[];
  inventoryTiers: StoreInventoryStock[];
  onUpdateSettings: (updated: Partial<EnterpriseSettingsConfig>) => Promise<void>;
  onRefreshBins: () => void;
  onShowToast: (title: string, message: string) => void;
}

export const WarehouseRoutingSettingsTab: React.FC<WarehouseRoutingSettingsTabProps> = ({
  theme,
  settings,
  bins,
  routes,
  inventoryTiers,
  onUpdateSettings,
  onRefreshBins,
  onShowToast,
}) => {
  const isLight = theme === 'light';

  // Config state
  const [config, setConfig] = useState(settings.warehouseRouting);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Filter state
  const [zoneFilter, setZoneFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Add Bin Modal
  const [isAddBinModalOpen, setIsAddBinModalOpen] = useState(false);
  const [isSubmittingBin, setIsSubmittingBin] = useState(false);
  const [newBinCode, setNewBinCode] = useState('');
  const [newRack, setNewRack] = useState('Chilled Rack A');
  const [newShelf, setNewShelf] = useState('Tier 1');
  const [newZoneId, setNewZoneId] = useState('WH-JKT-SEN-COLD');
  const [newBinType, setNewBinType] = useState<'COLD_CHUTE' | 'AMBIENT_SHELF' | 'SECURE_CAGE' | 'RECEIVING_DOCK'>('COLD_CHUTE');
  const [newCapacity, setNewCapacity] = useState<number>(60);
  const [newSku, setNewSku] = useState<string>('');

  const cardClass = `rounded-2xl border transition-all ${
    isLight
      ? 'bg-white border-gray-200/90 shadow-[0_4px_16px_rgba(0,0,0,0.03)]'
      : 'bg-stone-900/90 border-stone-800 shadow-[0_4px_16px_rgba(0,0,0,0.2)]'
  }`;

  const inputClass = `px-3.5 py-2 text-xs rounded-xl font-medium transition-all ${
    isLight
      ? 'bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-[#0F4C3A] focus:ring-1 focus:ring-[#0F4C3A]'
      : 'bg-stone-800 border border-stone-700 text-white placeholder:text-stone-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
  }`;

  const labelClass = `block text-xs font-semibold mb-1.5 ${isLight ? 'text-gray-700' : 'text-stone-300'}`;

  const handleSaveSettings = async () => {
    setIsSavingConfig(true);
    try {
      await onUpdateSettings({ warehouseRouting: config });
      onShowToast('Settings Saved', 'Warehouse routing & storage locations rules updated.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Error', msg);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleCreateBin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBinCode.trim()) {
      onShowToast('Validation Error', 'Bin Code is required.');
      return;
    }
    setIsSubmittingBin(true);
    try {
      const res = await apiClient.createWarehouseBin({
        binCode: newBinCode.trim().toUpperCase(),
        rack: newRack,
        shelf: newShelf,
        zoneId: newZoneId,
        type: newBinType,
        capacityUnits: Number(newCapacity) || 60,
        currentSku: newSku || undefined,
        storeId: 'store-jkt-senopati',
        storeName: 'GroceMart Senopati Flagship',
      });
      if (res.success) {
        onShowToast('Location Registered', res.message);
        setIsAddBinModalOpen(false);
        setNewBinCode('');
        setNewSku('');
        onRefreshBins();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Error', msg);
    } finally {
      setIsSubmittingBin(false);
    }
  };

  const filteredBins = bins.filter((b) => {
    if (zoneFilter !== 'ALL' && b.zoneId !== zoneFilter) return false;
    if (statusFilter !== 'ALL' && b.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        b.binCode.toLowerCase().includes(q) ||
        b.rack.toLowerCase().includes(q) ||
        (b.currentSku && b.currentSku.toLowerCase().includes(q)) ||
        (b.productName && b.productName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Overview Banner */}
      <div className={`${cardClass} p-5 sm:p-6`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-xl bg-[#0F4C3A] text-white shadow-xs shrink-0">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-[#0F4C3A] border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30 uppercase tracking-wider">
                  Logistics &amp; Routing
                </span>
                <span className={`text-xs ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
                  Multi-Step Fulfillment
                </span>
              </div>
              <h2 className={`text-base sm:text-lg font-bold mt-1 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                Warehouse Advanced Routing &amp; Storage Locations
              </h2>
              <p className={`text-xs mt-0.5 max-w-2xl ${isLight ? 'text-gray-600' : 'text-stone-400'}`}>
                Configure multi-step warehouse logistics routes (Pick &rarr; Catch-Weight Pack &rarr; Ship) and manage granular bin/rack product storage allocations without disrupting existing store inventories.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAddBinModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Storage Bin</span>
            </button>
            <button
              onClick={handleSaveSettings}
              disabled={isSavingConfig}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {isSavingConfig ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Rules</span>
            </button>
          </div>
        </div>
      </div>

      {/* Multi-Step Route Configurations */}
      <div className={`${cardClass} p-5 sm:p-6 space-y-4`}>
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-stone-800">
          <div>
            <h3 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>
              <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Multi-Step Warehouse Routes Definition
            </h3>
            <p className={`text-xs mt-0.5 ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
              Controls whether stock moves directly from dock to shelf, or follows mandatory Quality Hold &amp; Catch-Weight packaging stages.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.multiStepRoutingEnabled}
              onChange={(e) => setConfig({ ...config, multiStepRoutingEnabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-gray-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0F4C3A]"></div>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {routes.map((rt) => (
            <div
              key={rt.id}
              className={`p-4 rounded-xl border space-y-3 ${
                isLight ? 'bg-gray-50/70 border-gray-200' : 'bg-stone-800/40 border-stone-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-[#0F4C3A]/15 text-[#0F4C3A] dark:text-emerald-400 border border-[#0F4C3A]/25">
                    {rt.routeType}
                  </span>
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white">{rt.name}</h4>
                </div>
                <span className="text-[10px] font-bold text-gray-500 font-mono">{rt.steps.length} Steps</span>
              </div>

              <p className={`text-[11px] ${isLight ? 'text-gray-600' : 'text-stone-400'}`}>{rt.description}</p>

              <div className="space-y-1.5 pt-1">
                {rt.steps.map((st) => (
                  <div
                    key={st.stepNumber}
                    className="flex items-center gap-2 text-[11px] p-2 rounded-lg bg-white dark:bg-stone-900 border border-gray-200 dark:border-stone-800"
                  >
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                      {st.stepNumber}
                    </span>
                    <div className="flex-1 truncate">
                      <strong className="text-gray-900 dark:text-white">{st.stepName}:</strong>{' '}
                      <span className="text-gray-500 dark:text-stone-400 font-mono">
                        {st.locationSource} &rarr; {st.locationDestination}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Storage Bins & Racks Management */}
      <div className={`${cardClass} p-5 sm:p-6 space-y-4`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-gray-100 dark:border-stone-800">
          <div>
            <h3 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>
              <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Granular Storage Bins &amp; Shelf Allocations ({filteredBins.length} Bins)
            </h3>
            <p className={`text-xs mt-0.5 ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
              Bin locations mapped to cold chutes, ambient shelves, and QA quarantine docks.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search Bin or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`pl-8 py-1.5 text-xs rounded-xl ${inputClass}`}
              />
            </div>

            <select
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              className={`py-1.5 text-xs rounded-xl ${inputClass}`}
            >
              <option value="ALL">All Warehouse Zones</option>
              <option value="WH-JKT-SEN-COLD">Chilled Cold Room</option>
              <option value="WH-JKT-SEN-DRY">Ambient Dry Shelf</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`py-1.5 text-xs rounded-xl ${inputClass}`}
            >
              <option value="ALL">All Statuses</option>
              <option value="AVAILABLE">Available</option>
              <option value="OCCUPIED">Occupied</option>
              <option value="MAINTENANCE">Maintenance</option>
            </select>
          </div>
        </div>

        {filteredBins.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-500">
            No bin locations match your filter. Click &quot;Add Storage Bin&quot; to configure a new rack location.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className={`border-b ${isLight ? 'border-gray-200 text-gray-500' : 'border-stone-700 text-stone-400'} uppercase text-[10px] font-bold`}>
                <tr>
                  <th className="py-2.5 px-3">Bin Code</th>
                  <th className="py-2.5 px-3">Zone &amp; Storage Type</th>
                  <th className="py-2.5 px-3">Rack &amp; Shelf Location</th>
                  <th className="py-2.5 px-3">Assigned Product &amp; SKU</th>
                  <th className="py-2.5 px-3">Capacity &amp; Occupancy</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-stone-800 font-medium">
                {filteredBins.map((bin) => {
                  const pct = bin.capacityUnits > 0 ? Math.round((bin.occupancyUnits / bin.capacityUnits) * 100) : 0;
                  return (
                    <tr key={bin.id} className="hover:bg-gray-50/50 dark:hover:bg-stone-800/40 transition-colors">
                      <td className="py-3 px-3">
                        <span className="font-mono font-bold text-xs text-[#0F4C3A] dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                          {bin.binCode}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-gray-900 dark:text-stone-100">{bin.zoneId}</div>
                        <div className="text-[10px] text-gray-500">{bin.type.replace(/_/g, ' ')}</div>
                      </td>
                      <td className="py-3 px-3 font-semibold">
                        <div>{bin.rack}</div>
                        <div className="text-[10px] text-gray-500">{bin.shelf}</div>
                      </td>
                      <td className="py-3 px-3">
                        {bin.currentSku ? (
                          <div>
                            <span className="font-mono font-bold text-[#0F4C3A] dark:text-emerald-400">{bin.currentSku}</span>
                            <div className="text-[11px] text-gray-600 dark:text-stone-400 truncate max-w-xs">{bin.productName}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Unassigned (Empty Bin)</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="w-36 space-y-1">
                          <div className="flex justify-between text-[10px] font-mono">
                            <span>{bin.occupancyUnits} / {bin.capacityUnits} u</span>
                            <span className="font-bold">{pct}%</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-stone-700 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                pct > 85 ? 'bg-amber-500' : 'bg-emerald-600'
                              }`}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          bin.status === 'OCCUPIED'
                            ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20'
                            : bin.status === 'AVAILABLE'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                            : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20'
                        }`}>
                          {bin.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Bin Modal */}
      {isAddBinModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`w-full max-w-md p-6 rounded-2xl border shadow-2xl space-y-4 ${
            isLight ? 'bg-white border-gray-300' : 'bg-stone-900 border-stone-800 text-white'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-stone-800">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                Add Warehouse Storage Location
              </h3>
              <button
                onClick={() => setIsAddBinModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBin} className="space-y-3.5">
              <div>
                <label className={labelClass}>Bin Code * (e.g. COLD-C-01)</label>
                <input
                  type="text"
                  required
                  value={newBinCode}
                  onChange={(e) => setNewBinCode(e.target.value)}
                  className={`w-full font-mono uppercase ${inputClass}`}
                  placeholder="COLD-C-01"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Warehouse Zone</label>
                  <select
                    value={newZoneId}
                    onChange={(e) => setNewZoneId(e.target.value)}
                    className={`w-full ${inputClass}`}
                  >
                    <option value="WH-JKT-SEN-COLD">Chilled Cold Room</option>
                    <option value="WH-JKT-SEN-DRY">Ambient Dry Room</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Storage Type</label>
                  <select
                    value={newBinType}
                    onChange={(e) => setNewBinType(e.target.value as any)}
                    className={`w-full ${inputClass}`}
                  >
                    <option value="COLD_CHUTE">Cold Chute</option>
                    <option value="AMBIENT_SHELF">Ambient Shelf</option>
                    <option value="RECEIVING_DOCK">QA Staging Dock</option>
                    <option value="SECURE_CAGE">Secure Cage</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Rack Name</label>
                  <input
                    type="text"
                    value={newRack}
                    onChange={(e) => setNewRack(e.target.value)}
                    className={`w-full ${inputClass}`}
                    placeholder="Rack A"
                  />
                </div>
                <div>
                  <label className={labelClass}>Shelf Tier</label>
                  <input
                    type="text"
                    value={newShelf}
                    onChange={(e) => setNewShelf(e.target.value)}
                    className={`w-full ${inputClass}`}
                    placeholder="Tier 1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Capacity (Units)</label>
                  <input
                    type="number"
                    min="1"
                    value={newCapacity}
                    onChange={(e) => setNewCapacity(Number(e.target.value))}
                    className={`w-full font-mono ${inputClass}`}
                  />
                </div>
                <div>
                  <label className={labelClass}>Initial SKU (Optional)</label>
                  <select
                    value={newSku}
                    onChange={(e) => setNewSku(e.target.value)}
                    className={`w-full font-mono ${inputClass}`}
                  >
                    <option value="">-- None (Empty) --</option>
                    {inventoryTiers.slice(0, 10).map((t) => (
                      <option key={t.sku} value={t.sku}>
                        {t.sku} ({t.productName.slice(0, 20)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsAddBinModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 dark:text-stone-300 dark:hover:bg-stone-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBin}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#0F4C3A] hover:bg-[#0b382b] text-white shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmittingBin ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Register Bin</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
