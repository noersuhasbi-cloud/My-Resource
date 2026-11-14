import React, { useEffect, useState } from 'react';
import {
  Mail,
  MessageCircle,
  Save,
  Send,
  ShieldCheck,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Lock,
} from 'lucide-react';
import type {
  CommunicationDispatchLog,
  CommunicationGatewayConfig,
  SmtpEncryptionMode,
  SmtpProviderPreset,
  WhatsAppProviderType,
} from '../../types/index.ts';
import { apiClient } from '../../services/apiClient';

interface CommunicationGatewaySettingsTabProps {
  theme: 'light' | 'dark';
  canEditConfig: boolean;
  onShowToast: (title: string, message: string) => void;
}

const SMTP_PRESET_DEFAULTS: Record<
  SmtpProviderPreset,
  { label: string; host: string; port: number; encryption: SmtpEncryptionMode }
> = {
  google_workspace: {
    label: 'Google Workspace / Gmail (587)',
    host: 'smtp.gmail.com',
    port: 587,
    encryption: 'STARTTLS',
  },
  amazon_ses: {
    label: 'Amazon SES (587)',
    host: 'email-smtp.ap-southeast-1.amazonaws.com',
    port: 587,
    encryption: 'STARTTLS',
  },
  sendgrid_mailgun: {
    label: 'SendGrid / Mailgun',
    host: 'smtp.sendgrid.net',
    port: 587,
    encryption: 'STARTTLS',
  },
  microsoft_365: {
    label: 'Microsoft 365',
    host: 'smtp.office365.com',
    port: 587,
    encryption: 'STARTTLS',
  },
  custom: {
    label: 'Custom SMTP Server',
    host: '',
    port: 587,
    encryption: 'STARTTLS',
  },
};

const TEMPLATE_PLACEHOLDERS = [
  '{{recipient_name}}',
  '{{doc_type}}',
  '{{doc_number}}',
  '{{total_amount}}',
  '{{outlet_name}}',
];

function normalizePhoneDisplay(raw: string): string {
  const cleaned = String(raw || '').replace(/[^\d+]/g, '');
  if (!cleaned) return '';
  let digits = cleaned.replace(/^\+/, '');
  if (digits.startsWith('620')) digits = `62${digits.slice(3)}`;
  else if (digits.startsWith('08')) digits = `628${digits.slice(2)}`;
  else if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith('8')) digits = `62${digits}`;
  return digits ? `+${digits}` : '';
}

export const CommunicationGatewaySettingsTab: React.FC<CommunicationGatewaySettingsTabProps> = ({
  theme,
  canEditConfig,
  onShowToast,
}) => {
  const isLight = theme === 'light';
  const [config, setConfig] = useState<CommunicationGatewayConfig | null>(null);
  const [logs, setLogs] = useState<CommunicationDispatchLog[]>([]);
  const [serverCanEdit, setServerCanEdit] = useState<boolean>(canEditConfig);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isTestingEmail, setIsTestingEmail] = useState<boolean>(false);
  const [isTestingWa, setIsTestingWa] = useState<boolean>(false);

  const [showSmtpPass, setShowSmtpPass] = useState<boolean>(false);
  const [showWaSecret, setShowWaSecret] = useState<boolean>(false);
  const [testEmailTarget, setTestEmailTarget] = useState<string>('audit@grocemart.co.id');
  const [testWaPhone, setTestWaPhone] = useState<string>('081234567890');
  const [lastWaTestUrl, setLastWaTestUrl] = useState<string | null>(null);

  const effectiveCanEdit = canEditConfig && serverCanEdit;

  const loadGatewayData = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.getCommunicationGateway();
      setConfig(res.config);
      setLogs(res.logs || []);
      setServerCanEdit(Boolean(res.canEdit));
      if (res.config?.smtp?.ccAuditEmail) {
        setTestEmailTarget(res.config.smtp.ccAuditEmail);
      } else if (res.config?.smtp?.senderEmail) {
        setTestEmailTarget(res.config.smtp.senderEmail);
      }
    } catch (err: any) {
      onShowToast('Gateway Load Error', err?.message || 'Failed to load communication settings');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGatewayData();
  }, []);

  const cardClass = `rounded-xl border transition-all ${
    isLight
      ? 'bg-white border-slate-200 shadow-xs text-slate-900'
      : 'bg-zinc-900 border-zinc-800 shadow-xs text-zinc-100'
  }`;

  const subCardClass = `rounded-xl border p-4 transition-all ${
    isLight
      ? 'bg-slate-50/80 border-slate-200 text-slate-900'
      : 'bg-zinc-800/40 border-zinc-800 text-zinc-100'
  }`;

  const inputClass = `w-full px-3.5 py-2 text-xs rounded-xl border font-medium transition-all disabled:opacity-60 ${
    isLight
      ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600'
      : 'bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
  } focus:outline-hidden`;

  const labelClass = `block text-xs font-bold mb-1.5 ${isLight ? 'text-slate-800' : 'text-zinc-100'}`;

  const handlePresetChange = (preset: SmtpProviderPreset) => {
    if (!config) return;
    const presetMeta = SMTP_PRESET_DEFAULTS[preset];
    setConfig({
      ...config,
      smtp: {
        ...config.smtp,
        providerPreset: preset,
        host: preset === 'custom' ? config.smtp.host : presetMeta.host,
        port: presetMeta.port,
        encryption: presetMeta.encryption,
      },
    });
  };

  const handleSaveConfig = async () => {
    if (!config) return;
    setIsSaving(true);
    try {
      const res = await apiClient.saveCommunicationGateway(config);
      setConfig(res.config);
      onShowToast('Gateway Configuration Saved', res.message);
    } catch (err: any) {
      onShowToast('Save Denied', err?.message || 'Failed to save gateway configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestSmtp = async () => {
    setIsTestingEmail(true);
    try {
      // Save latest settings first so test reflects current edits
      if (config && effectiveCanEdit) {
        await apiClient.saveCommunicationGateway(config);
      }
      const res = await apiClient.testEmailGateway({ recipientEmail: testEmailTarget });
      onShowToast('SMTP Test Complete', res.message);
      await loadGatewayData();
    } catch (err: any) {
      onShowToast('SMTP Test Failed', err?.message || 'Failed to test SMTP connection');
      await loadGatewayData();
    } finally {
      setIsTestingEmail(false);
    }
  };

  const handleTestWhatsapp = async () => {
    setIsTestingWa(true);
    setLastWaTestUrl(null);
    try {
      if (config && effectiveCanEdit) {
        await apiClient.saveCommunicationGateway(config);
      }
      const res = await apiClient.testWhatsappGateway({
        recipientPhone: testWaPhone,
        recipientName: 'GroceMart QA Admin',
      });
      if (res.waMeUrl) setLastWaTestUrl(res.waMeUrl);
      onShowToast('WhatsApp Test Complete', res.message);
      await loadGatewayData();
    } catch (err: any) {
      onShowToast('WhatsApp Test Failed', err?.message || 'Failed to send test WhatsApp message');
      await loadGatewayData();
    } finally {
      setIsTestingWa(false);
    }
  };

  if (isLoading || !config) {
    return (
      <div className={`${cardClass} p-8 text-center text-xs text-slate-500 dark:text-zinc-400`}>
        Loading Email (SMTP) &amp; WhatsApp Business API gateway configuration...
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Banner & Save Action */}
      <div className={`${cardClass} p-5 flex flex-col md:flex-row md:items-center justify-between gap-4`}>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold">Email (SMTP) &amp; WhatsApp Business API Gateway</h2>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                config.smtp.enableLiveSmtp || config.whatsapp.enableDirectWaApi
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25'
              }`}
            >
              {config.smtp.enableLiveSmtp || config.whatsapp.enableDirectWaApi
                ? 'Live Transport Active'
                : 'Sandbox Relay Mode'}
            </span>
          </div>
          <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
            Configure outbound corporate SMTP relay and WhatsApp Business API / Indonesian gateways for automated document dispatch across Procurement, POS, QC, and B2B modules.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!effectiveCanEdit ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-bold">
              <Lock className="w-3.5 h-3.5" />
              <span>Read-Only (Super Admin / COO Only)</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={handleSaveConfig}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Gateway Settings'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2-Column Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: SMTP EMAIL GATEWAY */}
        <div className={`${cardClass} p-5 space-y-4`}>
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#0F4C3A]/10 text-[#0F4C3A] dark:text-emerald-400 flex items-center justify-center">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold">SMTP Email Gateway</h3>
                <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                  Formal HTML document &amp; invoice delivery
                </p>
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                disabled={!effectiveCanEdit}
                checked={config.smtp.enableLiveSmtp}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    smtp: { ...config.smtp, enableLiveSmtp: e.target.checked },
                  })
                }
                className="rounded border-slate-300 text-[#0F4C3A] focus:ring-[#0F4C3A]"
              />
              <span>Live SMTP Dispatch</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="sm:col-span-2">
              <label className={labelClass}>Provider Preset</label>
              <select
                disabled={!effectiveCanEdit}
                value={config.smtp.providerPreset}
                onChange={(e) => handlePresetChange(e.target.value as SmtpProviderPreset)}
                className={inputClass}
              >
                {Object.entries(SMTP_PRESET_DEFAULTS).map(([key, val]) => (
                  <option key={key} value={key}>
                    {val.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>SMTP Host</label>
              <input
                type="text"
                disabled={!effectiveCanEdit}
                value={config.smtp.host}
                onChange={(e) =>
                  setConfig({ ...config, smtp: { ...config.smtp, host: e.target.value } })
                }
                placeholder="smtp.gmail.com"
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>Port</label>
                <input
                  type="number"
                  disabled={!effectiveCanEdit}
                  value={config.smtp.port}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      smtp: { ...config.smtp, port: Number(e.target.value) || 587 },
                    })
                  }
                  className={`${inputClass} font-mono`}
                />
              </div>
              <div>
                <label className={labelClass}>Encryption</label>
                <select
                  disabled={!effectiveCanEdit}
                  value={config.smtp.encryption}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      smtp: {
                        ...config.smtp,
                        encryption: e.target.value as SmtpEncryptionMode,
                      },
                    })
                  }
                  className={inputClass}
                >
                  <option value="STARTTLS">STARTTLS</option>
                  <option value="SSL_TLS">SSL/TLS</option>
                  <option value="NONE">None</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>SMTP Username / Email</label>
              <input
                type="text"
                disabled={!effectiveCanEdit}
                value={config.smtp.username}
                onChange={(e) =>
                  setConfig({ ...config, smtp: { ...config.smtp, username: e.target.value } })
                }
                placeholder="erp-mailer@grocemart.co.id"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>SMTP Password / App Key</label>
              <div className="relative">
                <input
                  type={showSmtpPass ? 'text' : 'password'}
                  disabled={!effectiveCanEdit}
                  value={config.smtp.password}
                  onChange={(e) =>
                    setConfig({ ...config, smtp: { ...config.smtp, password: e.target.value } })
                  }
                  placeholder="App password or SMTP secret"
                  className={`${inputClass} pr-9`}
                />
                <button
                  type="button"
                  onClick={() => setShowSmtpPass((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showSmtpPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className={labelClass}>Sender Display Name</label>
              <input
                type="text"
                disabled={!effectiveCanEdit}
                value={config.smtp.senderName}
                onChange={(e) =>
                  setConfig({ ...config, smtp: { ...config.smtp, senderName: e.target.value } })
                }
                placeholder="PT GroceMart Retail Indonesia"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Sender Email</label>
              <input
                type="email"
                disabled={!effectiveCanEdit}
                value={config.smtp.senderEmail}
                onChange={(e) =>
                  setConfig({ ...config, smtp: { ...config.smtp, senderEmail: e.target.value } })
                }
                placeholder="noreply@grocemart.co.id"
                className={inputClass}
              />
            </div>

            <div className="sm:col-span-2">
              <label className={labelClass}>CC Audit Email (Optional)</label>
              <input
                type="email"
                disabled={!effectiveCanEdit}
                value={config.smtp.ccAuditEmail || ''}
                onChange={(e) =>
                  setConfig({ ...config, smtp: { ...config.smtp, ccAuditEmail: e.target.value } })
                }
                placeholder="finance-audit@grocemart.co.id"
                className={inputClass}
              />
            </div>
          </div>

          {/* Test SMTP Box */}
          <div className={`${subCardClass} space-y-2.5`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">SMTP Handshake Verification</span>
              <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-400">
                Mode: {config.smtp.enableLiveSmtp ? 'LIVE SMTP' : 'SANDBOX RELAY'}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                disabled={!effectiveCanEdit}
                value={testEmailTarget}
                onChange={(e) => setTestEmailTarget(e.target.value)}
                placeholder="Recipient test email..."
                className={inputClass}
              />
              <button
                type="button"
                disabled={!effectiveCanEdit || isTestingEmail}
                onClick={handleTestSmtp}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white text-xs font-bold whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isTestingEmail ? 'Testing...' : 'Test SMTP Connection'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT: WHATSAPP BUSINESS API GATEWAY */}
        <div className={`${cardClass} p-5 space-y-4`}>
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                <MessageCircle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold">WhatsApp Business API Gateway</h3>
                <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                  Meta Cloud API or Indonesian gateways (+62 auto-normalized)
                </p>
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                disabled={!effectiveCanEdit}
                checked={config.whatsapp.enableDirectWaApi}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    whatsapp: { ...config.whatsapp, enableDirectWaApi: e.target.checked },
                  })
                }
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
              />
              <span>Direct API Dispatch</span>
            </label>
          </div>

          <div className="space-y-3.5">
            <div>
              <label className={labelClass}>WhatsApp Provider Type</label>
              <select
                disabled={!effectiveCanEdit}
                value={config.whatsapp.providerType}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    whatsapp: {
                      ...config.whatsapp,
                      providerType: e.target.value as WhatsAppProviderType,
                    },
                  })
                }
                className={inputClass}
              >
                <option value="meta_cloud">Meta WhatsApp Cloud API (Official)</option>
                <option value="indonesian_gateway">
                  Indonesian WA Gateway (Fonnte / Wablas / Qontak)
                </option>
              </select>
            </div>

            {config.whatsapp.providerType === 'meta_cloud' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Phone Number ID</label>
                  <input
                    type="text"
                    disabled={!effectiveCanEdit}
                    value={config.whatsapp.metaPhoneNumberId}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        whatsapp: { ...config.whatsapp, metaPhoneNumberId: e.target.value },
                      })
                    }
                    placeholder="e.g. 1049283719283"
                    className={`${inputClass} font-mono`}
                  />
                </div>
                <div>
                  <label className={labelClass}>WABA ID</label>
                  <input
                    type="text"
                    disabled={!effectiveCanEdit}
                    value={config.whatsapp.metaWabaId}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        whatsapp: { ...config.whatsapp, metaWabaId: e.target.value },
                      })
                    }
                    placeholder="e.g. 203948172635"
                    className={`${inputClass} font-mono`}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Permanent Access Token</label>
                  <div className="relative">
                    <input
                      type={showWaSecret ? 'text' : 'password'}
                      disabled={!effectiveCanEdit}
                      value={config.whatsapp.metaAccessToken}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          whatsapp: { ...config.whatsapp, metaAccessToken: e.target.value },
                        })
                      }
                      placeholder="EAAG..."
                      className={`${inputClass} pr-9 font-mono`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowWaSecret((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showWaSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className={labelClass}>Gateway API URL</label>
                  <input
                    type="url"
                    disabled={!effectiveCanEdit}
                    value={config.whatsapp.gatewayApiUrl}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        whatsapp: { ...config.whatsapp, gatewayApiUrl: e.target.value },
                      })
                    }
                    placeholder="https://api.fonnte.com/send"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Device Token / API Key</label>
                  <div className="relative">
                    <input
                      type={showWaSecret ? 'text' : 'password'}
                      disabled={!effectiveCanEdit}
                      value={config.whatsapp.gatewayApiKey}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          whatsapp: { ...config.whatsapp, gatewayApiKey: e.target.value },
                        })
                      }
                      placeholder="Gateway device token"
                      className={`${inputClass} pr-9`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowWaSecret((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showWaSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Sender Number (+62)</label>
                  <input
                    type="text"
                    disabled={!effectiveCanEdit}
                    value={config.whatsapp.gatewaySenderNumber}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        whatsapp: { ...config.whatsapp, gatewaySenderNumber: e.target.value },
                      })
                    }
                    placeholder="+6281100008821"
                    className={`${inputClass} font-mono`}
                  />
                </div>
              </div>
            )}

            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <input
                type="checkbox"
                disabled={!effectiveCanEdit}
                checked={config.whatsapp.fallbackWaWebInSandbox}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    whatsapp: { ...config.whatsapp, fallbackWaWebInSandbox: e.target.checked },
                  })
                }
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
              />
              <span>Fallback to WhatsApp Web (wa.me) link when in Sandbox Mode</span>
            </label>

            {/* Templates */}
            <div className="space-y-2.5 pt-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  Placeholders:
                </span>
                {TEMPLATE_PLACEHOLDERS.map((ph) => (
                  <code
                    key={ph}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                      isLight ? 'bg-slate-100 text-slate-700' : 'bg-zinc-800 text-emerald-300'
                    }`}
                  >
                    {ph}
                  </code>
                ))}
              </div>

              <div>
                <label className={labelClass}>Vendor Message Template (PR / PO / GR / QC / Surat Jalan)</label>
                <textarea
                  rows={3}
                  disabled={!effectiveCanEdit}
                  value={config.whatsapp.vendorMessageTemplate}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      whatsapp: { ...config.whatsapp, vendorMessageTemplate: e.target.value },
                    })
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Customer Receipt / Invoice Template (Quotation / POS / B2B)</label>
                <textarea
                  rows={3}
                  disabled={!effectiveCanEdit}
                  value={config.whatsapp.customerMessageTemplate}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      whatsapp: { ...config.whatsapp, customerMessageTemplate: e.target.value },
                    })
                  }
                  className={inputClass}
                />
              </div>
            </div>

            {/* Test WhatsApp Box */}
            <div className={`${subCardClass} space-y-2.5`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">Test WhatsApp Dispatch</span>
                <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                  Normalized: {normalizePhoneDisplay(testWaPhone) || '—'}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="tel"
                  disabled={!effectiveCanEdit}
                  value={testWaPhone}
                  onChange={(e) => setTestWaPhone(e.target.value)}
                  placeholder="081234567890"
                  className={`${inputClass} font-mono`}
                />
                <button
                  type="button"
                  disabled={!effectiveCanEdit || isTestingWa}
                  onClick={handleTestWhatsapp}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold whitespace-nowrap cursor-pointer disabled:opacity-50"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>{isTestingWa ? 'Sending...' : 'Send Test WhatsApp'}</span>
                </button>
              </div>
              {lastWaTestUrl && (
                <a
                  href={lastWaTestUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open WhatsApp Web Preview (wa.me)</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* OUTBOUND DISPATCH AUDIT LOG */}
      <div className={`${cardClass} overflow-hidden`}>
        <div className="px-5 py-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold">Outbound Dispatch Audit Log</h3>
              <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                Immutable record of Email (SMTP) &amp; WhatsApp dispatches across ERP modules
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadGatewayData}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer ${
              isLight ? 'border-slate-300 hover:bg-slate-50' : 'border-zinc-700 hover:bg-zinc-800'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Log</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead
              className={`border-b text-[10px] uppercase font-bold tracking-wider ${
                isLight ? 'border-slate-200 bg-slate-50 text-slate-500' : 'border-zinc-800 bg-zinc-800/50 text-zinc-400'
              }`}
            >
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Channel</th>
                <th className="py-3 px-4">Doc Type &amp; Ref #</th>
                <th className="py-3 px-4">Recipient</th>
                <th className="py-3 px-4 text-center">Mode</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-zinc-800'}`}>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-xs text-slate-500 dark:text-zinc-400">
                    No outbound Email or WhatsApp dispatches logged yet. Send any ERP document or run a gateway test above.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    className={`transition-colors ${isLight ? 'hover:bg-slate-50/70' : 'hover:bg-zinc-800/30'}`}
                  >
                    <td className="py-3 px-4 font-mono tabular-nums text-[11px] whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 font-semibold capitalize">
                        {log.channel === 'email' ? (
                          <Mail className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        )}
                        <span>{log.channel}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums">
                      <span className="font-bold">{log.docType}</span>
                      <span className="text-slate-500 dark:text-zinc-400 ml-1.5">#{log.docNumber}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold">{log.recipientName}</div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-zinc-400">
                        {log.recipientAddress}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-[11px]">
                      <span
                        className={`font-bold ${
                          log.mode === 'LIVE'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {log.mode}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {log.status === 'SENT' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>SENT</span>
                        </span>
                      ) : (
                        <span
                          title={log.errorMessage}
                          className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold text-[11px]"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>FAILED</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
