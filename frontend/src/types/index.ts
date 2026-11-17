export interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
  twoFactorEnabled: boolean;
  setting?: Setting;
  teams?: Array<{ teamId: string; name: string; role: string }>;
}

export interface Setting {
  id: string;
  businessName?: string;
  logoUrl?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  bankDetails?: string;
  currency: string;
  dateFormat: string;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  taxType: string;
  defaultTaxRate: number;
  reminderDaysBefore: number;
}

export interface Client {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  notes?: string;
  tags?: string[];
  status: 'ACTIVE' | 'INACTIVE';
  projectCount?: number;
  invoiceCount?: number;
  totalBilled?: number;
  totalPaid?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  title: string;
  description?: string;
  clientId: string;
  client?: { id: string; name: string; company?: string };
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED';
  billingType: 'FIXED' | 'HOURLY';
  rate: number;
  budget?: number;
  startDate?: string;
  endDate?: string;
  totalInvoiced: number;
  totalPaid: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  totalHours: number;
  activeTimer?: { id: string; startTime: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  clientId: string;
  client: { id: string; name: string; company?: string; email?: string };
  projectId?: string;
  project?: { id: string; title: string };
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  status: 'DRAFT' | 'SENT' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  currency: string;
  discountAmount: number;
  discountType: 'FIXED' | 'PERCENTAGE';
  taxRate: number;
  taxAmount: number;
  subtotal: number;
  total: number;
  amountPaid: number;
  notes?: string;
  terms?: string;
  isRecurring: boolean;
  recurringInterval?: string;
  items: InvoiceItem[];
  payments?: Payment[];
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  reference?: string;
  notes?: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  color: string;
  isSystem: boolean;
}

export interface Expense {
  id: string;
  amount: number;
  currency: string;
  categoryId?: string;
  category?: ExpenseCategory;
  categoryName: string;
  vendor: string;
  description?: string;
  expenseDate: string;
  paymentMethod: string;
  clientId?: string;
  client?: { id: string; name: string };
  projectId?: string;
  project?: { id: string; title: string };
  isBillable: boolean;
  isTaxDeductible: boolean;
  tags?: string;
  receiptFilename?: string;
  receiptOriginalName?: string;
  isRecurring: boolean;
  recurringFrequency?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentItem {
  id: string;
  title: string;
  docType: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  tags: string[];
  expiresAt?: string;
  isExpired?: boolean;
  notes?: string;
  client?: { id: string; name: string };
  project?: { id: string; title: string };
  createdAt: string;
}

export interface DashboardData {
  timeRange: { startDate: string; endDate: string; label: string };
  metrics: {
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
    profitMargin: number;
    pendingAmount: number;
    overdueCount: number;
    overdueAmount: number;
  };
  monthlyOverview: Array<{ month: string; income: number; expenses: number; profit: number }>;
  expensesByCategory: Array<{ name: string; amount: number; percentage: number }>;
  topClients: Array<{ name: string; amount: number }>;
  pendingInvoices: Invoice[];
  reminders: Array<{
    id: string;
    title: string;
    reminderType: string;
    dueDate: string;
    notes?: string;
  }>;
}

export interface FinancialReportData {
  dateRange: { startDate: string; endDate: string; range: string };
  currency: string;
  profitAndLoss: {
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
    profitMargin: number;
  };
  taxSummary: {
    taxType: string;
    taxRate: number;
    taxDeductibleExpenses: number;
    estimatedTaxOwed: number;
  };
  expensesByCategory: Array<{ categoryName: string; amount: number; percentage: number }>;
  incomeByClient: Array<{ clientName: string; amount: number; percentage: number }>;
  outstandingInvoices: Array<{
    invoiceNumber: string;
    clientName: string;
    dueDate: string;
    total: number;
    amountPaid: number;
    balanceDue: number;
    status: string;
  }>;
}
