import React from 'react';
import { Menu, Search, PlusCircle, ShieldCheck } from 'lucide-react';

interface TopbarProps {
  onOpenMobileMenu: () => void;
  onOpenQuickAdd: () => void;
  onOpenSearch: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  onOpenMobileMenu,
  onOpenQuickAdd,
  onOpenSearch,
}) => {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 sm:px-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="p-2 -ml-2 text-slate-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Global Search Button */}
        <button
          onClick={onOpenSearch}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 w-48 sm:w-72"
        >
          <Search className="w-4 h-4 text-slate-400" />
          <span className="flex-1 text-left truncate">Search anything...</span>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-xs text-slate-400 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded">
            ⌘K
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-3">
        {/* Security badge */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 rounded-full border border-emerald-200 dark:border-emerald-800">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>AES-256 Vault Active</span>
        </div>

        {/* Quick Add Expense button */}
        <button
          onClick={onOpenQuickAdd}
          className="flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-500 active:bg-brand-700 rounded-lg shadow-sm transition-all shadow-brand-600/20"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Quick Expense</span>
        </button>
      </div>
    </header>
  );
};
