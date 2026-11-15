import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type {
  SuratJalanDocument,
  DeliveryOrderDocument,
  ShipmentQuotaTracking,
  StaffShiftSession,
} from '../../types/index.ts';
import { formatIDR } from '../../utils/formatters';
import { apiClient } from '../../services/apiClient';
import { usePrint } from '../../context/PrintContext';
import { normalizeEnterpriseRole } from '../../utils/rbac';
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
  Mail,
  MessageCircle,
  ClipboardCheck,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import { DocumentDispatchModal } from './DocumentDispatchModal';

interface LogisticsDocsModalProps {
  theme: 'light' | 'dark';
  isOpen?: boolean;
  isStandalonePage?: boolean;
  onClose?: () => void;
  suratJalanList?: SuratJalanDocument[];
  deliveryOrders?: DeliveryOrderDocument[];
  shipments?: ShipmentQuotaTracking[];
  onIssueSuratJalan?: (doc: Partial<SuratJalanDocument>) => Promise<void>;
  activeStaffSession?: StaffShiftSession | null;
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
  activeStaffSession,
  onShowToast,
}) => {
  const isLight = theme === 'light';
  const canIssueSuratJalan =
    !activeStaffSession ||
    ['warehouse', 'store_manager', 'coo', 'super_admin'].includes(
      normalizeEnterpriseRole(activeStaffSession.userRole)
    );
  const { triggerPrint, invoiceTracking } = usePrint();
  const showLots = invoiceTracking?.displayLotsOnInvoices ?? true;
  const showDeliveryExpiry = invoiceTracking?.displaySerialExpiryOnDeliveryDocs ?? true;

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
      setSelectedSj((prev) =>
        prev ? sjRes.find((s) => s.id === prev.id) || sjRes[0] || null : sjRes[0] || null
      );
      setSelectedDo((prev) =>
        prev ? doRes.find((d) => d.id === prev.id) || doRes[0] || null : doRes[0] || null
      );
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
  const [dispatchSj, setDispatchSj] = useState<{
    sj: SuratJalanDocument;
    channel: 'email' | 'whatsapp';
  } | null>(null);

  // New Surat Jalan Form State
  const [isCreatingSj, setIsCreatingSj] = useState<boolean>(false);
  const [newSjRecipient, setNewSjRecipient] = useState<string>('GroceMart PIK 2 Hub');
  const [newSjAddress, setNewSjAddress] = useState<string>('The Avenue Blok A1 No. 8, Pantai Indah Kapuk 2');
  const [newSjDriver, setNewSjDriver] = useState<string>('Bambang Sudirgo');
  const [newSjVehiclePlate, setNewSjVehiclePlate] = useState<string>('B 9482 SXZ');
  const [newSjTemp, setNewSjTemp] = useState<number>(3.5);
  const [newSjNotes, setNewSjNotes] = useState<string>('Continuous cold-chain 2-4°C required');

  // Consolidated Route Trip Builder State
  const FLEET_PRESETS = [
    {
      id: 'chiller_van',
      label: 'Chiller Van B-9102-GMR (2°C–4°C • Max 1,200 kg)',
      vehicleType: 'Chiller Van (2°C–4°C)',
      vehiclePlate: 'B-9102-GMR',
      driverName: 'Bambang Supriyanto',
      driverContact: '+62 812 8899 7711',
      maxPayloadKg: 1200,
      targetTempCelsius: 3.0,
      isAmbient: false,
    },
    {
      id: 'reefer_truck',
      label: 'Reefer Truck B-9220-GMR (2°C–4°C • Max 2,500 kg)',
      vehicleType: 'Reefer Truck (2°C–4°C)',
      vehiclePlate: 'B-9220-GMR',
      driverName: 'Hendra Gunawan',
      driverContact: '+62 813 7788 1122',
      maxPayloadKg: 2500,
      targetTempCelsius: 2.5,
      isAmbient: false,
    },
    {
      id: 'ambient_truck',
      label: 'Ambient Box Truck B-9440-GMR (Dry Cargo • Max 2,500 kg)',
      vehicleType: 'Ambient Box Truck',
      vehiclePlate: 'B-9440-GMR',
      driverName: 'Slamet Riyadi',
      driverContact: '+62 815 9922 3344',
      maxPayloadKg: 2500,
      targetTempCelsius: 24.0,
      isAmbient: true,
    },
  ];

  const [isTripBuilderOpen, setIsTripBuilderOpen] = useState<boolean>(false);
  const [tripSelectedSjIds, setTripSelectedSjIds] = useState<string[]>([]);
  const [tripRouteZone, setTripRouteZone] = useState<string>('South Jakarta / SCBD-Senopati');
  const [tripFleetPresetId, setTripFleetPresetId] = useState<string>('chiller_van');
  const [tripNotifyCustomers, setTripNotifyCustomers] = useState<boolean>(true);
  const [isSubmittingTrip, setIsSubmittingTrip] = useState<boolean>(false);

  // e-POD Modal State
  const [epodTargetSj, setEpodTargetSj] = useState<SuratJalanDocument | null>(null);
  const [epodReceiverName, setEpodReceiverName] = useState<string>('');
  const [epodDeliveredAt, setEpodDeliveredAt] = useState<string>('');
  const [epodArrivalTemp, setEpodArrivalTemp] = useState<number>(3.4);
  const [epodOutcome, setEpodOutcome] = useState<'DELIVERED_FULL' | 'PARTIAL_RETURN'>('DELIVERED_FULL');
  const [epodNotes, setEpodNotes] = useState<string>('');
  const [epodReturnMap, setEpodReturnMap] = useState<
    Record<string, { returnedQty: number; condition: 'GOOD_RESTOCK' | 'DAMAGED_QUARANTINE'; reason: string }>
  >({});
  const [isSubmittingEpod, setIsSubmittingEpod] = useState<boolean>(false);

  if (!isOpen && !isStandalonePage) return null;

  const handlePrint = () => {
    triggerPrint({
      type: 'logistics_doc',
      format: 'a4',
      activeTab,
      selectedSj,
      deliveryOrders,
      shipments,
    });
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

  const readyToDispatchSjList = suratJalanList.filter(
    (sj) => sj.status === 'READY_FOR_DISPATCH' || sj.status === 'draft'
  );
  const activeFleetPreset =
    FLEET_PRESETS.find((f) => f.id === tripFleetPresetId) || FLEET_PRESETS[0];
  const selectedTripSjs = suratJalanList.filter((sj) => tripSelectedSjIds.includes(sj.id));
  const selectedTripWeightKg = Number(
    selectedTripSjs.reduce((sum, sj) => sum + (Number(sj.totalWeightKg) || 0), 0).toFixed(2)
  );
  const selectedTripUtilPct = Math.round(
    (selectedTripWeightKg / activeFleetPreset.maxPayloadKg) * 100
  );
  const tripColdChainConflict =
    activeFleetPreset.isAmbient &&
    selectedTripSjs.some((sj) => (sj.coldChainTempCelsius ?? 4) <= 8);

  const openTripBuilder = () => {
    setTripSelectedSjIds(readyToDispatchSjList.map((sj) => sj.id));
    setIsTripBuilderOpen(true);
  };

  const handleConsolidateTripSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tripSelectedSjIds.length === 0 || isSubmittingTrip) return;
    setIsSubmittingTrip(true);
    try {
      const res = await apiClient.createLogisticsTrip({
        suratJalanIds: tripSelectedSjIds,
        routeZone: tripRouteZone,
        vehicleType: activeFleetPreset.vehicleType,
        vehiclePlate: activeFleetPreset.vehiclePlate,
        maxPayloadKg: activeFleetPreset.maxPayloadKg,
        targetTempCelsius: activeFleetPreset.targetTempCelsius,
        currentTempCelsius: activeFleetPreset.isAmbient ? 23.5 : activeFleetPreset.targetTempCelsius,
        driverName: activeFleetPreset.driverName,
        driverContact: activeFleetPreset.driverContact,
        notifyCustomers: tripNotifyCustomers,
      });
      await fetchDocs();
      setIsTripBuilderOpen(false);
      onShowToast('Consolidated Trip Dispatched', res.message);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Trip Consolidation Blocked', msg);
    } finally {
      setIsSubmittingTrip(false);
    }
  };

  const openEpodModal = (sj: SuratJalanDocument) => {
    setEpodTargetSj(sj);
    setEpodReceiverName(sj.recipientName || '');
    setEpodDeliveredAt(new Date().toISOString().slice(0, 16));
    setEpodArrivalTemp(sj.coldChainTempCelsius ?? 3.5);
    setEpodOutcome('DELIVERED_FULL');
    setEpodNotes('');
    const initMap: Record<
      string,
      { returnedQty: number; condition: 'GOOD_RESTOCK' | 'DAMAGED_QUARANTINE'; reason: string }
    > = {};
    sj.items.forEach((it) => {
      initMap[it.sku] = {
        returnedQty: 0,
        condition: 'GOOD_RESTOCK',
        reason: '',
      };
    });
    setEpodReturnMap(initMap);
  };

  const handleSubmitEpod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!epodTargetSj || isSubmittingEpod) return;

    const returnedItems =
      epodOutcome === 'PARTIAL_RETURN'
        ? Object.entries(epodReturnMap)
            .filter(([, cfg]) => Number(cfg.returnedQty) > 0)
            .map(([sku, cfg]) => ({
              sku,
              returnedQty: Number(cfg.returnedQty),
              condition: cfg.condition,
              reason: cfg.reason || undefined,
            }))
        : [];

    if (epodOutcome === 'PARTIAL_RETURN' && returnedItems.length === 0) {
      onShowToast(
        'Partial Return Quantities Needed',
        'Enter at least one returned SKU quantity (> 0) or select Full Delivery.'
      );
      return;
    }

    setIsSubmittingEpod(true);
    try {
      const res = await apiClient.submitSuratJalanEpod(epodTargetSj.id, {
        receiverName: epodReceiverName,
        deliveredAt: epodDeliveredAt ? new Date(epodDeliveredAt).toISOString() : undefined,
        arrivalTempCelsius: Number(epodArrivalTemp),
        outcome: epodOutcome,
        returnedItems,
        notes: epodNotes || undefined,
      });
      await fetchDocs();
      setEpodTargetSj(null);
      onShowToast('e-POD Recorded & Synced', res.message);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('e-POD Submission Failed', msg);
    } finally {
      setIsSubmittingEpod(false);
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
        isLight ? 'bg-white border-gray-200 text-gray-900' : 'bg-[#12141C] border-slate-800/80 text-slate-100'
      }`}
    >
      {/* Modal Header */}
      <div
        className={`flex items-center justify-between px-6 py-4 border-b flex-shrink-0 ${
          isLight ? 'bg-gray-50/80 border-gray-200' : 'bg-[#090A0F]/80 border-slate-800/80'
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
              <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                Surat Jalan (Waybill / Delivery Note), Delivery Order (DO), and Fleet Quota Dispatch Tracking
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'surat_jalan' && selectedSj && (
              <>
                {canIssueSuratJalan &&
                  !['delivered', 'partial_return', 'signed'].includes(selectedSj.status) && (
                    <button
                      type="button"
                      onClick={() => openEpodModal(selectedSj)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-all cursor-pointer"
                      title="Record Electronic Proof of Delivery (e-POD)"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5" />
                      <span>Complete e-POD</span>
                    </button>
                  )}
                <button
                  type="button"
                  onClick={() => setDispatchSj({ sj: selectedSj, channel: 'email' })}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    isLight
                      ? 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-800 shadow-2xs'
                      : 'bg-[#090A0F] hover:bg-slate-900/90 border-slate-800/80 text-indigo-300'
                  }`}
                  title="Email Surat Jalan via SMTP"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Email</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDispatchSj({ sj: selectedSj, channel: 'whatsapp' })}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    isLight
                      ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-800 shadow-2xs'
                      : 'bg-[#090A0F] hover:bg-slate-900/90 border-slate-800/80 text-emerald-400'
                  }`}
                  title="Send Surat Jalan via WhatsApp"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">WhatsApp</span>
                </button>
              </>
            )}

            <button
              onClick={handlePrint}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                isLight
                  ? 'bg-white hover:bg-gray-100 border-gray-300 text-gray-700 shadow-2xs'
                  : 'bg-[#090A0F] hover:bg-slate-900/90 border-slate-800/80 text-slate-200'
              }`}
              title="Print document in official A4 layout"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print Document</span>
            </button>

            {!isStandalonePage && (
              <button
                onClick={onClose}
                className={`p-2 rounded-xl transition-colors ${
                  isLight ? 'hover:bg-gray-100 text-gray-500' : 'hover:bg-slate-900/90 text-slate-400'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          className={`flex items-center justify-between px-6 py-2 border-b flex-shrink-0 ${
            isLight ? 'bg-white border-gray-100' : 'bg-[#12141C] border-slate-800/80'
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
                  : 'text-slate-400 hover:bg-slate-900/90'
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
                  : 'text-slate-400 hover:bg-slate-900/90'
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
                  : 'text-slate-400 hover:bg-slate-900/90'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Fleet Quota Tracking</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/10 dark:bg-white/10 font-mono">
                {shipments.length}
              </span>
            </button>
          </div>

          {activeTab === 'surat_jalan' && canIssueSuratJalan && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={openTripBuilder}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                  isLight
                    ? 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900'
                    : 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/30 text-amber-300'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Consolidate Route Trip ({readyToDispatchSjList.length})</span>
              </button>
              <button
                onClick={() => setIsCreatingSj(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#0F4C3A] hover:bg-[#0b382b] text-white rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Issue Surat Jalan</span>
              </button>
            </div>
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
                      isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100 placeholder:text-slate-500'
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
                            : 'bg-[#090A0F] border-slate-800/80 hover:bg-slate-900/90'
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
                      isLight ? 'bg-white border-gray-300' : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                    }`}
                  >
                    {/* Official Company Header */}
                    <div className="border-b-2 border-slate-900 dark:border-slate-100 pb-4 mb-4">
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
                          <p className="text-[11px] text-gray-500 dark:text-slate-300 mt-1">
                            HQ: Jl. Senopati No. 42, Kebayoran Baru, Jakarta Selatan 12190
                          </p>
                          <p className="text-[10px] text-gray-400 dark:text-slate-400 font-mono">
                            NPWP: 01.345.678.9-012.000 | NIB: 9120003482114 | Izin Edar: KEMENKES-RI
                          </p>
                        </div>

                        <div className="text-right">
                          <h3 className="text-lg font-black tracking-wider uppercase text-emerald-800 dark:text-emerald-400">
                            SURAT JALAN
                          </h3>
                          <p className="text-xs font-mono font-bold mt-0.5">{selectedSj.documentNumber}</p>
                          <p className="text-[11px] text-gray-500 dark:text-slate-300">
                            Tanggal: <strong className="font-mono">{selectedSj.issueDate}</strong>
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Dual Info Block (Sender vs Recipient) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs mb-6 p-3 rounded-xl bg-gray-50 dark:bg-[#12141C] border border-gray-200 dark:border-slate-800/80">
                      <div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                          Pengirim / Gudang Asal:
                        </div>
                        <div className="font-bold">{selectedSj.senderStoreName}</div>
                        <div className="text-[11px] text-gray-600 dark:text-slate-300 mt-0.5">
                          {selectedSj.senderAddress}
                        </div>
                        <div className="text-[11px] font-mono mt-1 text-gray-500">Telp: {selectedSj.senderPhone}</div>
                      </div>

                      <div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                          Penerima / Tujuan:
                        </div>
                        <div className="font-bold text-[#0F4C3A] dark:text-emerald-400">{selectedSj.recipientName}</div>
                        <div className="text-[11px] text-gray-600 dark:text-slate-300 mt-0.5">
                          {selectedSj.recipientAddress}
                        </div>
                        <div className="text-[11px] font-mono mt-1 text-gray-500">Telp: {selectedSj.recipientPhone}</div>
                      </div>
                    </div>

                    {/* Transport & Carrier Info */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-6 py-2 px-3 rounded-lg border border-gray-200 dark:border-slate-800/80 font-mono">
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
                      <table className="w-full text-left text-xs border border-gray-300 dark:border-slate-800/80">
                        <thead className="bg-gray-100 dark:bg-[#12141C] border-b border-gray-300 dark:border-slate-800/80 font-bold uppercase text-[10px]">
                          <tr>
                            <th className="py-2 px-3 border-r border-gray-300 dark:border-slate-800/80 text-center w-8">No</th>
                            <th className="py-2 px-3 border-r border-gray-300 dark:border-slate-800/80">Kode SKU</th>
                            <th className="py-2 px-3 border-r border-gray-300 dark:border-slate-800/80">Nama Barang &amp; Spesifikasi</th>
                            {showLots && (
                              <th className="py-2 px-3 border-r border-gray-300 dark:border-slate-800/80">Batch / Lot</th>
                            )}
                            <th className="py-2 px-3 border-r border-gray-300 dark:border-slate-800/80 text-center">Jumlah</th>
                            <th className="py-2 px-3 border-r border-gray-300 dark:border-slate-800/80">Kemasan</th>
                            <th className="py-2 px-3">Kondisi / Keterangan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-slate-800/80">
                          {selectedSj.items.map((item, idx) => (
                            <tr key={idx}>
                              <td className="py-2 px-3 border-r border-gray-200 dark:border-slate-800/80 text-center font-mono">
                                {idx + 1}
                              </td>
                              <td className="py-2 px-3 border-r border-gray-200 dark:border-slate-800/80 font-mono font-bold text-[#0F4C3A] dark:text-emerald-400">
                                {item.sku}
                              </td>
                              <td className="py-2 px-3 border-r border-gray-200 dark:border-slate-800/80 font-semibold">
                                {item.productName}
                              </td>
                              {showLots && (
                                <td className="py-2 px-3 border-r border-gray-200 dark:border-slate-800/80 font-mono text-[11px]">
                                  {item.batchNumber}
                                </td>
                              )}
                              <td className="py-2 px-3 border-r border-gray-200 dark:border-slate-800/80 text-center font-bold">
                                {item.quantity} {item.unit}
                              </td>
                              <td className="py-2 px-3 border-r border-gray-200 dark:border-slate-800/80">
                                {item.packagingType}
                              </td>
                              <td className="py-2 px-3 text-[11px] text-gray-600 dark:text-slate-300">
                                <div>{item.condition} - {item.notes || 'Normal'}</div>
                                {showDeliveryExpiry && (
                                  <div className="font-mono text-[10px] text-[#0F4C3A] dark:text-emerald-400 font-semibold mt-0.5">
                                    FEFO Expiry &amp; Cold-Chain Verified ({selectedSj.coldChainTempCelsius}°C)
                                  </div>
                                )}
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
                    <div className="grid grid-cols-3 gap-4 text-center text-xs pt-4 border-t border-gray-300 dark:border-slate-800/80">
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

                    {selectedSj.epod && (
                      <div className="mt-5 p-3.5 rounded-xl border border-emerald-300 dark:border-emerald-700/60 bg-emerald-50/70 dark:bg-emerald-950/20 text-xs space-y-1.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-bold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider text-[11px]">
                            Electronic Proof of Delivery (e-POD) Verified — {selectedSj.epod.outcome.replace(/_/g, ' ')}
                          </span>
                          <span className="font-mono text-[11px] text-emerald-800 dark:text-emerald-400">
                            Arrival Temp: {selectedSj.epod.arrivalTempCelsius}°C · Signed: {new Date(selectedSj.epod.deliveredAt).toLocaleString('id-ID')}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-700 dark:text-slate-300">
                          Receiver: <strong>{selectedSj.epod.receiverName}</strong>
                          {selectedSj.tripId && <span> · Consolidated Trip: <strong className="font-mono">{selectedSj.tripId}</strong></span>}
                          {selectedSj.epod.creditMemoNumber && (
                            <span> · Credit Memo: <strong className="font-mono text-amber-700 dark:text-amber-300">{selectedSj.epod.creditMemoNumber}</strong> ({formatIDR(selectedSj.epod.creditAmountIDR || 0)})</span>
                          )}
                        </div>
                        {selectedSj.epod.returnedItems && selectedSj.epod.returnedItems.length > 0 && (
                          <div className="text-[11px] text-amber-800 dark:text-amber-300 pt-1 border-t border-emerald-200/70 dark:border-emerald-800/50">
                            Returned Lines:{' '}
                            {selectedSj.epod.returnedItems
                              .map((r) => `${r.sku} x${r.returnedQty} (${r.condition.replace(/_/g, ' ')})`)
                              .join(' · ')}
                          </div>
                        )}
                      </div>
                    )}
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
                      isLight ? 'bg-white border-gray-200' : 'bg-[#090A0F] border-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center justify-between border-b pb-3 border-gray-100 dark:border-slate-800/80">
                      <div>
                        <span className="font-mono text-xs font-bold text-[#0F4C3A] dark:text-emerald-400">
                          {doDoc.doNumber}
                        </span>
                        <h4 className="text-sm font-bold mt-0.5">{doDoc.customerOrStoreName}</h4>
                      </div>
                      <span className="inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-800 dark:text-blue-300 border border-blue-500/25">
                        {doDoc.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="text-xs space-y-1 text-gray-600 dark:text-slate-300">
                      <div>Address: <strong>{doDoc.deliveryAddress}</strong></div>
                      <div>Window: <strong>{doDoc.deliveryWindow}</strong></div>
                      <div>Authorized By: <strong>{doDoc.authorizedOfficer}</strong></div>
                    </div>

                    <div className="border-t pt-2 border-gray-100 dark:border-slate-800/80 flex justify-between items-center text-xs">
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
                      isLight ? 'bg-white border-gray-200' : 'bg-[#090A0F] border-slate-800/80'
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
                      <span className="inline-flex items-center whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/25">
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
                      <div className="w-full bg-gray-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
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
                    <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-gray-50 dark:bg-[#12141C] border border-transparent dark:border-slate-800/80 text-xs">
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

                    <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400">
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
        {isCreatingSj && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 z-[110] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className={`w-full max-w-lg p-6 rounded-2xl border shadow-xl space-y-4 my-auto ${
              isLight ? 'bg-white border-gray-300' : 'bg-[#12141C] border-slate-800/80 text-slate-100'
            }`}>
              <div className="flex justify-between items-center border-b border-gray-200 dark:border-slate-800/80 pb-3">
                <h3 className="font-bold text-base">Issue Formal Surat Jalan</h3>
                <button onClick={() => setIsCreatingSj(false)}><X className="w-5 h-5 text-slate-400" /></button>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-800 dark:text-slate-200">Recipient Hub / Customer Name</label>
                  <input
                    type="text"
                    value={newSjRecipient}
                    onChange={(e) => setNewSjRecipient(e.target.value)}
                    required
                    className={`w-full px-3 py-2 rounded-xl border text-xs ${isLight ? "bg-white border-slate-300 text-slate-900" : "bg-[#090A0F] border-slate-800/80 text-slate-100"}`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-800 dark:text-slate-200">Delivery Destination Address</label>
                  <input
                    type="text"
                    value={newSjAddress}
                    onChange={(e) => setNewSjAddress(e.target.value)}
                    required
                    className={`w-full px-3 py-2 rounded-xl border text-xs ${isLight ? "bg-white border-slate-300 text-slate-900" : "bg-[#090A0F] border-slate-800/80 text-slate-100"}`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-slate-800 dark:text-slate-200">Driver Name</label>
                    <input
                      type="text"
                      value={newSjDriver}
                      onChange={(e) => setNewSjDriver(e.target.value)}
                      required
                      className={`w-full px-3 py-2 rounded-xl border text-xs ${isLight ? "bg-white border-slate-300 text-slate-900" : "bg-[#090A0F] border-slate-800/80 text-slate-100"}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-slate-800 dark:text-slate-200">Vehicle License Plate</label>
                    <input
                      type="text"
                      value={newSjVehiclePlate}
                      onChange={(e) => setNewSjVehiclePlate(e.target.value)}
                      required
                      className={`w-full px-3 py-2 rounded-xl border text-xs ${isLight ? "bg-white border-slate-300 text-slate-900" : "bg-[#090A0F] border-slate-800/80 text-slate-100"}`}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-slate-800 dark:text-slate-200">Cold-Chain Temp (°C)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={newSjTemp}
                      onChange={(e) => setNewSjTemp(Number(e.target.value))}
                      className={`w-full px-3 py-2 rounded-xl border font-mono ${isLight ? 'bg-white border-gray-300' : 'bg-[#090A0F] border-slate-800/80 text-slate-100'}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-slate-800 dark:text-slate-200">Handling Notes</label>
                    <input
                      type="text"
                      value={newSjNotes}
                      onChange={(e) => setNewSjNotes(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl border text-xs ${isLight ? "bg-white border-slate-300 text-slate-900" : "bg-[#090A0F] border-slate-800/80 text-slate-100"}`}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 dark:border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => setIsCreatingSj(false)}
                    className="px-4 py-2 rounded-xl border border-gray-300 dark:border-slate-800/80 bg-white dark:bg-[#090A0F] text-xs font-semibold"
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
          </div>,
          document.body
        )}
      {dispatchSj && (
        <DocumentDispatchModal
          isOpen={Boolean(dispatchSj)}
          onClose={() => setDispatchSj(null)}
          theme={theme}
          initialChannel={dispatchSj.channel}
          docType="SURAT_JALAN"
          docId={dispatchSj.sj.id}
          docNumber={dispatchSj.sj.documentNumber}
          docSummary={`Recipient: ${dispatchSj.sj.recipientName}\nFleet: ${dispatchSj.sj.vehicleType} (${dispatchSj.sj.vehiclePlateNumber}) | Driver: ${dispatchSj.sj.driverName}\nPayload: ${dispatchSj.sj.totalPackages} Koli / ${dispatchSj.sj.totalWeightKg} Kg`}
          defaultRecipientName={dispatchSj.sj.recipientName}
          defaultRecipientEmail={dispatchSj.sj.recipientEmail || 'warehouse-receiving@grocemart.co.id'}
          defaultRecipientPhone={dispatchSj.sj.recipientPhone}
          onShowToast={onShowToast}
        />
      )}

      {/* Route Trip Consolidation Builder Modal */}
      {isTripBuilderOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[115] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className={`w-full max-w-2xl p-5 sm:p-6 rounded-2xl border shadow-2xl space-y-4 my-auto max-h-[92vh] overflow-y-auto ${
            isLight ? 'bg-white border-gray-200 text-gray-900' : 'bg-[#12141C] border-slate-800/80 text-slate-100'
          }`}>
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-800/80 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#0F4C3A] text-white">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Consolidate Delivery Route Trip</h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Group multiple ready Surat Jalan waybills onto one cold-chain fleet trip
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTripBuilderOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConsolidateTripSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Route Delivery Zone</label>
                  <select
                    value={tripRouteZone}
                    onChange={(e) => setTripRouteZone(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border ${
                      isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                    }`}
                  >
                    <option value="South Jakarta / SCBD-Senopati">South Jakarta / SCBD-Senopati</option>
                    <option value="Central & West Jakarta">Central & West Jakarta</option>
                    <option value="PIK 2 / North Jakarta">PIK 2 / North Jakarta</option>
                    <option value="Bintaro / BSD City">Bintaro / BSD City</option>
                    <option value="Bekasi / East Industrial">Bekasi / East Industrial</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Fleet Vehicle & Driver Assignment</label>
                  <select
                    value={tripFleetPresetId}
                    onChange={(e) => setTripFleetPresetId(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border ${
                      isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                    }`}
                  >
                    {FLEET_PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Payload Quota & Cold-Chain Validation Bar */}
              <div className="p-3.5 rounded-xl border border-gray-200 dark:border-slate-800/80 bg-gray-50 dark:bg-[#090A0F] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">
                    Driver: {activeFleetPreset.driverName} ({activeFleetPreset.vehiclePlate})
                  </span>
                  <span className={`font-mono font-bold ${
                    selectedTripUtilPct > 100
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-[#0F4C3A] dark:text-emerald-400'
                  }`}>
                    {selectedTripWeightKg} / {activeFleetPreset.maxPayloadKg} kg ({selectedTripUtilPct}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      selectedTripUtilPct > 100
                        ? 'bg-rose-600'
                        : selectedTripUtilPct > 80
                        ? 'bg-amber-500'
                        : 'bg-[#0F4C3A]'
                    }`}
                    style={{ width: `${Math.min(100, selectedTripUtilPct)}%` }}
                  />
                </div>
                {tripColdChainConflict && (
                  <div className="flex items-start gap-2 text-rose-700 dark:text-rose-300 pt-1">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      Cold-Chain Conflict: Selected Surat Jalan contains chilled/frozen goods. Switch to a Chiller Van or Reefer Truck.
                    </span>
                  </div>
                )}
              </div>

              {/* Ready Surat Jalan Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Select Surat Jalan Dispatches ({tripSelectedSjIds.length} selected)</span>
                  <button
                    type="button"
                    onClick={() =>
                      setTripSelectedSjIds(
                        tripSelectedSjIds.length === readyToDispatchSjList.length
                          ? []
                          : readyToDispatchSjList.map((s) => s.id)
                      )
                    }
                    className="text-[11px] font-semibold text-[#0F4C3A] dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    {tripSelectedSjIds.length === readyToDispatchSjList.length ? 'Clear All' : 'Select All Ready'}
                  </button>
                </div>

                <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                  {readyToDispatchSjList.length === 0 ? (
                    <div className="p-6 text-center rounded-xl border border-dashed border-gray-300 dark:border-slate-800/80 text-gray-500 dark:text-slate-400">
                      No READY_FOR_DISPATCH Surat Jalan documents pending consolidation. Complete a fulfillment order or issue a new Surat Jalan first.
                    </div>
                  ) : (
                    readyToDispatchSjList.map((sj) => {
                      const checked = tripSelectedSjIds.includes(sj.id);
                      return (
                        <label
                          key={sj.id}
                          className={`flex items-center justify-between gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            checked
                              ? 'border-[#0F4C3A] bg-emerald-500/5'
                              : isLight
                              ? 'border-gray-200 hover:bg-gray-50'
                              : 'border-slate-800/80 bg-[#090A0F] hover:bg-slate-900/90'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setTripSelectedSjIds((prev) =>
                                  e.target.checked
                                    ? [...prev, sj.id]
                                    : prev.filter((id) => id !== sj.id)
                                );
                              }}
                              className="rounded text-[#0F4C3A]"
                            />
                            <div className="min-w-0">
                              <div className="font-mono font-bold truncate">{sj.documentNumber} — {sj.recipientName}</div>
                              <div className="text-[11px] text-gray-500 dark:text-slate-400 truncate">
                                {sj.routeZone || sj.recipientAddress} · {sj.items.length} SKU(s) · Target {sj.coldChainTempCelsius}°C
                              </div>
                            </div>
                          </div>
                          <span className="font-mono font-bold shrink-0">{sj.totalWeightKg} kg</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <label className="flex items-center gap-2 p-2.5 rounded-xl border border-gray-200 dark:border-slate-800/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tripNotifyCustomers}
                  onChange={(e) => setTripNotifyCustomers(e.target.checked)}
                  className="rounded text-[#0F4C3A]"
                />
                <span>Notify customers via WhatsApp &amp; Email Dispatch Gateway upon departure</span>
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 dark:border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setIsTripBuilderOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 dark:border-slate-800/80 bg-white dark:bg-[#090A0F] text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    isSubmittingTrip ||
                    tripSelectedSjIds.length === 0 ||
                    selectedTripUtilPct > 100 ||
                    tripColdChainConflict
                  }
                  className="px-4 py-2 rounded-xl bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingTrip ? 'Dispatching Trip...' : `Dispatch Consolidated Trip (${tripSelectedSjIds.length})`}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Electronic Proof of Delivery (e-POD) Modal */}
      {epodTargetSj && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[115] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className={`w-full max-w-2xl p-5 sm:p-6 rounded-2xl border shadow-2xl space-y-4 my-auto max-h-[92vh] overflow-y-auto ${
            isLight ? 'bg-white border-gray-200 text-gray-900' : 'bg-[#12141C] border-slate-800/80 text-slate-100'
          }`}>
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-800/80 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500 text-white">
                  <ClipboardCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Electronic Proof of Delivery (e-POD)</h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400 font-mono">
                    {epodTargetSj.documentNumber} · {epodTargetSj.recipientName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEpodTargetSj(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEpod} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Receiver Name</label>
                  <input
                    type="text"
                    required
                    value={epodReceiverName}
                    onChange={(e) => setEpodReceiverName(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border ${
                      isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                    }`}
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Delivery Timestamp</label>
                  <input
                    type="datetime-local"
                    required
                    value={epodDeliveredAt}
                    onChange={(e) => setEpodDeliveredAt(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border font-mono ${
                      isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                    }`}
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Arrival Temp (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={epodArrivalTemp}
                    onChange={(e) => setEpodArrivalTemp(Number(e.target.value))}
                    className={`w-full px-3 py-2 rounded-xl border font-mono ${
                      isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1.5">Delivery Outcome</label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEpodOutcome('DELIVERED_FULL')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      epodOutcome === 'DELIVERED_FULL'
                        ? 'border-emerald-600 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                        : 'border-gray-200 dark:border-slate-800/80 dark:bg-[#090A0F]'
                    }`}
                  >
                    <div className="font-bold">Full Delivery Signed</div>
                    <div className="text-[11px] opacity-80">100% items accepted in good condition</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEpodOutcome('PARTIAL_RETURN')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      epodOutcome === 'PARTIAL_RETURN'
                        ? 'border-amber-600 bg-amber-500/10 text-amber-800 dark:text-amber-300'
                        : 'border-gray-200 dark:border-slate-800/80 dark:bg-[#090A0F]'
                    }`}
                  >
                    <div className="font-bold">Partial Return / On-Site Rejection</div>
                    <div className="text-[11px] opacity-80">Restock good items or quarantine damaged lines</div>
                  </button>
                </div>
              </div>

              {epodOutcome === 'PARTIAL_RETURN' && (
                <div className="space-y-2.5 p-3.5 rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50/40 dark:bg-amber-950/20">
                  <div className="font-bold text-amber-900 dark:text-amber-300">
                    Returned Line Disposition (Auto-updates Inventory &amp; Credit Memo GL)
                  </div>
                  <div className="space-y-2">
                    {epodTargetSj.items.map((item) => {
                      const rowState = epodReturnMap[item.sku] || {
                        returnedQty: 0,
                        condition: 'GOOD_RESTOCK' as const,
                        reason: '',
                      };
                      return (
                        <div
                          key={item.sku}
                          className={`p-2.5 rounded-xl border grid grid-cols-1 sm:grid-cols-12 gap-2 items-center ${
                            isLight ? 'bg-white border-gray-200' : 'bg-[#090A0F] border-slate-800/80'
                          }`}
                        >
                          <div className="sm:col-span-4">
                            <div className="font-bold truncate">{item.productName}</div>
                            <div className="text-[11px] font-mono text-gray-500 dark:text-slate-400">
                              {item.sku} · Sent: {item.quantity} {item.unit}
                            </div>
                          </div>
                          <div className="sm:col-span-2">
                            <label className="text-[10px] text-gray-400 block">Return Qty</label>
                            <input
                              type="number"
                              min={0}
                              max={item.quantity}
                              value={rowState.returnedQty}
                              onChange={(e) => {
                                const val = Math.min(item.quantity, Math.max(0, Number(e.target.value) || 0));
                                setEpodReturnMap((prev) => ({
                                  ...prev,
                                  [item.sku]: { ...rowState, returnedQty: val },
                                }));
                              }}
                              className={`w-full px-2 py-1.5 rounded-lg border font-mono ${
                                isLight ? 'bg-white border-gray-300' : 'bg-[#12141C] border-slate-800/80 text-slate-100'
                              }`}
                            />
                          </div>
                          <div className="sm:col-span-3">
                            <label className="text-[10px] text-gray-400 block">Condition</label>
                            <select
                              value={rowState.condition}
                              onChange={(e) =>
                                setEpodReturnMap((prev) => ({
                                  ...prev,
                                  [item.sku]: {
                                    ...rowState,
                                    condition: e.target.value as 'GOOD_RESTOCK' | 'DAMAGED_QUARANTINE',
                                  },
                                }))
                              }
                              className={`w-full px-2 py-1.5 rounded-lg border ${
                                isLight ? 'bg-white border-gray-300' : 'bg-[#12141C] border-slate-800/80 text-slate-100'
                              }`}
                            >
                              <option value="GOOD_RESTOCK">Good (Restock Sellable)</option>
                              <option value="DAMAGED_QUARANTINE">Damaged (Quarantine + Waste)</option>
                            </select>
                          </div>
                          <div className="sm:col-span-3">
                            <label className="text-[10px] text-gray-400 block">Reason</label>
                            <input
                              type="text"
                              placeholder="Optional note"
                              value={rowState.reason}
                              onChange={(e) =>
                                setEpodReturnMap((prev) => ({
                                  ...prev,
                                  [item.sku]: { ...rowState, reason: e.target.value },
                                }))
                              }
                              className={`w-full px-2 py-1.5 rounded-lg border ${
                                isLight ? 'bg-white border-gray-300' : 'bg-[#12141C] border-slate-800/80 text-slate-100'
                              }`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold mb-1">Handover Notes (Optional)</label>
                <input
                  type="text"
                  value={epodNotes}
                  onChange={(e) => setEpodNotes(e.target.value)}
                  placeholder="e.g. Received at loading dock #2, seal intact"
                  className={`w-full px-3 py-2 rounded-xl border ${
                    isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                  }`}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 dark:border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setEpodTargetSj(null)}
                  className="px-4 py-2 rounded-xl border border-gray-300 dark:border-slate-800/80 bg-white dark:bg-[#090A0F] text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEpod}
                  className="px-4 py-2 rounded-xl bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingEpod ? 'Submitting e-POD...' : 'Confirm & Seal e-POD'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
      </div>
    );

  return isStandalonePage ? (
    <div className="space-y-6">{content}</div>
  ) : (
    typeof document !== 'undefined'
      ? createPortal(
          <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:hidden">
            {content}
          </div>,
          document.body
        )
      : (
          <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:hidden">
            {content}
          </div>
        )
  );
};
