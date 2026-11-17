import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  PieChart,
  FileSpreadsheet,
  FileText,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { apiRequest, downloadBlob } from '../api/client';
import { FinancialReportData } from '../types';

export const ReportsPage: React.FC = () => {
  const [data, setData] = useState<FinancialReportData | null>(null);
  const [range, setRange] = useState('this_year');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ success: boolean; data: FinancialReportData }>(
        `/reports/financial?range=${range}`
      );
      if (res.data) setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [range]);

  const handleExport = async (format: 'pdf' | 'csv') => {
    try {
      setExporting(true);
      const blob = await apiRequest<Blob>(`/reports/export?range=${range}&format=${format}`);
      downloadBlob(blob, `financial_report_${range}_${Date.now()}.${format}`);
    } catch (err: any) {
      alert(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  const pnl = data?.profitAndLoss || { totalIncome: 0, totalExpenses: 0, netProfit: 0, profitMargin: 0 };
  const tax = data?.taxSummary || { taxType: 'GST', taxRate: 10, taxDeductibleExpenses: 0, estimatedTaxOwed: 0 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Tax & Financial Reports
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Profit & Loss statements, expense deductions, and official export documents
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Range Picker */}
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm dark:text-white"
          >
            <option value="this_month">This Month</option>
            <option value="this_quarter">This Quarter</option>
            <option value="this_year">This Year ({new Date().getFullYear()})</option>
          </select>

          {/* Export Buttons */}
          <button
            onClick={() => handleExport('pdf')}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <FileText className="w-3.5 h-3.5 text-red-500" />
            <span>PDF Export</span>
          </button>

          <button
            onClick={() => handleExport('csv')}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
            <span>CSV / Excel</span>
          </button>
        </div>
      </div>

      {/* P&L Statement Card */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Profit and Loss Statement
            </h2>
            <div className="text-xs text-slate-400 mt-0.5">
              Period: {data?.dateRange.startDate ? new Date(data.dateRange.startDate).toLocaleDateString() : ''} to{' '}
              {data?.dateRange.endDate ? new Date(data.dateRange.endDate).toLocaleDateString() : ''}
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            Currency: {data?.currency || 'USD'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900">
            <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase">
              Gross Revenue (Income)
            </div>
            <div className="text-2xl font-bold text-emerald-600 mt-2">
              ${pnl.totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="p-4 bg-rose-50/50 dark:bg-rose-950/20 rounded-xl border border-rose-100 dark:border-rose-900">
            <div className="text-xs font-semibold text-rose-700 dark:text-rose-400 uppercase">
              Total Business Expenses
            </div>
            <div className="text-2xl font-bold text-rose-600 mt-2">
              ${pnl.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="p-4 bg-brand-50/50 dark:bg-brand-950/20 rounded-xl border border-brand-100 dark:border-brand-900">
            <div className="text-xs font-semibold text-brand-700 dark:text-brand-400 uppercase">
              Net Profit Before Tax
            </div>
            <div className="text-2xl font-bold text-brand-600 mt-2">
              ${pnl.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* Tax Summary Card */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-900 dark:text-white">Tax Liability & Deductions</h3>
        <p className="text-xs text-slate-500">
          Estimated based on your configured tax rate ({tax.taxRate}% {tax.taxType})
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <div className="text-xs font-medium text-slate-500">Tax Deductible Expenses</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              ${tax.taxDeductibleExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Expenses tagged as tax deductible
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <div className="text-xs font-medium text-slate-500">Estimated {tax.taxType} Payable</div>
            <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
              ${tax.estimatedTaxOwed.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Set aside for quarterly/annual tax remittances
            </div>
          </div>
        </div>
      </div>

      {/* Breakdowns: Clients vs Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Income by Client */}
        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="font-bold text-slate-900 dark:text-white mb-4">Revenue by Client</h3>
          <div className="space-y-3">
            {data?.incomeByClient && data.incomeByClient.length > 0 ? (
              data.incomeByClient.map((cl) => (
                <div key={cl.clientName} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-700 dark:text-slate-300">{cl.clientName}</span>
                    <span className="text-slate-900 dark:text-white font-bold">
                      ${cl.amount.toFixed(2)} ({cl.percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-brand-500 h-full rounded-full"
                      style={{ width: `${cl.percentage}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-400 py-4 text-center">No revenue recorded in this period.</div>
            )}
          </div>
        </div>

        {/* Expenses by Category */}
        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="font-bold text-slate-900 dark:text-white mb-4">Expenses by Category</h3>
          <div className="space-y-3">
            {data?.expensesByCategory && data.expensesByCategory.length > 0 ? (
              data.expensesByCategory.map((cat) => (
                <div key={cat.categoryName} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-700 dark:text-slate-300">{cat.categoryName}</span>
                    <span className="text-slate-900 dark:text-white font-bold">
                      ${cat.amount.toFixed(2)} ({cat.percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-rose-500 h-full rounded-full"
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-400 py-4 text-center">No expenses recorded in this period.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
