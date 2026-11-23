/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import type { CompanyPublicBranding, StaffShiftSession } from '../types/index.ts';
import { apiClient } from '../services/apiClient';
import { useDarkMode } from '../context/DarkModeContext';
import { getCompanyMonogram, isSafeLogoUrl } from '../utils/formatters';
import {
  ArrowLeft,
  AlertTriangle,
  Eye,
  EyeOff,
  Sun,
  Moon,
} from 'lucide-react';

interface AdminLoginProps {
  onLoginSuccess: (session: StaffShiftSession) => void;
  onReturnToStorefront: () => void;
  onShowToast?: (title: string, message: string) => void;
  enableB2BAndStorefrontPortal?: boolean;
  companyBranding?: CompanyPublicBranding | null;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({
  onLoginSuccess,
  onReturnToStorefront,
  onShowToast,
  enableB2BAndStorefrontPortal = false,
  companyBranding,
}) => {
  const { theme, toggleDarkMode: toggleTheme } = useDarkMode();
  const isLight = theme === 'light';

  const [identifierInput, setIdentifierInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [governanceBanner, setGovernanceBanner] = useState<string | null>(null);
  const [logoLoadFailed, setLogoLoadFailed] = useState<boolean>(false);

  const safeLogoUrl = isSafeLogoUrl(companyBranding?.logoUrl);
  const activeCompanyName = companyBranding?.companyName?.trim() || 'GroceMart ERP & POS Suite';
  const footerCompanyName = companyBranding?.companyName?.trim() || 'GroceMart ERP';
  const companyMonogram = getCompanyMonogram(companyBranding?.companyName);

  useEffect(() => {
    setLogoLoadFailed(false);
  }, [safeLogoUrl]);

  useEffect(() => {
    let isMounted = true;
    apiClient
      .getDemoAccounts()
      .then((res: any) => {
        if (!isMounted || !res?.success) return;
        if (res.isOperationalLocked && res.statusMessage) {
          setGovernanceBanner(String(res.statusMessage));
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const handleExecuteLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedIdentifier = identifierInput.trim();
    if (!trimmedIdentifier || !passwordInput) {
      setErrorMessage('Masukkan email atau username beserta password Anda.');
      return;
    }

    setErrorMessage(null);
    setIsAuthenticating(true);

    try {
      const payload = {
        identifier: trimmedIdentifier,
        password: passwordInput,
      };

      const res = await apiClient.adminLogin(payload);
      if (res.success && res.session) {
        apiClient.setOperatorContext({ ...res.session, authToken: res.token });
        try {
          localStorage.setItem('grocemart_admin_session', JSON.stringify(res.session));
          if (res.token) localStorage.setItem('grocemart_auth_token', res.token);
        } catch {}
        if (onShowToast) {
          onShowToast(
            'Authentication Successful',
            `Welcome back, ${res.session.userName} (${res.session.divisionLabel || res.session.userRole.replace(/_/g, ' ')})`
          );
        }
        onLoginSuccess(res.session);
      } else {
        throw new Error(res.message || 'Email/Username atau password salah');
      }
    } catch (err: any) {
      const msg = err?.message || 'Email/Username atau password salah';
      setErrorMessage(msg);
      if (onShowToast) {
        onShowToast('Access Denied', msg);
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div
      className={`${
        theme === 'dark' ? 'dark bg-[#090A0F] text-slate-100' : 'bg-[#EEF2F0] text-[#18221D] gm-daylight-canvas'
      } min-h-screen flex flex-col font-sans selection:bg-[#0F4C3A] selection:text-white relative overflow-x-clip gm-surface`}
    >
      {/* Minimal Top Bar */}
      <header className="h-16 border-b border-gray-200/80 dark:border-slate-800/80 bg-white/85 dark:bg-[#12141C]/85 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between gap-4 z-10 gm-chrome-surface">
        {enableB2BAndStorefrontPortal ? (
          <button
            type="button"
            onClick={onReturnToStorefront}
            className="inline-flex items-center gap-2 min-h-[40px] px-2.5 py-1.5 rounded-lg text-[13px] font-medium text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-gray-100/80 dark:hover:bg-slate-800/70 transition-colors cursor-pointer group whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400 group-hover:-translate-x-0.5 transition-transform" />
            <span>Exit to Customer Storefront</span>
          </button>
        ) : (
          <span className="text-[14px] font-semibold tracking-[-0.01em] text-gray-900 dark:text-slate-100 whitespace-nowrap truncate">
            {footerCompanyName}
          </span>
        )}

        <button
          type="button"
          onClick={toggleTheme}
          className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-800/80 bg-white dark:bg-[#090A0F] text-gray-700 dark:text-amber-400 hover:bg-gray-50 dark:hover:bg-slate-800/80 transition-colors cursor-pointer shrink-0"
          title={isLight ? 'Switch to Dark Mode' : 'Switch to Clean Light Mode'}
          aria-label="Toggle theme"
        >
          {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>
      </header>

      {/* Centered Enterprise Sign-In Container */}
      <main className="flex-1 min-h-[calc(100vh-64px)] flex flex-col items-center justify-center px-4 sm:px-6 py-8 z-10">
        <div className="w-full max-w-[440px] mx-auto">
          <div className="bg-white dark:bg-[#12141C] border border-gray-200/90 dark:border-slate-800/90 rounded-2xl shadow-[0_8px_28px_rgba(16,36,26,0.06)] dark:shadow-2xl p-6 sm:p-8 gm-surface-card">
            {/* Company Identity Header */}
            <div className="flex items-center gap-3.5 pb-6 mb-6 border-b border-gray-200/80 dark:border-slate-800/80">
              {safeLogoUrl && !logoLoadFailed ? (
                <div className="w-11 h-11 rounded-xl border border-gray-200/90 dark:border-slate-800 bg-white dark:bg-[#090A0F] p-1 flex items-center justify-center shrink-0 overflow-hidden">
                  <img
                    src={safeLogoUrl}
                    alt={activeCompanyName}
                    referrerPolicy="no-referrer"
                    onError={() => setLogoLoadFailed(true)}
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-11 h-11 rounded-xl bg-[#0F4C3A] text-white flex items-center justify-center font-bold text-[15px] tracking-tight shadow-sm shrink-0">
                  {companyMonogram}
                </div>
              )}

              <div className="min-w-0">
                <h1 className="text-[18px] font-semibold leading-snug tracking-[-0.01em] text-gray-900 dark:text-slate-100 truncate">
                  {activeCompanyName}
                </h1>
                <p className="text-[13px] text-gray-500 dark:text-slate-400 mt-0.5 leading-snug">
                  Masuk ke ruang kerja operasional perusahaan
                </p>
              </div>
            </div>

            {/* Operational Lock Notice */}
            {governanceBanner && (
              <div className="mb-5 p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/35 border border-rose-200 dark:border-rose-800/60 text-[13px] text-rose-800 dark:text-rose-200 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                <span>{governanceBanner}</span>
              </div>
            )}

            {/* Inline Login Error Alert */}
            {errorMessage && (
              <div
                role="alert"
                className="mb-5 p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/45 border border-rose-200 dark:border-rose-800/60 flex items-start gap-2.5 text-[13px] text-rose-800 dark:text-rose-200"
              >
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <span className="font-semibold block">Autentikasi Ditolak</span>
                  <span className="text-rose-700 dark:text-rose-300 text-[12.5px] leading-snug block mt-0.5">
                    {errorMessage}
                  </span>
                </div>
              </div>
            )}

            {/* Sign-In Form */}
            <form onSubmit={handleExecuteLogin} className="space-y-4">
              <div>
                <label
                  htmlFor="admin-login-identifier"
                  className="block text-[13px] font-semibold text-gray-700 dark:text-slate-200 mb-1.5"
                >
                  Email atau Username
                </label>
                <input
                  id="admin-login-identifier"
                  type="text"
                  required
                  autoComplete="username"
                  value={identifierInput}
                  onChange={(e) => setIdentifierInput(e.target.value)}
                  placeholder="Masukkan email atau username..."
                  className="w-full h-11 rounded-lg bg-white dark:bg-[#090A0F] border border-gray-300 dark:border-slate-700/80 px-3.5 text-[14px] text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#0F4C3A]/35 focus:border-[#0F4C3A] transition-colors"
                />
              </div>

              <div>
                <label
                  htmlFor="admin-login-password"
                  className="block text-[13px] font-semibold text-gray-700 dark:text-slate-200 mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="admin-login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Masukkan password..."
                    className="w-full h-11 rounded-lg bg-white dark:bg-[#090A0F] border border-gray-300 dark:border-slate-700/80 pl-3.5 pr-11 text-[14px] text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#0F4C3A]/35 focus:border-[#0F4C3A] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-100 transition-colors cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isAuthenticating}
                className="w-full h-11 mt-5 rounded-lg bg-[#0F4C3A] hover:bg-[#0b382b] dark:hover:bg-[#136049] text-white text-[14px] font-semibold shadow-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isAuthenticating ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Memverifikasi Akun...</span>
                  </>
                ) : (
                  <span>Masuk ke Sistem</span>
                )}
              </button>
            </form>
          </div>

          <p className="mt-5 text-center text-[12px] text-gray-500 dark:text-slate-500">
            © 2026 {footerCompanyName} · Internal Enterprise Access
          </p>
        </div>
      </main>
    </div>
  );
};
