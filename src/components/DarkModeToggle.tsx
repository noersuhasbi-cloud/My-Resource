import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useDarkMode } from '../context/DarkModeContext';

interface DarkModeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export const DarkModeToggle: React.FC<DarkModeToggleProps> = ({
  className = '',
  showLabel = false,
}) => {
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  return (
    <button
      type="button"
      onClick={toggleDarkMode}
      aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDarkMode}
      title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border transition-all duration-200 cursor-pointer active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
        isDarkMode
          ? 'bg-stone-900 hover:bg-stone-800 border-stone-700 text-amber-300 shadow-xs'
          : 'bg-stone-100 hover:bg-stone-200 border-stone-200 text-stone-700'
      } ${showLabel ? 'px-3 py-2 text-xs font-semibold' : 'min-h-[38px] min-w-[38px] sm:min-h-[42px] sm:min-w-[42px] p-2'} ${className}`}
    >
      {isDarkMode ? (
        <Sun className="w-4 h-4 text-amber-300 transition-transform duration-200" />
      ) : (
        <Moon className="w-4 h-4 text-stone-700 transition-transform duration-200" />
      )}
      {showLabel && (
        <span className={isDarkMode ? 'text-stone-100' : 'text-stone-800'}>
          {isDarkMode ? 'Light Mode' : 'Dark Mode'}
        </span>
      )}
    </button>
  );
};
