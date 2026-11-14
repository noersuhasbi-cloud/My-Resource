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

  const isDarkMode = theme === 'dark';

  const applyThemeToDomAndStorage = useCallback((nextTheme: ThemeMode) => {
    const isDark = nextTheme === 'dark';
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', isDark);
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
        setThemeState(event.newValue === 'true' ? 'dark' : 'light');
      } else if (
        event.key === LEGACY_ADMIN_THEME_KEY &&
        (event.newValue === 'dark' || event.newValue === 'light')
      ) {
        setThemeState(event.newValue);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const setTheme = useCallback((nextTheme: ThemeMode) => {
    setThemeState(nextTheme);
  }, []);

  const setDarkMode = useCallback((dark: boolean) => {
    setThemeState(dark ? 'dark' : 'light');
  }, []);

  const toggleDarkMode = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

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
