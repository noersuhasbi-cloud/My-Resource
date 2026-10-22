import React, { useState, useMemo } from 'react';
import type {
  VendorBill,
  VendorBillStatus,
  VendorBillPaymentStatus,
  VendorBillPaymentMethod,
  PurchaseOrder,
  GoodsReceiptRecord,
  SupportedCurrency,
} from '../../types/index.ts';
import { formatIDR } from '../../utils/formatters';
import { apiClient } from '../../services/apiClient';
import {
  FileText,
  Search,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  DollarSign,
  Building2,
  Calendar,
  CreditCard,
  Printer,
  X,
  RefreshCw,
  SlidersHorizontal,
  ShieldCheck,
  Percent,
  TrendingDown,
  Check,
  Eye,
  FileCheck,
  Sparkles,
  Receipt,
  Truck,
  ExternalLink,
} from 'lucide-react';

const FX_RATES: Record<SupportedCurrency, { symbol: string; rate: number; label: string }> = {
  IDR: { symbol: 'Rp', rate: 1, label: 'IDR (Base)' },
  USD: { symbol: '$', rate: 16000, label: 'USD ($)' },
  EUR: { symbol: '€', rate: 17200, label: 'EUR (€)' },
  AUD: { symbol: 'A$', rate: 10400, label: 'AUD (A$)' },
};

interface VendorBillModuleProps {
  theme: 'light' | 'dark';
  selectedStore: string;
  vendorBills: VendorBill[];
  purchaseOrders: PurchaseOrder[];
  goodsReceipts: GoodsReceiptRecord[];
  onRefreshData: () => void;
  onShowToast: (title: string, message: string) => void;
  // If opened directly with a preselected PO or GR for quick creation:
  initialPreselectedPoId?: string;
  initialPreselectedGrId?: string;
}

export const VendorBillModule: React.FC<VendorBillModuleProps> = ({
  theme,
  selectedStore,
  vendorBills,
  purchaseOrders,
  goodsReceipts,
  onRefreshData,
  onShowToast,
  initialPreselectedPoId,
  initialPreselectedGrId,
}) => {
  const isLight = theme === 'light';

  // State Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNPAID' | 'PAID' | 'APPROVED' | 'VARIANCE'>('ALL');
  const [displayCurrency, setDisplayCurrency] = useState<SupportedCurrency | 'ALL'>('ALL');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(Boolean(initialPreselectedPoId || initialPreselectedGrId));
  const [selectedBillForDetail, setSelectedBillForDetail] = useState<VendorBill | null>(null);
  const [billToPay, setBillToPay] = useState<VendorBill | null>(null);

  // Form State for Creating Vendor Bill
  const [selectedPoId, setSelectedPoId] = useState<string>(initialPreselectedPoId || '');
  const [selectedGrId, setSelectedGrId] = useState<string>(initialPreselectedGrId || '');
  const [invoiceNumberInput, setInvoiceNumberInput] = useState<string>('');
  const [billDateInput, setBillDateInput] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentTermsInput, setPaymentTermsInput] = useState<'COD' | 'Net 7' | 'Net 14' | 'Net 30' | 'Net 60'>('Net 30');
  const [currencyInput, setCurrencyInput] = useState<SupportedCurrency>('IDR');
  const [taxPercentInput, setTaxPercentInput] = useState<number>(11);
  const [billNotesInput, setBillNotesInput] = useState<string>('');
  const [autoApproveInput, setAutoApproveInput] = useState<boolean>(true);
  const [isSubmittingBill, setIsSubmittingBill] = useState(false);

  // Line items state for draft bill creation
  const [itemBilledOverrides, setItemBilledOverrides] = useState<
    Record<string, { billedQty: number; unitCost: number; notes: string }>
  >({});

  // Payment Form State
  const [payAmountInput, setPayAmountInput] = useState<number>(0);
  const [payMethodInput, setPayMethodInput] = useState<VendorBillPaymentMethod>('BANK_TRANSFER');
  const [payRefInput, setPayRefInput] = useState<string>('');
  const [payNotesInput, setPayNotesInput] = useState<string>('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Auto-populate when PO / GR changes in Create Modal
  const activeSelectedPO = useMemo(() => {
    return purchaseOrders.find((p) => p.id === selectedPoId) || null;
  }, [purchaseOrders, selectedPoId]);

  const activeSelectedGR = useMemo(() => {
    return goodsReceipts.find((g) => g.id === selectedGrId) || null;
  }, [goodsReceipts, selectedGrId]);

  // When PO is chosen, auto-select its first available GR if not yet set
  const availableGRsForPO = useMemo(() => {
    if (!selectedPoId) return goodsReceipts;
    return goodsReceipts.filter((g) => g.poId === selectedPoId);
  }, [goodsReceipts, selectedPoId]);

  const handleSelectPO = (poId: string) => {
    setSelectedPoId(poId);
    const matchingGrs = goodsReceipts.filter((g) => g.poId === poId);
    if (matchingGrs.length > 0) {
      setSelectedGrId(matchingGrs[0].id);
    } else {
      setSelectedGrId('');
    }
    // Reset overrides
    setItemBilledOverrides({});
  };

  // Format currency helper
  const formatAmount = (amount: number, curr: SupportedCurrency) => {
    if (curr === 'IDR') return formatIDR(amount);
    const info = FX_RATES[curr] || FX_RATES.USD;
    return `${info.symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Filtered Bills List
  const filteredBills = useMemo(() => {
    return vendorBills.filter((bill) => {
      // Store filter
      if (selectedStore !== 'CONSOLIDATED' && bill.storeId !== selectedStore) {
        return false;
      }
      // Status filter
      if (statusFilter === 'UNPAID') {
        if (bill.paymentStatus !== 'UNPAID' && bill.paymentStatus !== 'PARTIALLY_PAID') return false;
      } else if (statusFilter === 'PAID') {
        if (bill.paymentStatus !== 'PAID') return false;
      } else if (statusFilter === 'APPROVED') {
        if (bill.status !== 'APPROVED') return false;
      } else if (statusFilter === 'VARIANCE') {
        if (bill.status !== 'PRICE_VARIANCE' && bill.status !== 'QTY_VARIANCE') return false;
      }
      // Currency filter
      if (displayCurrency !== 'ALL' && bill.currency !== displayCurrency) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesBill = bill.billNumber.toLowerCase().includes(q) || bill.id.toLowerCase().includes(q);
        const matchesSupplier = bill.supplierName.toLowerCase().includes(q);
        const matchesPo = bill.poId.toLowerCase().includes(q);
        const matchesGr = bill.goodsReceiptId.toLowerCase().includes(q);
        return matchesBill || matchesSupplier || matchesPo || matchesGr;
      }
      return true;
    });
  }, [vendorBills, selectedStore, statusFilter, displayCurrency, searchQuery]);

  // Aggregate KPIs
  const stats = useMemo(() => {
    let totalApIDR = 0;
    let unpaidCount = 0;
    let paidTotalIDR = 0;
    let varianceCount = 0;

    vendorBills.forEach((b) => {
      if (selectedStore === 'CONSOLIDATED' || b.storeId === selectedStore) {
        if (b.paymentStatus === 'UNPAID' || b.paymentStatus === 'PARTIALLY_PAID') {
          totalApIDR += b.remainingDue * b.exchangeRate;
          unpaidCount += 1;
        }
        if (b.paymentStatus === 'PAID') {
          paidTotalIDR += b.grandTotalIDR;
        }
        if (b.status === 'PRICE_VARIANCE' || b.status === 'QTY_VARIANCE') {
          varianceCount += 1;
        }
      }
    });

    return { totalApIDR, unpaidCount, paidTotalIDR, varianceCount };
  }, [vendorBills, selectedStore]);

  // Handle Create Vendor Bill
  const handleCreateVendorBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPoId || !selectedGrId || !invoiceNumberInput.trim()) {
      onShowToast('Missing Fields', 'Please select a PO, Goods Receipt, and provide the Supplier Invoice Number.');
      return;
    }

    setIsSubmittingBill(true);
    try {
      const itemsPayload = (activeSelectedPO?.items || []).map((poItem) => {
        const grItem = activeSelectedGR?.items.find((g) => g.sku === poItem.sku);
        const defaultQty = grItem ? grItem.quantityReceived : poItem.orderedQuantity;
        const defaultCost = currencyInput === 'IDR' ? poItem.unitCost : poItem.unitCost / FX_RATES[currencyInput].rate;

        const override = itemBilledOverrides[poItem.sku];
        return {
          sku: poItem.sku,
          productName: poItem.productName,
          billedQuantity: override ? override.billedQty : defaultQty,
          unitCost: override ? override.unitCost : defaultCost,
          notes: override ? override.notes : '',
        };
      });

      const res = await apiClient.createVendorBill({
        billNumber: invoiceNumberInput.trim(),
        poId: selectedPoId,
        goodsReceiptId: selectedGrId,
        supplierName: activeSelectedPO?.supplierName,
        supplierContact: activeSelectedPO?.supplierContact,
        storeId: activeSelectedPO?.storeId,
        storeName: activeSelectedPO?.storeName,
        deliveryNoteNumber: activeSelectedGR?.deliveryNoteNumber,
        billDate: billDateInput,
        paymentTerms: paymentTermsInput,
        currency: currencyInput,
        exchangeRate: FX_RATES[currencyInput].rate,
        items: itemsPayload,
        taxPercent: taxPercentInput,
        notes: billNotesInput.trim(),
        autoApprove: autoApproveInput,
      });

      if (res.success) {
        onShowToast(
          'Vendor Bill Created',
          res.message || `Bill #${res.vendorBill.id} successfully recorded and linked to Accounts Payable.`
        );
        setIsCreateModalOpen(false);
        setInvoiceNumberInput('');
        setBillNotesInput('');
        setItemBilledOverrides({});
        onRefreshData();
      }
    } catch (err: any) {
      onShowToast('Error Creating Bill', err.message || 'Failed to process vendor bill matching');
    } finally {
      setIsSubmittingBill(false);
    }
  };

  // Handle Approve Bill
  const handleApproveBill = async (billId: string) => {
    try {
      const res = await apiClient.approveVendorBill(billId, 'Finance Lead (ERP)');
      if (res.success) {
        onShowToast('Bill Approved', res.message || `Vendor Bill #${billId} approved and posted to General Ledger.`);
        onRefreshData();
      }
    } catch (err: any) {
      onShowToast('Approval Failed', err.message || 'Could not approve bill');
    }
  };

  // Handle Open Payment Modal
  const handleOpenPayment = (bill: VendorBill) => {
    setBillToPay(bill);
    setPayAmountInput(bill.remainingDue);
    setPayMethodInput('BANK_TRANSFER');
    setPayRefInput(`TRF-BCA-${Date.now().toString().slice(-6)}`);
    setPayNotesInput('');
  };

  // Submit Payment
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billToPay || payAmountInput <= 0) return;

    setIsSubmittingPayment(true);
    try {
      const res = await apiClient.payVendorBill(billToPay.id, {
        amountPaid: payAmountInput,
        paymentMethod: payMethodInput,
        paymentReference: payRefInput.trim(),
        notes: payNotesInput.trim(),
      });

      if (res.success) {
        onShowToast('Payment Recorded', res.message || 'Vendor settlement successfully posted to General Ledger.');
        setBillToPay(null);
        onRefreshData();
      }
    } catch (err: any) {
      onShowToast('Payment Error', err.message || 'Failed to record payment');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className={`text-xl font-bold tracking-tight ${isLight ? 'text-gray-900' : 'text-white'}`}>
              Vendor Bills &amp; Accounts Payable
            </h2>
            <span
              className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${
                isLight
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
              }`}
            >
              3-Way Match Verified
            </span>
          </div>
          <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-zinc-300'} mt-1`}>
            Reconcile supplier invoices with Purchase Orders &amp; Goods Receipts (GR), automate Indonesian PPN (11%) &amp; multi-currency accounting.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefreshData}
            className={`p-2 rounded-lg border text-xs flex items-center gap-1.5 transition-colors ${
              isLight
                ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
            }`}
            title="Refresh Vendor Bills"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#0F4C3A] hover:bg-[#0c3d2e] text-white shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Vendor Bill (3-Way Match)</span>
          </button>
        </div>
      </div>

      {/* 2. Enterprise SaaS KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          className={`p-4 rounded-xl border transition-all ${
            isLight ? 'bg-white border-gray-200/90 shadow-sm' : 'bg-zinc-900/90 border-zinc-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${isLight ? 'text-gray-500' : 'text-zinc-300'}`}>
              Total Accounts Payable
            </span>
            <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className={`text-xl font-bold font-mono mt-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>
            {formatIDR(stats.totalApIDR)}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-1">
            <span>{stats.unpaidCount} bills due for settlement</span>
            <span aria-hidden="true">·</span>
            <span>COA #2010</span>
          </div>
        </div>

        <div
          className={`p-4 rounded-xl border transition-all ${
            isLight ? 'bg-white border-gray-200/90 shadow-sm' : 'bg-zinc-900/90 border-zinc-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${isLight ? 'text-gray-500' : 'text-zinc-300'}`}>
              3-Way Match Compliance
            </span>
            <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className={`text-xl font-bold font-mono mt-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>
            {vendorBills.length > 0
              ? `${Math.round(((vendorBills.length - stats.varianceCount) / vendorBills.length) * 100)}%`
              : '100%'}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-1">
            <span>PO + GR + Bill alignment</span>
            <span aria-hidden="true">·</span>
            <span>Zero variance</span>
          </div>
        </div>

        <div
          className={`p-4 rounded-xl border transition-all ${
            isLight ? 'bg-white border-gray-200/90 shadow-sm' : 'bg-zinc-900/90 border-zinc-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${isLight ? 'text-gray-500' : 'text-zinc-300'}`}>
              Variance Flagged
            </span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className={`text-xl font-bold font-mono mt-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>
            {stats.varianceCount}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-1">
            <span>Price or quantity discrepancies</span>
            <span aria-hidden="true">·</span>
            <span>Requires sign-off</span>
          </div>
        </div>

        <div
          className={`p-4 rounded-xl border transition-all ${
            isLight ? 'bg-white border-gray-200/90 shadow-sm' : 'bg-zinc-900/90 border-zinc-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${isLight ? 'text-gray-500' : 'text-zinc-300'}`}>
              Disbursed (Settled)
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className={`text-xl font-bold font-mono mt-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>
            {formatIDR(stats.paidTotalIDR)}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-1">
            <span>BCA Clearing &amp; Cash float</span>
            <span aria-hidden="true">·</span>
            <span>COA #1020</span>
          </div>
        </div>
      </div>

      {/* 3. Filter Controls & Search */}
      <div
        className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 ${
          isLight ? 'bg-white border-gray-200/90 shadow-sm' : 'bg-zinc-900/90 border-zinc-800'
        }`}
      >
        <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-slate-100 dark:bg-zinc-800/80 rounded-lg">
          {[
            { id: 'ALL', label: 'All Bills' },
            { id: 'UNPAID', label: 'Due / Unpaid' },
            { id: 'APPROVED', label: 'Approved' },
            { id: 'PAID', label: 'Paid' },
            { id: 'VARIANCE', label: 'Discrepancies' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                statusFilter === tab.id
                  ? isLight
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'bg-zinc-700 text-white shadow-sm'
                  : isLight
                  ? 'text-gray-600 hover:text-gray-900'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Currency Switcher */}
          <div className="flex items-center gap-1 text-xs">
            <span className={`text-[11px] ${isLight ? 'text-gray-500' : 'text-zinc-300'}`}>Currency:</span>
            <select
              value={displayCurrency}
              onChange={(e) => setDisplayCurrency(e.target.value as any)}
              className={`py-1.5 px-2.5 rounded-lg border text-xs font-mono font-semibold transition-colors focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                isLight ? 'bg-white border-gray-200 text-gray-800' : 'bg-zinc-950 border-zinc-700 text-zinc-200'
              }`}
            >
              <option value="ALL">All Currencies</option>
              <option value="IDR">IDR (Rp)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="AUD">AUD (A$)</option>
            </select>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${isLight ? 'text-gray-400' : 'text-zinc-300'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Bill #, PO, GR, Vendor..."
              className={`w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border transition-colors focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                isLight
                  ? 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                  : 'bg-zinc-950 border-zinc-700 text-white placeholder-zinc-500'
              }`}
            />
          </div>
        </div>
      </div>

      {/* 4. Modern Vendor Bills Table */}
      <div
        className={`rounded-xl border overflow-hidden ${
          isLight ? 'bg-white border-gray-200/90 shadow-sm' : 'bg-zinc-900/90 border-zinc-800'
        }`}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-xs">
            <thead>
              <tr
                className={`border-b text-[10px] uppercase font-semibold tracking-wider ${
                  isLight ? 'border-gray-200 bg-gray-50/70 text-gray-500' : 'border-zinc-800 bg-zinc-800/50 text-zinc-400'
                }`}
              >
                <th className="py-3 px-4">Bill &amp; Invoice #</th>
                <th className="py-3 px-4">Vendor &amp; Destination</th>
                <th className="py-3 px-4">PO &amp; GR Links</th>
                <th className="py-3 px-4">Due Date &amp; Terms</th>
                <th className="py-3 px-4 text-right">Invoice Amount</th>
                <th className="py-3 px-4 text-center">3-Way Match</th>
                <th className="py-3 px-4 text-center">Payment Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isLight ? 'divide-gray-200' : 'divide-zinc-800'}`}>
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={8} className={`py-12 text-center text-xs ${isLight ? 'text-gray-500' : 'text-zinc-300'}`}>
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    No vendor bills match the current filters.
                  </td>
                </tr>
              ) : (
                filteredBills.map((bill) => {
                  const isOverdue =
                    bill.paymentStatus !== 'PAID' && new Date(bill.dueDate) < new Date();

                  return (
                    <tr
                      key={bill.id}
                      className={`transition-colors ${
                        isLight ? 'hover:bg-gray-50/80' : 'hover:bg-zinc-800/40'
                      }`}
                    >
                      {/* Bill ID & Official Invoice Number */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-[#0F4C3A] dark:text-emerald-400">
                          {bill.id}
                        </div>
                        <div className={`text-[11px] font-mono ${isLight ? 'text-gray-700' : 'text-zinc-300'}`}>
                          {bill.billNumber}
                        </div>
                        <div className={`text-[10px] ${isLight ? 'text-gray-400' : 'text-zinc-300'}`}>
                          Issued: {bill.billDate}
                        </div>
                      </td>

                      {/* Vendor & Store */}
                      <td className="py-3.5 px-4">
                        <div className={`font-semibold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                          {bill.supplierName}
                        </div>
                        <div className={`text-[10px] ${isLight ? 'text-gray-500' : 'text-zinc-300'}`}>
                          {bill.storeName}
                        </div>
                      </td>

                      {/* PO & GR Links */}
                      <td className="py-3.5 px-4 font-mono text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span className="text-blue-600 dark:text-blue-400 font-semibold">{bill.poId}</span>
                          <span className="text-zinc-400">→</span>
                          <span className="text-emerald-600 dark:text-emerald-400">{bill.goodsReceiptId}</span>
                        </div>
                        {bill.deliveryNoteNumber && (
                          <div className={`text-[10px] ${isLight ? 'text-gray-400' : 'text-zinc-300'} mt-0.5`}>
                            SJ: {bill.deliveryNoteNumber}
                          </div>
                        )}
                      </td>

                      {/* Due Date & Terms */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-mono text-xs font-medium ${
                              isOverdue ? 'text-rose-600 font-bold dark:text-rose-400' : isLight ? 'text-gray-900' : 'text-white'
                            }`}
                          >
                            {bill.dueDate}
                          </span>
                          {isOverdue && (
                            <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">
                              Overdue
                            </span>
                          )}
                        </div>
                        <div className={`text-[10px] ${isLight ? 'text-gray-500' : 'text-zinc-300'}`}>
                          Terms: {bill.paymentTerms}
                        </div>
                      </td>

                      {/* Invoice Amount (Multi-currency & Statutory IDR) */}
                      <td className="py-3.5 px-4 text-right">
                        <div className={`font-mono font-bold text-xs ${isLight ? 'text-gray-900' : 'text-white'}`}>
                          {formatAmount(bill.grandTotal, bill.currency)}
                        </div>
                        {bill.currency !== 'IDR' && (
                          <div className="text-[10px] font-mono text-zinc-400">
                            ≈ {formatIDR(bill.grandTotalIDR)}
                          </div>
                        )}
                        <div className={`text-[10px] ${isLight ? 'text-gray-500' : 'text-zinc-300'}`}>
                          {bill.taxPercent > 0 ? `Incl. ${bill.taxPercent}% PPN` : 'Tax Exempt (0%)'}
                        </div>
                      </td>

                      {/* 3-Way Match Status */}
                      <td className="py-3.5 px-4 text-center">
                        {bill.status === 'MATCHED' || bill.status === 'APPROVED' || bill.status === 'PAID' ? (
                          <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Matched</span>
                          </div>
                        ) : bill.status === 'QTY_VARIANCE' ? (
                          <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                            <span>Qty Variance</span>
                          </div>
                        ) : bill.status === 'PRICE_VARIANCE' ? (
                          <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                            <span>Price Variance</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 text-[11px] text-zinc-400">
                            <span>Draft</span>
                          </div>
                        )}
                      </td>

                      {/* Payment Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            bill.paymentStatus === 'PAID'
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                              : bill.paymentStatus === 'PARTIALLY_PAID'
                              ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30'
                              : isOverdue
                              ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30'
                              : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                          }`}
                        >
                          {bill.paymentStatus === 'PAID'
                            ? 'Paid in Full'
                            : bill.paymentStatus === 'PARTIALLY_PAID'
                            ? 'Partially Paid'
                            : isOverdue
                            ? 'Past Due'
                            : 'Unpaid (Due)'}
                        </span>
                        {bill.paymentStatus === 'PARTIALLY_PAID' && (
                          <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                            Due: {formatAmount(bill.remainingDue, bill.currency)}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {bill.status !== 'APPROVED' && bill.status !== 'PAID' && (
                            <button
                              type="button"
                              onClick={() => handleApproveBill(bill.id)}
                              className="px-2.5 py-1 rounded text-[11px] font-semibold bg-emerald-700 text-white hover:bg-emerald-800 transition-colors"
                              title="Approve 3-Way Match & Post to GL"
                            >
                              Approve
                            </button>
                          )}

                          {bill.paymentStatus !== 'PAID' && (
                            <button
                              type="button"
                              onClick={() => handleOpenPayment(bill)}
                              className="px-2.5 py-1 rounded text-[11px] font-semibold bg-[#0F4C3A] text-white hover:bg-[#0c3d2e] transition-colors"
                            >
                              Pay Bill
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setSelectedBillForDetail(bill)}
                            className={`p-1.5 rounded transition-colors ${
                              isLight ? 'hover:bg-gray-100 text-gray-600' : 'hover:bg-zinc-800 text-zinc-300'
                            }`}
                            title="View Full Bill & GL Audit"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. CREATE VENDOR BILL MODAL (3-WAY MATCHING) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div
            className={`w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${
              isLight ? 'bg-white border-gray-200' : 'bg-zinc-900 border-zinc-800 text-white'
            }`}
          >
            {/* Modal Header */}
            <div className={`p-5 border-b flex items-center justify-between ${isLight ? 'border-gray-200 bg-gray-50/70' : 'border-zinc-800 bg-zinc-900/60'}`}>
              <div>
                <h3 className={`text-base font-bold flex items-center gap-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                  <FileCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  New Vendor Bill (3-Way Matching Engine)
                </h3>
                <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-zinc-300'} mt-0.5`}>
                  Reconcile purchase order terms with physical goods receipt records and automate Accounts Payable liabilities
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className={`p-1.5 rounded-lg ${isLight ? 'hover:bg-gray-200 text-gray-500' : 'hover:bg-zinc-800 text-zinc-400'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateVendorBill} className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Step 1: Select Upstream PO & Goods Receipt */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-800 dark:text-zinc-200">1. Purchase Order Reference *</label>
                  <select
                    value={selectedPoId}
                    onChange={(e) => handleSelectPO(e.target.value)}
                    required
                    className={`w-full p-2 rounded-lg border text-xs font-mono font-semibold focus:ring-1 focus:ring-emerald-500 ${
                      isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-zinc-950 border-zinc-700 text-white'
                    }`}
                  >
                    <option value="">-- Choose Purchase Order --</option>
                    {purchaseOrders.map((po) => (
                      <option key={po.id} value={po.id}>
                        {po.id} • {po.supplierName} ({po.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-800 dark:text-zinc-200">2. Linked Goods Receipt (Dock Inward) *</label>
                  <select
                    value={selectedGrId}
                    onChange={(e) => setSelectedGrId(e.target.value)}
                    required
                    className={`w-full p-2 rounded-lg border text-xs font-mono font-semibold focus:ring-1 focus:ring-emerald-500 ${
                      isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-zinc-950 border-zinc-700 text-white'
                    }`}
                  >
                    <option value="">-- Choose Goods Receipt Record --</option>
                    {availableGRsForPO.map((gr) => (
                      <option key={gr.id} value={gr.id}>
                        {gr.id} • Surat Jalan #{gr.deliveryNoteNumber} ({gr.items.length} items)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Step 2: Invoice Details & Multi-Currency */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-800 dark:text-zinc-200">Supplier Invoice Number *</label>
                  <input
                    type="text"
                    required
                    value={invoiceNumberInput}
                    onChange={(e) => setInvoiceNumberInput(e.target.value)}
                    placeholder="e.g. INV-KSB-2026-088"
                    className={`w-full p-2 rounded-lg border font-mono text-xs focus:ring-1 focus:ring-emerald-500 ${
                      isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-zinc-950 border-zinc-700 text-white'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-800 dark:text-zinc-200">Invoice Date *</label>
                  <input
                    type="date"
                    required
                    value={billDateInput}
                    onChange={(e) => setBillDateInput(e.target.value)}
                    className={`w-full p-2 rounded-lg border font-mono text-xs focus:ring-1 focus:ring-emerald-500 ${
                      isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-zinc-950 border-zinc-700 text-white'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-800 dark:text-zinc-200">Payment Terms</label>
                  <select
                    value={paymentTermsInput}
                    onChange={(e) => setPaymentTermsInput(e.target.value as any)}
                    className={`w-full p-2 rounded-lg border text-xs focus:ring-1 focus:ring-emerald-500 ${
                      isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-zinc-950 border-zinc-700 text-white'
                    }`}
                  >
                    <option value="COD">COD (Immediate Cash)</option>
                    <option value="Net 7">Net 7 Days</option>
                    <option value="Net 14">Net 14 Days</option>
                    <option value="Net 30">Net 30 Days (Standard)</option>
                    <option value="Net 60">Net 60 Days</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-800 dark:text-zinc-200">Currency</label>
                  <select
                    value={currencyInput}
                    onChange={(e) => setCurrencyInput(e.target.value as any)}
                    className={`w-full p-2 rounded-lg border text-xs font-mono font-semibold focus:ring-1 focus:ring-emerald-500 ${
                      isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-zinc-950 border-zinc-700 text-white'
                    }`}
                  >
                    <option value="IDR">IDR (Rp) • Local Base</option>
                    <option value="USD">USD ($) • Rate: 16,000</option>
                    <option value="EUR">EUR (€) • Rate: 17,200</option>
                    <option value="AUD">AUD (A$) • Rate: 10,400</option>
                  </select>
                </div>
              </div>

              {/* Tax & PPN Configuration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-800 dark:text-zinc-200">Indonesian VAT / PPN Calculation</label>
                  <select
                    value={taxPercentInput}
                    onChange={(e) => setTaxPercentInput(Number(e.target.value))}
                    className={`w-full p-2 rounded-lg border text-xs focus:ring-1 focus:ring-emerald-500 ${
                      isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-zinc-950 border-zinc-700 text-white'
                    }`}
                  >
                    <option value={11}>Standard PPN 11% (Commercial Processed)</option>
                    <option value={0}>0% Tax Exempt (Direct Farm Fresh Produce)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-800 dark:text-zinc-200">Auditor / Accounting Notes</label>
                  <input
                    type="text"
                    value={billNotesInput}
                    onChange={(e) => setBillNotesInput(e.target.value)}
                    placeholder="e.g. Verified cold-chain receipt dock 2"
                    className={`w-full p-2 rounded-lg border text-xs focus:ring-1 focus:ring-emerald-500 ${
                      isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-zinc-950 border-zinc-700 text-white'
                    }`}
                  />
                </div>
              </div>

              {/* Step 3: Line Item 3-Way Match Verification */}
              {activeSelectedPO && (
                <div
                  className={`p-4 rounded-xl border space-y-3 ${
                    isLight ? 'bg-gray-50/70 border-gray-200' : 'bg-zinc-950 border-zinc-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs uppercase tracking-wider text-zinc-400">
                      3-Way Line Item Match Breakdown
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      PO: <strong className="text-blue-500">{activeSelectedPO.id}</strong> • GR: <strong className="text-emerald-500">{activeSelectedGR?.id || 'None'}</strong>
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b text-[10px] uppercase font-semibold text-zinc-400">
                          <th className="py-2">Item Description</th>
                          <th className="py-2 text-center">PO Qty</th>
                          <th className="py-2 text-center">GR Inward Qty</th>
                          <th className="py-2 text-center">Billed Qty</th>
                          <th className="py-2 text-right">Unit Cost</th>
                          <th className="py-2 text-right">Line Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                        {activeSelectedPO.items.map((it) => {
                          const grItem = activeSelectedGR?.items.find((g) => g.sku === it.sku);
                          const grQty = grItem ? grItem.quantityReceived : 0;
                          const override = itemBilledOverrides[it.sku];
                          const billedQty = override !== undefined ? override.billedQty : grQty || it.orderedQuantity;
                          const defaultCost = currencyInput === 'IDR' ? it.unitCost : it.unitCost / FX_RATES[currencyInput].rate;
                          const unitCost = override !== undefined ? override.unitCost : defaultCost;
                          const lineTotal = billedQty * unitCost;

                          const hasQtyMismatch = billedQty !== grQty && grQty > 0;

                          return (
                            <tr key={it.sku} className="py-2">
                              <td className="py-2.5">
                                <div className="font-semibold">{it.productName}</div>
                                <div className="font-mono text-[10px] text-zinc-400">{it.sku}</div>
                              </td>
                              <td className="py-2.5 text-center font-mono">{it.orderedQuantity}</td>
                              <td className="py-2.5 text-center font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                                {grQty}
                              </td>
                              <td className="py-2.5 text-center">
                                <input
                                  type="number"
                                  min={0}
                                  value={billedQty}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setItemBilledOverrides((prev) => ({
                                      ...prev,
                                      [it.sku]: {
                                        billedQty: val,
                                        unitCost: prev[it.sku]?.unitCost ?? unitCost,
                                        notes: prev[it.sku]?.notes ?? '',
                                      },
                                    }));
                                  }}
                                  className={`w-16 p-1 text-center font-mono rounded border text-xs ${
                                    hasQtyMismatch ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40' : ''
                                  }`}
                                />
                              </td>
                              <td className="py-2.5 text-right font-mono">
                                <input
                                  type="number"
                                  step="any"
                                  value={unitCost}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setItemBilledOverrides((prev) => ({
                                      ...prev,
                                      [it.sku]: {
                                        billedQty: prev[it.sku]?.billedQty ?? billedQty,
                                        unitCost: val,
                                        notes: prev[it.sku]?.notes ?? '',
                                      },
                                    }));
                                  }}
                                  className="w-24 p-1 text-right font-mono rounded border text-xs"
                                />
                              </td>
                              <td className="py-2.5 text-right font-mono font-bold">
                                {formatAmount(lineTotal, currencyInput)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Step 4: Accounting Impact Live Preview */}
              <div
                className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                  isLight ? 'bg-emerald-50/50 border-emerald-200' : 'bg-emerald-950/20 border-emerald-800/40 text-emerald-200'
                }`}
              >
                <div className="font-bold flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
                  <ShieldCheck className="w-4 h-4" />
                  General Ledger Automated Mapping Preview
                </div>
                <div className="font-mono text-[11px] space-y-1">
                  <div>• <strong>Debit 1040 (Merchandise Inventory Asset)</strong>: +Subtotal Asset Value</div>
                  {taxPercentInput > 0 && (
                    <div>• <strong>Debit 1140 (Input VAT / Pajak Masukan 11%)</strong>: +VAT Credit Receivable</div>
                  )}
                  <div>• <strong>Credit 2010 (Trade Accounts Payable)</strong>: +Liability recognized for vendor settlement</div>
                </div>
              </div>

              {/* Checkbox for Immediate Approval */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoApproveInput}
                  onChange={(e) => setAutoApproveInput(e.target.checked)}
                  className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-medium text-xs">
                  Auto-Approve &amp; post liability immediately to Accounts Payable (COA #2010)
                </span>
              </label>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    isLight ? 'hover:bg-gray-100 text-gray-700' : 'hover:bg-zinc-800 text-zinc-300'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBill}
                  className="px-5 py-2 rounded-lg font-semibold bg-[#0F4C3A] hover:bg-[#0c3d2e] text-white shadow transition-all disabled:opacity-50"
                >
                  {isSubmittingBill ? 'Processing 3-Way Match...' : 'Confirm & Post Vendor Bill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. SETTLE / RECORD PAYMENT MODAL */}
      {billToPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div
            className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden ${
              isLight ? 'bg-white border-gray-200' : 'bg-zinc-900 border-zinc-800 text-white'
            }`}
          >
            <div className={`p-5 border-b flex items-center justify-between ${isLight ? 'border-gray-200 bg-gray-50/70' : 'border-zinc-800 bg-zinc-900/60'}`}>
              <div>
                <h3 className={`text-base font-bold flex items-center gap-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                  <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Record Vendor Payment (Disbursement)
                </h3>
                <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-zinc-300'} mt-0.5`}>
                  Settling {billToPay.billNumber} • {billToPay.supplierName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBillToPay(null)}
                className={`p-1.5 rounded-lg ${isLight ? 'hover:bg-gray-200 text-gray-500' : 'hover:bg-zinc-800 text-zinc-400'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="p-6 space-y-4 text-xs">
              <div
                className={`p-3 rounded-lg border flex items-center justify-between ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-zinc-950 border-zinc-800'
                }`}
              >
                <div>
                  <div className="text-[10px] text-zinc-400 uppercase">Total Bill Balance</div>
                  <div className="text-base font-bold font-mono">
                    {formatAmount(billToPay.grandTotal, billToPay.currency)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-zinc-400 uppercase">Remaining Due</div>
                  <div className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {formatAmount(billToPay.remainingDue, billToPay.currency)}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-800 dark:text-zinc-200">Settlement Payment Amount ({billToPay.currency}) *</label>
                <input
                  type="number"
                  step="any"
                  required
                  min={0.01}
                  max={billToPay.remainingDue}
                  value={payAmountInput}
                  onChange={(e) => setPayAmountInput(Number(e.target.value))}
                  className={`w-full p-2.5 rounded-lg border font-mono text-sm font-bold focus:ring-1 focus:ring-emerald-500 ${
                    isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-zinc-950 border-zinc-700 text-white'
                  }`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-800 dark:text-zinc-200">Disbursement Channel</label>
                  <select
                    value={payMethodInput}
                    onChange={(e) => setPayMethodInput(e.target.value as any)}
                    className={`w-full p-2 rounded-lg border text-xs focus:ring-1 focus:ring-emerald-500 ${
                      isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-zinc-950 border-zinc-700 text-white'
                    }`}
                  >
                    <option value="BANK_TRANSFER">Bank BCA Operational Clearing (1020)</option>
                    <option value="GIRO">Corporate Giro / Check Clearing</option>
                    <option value="CASH">Store Cash Float (1010)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-800 dark:text-zinc-200">Payment Reference / Trx ID *</label>
                  <input
                    type="text"
                    required
                    value={payRefInput}
                    onChange={(e) => setPayRefInput(e.target.value)}
                    placeholder="e.g. TRF-BCA-98124"
                    className={`w-full p-2 rounded-lg border font-mono text-xs focus:ring-1 focus:ring-emerald-500 ${
                      isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-zinc-950 border-zinc-700 text-white'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-800 dark:text-zinc-200">Settlement Notes</label>
                <input
                  type="text"
                  value={payNotesInput}
                  onChange={(e) => setPayNotesInput(e.target.value)}
                  placeholder="e.g. Cleared via corporate online treasury"
                  className={`w-full p-2 rounded-lg border text-xs focus:ring-1 focus:ring-emerald-500 ${
                    isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-zinc-950 border-zinc-700 text-white'
                  }`}
                />
              </div>

              {/* Double Entry Explanation */}
              <div
                className={`p-3 rounded-lg border text-[11px] font-mono space-y-1 ${
                  isLight ? 'bg-blue-50/60 border-blue-200 text-blue-950' : 'bg-blue-950/20 border-blue-800/40 text-blue-200'
                }`}
              >
                <div>• <strong>Debit 2010 (Trade Accounts Payable)</strong>: -Liability reduced</div>
                <div>• <strong>Credit {payMethodInput === 'CASH' ? '1010 (Cash on Hand)' : '1020 (Bank BCA Clearing)'}</strong>: -Cash asset disbursed</div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setBillToPay(null)}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    isLight ? 'hover:bg-gray-100 text-gray-700' : 'hover:bg-zinc-800 text-zinc-300'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="px-5 py-2 rounded-lg font-semibold bg-[#0F4C3A] hover:bg-[#0c3d2e] text-white shadow transition-all disabled:opacity-50"
                >
                  {isSubmittingPayment ? 'Posting Disbursement...' : 'Execute Settlement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. BILL DETAIL & PRINTABLE TAX INVOICE VOUCHER MODAL */}
      {selectedBillForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div
            className={`w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${
              isLight ? 'bg-white border-gray-200' : 'bg-zinc-900 border-zinc-800 text-white'
            }`}
          >
            <div className={`p-5 border-b flex items-center justify-between ${isLight ? 'border-gray-200 bg-gray-50/70' : 'border-zinc-800 bg-zinc-900/60'}`}>
              <div>
                <h3 className={`text-base font-bold flex items-center gap-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                  <Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Official Vendor Bill Audit Voucher
                </h3>
                <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-zinc-300'} mt-0.5 font-mono`}>
                  {selectedBillForDetail.id} • {selectedBillForDetail.billNumber}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 ${
                    isLight ? 'bg-white border-gray-300 hover:bg-gray-100' : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700'
                  }`}
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Slip</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedBillForDetail(null)}
                  className={`p-1.5 rounded-lg ${isLight ? 'hover:bg-gray-200 text-gray-500' : 'hover:bg-zinc-800 text-zinc-400'}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-200 dark:border-zinc-800">
                <div>
                  <div className="text-[10px] text-zinc-400 uppercase font-semibold">Vendor Supplier</div>
                  <div className="text-sm font-bold mt-0.5">{selectedBillForDetail.supplierName}</div>
                  <div className="text-[11px] text-zinc-400">{selectedBillForDetail.supplierContact}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-zinc-400 uppercase font-semibold">Receiving Store Outlet</div>
                  <div className="text-sm font-bold mt-0.5">{selectedBillForDetail.storeName}</div>
                  <div className="text-[11px] text-zinc-400">PO #{selectedBillForDetail.poId} • GR #{selectedBillForDetail.goodsReceiptId}</div>
                </div>
              </div>

              {/* 3-Way Match Verification Card */}
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-zinc-950 border-zinc-800'
                }`}
              >
                <div>
                  <div className="text-[10px] text-zinc-400 uppercase font-semibold">3-Way Match Status</div>
                  <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {selectedBillForDetail.status}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-400 uppercase font-semibold">Payment Terms</div>
                  <div className="text-sm font-bold mt-0.5">{selectedBillForDetail.paymentTerms}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-zinc-400 uppercase font-semibold">Due Date</div>
                  <div className="text-sm font-mono font-bold mt-0.5">{selectedBillForDetail.dueDate}</div>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <div className="text-[10px] uppercase font-bold text-zinc-400 mb-2">Reconciled Line Items</div>
                <table className="w-full text-left text-xs border border-slate-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                  <thead className={isLight ? 'bg-slate-100 text-slate-600' : 'bg-zinc-800/80 text-zinc-300'}>
                    <tr className="border-b border-slate-200 dark:border-zinc-800 text-[10px] uppercase">
                      <th className="py-2 px-3">Item / SKU</th>
                      <th className="py-2 px-3 text-center">PO Qty</th>
                      <th className="py-2 px-3 text-center">GR Qty</th>
                      <th className="py-2 px-3 text-center">Billed Qty</th>
                      <th className="py-2 px-3 text-right">Unit Price</th>
                      <th className="py-2 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                    {selectedBillForDetail.items.map((it) => (
                      <tr key={it.sku}>
                        <td className="py-2 px-3">
                          <div className="font-semibold">{it.productName}</div>
                          <div className="font-mono text-[10px] text-zinc-400">{it.sku}</div>
                        </td>
                        <td className="py-2 px-3 text-center font-mono">{it.poQuantity}</td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-emerald-600">{it.grQuantity}</td>
                        <td className="py-2 px-3 text-center font-mono font-bold">{it.billedQuantity}</td>
                        <td className="py-2 px-3 text-right font-mono">
                          {formatAmount(it.unitCost, selectedBillForDetail.currency)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold">
                          {formatAmount(it.totalCost, selectedBillForDetail.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Totals */}
              <div className="border-t border-slate-200 dark:border-zinc-800 pt-3 space-y-1.5 text-right font-mono">
                <div className="flex justify-between text-zinc-400">
                  <span>Subtotal:</span>
                  <span>{formatAmount(selectedBillForDetail.subtotal, selectedBillForDetail.currency)}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>PPN ({selectedBillForDetail.taxPercent}%):</span>
                  <span>{formatAmount(selectedBillForDetail.taxAmount, selectedBillForDetail.currency)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-emerald-600 dark:text-emerald-400 pt-1 border-t border-slate-200 dark:border-zinc-800">
                  <span>Grand Total:</span>
                  <span>{formatAmount(selectedBillForDetail.grandTotal, selectedBillForDetail.currency)}</span>
                </div>
                {selectedBillForDetail.currency !== 'IDR' && (
                  <div className="text-[11px] text-zinc-400">
                    Base Conversion (Statutory IDR): {formatIDR(selectedBillForDetail.grandTotalIDR)}
                  </div>
                )}
                <div className="flex justify-between text-zinc-400 pt-1">
                  <span>Amount Settled / Paid:</span>
                  <span className="text-emerald-500 font-bold">
                    {formatAmount(selectedBillForDetail.amountPaid, selectedBillForDetail.currency)}
                  </span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Outstanding Balance Due:</span>
                  <span className={selectedBillForDetail.remainingDue > 0 ? 'text-amber-500' : 'text-zinc-300'}>
                    {formatAmount(selectedBillForDetail.remainingDue, selectedBillForDetail.currency)}
                  </span>
                </div>
              </div>

              {/* General Ledger Vouchers */}
              {selectedBillForDetail.glEntryIds && selectedBillForDetail.glEntryIds.length > 0 && (
                <div
                  className={`p-3 rounded-lg border font-mono text-[11px] space-y-1 ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-zinc-950 border-zinc-800'
                  }`}
                >
                  <div className="font-bold text-zinc-400 uppercase text-[10px]">General Ledger Audit Links</div>
                  <div className="text-blue-600 dark:text-blue-400">
                    Vouchers: {selectedBillForDetail.glEntryIds.join(', ')}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
