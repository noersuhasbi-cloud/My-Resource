import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type ThemeMode = 'light' | 'dark';

export interface DarkModeContextValue {
  isDarkMode: boolean;
  theme: ThemeMode;
  toggleDarkMode: () => void;
  setDarkMode: (dark: boolean) => void;
  setTheme: (theme: ThemeMode) => void;
}

const DARK_MODE_STORAGE_KEY = 'grocemart_dark_mode';
const LEGACY_ADMIN_THEME_KEY = 'grocemart_admin_theme';

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  try {
    const savedDarkMode = localStorage.getItem(DARK_MODE_STORAGE_KEY);
    if (savedDarkMode === 'true') return 'dark';
    if (savedDarkMode === 'false') return 'light';

    const legacyAdminTheme = localStorage.getItem(LEGACY_ADMIN_THEME_KEY);
    if (legacyAdminTheme === 'dark' || legacyAdminTheme === 'light') {
      return legacyAdminTheme;
    }
  } catch {
    // Ignore storage access errors in restricted environments
  }
  return 'light';
}

export const DarkModeContext = createContext<DarkModeContextValue | undefined>(undefined);

export const DarkModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);
  const themeRef = React.useRef<ThemeMode>(theme);
  const transitionTimerRef = React.useRef<number | null>(null);
  const rafRef = React.useRef<number | null>(null);

  const isDarkMode = theme === 'dark';

  const applyThemeClassesSync = useCallback((nextTheme: ThemeMode) => {
    if (typeof document === 'undefined') return;
    const isDark = nextTheme === 'dark';
    const root = document.documentElement;
    if (root.classList.contains('dark') !== isDark) {
      root.classList.toggle('dark', isDark);
    }
    if (root.classList.contains('light-theme') === isDark) {
      root.classList.toggle('light-theme', !isDark);
    }
    if (root.style.colorScheme !== nextTheme) {
      root.style.colorScheme = nextTheme;
    }
  }, []);

  const scheduleFastThemeSwitch = useCallback(
    (nextTheme: ThemeMode) => {
      themeRef.current = nextTheme;
      const isDark = nextTheme === 'dark';

      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        if (rafRef.current !== null) {
          window.cancelAnimationFrame(rafRef.current);
        }
        rafRef.current = window.requestAnimationFrame(() => {
          rafRef.current = null;
          const root = document.documentElement;
          root.classList.add('theme-switching');
          root.classList.toggle('dark', isDark);
          root.classList.toggle('light-theme', !isDark);
          root.style.colorScheme = nextTheme;

          if (transitionTimerRef.current !== null) {
            window.clearTimeout(transitionTimerRef.current);
          }
          transitionTimerRef.current = window.setTimeout(() => {
            root.classList.remove('theme-switching');
            transitionTimerRef.current = null;
          }, 150);
        });
      }

      React.startTransition(() => {
        setThemeState(nextTheme);
        try {
          localStorage.setItem(DARK_MODE_STORAGE_KEY, String(isDark));
          localStorage.setItem(LEGACY_ADMIN_THEME_KEY, nextTheme);
        } catch {
          // Ignore storage write errors
        }
      });
    },
    []
  );

  useEffect(() => {
    return () => {
      if (rafRef.current !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(rafRef.current);
      }
      if (transitionTimerRef.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(transitionTimerRef.current);
      }
      if (typeof document !== 'undefined') {
        document.documentElement.classList.remove('theme-switching');
      }
    };
  }, []);

  useEffect(() => {
    themeRef.current = theme;
    applyThemeClassesSync(theme);
  }, [theme, applyThemeClassesSync]);

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === DARK_MODE_STORAGE_KEY && event.newValue !== null) {
        const nextTheme: ThemeMode = event.newValue === 'true' ? 'dark' : 'light';
        scheduleFastThemeSwitch(nextTheme);
      } else if (
        event.key === LEGACY_ADMIN_THEME_KEY &&
        (event.newValue === 'dark' || event.newValue === 'light')
      ) {
        scheduleFastThemeSwitch(event.newValue);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [scheduleFastThemeSwitch]);

  const setTheme = useCallback(
    (nextTheme: ThemeMode) => {
      scheduleFastThemeSwitch(nextTheme);
    },
    [scheduleFastThemeSwitch]
  );

  const setDarkMode = useCallback(
    (dark: boolean) => {
      scheduleFastThemeSwitch(dark ? 'dark' : 'light');
    },
    [scheduleFastThemeSwitch]
  );

  const toggleDarkMode = useCallback(() => {
    const currentIsDark = themeRef.current === 'dark';
    scheduleFastThemeSwitch(currentIsDark ? 'light' : 'dark');
  }, [scheduleFastThemeSwitch]);

  return (
    <DarkModeContext.Provider
      value={{
        isDarkMode,
        theme,
        toggleDarkMode,
        setDarkMode,
        setTheme,
      }}
    >
      {children}
    </DarkModeContext.Provider>
  );
};

export function useDarkMode(): DarkModeContextValue {
  const context = useContext(DarkModeContext);
  if (!context) {
    throw new Error('useDarkMode must be used within a DarkModeProvider');
  }
  return context;
}
