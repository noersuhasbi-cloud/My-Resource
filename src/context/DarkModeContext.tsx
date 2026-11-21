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
  const transitionTimerRef = React.useRef<number | null>(null);

  const isDarkMode = theme === 'dark';

  const triggerThemeTransition = useCallback(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (prefersReducedMotion) return;

    const root = document.documentElement;
    root.classList.add('theme-transitioning');
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
    }
    transitionTimerRef.current = window.setTimeout(() => {
      root.classList.remove('theme-transitioning');
      transitionTimerRef.current = null;
    }, 280);
  }, []);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(transitionTimerRef.current);
      }
      if (typeof document !== 'undefined') {
        document.documentElement.classList.remove('theme-transitioning');
      }
    };
  }, []);

  const applyThemeToDomAndStorage = useCallback((nextTheme: ThemeMode) => {
    const isDark = nextTheme === 'dark';
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', isDark);
      document.documentElement.classList.toggle('light-theme', !isDark);
      document.documentElement.style.colorScheme = nextTheme;
    }
    try {
      localStorage.setItem(DARK_MODE_STORAGE_KEY, String(isDark));
      localStorage.setItem(LEGACY_ADMIN_THEME_KEY, nextTheme);
    } catch {
      // Ignore storage write errors
    }
  }, []);

  useEffect(() => {
    applyThemeToDomAndStorage(theme);
  }, [theme, applyThemeToDomAndStorage]);

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === DARK_MODE_STORAGE_KEY && event.newValue !== null) {
        triggerThemeTransition();
        setThemeState(event.newValue === 'true' ? 'dark' : 'light');
      } else if (
        event.key === LEGACY_ADMIN_THEME_KEY &&
        (event.newValue === 'dark' || event.newValue === 'light')
      ) {
        triggerThemeTransition();
        setThemeState(event.newValue);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [triggerThemeTransition]);

  const setTheme = useCallback(
    (nextTheme: ThemeMode) => {
      triggerThemeTransition();
      setThemeState(nextTheme);
    },
    [triggerThemeTransition]
  );

  const setDarkMode = useCallback(
    (dark: boolean) => {
      triggerThemeTransition();
      setThemeState(dark ? 'dark' : 'light');
    },
    [triggerThemeTransition]
  );

  const toggleDarkMode = useCallback(() => {
    triggerThemeTransition();
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, [triggerThemeTransition]);

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
