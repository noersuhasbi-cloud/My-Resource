/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import type { StaffShiftSession } from '../types/index.ts';
import { apiClient } from '../services/apiClient';
import { useDarkMode } from '../context/DarkModeContext';
import {
  ShieldCheck,
  Lock,
  KeyRound,
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
}

export const AdminLogin: React.FC<AdminLoginProps> = ({
  onLoginSuccess,
  onReturnToStorefront,
  onShowToast,
  enableB2BAndStorefrontPortal = false,
}) => {
  const { theme, toggleDarkMode: toggleTheme } = useDarkMode();
  const isLight = theme === 'light';

  const [identifierInput, setIdentifierInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [selectedShift, setSelectedShift] = useState<'Morning Shift' | 'Afternoon Shift' | 'Night Shift'>('Morning Shift');
  const [rememberWorkstation, setRememberWorkstation] = useState<boolean>(true);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [governanceBanner, setGovernanceBanner] = useState<string | null>(null);

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
        shiftName: selectedShift,
      };

      const res = await apiClient.adminLogin(payload);
      if (res.success && res.session) {
        apiClient.setOperatorContext({ ...res.session, authToken: res.token });
        if (rememberWorkstation) {
          try {
            localStorage.setItem('grocemart_admin_session', JSON.stringify(res.session));
            if (res.token) localStorage.setItem('grocemart_auth_token', res.token);
          } catch {}
        }
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
      } min-h-screen flex flex-col font-sans selection:bg-[#0F4C3A] selection:text-white relative overflow-hidden gm-surface`}
    >
      {/* Top Banner Navigation */}
      <header className="border-b border-gray-200/90 dark:border-slate-800/80 bg-white/90 dark:bg-[#12141C]/90 backdrop-blur-md px-4 sm:px-8 py-3 flex items-center justify-between z-10 gm-chrome-surface">
        {enableB2BAndStorefrontPortal ? (
          <button
            type="button"
            onClick={onReturnToStorefront}
            className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-slate-100 transition-colors cursor-pointer group px-3 py-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800/70"
          >
            <ArrowLeft className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400 group-hover:-translate-x-1 transition-transform" />
            <span>Exit to Customer Storefront</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 text-xs font-bold text-[#0F4C3A] dark:text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            <span>GroceMatrix™ Internal Enterprise Portal</span>
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>ERP GATEWAY:</span>
            <span className="text-gray-800 dark:text-slate-200 font-semibold">TLS 1.3 ENCRYPTED</span>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl border border-gray-200 dark:border-slate-800/80 bg-white dark:bg-[#090A0F] text-gray-700 dark:text-amber-400 hover:bg-gray-50 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
            title={isLight ? 'Switch to Dark Mode' : 'Switch to Clean Light Mode'}
            aria-label="Toggle theme"
          >
            {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Authentication Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 z-10">
        <div className="w-full max-w-2xl bg-white dark:bg-[#12141C] border border-gray-200/90 dark:border-slate-800/80 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-2xl overflow-hidden gm-surface-card">
          {/* Header Card Branding */}
          <div className="p-6 sm:p-8 border-b border-gray-200 dark:border-slate-800/80 bg-gradient-to-r from-emerald-50/60 via-white to-gray-50/60 dark:from-[#12141C] dark:via-[#12141C] dark:to-emerald-950/60 gm-hero-banner">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-[#0F4C3A] text-white flex items-center justify-center font-extrabold text-xl shadow-md shadow-[#0F4C3A]/20 shrink-0">
                  GM
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-slate-100 font-display">
                      GroceMart ERP &amp; POS Suite
                    </h1>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-[#0F4C3A] border border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800/50 font-mono">
                      v4.2 ENTERPRISE
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    Multi-Outlet Cold Chain Logistics, FEFO Warehouse Picking, POS Cashier &amp; General Ledger
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto bg-gray-100 dark:bg-[#090A0F] px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-800/80 text-xs text-gray-700 dark:text-slate-300 font-medium shrink-0">
                <Lock className="w-3.5 h-3.5 text-[#0F4C3A] dark:text-amber-400" />
                <span>Authorized Sign-In</span>
              </div>
            </div>
          </div>

          {/* Error Notice */}
          {errorMessage && (
            <div className="mx-6 sm:mx-8 mt-6 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 flex items-start gap-3 text-xs sm:text-sm text-rose-800 dark:text-rose-200">
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold block">Autentikasi Ditolak</span>
                <span className="text-rose-700 dark:text-rose-300 text-xs">{errorMessage}</span>
              </div>
            </div>
          )}

          {/* Clean Go-Live Credentials Form */}
          <form onSubmit={handleExecuteLogin} className="p-6 sm:p-8 space-y-5">
            {governanceBanner && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                <span>{governanceBanner}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Email atau Username */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider block">
                  Email atau Username
                </label>
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={identifierInput}
                  onChange={(e) => setIdentifierInput(e.target.value)}
                  placeholder="Masukkan email atau username..."
                  className="w-full bg-white dark:bg-[#090A0F] border border-gray-300 dark:border-slate-800/80 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#0F4C3A] font-mono"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider block">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Masukkan password..."
                    className="w-full bg-white dark:bg-[#090A0F] border border-gray-300 dark:border-slate-800/80 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#0F4C3A] pr-10 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-slate-100 cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Workstation Shift & Session Persistence */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider block">
                  Workstation Shift
                </label>
                <select
                  value={selectedShift}
                  onChange={(e) => setSelectedShift(e.target.value as any)}
                  className="w-full bg-white dark:bg-[#090A0F] border border-gray-300 dark:border-slate-800/80 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0F4C3A] cursor-pointer"
                >
                  <option value="Morning Shift">Morning Shift (06:00 - 14:00)</option>
                  <option value="Afternoon Shift">Afternoon Shift (14:00 - 22:00)</option>
                  <option value="Night Shift">Night Shift (22:00 - 06:00)</option>
                </select>
              </div>

              <div className="flex items-center sm:pt-6">
                <label className="flex items-center gap-2.5 text-xs text-gray-700 dark:text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberWorkstation}
                    onChange={(e) => setRememberWorkstation(e.target.checked)}
                    className="w-4 h-4 rounded text-[#0F4C3A] focus:ring-[#0F4C3A] border-gray-300 dark:border-slate-700"
                  />
                  <span>Remember authenticated session on this terminal</span>
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <div
              className={`pt-4 border-t border-gray-200 dark:border-slate-800/80 flex items-center ${
                enableB2BAndStorefrontPortal ? 'justify-between' : 'justify-end'
              } gap-4`}
            >
              {enableB2BAndStorefrontPortal && (
                <button
                  type="button"
                  onClick={onReturnToStorefront}
                  className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-slate-800/80 text-xs font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={isAuthenticating}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {isAuthenticating ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Memverifikasi Akun...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>Sign In to Workspace</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Footer Security Notice */}
          <div className="p-4 bg-gray-50 dark:bg-[#090A0F] border-t border-gray-200/80 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500 dark:text-slate-500">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-500" />
              <span>ISO 27001 Certified · General Ledger Financial Immutability Enforced</span>
            </div>
            <span className="font-mono text-[11px]">PT Bumi Retail Sejahtera (GroceMart)</span>
          </div>
        </div>
      </main>
    </div>
  );
};
