import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Users, Receipt, CreditCard, FolderLock, Loader2 } from 'lucide-react';
import { apiRequest } from '../api/client';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    clients: any[];
    invoices: any[];
    expenses: any[];
    documents: any[];
  }>({
    clients: [],
    invoices: [],
    expenses: [],
    documents: [],
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults({ clients: [], invoices: [], expenses: [], documents: [] });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!query.trim()) {
      setResults({ clients: [], invoices: [], expenses: [], documents: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await apiRequest(`/settings/search?q=${encodeURIComponent(query)}`);
        if (res.data) setResults(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const handleSelect = (path: string) => {
    navigate(path);
    onClose();
  };

  const hasAnyResults =
    results.clients.length > 0 ||
    results.invoices.length > 0 ||
    results.expenses.length > 0 ||
    results.documents.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <Search className="w-5 h-5 text-slate-400 mr-3" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search clients, invoices, expenses, documents..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent border-none text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none text-base"
          />
          {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400 mr-2" />}
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results Body */}
        <div className="max-h-96 overflow-y-auto p-4 space-y-4">
          {!query.trim() && (
            <div className="py-8 text-center text-sm text-slate-400">
              Type to search across all clients, projects, invoices, expenses, and encrypted files.
            </div>
          )}

          {query.trim() && !hasAnyResults && !loading && (
            <div className="py-8 text-center text-sm text-slate-400">
              No matching records found for "{query}".
            </div>
          )}

          {/* Clients */}
          {results.clients.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                <span>Clients</span>
              </div>
              <div className="space-y-1">
                {results.clients.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handleSelect(`/clients`)}
                    className="p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer flex justify-between items-center text-sm"
                  >
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">{c.name}</div>
                      {c.company && <div className="text-xs text-slate-500">{c.company}</div>}
                    </div>
                    <span className="text-xs text-brand-600 dark:text-brand-400">View Client</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invoices */}
          {results.invoices.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5" />
                <span>Invoices</span>
              </div>
              <div className="space-y-1">
                {results.invoices.map((inv) => (
                  <div
                    key={inv.id}
                    onClick={() => handleSelect(`/invoices`)}
                    className="p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer flex justify-between items-center text-sm"
                  >
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">
                        {inv.invoiceNumber} — {inv.client?.name}
                      </div>
                      <div className="text-xs text-slate-500">Status: {inv.status}</div>
                    </div>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      ${inv.total}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expenses */}
          {results.expenses.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5" />
                <span>Expenses</span>
              </div>
              <div className="space-y-1">
                {results.expenses.map((e) => (
                  <div
                    key={e.id}
                    onClick={() => handleSelect(`/expenses`)}
                    className="p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer flex justify-between items-center text-sm"
                  >
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">{e.vendor}</div>
                      <div className="text-xs text-slate-500">{e.categoryName}</div>
                    </div>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      ${e.amount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Documents */}
          {results.documents.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FolderLock className="w-3.5 h-3.5" />
                <span>Documents</span>
              </div>
              <div className="space-y-1">
                {results.documents.map((d) => (
                  <div
                    key={d.id}
                    onClick={() => handleSelect(`/documents`)}
                    className="p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer flex justify-between items-center text-sm"
                  >
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">{d.title}</div>
                      <div className="text-xs text-slate-500">{d.originalFilename}</div>
                    </div>
                    <span className="text-xs text-slate-400 uppercase">{d.docType}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
