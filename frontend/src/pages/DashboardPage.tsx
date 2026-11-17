import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertCircle,
  Clock,
  Calendar,
  ArrowUpRight,
  Receipt,
  FileCheck2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { apiRequest } from '../api/client';
import { DashboardData } from '../types';

const CATEGORY_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444'];

export const DashboardPage: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [range, setRange] = useState('this_month');
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ success: boolean; data: DashboardData }>(
        `/reports/dashboard?range=${range}`
      );
      if (res.data) setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [range]);

  useEffect(() => {
    const handleExpenseAdded = () => fetchDashboard();
    window.addEventListener('fv:expense-added', handleExpenseAdded);
    return () => window.removeEventListener('fv:expense-added', handleExpenseAdded);
  }, [range]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  const metrics = data?.metrics || {
    totalIncome: 0,
    totalExpenses: 0,
    netProfit: 0,
    profitMargin: 0,
    pendingAmount: 0,
    overdueCount: 0,
    overdueAmount: 0,
  };

  return (
    <div className="space-y-6">
      {/* Title & Range Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Business Dashboard
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Real-time overview of cash flow, invoices, and expenses
          </p>
        </div>

        {/* Range picker buttons */}
        <div className="flex items-center p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm text-xs font-medium">
          <button
            onClick={() => setRange('this_month')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              range === 'this_month'
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            This Month
          </button>
          <button
            onClick={() => setRange('this_quarter')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              range === 'this_quarter'
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            This Quarter
          </button>
          <button
            onClick={() => setRange('this_year')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              range === 'this_year'
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            This Year
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Income */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Total Income
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              ${metrics.totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Payments received</span>
            </div>
          </div>
        </div>

        {/* Total Expenses */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Total Expenses
            </span>
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              ${metrics.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
              <span>Tracked and categorized</span>
            </div>
          </div>
        </div>

        {/* Net Profit */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Net Profit
            </span>
            <div className="p-2 rounded-xl bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div
              className={`text-2xl font-bold ${
                metrics.netProfit >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              ${metrics.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-1 text-xs text-slate-500 font-medium">
              Margin: <span className="font-semibold text-slate-800 dark:text-slate-200">{metrics.profitMargin}%</span>
            </div>
          </div>
        </div>

        {/* Pending & Overdue Invoices */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Unpaid Invoices
            </span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              ${metrics.pendingAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-amber-600 dark:text-amber-400">
              {metrics.overdueCount > 0 ? (
                <>
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{metrics.overdueCount} overdue (${metrics.overdueAmount})</span>
                </>
              ) : (
                <span>All current invoices on schedule</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Income vs Expenses Chart */}
        <div className="lg:col-span-2 p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Income vs Expenses</h3>
              <p className="text-xs text-slate-500">Monthly breakdown for {new Date().getFullYear()}</p>
            </div>
          </div>

          <div className="h-72 w-full">
            {data?.monthlyOverview && data.monthlyOverview.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthlyOverview}>
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '8px',
                      border: 'none',
                      color: '#fff',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="income" name="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-slate-400">
                No financial data recorded for this period yet.
              </div>
            )}
          </div>
        </div>

        {/* Expenses by Category Pie Chart */}
        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Expenses by Category</h3>
          <p className="text-xs text-slate-500 mb-4">Distribution of spending</p>

          <div className="h-48 w-full">
            {data?.expensesByCategory && data.expensesByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.expensesByCategory}
                    dataKey="amount"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                  >
                    {data.expensesByCategory.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number) => `$${val.toFixed(2)}`}
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '8px',
                      border: 'none',
                      color: '#fff',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-slate-400">
                No expenses logged in this range.
              </div>
            )}
          </div>

          {/* Category List */}
          <div className="mt-4 space-y-2 max-h-36 overflow-y-auto pr-1">
            {data?.expensesByCategory?.slice(0, 5).map((cat, idx) => (
              <div key={cat.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}
                  />
                  <span className="text-slate-600 dark:text-slate-300 truncate max-w-[120px]">
                    {cat.name}
                  </span>
                </div>
                <div className="font-medium text-slate-900 dark:text-white">
                  ${cat.amount.toFixed(2)}{' '}
                  <span className="text-slate-400 font-normal">({cat.percentage}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Two Column Section: Reminders & Unpaid Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Invoices */}
        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-brand-600" />
              <h3 className="font-semibold text-slate-900 dark:text-white">Outstanding Invoices</h3>
            </div>
          </div>

          <div className="space-y-3">
            {data?.pendingInvoices && data.pendingInvoices.length > 0 ? (
              data.pendingInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800"
                >
                  <div>
                    <div className="font-medium text-sm text-slate-900 dark:text-white">
                      {inv.invoiceNumber} — {inv.client?.name}
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <Calendar className="w-3 h-3" />
                      <span>Due {new Date(inv.dueDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                      ${(inv.total - inv.amountPaid).toFixed(2)}
                    </div>
                    <span
                      className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                        new Date(inv.dueDate) < new Date()
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                      }`}
                    >
                      {new Date(inv.dueDate) < new Date() ? 'Overdue' : 'Awaiting Payment'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-sm text-slate-400">
                No outstanding invoices. You're all caught up!
              </div>
            )}
          </div>
        </div>

        {/* Reminders */}
        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-indigo-500" />
              <h3 className="font-semibold text-slate-900 dark:text-white">Upcoming Reminders</h3>
            </div>
          </div>

          <div className="space-y-3">
            {data?.reminders && data.reminders.length > 0 ? (
              data.reminders.map((rem) => (
                <div
                  key={rem.id}
                  className="flex items-start justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800"
                >
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                      {rem.title}
                    </div>
                    {rem.notes && <div className="text-xs text-slate-500">{rem.notes}</div>}
                  </div>
                  <div className="text-right text-xs shrink-0 ml-3">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {new Date(rem.dueDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-sm text-slate-400">
                No upcoming tax deadlines or contract expirations.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
