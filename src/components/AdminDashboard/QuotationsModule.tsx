import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import type {
  EnterpriseQuotation,
  EnterpriseSettingsConfig,
  InventoryItem,
} from '../../types/index.ts';
import { apiClient } from '../../services/apiClient';
import { formatIDR } from '../../utils/formatters';
import { usePrint } from '../../context/PrintContext';
import {
  FileSpreadsheet,
  Plus,
  Search,
  RefreshCw,
  PenTool,
  Printer,
  ArrowRightCircle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  X,
  Trash2,
  Mail,
  MessageCircle,
} from 'lucide-react';
import { DocumentDispatchModal } from './DocumentDispatchModal';

interface QuotationsModuleProps {
  theme: 'light' | 'dark';
  inventory: InventoryItem[];
  enterpriseSettings?: EnterpriseSettingsConfig | null;
  onRefreshData: () => void;
  onShowToast: (title: string, message: string) => void;
}

export const QuotationsModule: React.FC<QuotationsModuleProps> = ({
  theme,
  inventory,
  enterpriseSettings,
  onRefreshData,
  onShowToast,
}) => {
  const isLight = theme === 'light';
  const { triggerPrint } = usePrint();

  const [quotations, setQuotations] = useState<EnterpriseQuotation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SENT' | 'CONFIRMED' | 'CONVERTED_TO_ORDER'>('ALL');

  // Create Quotation Modal State
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerCompany, setCustomerCompany] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('+62 811 ');
  const [isProForma, setIsProForma] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');
  const [draftLines, setDraftLines] = useState<Array<{
    sku: string;
    productName: string;
    category: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    unitCost: number;
  }>>([]);
  const [selectedSkuToAdd, setSelectedSkuToAdd] = useState<string>('');
  const [qtyToAdd, setQtyToAdd] = useState<number>(10);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState<boolean>(false);

  // Digital Signature Modal State
  const [signingQuote, setSigningQuote] = useState<EnterpriseQuotation | null>(null);
  const [signerName, setSignerName] = useState<string>('');
  const [hasDrawnSignature, setHasDrawnSignature] = useState<boolean>(false);
  const [isSigningSubmit, setIsSigningSubmit] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef<boolean>(false);

  // Convert loading state
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [dispatchQuote, setDispatchQuote] = useState<{
    quote: EnterpriseQuotation;
    channel: 'email' | 'whatsapp';
  } | null>(null);

  const loadQuotations = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.getEnterpriseQuotations();
      setQuotations(res);
    } catch (err) {
      console.error('Failed to load quotations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadQuotations();
  }, []);

  useEffect(() => {
    if (!selectedSkuToAdd && inventory.length > 0) {
      setSelectedSkuToAdd(inventory[0].sku);
    }
  }, [inventory, selectedSkuToAdd]);

  const quoteRules = enterpriseSettings?.quotationsAndSales;

  const filteredQuotations = useMemo(() => {
    return quotations.filter((q) => {
      if (statusFilter !== 'ALL' && q.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const s = searchQuery.toLowerCase();
        return (
          q.quotationNumber.toLowerCase().includes(s) ||
          q.customerName.toLowerCase().includes(s) ||
          (q.customerCompany && q.customerCompany.toLowerCase().includes(s))
        );
      }
      return true;
    });
  }, [quotations, statusFilter, searchQuery]);

  const stats = useMemo(() => {
    const total = quotations.length;
    const pendingSig = quotations.filter((q) => q.signatureStatus === 'PENDING' && q.status === 'SENT').length;
    const confirmed = quotations.filter((q) => q.status === 'CONFIRMED').length;
    const converted = quotations.filter((q) => q.status === 'CONVERTED_TO_ORDER').length;
    const pipelineIDR = quotations
      .filter((q) => q.status !== 'EXPIRED')
      .reduce((s, q) => s + q.total, 0);
    return { total, pendingSig, confirmed, converted, pipelineIDR };
  }, [quotations]);

  const handleAddLineItem = () => {
    const inv = inventory.find((i) => i.sku === selectedSkuToAdd);
    if (!inv || qtyToAdd <= 0) return;

    setDraftLines((prev) => {
      const existingIdx = prev.findIndex((l) => l.sku === inv.sku);
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = { ...next[existingIdx], quantity: next[existingIdx].quantity + qtyToAdd };
        return next;
      }
      const estimatedSellPrice = Math.max(inv.unitCost * 1.38, inv.unitCost + 5000);
      return [
        ...prev,
        {
          sku: inv.sku,
          productName: inv.productName,
          category: inv.category,
          quantity: qtyToAdd,
          unit: inv.unit,
          unitPrice: Math.round(estimatedSellPrice / 100) * 100,
          unitCost: inv.unitCost,
        },
      ];
    });
  };

  // Check if mandatory HACCP packaging rule triggers on current draft lines
  const triggeredMandatoryRules = useMemo(() => {
    if (!quoteRules?.mandatoryProductsEnabled) return [];
    return (quoteRules.mandatoryRules || []).filter(
      (rule) =>
        draftLines.some((l) => l.category === rule.targetCategory) &&
        !draftLines.some((l) => l.sku === rule.mandatorySku)
    );
  }, [draftLines, quoteRules]);

  const draftTotals = useMemo(() => {
    const itemsSub = draftLines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
    const mandatorySub = triggeredMandatoryRules.reduce((s, r) => s + r.mandatoryPriceIDR, 0);
    const subtotal = itemsSub + mandatorySub;
    const taxAmount = Math.round(subtotal * 0.11);
    const total = subtotal + taxAmount;
    const threshold = quoteRules?.paymentConfirmationThreshold || 'DEPOSIT_50';
    const depositPct = threshold === 'FULL_100' ? 100 : threshold === 'PAY_ON_DELIVERY' ? 0 : 50;
    const depositAmount = Math.round((total * depositPct) / 100);
    return { subtotal, taxAmount, total, depositPct, depositAmount };
  }, [draftLines, triggeredMandatoryRules, quoteRules]);

  const handleCreateQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || draftLines.length === 0) {
      onShowToast('Missing Information', 'Enter customer name and at least one product line item.');
      return;
    }

    setIsSubmittingCreate(true);
    try {
      const payloadItems = draftLines.map((l) => ({
        sku: l.sku,
        productName: l.productName,
        category: l.category,
        quantity: l.quantity,
        unit: l.unit,
        unitPrice: l.unitPrice,
        unitCost: l.unitCost,
        lineTotal: l.quantity * l.unitPrice,
      }));
      const res = await apiClient.createEnterpriseQuotation({
        customerName: customerName.trim(),
        customerCompany: customerCompany.trim() || undefined,
        customerEmail: customerEmail.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        items: payloadItems,
        isProForma,
        notes: notes.trim() || undefined,
      });

      onShowToast('Quotation Generated', res.message);
      setIsCreateOpen(false);
      setCustomerName('');
      setCustomerCompany('');
      setCustomerEmail('');
      setNotes('');
      setDraftLines([]);
      await loadQuotations();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Failed to Create Quotation', msg);
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Canvas signature helpers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.strokeStyle = '#0F4C3A';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    isDrawingRef.current = true;
    setHasDrawnSignature(true);
  };

  const drawStroke = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawnSignature(false);
  };

  const handleOpenSign = (q: EnterpriseQuotation) => {
    setSigningQuote(q);
    setSignerName(q.customerName);
    setHasDrawnSignature(false);
  };

  const handleSubmitSignature = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signingQuote || !signerName.trim()) return;
    setIsSigningSubmit(true);
    try {
      const signatureDataUrl = hasDrawnSignature && canvasRef.current
        ? canvasRef.current.toDataURL('image/png')
        : undefined;
      const res = await apiClient.signEnterpriseQuotation(signingQuote.id, {
        signedBy: signerName.trim(),
        signatureDataUrl,
      });
      onShowToast('Digital Signature Recorded', res.message);
      setSigningQuote(null);
      await loadQuotations();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Signature Error', msg);
    } finally {
      setIsSigningSubmit(false);
    }
  };

  const handleConvertOrder = async (q: EnterpriseQuotation) => {
    setConvertingId(q.id);
    try {
      const res = await apiClient.convertQuotationToOrder(q.id);
      onShowToast('Converted to Order', res.message);
      await loadQuotations();
      onRefreshData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Conversion Failed', msg);
    } finally {
      setConvertingId(null);
    }
  };

  const cardClass = `rounded-xl border transition-all ${
    isLight ? 'bg-white border-gray-200/90 shadow-xs' : 'bg-zinc-900/90 border-zinc-800'
  }`;

  const inputClass = `w-full px-3 py-2 text-xs rounded-xl border transition-colors focus:outline-none focus:ring-1 focus:ring-emerald-600 ${
    isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-zinc-950 border-zinc-700 text-white'
  }`;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className={`text-xl font-bold tracking-tight ${isLight ? 'text-gray-900' : 'text-white'}`}>
              B2B Quotations &amp; Pro Forma Invoices
            </h2>
            <span className="text-[11px] font-medium text-gray-500 dark:text-zinc-400">
              {quoteRules?.mandatoryProductsEnabled ? 'HACCP Packaging Rules Active' : 'Standard Rules'}
            </span>
          </div>
          <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-zinc-300'} mt-1`}>
            Generate formal B2B quotations and pro forma invoices with digital customer signature capture and 1-click order conversion.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadQuotations}
            className={`p-2 rounded-xl border text-xs transition-colors ${
              isLight ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50' : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
            }`}
            title="Refresh Quotations"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#0F4C3A] hover:bg-[#0b382b] text-white shadow-xs transition-all whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>New Quotation</span>
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`${cardClass} p-4`}>
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-zinc-400">
            <span>Active Quote Pipeline</span>
            <FileSpreadsheet className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
          </div>
          <div className={`text-xl font-bold font-mono tabular-nums mt-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>
            {formatIDR(stats.pipelineIDR)}
          </div>
          <div className="text-[11px] text-gray-500 dark:text-zinc-400 mt-1">
            {stats.total} Total Quotations
          </div>
        </div>

        <div className={`${cardClass} p-4`}>
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-zinc-400">
            <span>Awaiting Signature</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className={`text-xl font-bold font-mono tabular-nums mt-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>
            {stats.pendingSig}
          </div>
          <div className="text-[11px] text-gray-500 dark:text-zinc-400 mt-1">
            {quoteRules?.onlineSignaturesRequired ? 'Online signature enforced' : 'Optional sign-off'}
          </div>
        </div>

        <div className={`${cardClass} p-4`}>
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-zinc-400">
            <span>Signed &amp; Confirmed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums mt-2 text-emerald-700 dark:text-emerald-400">
            {stats.confirmed}
          </div>
          <div className="text-[11px] text-gray-500 dark:text-zinc-400 mt-1">
            Ready to convert into fulfillment order
          </div>
        </div>

        <div className={`${cardClass} p-4`}>
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-zinc-400">
            <span>Converted to Orders</span>
            <ArrowRightCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className={`text-xl font-bold font-mono tabular-nums mt-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>
            {stats.converted}
          </div>
          <div className="text-[11px] text-gray-500 dark:text-zinc-400 mt-1">
            Validity window: {quoteRules?.defaultValidityDays ?? 14} days
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className={`${cardClass} p-4 flex flex-col md:flex-row md:items-center justify-between gap-3`}>
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-zinc-800/80 rounded-lg overflow-x-auto">
          {[
            { id: 'ALL', label: 'All Quotes' },
            { id: 'SENT', label: 'Sent / Pending Sign' },
            { id: 'CONFIRMED', label: 'Signed & Confirmed' },
            { id: 'CONVERTED_TO_ORDER', label: 'Converted' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                statusFilter === tab.id
                  ? isLight
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'bg-zinc-700 text-white shadow-xs'
                  : isLight
                  ? 'text-gray-600 hover:text-gray-900'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Quote #, Customer, Company..."
            className={`w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border focus:outline-none focus:ring-1 focus:ring-emerald-600 ${
              isLight ? 'bg-white border-gray-200 text-gray-900' : 'bg-zinc-950 border-zinc-700 text-white'
            }`}
          />
        </div>
      </div>

      {/* Quotations Table */}
      <div className={`${cardClass} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-xs">
            <thead>
              <tr className={`border-b text-[10px] uppercase font-semibold tracking-wider ${
                isLight ? 'border-gray-200 bg-gray-50/70 text-gray-500' : 'border-zinc-800 bg-zinc-800/50 text-zinc-400'
              }`}>
                <th className="py-3 px-4">Quote / Pro Forma #</th>
                <th className="py-3 px-4">Customer &amp; Company</th>
                <th className="py-3 px-4">Items &amp; Terms</th>
                <th className="py-3 px-4 text-right">Total (incl. PPN)</th>
                <th className="py-3 px-4 text-center">Signature</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isLight ? 'divide-gray-200' : 'divide-zinc-800'}`}>
              {filteredQuotations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-gray-500 dark:text-zinc-400">
                    {isLoading ? 'Loading quotations...' : 'No quotations found matching your filter.'}
                  </td>
                </tr>
              ) : (
                filteredQuotations.map((q) => (
                  <tr key={q.id} className={`transition-colors ${isLight ? 'hover:bg-gray-50/80' : 'hover:bg-zinc-800/40'}`}>
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-[#0F4C3A] dark:text-emerald-400">
                        {q.quotationNumber}
                      </div>
                      <div className="text-[10px] text-gray-500 dark:text-zinc-400 mt-0.5 font-mono">
                        {q.isProForma ? 'Pro Forma Invoice' : 'Formal Quotation'} · Exp {q.validUntil}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className={`font-semibold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                        {q.customerCompany || q.customerName}
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-zinc-400">
                        {q.customerName} · {q.customerPhone}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className={`font-medium ${isLight ? 'text-gray-800' : 'text-zinc-200'}`}>
                        {q.items.length} line items
                        {q.items.some((it) => it.isMandatoryAddon) && (
                          <span className="ml-1.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                            (+HACCP Pack)
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-500 dark:text-zinc-400 font-mono tabular-nums">
                        Deposit: {q.requiredDepositPercent}% ({formatIDR(q.depositAmount)})
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                      <div className={`font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                        {formatIDR(q.total)}
                      </div>
                      <div className="text-[10px] text-gray-500 dark:text-zinc-400">
                        Sub: {formatIDR(q.subtotal)}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {q.signatureStatus === 'SIGNED' ? (
                        <div>
                          <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">Signed</div>
                          <div className="text-[10px] text-gray-500 dark:text-zinc-400 truncate max-w-[120px] mx-auto">
                            {q.signedBy}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">Pending</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`text-[11px] font-semibold ${
                        q.status === 'CONVERTED_TO_ORDER'
                          ? 'text-blue-600 dark:text-blue-400'
                          : q.status === 'CONFIRMED'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-gray-600 dark:text-zinc-300'
                      }`}>
                        {q.status.replace(/_/g, ' ')}
                      </span>
                      {q.convertedOrderId && (
                        <div className="text-[10px] font-mono text-blue-600 dark:text-blue-400">
                          {q.convertedOrderId}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            triggerPrint({
                              type: 'quotation',
                              format: 'a4',
                              quotation: q,
                              termsText: quoteRules?.termsAndConditionsText,
                            })
                          }
                          className={`p-1.5 rounded-lg border transition-colors ${
                            isLight ? 'border-gray-200 text-gray-700 hover:bg-gray-50' : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                          }`}
                          title="Print / Save PDF Quotation"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setDispatchQuote({ quote: q, channel: 'email' })}
                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                            isLight ? 'border-gray-200 text-indigo-700 hover:bg-indigo-50' : 'border-zinc-700 text-indigo-300 hover:bg-zinc-800'
                          }`}
                          title="Email Quotation via SMTP"
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setDispatchQuote({ quote: q, channel: 'whatsapp' })}
                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                            isLight ? 'border-gray-200 text-emerald-700 hover:bg-emerald-50' : 'border-zinc-700 text-emerald-400 hover:bg-zinc-800'
                          }`}
                          title="Send Quotation via WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </button>

                        {q.signatureStatus === 'PENDING' && q.status !== 'CONVERTED_TO_ORDER' && (
                          <button
                            type="button"
                            onClick={() => handleOpenSign(q)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-amber-600 hover:bg-amber-700 text-white transition-colors"
                          >
                            <PenTool className="w-3 h-3" />
                            <span>Sign</span>
                          </button>
                        )}

                        {q.status !== 'CONVERTED_TO_ORDER' && (
                          <button
                            type="button"
                            disabled={convertingId === q.id || (Boolean(quoteRules?.onlineSignaturesRequired) && q.signatureStatus !== 'SIGNED')}
                            onClick={() => handleConvertOrder(q)}
                            title={
                              quoteRules?.onlineSignaturesRequired && q.signatureStatus !== 'SIGNED'
                                ? 'Online signature is required by Sales Policy before converting'
                                : 'Convert quotation to active order'
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-[#0F4C3A] hover:bg-[#0b382b] text-white transition-colors disabled:opacity-45"
                          >
                            <ArrowRightCircle className="w-3 h-3" />
                            <span>{convertingId === q.id ? 'Converting...' : 'Convert Order'}</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE QUOTATION MODAL */}
      {isCreateOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setIsCreateOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden my-auto ${
              isLight ? 'bg-white border-gray-200 text-gray-900' : 'bg-zinc-900 border-zinc-800 text-white'
            }`}
          >
            <div className={`p-5 border-b flex items-center justify-between ${isLight ? 'border-gray-200 bg-gray-50/70' : 'border-zinc-800 bg-zinc-900/60'}`}>
              <div>
                <h3 className="text-base font-bold">New B2B Quotation / Pro Forma Invoice</h3>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                  Enforces configured validity ({quoteRules?.defaultValidityDays ?? 14} days) and deposit confirmation policies
                </p>
              </div>
              <button type="button" onClick={() => setIsCreateOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateQuotation} className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-semibold mb-1">Contact Name *</label>
                  <input type="text" required value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="e.g. Chef Hendra Wijaya" className={inputClass} />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Company / Kitchen</label>
                  <input type="text" value={customerCompany} onChange={(e) => setCustomerCompany(e.target.value)} placeholder="e.g. Hotel Mulia Kitchen" className={inputClass} />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Customer Email</label>
                  <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="procurement@company.id" className={inputClass} />
                </div>
                <div>
                  <label className="block font-semibold mb-1">WhatsApp / Phone</label>
                  <input type="text" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className={`font-mono ${inputClass}`} />
                </div>
              </div>

              {/* Add Product Line */}
              <div className={`p-4 rounded-xl border space-y-3 ${isLight ? 'bg-gray-50/70 border-gray-200' : 'bg-zinc-950 border-zinc-800'}`}>
                <label className="block font-bold text-xs">Add Products to Quote</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={selectedSkuToAdd}
                    onChange={(e) => setSelectedSkuToAdd(e.target.value)}
                    className={`flex-1 ${inputClass}`}
                  >
                    {inventory.map((inv) => (
                      <option key={inv.sku} value={inv.sku}>
                        {inv.sku} — {inv.productName} ({inv.category})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={qtyToAdd}
                    onChange={(e) => setQtyToAdd(Number(e.target.value))}
                    className={`w-24 font-mono ${inputClass}`}
                  />
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="px-3.5 py-2 rounded-xl bg-[#0F4C3A] hover:bg-[#0b382b] text-white font-semibold whitespace-nowrap"
                  >
                    + Add Line
                  </button>
                </div>

                {draftLines.length > 0 && (
                  <div className="overflow-x-auto pt-2">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-zinc-800 text-[10px] uppercase text-gray-500">
                          <th className="py-1.5">Item</th>
                          <th className="py-1.5 text-center">Qty</th>
                          <th className="py-1.5 text-right">Unit Price</th>
                          <th className="py-1.5 text-right">Subtotal</th>
                          <th className="py-1.5 text-right"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                        {draftLines.map((l) => (
                          <tr key={l.sku}>
                            <td className="py-2 font-medium">{l.productName}</td>
                            <td className="py-2 text-center font-mono">{l.quantity} {l.unit}</td>
                            <td className="py-2 text-right font-mono">{formatIDR(l.unitPrice)}</td>
                            <td className="py-2 text-right font-mono font-bold">{formatIDR(l.quantity * l.unitPrice)}</td>
                            <td className="py-2 text-right">
                              <button
                                type="button"
                                onClick={() => setDraftLines((prev) => prev.filter((x) => x.sku !== l.sku))}
                                className="p-1 text-rose-500 hover:bg-rose-500/10 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {triggeredMandatoryRules.map((r) => (
                          <tr key={r.id} className={isLight ? 'bg-amber-50/60' : 'bg-amber-950/20'}>
                            <td className="py-2 font-semibold text-amber-800 dark:text-amber-300">
                              {r.mandatoryProductName} (Auto-added HACCP Rule)
                            </td>
                            <td className="py-2 text-center font-mono">1 pack</td>
                            <td className="py-2 text-right font-mono">{formatIDR(r.mandatoryPriceIDR)}</td>
                            <td className="py-2 text-right font-mono font-bold">{formatIDR(r.mandatoryPriceIDR)}</td>
                            <td className="py-2"></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {draftLines.length > 0 && (
                <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono ${
                  isLight ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950' : 'bg-emerald-950/20 border-emerald-800/40 text-emerald-200'
                }`}>
                  <div className="space-y-0.5 text-[11px]">
                    <div>Subtotal: <strong>{formatIDR(draftTotals.subtotal)}</strong> · PPN 11%: <strong>{formatIDR(draftTotals.taxAmount)}</strong></div>
                    <div>Confirmation Threshold ({draftTotals.depositPct}%): <strong>{formatIDR(draftTotals.depositAmount)}</strong></div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-sans uppercase text-gray-500 dark:text-zinc-400">Grand Total</div>
                    <div className="text-base font-bold">{formatIDR(draftTotals.total)}</div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-center">
                <div>
                  <label className="block font-semibold mb-1">Quotation Notes</label>
                  <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Delivery schedule or special temperature notes..." className={inputClass} />
                </div>
                {(quoteRules?.allowProFormaInvoice !== false) && (
                  <label className="flex items-center gap-2 cursor-pointer pt-4">
                    <input type="checkbox" checked={isProForma} onChange={(e) => setIsProForma(e.target.checked)} className="rounded text-[#0F4C3A]" />
                    <span className="font-semibold">Issue as Pro Forma Invoice</span>
                  </label>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 dark:border-zinc-800">
                <button type="button" onClick={() => setIsCreateOpen(false)} className={`px-4 py-2 rounded-xl font-semibold border ${isLight ? 'border-gray-200 text-gray-700' : 'border-zinc-700 text-zinc-300'}`}>
                  Cancel
                </button>
                <button type="submit" disabled={isSubmittingCreate} className="px-5 py-2 rounded-xl font-semibold bg-[#0F4C3A] hover:bg-[#0b382b] text-white disabled:opacity-50">
                  {isSubmittingCreate ? 'Generating...' : 'Generate Quotation'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* DIGITAL SIGNATURE MODAL */}
      {signingQuote && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setSigningQuote(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden my-auto ${
              isLight ? 'bg-white border-gray-200 text-gray-900' : 'bg-zinc-900 border-zinc-800 text-white'
            }`}
          >
            <div className={`p-5 border-b flex items-center justify-between ${isLight ? 'border-gray-200 bg-gray-50/70' : 'border-zinc-800 bg-zinc-900/60'}`}>
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
                  Customer Digital Acceptance
                </h3>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5 font-mono">
                  {signingQuote.quotationNumber} · {formatIDR(signingQuote.total)}
                </p>
              </div>
              <button type="button" onClick={() => setSigningQuote(null)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitSignature} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Authorized Signer Name *</label>
                <input
                  type="text"
                  required
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold">Draw Handwritten Signature (Optional)</label>
                  <button type="button" onClick={clearCanvas} className="text-[11px] text-rose-600 hover:underline">
                    Clear Pad
                  </button>
                </div>
                <canvas
                  ref={canvasRef}
                  width={380}
                  height={120}
                  onMouseDown={startDrawing}
                  onMouseMove={drawStroke}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={drawStroke}
                  onTouchEnd={stopDrawing}
                  className="w-full h-28 rounded-xl border border-dashed border-gray-300 dark:border-zinc-700 bg-white cursor-crosshair touch-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 dark:border-zinc-800">
                <button type="button" onClick={() => setSigningQuote(null)} className={`px-4 py-2 rounded-xl font-semibold border ${isLight ? 'border-gray-200 text-gray-700' : 'border-zinc-700 text-zinc-300'}`}>
                  Cancel
                </button>
                <button type="submit" disabled={isSigningSubmit} className="px-4 py-2 rounded-xl font-semibold bg-[#0F4C3A] hover:bg-[#0b382b] text-white disabled:opacity-50">
                  {isSigningSubmit ? 'Confirming...' : 'Confirm Digital Signature'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
      {dispatchQuote && (
        <DocumentDispatchModal
          isOpen={Boolean(dispatchQuote)}
          onClose={() => setDispatchQuote(null)}
          theme={theme}
          initialChannel={dispatchQuote.channel}
          docType="QUOTATION"
          docId={dispatchQuote.quote.id}
          docNumber={dispatchQuote.quote.quotationNumber}
          docSummary={`Customer: ${dispatchQuote.quote.customerCompany || dispatchQuote.quote.customerName}\nValid Until: ${dispatchQuote.quote.validUntil}\nTotal: ${formatIDR(dispatchQuote.quote.total)} (${dispatchQuote.quote.items.length} items)`}
          defaultRecipientName={dispatchQuote.quote.customerCompany || dispatchQuote.quote.customerName}
          defaultRecipientEmail={dispatchQuote.quote.customerEmail}
          defaultRecipientPhone={dispatchQuote.quote.customerPhone}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
};
