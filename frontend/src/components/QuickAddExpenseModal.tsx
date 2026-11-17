import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, DollarSign, Check, Loader2 } from 'lucide-react';
import { apiRequest } from '../api/client';
import { ExpenseCategory } from '../types';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExpenseAdded?: () => void;
}

export const QuickAddExpenseModal: React.FC<QuickAddModalProps> = ({
  isOpen,
  onClose,
  onExpenseAdded,
}) => {
  const [amount, setAmount] = useState('');
  const [vendor, setVendor] = useState('');
  const [categoryName, setCategoryName] = useState('Software and Subscriptions');
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('CARD');
  const [isTaxDeductible, setIsTaxDeductible] = useState(true);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const amountInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => amountInputRef.current?.focus(), 50);
      loadCategories();
    } else {
      setAmount('');
      setVendor('');
      setReceiptFile(null);
      setError('');
    }
  }, [isOpen]);

  const loadCategories = async () => {
    try {
      const res = await apiRequest<{ success: boolean; data: ExpenseCategory[] }>('/expenses/categories');
      if (res.data) setCategories(res.data);
    } catch {
      // Keep defaults
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (!vendor.trim()) {
      setError('Vendor or description is required');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('amount', amount);
      formData.append('vendor', vendor.trim());
      formData.append('categoryName', categoryName);
      formData.append('paymentMethod', paymentMethod);
      formData.append('isTaxDeductible', String(isTaxDeductible));
      formData.append('expenseDate', new Date().toISOString());

      if (receiptFile) {
        formData.append('receipt', receiptFile);
      }

      await apiRequest('/expenses', {
        method: 'POST',
        body: formData,
      });

      if (onExpenseAdded) onExpenseAdded();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save expense');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Quick Add Expense</h3>
            <p className="text-xs text-slate-500">Record a business expense in seconds</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-900">
              {error}
            </div>
          )}

          {/* Amount field - Prominent */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
              Amount ($)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <DollarSign className="w-5 h-5" />
              </span>
              <input
                ref={amountInputRef}
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-xl font-bold bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none dark:text-white"
                required
              />
            </div>
          </div>

          {/* Vendor */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
              Vendor / Merchant
            </label>
            <input
              type="text"
              placeholder="e.g. GitHub, AWS, Starbucks, Uber"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none dark:text-white"
              required
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
              Category
            </label>
            <select
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none dark:text-white"
            >
              {categories.length > 0 ? (
                categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))
              ) : (
                <>
                  <option value="Software and Subscriptions">Software & Subscriptions</option>
                  <option value="Equipment">Equipment</option>
                  <option value="Food and Meals">Food & Meals</option>
                  <option value="Travel">Travel</option>
                  <option value="Internet and Phone">Internet & Phone</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Other">Other</option>
                </>
              )}
            </select>
          </div>

          {/* Receipt Upload & Deductible toggle */}
          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 dark:text-slate-400 hover:text-brand-600">
              <Upload className="w-4 h-4 text-slate-400" />
              <span>{receiptFile ? receiptFile.name : 'Attach Receipt'}</span>
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
              />
            </label>

            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isTaxDeductible}
                onChange={(e) => setIsTaxDeductible(e.target.checked)}
                className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
              />
              <span>Tax Deductible</span>
            </label>
          </div>

          {/* Action buttons */}
          <div className="pt-3">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-500 active:bg-brand-700 rounded-xl shadow-md shadow-brand-600/20 disabled:opacity-50 transition-colors"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Expense (Enter)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
