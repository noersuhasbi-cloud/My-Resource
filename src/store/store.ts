import React from 'react';
import { create } from 'zustand';

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
}

export interface AppState {
  theme: 'light' | 'dark';
  selectedStore: string;
  toasts: ToastMessage[];
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  setSelectedStore: (store: string) => void;
  showToast: (title: string, message: string) => void;
  dismissToast: (id: string) => void;
}

let storeThemeTransitionTimer: number | null = null;
let storeThemeRaf: number | null = null;

export const useAppStore = create<AppState>((set, get) => ({
  theme: (() => {
    try {
      const saved = localStorage.getItem('grocemart_admin_theme');
      if (saved === 'dark' || saved === 'light') {
        if (typeof document !== 'undefined' && saved === 'dark') {
          document.documentElement.classList.add('dark');
        }
        return saved;
      }
    } catch {}
    return 'light';
  })(),
  selectedStore: 'CONSOLIDATED',
  toasts: [],

  setTheme: (theme: 'light' | 'dark') => {
    const isDark = theme === 'dark';
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      if (storeThemeRaf !== null) window.cancelAnimationFrame(storeThemeRaf);
      storeThemeRaf = window.requestAnimationFrame(() => {
        storeThemeRaf = null;
        const root = document.documentElement;
        root.classList.add('theme-switching');
        root.classList.toggle('dark', isDark);
        root.classList.toggle('light-theme', !isDark);
        root.style.colorScheme = theme;
        if (storeThemeTransitionTimer !== null) window.clearTimeout(storeThemeTransitionTimer);
        storeThemeTransitionTimer = window.setTimeout(() => {
          root.classList.remove('theme-switching');
          storeThemeTransitionTimer = null;
        }, 150);
      });
    }
    React.startTransition(() => {
      try {
        localStorage.setItem('grocemart_admin_theme', theme);
      } catch {}
      set({ theme });
    });
  },

  toggleTheme: () => {
    const next = get().theme === 'light' ? 'dark' : 'light';
    get().setTheme(next);
  },

  setSelectedStore: (store: string) => set({ selectedStore: store }),

  showToast: (title: string, message: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    set((state) => ({
      toasts: [...state.toasts, { id, title, message }],
    }));
    setTimeout(() => {
      get().dismissToast(id);
    }, 4000);
  },

  dismissToast: (id: string) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
