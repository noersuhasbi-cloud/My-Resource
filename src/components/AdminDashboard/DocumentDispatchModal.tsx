import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Mail,
  MessageCircle,
  Send,
  X,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  FileText,
} from 'lucide-react';
import type {
  CommunicationDocType,
  SendDocumentDispatchResponse,
} from '../../types/index.ts';
import { apiClient } from '../../services/apiClient';

interface DocumentDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
  initialChannel?: 'email' | 'whatsapp' | 'both';
  docType: CommunicationDocType;
  docId: string;
  docNumber: string;
  docSummary: string;
  defaultRecipientName?: string;
  defaultRecipientEmail?: string;
  defaultRecipientPhone?: string;
  onShowToast?: (title: string, message: string) => void;
  onDispatched?: (res: SendDocumentDispatchResponse) => void;
}

const DOC_TYPE_LABELS: Record<CommunicationDocType, string> = {
  QUOTATION: 'Quotation / Pro Forma',
  PR: 'Purchase Request (PR)',
  PO: 'Purchase Order (PO)',
  GR: 'Goods Receipt (GR)',
  QC_REPORT: 'HACCP QC Inspection & RTV Report',
  POS_RECEIPT: 'Customer POS Receipt',
  B2B_INVOICE: 'B2B Wholesale Invoice',
  SURAT_JALAN: 'Surat Jalan (Delivery Waybill)',
};

function normalizeIndoPhonePreview(raw: string): string {
  const cleaned = String(raw || '').replace(/[^\d+]/g, '');
  if (!cleaned) return '';
  let digits = cleaned.replace(/^\+/, '');
  if (digits.startsWith('620')) {
    digits = `62${digits.slice(3)}`;
  } else if (digits.startsWith('08')) {
    digits = `628${digits.slice(2)}`;
  } else if (digits.startsWith('0')) {
    digits = `62${digits.slice(1)}`;
  } else if (digits.startsWith('8')) {
    digits = `62${digits}`;
  }
  return digits ? `+${digits}` : '';
}

export const DocumentDispatchModal: React.FC<DocumentDispatchModalProps> = ({
  isOpen,
  onClose,
  theme,
  initialChannel = 'email',
  docType,
  docId,
  docNumber,
  docSummary,
  defaultRecipientName = '',
  defaultRecipientEmail = '',
  defaultRecipientPhone = '',
  onShowToast,
  onDispatched,
}) => {
  const isLight = theme === 'light';
  const [channel, setChannel] = useState<'email' | 'whatsapp' | 'both'>(initialChannel);
  const [recipientName, setRecipientName] = useState<string>(defaultRecipientName);
  const [recipientEmail, setRecipientEmail] = useState<string>(defaultRecipientEmail);
  const [recipientPhone, setRecipientPhone] = useState<string>(defaultRecipientPhone);
  const [customNote, setCustomNote] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<SendDocumentDispatchResponse | null>(null);

  useEffect(() => {
    if (isOpen) {
      setChannel(initialChannel);
      setRecipientName(defaultRecipientName);
      setRecipientEmail(defaultRecipientEmail);
      setRecipientPhone(defaultRecipientPhone);
      setCustomNote('');
      setErrorMsg(null);
      setResult(null);
    }
  }, [isOpen, initialChannel, docId, defaultRecipientName, defaultRecipientEmail, defaultRecipientPhone]);

  const normalizedPhoneDisplay = useMemo(
    () => normalizeIndoPhonePreview(recipientPhone),
    [recipientPhone]
  );

  const previewText = useMemo(() => {
    const label = DOC_TYPE_LABELS[docType] || docType;
    const lines = [
      `Document: ${label} (${docNumber})`,
      `Recipient: ${recipientName || 'Partner'}`,
      docSummary,
      customNote.trim() ? `Note: ${customNote.trim()}` : '',
    ].filter(Boolean);
    return lines.join('\n');
  }, [docType, docNumber, recipientName, docSummary, customNote]);

  if (!isOpen) return null;

  const needsEmail = channel === 'email' || channel === 'both';
  const needsWhatsapp = channel === 'whatsapp' || channel === 'both';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!recipientName.trim()) {
      setErrorMsg('Recipient name is required.');
      return;
    }
    if (needsEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim())) {
      setErrorMsg('Please provide a valid recipient email address.');
      return;
    }
    const phoneDigits = normalizedPhoneDisplay.replace(/\D/g, '');
    if (needsWhatsapp && (phoneDigits.length < 9 || phoneDigits.length > 16)) {
      setErrorMsg('Please provide a valid Indonesian or international WhatsApp phone number.');
      return;
    }

    setIsSending(true);
    try {
      const res = await apiClient.sendDocumentCommunication({
        channel,
        docType,
        docId,
        recipientName: recipientName.trim(),
        recipientEmail: needsEmail ? recipientEmail.trim() : undefined,
        recipientPhone: needsWhatsapp ? recipientPhone.trim() : undefined,
        customNote: customNote.trim() || undefined,
      });
      setResult(res);
      onShowToast?.('Document Dispatched', res.message);
      onDispatched?.(res);
    } catch (err: any) {
      const msg = err?.message || 'Failed to send document.';
      setErrorMsg(msg);
      onShowToast?.('Dispatch Failed', msg);
    } finally {
      setIsSending(false);
    }
  };

  const inputClass = `w-full px-3.5 py-2 text-xs rounded-xl border font-medium transition-all ${
    isLight
      ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600'
      : 'bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
  } focus:outline-hidden`;

  const modalContent = (
    <div
      className="fixed inset-0 z-[120] bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto print:hidden"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden my-auto ${
          isLight ? 'bg-white border-gray-200 text-gray-900' : 'bg-zinc-900 border-zinc-800 text-zinc-100'
        }`}
      >
        {/* Header */}
        <div
          className={`px-5 py-4 border-b flex items-center justify-between ${
            isLight ? 'bg-gray-50/80 border-gray-200' : 'bg-zinc-900/90 border-zinc-800'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#0F4C3A] text-white flex items-center justify-center shrink-0">
              {channel === 'whatsapp' ? (
                <MessageCircle className="w-4 h-4" />
              ) : (
                <Mail className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold truncate">
                Dispatch {DOC_TYPE_LABELS[docType]}
              </h3>
              <p className={`text-[11px] font-mono truncate ${isLight ? 'text-gray-500' : 'text-zinc-400'}`}>
                Ref: {docNumber}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isLight ? 'hover:bg-gray-200 text-gray-500' : 'hover:bg-zinc-800 text-zinc-400'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Channel Selector */}
          <div>
            <label className="block text-xs font-bold mb-1.5">Delivery Channel</label>
            <div className={`grid grid-cols-3 gap-1.5 p-1 rounded-xl border ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-zinc-800/80 border-zinc-700'}`}>
              <button
                type="button"
                onClick={() => setChannel('email')}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  channel === 'email'
                    ? 'bg-[#0F4C3A] text-white shadow-xs'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Email</span>
              </button>
              <button
                type="button"
                onClick={() => setChannel('whatsapp')}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  channel === 'whatsapp'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={() => setChannel('both')}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  channel === 'both'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>Both</span>
              </button>
            </div>
          </div>

          {/* Recipient Fields */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold mb-1">Recipient Name</label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="e.g. PT Kebun Segar Nusantara / Budi Santoso"
                required
                className={inputClass}
              />
            </div>

            {needsEmail && (
              <div>
                <label className="block text-xs font-bold mb-1">Recipient Email Address</label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="partner@company.co.id"
                  required={needsEmail}
                  className={inputClass}
                />
              </div>
            )}

            {needsWhatsapp && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold">Recipient WhatsApp Number</label>
                  {normalizedPhoneDisplay && (
                    <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                      Normalized: {normalizedPhoneDisplay}
                    </span>
                  )}
                </div>
                <input
                  type="tel"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  placeholder="0812-xxxx-xxxx or +62812xxxx"
                  required={needsWhatsapp}
                  className={inputClass}
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold mb-1">Custom Note (Optional)</label>
              <textarea
                rows={2}
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                placeholder="Add delivery instructions, payment reminder, or QC follow-up notes..."
                className={inputClass}
              />
            </div>
          </div>

          {/* Message Preview */}
          <div
            className={`p-3 rounded-xl border text-xs space-y-1.5 ${
              isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-zinc-800/60 border-zinc-700 text-zinc-300'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold text-[11px] uppercase tracking-wider text-[#0F4C3A] dark:text-emerald-400">
              <FileText className="w-3.5 h-3.5" />
              <span>Document Payload Preview</span>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-[11px] leading-relaxed">
              {previewText}
            </pre>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {result && (
            <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-xs space-y-2">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">{result.message}</p>
                  <p className="text-[11px] opacity-85 mt-0.5">
                    Audit entries recorded ({result.logs.map((l) => l.id).join(', ')}).
                  </p>
                </div>
              </div>
              {result.waMeUrl && (
                <a
                  href={result.waMeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open WhatsApp Web (wa.me)</span>
                </a>
              )}
            </div>
          )}

          {/* Footer Buttons */}
          <div className={`flex items-center justify-end gap-2 pt-2 border-t ${isLight ? 'border-gray-200' : 'border-zinc-800'}`}>
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-xl border text-xs font-semibold cursor-pointer ${
                isLight ? 'border-gray-300 text-gray-700 hover:bg-gray-100' : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              Close
            </button>
            <button
              type="submit"
              disabled={isSending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSending ? 'Sending...' : 'Send Document'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
