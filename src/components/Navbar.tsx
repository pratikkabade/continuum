import React from 'react';
import { ClipboardPaste, LayoutGrid, List, Moon, Sun, Cloud, HardDrive } from 'lucide-react';
import { ViewMode } from '../types/clipboard';
import { isFirebaseConfigured } from '../services/firebase';

interface NavbarProps {
  onPaste: () => void;
  viewMode: ViewMode;
  onToggleViewMode: (mode: ViewMode) => void;
  darkMode: boolean;
  onToggleTheme: () => void;
  clipsCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  onPaste,
  viewMode,
  onToggleViewMode,
  darkMode,
  onToggleTheme,
}) => {
  const isCloudActive = isFirebaseConfigured();

  return (
    <header className="sticky top-4 z-40 w-full max-w-5xl mx-auto px-4 mb-6">
      <div className="glass-slab rounded-2xl px-4 py-3 flex items-center justify-between gap-4">
        {/* Left Side: Brand Wordmark + High-Visibility Paste Button */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 pr-3 border-r border-slate-300/80 dark:border-white/15">
            <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
              Continuum
            </span>
            {/* Status indicator: Cloud vs Local */}
            <span
              title={isCloudActive ? 'Connected to Firebase Cloud' : 'Local Storage Mode'}
              className="flex items-center gap-1 text-[10px] font-mono text-slate-500 dark:text-neutral-400"
            >
              {isCloudActive ? (
                <Cloud className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
              ) : (
                <HardDrive className="w-3.5 h-3.5 text-slate-400 dark:text-neutral-400" />
              )}
            </span>
          </div>

          {/* Primary High-Contrast Paste Action */}
          <button
            type="button"
            onClick={onPaste}
            className="glass-primary-action px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-md"
            title="Click to paste from clipboard immediately"
          >
            <ClipboardPaste className="w-4 h-4 stroke-[2.5]" />
            <span>Paste</span>
          </button>
        </div>

        {/* Right Side: Grid / List view toggle + Theme Switch */}
        <div className="flex items-center gap-2">
          {/* Grid / List Icon Toggle */}
          <div className="flex items-center p-1 rounded-xl bg-slate-200/70 dark:bg-black/40 border border-slate-300 dark:border-white/15">
            <button
              type="button"
              onClick={() => onToggleViewMode('grid')}
              title="Grid view"
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-sky-500 text-white font-medium shadow-xs'
                  : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onToggleViewMode('compact')}
              title="List view"
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'compact'
                  ? 'bg-sky-500 text-white font-medium shadow-xs'
                  : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Theme Toggle (High visibility) */}
          <button
            type="button"
            onClick={onToggleTheme}
            title={darkMode ? 'Switch to light appearance' : 'Switch to dark appearance'}
            className="p-2 rounded-xl glass-button text-slate-700 dark:text-neutral-200 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-sky-600 dark:text-sky-400" />}
          </button>
        </div>
      </div>
    </header>
  );
};
