import React, { useState, useEffect } from 'react';
import type {
  SuratJalanDocument,
  DeliveryOrderDocument,
  ShipmentQuotaTracking,
} from '../../types/index.ts';
import { formatIDR } from '../../utils/formatters';
import { apiClient } from '../../services/apiClient';
import {
  Truck,
  FileText,
  Printer,
  X,
  CheckCircle2,
  Clock,
  Thermometer,
  ShieldCheck,
  Search,
  Plus,
  ArrowRight,
  PackageCheck,
  QrCode,
  MapPin,
  Calendar,
  Phone,
  User,
} from 'lucide-react';

interface LogisticsDocsModalProps {
  theme: 'light' | 'dark';
  isOpen?: boolean;
  isStandalonePage?: boolean;
  onClose?: () => void;
  suratJalanList?: SuratJalanDocument[];
  deliveryOrders?: DeliveryOrderDocument[];
  shipments?: ShipmentQuotaTracking[];
  onIssueSuratJalan?: (doc: Partial<SuratJalanDocument>) => Promise<void>;
  onShowToast: (title: string, message: string) => void;
}

export const LogisticsDocsModal: React.FC<LogisticsDocsModalProps> = ({
  theme,
  isOpen = true,
  isStandalonePage = false,
  onClose,
  suratJalanList: propSjList,
  deliveryOrders: propDoList,
  shipments: propShipments,
  onIssueSuratJalan,
  onShowToast,
}) => {
  const isLight = theme === 'light';

  // State for documents if not passed as props
  const [internalSjList, setInternalSjList] = useState<SuratJalanDocument[]>(propSjList || []);
  const [internalDoList, setInternalDoList] = useState<DeliveryOrderDocument[]>(propDoList || []);
  const [internalShipments, setInternalShipments] = useState<ShipmentQuotaTracking[]>(propShipments || []);

  const suratJalanList = propSjList || internalSjList;
  const deliveryOrders = propDoList || internalDoList;
  const shipments = propShipments || internalShipments;

  const fetchDocs = async () => {
    try {
      const [sjRes, doRes, quotaRes] = await Promise.all([
        apiClient.getSuratJalanList().catch(() => []),
        apiClient.getDeliveryOrders().catch(() => []),
        apiClient.getShipmentQuotaTracking().catch(() => []),
      ]);
      setInternalSjList(sjRes);
      setInternalDoList(doRes);
      setInternalShipments(quotaRes);
      if (!selectedSj && sjRes.length > 0) setSelectedSj(sjRes[0]);
      if (!selectedDo && doRes.length > 0) setSelectedDo(doRes[0]);
    } catch (err: unknown) {
      console.error('Failed to fetch logistics documents:', err);
    }
  };

  useEffect(() => {
    if (!propSjList || propSjList.length === 0) {
      fetchDocs();
    }
  }, [propSjList]);

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<'surat_jalan' | 'delivery_orders' | 'shipment_quota'>('surat_jalan');

  // Selected document for detailed printable view
  const [selectedSj, setSelectedSj] = useState<SuratJalanDocument | null>(suratJalanList[0] || null);
  const [selectedDo, setSelectedDo] = useState<DeliveryOrderDocument | null>(deliveryOrders[0] || null);

  useEffect(() => {
    if (!selectedSj && suratJalanList.length > 0) setSelectedSj(suratJalanList[0]);
    if (!selectedDo && deliveryOrders.length > 0) setSelectedDo(deliveryOrders[0]);
  }, [suratJalanList, deliveryOrders]);

  // Search & filter
  const [searchTerm, setSearchTerm] = useState<string>('');

  // New Surat Jalan Form State
  const [isCreatingSj, setIsCreatingSj] = useState<boolean>(false);
  const [newSjRecipient, setNewSjRecipient] = useState<string>('GroceMart PIK 2 Hub');
  const [newSjAddress, setNewSjAddress] = useState<string>('The Avenue Blok A1 No. 8, Pantai Indah Kapuk 2');
  const [newSjDriver, setNewSjDriver] = useState<string>('Bambang Sudirgo');
  const [newSjVehiclePlate, setNewSjVehiclePlate] = useState<string>('B 9482 SXZ');
  const [newSjTemp, setNewSjTemp] = useState<number>(3.5);
  const [newSjNotes, setNewSjNotes] = useState<string>('Continuous cold-chain 2-4°C required');

  if (!isOpen && !isStandalonePage) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: Partial<SuratJalanDocument> = {
        recipientName: newSjRecipient,
        recipientAddress: newSjAddress,
        driverName: newSjDriver,
        vehiclePlateNumber: newSjVehiclePlate,
        coldChainTempCelsius: newSjTemp,
        specialHandlingInstructions: newSjNotes,
        items: [
          {
            sku: 'SKU-PRD-001',
            productName: 'Organic Hydroponic Butterhead Lettuce',
            batchNumber: `BAT-${Date.now().toString().slice(-6)}`,
            quantity: 20,
            unit: 'head (250g)',
            packagingType: 'Plastic Crate',
            condition: 'Cold-Chilled OK',
            notes: 'Farm pre-cooled produce',
          },
        ],
      };

      if (onIssueSuratJalan) {
        await onIssueSuratJalan(payload);
      } else {
        const res = await apiClient.createSuratJalan(payload);
        if (res.success) {
          setInternalSjList((prev) => [res.document, ...prev]);
          setSelectedSj(res.document);
        }
      }
      setIsCreatingSj(false);
      onShowToast('Surat Jalan Issued', 'Official shipping waybill generated and ready for print sign-off.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Error', msg);
    }
  };

  const filteredSjList = suratJalanList.filter((sj) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      sj.documentNumber.toLowerCase().includes(q) ||
      sj.recipientName.toLowerCase().includes(q) ||
      sj.driverName.toLowerCase().includes(q)
    );
  });

  const content = (
    <div
      className={`w-full flex flex-col rounded-2xl border transition-all overflow-hidden ${
        isStandalonePage ? 'shadow-xs min-h-[750px]' : 'max-w-6xl max-h-[94vh] shadow-2xl'
      } ${
        isLight ? 'bg-white border-gray-200 text-gray-900' : 'bg-zinc-900 border-zinc-800 text-zinc-100'
      }`}
    >
      {/* Modal Header */}
      <div
        className={`flex items-center justify-between px-6 py-4 border-b flex-shrink-0 ${
          isLight ? 'bg-gray-50/80 border-gray-200' : 'bg-zinc-900/80 border-zinc-800'
        }`}
      >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0F4C3A] text-white flex items-center justify-center shadow-xs">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold">Logistics &amp; Shipping Operational Documents</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20 font-mono">
                  Official ERP Forms
                </span>
              </div>
              <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-zinc-300'}`}>
                Surat Jalan (Waybill / Delivery Note), Delivery Order (DO), and Fleet Quota Dispatch Tracking
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                isLight
                  ? 'bg-white hover:bg-gray-100 border-gray-300 text-gray-700 shadow-2xs'
                  : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200'
              }`}
              title="Print document in official A4 layout"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print Document</span>
            </button>

            <button
              onClick={onClose}
              className={`p-2 rounded-xl transition-colors ${
                isLight ? 'hover:bg-gray-100 text-gray-500' : 'hover:bg-zinc-800 text-zinc-400'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          className={`flex items-center justify-between px-6 py-2 border-b flex-shrink-0 ${
            isLight ? 'bg-white border-gray-100' : 'bg-zinc-900 border-zinc-800'
          }`}
        >
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab('surat_jalan')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'surat_jalan'
                  ? 'bg-[#0F4C3A] text-white shadow-xs'
                  : isLight
                  ? 'text-gray-600 hover:bg-gray-100'
                  : 'text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Surat Jalan (Delivery Note)</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/10 dark:bg-white/10 font-mono">
                {suratJalanList.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('delivery_orders')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'delivery_orders'
                  ? 'bg-[#0F4C3A] text-white shadow-xs'
                  : isLight
                  ? 'text-gray-600 hover:bg-gray-100'
                  : 'text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              <PackageCheck className="w-3.5 h-3.5" />
              <span>Delivery Orders (DO)</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/10 dark:bg-white/10 font-mono">
                {deliveryOrders.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('shipment_quota')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'shipment_quota'
                  ? 'bg-[#0F4C3A] text-white shadow-xs'
                  : isLight
                  ? 'text-gray-600 hover:bg-gray-100'
                  : 'text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Fleet Quota Tracking</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/10 dark:bg-white/10 font-mono">
                {shipments.length}
              </span>
            </button>
          </div>

          {activeTab === 'surat_jalan' && (
            <button
              onClick={() => setIsCreatingSj(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#0F4C3A] hover:bg-[#0b382b] text-white rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Issue Surat Jalan</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* ========================================================================= */}
          {/* TAB 1: SURAT JALAN (OFFICIAL WAYBILL / DELIVERY NOTE) */}
          {/* ========================================================================= */}
          {activeTab === 'surat_jalan' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Document List Sidebar */}
              <div className="lg:col-span-4 space-y-3">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by SJ # or recipient..."
                    className={`w-full pl-8 pr-3 py-2 text-xs rounded-xl border focus:outline-none focus:border-[#0F4C3A] ${
                      isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-zinc-800 border-zinc-700 text-white'
                    }`}
                  />
                </div>

                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                  {filteredSjList.map((sj) => {
                    const isSelected = selectedSj?.id === sj.id;
                    return (
                      <div
                        key={sj.id}
                        onClick={() => setSelectedSj(sj)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500/10 border-emerald-500 text-[#0F4C3A] dark:text-emerald-300 shadow-xs'
                            : isLight
                            ? 'bg-white border-gray-200/90 hover:bg-gray-50'
                            : 'bg-zinc-800/70 border-zinc-700/80 hover:bg-zinc-800'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-xs font-bold">{sj.documentNumber}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                              sj.status === 'delivered'
                                ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
                                : sj.status === 'in_transit'
                                ? 'bg-blue-500/15 text-blue-800 dark:text-blue-300'
                                : 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                            }`}
                          >
                            {sj.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-xs font-semibold truncate">{sj.recipientName}</p>
                        <div className="flex items-center justify-between text-[11px] opacity-75 mt-2">
                          <span>{sj.issueDate}</span>
                          <span>{sj.vehiclePlateNumber}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Document Printable View */}
              <div className="lg:col-span-8">
                {selectedSj ? (
                  <div
                    id="printable-surat-jalan"
                    className={`p-6 sm:p-8 rounded-2xl border shadow-sm print:border-none print:shadow-none print:p-0 ${
                      isLight ? 'bg-white border-gray-300' : 'bg-zinc-800/90 border-zinc-700 text-zinc-100'
                    }`}
                  >
                    {/* Official Company Header */}
                    <div className="border-b-2 border-zinc-900 dark:border-zinc-100 pb-4 mb-4">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 rounded bg-[#0F4C3A] text-white font-mono font-black text-xs tracking-wider">
                              GROCEMART
                            </span>
                            <span className="text-sm font-black tracking-wider uppercase">
                              PT GROCEMART RETAIL INDONESIA
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-zinc-300 mt-1">
                            HQ: Jl. Senopati No. 42, Kebayoran Baru, Jakarta Selatan 12190
                          </p>
                          <p className="text-[10px] text-gray-400 dark:text-zinc-300 font-mono">
                            NPWP: 01.345.678.9-012.000 | NIB: 9120003482114 | Izin Edar: KEMENKES-RI
                          </p>
                        </div>

                        <div className="text-right">
                          <h3 className="text-lg font-black tracking-wider uppercase text-emerald-800 dark:text-emerald-400">
                            SURAT JALAN
                          </h3>
                          <p className="text-xs font-mono font-bold mt-0.5">{selectedSj.documentNumber}</p>
                          <p className="text-[11px] text-gray-500 dark:text-zinc-300">
                            Tanggal: <strong className="font-mono">{selectedSj.issueDate}</strong>
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Dual Info Block (Sender vs Recipient) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs mb-6 p-3 rounded-xl bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700">
                      <div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                          Pengirim / Gudang Asal:
                        </div>
                        <div className="font-bold">{selectedSj.senderStoreName}</div>
                        <div className="text-[11px] text-gray-600 dark:text-zinc-300 mt-0.5">
                          {selectedSj.senderAddress}
                        </div>
                        <div className="text-[11px] font-mono mt-1 text-gray-500">Telp: {selectedSj.senderPhone}</div>
                      </div>

                      <div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                          Penerima / Tujuan:
                        </div>
                        <div className="font-bold text-[#0F4C3A] dark:text-emerald-400">{selectedSj.recipientName}</div>
                        <div className="text-[11px] text-gray-600 dark:text-zinc-300 mt-0.5">
                          {selectedSj.recipientAddress}
                        </div>
                        <div className="text-[11px] font-mono mt-1 text-gray-500">Telp: {selectedSj.recipientPhone}</div>
                      </div>
                    </div>

                    {/* Transport & Carrier Info */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-6 py-2 px-3 rounded-lg border border-gray-200 dark:border-zinc-700 font-mono">
                      <div>
                        <span className="text-[10px] text-gray-400 font-sans block">Kurir / Armada:</span>
                        <span className="font-semibold">{selectedSj.carrierName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 font-sans block">Nomor Polisi:</span>
                        <span className="font-bold text-[#0F4C3A] dark:text-emerald-400">{selectedSj.vehiclePlateNumber}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 font-sans block">Nama Supir:</span>
                        <span className="font-semibold">{selectedSj.driverName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 font-sans block">Cold-Chain Temp:</span>
                        <span className="font-bold text-blue-600 dark:text-blue-400">{selectedSj.coldChainTempCelsius}°C</span>
                      </div>
                    </div>

                    {/* Item Table */}
                    <div className="overflow-x-auto mb-6">
                      <table className="w-full text-left text-xs border border-gray-300 dark:border-zinc-700">
                        <thead className="bg-gray-100 dark:bg-zinc-900 border-b border-gray-300 dark:border-zinc-700 font-bold uppercase text-[10px]">
                          <tr>
                            <th className="py-2 px-3 border-r border-gray-300 dark:border-zinc-700 text-center w-8">No</th>
                            <th className="py-2 px-3 border-r border-gray-300 dark:border-zinc-700">Kode SKU</th>
                            <th className="py-2 px-3 border-r border-gray-300 dark:border-zinc-700">Nama Barang &amp; Spesifikasi</th>
                            <th className="py-2 px-3 border-r border-gray-300 dark:border-zinc-700">Batch / Lot</th>
                            <th className="py-2 px-3 border-r border-gray-300 dark:border-zinc-700 text-center">Jumlah</th>
                            <th className="py-2 px-3 border-r border-gray-300 dark:border-zinc-700">Kemasan</th>
                            <th className="py-2 px-3">Kondisi / Keterangan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-zinc-700">
                          {selectedSj.items.map((item, idx) => (
                            <tr key={idx}>
                              <td className="py-2 px-3 border-r border-gray-200 dark:border-zinc-700 text-center font-mono">
                                {idx + 1}
                              </td>
                              <td className="py-2 px-3 border-r border-gray-200 dark:border-zinc-700 font-mono font-bold text-[#0F4C3A] dark:text-emerald-400">
                                {item.sku}
                              </td>
                              <td className="py-2 px-3 border-r border-gray-200 dark:border-zinc-700 font-semibold">
                                {item.productName}
                              </td>
                              <td className="py-2 px-3 border-r border-gray-200 dark:border-zinc-700 font-mono text-[11px]">
                                {item.batchNumber}
                              </td>
                              <td className="py-2 px-3 border-r border-gray-200 dark:border-zinc-700 text-center font-bold">
                                {item.quantity} {item.unit}
                              </td>
                              <td className="py-2 px-3 border-r border-gray-200 dark:border-zinc-700">
                                {item.packagingType}
                              </td>
                              <td className="py-2 px-3 text-[11px] text-gray-600 dark:text-zinc-300">
                                {item.condition} - {item.notes || 'Normal'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Handling instructions & seal */}
                    <div className="mb-6 p-3 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 text-xs">
                      <span className="font-bold text-amber-900 dark:text-amber-300">Catatan Khusus Penanganan Perishable:</span>
                      <p className="text-[11px] text-amber-800 dark:text-amber-200 mt-0.5">
                        {selectedSj.specialHandlingInstructions}
                      </p>
                    </div>

                    {/* 3-Column Formal Sign-off Block */}
                    <div className="grid grid-cols-3 gap-4 text-center text-xs pt-4 border-t border-gray-300 dark:border-zinc-700">
                      <div className="space-y-12">
                        <span className="font-semibold text-gray-500">Yang Menyerahkan (Pengirim)</span>
                        <div className="border-b border-gray-400 mx-4 pb-1 font-bold">
                          {selectedSj.senderSignatureName}
                        </div>
                      </div>

                      <div className="space-y-12">
                        <span className="font-semibold text-gray-500">Yang Membawa (Supir)</span>
                        <div className="border-b border-gray-400 mx-4 pb-1 font-bold">
                          {selectedSj.driverSignatureName || '( ................................... )'}
                        </div>
                      </div>

                      <div className="space-y-12">
                        <span className="font-semibold text-gray-500">Yang Menerima (Gudang/Outlet)</span>
                        <div className="border-b border-gray-400 mx-4 pb-1 font-bold">
                          {selectedSj.recipientSignatureName || '( ................................... )'}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-20 text-center text-xs opacity-50">Select a Surat Jalan to view</div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: DELIVERY ORDERS (DO) */}
          {/* ========================================================================= */}
          {activeTab === 'delivery_orders' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {deliveryOrders.map((doDoc) => (
                  <div
                    key={doDoc.id}
                    className={`p-5 rounded-2xl border space-y-3 ${
                      isLight ? 'bg-white border-gray-200' : 'bg-zinc-800/80 border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between border-b pb-3 border-gray-100 dark:border-zinc-700">
                      <div>
                        <span className="font-mono text-xs font-bold text-[#0F4C3A] dark:text-emerald-400">
                          {doDoc.doNumber}
                        </span>
                        <h4 className="text-sm font-bold mt-0.5">{doDoc.customerOrStoreName}</h4>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-800 dark:text-blue-300">
                        {doDoc.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="text-xs space-y-1 text-gray-600 dark:text-zinc-300">
                      <div>Address: <strong>{doDoc.deliveryAddress}</strong></div>
                      <div>Window: <strong>{doDoc.deliveryWindow}</strong></div>
                      <div>Authorized By: <strong>{doDoc.authorizedOfficer}</strong></div>
                    </div>

                    <div className="border-t pt-2 border-gray-100 dark:border-zinc-700 flex justify-between items-center text-xs">
                      <span>Total Value:</span>
                      <span className="font-mono font-bold text-sm text-[#0F4C3A] dark:text-emerald-400">
                        {formatIDR(doDoc.totalAmountIDR)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: FLEET SHIPMENT & QUOTA TRACKING */}
          {/* ========================================================================= */}
          {activeTab === 'shipment_quota' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {shipments.map((shp) => (
                  <div
                    key={shp.id}
                    className={`p-5 rounded-2xl border space-y-4 ${
                      isLight ? 'bg-white border-gray-200' : 'bg-zinc-800/80 border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Truck className="w-5 h-5 text-[#0F4C3A] dark:text-emerald-400" />
                        <div>
                          <span className="font-mono text-xs font-bold">{shp.tripId}</span>
                          <h4 className="text-sm font-bold">{shp.vehicleType} ({shp.vehiclePlate})</h4>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300">
                        {shp.status.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </div>

                    {/* Quota Utilization Bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span>Payload Capacity Quota:</span>
                        <strong className="font-mono">
                          {shp.currentPayloadKg} / {shp.maxPayloadKg} kg ({shp.quotaUtilizationPercent}%)
                        </strong>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-zinc-700 h-2.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            shp.quotaUtilizationPercent > 90
                              ? 'bg-rose-500'
                              : shp.quotaUtilizationPercent > 70
                              ? 'bg-emerald-600'
                              : 'bg-blue-600'
                          }`}
                          style={{ width: `${Math.min(100, shp.quotaUtilizationPercent)}%` }}
                        />
                      </div>
                    </div>

                    {/* Route & Temp */}
                    <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-gray-50 dark:bg-zinc-900 text-xs">
                      <div>
                        <span className="text-[10px] text-gray-400 block">Route:</span>
                        <span className="font-semibold">{shp.departureHub} → {shp.destinationHub}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 block">Active Temperature:</span>
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                          {shp.currentTempCelsius}°C (Target: {shp.targetTempCelsius}°C)
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between text-xs text-gray-500 dark:text-zinc-300">
                      <span>Driver: {shp.driverName} ({shp.driverContact})</span>
                      <span>{shp.assignedOrdersCount} Orders Loaded</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Create Surat Jalan Drawer */}
        {isCreatingSj && (
          <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className={`w-full max-w-lg p-6 rounded-2xl border shadow-xl space-y-4 ${
              isLight ? 'bg-white border-gray-300' : 'bg-zinc-900 border-zinc-800'
            }`}>
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-base">Issue Formal Surat Jalan</h3>
                <button onClick={() => setIsCreatingSj(false)}><X className="w-5 h-5 text-gray-400" /></button>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-800 dark:text-zinc-200">Recipient Hub / Customer Name</label>
                  <input
                    type="text"
                    value={newSjRecipient}
                    onChange={(e) => setNewSjRecipient(e.target.value)}
                    required
                    className={`w-full px-3 py-2 rounded-xl border text-xs ${isLight ? "bg-white border-slate-300 text-slate-900" : "bg-zinc-800 border-zinc-700 text-zinc-100"}`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-800 dark:text-zinc-200">Delivery Destination Address</label>
                  <input
                    type="text"
                    value={newSjAddress}
                    onChange={(e) => setNewSjAddress(e.target.value)}
                    required
                    className={`w-full px-3 py-2 rounded-xl border text-xs ${isLight ? "bg-white border-slate-300 text-slate-900" : "bg-zinc-800 border-zinc-700 text-zinc-100"}`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-slate-800 dark:text-zinc-200">Driver Name</label>
                    <input
                      type="text"
                      value={newSjDriver}
                      onChange={(e) => setNewSjDriver(e.target.value)}
                      required
                      className={`w-full px-3 py-2 rounded-xl border text-xs ${isLight ? "bg-white border-slate-300 text-slate-900" : "bg-zinc-800 border-zinc-700 text-zinc-100"}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-slate-800 dark:text-zinc-200">Vehicle License Plate</label>
                    <input
                      type="text"
                      value={newSjVehiclePlate}
                      onChange={(e) => setNewSjVehiclePlate(e.target.value)}
                      required
                      className={`w-full px-3 py-2 rounded-xl border text-xs ${isLight ? "bg-white border-slate-300 text-slate-900" : "bg-zinc-800 border-zinc-700 text-zinc-100"}`}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-slate-800 dark:text-zinc-200">Cold-Chain Temp (°C)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={newSjTemp}
                      onChange={(e) => setNewSjTemp(Number(e.target.value))}
                      className={`w-full px-3 py-2 rounded-xl border font-mono ${isLight ? 'bg-white border-gray-300' : 'bg-zinc-800 border-zinc-700'}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-slate-800 dark:text-zinc-200">Handling Notes</label>
                    <input
                      type="text"
                      value={newSjNotes}
                      onChange={(e) => setNewSjNotes(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl border text-xs ${isLight ? "bg-white border-slate-300 text-slate-900" : "bg-zinc-800 border-zinc-700 text-zinc-100"}`}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setIsCreatingSj(false)}
                    className="px-4 py-2 rounded-xl border text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#0F4C3A] text-white text-xs font-bold hover:bg-[#0b382b]"
                  >
                    Generate &amp; Print Ready
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );

  if (isStandalonePage) {
    return <div className="space-y-6">{content}</div>;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      {content}
    </div>
  );
};
