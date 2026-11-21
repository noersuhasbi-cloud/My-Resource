import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type {
  B2BWholesaleOrder,
  CommunicationDispatchLog,
  CrmAccount,
  CrmAccountType,
  CrmActivity,
  CrmDeal,
  CrmDealStage,
  CrmLoyaltyTier,
  CrmOverviewResponse,
  CrmPredictiveRestockAlert,
  CrmRfmSegment,
  EnterpriseQuotation,
  KanvasLedgerResponse,
  POSTransactionReceipt,
  StaffShiftSession,
  StoreOutletSchedule,
  WarungKasbonAccount,
  StandingOrderRecord,
  StandingOrderType,
  CustomerClaimRecord,
  CustomerClaimIssueCategory,
} from '../../types/index.ts';
import { apiClient } from '../../services/apiClient';
import { formatIDR } from '../../utils/formatters';
import { sanitizeIndonesianPhone, validateNpwpOrNik } from '../../utils/indonesianCompliance';
import {
  Award,
  Banknote,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Filter,
  HeartHandshake,
  Kanban,
  List,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Store,
  Ticket,
  TrendingUp,
  Truck,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { PromoVoucherRulesTab } from './PromoVoucherRulesTab';

interface CrmLoyaltyModuleProps {
  theme: 'light' | 'dark';
  selectedStore: string;
  storeOutlets: StoreOutletSchedule[];
  activeStaffSession: StaffShiftSession | null;
  onShowToast: (title: string, message: string) => void;
  onNavigateToQuotations?: () => void;
  onRefreshData?: () => void;
}

type CrmSubTab =
  | 'pipeline'
  | 'directory'
  | 'rfm_campaigns'
  | 'predictive_restock'
  | 'promo_rules'
  | 'kanvas_kasbon'
  | 'standing_orders';

const PIPELINE_STAGES: Array<{
  key: CrmDealStage;
  label: string;
  accent: string;
}> = [
  { key: 'NEW_LEAD', label: 'New Lead', accent: 'border-t-slate-400' },
  { key: 'COLD_CHAIN_TRIAL', label: 'Cold-Chain Sample', accent: 'border-t-sky-500' },
  { key: 'QUOTATION_SENT', label: 'Quotation Sent', accent: 'border-t-indigo-500' },
  { key: 'NEGOTIATION', label: 'Negotiation', accent: 'border-t-amber-500' },
  { key: 'WON', label: 'Won / Active', accent: 'border-t-emerald-500' },
];

const NEXT_STAGE_MAP: Partial<Record<CrmDealStage, CrmDealStage>> = {
  NEW_LEAD: 'COLD_CHAIN_TRIAL',
  COLD_CHAIN_TRIAL: 'QUOTATION_SENT',
  QUOTATION_SENT: 'NEGOTIATION',
  NEGOTIATION: 'WON',
};

const TIER_BADGE_MAP: Record<CrmLoyaltyTier, string> = {
  SILVER: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900/90 dark:text-slate-300 dark:border-slate-800/80',
  GOLD: 'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300',
  PLATINUM: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300',
};

const RFM_BADGE_MAP: Record<CrmRfmSegment, { label: string; badgeClass: string }> = {
  VIP_CHAMPION: {
    label: 'VIP Champion',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300',
  },
  LOYAL_REGULAR: {
    label: 'Loyal Regular',
    badgeClass: 'bg-sky-500/15 text-sky-700 border-sky-500/30 dark:text-sky-300',
  },
  NEW_SIGNUP: {
    label: 'New Signup',
    badgeClass: 'bg-indigo-500/15 text-indigo-700 border-indigo-500/30 dark:text-indigo-300',
  },
  AT_RISK_CHURN: {
    label: 'At-Risk Churn (>30d)',
    badgeClass: 'bg-rose-500/15 text-rose-700 border-rose-500/30 dark:text-rose-300',
  },
};

export const CrmLoyaltyModule: React.FC<CrmLoyaltyModuleProps> = ({
  theme,
  selectedStore,
  storeOutlets,
  activeStaffSession,
  onShowToast,
  onNavigateToQuotations,
  onRefreshData,
}) => {
  const isLight = theme === 'light';
  const cardClass = isLight
    ? 'bg-white border border-slate-200 rounded-2xl shadow-xs'
    : 'bg-[#12141C] border border-slate-800/80 rounded-2xl shadow-xs';
  const subCardClass = isLight
    ? 'bg-slate-50 border border-slate-200 rounded-xl'
    : 'bg-[#090A0F] border border-slate-800/80 rounded-xl';
  const inputClass = isLight
    ? 'bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500'
    : 'bg-[#090A0F] border border-slate-800/80 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500';
  const textTitle = isLight ? 'text-slate-900' : 'text-slate-100';
  const textMuted = isLight ? 'text-slate-500' : 'text-slate-400';

  const [subTab, setSubTab] = useState<CrmSubTab>('pipeline');
  const [pipelineViewMode, setPipelineViewMode] = useState<'kanban' | 'list'>('kanban');
  const [overview, setOverview] = useState<CrmOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);

  // Directory filters
  const [directoryFilter, setDirectoryFilter] = useState<'ALL' | CrmAccountType>('ALL');
  const [directorySearch, setDirectorySearch] = useState<string>('');

  // Customer 360 Profile Modal
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [profileHistory, setProfileHistory] = useState<{
    account: CrmAccount;
    posOrders: POSTransactionReceipt[];
    b2bOrders: B2BWholesaleOrder[];
    quotations: EnterpriseQuotation[];
    communications: CommunicationDispatchLog[];
    activities: CrmActivity[];
  } | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(false);
  const [editTier, setEditTier] = useState<CrmLoyaltyTier>('SILVER');
  const [editDiscountPct, setEditDiscountPct] = useState<number>(0);
  const [editCreditLimitIDR, setEditCreditLimitIDR] = useState<number>(0);
  const [editPhone, setEditPhone] = useState<string>('');
  const [editNpwp, setEditNpwp] = useState<string>('');
  const [newActivityType, setNewActivityType] = useState<CrmActivity['type']>('CALL');
  const [newActivitySubject, setNewActivitySubject] = useState<string>('');
  const [newActivityOutcome, setNewActivityOutcome] = useState<string>('');

  // New Account Modal
  const [isNewAccountOpen, setIsNewAccountOpen] = useState<boolean>(false);
  const [accForm, setAccForm] = useState<{
    accountType: CrmAccountType;
    name: string;
    companyName: string;
    phone: string;
    email: string;
    npwp: string;
    storeId: string;
    contractDiscountPct: number;
    creditLimitIDR: number;
    paymentTerms: 'CASH' | 'NET_7' | 'NET_14' | 'NET_30';
  }>({
    accountType: 'B2B_ACCOUNT',
    name: '',
    companyName: '',
    phone: '',
    email: '',
    npwp: '',
    storeId: selectedStore !== 'ALL' && selectedStore !== 'CONSOLIDATED' ? selectedStore : 'store-jkt-senopati',
    contractDiscountPct: 5,
    creditLimitIDR: 25000000,
    paymentTerms: 'NET_14',
  });

  // New Deal Modal
  const [isNewDealOpen, setIsNewDealOpen] = useState<boolean>(false);
  const [dealForm, setDealForm] = useState<{
    title: string;
    crmAccountId: string;
    estimatedMonthlyValueIDR: number;
    nextActivity: string;
    nextActivityDate: string;
  }>({
    title: '',
    crmAccountId: '',
    estimatedMonthlyValueIDR: 20000000,
    nextActivity: 'Cold-Chain Produce & Dairy Sample Delivery',
    nextActivityDate: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
  });

  // Campaign Dispatch Modal
  const [campaignModal, setCampaignModal] = useState<{
    open: boolean;
    channel: 'whatsapp' | 'email' | 'both';
    segment: CrmRfmSegment | 'ALL';
    accountIds?: string[];
    recipientLabel: string;
    campaignTitle: string;
    voucherCode: string;
    messageTemplate: string;
  }>({
    open: false,
    channel: 'whatsapp',
    segment: 'AT_RISK_CHURN',
    recipientLabel: 'At-Risk Churn (>30d)',
    campaignTitle: 'Win-Back Fresh Produce & HORECA Offer',
    voucherCode: 'GROCEVIP15',
    messageTemplate:
      'Halo {{name}}, member {{tier}} GroceMart! Nikmati promo spesial kode {{voucher}} untuk restock segar minggu ini. Poin Anda saat ini: {{points}} pts.',
  });
  const [lastWaMeUrl, setLastWaMeUrl] = useState<string | null>(null);

  // Sales Kanvas & Warung Kasbon State
  const [kanvasLedger, setKanvasLedger] = useState<KanvasLedgerResponse | null>(null);
  const [kanvasLoading, setKanvasLoading] = useState<boolean>(false);
  const [collectTarget, setCollectTarget] = useState<WarungKasbonAccount | null>(null);
  const [collectAmountIDR, setCollectAmountIDR] = useState<number>(0);
  const [isNewRouteOpen, setIsNewRouteOpen] = useState<boolean>(false);
  const [newRouteForm, setNewRouteForm] = useState({
    salesmanName: '',
    vehiclePlate: '',
    routeArea: '',
    outletCount: 10,
    dailyTargetIDR: 12000000,
  });
  const [isNewKasbonOpen, setIsNewKasbonOpen] = useState<boolean>(false);
  const [newKasbonForm, setNewKasbonForm] = useState({
    warungName: '',
    ownerName: '',
    phone: '',
    salesmanName: '',
    routeArea: '',
    creditLimitIDR: 5000000,
    outstandingBalanceIDR: 1500000,
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
  });

  const [standingOrders, setStandingOrders] = useState<StandingOrderRecord[]>([]);
  const [standingSummary, setStandingSummary] = useState<{
    totalCount: number;
    activeCount: number;
    dueCount: number;
    weeklyCount: number;
    seasonalPreOrderCount: number;
    totalDpLiabilityIDR: number;
  }>({
    totalCount: 0,
    activeCount: 0,
    dueCount: 0,
    weeklyCount: 0,
    seasonalPreOrderCount: 0,
    totalDpLiabilityIDR: 0,
  });
  const [isNewStandingOpen, setIsNewStandingOpen] = useState<boolean>(false);
  const [standingForm, setStandingForm] = useState({
    type: 'WEEKLY_SUBSCRIPTION' as StandingOrderType,
    title: '',
    customerName: '',
    customerPhone: '+62 812-',
    customerEmail: '',
    deliveryAddress: '',
    storeId: selectedStore !== 'CONSOLIDATED' ? selectedStore : 'store-jkt-senopati',
    scheduleDays: 'Monday, Thursday',
    targetFulfillmentDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    sku: 'SKU-PRD-001',
    quantity: 2,
    downPaymentIDR: 0,
    dpMethod: 'BANK_QRIS' as 'CASH' | 'BANK_QRIS',
    notes: '',
  });

  const [claimsList, setClaimsList] = useState<CustomerClaimRecord[]>([]);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState<boolean>(false);
  const [claimForm, setClaimForm] = useState({
    referenceId: 'RCP-SEN-882104',
    customerName: '',
    customerPhone: '+62 812-8899-1122',
    customerEmail: '',
    issueCategory: 'SPOILED_NEAR_EXPIRY' as CustomerClaimIssueCategory,
    compensationAmountIDR: 25000,
    dispatchChannel: 'whatsapp' as 'whatsapp' | 'email' | 'both',
    notes: '',
  });
  const [lastIssuedClaim, setLastIssuedClaim] = useState<{
    voucherCode: string;
    waMeUrl?: string;
    message: string;
  } | null>(null);

  const loadStandingOrders = async () => {
    try {
      const res = await apiClient.getStandingOrders(selectedStore);
      setStandingOrders(res.orders);
      setStandingSummary(res.summary);
    } catch {
      // Non-fatal
    }
  };

  const loadClaims = async () => {
    try {
      const res = await apiClient.getCrmClaims();
      setClaimsList(res.claims);
    } catch {
      // Non-fatal
    }
  };

  const loadKanvasLedger = async () => {
    setKanvasLoading(true);
    try {
      const data = await apiClient.getKanvasLedger();
      setKanvasLedger(data);
    } catch (err: any) {
      onShowToast('Kanvas Load Error', err?.message || 'Unable to load Sales Kanvas & Warung Kasbon ledger.');
    } finally {
      setKanvasLoading(false);
    }
  };

  const loadOverview = async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.getCrmOverview(selectedStore);
      setOverview(data);
    } catch (err: any) {
      onShowToast('CRM Load Error', err?.message || 'Unable to load CRM & Loyalty 360 data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
    loadKanvasLedger();
    loadStandingOrders();
    loadClaims();
  }, [selectedStore]);

  useEffect(() => {
    if (subTab === 'kanvas_kasbon') {
      loadKanvasLedger();
    } else if (subTab === 'standing_orders') {
      loadStandingOrders();
    }
  }, [subTab]);

  const handleCreateStandingOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!standingForm.customerName.trim() || !standingForm.customerPhone.trim()) {
      onShowToast('Form Incomplete', 'Nama dan nomor WhatsApp pelanggan wajib diisi.');
      return;
    }
    setBusyActionId('create-standing');
    try {
      const res = await apiClient.createStandingOrder({
        type: standingForm.type,
        title: standingForm.title.trim() || undefined,
        customerName: standingForm.customerName.trim(),
        customerPhone: standingForm.customerPhone.trim(),
        customerEmail: standingForm.customerEmail.trim() || undefined,
        deliveryAddress: standingForm.deliveryAddress.trim() || undefined,
        storeId: standingForm.storeId,
        scheduleDays:
          standingForm.type === 'WEEKLY_SUBSCRIPTION'
            ? standingForm.scheduleDays
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
        targetFulfillmentDate:
          standingForm.type === 'SEASONAL_PREORDER' ? standingForm.targetFulfillmentDate : undefined,
        items: [{ sku: standingForm.sku, quantity: Math.max(1, Number(standingForm.quantity) || 1) }],
        downPaymentIDR: standingForm.type === 'SEASONAL_PREORDER' ? Number(standingForm.downPaymentIDR) || 0 : 0,
        dpMethod: standingForm.dpMethod,
        notes: standingForm.notes.trim() || undefined,
      });
      onShowToast('Standing Order Saved', res.message);
      setIsNewStandingOpen(false);
      setStandingForm((p) => ({ ...p, title: '', customerName: '', downPaymentIDR: 0, notes: '' }));
      await loadStandingOrders();
    } catch (err: any) {
      onShowToast('Standing Order Error', err?.message || 'Unable to save standing order.');
    } finally {
      setBusyActionId(null);
    }
  };

  const handleTriggerDueStandingOrders = async (ids?: string[]) => {
    setBusyActionId(ids ? `trigger-${ids[0]}` : 'trigger-due-all');
    try {
      const res = await apiClient.triggerDueStandingOrders(ids);
      onShowToast('Standing Orders Converted', res.message);
      await loadStandingOrders();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      onShowToast('Trigger Failed', err?.message || 'Failed to convert standing orders to Fulfillment.');
    } finally {
      setBusyActionId(null);
    }
  };

  const handleSubmitInstantClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimForm.referenceId.trim()) {
      onShowToast('Reference Missing', 'Masukkan No. Struk POS atau Order ID.');
      return;
    }
    setBusyActionId('submit-claim');
    setLastIssuedClaim(null);
    try {
      const res = await apiClient.createCrmClaim({
        referenceId: claimForm.referenceId.trim(),
        customerName: claimForm.customerName.trim() || undefined,
        customerPhone: claimForm.customerPhone.trim() || undefined,
        customerEmail: claimForm.customerEmail.trim() || undefined,
        issueCategory: claimForm.issueCategory,
        compensationAmountIDR: Math.max(1000, Number(claimForm.compensationAmountIDR) || 25000),
        dispatchChannel: claimForm.dispatchChannel,
        notes: claimForm.notes.trim() || undefined,
      });
      setLastIssuedClaim({
        voucherCode: res.claim.voucherCode,
        waMeUrl: res.waMeUrl,
        message: res.message,
      });
      onShowToast('e-Voucher Kompensasi Aktif', res.message);
      await loadClaims();
    } catch (err: any) {
      onShowToast('Claim Error', err?.message || 'Unable to create instant claim voucher.');
    } finally {
      setBusyActionId(null);
    }
  };

  const handleCreateKanvasRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRouteForm.salesmanName.trim() || !newRouteForm.vehiclePlate.trim() || !newRouteForm.routeArea.trim()) {
      onShowToast('Form Incomplete', 'Salesman name, vehicle plate, and route area are required.');
      return;
    }
    setBusyActionId('kanvas-create-route');
    try {
      await apiClient.postKanvasLedgerAction({
        action: 'CREATE_ROUTE',
        salesmanName: newRouteForm.salesmanName.trim(),
        vehiclePlate: newRouteForm.vehiclePlate.trim().toUpperCase(),
        routeArea: newRouteForm.routeArea.trim(),
        outletCount: Number(newRouteForm.outletCount) || 1,
        dailyTargetIDR: Number(newRouteForm.dailyTargetIDR) || 0,
      });
      onShowToast('Rute Kanvas Ditambahkan', `Rute ${newRouteForm.routeArea} (${newRouteForm.salesmanName}) aktif.`);
      setIsNewRouteOpen(false);
      setNewRouteForm({ salesmanName: '', vehiclePlate: '', routeArea: '', outletCount: 10, dailyTargetIDR: 12000000 });
      await loadKanvasLedger();
    } catch (err: any) {
      onShowToast('Kanvas Route Error', err?.message || 'Failed to add route.');
    } finally {
      setBusyActionId(null);
    }
  };

  const handleCreateKasbon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKasbonForm.warungName.trim() || !newKasbonForm.ownerName.trim()) {
      onShowToast('Form Incomplete', 'Nama warung dan pemilik wajib diisi.');
      return;
    }
    setBusyActionId('kanvas-create-kasbon');
    try {
      const fallbackRoute = kanvasLedger?.routes[0];
      await apiClient.postKanvasLedgerAction({
        action: 'CREATE_KASBON',
        warungName: newKasbonForm.warungName.trim(),
        ownerName: newKasbonForm.ownerName.trim(),
        phone: newKasbonForm.phone.trim() || '+628120000000',
        salesmanName: newKasbonForm.salesmanName.trim() || fallbackRoute?.salesmanName || 'Hendra Kurniawan',
        routeArea: newKasbonForm.routeArea.trim() || fallbackRoute?.routeArea || 'Pasar Minggu – Kemang – Cipete',
        creditLimitIDR: Number(newKasbonForm.creditLimitIDR) || 5000000,
        outstandingBalanceIDR: Number(newKasbonForm.outstandingBalanceIDR) || 0,
        dueDate: newKasbonForm.dueDate,
      });
      onShowToast('Kasbon Warung Tercatat', `Akun kasbon ${newKasbonForm.warungName} berhasil disimpan.`);
      setIsNewKasbonOpen(false);
      setNewKasbonForm({
        warungName: '',
        ownerName: '',
        phone: '',
        salesmanName: '',
        routeArea: '',
        creditLimitIDR: 5000000,
        outstandingBalanceIDR: 1500000,
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      });
      await loadKanvasLedger();
    } catch (err: any) {
      onShowToast('Kasbon Error', err?.message || 'Failed to create warung kasbon.');
    } finally {
      setBusyActionId(null);
    }
  };

  const handleCollectKasbonPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectTarget || collectAmountIDR <= 0) return;
    setBusyActionId(`collect-${collectTarget.id}`);
    try {
      const res = await apiClient.postKanvasLedgerAction({
        action: 'COLLECT_PAYMENT',
        accountId: collectTarget.id,
        amountIDR: Math.round(collectAmountIDR),
      });
      const recordedAmt = Number(res.effectivePaidIDR ?? Math.min(Math.round(collectAmountIDR), collectTarget.outstandingBalanceIDR));
      onShowToast(
        'Pelunasan Kasbon Tercatat',
        `${collectTarget.warungName}: ${formatIDR(recordedAmt)} dibukukan ke Kas (#1010) & Piutang (#1200).`
      );
      if (res.ledger) {
        setKanvasLedger(res.ledger);
      } else {
        await loadKanvasLedger();
      }
      setCollectTarget(null);
      setCollectAmountIDR(0);
      onRefreshData?.();
    } catch (err: any) {
      onShowToast('Collect Payment Error', err?.message || 'Gagal mencatat pelunasan kasbon.');
    } finally {
      setBusyActionId(null);
    }
  };

  const handleSendKasbonWaReminder = async (acc: WarungKasbonAccount) => {
    setBusyActionId(`wa-kasbon-${acc.id}`);
    try {
      const res = await apiClient.sendDocumentCommunication({
        channel: 'whatsapp',
        docType: 'KASBON_BILLING',
        docId: acc.id,
        recipientName: acc.ownerName,
        recipientPhone: acc.phone,
        customNote: `Tagihan Kasbon ${acc.warungName} (${acc.id}) sebesar ${formatIDR(acc.outstandingBalanceIDR)}, jatuh tempo ${acc.dueDate}. Salesman: ${acc.salesmanName} (${acc.routeArea}).`,
      });
      await apiClient.postKanvasLedgerAction({
        action: 'MARK_REMINDER_SENT',
        accountId: acc.id,
      });
      await loadKanvasLedger();
      onShowToast(
        'Tagihan WA Terkirim',
        `Reminder kasbon untuk ${acc.warungName} (${acc.phone}) tercatat di Audit Log.${res.waMeUrl ? ' Link WhatsApp siap.' : ''}`
      );
    } catch (err: any) {
      onShowToast('WhatsApp Dispatch Error', err?.message || 'Gagal mengirim tagihan kasbon via WhatsApp.');
    } finally {
      setBusyActionId(null);
    }
  };

  const openAccountProfile = async (accId: string) => {
    setSelectedProfileId(accId);
    setIsLoadingProfile(true);
    try {
      const res = await apiClient.getCrmAccountHistory(accId);
      setProfileHistory(res);
      setEditTier(res.account.tier);
      setEditDiscountPct(res.account.contractDiscountPct);
      setEditCreditLimitIDR(res.account.creditLimitIDR);
      setEditPhone(res.account.phone || '');
      setEditNpwp(res.account.npwp || '');
    } catch (err: any) {
      onShowToast('Profile Error', err?.message || 'Unable to load Customer 360° profile.');
      setSelectedProfileId(null);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handleMoveDealStage = async (deal: CrmDeal, nextStage: CrmDealStage) => {
    setBusyActionId(deal.id);
    try {
      const res = await apiClient.updateCrmDealStage(deal.id, nextStage);
      onShowToast(nextStage === 'WON' ? 'Deal Won & Onboarded' : 'Pipeline Updated', res.message);
      await loadOverview();
      onRefreshData?.();
    } catch (err: any) {
      onShowToast('Stage Update Failed', err?.message || 'Could not update deal stage.');
    } finally {
      setBusyActionId(null);
    }
  };

  const handleConvertDealToQuotation = async (deal: CrmDeal) => {
    setBusyActionId(`quo-${deal.id}`);
    try {
      const res = await apiClient.convertCrmDealToQuotation(deal.id);
      onShowToast('Quotation Created', res.message);
      await loadOverview();
      onRefreshData?.();
    } catch (err: any) {
      onShowToast('Quotation Conversion Failed', err?.message || 'Could not generate quotation.');
    } finally {
      setBusyActionId(null);
    }
  };

  const handleSaveProfileTerms = async () => {
    if (!profileHistory) return;
    const normalizedPhone = editPhone.trim() ? sanitizeIndonesianPhone(editPhone) : undefined;
    const trimmedNpwp = editNpwp.trim();
    if (trimmedNpwp) {
      const tinCheck = validateNpwpOrNik(trimmedNpwp);
      if (!tinCheck.valid) {
        onShowToast('Invalid NPWP / NIK', tinCheck.error || 'NPWP/NIK must be 15 or 16 numeric digits for Coretax.');
        return;
      }
    }
    setBusyActionId(`save-prof-${profileHistory.account.id}`);
    try {
      const res = await apiClient.updateCrmAccount(profileHistory.account.id, {
        tier: editTier,
        contractDiscountPct: editDiscountPct,
        creditLimitIDR: editCreditLimitIDR,
        ...(normalizedPhone ? { phone: normalizedPhone } : {}),
        npwp: trimmedNpwp ? validateNpwpOrNik(trimmedNpwp).cleanDigits : '',
      });
      onShowToast('Customer Updated', res.message);
      await openAccountProfile(profileHistory.account.id);
      await loadOverview();
    } catch (err: any) {
      onShowToast('Update Failed', err?.message || 'Failed to update account terms.');
    } finally {
      setBusyActionId(null);
    }
  };

  const handleLogActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileHistory || !newActivitySubject.trim()) return;
    setBusyActionId('log-act');
    try {
      await apiClient.createCrmActivity({
        crmAccountId: profileHistory.account.id,
        type: newActivityType,
        subject: newActivitySubject.trim(),
        outcome: newActivityOutcome.trim() || 'Completed by CRM team',
      });
      setNewActivitySubject('');
      setNewActivityOutcome('');
      onShowToast('Activity Logged', 'Interaction added to Customer 360° timeline.');
      await openAccountProfile(profileHistory.account.id);
      await loadOverview();
    } catch (err: any) {
      onShowToast('Activity Error', err?.message || 'Could not log activity.');
    } finally {
      setBusyActionId(null);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const sanitizedPhone = sanitizeIndonesianPhone(accForm.phone);
    if (!accForm.name.trim() || !sanitizedPhone) {
      onShowToast('Missing Fields', 'Contact name and WhatsApp/phone number are required.');
      return;
    }
    const trimmedNpwp = accForm.npwp.trim();
    let cleanNpwp: string | undefined;
    if (trimmedNpwp) {
      const tinCheck = validateNpwpOrNik(trimmedNpwp);
      if (!tinCheck.valid) {
        onShowToast('Invalid NPWP / NIK', tinCheck.error || 'NPWP/NIK must be 15 or 16 numeric digits for Coretax.');
        return;
      }
      cleanNpwp = tinCheck.cleanDigits;
    }
    setBusyActionId('create-acc');
    try {
      const res = await apiClient.createCrmAccount({
        accountType: accForm.accountType,
        name: accForm.name.trim(),
        companyName: accForm.accountType === 'B2B_ACCOUNT' ? accForm.companyName.trim() : undefined,
        storeId: accForm.storeId,
        phone: sanitizedPhone,
        email: accForm.email.trim() || undefined,
        npwp: cleanNpwp,
        contractDiscountPct: accForm.contractDiscountPct,
        creditLimitIDR: accForm.accountType === 'B2B_ACCOUNT' ? accForm.creditLimitIDR : 0,
        paymentTerms: accForm.accountType === 'B2B_ACCOUNT' ? accForm.paymentTerms : 'CASH',
      });
      onShowToast('Account Onboarded', res.message);
      setIsNewAccountOpen(false);
      setAccForm((prev) => ({ ...prev, name: '', companyName: '', phone: '', email: '', npwp: '' }));
      await loadOverview();
    } catch (err: any) {
      onShowToast('Onboarding Failed', err?.message || 'Could not create CRM account.');
    } finally {
      setBusyActionId(null);
    }
  };

  const handleCreateDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealForm.title.trim()) {
      onShowToast('Missing Title', 'Enter a deal title for the B2B pipeline.');
      return;
    }
    setBusyActionId('create-deal');
    try {
      const selectedAcc = overview?.accounts.find((a) => a.id === dealForm.crmAccountId);
      const res = await apiClient.createCrmDeal({
        title: dealForm.title.trim(),
        crmAccountId: selectedAcc?.id || overview?.accounts[0]?.id,
        companyName: selectedAcc?.companyName || selectedAcc?.name,
        contactName: selectedAcc?.name,
        contactPhone: selectedAcc?.phone,
        contactEmail: selectedAcc?.email,
        storeId: selectedAcc?.storeId || (selectedStore !== 'CONSOLIDATED' ? selectedStore : 'store-jkt-senopati'),
        estimatedMonthlyValueIDR: dealForm.estimatedMonthlyValueIDR,
        nextActivity: dealForm.nextActivity,
        nextActivityDate: dealForm.nextActivityDate,
      });
      onShowToast('Deal Added', res.message);
      setIsNewDealOpen(false);
      setDealForm((prev) => ({ ...prev, title: '' }));
      await loadOverview();
    } catch (err: any) {
      onShowToast('Create Deal Failed', err?.message || 'Unable to create B2B deal.');
    } finally {
      setBusyActionId(null);
    }
  };

  const handleDispatchCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyActionId('dispatch-cmp');
    setLastWaMeUrl(null);
    try {
      const res = await apiClient.dispatchCrmCampaign({
        channel: campaignModal.channel,
        segment: campaignModal.accountIds ? undefined : campaignModal.segment,
        accountIds: campaignModal.accountIds,
        campaignTitle: campaignModal.campaignTitle,
        messageTemplate: campaignModal.messageTemplate,
        voucherCode: campaignModal.voucherCode,
      });
      if (res.waMeUrl) setLastWaMeUrl(res.waMeUrl);
      onShowToast('Campaign Dispatched', res.message);
      await loadOverview();
    } catch (err: any) {
      onShowToast('Campaign Dispatch Failed', err?.message || 'Could not dispatch campaign.');
    } finally {
      setBusyActionId(null);
    }
  };

  const handleQuickRestockOffer = async (alert: CrmPredictiveRestockAlert, channel: 'whatsapp' | 'email') => {
    setBusyActionId(`restock-${alert.crmAccountId}`);
    try {
      const res = await apiClient.dispatchCrmCampaign({
        channel,
        accountIds: [alert.crmAccountId],
        campaignTitle: `Predictive Restock Reminder (${alert.companyName || alert.accountName})`,
        messageTemplate: alert.suggestedOfferMessage,
        voucherCode: 'RESTOCK5',
      });
      onShowToast('Restock Offer Sent', res.message);
      await loadOverview();
    } catch (err: any) {
      onShowToast('Offer Dispatch Failed', err?.message || 'Unable to send restock offer.');
    } finally {
      setBusyActionId(null);
    }
  };

  const filteredAccounts = useMemo(() => {
    const list = overview?.accounts || [];
    const q = directorySearch.trim().toLowerCase();
    return list.filter((acc) => {
      if (directoryFilter !== 'ALL' && acc.accountType !== directoryFilter) return false;
      if (!q) return true;
      return (
        acc.name.toLowerCase().includes(q) ||
        (acc.companyName || '').toLowerCase().includes(q) ||
        acc.phone.toLowerCase().includes(q) ||
        acc.email.toLowerCase().includes(q) ||
        acc.id.toLowerCase().includes(q)
      );
    });
  }, [overview?.accounts, directoryFilter, directorySearch]);

  const kpis = overview?.kpis;

  return (
    <div className="space-y-5 font-sans">
      {/* Header Bar */}
      <div className={`${cardClass} gm-hero-banner p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4`}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <HeartHandshake className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className={`text-base sm:text-lg font-extrabold tracking-tight ${textTitle}`}>
                CRM, Loyalty &amp; Customer 360°
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                GroceMatrix™ Pipeline &amp; Customer 360°
              </span>
            </div>
            <p className={`text-xs mt-0.5 ${textMuted}`}>
              Manage B2B HORECA leads, loyalty tier accrual (1 pt / Rp 10.000), RFM churn win-back campaigns, and predictive restock alerts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => loadOverview()}
            className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
              isLight
                ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                : 'bg-slate-900/90 border-slate-800/80 text-slate-200 hover:bg-slate-800'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => setIsNewAccountOpen(true)}
            className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
              isLight
                ? 'bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200'
                : 'bg-slate-900/90 border-slate-800/80 text-slate-100 hover:bg-slate-800'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Account</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setLastIssuedClaim(null);
              setIsClaimModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer transition-all"
          >
            <Ticket className="w-3.5 h-3.5" />
            <span>Quick Customer Claim / e-Voucher</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (!dealForm.crmAccountId && overview?.accounts?.length) {
                setDealForm((p) => ({ ...p, crmAccountId: overview.accounts[0].id }));
              }
              setIsNewDealOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New B2B Deal</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <div className={`${cardClass} p-4`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${textMuted}`}>
              Active Members &amp; B2B
            </span>
            <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className={`text-2xl font-extrabold font-mono mt-1.5 ${textTitle}`}>
            {kpis?.totalActiveMembers ?? 0}
          </p>
          <p className={`text-[11px] mt-1 ${textMuted}`}>
            {kpis?.b2cMembersCount ?? 0} B2C Retail · {kpis?.b2bAccountsCount ?? 0} B2B Key Accounts
          </p>
        </div>

        <div className={`${cardClass} p-4`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${textMuted}`}>
              Open B2B Pipeline (Monthly)
            </span>
            <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <p className={`text-2xl font-extrabold font-mono mt-1.5 text-indigo-600 dark:text-indigo-400`}>
            {formatIDR(kpis?.b2bPipelineValueIDR ?? 0)}
          </p>
          <p className={`text-[11px] mt-1 ${textMuted}`}>
            Weighted forecast: {formatIDR(kpis?.weightedPipelineValueIDR ?? 0)} / mo
          </p>
        </div>

        <div className={`${cardClass} p-4`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${textMuted}`}>
              At-Risk Churn (&gt;30 Days)
            </span>
            <Clock className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <p className="text-2xl font-extrabold font-mono mt-1.5 text-rose-600 dark:text-rose-400">
            {kpis?.atRiskChurnCount ?? 0} Accounts
          </p>
          <p className={`text-[11px] mt-1 ${textMuted}`}>
            Eligible for automated WhatsApp / Email win-back
          </p>
        </div>

        <div className={`${cardClass} p-4`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${textMuted}`}>
              Loyalty Points Liability
            </span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <p className={`text-2xl font-extrabold font-mono mt-1.5 text-amber-600 dark:text-amber-400`}>
            {(kpis?.loyaltyPointsLiabilityCount ?? 0).toLocaleString('id-ID')} pts
          </p>
          <p className={`text-[11px] mt-1 ${textMuted}`}>
            Redeemable value: {formatIDR(kpis?.loyaltyPointsLiabilityIDR ?? 0)} (1 pt = Rp 100)
          </p>
        </div>
      </div>

      {/* 4 Sub-Tabs Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {(
          [
            { id: 'pipeline', label: 'B2B Deal Pipeline', icon: Kanban, badge: overview?.deals.length },
            { id: 'directory', label: 'Customer 360° Directory', icon: Users, badge: overview?.accounts.length },
            { id: 'rfm_campaigns', label: 'RFM & Omnichannel Campaigns', icon: Send },
            {
              id: 'predictive_restock',
              label: 'Predictive Restock Radar',
              icon: Sparkles,
              badge: overview?.predictiveRestocks.length,
            },
            {
              id: 'promo_rules',
              label: 'Promo & Voucher Rules',
              icon: Ticket,
            },
            {
              id: 'kanvas_kasbon',
              label: 'Sales Kanvas & Kasbon',
              icon: Truck,
              badge: kanvasLedger?.summary.overdueKasbonCount || undefined,
            },
            {
              id: 'standing_orders',
              label: 'Standing Orders & Pre-Order',
              icon: Calendar,
              badge: standingSummary.dueCount || undefined,
            },
          ] as Array<{ id: CrmSubTab; label: string; icon: any; badge?: number }>
        ).map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border whitespace-nowrap shrink-0 cursor-pointer transition-all ${
                active
                  ? 'bg-[#0F4C3A] text-white border-[#0F4C3A] shadow-sm'
                  : isLight
                  ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  : 'bg-[#12141C] border-slate-800/80 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    active ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-900/90 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div key={subTab} className="gm-tab-enter">
      {/* ============================================================ */}
      {/* SUB-TAB 1: B2B DEAL PIPELINE (GROCEMATRIX™ KANBAN + LIST)     */}
      {/* ============================================================ */}
      {subTab === 'pipeline' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className={`text-xs ${textMuted}`}>
              Track HORECA &amp; corporate prospects from Lead &rarr; Cold-Chain Sample &rarr; Quotation &rarr; Won (auto-activates B2B credit &amp; tier).
            </p>
            <div className={`inline-flex rounded-xl p-1 border ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#12141C] border-slate-800/80'}`}>
              <button
                type="button"
                onClick={() => setPipelineViewMode('kanban')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer ${
                  pipelineViewMode === 'kanban'
                    ? 'bg-white dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 shadow-xs'
                    : textMuted
                }`}
              >
                <Kanban className="w-3.5 h-3.5" />
                <span>Kanban</span>
              </button>
              <button
                type="button"
                onClick={() => setPipelineViewMode('list')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer ${
                  pipelineViewMode === 'list'
                    ? 'bg-white dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 shadow-xs'
                    : textMuted
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>List</span>
              </button>
            </div>
          </div>

          {pipelineViewMode === 'kanban' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
              {PIPELINE_STAGES.map((stageDef) => {
                const stageDeals = (overview?.deals || []).filter((d) => d.stage === stageDef.key);
                const stageSum = stageDeals.reduce((s, d) => s + d.estimatedMonthlyValueIDR, 0);
                return (
                  <div key={stageDef.key} className={`${cardClass} border-t-4 ${stageDef.accent} p-3 flex flex-col gap-2.5`}>
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
                      <div>
                        <h3 className={`text-xs font-extrabold ${textTitle}`}>{stageDef.label}</h3>
                        <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                          {formatIDR(stageSum)}/mo
                        </p>
                      </div>
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300">
                        {stageDeals.length}
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {stageDeals.length === 0 ? (
                        <div className="py-6 text-center text-[11px] text-slate-500 dark:text-slate-400">No deals in stage</div>
                      ) : (
                        stageDeals.map((deal) => {
                          const nextStage = NEXT_STAGE_MAP[deal.stage];
                          return (
                            <div key={deal.id} className={`${subCardClass} p-3 space-y-2`}>
                              <div className="flex items-start justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() => openAccountProfile(deal.crmAccountId)}
                                  className="text-left cursor-pointer group"
                                >
                                  <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 block">{deal.id}</span>
                                  <span className={`text-xs font-extrabold group-hover:text-emerald-600 dark:group-hover:text-emerald-400 ${textTitle}`}>
                                    {deal.title}
                                  </span>
                                </button>
                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 shrink-0">
                                  {deal.probabilityPct}%
                                </span>
                              </div>

                              <div className="text-[11px] space-y-0.5">
                                <p className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                                  {deal.companyName}
                                </p>
                                <p className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                  {formatIDR(deal.estimatedMonthlyValueIDR)} / mo
                                </p>
                                <p className={`text-[10px] ${textMuted} flex items-center gap-1 truncate`}>
                                  <Calendar className="w-3 h-3 shrink-0" />
                                  <span>{deal.nextActivity}</span>
                                </p>
                              </div>

                              {deal.linkedQuotationId && (
                                <button
                                  type="button"
                                  onClick={() => onNavigateToQuotations?.()}
                                  className="w-full text-[10px] font-mono font-bold px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 flex items-center justify-between cursor-pointer hover:bg-indigo-500/20"
                                >
                                  <span>Linked: {deal.linkedQuotationId}</span>
                                  <ChevronRight className="w-3 h-3" />
                                </button>
                              )}

                              <div className="pt-1 flex flex-wrap items-center gap-1.5">
                                {nextStage && (
                                  <button
                                    type="button"
                                    disabled={busyActionId === deal.id}
                                    onClick={() => handleMoveDealStage(deal, nextStage)}
                                    className="flex-1 px-2 py-1 rounded-lg bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-[10px] font-bold cursor-pointer disabled:opacity-50"
                                  >
                                    {nextStage === 'WON' ? 'Mark WON' : `Next: ${nextStage.replace(/_/g, ' ')}`}
                                  </button>
                                )}
                                {!deal.linkedQuotationId && deal.stage !== 'WON' && deal.stage !== 'LOST' && (
                                  <button
                                    type="button"
                                    disabled={busyActionId === `quo-${deal.id}`}
                                    onClick={() => handleConvertDealToQuotation(deal)}
                                    className="px-2 py-1 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold cursor-pointer hover:bg-indigo-500/20"
                                    title="Generate Enterprise Quotation"
                                  >
                                    + Quote
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCampaignModal({
                                      open: true,
                                      channel: 'whatsapp',
                                      segment: 'ALL',
                                      accountIds: [deal.crmAccountId],
                                      recipientLabel: deal.companyName,
                                      campaignTitle: `B2B Follow-Up: ${deal.title}`,
                                      voucherCode: 'HORECAVIP',
                                      messageTemplate: `Halo {{name}}, menindaklanjuti proposal ${deal.title} dari GroceMart. Apakah kami bisa menjadwalkan pengiriman sample cold-chain?`,
                                    })
                                  }
                                  className="p-1 rounded-lg border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                                  title="Send WhatsApp / Email Follow-up"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={`${cardClass} overflow-x-auto`}>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className={`border-b ${isLight ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-[#090A0F] border-slate-800/80 text-slate-400'}`}>
                    <th className="py-3 px-4 font-bold">Deal &amp; Company</th>
                    <th className="py-3 px-4 font-bold">Branch</th>
                    <th className="py-3 px-4 font-bold">Stage</th>
                    <th className="py-3 px-4 font-bold">Est. Monthly Value</th>
                    <th className="py-3 px-4 font-bold">Next Activity</th>
                    <th className="py-3 px-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-slate-800/80'}`}>
                  {(overview?.deals || []).map((deal) => {
                    const nextStage = NEXT_STAGE_MAP[deal.stage];
                    return (
                      <tr key={deal.id} className={isLight ? 'hover:bg-slate-50/70' : 'hover:bg-slate-900/60'}>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => openAccountProfile(deal.crmAccountId)}
                            className="text-left cursor-pointer hover:underline"
                          >
                            <p className={`font-bold ${textTitle}`}>{deal.title}</p>
                            <p className={`text-[11px] ${textMuted}`}>{deal.companyName} · {deal.contactName}</p>
                          </button>
                        </td>
                        <td className={`py-3 px-4 ${textMuted}`}>{deal.storeName}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                            {deal.stage} ({deal.probabilityPct}%)
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                          {formatIDR(deal.estimatedMonthlyValueIDR)}
                        </td>
                        <td className={`py-3 px-4 text-[11px] ${textMuted}`}>
                          {deal.nextActivity} ({deal.nextActivityDate})
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                          {!deal.linkedQuotationId && deal.stage !== 'WON' && (
                            <button
                              type="button"
                              onClick={() => handleConvertDealToQuotation(deal)}
                              className="px-2.5 py-1 rounded-lg border border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold cursor-pointer hover:bg-indigo-500/10"
                            >
                              Convert to Quotation
                            </button>
                          )}
                          {nextStage && (
                            <button
                              type="button"
                              onClick={() => handleMoveDealStage(deal, nextStage)}
                              className="px-2.5 py-1 rounded-lg bg-[#0F4C3A] text-white text-[11px] font-bold cursor-pointer hover:bg-[#0b382b]"
                            >
                              {nextStage === 'WON' ? 'Mark WON' : 'Move Next Stage'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* SUB-TAB 2: CUSTOMER 360 DIRECTORY                            */}
      {/* ============================================================ */}
      {subTab === 'directory' && (
        <div className={`${cardClass} p-4 space-y-4`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                [
                  { id: 'ALL', label: 'All Accounts' },
                  { id: 'B2C_MEMBER', label: 'B2C Retail Members' },
                  { id: 'B2B_ACCOUNT', label: 'B2B Key Accounts' },
                ] as Array<{ id: 'ALL' | CrmAccountType; label: string }>
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setDirectoryFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition-colors ${
                    directoryFilter === f.id
                      ? 'bg-[#0F4C3A] text-white border-[#0F4C3A]'
                      : isLight
                      ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      : 'bg-slate-900/90 border-slate-800/80 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={directorySearch}
                onChange={(e) => setDirectorySearch(e.target.value)}
                placeholder="Search name, company, WhatsApp, email..."
                className={`w-full pl-8 pr-3 py-1.5 rounded-xl text-xs ${inputClass}`}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className={`border-b ${isLight ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-[#090A0F] border-slate-800/80 text-slate-400'}`}>
                  <th className="py-3 px-3 font-bold">Customer / Company</th>
                  <th className="py-3 px-3 font-bold">Type &amp; Branch</th>
                  <th className="py-3 px-3 font-bold">Tier &amp; RFM</th>
                  <th className="py-3 px-3 font-bold text-right">Points Balance</th>
                  <th className="py-3 px-3 font-bold text-right">Lifetime Spend</th>
                  <th className="py-3 px-3 font-bold text-right">Action</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-slate-800/80'}`}>
                {filteredAccounts.map((acc) => {
                  const rfm = RFM_BADGE_MAP[acc.rfmSegment];
                  return (
                    <tr key={acc.id} className={isLight ? 'hover:bg-slate-50/80' : 'hover:bg-slate-900/60'}>
                      <td className="py-3 px-3">
                        <p className={`font-bold ${textTitle}`}>{acc.companyName || acc.name}</p>
                        <p className={`text-[11px] ${textMuted}`}>
                          {acc.companyName ? `${acc.name} · ` : ''}
                          {acc.phone} · {acc.email}
                        </p>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300">
                          {acc.accountType === 'B2B_ACCOUNT' ? 'B2B Key Account' : 'B2C Member'}
                        </span>
                        <p className={`text-[10px] mt-0.5 ${textMuted}`}>{acc.storeName}</p>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${TIER_BADGE_MAP[acc.tier]}`}>
                            {acc.tier}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${rfm.badgeClass}`}>
                            {rfm.label}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                        {acc.pointsBalance.toLocaleString('id-ID')} pts
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                        {formatIDR(acc.lifetimeSpendIDR)}
                        <span className={`block text-[10px] font-sans font-normal ${textMuted}`}>
                          {acc.orderCount} orders · every {acc.avgOrderCadenceDays}d
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openAccountProfile(acc.id)}
                          className="px-3 py-1.5 rounded-xl bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-[11px] font-bold cursor-pointer"
                        >
                          360° Profile
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SUB-TAB 3: RFM SEGMENTATION & OMNICHANNEL CAMPAIGNS          */}
      {/* ============================================================ */}
      {subTab === 'rfm_campaigns' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(overview?.segmentBreakdown || []).map((seg) => {
              const style = RFM_BADGE_MAP[seg.segment];
              return (
                <div key={seg.segment} className={`${cardClass} p-4 flex flex-col justify-between gap-3`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${style.badgeClass}`}>
                        {seg.label}
                      </span>
                      <p className={`text-xs mt-1.5 ${textMuted}`}>{seg.description}</p>
                    </div>
                    <span className={`text-2xl font-extrabold font-mono ${textTitle}`}>{seg.count}</span>
                  </div>

                  <div className={`${subCardClass} p-3 grid grid-cols-2 gap-2 text-xs`}>
                    <div>
                      <span className={`text-[10px] block ${textMuted}`}>Segment Lifetime Spend</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatIDR(seg.totalLifetimeSpendIDR)}
                      </span>
                    </div>
                    <div>
                      <span className={`text-[10px] block ${textMuted}`}>Avg Order Value</span>
                      <span className={`font-mono font-bold ${textTitle}`}>{formatIDR(seg.avgOrderValueIDR)}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={seg.count === 0}
                    onClick={() =>
                      setCampaignModal({
                        open: true,
                        channel: 'both',
                        segment: seg.segment,
                        accountIds: undefined,
                        recipientLabel: `${seg.label} (${seg.count} accounts)`,
                        campaignTitle:
                          seg.segment === 'AT_RISK_CHURN'
                            ? 'Win-Back Fresh Produce & Coffee Voucher'
                            : `Exclusive ${seg.label} GroceMart Privilege`,
                        voucherCode: seg.segment === 'AT_RISK_CHURN' ? 'COMEBACK15' : 'VIPFRESH10',
                        messageTemplate:
                          'Halo {{name}}, member {{tier}} GroceMart! Gunakan kode promo {{voucher}} untuk pesanan berikutnya. Saldo poin loyalitas Anda: {{points}} pts.',
                      })
                    }
                    className="w-full py-2 rounded-xl bg-[#0F4C3A] hover:bg-[#0b382b] disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Launch WhatsApp / Email Campaign</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SUB-TAB 4: PREDICTIVE RESTOCK & CROSS-SELL RADAR             */}
      {/* ============================================================ */}
      {subTab === 'predictive_restock' && (
        <div className="space-y-3">
          <div className={`${cardClass} p-4 flex items-center justify-between gap-3 flex-wrap`}>
            <div>
              <h3 className={`text-sm font-extrabold ${textTitle}`}>Predictive Cadence Replenishment Radar</h3>
              <p className={`text-xs ${textMuted}`}>
                Automatically flags HORECA &amp; regular retail accounts approaching or past their historical reorder cycle.
              </p>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25">
              {(overview?.predictiveRestocks || []).length} Actionable Alerts
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            {(overview?.predictiveRestocks || []).map((alert) => (
              <div key={alert.crmAccountId} className={`${cardClass} p-4 space-y-3`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => openAccountProfile(alert.crmAccountId)}
                        className={`text-sm font-extrabold hover:underline cursor-pointer ${textTitle}`}
                      >
                        {alert.companyName || alert.accountName}
                      </button>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          alert.urgency === 'OVERDUE'
                            ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                            : alert.urgency === 'DUE_TODAY'
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                            : 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30'
                        }`}
                      >
                        {alert.urgency === 'OVERDUE'
                          ? `OVERDUE +${alert.overdueDays}d`
                          : alert.urgency === 'DUE_TODAY'
                          ? 'DUE TODAY'
                          : 'UPCOMING'}
                      </span>
                    </div>
                    <p className={`text-[11px] mt-0.5 ${textMuted}`}>
                      {alert.storeName} · Cadence every {alert.avgCadenceDays}d · Last order {alert.daysSinceLastOrder}d ago
                    </p>
                  </div>
                </div>

                <div className={`${subCardClass} p-3 space-y-1.5`}>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${textMuted}`}>
                    Top Recurring SKUs to Replenish
                  </span>
                  {alert.topSkus.map((sku) => (
                    <div key={sku.sku} className="flex items-center justify-between text-xs">
                      <span className={textTitle}>
                        <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 mr-1.5">{sku.sku}</span>
                        {sku.name}
                      </span>
                      <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                        {sku.suggestedQty} {sku.unit} · {formatIDR(sku.unitPriceIDR)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busyActionId === `restock-${alert.crmAccountId}`}
                    onClick={() => handleQuickRestockOffer(alert, 'whatsapp')}
                    className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Send Restock Offer (WA)</span>
                  </button>
                  <button
                    type="button"
                    disabled={busyActionId === `restock-${alert.crmAccountId}`}
                    onClick={() => handleQuickRestockOffer(alert, 'email')}
                    className="px-3.5 py-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Email Offer</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SUB-TAB 5: PROMO & VOUCHER RULES ENGINE                      */}
      {/* ============================================================ */}
      {subTab === 'promo_rules' && (
        <PromoVoucherRulesTab
          theme={theme}
          activeStaffSession={activeStaffSession}
          onShowToast={onShowToast}
        />
      )}

      {/* ============================================================ */}
      {/* SUB-TAB 6: SALESMAN KANVAS (VAN-SELLING) & WARUNG KASBON     */}
      {/* ============================================================ */}
      {subTab === 'kanvas_kasbon' && (
        <div className="space-y-4">
          {/* Compact KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className={`${cardClass} p-4`}>
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-bold uppercase tracking-wider ${textMuted}`}>
                  Active Van Routes
                </span>
                <Truck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className={`text-2xl font-extrabold font-mono mt-1.5 ${textTitle}`}>
                {kanvasLedger?.summary.activeRoutes ?? 0} / {kanvasLedger?.summary.totalRoutes ?? 0}
              </p>
              <p className={`text-[11px] mt-1 ${textMuted}`}>Armada kanvas keliling aktif</p>
            </div>

            <div className={`${cardClass} p-4`}>
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-bold uppercase tracking-wider ${textMuted}`}>
                  Collected Today
                </span>
                <Banknote className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-2xl font-extrabold font-mono mt-1.5 text-emerald-600 dark:text-emerald-400">
                {formatIDR(kanvasLedger?.summary.totalCollectedTodayIDR ?? 0)}
              </p>
              <p className={`text-[11px] mt-1 ${textMuted}`}>Setoran tunai kanvas (COA #1010)</p>
            </div>

            <div className={`${cardClass} p-4`}>
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-bold uppercase tracking-wider ${textMuted}`}>
                  Outstanding Kasbon
                </span>
                <FileText className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-2xl font-extrabold font-mono mt-1.5 text-amber-600 dark:text-amber-400">
                {formatIDR(kanvasLedger?.summary.totalOutstandingKasbonIDR ?? 0)}
              </p>
              <p className={`text-[11px] mt-1 ${textMuted}`}>Piutang warung berjalan (COA #1200)</p>
            </div>

            <div className={`${cardClass} p-4`}>
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-bold uppercase tracking-wider ${textMuted}`}>
                  Overdue / Jatuh Tempo
                </span>
                <Clock className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              </div>
              <p className="text-2xl font-extrabold font-mono mt-1.5 text-rose-600 dark:text-rose-400">
                {kanvasLedger?.summary.overdueKasbonCount ?? 0} Warung
              </p>
              <p className={`text-[11px] mt-1 ${textMuted}`}>Siap ditagih via WhatsApp Billing</p>
            </div>
          </div>

          {/* Section A: Rute Salesman Kanvas */}
          <div className={`${cardClass} p-4 sm:p-5 space-y-3`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className={`text-sm font-extrabold ${textTitle}`}>
                  Rute Salesman Kanvas (Van-Selling &amp; Kunjungan Warung)
                </h3>
                <p className={`text-[11px] ${textMuted}`}>
                  Monitoring armada kanvas harian, target drop barang, dan realisasi setoran.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadKanvasLedger}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800/80 text-xs font-bold flex items-center gap-1 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${kanvasLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsNewRouteOpen((v) => !v)}
                  className="px-3 py-1.5 rounded-lg bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Rute Kanvas</span>
                </button>
              </div>
            </div>

            {isNewRouteOpen && (
              <form onSubmit={handleCreateKanvasRoute} className={`${subCardClass} p-3 grid grid-cols-1 sm:grid-cols-6 gap-2 items-end text-xs`}>
                <div>
                  <label className="block font-bold mb-1">Nama Salesman</label>
                  <input
                    type="text"
                    value={newRouteForm.salesmanName}
                    onChange={(e) => setNewRouteForm((p) => ({ ...p, salesmanName: e.target.value }))}
                    placeholder="Dedi Kurniawan"
                    className={`w-full px-2.5 py-1.5 rounded-lg ${inputClass}`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Plat Kendaraan</label>
                  <input
                    type="text"
                    value={newRouteForm.vehiclePlate}
                    onChange={(e) => setNewRouteForm((p) => ({ ...p, vehiclePlate: e.target.value }))}
                    placeholder="B 9123 KNV"
                    className={`w-full px-2.5 py-1.5 rounded-lg font-mono ${inputClass}`}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-bold mb-1">Area Rute</label>
                  <input
                    type="text"
                    value={newRouteForm.routeArea}
                    onChange={(e) => setNewRouteForm((p) => ({ ...p, routeArea: e.target.value }))}
                    placeholder="Bekasi Timur - Tambun"
                    className={`w-full px-2.5 py-1.5 rounded-lg ${inputClass}`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Target Harian (IDR)</label>
                  <input
                    type="number"
                    min={0}
                    step={500000}
                    value={newRouteForm.dailyTargetIDR}
                    onChange={(e) => setNewRouteForm((p) => ({ ...p, dailyTargetIDR: Number(e.target.value) || 0 }))}
                    className={`w-full px-2.5 py-1.5 rounded-lg font-mono ${inputClass}`}
                  />
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="submit"
                    disabled={busyActionId === 'kanvas-create-route'}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-[#0F4C3A] text-white font-bold cursor-pointer"
                  >
                    Simpan
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsNewRouteOpen(false)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-800/80 font-bold cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              </form>
            )}

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800/80">
              <table className="w-full text-left text-xs">
                <thead className={`border-b text-[10px] font-bold uppercase ${isLight ? 'bg-slate-50 text-slate-500 border-slate-200' : 'bg-[#090A0F] text-slate-400 border-slate-800/80'}`}>
                  <tr>
                    <th className="py-2.5 px-3">ID Rute</th>
                    <th className="py-2.5 px-3">Salesman &amp; Armada</th>
                    <th className="py-2.5 px-3">Area Kunjungan</th>
                    <th className="py-2.5 px-3 text-center">Outlet</th>
                    <th className="py-2.5 px-3 text-right">Target Harian</th>
                    <th className="py-2.5 px-3 text-right">Tertagih Hari Ini</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-slate-800/80'}`}>
                  {(kanvasLedger?.routes || []).map((rt) => (
                    <tr key={rt.id} className={isLight ? 'hover:bg-slate-50/70' : 'hover:bg-slate-900/60'}>
                      <td className="py-2.5 px-3 font-mono font-bold text-[#0F4C3A] dark:text-emerald-400">{rt.id}</td>
                      <td className="py-2.5 px-3">
                        <div className={`font-bold ${textTitle}`}>{rt.salesmanName}</div>
                        <div className={`font-mono text-[10px] ${textMuted}`}>{rt.vehiclePlate}</div>
                      </td>
                      <td className="py-2.5 px-3">{rt.routeArea}</td>
                      <td className="py-2.5 px-3 text-center font-mono">{rt.outletCount}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">{formatIDR(rt.dailyTargetIDR)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {formatIDR(rt.collectedKasbonIDR)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            rt.status === 'ON_ROUTE'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-900/90 dark:text-slate-300 border-slate-300 dark:border-slate-800/80'
                          }`}
                        >
                          {rt.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section B: Buku Kasbon Warung / Toko Kelontong */}
          <div className={`${cardClass} p-4 sm:p-5 space-y-3`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className={`text-sm font-extrabold ${textTitle}`}>
                  Buku Kasbon Warung &amp; Toko Kelontong (Aging &amp; Tagih WhatsApp)
                </h3>
                <p className={`text-[11px] ${textMuted}`}>
                  Catat pelunasan cicilan ke GL Kas (#1010) &amp; Piutang (#1200) atau kirim surat tagih WhatsApp 1-klik.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewKasbonOpen((v) => !v)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-800/80 text-xs font-bold flex items-center gap-1 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Catat Kasbon Baru</span>
              </button>
            </div>

            {isNewKasbonOpen && (
              <form onSubmit={handleCreateKasbon} className={`${subCardClass} p-3 grid grid-cols-1 sm:grid-cols-6 gap-2 items-end text-xs`}>
                <div>
                  <label className="block font-bold mb-1">Nama Warung</label>
                  <input
                    type="text"
                    value={newKasbonForm.warungName}
                    onChange={(e) => setNewKasbonForm((p) => ({ ...p, warungName: e.target.value }))}
                    placeholder="Warung Berkah Jaya"
                    className={`w-full px-2.5 py-1.5 rounded-lg ${inputClass}`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Pemilik</label>
                  <input
                    type="text"
                    value={newKasbonForm.ownerName}
                    onChange={(e) => setNewKasbonForm((p) => ({ ...p, ownerName: e.target.value }))}
                    placeholder="Ibu Siti"
                    className={`w-full px-2.5 py-1.5 rounded-lg ${inputClass}`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">WhatsApp</label>
                  <input
                    type="text"
                    value={newKasbonForm.phone}
                    onChange={(e) => setNewKasbonForm((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="+62812..."
                    className={`w-full px-2.5 py-1.5 rounded-lg font-mono ${inputClass}`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Saldo Kasbon (IDR)</label>
                  <input
                    type="number"
                    min={0}
                    step={50000}
                    value={newKasbonForm.outstandingBalanceIDR}
                    onChange={(e) => setNewKasbonForm((p) => ({ ...p, outstandingBalanceIDR: Number(e.target.value) || 0 }))}
                    className={`w-full px-2.5 py-1.5 rounded-lg font-mono ${inputClass}`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Jatuh Tempo</label>
                  <input
                    type="date"
                    value={newKasbonForm.dueDate}
                    onChange={(e) => setNewKasbonForm((p) => ({ ...p, dueDate: e.target.value }))}
                    className={`w-full px-2.5 py-1.5 rounded-lg ${inputClass}`}
                  />
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="submit"
                    disabled={busyActionId === 'kanvas-create-kasbon'}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-[#0F4C3A] text-white font-bold cursor-pointer"
                  >
                    Simpan
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsNewKasbonOpen(false)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-800/80 font-bold cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              </form>
            )}

            {/* Inline Pelunasan Bar */}
            {collectTarget && (
              <form
                onSubmit={handleCollectKasbonPayment}
                className="p-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div>
                  <span className="font-bold text-emerald-800 dark:text-emerald-300">
                    Catat Pelunasan Kasbon: {collectTarget.warungName} ({collectTarget.ownerName})
                  </span>
                  <span className={`block text-[11px] ${textMuted}`}>
                    Sisa Piutang: {formatIDR(collectTarget.outstandingBalanceIDR)} · GL otomatis DR #1010 Kas / CR #1200 Piutang
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1000}
                    max={collectTarget.outstandingBalanceIDR}
                    step={10000}
                    value={collectAmountIDR}
                    onChange={(e) => setCollectAmountIDR(Number(e.target.value) || 0)}
                    className={`w-40 px-2.5 py-1.5 rounded-lg font-mono font-bold ${inputClass}`}
                  />
                  <button
                    type="submit"
                    disabled={busyActionId === `collect-${collectTarget.id}` || collectAmountIDR <= 0}
                    className="px-3.5 py-1.5 rounded-lg bg-[#0F4C3A] hover:bg-[#0b382b] text-white font-bold cursor-pointer disabled:opacity-50"
                  >
                    {busyActionId === `collect-${collectTarget.id}` ? 'Menyimpan...' : 'Konfirmasi Bayar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCollectTarget(null);
                      setCollectAmountIDR(0);
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-800/80 font-bold cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              </form>
            )}

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800/80">
              <table className="w-full text-left text-xs">
                <thead className={`border-b text-[10px] font-bold uppercase ${isLight ? 'bg-slate-50 text-slate-500 border-slate-200' : 'bg-[#090A0F] text-slate-400 border-slate-800/80'}`}>
                  <tr>
                    <th className="py-2.5 px-3">Warung / Pemilik</th>
                    <th className="py-2.5 px-3">Salesman &amp; Rute</th>
                    <th className="py-2.5 px-3 text-right">Plafon Kredit</th>
                    <th className="py-2.5 px-3 text-right">Saldo Kasbon</th>
                    <th className="py-2.5 px-3">Jatuh Tempo</th>
                    <th className="py-2.5 px-3 text-center">Aging</th>
                    <th className="py-2.5 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-slate-800/80'}`}>
                  {(kanvasLedger?.kasbonAccounts || []).map((acc) => {
                    const agingBadge =
                      acc.agingStatus === 'LUNAS'
                        ? 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-900/90 dark:text-slate-300 dark:border-slate-800/80'
                        : acc.agingStatus === 'MENUNGGAK_7_HARI'
                        ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                        : acc.agingStatus === 'JATUH_TEMPO'
                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                        : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
                    return (
                      <tr key={acc.id} className={isLight ? 'hover:bg-slate-50/70' : 'hover:bg-slate-900/60'}>
                        <td className="py-2.5 px-3">
                          <div className={`font-bold ${textTitle}`}>{acc.warungName}</div>
                          <div className={`text-[10px] ${textMuted}`}>
                            {acc.ownerName} · <span className="font-mono">{acc.phone}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold">{acc.salesmanName}</div>
                          <div className={`text-[10px] ${textMuted}`}>{acc.routeArea}</div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">{formatIDR(acc.creditLimitIDR)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums text-rose-600 dark:text-rose-400">
                          {formatIDR(acc.outstandingBalanceIDR)}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">
                          {acc.dueDate}
                          {acc.lastReminderSentAt && (
                            <span className="block text-[9px] text-emerald-600 dark:text-emerald-400">
                              WA sent {new Date(acc.lastReminderSentAt).toLocaleDateString('id-ID')}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${agingBadge}`}>
                            {acc.agingStatus.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={acc.outstandingBalanceIDR <= 0}
                              onClick={() => {
                                setCollectTarget(acc);
                                setCollectAmountIDR(acc.outstandingBalanceIDR);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-[#0F4C3A] hover:bg-[#0b382b] disabled:opacity-40 text-white text-[11px] font-bold cursor-pointer whitespace-nowrap"
                            >
                              Catat Bayar
                            </button>
                            <button
                              type="button"
                              disabled={busyActionId === `wa-kasbon-${acc.id}` || acc.outstandingBalanceIDR <= 0}
                              onClick={() => handleSendKasbonWaReminder(acc)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                            >
                              <MessageCircle className="w-3 h-3" />
                              <span>{busyActionId === `wa-kasbon-${acc.id}` ? 'Kirim...' : 'Tagih WA'}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SUB-TAB 7: STANDING ORDERS & SEASONAL PRE-ORDER DP           */}
      {/* ============================================================ */}
      {subTab === 'standing_orders' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className={`${cardClass} p-3.5`}>
              <span className={`text-[11px] font-bold uppercase ${textMuted}`}>Active Schedules</span>
              <p className="text-xl font-extrabold font-mono mt-1">{standingSummary.activeCount}</p>
            </div>
            <div className={`${cardClass} p-3.5`}>
              <span className={`text-[11px] font-bold uppercase ${textMuted}`}>Due for Fulfillment</span>
              <p className="text-xl font-extrabold font-mono mt-1 text-amber-600 dark:text-amber-400">
                {standingSummary.dueCount}
              </p>
            </div>
            <div className={`${cardClass} p-3.5`}>
              <span className={`text-[11px] font-bold uppercase ${textMuted}`}>Weekly / Pre-Order</span>
              <p className="text-xl font-extrabold font-mono mt-1">
                {standingSummary.weeklyCount} / {standingSummary.seasonalPreOrderCount}
              </p>
            </div>
            <div className={`${cardClass} p-3.5`}>
              <span className={`text-[11px] font-bold uppercase ${textMuted}`}>Pre-Order DP Held (#2130)</span>
              <p className="text-xl font-extrabold font-mono mt-1 text-emerald-600 dark:text-emerald-400">
                {formatIDR(standingSummary.totalDpLiabilityIDR)}
              </p>
            </div>
          </div>

          <div className={`${cardClass} p-4 flex flex-wrap items-center justify-between gap-3`}>
            <div>
              <h3 className={`text-sm font-extrabold ${textTitle}`}>
                Langganan Mingguan &amp; Seasonal Pre-Order DP
              </h3>
              <p className={`text-xs ${textMuted}`}>
                Konversi jadwal langganan/pre-order menjadi order Fulfillment dengan penguncian ATP otomatis &amp; pembukuan DP ke COA #2130.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsNewStandingOpen(true)}
                className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                  isLight ? 'bg-white border-slate-200 hover:bg-slate-50' : 'bg-slate-900/90 border-slate-800 hover:bg-slate-800'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Standing Order / DP</span>
              </button>
              <button
                type="button"
                disabled={busyActionId === 'trigger-due-all'}
                onClick={() => handleTriggerDueStandingOrders()}
                className="px-3.5 py-2 rounded-xl bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${busyActionId === 'trigger-due-all' ? 'animate-spin' : ''}`} />
                <span>Trigger Due Standing Orders</span>
              </button>
            </div>
          </div>

          <div className={`${cardClass} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="border-b border-slate-200 dark:border-slate-800/80 text-[11px] uppercase text-slate-500">
                  <tr>
                    <th className="py-2.5 px-3">ID &amp; Type</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Items</th>
                    <th className="py-2.5 px-3">Schedule / Target</th>
                    <th className="py-2.5 px-3 text-right">Est. Total</th>
                    <th className="py-2.5 px-3 text-right">DP (#2130)</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {standingOrders.map((sto) => (
                    <tr key={sto.id}>
                      <td className="py-2.5 px-3">
                        <div className="font-mono font-bold">{sto.id}</div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 font-semibold">
                          {sto.type === 'SEASONAL_PREORDER' ? 'Pre-Order DP' : 'Weekly Sub'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold">{sto.customerName}</div>
                        <div className={`text-[10px] ${textMuted}`}>{sto.customerPhone} · {sto.storeName}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        {sto.items.map((it) => `${it.productName} x${it.quantity}`).join(', ')}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px]">
                        {sto.type === 'WEEKLY_SUBSCRIPTION'
                          ? sto.scheduleDays.join(', ')
                          : sto.targetFulfillmentDate || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        {formatIDR(sto.estimatedTotalIDR)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {sto.downPaymentIDR > 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                            {formatIDR(sto.downPaymentIDR)}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                          {sto.status}
                        </span>
                        {sto.lastFulfillmentOrderId && (
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                            → {sto.lastFulfillmentOrderId}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          disabled={busyActionId === `trigger-${sto.id}`}
                          onClick={() => handleTriggerDueStandingOrders([sto.id])}
                          className="px-2.5 py-1 rounded-lg bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-[11px] font-bold cursor-pointer disabled:opacity-50 whitespace-nowrap"
                        >
                          Trigger Order
                        </button>
                      </td>
                    </tr>
                  ))}
                  {standingOrders.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        Belum ada Standing Order atau Pre-Order DP terdaftar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* ============================================================ */}
      {/* MODAL 1: CUSTOMER 360 PROFILE MODAL                          */}
      {/* ============================================================ */}
      {selectedProfileId &&
        createPortal(
          <div
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto gm-backdrop-fade"
            onClick={() => setSelectedProfileId(null)}
          >
            <div
              className={`w-full max-w-4xl rounded-2xl border p-5 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[90vh] overflow-y-auto gm-modal-pop ${
                isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#12141C] border-slate-800/80 text-slate-100'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {isLoadingProfile || !profileHistory ? (
                <div className="py-16 text-center text-xs text-slate-500 dark:text-slate-400">Loading Customer 360° Timeline...</div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800/80">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base sm:text-lg font-extrabold">
                          {profileHistory.account.companyName || profileHistory.account.name}
                        </h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${TIER_BADGE_MAP[profileHistory.account.tier]}`}>
                          {profileHistory.account.tier}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${RFM_BADGE_MAP[profileHistory.account.rfmSegment].badgeClass}`}>
                          {RFM_BADGE_MAP[profileHistory.account.rfmSegment].label}
                        </span>
                      </div>
                      <p className={`text-xs mt-1 ${textMuted}`}>
                        {profileHistory.account.name} · {profileHistory.account.phone} · {profileHistory.account.email} · {profileHistory.account.storeName}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedProfileId(null)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Summary Strip + Inline Contract Controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className={`${subCardClass} p-3`}>
                      <span className={`text-[10px] ${textMuted}`}>Loyalty Points</span>
                      <p className="text-lg font-extrabold font-mono text-amber-600 dark:text-amber-400">
                        {profileHistory.account.pointsBalance.toLocaleString('id-ID')} pts
                      </p>
                    </div>
                    <div className={`${subCardClass} p-3`}>
                      <span className={`text-[10px] ${textMuted}`}>Lifetime Spend</span>
                      <p className="text-lg font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                        {formatIDR(profileHistory.account.lifetimeSpendIDR)}
                      </p>
                    </div>
                    <div className={`${subCardClass} p-3`}>
                      <span className={`text-[10px] ${textMuted}`}>POS + B2B Orders</span>
                      <p className="text-lg font-extrabold font-mono">
                        {profileHistory.posOrders.length + profileHistory.b2bOrders.length} Txns
                      </p>
                    </div>
                    <div className={`${subCardClass} p-3`}>
                      <span className={`text-[10px] ${textMuted}`}>Avg Reorder Cadence</span>
                      <p className="text-lg font-extrabold font-mono">
                        Every {profileHistory.account.avgOrderCadenceDays} days
                      </p>
                    </div>
                  </div>

                  {/* Edit Tier / Contract Terms */}
                  <div className={`${subCardClass} p-3.5 flex flex-wrap items-end gap-3`}>
                    <div>
                      <label className={`block text-[10px] font-bold mb-1 ${textMuted}`}>Loyalty Tier</label>
                      <select
                        value={editTier}
                        onChange={(e) => setEditTier(e.target.value as CrmLoyaltyTier)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs ${inputClass}`}
                      >
                        <option value="SILVER">SILVER</option>
                        <option value="GOLD">GOLD</option>
                        <option value="PLATINUM">PLATINUM</option>
                      </select>
                    </div>
                    <div>
                      <label className={`block text-[10px] font-bold mb-1 ${textMuted}`}>Contract Disc (%)</label>
                      <input
                        type="number"
                        min={0}
                        max={35}
                        value={editDiscountPct}
                        onChange={(e) => setEditDiscountPct(Number(e.target.value))}
                        className={`w-24 px-2.5 py-1.5 rounded-lg text-xs font-mono ${inputClass}`}
                      />
                    </div>
                    <div>
                      <label className={`block text-[10px] font-bold mb-1 ${textMuted}`}>Credit Limit (IDR)</label>
                      <input
                        type="number"
                        min={0}
                        step={1000000}
                        value={editCreditLimitIDR}
                        onChange={(e) => setEditCreditLimitIDR(Number(e.target.value))}
                        className={`w-40 px-2.5 py-1.5 rounded-lg text-xs font-mono ${inputClass}`}
                      />
                    </div>
                    <div>
                      <label className={`block text-[10px] font-bold mb-1 ${textMuted}`}>WhatsApp (628xxx)</label>
                      <input
                        type="text"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        onBlur={(e) => setEditPhone(sanitizeIndonesianPhone(e.target.value))}
                        placeholder="62812..."
                        className={`w-36 px-2.5 py-1.5 rounded-lg text-xs font-mono ${inputClass}`}
                      />
                    </div>
                    <div>
                      <label className={`block text-[10px] font-bold mb-1 ${textMuted}`}>NPWP / NIK (15/16d)</label>
                      <input
                        type="text"
                        value={editNpwp}
                        onChange={(e) => setEditNpwp(e.target.value)}
                        placeholder="15/16 digits (Coretax)"
                        className={`w-40 px-2.5 py-1.5 rounded-lg text-xs font-mono ${inputClass}`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveProfileTerms}
                      disabled={busyActionId === `save-prof-${profileHistory.account.id}`}
                      className="px-3.5 py-1.5 rounded-lg bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-bold cursor-pointer"
                    >
                      Save Contract Terms
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left: Purchase History & Quotations */}
                    <div className={`${subCardClass} p-3.5 space-y-2.5 max-h-72 overflow-y-auto`}>
                      <h4 className="text-xs font-extrabold">POS, B2B Orders &amp; Quotations</h4>
                      {profileHistory.b2bOrders.map((o) => (
                        <div key={o.id} className="text-xs py-1.5 border-b border-slate-200/70 dark:border-slate-800/80 flex justify-between">
                          <div>
                            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">B2B #{o.id}</span>
                            <span className={`block text-[10px] ${textMuted}`}>{new Date(o.orderDate).toLocaleDateString()} · {o.status}</span>
                          </div>
                          <span className="font-mono font-bold">{formatIDR(o.totalAmountIDR)}</span>
                        </div>
                      ))}
                      {profileHistory.posOrders.map((r) => (
                        <div key={r.receiptNumber} className="text-xs py-1.5 border-b border-slate-200/70 dark:border-slate-800/80 flex justify-between">
                          <div>
                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">POS #{r.receiptNumber}</span>
                            <span className={`block text-[10px] ${textMuted}`}>{new Date(r.timestamp).toLocaleDateString()} · {r.paymentMethod.toUpperCase()}</span>
                          </div>
                          <span className="font-mono font-bold">{formatIDR(r.total)}</span>
                        </div>
                      ))}
                      {profileHistory.quotations.map((q) => (
                        <div key={q.id} className="text-xs py-1.5 border-b border-slate-200/70 dark:border-slate-800/80 flex justify-between">
                          <div>
                            <span className="font-mono font-bold text-amber-600 dark:text-amber-400">Quote #{q.quotationNumber}</span>
                            <span className={`block text-[10px] ${textMuted}`}>{q.date} · {q.status}</span>
                          </div>
                          <span className="font-mono font-bold">{formatIDR(q.total)}</span>
                        </div>
                      ))}
                      {profileHistory.b2bOrders.length + profileHistory.posOrders.length + profileHistory.quotations.length === 0 && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">No orders or quotations recorded yet.</p>
                      )}
                    </div>

                    {/* Right: Points Ledger & Communications */}
                    <div className={`${subCardClass} p-3.5 space-y-2.5 max-h-72 overflow-y-auto`}>
                      <h4 className="text-xs font-extrabold">Loyalty Points Ledger &amp; Comms</h4>
                      {profileHistory.account.pointsLedger.map((pt) => (
                        <div key={pt.id} className="text-xs py-1.5 border-b border-slate-200/70 dark:border-slate-800/80 flex justify-between gap-2">
                          <div>
                            <span className="font-bold">{pt.note}</span>
                            <span className={`block text-[10px] ${textMuted}`}>{pt.channel} · {pt.referenceId}</span>
                          </div>
                          <span className={`font-mono font-bold shrink-0 ${pt.pointsDelta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {pt.pointsDelta >= 0 ? `+${pt.pointsDelta}` : pt.pointsDelta} pts
                          </span>
                        </div>
                      ))}
                      {profileHistory.communications.map((c) => (
                        <div key={c.id} className="text-xs py-1.5 border-b border-slate-200/70 dark:border-slate-800/80">
                          <span className="font-bold text-sky-600 dark:text-sky-400">[{c.channel.toUpperCase()}] {c.docNumber}</span>
                          <span className={`block text-[10px] ${textMuted}`}>{c.subjectOrPreview}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Activity Logger */}
                  <form onSubmit={handleLogActivity} className={`${subCardClass} p-3.5 space-y-2`}>
                    <h4 className="text-xs font-extrabold">Log CRM Interaction</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <select
                        value={newActivityType}
                        onChange={(e) => setNewActivityType(e.target.value as CrmActivity['type'])}
                        className={`px-2.5 py-1.5 rounded-lg text-xs ${inputClass}`}
                      >
                        <option value="CALL">Phone / WA Call</option>
                        <option value="TASTING">Sample / Tasting</option>
                        <option value="COLD_CHAIN_DEMO">Cold-Chain Demo</option>
                        <option value="FOLLOW_UP">Follow-Up</option>
                      </select>
                      <input
                        type="text"
                        value={newActivitySubject}
                        onChange={(e) => setNewActivitySubject(e.target.value)}
                        placeholder="Subject (e.g. Monthly produce price review)"
                        className={`sm:col-span-2 px-2.5 py-1.5 rounded-lg text-xs ${inputClass}`}
                      />
                      <button
                        type="submit"
                        disabled={busyActionId === 'log-act'}
                        className="px-3 py-1.5 rounded-lg bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-bold cursor-pointer"
                      >
                        Log Activity
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>,
          document.body
        )}

      {/* ============================================================ */}
      {/* MODAL 2: NEW CRM ACCOUNT MODAL                               */}
      {/* ============================================================ */}
      {isNewAccountOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto gm-backdrop-fade"
            onClick={() => setIsNewAccountOpen(false)}
          >
            <form
              onSubmit={handleCreateAccount}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-md rounded-2xl border p-5 shadow-2xl space-y-3.5 gm-modal-pop ${
                isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#12141C] border-slate-800/80 text-slate-100'
              }`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800/80">
                <h3 className="text-sm font-extrabold">Register New CRM / Loyalty Account</h3>
                <button type="button" onClick={() => setIsNewAccountOpen(false)} className="text-slate-400 hover:text-slate-200 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {(['B2B_ACCOUNT', 'B2C_MEMBER'] as CrmAccountType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setAccForm((p) => ({ ...p, accountType: t }))}
                    className={`py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                      accForm.accountType === t
                        ? 'bg-[#0F4C3A] text-white border-[#0F4C3A]'
                        : isLight
                        ? 'bg-slate-50 border-slate-200 text-slate-700'
                        : 'bg-slate-900/90 border-slate-800/80 text-slate-300'
                    }`}
                  >
                    {t === 'B2B_ACCOUNT' ? 'B2B Key Account' : 'B2C Retail Member'}
                  </button>
                ))}
              </div>

              <div className="space-y-2.5 text-xs">
                <div>
                  <label className="block font-bold mb-1">Contact Name *</label>
                  <input
                    required
                    type="text"
                    value={accForm.name}
                    onChange={(e) => setAccForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Chef Hendra Pratama"
                    className={`w-full px-3 py-2 rounded-xl ${inputClass}`}
                  />
                </div>
                {accForm.accountType === 'B2B_ACCOUNT' && (
                  <div>
                    <label className="block font-bold mb-1">Company / HORECA Name</label>
                    <input
                      type="text"
                      value={accForm.companyName}
                      onChange={(e) => setAccForm((p) => ({ ...p, companyName: e.target.value }))}
                      placeholder="e.g. PT Kuliner Nusantara"
                      className={`w-full px-3 py-2 rounded-xl ${inputClass}`}
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold mb-1">WhatsApp / Phone *</label>
                    <input
                      required
                      type="text"
                      value={accForm.phone}
                      onChange={(e) => setAccForm((p) => ({ ...p, phone: e.target.value }))}
                      onBlur={(e) => setAccForm((p) => ({ ...p, phone: sanitizeIndonesianPhone(e.target.value) }))}
                      placeholder="0812... -> 62812..."
                      className={`w-full px-3 py-2 rounded-xl ${inputClass}`}
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">Email</label>
                    <input
                      type="email"
                      value={accForm.email}
                      onChange={(e) => setAccForm((p) => ({ ...p, email: e.target.value }))}
                      placeholder="buyer@company.id"
                      className={`w-full px-3 py-2 rounded-xl ${inputClass}`}
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-bold mb-1">NPWP / NIK (Coretax 15 or 16 Digits — Optional)</label>
                  <input
                    type="text"
                    value={accForm.npwp}
                    onChange={(e) => setAccForm((p) => ({ ...p, npwp: e.target.value }))}
                    placeholder="e.g. 01.234.567.8-011.000 or 16-digit NIK"
                    className={`w-full px-3 py-2 rounded-xl font-mono ${inputClass}`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Home Branch Outlet</label>
                  <select
                    value={accForm.storeId}
                    onChange={(e) => setAccForm((p) => ({ ...p, storeId: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-xl ${inputClass}`}
                  >
                    {storeOutlets.map((s) => (
                      <option key={s.storeId} value={s.storeId}>
                        {s.storeName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewAccountOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800/80 text-xs font-bold cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busyActionId === 'create-acc'}
                  className="px-4 py-2 rounded-xl bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-bold cursor-pointer"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* ============================================================ */}
      {/* MODAL 3: NEW B2B DEAL MODAL                                  */}
      {/* ============================================================ */}
      {isNewDealOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto gm-backdrop-fade"
            onClick={() => setIsNewDealOpen(false)}
          >
            <form
              onSubmit={handleCreateDeal}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-md rounded-2xl border p-5 shadow-2xl space-y-3.5 gm-modal-pop ${
                isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#12141C] border-slate-800/80 text-slate-100'
              }`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800/80">
                <h3 className="text-sm font-extrabold">Add B2B Sales Opportunity</h3>
                <button type="button" onClick={() => setIsNewDealOpen(false)} className="text-slate-400 hover:text-slate-200 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2.5 text-xs">
                <div>
                  <label className="block font-bold mb-1">Opportunity Title *</label>
                  <input
                    required
                    type="text"
                    value={dealForm.title}
                    onChange={(e) => setDealForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. Monthly Organic Greens Contract"
                    className={`w-full px-3 py-2 rounded-xl ${inputClass}`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">CRM Account</label>
                  <select
                    value={dealForm.crmAccountId}
                    onChange={(e) => setDealForm((p) => ({ ...p, crmAccountId: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-xl ${inputClass}`}
                  >
                    {(overview?.accounts || []).map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.companyName || a.name} ({a.storeName})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1">Est. Monthly Value (IDR)</label>
                  <input
                    type="number"
                    min={1000000}
                    step={500000}
                    value={dealForm.estimatedMonthlyValueIDR}
                    onChange={(e) => setDealForm((p) => ({ ...p, estimatedMonthlyValueIDR: Number(e.target.value) }))}
                    className={`w-full px-3 py-2 rounded-xl font-mono ${inputClass}`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold mb-1">Next Activity</label>
                    <input
                      type="text"
                      value={dealForm.nextActivity}
                      onChange={(e) => setDealForm((p) => ({ ...p, nextActivity: e.target.value }))}
                      className={`w-full px-3 py-2 rounded-xl ${inputClass}`}
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">Target Date</label>
                    <input
                      type="date"
                      value={dealForm.nextActivityDate}
                      onChange={(e) => setDealForm((p) => ({ ...p, nextActivityDate: e.target.value }))}
                      className={`w-full px-3 py-2 rounded-xl ${inputClass}`}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewDealOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800/80 text-xs font-bold cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busyActionId === 'create-deal'}
                  className="px-4 py-2 rounded-xl bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-bold cursor-pointer"
                >
                  Create Deal
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* ============================================================ */}
      {/* MODAL 4: OMNICHANNEL CAMPAIGN DISPATCH MODAL                 */}
      {/* ============================================================ */}
      {campaignModal.open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto gm-backdrop-fade"
            onClick={() => setCampaignModal((p) => ({ ...p, open: false }))}
          >
            <form
              onSubmit={handleDispatchCampaign}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-lg rounded-2xl border p-5 shadow-2xl space-y-3.5 gm-modal-pop ${
                isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#12141C] border-slate-800/80 text-slate-100'
              }`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800/80">
                <div>
                  <h3 className="text-sm font-extrabold">Dispatch CRM Campaign</h3>
                  <p className={`text-[11px] ${textMuted}`}>Target: {campaignModal.recipientLabel}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCampaignModal((p) => ({ ...p, open: false }))}
                  className="text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(['whatsapp', 'email', 'both'] as const).map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setCampaignModal((p) => ({ ...p, channel: ch }))}
                    className={`py-2 rounded-xl text-xs font-bold border uppercase cursor-pointer ${
                      campaignModal.channel === ch
                        ? 'bg-[#0F4C3A] text-white border-[#0F4C3A]'
                        : isLight
                        ? 'bg-slate-50 border-slate-200 text-slate-700'
                        : 'bg-slate-900/90 border-slate-800/80 text-slate-300'
                    }`}
                  >
                    {ch === 'both' ? 'WA + Email' : ch}
                  </button>
                ))}
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold mb-1">Campaign Title</label>
                    <input
                      type="text"
                      value={campaignModal.campaignTitle}
                      onChange={(e) => setCampaignModal((p) => ({ ...p, campaignTitle: e.target.value }))}
                      className={`w-full px-3 py-2 rounded-xl ${inputClass}`}
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">Promo / Voucher Code</label>
                    <input
                      type="text"
                      value={campaignModal.voucherCode}
                      onChange={(e) => setCampaignModal((p) => ({ ...p, voucherCode: e.target.value }))}
                      className={`w-full px-3 py-2 rounded-xl font-mono ${inputClass}`}
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-bold mb-1">
                    Message Template (supports {'{{name}}'}, {'{{tier}}'}, {'{{points}}'}, {'{{voucher}}'})
                  </label>
                  <textarea
                    rows={4}
                    value={campaignModal.messageTemplate}
                    onChange={(e) => setCampaignModal((p) => ({ ...p, messageTemplate: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-xl ${inputClass}`}
                  />
                </div>
              </div>

              {lastWaMeUrl && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs flex items-center justify-between gap-2">
                  <span className="text-emerald-700 dark:text-emerald-300 font-semibold">
                    Sandbox WhatsApp link ready (logged to Audit History):
                  </span>
                  <a
                    href={lastWaMeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono font-bold underline text-emerald-700 dark:text-emerald-300 shrink-0"
                  >
                    Open wa.me
                  </a>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCampaignModal((p) => ({ ...p, open: false }))}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800/80 text-xs font-bold cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={busyActionId === 'dispatch-cmp'}
                  className="px-4 py-2 rounded-xl bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-bold cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{busyActionId === 'dispatch-cmp' ? 'Dispatching...' : 'Send via Gateway'}</span>
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* MODAL: NEW STANDING ORDER / SEASONAL PRE-ORDER DP */}
      {isNewStandingOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto gm-backdrop-fade"
            onClick={() => setIsNewStandingOpen(false)}
          >
            <form
              onSubmit={handleCreateStandingOrder}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-lg rounded-2xl border p-5 shadow-2xl space-y-3.5 my-auto gm-modal-pop ${
                isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#12141C] border-slate-800/80 text-slate-100'
              }`}
            >
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800/80">
                <h3 className="text-sm sm:text-base font-extrabold">New Standing Order / Seasonal Pre-Order DP</h3>
                <button type="button" onClick={() => setIsNewStandingOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="sm:col-span-2">
                  <label className="block font-bold mb-1">Type</label>
                  <select
                    value={standingForm.type}
                    onChange={(e) => setStandingForm((p) => ({ ...p, type: e.target.value as StandingOrderType }))}
                    className={`w-full px-3 py-2 rounded-xl ${inputClass}`}
                  >
                    <option value="WEEKLY_SUBSCRIPTION">Langganan Mingguan (Weekly Standing Order)</option>
                    <option value="SEASONAL_PREORDER">Seasonal Pre-Order (with Customer DP #2130)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1">Customer Name</label>
                  <input
                    type="text"
                    required
                    value={standingForm.customerName}
                    onChange={(e) => setStandingForm((p) => ({ ...p, customerName: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-xl ${inputClass}`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">WhatsApp Phone</label>
                  <input
                    type="tel"
                    required
                    value={standingForm.customerPhone}
                    onChange={(e) => setStandingForm((p) => ({ ...p, customerPhone: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-xl ${inputClass}`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">SKU</label>
                  <input
                    type="text"
                    value={standingForm.sku}
                    onChange={(e) => setStandingForm((p) => ({ ...p, sku: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-xl font-mono ${inputClass}`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Qty</label>
                  <input
                    type="number"
                    min={1}
                    value={standingForm.quantity}
                    onChange={(e) => setStandingForm((p) => ({ ...p, quantity: Number(e.target.value) || 1 }))}
                    className={`w-full px-3 py-2 rounded-xl font-mono ${inputClass}`}
                  />
                </div>
                {standingForm.type === 'WEEKLY_SUBSCRIPTION' ? (
                  <div className="sm:col-span-2">
                    <label className="block font-bold mb-1">Schedule Days</label>
                    <input
                      type="text"
                      value={standingForm.scheduleDays}
                      onChange={(e) => setStandingForm((p) => ({ ...p, scheduleDays: e.target.value }))}
                      className={`w-full px-3 py-2 rounded-xl ${inputClass}`}
                    />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block font-bold mb-1">Target Delivery Date</label>
                      <input
                        type="date"
                        value={standingForm.targetFulfillmentDate}
                        onChange={(e) => setStandingForm((p) => ({ ...p, targetFulfillmentDate: e.target.value }))}
                        className={`w-full px-3 py-2 rounded-xl ${inputClass}`}
                      />
                    </div>
                    <div>
                      <label className="block font-bold mb-1">Customer DP (IDR · CR #2130)</label>
                      <input
                        type="number"
                        min={0}
                        value={standingForm.downPaymentIDR}
                        onChange={(e) => setStandingForm((p) => ({ ...p, downPaymentIDR: Number(e.target.value) || 0 }))}
                        className={`w-full px-3 py-2 rounded-xl font-mono ${inputClass}`}
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsNewStandingOpen(false)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800/80 text-xs font-bold cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={busyActionId === 'create-standing'} className="px-4 py-2 rounded-xl bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-bold cursor-pointer">
                  {busyActionId === 'create-standing' ? 'Saving...' : 'Save Standing Order'}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* MODAL: 1-KLIK QUICK CUSTOMER CLAIM / AUTO E-VOUCHER */}
      {isClaimModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto gm-backdrop-fade"
            onClick={() => setIsClaimModalOpen(false)}
          >
            <form
              onSubmit={handleSubmitInstantClaim}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-xl rounded-2xl border p-5 shadow-2xl space-y-4 my-auto max-h-[90vh] overflow-y-auto gm-modal-pop ${
                isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#12141C] border-slate-800/80 text-slate-100'
              }`}
            >
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800/80">
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold">1-Klik Instant Customer Claim &amp; Auto e-Voucher</h3>
                  <p className={`text-[11px] ${textMuted}`}>
                    Log komplain kesegaran/kerusakan &amp; terbitkan voucher 1x pakai (CLAIM-XXXX) langsung ke WhatsApp / Email pelanggan.
                  </p>
                </div>
                <button type="button" onClick={() => setIsClaimModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div>
                  <label className="block font-bold mb-1">POS Receipt / Order Ref</label>
                  <input
                    type="text"
                    required
                    value={claimForm.referenceId}
                    onChange={(e) => setClaimForm((p) => ({ ...p, referenceId: e.target.value }))}
                    placeholder="e.g. RCP-SEN-882104"
                    className={`w-full px-3 py-2 rounded-xl font-mono ${inputClass}`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Issue Category</label>
                  <select
                    value={claimForm.issueCategory}
                    onChange={(e) => setClaimForm((p) => ({ ...p, issueCategory: e.target.value as CustomerClaimIssueCategory }))}
                    className={`w-full px-3 py-2 rounded-xl ${inputClass}`}
                  >
                    <option value="SPOILED_NEAR_EXPIRY">Freshness / Spoiled Item</option>
                    <option value="DAMAGED_IN_TRANSIT">Damaged in Transit</option>
                    <option value="MISSING_ITEM">Missing Item</option>
                    <option value="QUALITY_MISMATCH">Quality / Catch-Weight Mismatch</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1">Customer Name (Optional if linked)</label>
                  <input
                    type="text"
                    value={claimForm.customerName}
                    onChange={(e) => setClaimForm((p) => ({ ...p, customerName: e.target.value }))}
                    placeholder="Ibu Clarissa"
                    className={`w-full px-3 py-2 rounded-xl ${inputClass}`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">WhatsApp Phone</label>
                  <input
                    type="tel"
                    value={claimForm.customerPhone}
                    onChange={(e) => setClaimForm((p) => ({ ...p, customerPhone: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-xl ${inputClass}`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Compensation Value (IDR)</label>
                  <input
                    type="number"
                    min={1000}
                    required
                    value={claimForm.compensationAmountIDR}
                    onChange={(e) => setClaimForm((p) => ({ ...p, compensationAmountIDR: Number(e.target.value) || 0 }))}
                    className={`w-full px-3 py-2 rounded-xl font-mono font-bold ${inputClass}`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Dispatch Channel</label>
                  <select
                    value={claimForm.dispatchChannel}
                    onChange={(e) => setClaimForm((p) => ({ ...p, dispatchChannel: e.target.value as any }))}
                    className={`w-full px-3 py-2 rounded-xl ${inputClass}`}
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">Email</option>
                    <option value="both">WhatsApp + Email</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-bold mb-1">CS Notes</label>
                  <input
                    type="text"
                    value={claimForm.notes}
                    onChange={(e) => setClaimForm((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Sayur layu saat tiba; ganti kompensasi voucher."
                    className={`w-full px-3 py-2 rounded-xl ${inputClass}`}
                  />
                </div>
              </div>

              {lastIssuedClaim && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-1">
                  <div className="font-bold text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
                    <span>Live Voucher Code: {lastIssuedClaim.voucherCode}</span>
                    {lastIssuedClaim.waMeUrl && (
                      <a href={lastIssuedClaim.waMeUrl} target="_blank" rel="noreferrer" className="underline font-mono">
                        Open wa.me
                      </a>
                    )}
                  </div>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-200">{lastIssuedClaim.message}</p>
                </div>
              )}

              {claimsList.length > 0 && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80">
                  <div className="text-[11px] font-bold uppercase text-slate-500 mb-1.5">Recent Claims ({claimsList.length})</div>
                  <div className="max-h-32 overflow-y-auto space-y-1 text-[11px]">
                    {claimsList.slice(0, 5).map((cl) => (
                      <div key={cl.id} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800">
                        <span>
                          <strong>{cl.voucherCode}</strong> · {cl.customerName} ({cl.referenceId})
                        </span>
                        <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                          {formatIDR(cl.compensationAmountIDR)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsClaimModalOpen(false)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800/80 text-xs font-bold cursor-pointer">
                  Close
                </button>
                <button type="submit" disabled={busyActionId === 'submit-claim'} className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5">
                  <Ticket className="w-3.5 h-3.5" />
                  <span>{busyActionId === 'submit-claim' ? 'Issuing Voucher...' : 'Issue e-Voucher & Send'}</span>
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}
    </div>
  );
};
