import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Plus,
  Download,
  Upload,
  Search,
  Filter,
  Paperclip,
  CheckCircle2,
  Trash2,
  Edit2,
  Loader2,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { apiRequest, downloadBlob } from '../api/client';
import { Expense, ExpenseCategory, Client, Project } from '../types';

export const ExpensesPage: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [taxDeductibleOnly, setTaxDeductibleOnly] = useState(false);

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  // Form states
  const [amount, setAmount] = useState('');
  const [vendor, setVendor] = useState('');
  const [categoryName, setCategoryName] = useState('Software and Subscriptions');
  const [description, setDescription] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('CARD');
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [isBillable, setIsBillable] = useState(false);
  const [isTaxDeductible, setIsTaxDeductible] = useState(true);
  const [isRecurring, setIsRecurring] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      let url = `/expenses?limit=100`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (categoryFilter) url += `&categoryId=${categoryFilter}`;
      if (taxDeductibleOnly) url += `&isTaxDeductible=true`;

      const [expRes, catRes, clientRes, projRes] = await Promise.all([
        apiRequest<{ success: boolean; data: Expense[] }>(url),
        apiRequest<{ success: boolean; data: ExpenseCategory[] }>('/expenses/categories'),
        apiRequest<{ success: boolean; data: Client[] }>('/clients'),
        apiRequest<{ success: boolean; data: Project[] }>('/projects'),
      ]);

      if (expRes.data) setExpenses(expRes.data);
      if (catRes.data) setCategories(catRes.data);
      if (clientRes.data) setClients(clientRes.data);
      if (projRes.data) setProjects(projRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [search, categoryFilter, taxDeductibleOnly]);

  useEffect(() => {
    const handleExpenseAdded = () => fetchExpenses();
    window.addEventListener('fv:expense-added', handleExpenseAdded);
    return () => window.removeEventListener('fv:expense-added', handleExpenseAdded);
  }, []);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0 || !vendor.trim()) {
      setFormError('Please enter amount and vendor');
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      const formData = new FormData();
      formData.append('amount', amount);
      formData.append('vendor', vendor.trim());
      formData.append('categoryName', categoryName);
      formData.append('description', description);
      formData.append('expenseDate', expenseDate);
      formData.append('paymentMethod', paymentMethod);
      if (clientId) formData.append('clientId', clientId);
      if (projectId) formData.append('projectId', projectId);
      formData.append('isBillable', String(isBillable));
      formData.append('isTaxDeductible', String(isTaxDeductible));
      formData.append('isRecurring', String(isRecurring));

      if (receiptFile) {
        formData.append('receipt', receiptFile);
      }

      await apiRequest('/expenses', {
        method: 'POST',
        body: formData,
      });

      setModalOpen(false);
      fetchExpenses();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save expense');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      const blob = await apiRequest<Blob>('/expenses/export/csv');
      downloadBlob(blob, `expenses_export_${Date.now()}.csv`);
    } catch (err: any) {
      alert(err.message || 'Failed to export CSV');
    }
  };

  const handleImportCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) return;

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', csvFile);

      const res = await apiRequest<{ success: boolean; importedCount: number }>(
        '/expenses/import/csv',
        {
          method: 'POST',
          body: formData,
        }
      );

      alert(`Successfully imported ${res.importedCount} expenses!`);
      setCsvModalOpen(false);
      fetchExpenses();
    } catch (err: any) {
      alert(err.message || 'CSV Import failed. Check formatting.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadReceipt = async (expenseId: string, filename: string) => {
    try {
      const blob = await apiRequest<Blob>(`/expenses/${expenseId}/receipt`);
      downloadBlob(blob, filename || 'receipt.pdf');
    } catch (err: any) {
      alert(err.message || 'Failed to download receipt');
    }
  };

  const handleDeleteExpense = async (id: string, vendor: string) => {
    if (!confirm(`Delete expense for "${vendor}"?`)) return;
    try {
      await apiRequest(`/expenses/${id}`, { method: 'DELETE' });
      fetchExpenses();
    } catch (err: any) {
      alert(err.message || 'Failed to delete expense');
    }
  };

  const totalExpenseAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Expenses
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Track business deductions, subscriptions, and receipts encrypted at rest
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCsvModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import CSV</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => {
              setAmount('');
              setVendor('');
              setDescription('');
              setReceiptFile(null);
              setFormError('');
              setModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-xl shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search vendor, description, category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm dark:text-white"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-700 dark:text-slate-300"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={taxDeductibleOnly}
            onChange={(e) => setTaxDeductibleOnly(e.target.checked)}
            className="w-4 h-4 text-brand-600 rounded"
          />
          <span>Tax Deductible Only</span>
        </label>
      </div>

      {/* Total Banner */}
      <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-sm">
        <span className="text-slate-500">Filtered Total Expenses:</span>
        <span className="text-xl font-bold text-rose-600 dark:text-rose-400">
          ${totalExpenseAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </span>
      </div>

      {/* Expenses Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        </div>
      ) : expenses.length > 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Date</th>
                  <th className="px-6 py-3.5">Vendor</th>
                  <th className="px-6 py-3.5">Category</th>
                  <th className="px-6 py-3.5">Amount</th>
                  <th className="px-6 py-3.5">Receipt</th>
                  <th className="px-6 py-3.5">Deductible</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {expenses.map((e) => (
                  <tr
                    key={e.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      {new Date(e.expenseDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900 dark:text-white">{e.vendor}</div>
                      {e.description && (
                        <div className="text-xs text-slate-400 truncate max-w-xs">{e.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                        {e.categoryName}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                      ${e.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      {e.receiptFilename ? (
                        <button
                          onClick={() =>
                            handleDownloadReceipt(e.id, e.receiptOriginalName || 'receipt')
                          }
                          className="flex items-center gap-1.5 text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                          <span>View Receipt</span>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">None</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {e.isTaxDeductible ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Yes</span>
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">No</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDeleteExpense(e.id, e.vendor)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <CreditCard className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="font-semibold text-slate-900 dark:text-white">No expenses recorded</h3>
          <p className="text-sm text-slate-500 mt-1">
            Log receipts and expenses to maximize your tax deductions.
          </p>
        </div>
      )}

      {/* Add Expense Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white">Record Expense</h3>
              <button onClick={() => setModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
              {formError && (
                <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-950/40 rounded-lg">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Amount ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 text-lg font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Vendor / Payee *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Adobe, AWS, WeWork"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Category
                </label>
                <select
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Client (Optional)
                  </label>
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
                  >
                    <option value="">None</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Project (Optional)
                  </label>
                  <select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
                  >
                    <option value="">None</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Notes about business purpose"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
                />
              </div>

              {/* Receipt File */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Receipt Upload (AES-256 Encrypted at Rest)
                </label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                />
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isTaxDeductible}
                    onChange={(e) => setIsTaxDeductible(e.target.checked)}
                    className="w-4 h-4 text-brand-600 rounded"
                  />
                  <span className="text-slate-700 dark:text-slate-300">Tax Deductible</span>
                </label>

                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isBillable}
                    onChange={(e) => setIsBillable(e.target.checked)}
                    className="w-4 h-4 text-brand-600 rounded"
                  />
                  <span className="text-slate-700 dark:text-slate-300">Billable to Client</span>
                </label>

                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="w-4 h-4 text-brand-600 rounded"
                  />
                  <span className="text-slate-700 dark:text-slate-300">Monthly Recurring</span>
                </label>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-xl"
                >
                  {submitting ? 'Saving...' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Bulk Import Modal */}
      {csvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-brand-600" />
                <h3 className="font-bold text-slate-900 dark:text-white">Import Expenses from CSV</h3>
              </div>
              <button onClick={() => setCsvModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Upload a CSV file containing columns: Date, Vendor, Amount, Category, Description, Billable, TaxDeductible.
            </p>

            <form onSubmit={handleImportCsv} className="space-y-4">
              <input
                type="file"
                accept=".csv"
                required
                onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCsvModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !csvFile}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-lg disabled:opacity-50"
                >
                  {submitting ? 'Importing...' : 'Upload & Process'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
