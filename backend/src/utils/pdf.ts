import PDFDocument from 'pdfkit';

export interface InvoicePdfData {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  status: string;
  currency: string;
  businessName: string;
  businessEmail?: string;
  businessAddress?: string;
  businessTaxId?: string;
  bankDetails?: string;
  clientName: string;
  clientEmail?: string;
  clientCompany?: string;
  clientAddress?: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  notes?: string;
  terms?: string;
}

export function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      resolve(Buffer.concat(buffers));
    });
    doc.on('error', reject);

    // Header
    doc
      .fontSize(22)
      .fillColor('#1e293b')
      .text('INVOICE', 40, 40, { align: 'right' })
      .fontSize(10)
      .fillColor('#64748b')
      .text(`#${data.invoiceNumber}`, { align: 'right' })
      .moveDown(0.2)
      .text(`Status: ${data.status}`, { align: 'right' });

    // Business details
    doc
      .fontSize(16)
      .fillColor('#0f172a')
      .text(data.businessName || 'FreelanceVault Business', 40, 40)
      .fontSize(9)
      .fillColor('#475569');

    if (data.businessEmail) doc.text(data.businessEmail);
    if (data.businessAddress) doc.text(data.businessAddress);
    if (data.businessTaxId) doc.text(`Tax ID: ${data.businessTaxId}`);

    doc.moveDown(1.5);

    // Divider
    const yPos = doc.y;
    doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(40, yPos).lineTo(555, yPos).stroke();
    doc.moveDown(1);

    // Bill To & Dates
    const midY = doc.y;
    doc
      .fontSize(10)
      .fillColor('#0f172a')
      .text('BILL TO:', 40, midY)
      .fontSize(11)
      .fillColor('#1e293b')
      .text(data.clientName, 40, midY + 15)
      .fontSize(9)
      .fillColor('#64748b');

    let clientOffset = midY + 30;
    if (data.clientCompany) {
      doc.text(data.clientCompany, 40, clientOffset);
      clientOffset += 12;
    }
    if (data.clientEmail) {
      doc.text(data.clientEmail, 40, clientOffset);
      clientOffset += 12;
    }
    if (data.clientAddress) {
      doc.text(data.clientAddress, 40, clientOffset);
      clientOffset += 12;
    }

    // Invoice meta on the right
    doc
      .fontSize(9)
      .fillColor('#475569')
      .text(`Invoice Date: ${data.issueDate}`, 380, midY)
      .text(`Due Date: ${data.dueDate}`, 380, midY + 15)
      .text(`Currency: ${data.currency}`, 380, midY + 30);

    doc.y = Math.max(clientOffset + 20, midY + 55);

    // Table Header
    const tableTop = doc.y;
    doc.rect(40, tableTop, 515, 22).fill('#f8fafc');
    doc
      .fillColor('#475569')
      .fontSize(9)
      .text('DESCRIPTION', 50, tableTop + 6)
      .text('QTY', 330, tableTop + 6, { width: 50, align: 'right' })
      .text('UNIT PRICE', 390, tableTop + 6, { width: 75, align: 'right' })
      .text('AMOUNT', 475, tableTop + 6, { width: 70, align: 'right' });

    let itemY = tableTop + 26;

    // Items
    data.items.forEach((item) => {
      doc
        .fillColor('#1e293b')
        .fontSize(9)
        .text(item.description, 50, itemY, { width: 270 })
        .text(item.quantity.toString(), 330, itemY, { width: 50, align: 'right' })
        .text(`${data.currency} ${item.unitPrice.toFixed(2)}`, 390, itemY, { width: 75, align: 'right' })
        .text(`${data.currency} ${item.total.toFixed(2)}`, 475, itemY, { width: 70, align: 'right' });

      itemY += 20;
    });

    doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(40, itemY).lineTo(555, itemY).stroke();
    itemY += 10;

    // Summary calculations
    const summaryX = 350;
    const valueX = 475;
    const valueWidth = 70;

    doc.fontSize(9).fillColor('#64748b');
    doc.text('Subtotal:', summaryX, itemY).text(`${data.currency} ${data.subtotal.toFixed(2)}`, valueX, itemY, { align: 'right', width: valueWidth });
    itemY += 16;

    if (data.discountAmount > 0) {
      doc.text('Discount:', summaryX, itemY).text(`-${data.currency} ${data.discountAmount.toFixed(2)}`, valueX, itemY, { align: 'right', width: valueWidth });
      itemY += 16;
    }

    if (data.taxAmount > 0) {
      doc.text(`Tax (${data.taxRate}%):`, summaryX, itemY).text(`${data.currency} ${data.taxAmount.toFixed(2)}`, valueX, itemY, { align: 'right', width: valueWidth });
      itemY += 16;
    }

    doc.rect(340, itemY - 2, 215, 24).fill('#f1f5f9');
    doc.fillColor('#0f172a').fontSize(11).text('Total Due:', summaryX, itemY + 4);
    doc.text(`${data.currency} ${data.total.toFixed(2)}`, valueX, itemY + 4, { align: 'right', width: valueWidth });
    itemY += 30;

    if (data.amountPaid > 0) {
      const balanceDue = Math.max(0, data.total - data.amountPaid);
      doc.fillColor('#16a34a').fontSize(9).text('Paid:', summaryX, itemY).text(`${data.currency} ${data.amountPaid.toFixed(2)}`, valueX, itemY, { align: 'right', width: valueWidth });
      itemY += 16;
      doc.fillColor('#dc2626').text('Balance Due:', summaryX, itemY).text(`${data.currency} ${balanceDue.toFixed(2)}`, valueX, itemY, { align: 'right', width: valueWidth });
      itemY += 24;
    }

    // Notes and Bank Details
    if (data.bankDetails) {
      doc.fontSize(9).fillColor('#0f172a').text('Payment Instructions / Bank Details:', 40, itemY);
      doc.fontSize(8).fillColor('#475569').text(data.bankDetails, 40, itemY + 14);
      itemY += 35;
    }

    if (data.notes || data.terms) {
      if (data.notes) {
        doc.fontSize(9).fillColor('#0f172a').text('Notes:', 40, itemY);
        doc.fontSize(8).fillColor('#64748b').text(data.notes, 40, itemY + 14);
        itemY += 30;
      }
      if (data.terms) {
        doc.fontSize(9).fillColor('#0f172a').text('Terms & Conditions:', 40, itemY);
        doc.fontSize(8).fillColor('#64748b').text(data.terms, 40, itemY + 14);
      }
    }

    doc.end();
  });
}

export interface ReportPdfData {
  title: string;
  subtitle: string;
  generatedAt: string;
  currency: string;
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  incomeByClient: Array<{ clientName: string; amount: number; percentage: number }>;
  expensesByCategory: Array<{ categoryName: string; amount: number; percentage: number }>;
}

export function generateReportPdf(data: ReportPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Title
    doc.fontSize(20).fillColor('#0f172a').text(data.title, 40, 40);
    doc.fontSize(10).fillColor('#64748b').text(data.subtitle);
    doc.text(`Generated: ${data.generatedAt}`).moveDown(1.5);

    // KPI Cards
    const yKpi = doc.y;
    doc.rect(40, yKpi, 160, 60).fillAndStroke('#f0fdf4', '#86efac');
    doc.rect(215, yKpi, 160, 60).fillAndStroke('#fef2f2', '#fca5a5');
    doc.rect(390, yKpi, 165, 60).fillAndStroke('#f8fafc', '#cbd5e1');

    doc.fillColor('#166534').fontSize(9).text('TOTAL INCOME', 50, yKpi + 12);
    doc.fontSize(14).text(`${data.currency} ${data.totalIncome.toFixed(2)}`, 50, yKpi + 28);

    doc.fillColor('#991b1b').fontSize(9).text('TOTAL EXPENSES', 225, yKpi + 12);
    doc.fontSize(14).text(`${data.currency} ${data.totalExpenses.toFixed(2)}`, 225, yKpi + 28);

    doc.fillColor('#0f172a').fontSize(9).text('NET PROFIT', 400, yKpi + 12);
    doc.fontSize(14).text(`${data.currency} ${data.netProfit.toFixed(2)}`, 400, yKpi + 28);

    doc.y = yKpi + 85;

    // Expenses breakdown
    doc.fontSize(12).fillColor('#0f172a').text('Expenses by Category').moveDown(0.5);
    data.expensesByCategory.forEach((cat) => {
      doc.fontSize(9).fillColor('#334155').text(`${cat.categoryName}: ${data.currency} ${cat.amount.toFixed(2)} (${cat.percentage.toFixed(1)}%)`);
    });

    doc.moveDown(1);
    doc.fontSize(12).fillColor('#0f172a').text('Income by Client').moveDown(0.5);
    data.incomeByClient.forEach((cl) => {
      doc.fontSize(9).fillColor('#334155').text(`${cl.clientName}: ${data.currency} ${cl.amount.toFixed(2)} (${cl.percentage.toFixed(1)}%)`);
    });

    doc.end();
  });
}
