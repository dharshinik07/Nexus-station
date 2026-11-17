import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { QuickAddExpenseModal } from '../QuickAddExpenseModal';
import { GlobalSearchModal } from '../GlobalSearchModal';

export const AppLayout: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <div className="flex-1 flex flex-col lg:pl-64">
        <Topbar
          onOpenMobileMenu={() => setMobileOpen(true)}
          onOpenQuickAdd={() => setQuickAddOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet context={{ refreshTrigger: () => {} }} />
        </main>
      </div>

      <QuickAddExpenseModal
        isOpen={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onExpenseAdded={() => {
          // Trigger optional refresh
          window.dispatchEvent(new CustomEvent('fv:expense-added'));
        }}
      />

      <GlobalSearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
    </div>
  );
};
