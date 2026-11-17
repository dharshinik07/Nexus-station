import { Response } from 'express';
import { stringify } from 'csv-stringify/sync';
import { prisma } from '../utils/prisma.js';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { getTenantScope } from '../middlewares/tenant.js';
import { generateReportPdf, ReportPdfData } from '../utils/pdf.js';
import { logAudit } from '../utils/audit.js';

function getDateRange(range?: string, start?: string, end?: string): { startDate: Date; endDate: Date } {
  const now = new Date();
  if (start && end) {
    return { startDate: new Date(start), endDate: new Date(end) };
  }

  if (range === 'this_quarter') {
    const quarter = Math.floor(now.getMonth() / 3);
    const startDate = new Date(now.getFullYear(), quarter * 3, 1);
    const endDate = new Date(now.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59);
    return { startDate, endDate };
  }

  if (range === 'this_year') {
    const startDate = new Date(now.getFullYear(), 0, 1);
    const endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    return { startDate, endDate };
  }

  // Default: this month
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return { startDate, endDate };
}

export async function getDashboardData(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const scope = getTenantScope(req);
    const { range = 'this_month', startDate: qStart, endDate: qEnd } = req.query;
    const { startDate, endDate } = getDateRange(range as string, qStart as string, qEnd as string);

    // 1. Invoices & Payments (Income)
    const payments = await prisma.payment.findMany({
      where: {
        ...scope,
        paymentDate: { gte: startDate, lte: endDate },
      },
    });
    const totalIncome = payments.reduce((sum, p) => sum + p.amount, 0);

    // 2. Expenses
    const expenses = await prisma.expense.findMany({
      where: {
        ...scope,
        expenseDate: { gte: startDate, lte: endDate },
      },
      include: { category: true },
    });
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = totalIncome - totalExpenses;

    // 3. Pending & Overdue Invoices
    const pendingInvoices = await prisma.invoice.findMany({
      where: {
        ...scope,
        status: { in: ['SENT', 'PARTIALLY_PAID'] },
      },
      include: { client: { select: { name: true } } },
      orderBy: { dueDate: 'asc' },
    });

    const now = new Date();
    const overdueInvoices = pendingInvoices.filter((inv) => new Date(inv.dueDate) < now);

    // 4. Monthly Income vs Expenses for the current year (Chart Data)
    const currentYear = now.getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59);

    const yearPayments = await prisma.payment.findMany({
      where: {
        ...scope,
        paymentDate: { gte: yearStart, lte: yearEnd },
      },
    });

    const yearExpenses = await prisma.expense.findMany({
      where: {
        ...scope,
        expenseDate: { gte: yearStart, lte: yearEnd },
      },
    });

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyOverview = months.map((month, idx) => {
      const monthIncome = yearPayments
        .filter((p) => p.paymentDate.getMonth() === idx)
        .reduce((sum, p) => sum + p.amount, 0);
      const monthExp = yearExpenses
        .filter((e) => e.expenseDate.getMonth() === idx)
        .reduce((sum, e) => sum + e.amount, 0);
      return {
        month,
        income: parseFloat(monthIncome.toFixed(2)),
        expenses: parseFloat(monthExp.toFixed(2)),
        profit: parseFloat((monthIncome - monthExp).toFixed(2)),
      };
    });

    // 5. Expenses by Category
    const categoryMap = new Map<string, number>();
    expenses.forEach((e) => {
      const cat = e.categoryName || 'Other';
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + e.amount);
    });

    const expensesByCategory = Array.from(categoryMap.entries()).map(([name, amount]) => ({
      name,
      amount: parseFloat(amount.toFixed(2)),
      percentage: totalExpenses > 0 ? parseFloat(((amount / totalExpenses) * 100).toFixed(1)) : 0,
    }));

    // 6. Top Clients by Revenue
    const clientPayments = await prisma.invoice.findMany({
      where: {
        ...scope,
        amountPaid: { gt: 0 },
      },
      include: { client: { select: { id: true, name: true } } },
    });

    const clientRevMap = new Map<string, number>();
    clientPayments.forEach((inv) => {
      const cName = inv.client.name;
      clientRevMap.set(cName, (clientRevMap.get(cName) || 0) + inv.amountPaid);
    });

    const topClients = Array.from(clientRevMap.entries())
      .map(([name, amount]) => ({ name, amount: parseFloat(amount.toFixed(2)) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // 7. Upcoming Reminders
    const reminders = await prisma.reminder.findMany({
      where: {
        ...scope,
        isCompleted: false,
        dueDate: { gte: now },
      },
      orderBy: { dueDate: 'asc' },
      take: 6,
    });

    res.json({
      success: true,
      data: {
        timeRange: { startDate, endDate, label: range },
        metrics: {
          totalIncome: parseFloat(totalIncome.toFixed(2)),
          totalExpenses: parseFloat(totalExpenses.toFixed(2)),
          netProfit: parseFloat(netProfit.toFixed(2)),
          profitMargin: totalIncome > 0 ? parseFloat(((netProfit / totalIncome) * 100).toFixed(1)) : 0,
          pendingAmount: pendingInvoices.reduce((sum, i) => sum + (i.total - i.amountPaid), 0),
          overdueCount: overdueInvoices.length,
          overdueAmount: overdueInvoices.reduce((sum, i) => sum + (i.total - i.amountPaid), 0),
        },
        monthlyOverview,
        expensesByCategory,
        topClients,
        pendingInvoices: pendingInvoices.slice(0, 5),
        reminders,
      },
    });
  } catch (error) {
    console.error('Dashboard data error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard metrics' });
  }
}

export async function getReports(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const scope = getTenantScope(req);
    const { range = 'this_year', startDate: qStart, endDate: qEnd } = req.query;
    const { startDate, endDate } = getDateRange(range as string, qStart as string, qEnd as string);

    const [payments, expenses, invoices, settings] = await Promise.all([
      prisma.payment.findMany({
        where: { ...scope, paymentDate: { gte: startDate, lte: endDate } },
        include: { invoice: { include: { client: true } } },
      }),
      prisma.expense.findMany({
        where: { ...scope, expenseDate: { gte: startDate, lte: endDate } },
        include: { client: true },
      }),
      prisma.invoice.findMany({
        where: { ...scope, issueDate: { gte: startDate, lte: endDate } },
        include: { client: true },
      }),
      prisma.setting.findUnique({ where: { userId: req.user!.id } }),
    ]);

    const totalIncome = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = totalIncome - totalExpenses;

    // Tax calculation
    const taxRate = settings?.defaultTaxRate || 10;
    const estimatedTaxOwed = parseFloat(((Math.max(0, netProfit) * taxRate) / 100).toFixed(2));
    const taxDeductibleExpenses = expenses
      .filter((e) => e.isTaxDeductible)
      .reduce((sum, e) => sum + e.amount, 0);

    // Expenses breakdown
    const catMap = new Map<string, number>();
    expenses.forEach((e) => {
      catMap.set(e.categoryName, (catMap.get(e.categoryName) || 0) + e.amount);
    });
    const expensesByCategory = Array.from(catMap.entries()).map(([name, amount]) => ({
      categoryName: name,
      amount: parseFloat(amount.toFixed(2)),
      percentage: totalExpenses > 0 ? parseFloat(((amount / totalExpenses) * 100).toFixed(1)) : 0,
    }));

    // Income breakdown
    const clientMap = new Map<string, number>();
    payments.forEach((p) => {
      const cName = p.invoice?.client?.name || 'Direct / Other';
      clientMap.set(cName, (clientMap.get(cName) || 0) + p.amount);
    });
    const incomeByClient = Array.from(clientMap.entries()).map(([name, amount]) => ({
      clientName: name,
      amount: parseFloat(amount.toFixed(2)),
      percentage: totalIncome > 0 ? parseFloat(((amount / totalIncome) * 100).toFixed(1)) : 0,
    }));

    // Outstanding Invoices
    const outstandingInvoices = invoices
      .filter((i) => i.status !== 'PAID' && i.status !== 'CANCELLED')
      .map((i) => ({
        invoiceNumber: i.invoiceNumber,
        clientName: i.client.name,
        dueDate: i.dueDate.toISOString().split('T')[0],
        total: i.total,
        amountPaid: i.amountPaid,
        balanceDue: parseFloat((i.total - i.amountPaid).toFixed(2)),
        status: i.status,
      }));

    res.json({
      success: true,
      data: {
        dateRange: { startDate, endDate, range },
        currency: settings?.currency || 'USD',
        profitAndLoss: {
          totalIncome: parseFloat(totalIncome.toFixed(2)),
          totalExpenses: parseFloat(totalExpenses.toFixed(2)),
          netProfit: parseFloat(netProfit.toFixed(2)),
          profitMargin: totalIncome > 0 ? parseFloat(((netProfit / totalIncome) * 100).toFixed(1)) : 0,
        },
        taxSummary: {
          taxType: settings?.taxType || 'GST',
          taxRate,
          taxDeductibleExpenses: parseFloat(taxDeductibleExpenses.toFixed(2)),
          estimatedTaxOwed,
        },
        expensesByCategory,
        incomeByClient,
        outstandingInvoices,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to generate financial reports' });
  }
}

export async function exportReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const scope = getTenantScope(req);
    const { format = 'csv', range = 'this_year', startDate: qStart, endDate: qEnd } = req.query;
    const { startDate, endDate } = getDateRange(range as string, qStart as string, qEnd as string);

    const [payments, expenses, settings] = await Promise.all([
      prisma.payment.findMany({
        where: { ...scope, paymentDate: { gte: startDate, lte: endDate } },
        include: { invoice: { include: { client: true } } },
      }),
      prisma.expense.findMany({
        where: { ...scope, expenseDate: { gte: startDate, lte: endDate } },
      }),
      prisma.setting.findUnique({ where: { userId: req.user!.id } }),
    ]);

    const totalIncome = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = totalIncome - totalExpenses;
    const currency = settings?.currency || 'USD';

    // Grouping
    const catMap = new Map<string, number>();
    expenses.forEach((e) => catMap.set(e.categoryName, (catMap.get(e.categoryName) || 0) + e.amount));
    const expensesByCategory = Array.from(catMap.entries()).map(([categoryName, amount]) => ({
      categoryName,
      amount,
      percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
    }));

    const clientMap = new Map<string, number>();
    payments.forEach((p) => {
      const cName = p.invoice?.client?.name || 'Other';
      clientMap.set(cName, (clientMap.get(cName) || 0) + p.amount);
    });
    const incomeByClient = Array.from(clientMap.entries()).map(([clientName, amount]) => ({
      clientName,
      amount,
      percentage: totalIncome > 0 ? (amount / totalIncome) * 100 : 0,
    }));

    if (format === 'pdf') {
      const reportData: ReportPdfData = {
        title: 'FreelanceVault Financial Summary & P&L Report',
        subtitle: `Period: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
        generatedAt: new Date().toLocaleString(),
        currency,
        totalIncome,
        totalExpenses,
        netProfit,
        incomeByClient,
        expensesByCategory,
      };

      const pdfBuffer = await generateReportPdf(reportData);

      await logAudit({
        userId: req.user!.id,
        teamId: req.teamId,
        action: 'EXPORT',
        entity: 'BACKUP',
        ipAddress: req.ip,
        metadata: { format: 'PDF', type: 'financial_report' },
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="financial_report_${Date.now()}.pdf"`);
      res.send(pdfBuffer);
      return;
    }

    // CSV format
    const rows = [
      { Metric: 'Report Period', Value: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}` },
      { Metric: 'Total Income', Value: `${currency} ${totalIncome.toFixed(2)}` },
      { Metric: 'Total Expenses', Value: `${currency} ${totalExpenses.toFixed(2)}` },
      { Metric: 'Net Profit', Value: `${currency} ${netProfit.toFixed(2)}` },
      { Metric: '---', Value: '---' },
      ...expensesByCategory.map((c) => ({ Metric: `Expense Category: ${c.categoryName}`, Value: `${currency} ${c.amount.toFixed(2)}` })),
      { Metric: '---', Value: '---' },
      ...incomeByClient.map((cl) => ({ Metric: `Income from: ${cl.clientName}`, Value: `${currency} ${cl.amount.toFixed(2)}` })),
    ];

    const csvOutput = stringify(rows, { header: true });

    await logAudit({
      userId: req.user!.id,
      teamId: req.teamId,
      action: 'EXPORT',
      entity: 'BACKUP',
      ipAddress: req.ip,
      metadata: { format: 'CSV', type: 'financial_report' },
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="financial_report_${Date.now()}.csv"`);
    res.send(csvOutput);
  } catch (error) {
    console.error('Report export error:', error);
    res.status(500).json({ success: false, error: 'Failed to export report' });
  }
}
