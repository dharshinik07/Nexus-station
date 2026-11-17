import { Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { getTenantScope } from '../middlewares/tenant.js';
import { generateInvoicePdf, InvoicePdfData } from '../utils/pdf.js';
import { decryptText } from '../utils/crypto.js';
import { logAudit } from '../utils/audit.js';

export async function getInvoices(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const scope = getTenantScope(req);
    const { status, clientId, search, page = '1', limit = '50' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = { ...scope };

    if (status && status !== 'ALL') {
      where.status = status as string;
    }

    if (clientId) {
      where.clientId = clientId as string;
    }

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search as string } },
        { client: { name: { contains: search as string } } },
      ];
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { issueDate: 'desc' },
        include: {
          client: { select: { id: true, name: true, company: true, email: true } },
          project: { select: { id: true, title: true } },
          items: true,
          payments: { where: { deletedAt: null } },
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    res.json({
      success: true,
      data: invoices,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch invoices' });
  }
}

export async function getInvoiceById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const scope = getTenantScope(req);
    const { id } = req.params;

    const invoice = await prisma.invoice.findFirst({
      where: { id, ...scope },
      include: {
        client: true,
        project: true,
        items: true,
        payments: {
          where: { deletedAt: null },
          orderBy: { paymentDate: 'desc' },
        },
      },
    });

    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    res.json({ success: true, data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch invoice' });
  }
}

export async function createInvoice(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const {
      clientId,
      projectId,
      invoiceNumber: customInvoiceNumber,
      issueDate,
      dueDate,
      currency = 'USD',
      discountAmount = 0,
      discountType = 'FIXED',
      taxRate = 0,
      notes,
      terms,
      isRecurring = false,
      recurringInterval,
      items,
    } = req.body;

    // Validate client belongs to tenant
    const client = await prisma.client.findFirst({
      where: { id: clientId, ...getTenantScope(req) },
    });
    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    // Resolve invoice number
    let finalInvoiceNumber = customInvoiceNumber;
    if (!finalInvoiceNumber) {
      const setting = await prisma.setting.findUnique({
        where: { userId: req.user!.id },
      });
      const prefix = setting?.invoicePrefix || 'INV-';
      const num = setting?.nextInvoiceNumber || 1001;
      finalInvoiceNumber = `${prefix}${num}`;

      // Increment next invoice number
      await prisma.setting.upsert({
        where: { userId: req.user!.id },
        update: { nextInvoiceNumber: { increment: 1 } },
        create: { userId: req.user!.id, nextInvoiceNumber: 1002 },
      });
    }

    // Calculate totals
    const parsedItems = (items || []).map((item: any) => {
      const qty = parseFloat(item.quantity) || 1;
      const unit = parseFloat(item.unitPrice) || 0;
      return {
        description: item.description || 'Service',
        quantity: qty,
        unitPrice: unit,
        total: parseFloat((qty * unit).toFixed(2)),
      };
    });

    const subtotal = parsedItems.reduce((acc: number, curr: any) => acc + curr.total, 0);
    const disc = parseFloat(discountAmount) || 0;
    const computedDiscount = discountType === 'PERCENTAGE' ? (subtotal * disc) / 100 : disc;
    const taxableAmount = Math.max(0, subtotal - computedDiscount);
    const rate = parseFloat(taxRate) || 0;
    const taxAmount = parseFloat(((taxableAmount * rate) / 100).toFixed(2));
    const total = parseFloat((taxableAmount + taxAmount).toFixed(2));

    const invoice = await prisma.invoice.create({
      data: {
        userId: req.user!.id,
        teamId: req.teamId || null,
        clientId,
        projectId: projectId || null,
        invoiceNumber: finalInvoiceNumber,
        issueDate: issueDate ? new Date(issueDate) : new Date(),
        dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 14 * 86400000),
        status: 'DRAFT',
        currency,
        discountAmount: disc,
        discountType,
        taxRate: rate,
        taxAmount,
        subtotal,
        total,
        amountPaid: 0,
        notes,
        terms,
        isRecurring: Boolean(isRecurring),
        recurringInterval: isRecurring ? recurringInterval : null,
        items: {
          create: parsedItems,
        },
      },
      include: {
        client: true,
        project: true,
        items: true,
      },
    });

    await logAudit({
      userId: req.user!.id,
      teamId: req.teamId,
      action: 'CREATE',
      entity: 'INVOICE',
      entityId: invoice.id,
      ipAddress: req.ip,
      metadata: { invoiceNumber: invoice.invoiceNumber, total: invoice.total, client: client.name },
    });

    res.status(201).json({ success: true, data: invoice });
  } catch (error: any) {
    console.error('Error creating invoice:', error);
    if (error.code === 'P2002') {
      res.status(409).json({ success: false, error: 'Invoice number already exists' });
      return;
    }
    res.status(500).json({ success: false, error: 'Failed to create invoice' });
  }
}

export async function updateInvoice(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const scope = getTenantScope(req);
    const { id } = req.params;
    const {
      clientId,
      projectId,
      invoiceNumber,
      issueDate,
      dueDate,
      status,
      currency,
      discountAmount,
      discountType,
      taxRate,
      notes,
      terms,
      isRecurring,
      recurringInterval,
      items,
    } = req.body;

    const existing = await prisma.invoice.findFirst({
      where: { id, ...scope },
      include: { items: true },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    let parsedItems = existing.items;
    let subtotal = existing.subtotal;
    let taxAmount = existing.taxAmount;
    let total = existing.total;

    if (items && Array.isArray(items)) {
      parsedItems = items.map((item: any) => {
        const qty = parseFloat(item.quantity) || 1;
        const unit = parseFloat(item.unitPrice) || 0;
        return {
          description: item.description,
          quantity: qty,
          unitPrice: unit,
          total: parseFloat((qty * unit).toFixed(2)),
        } as any;
      });

      subtotal = parsedItems.reduce((acc: number, curr: any) => acc + curr.total, 0);
      const disc = discountAmount !== undefined ? parseFloat(discountAmount) : existing.discountAmount;
      const type = discountType || existing.discountType;
      const computedDiscount = type === 'PERCENTAGE' ? (subtotal * disc) / 100 : disc;
      const taxableAmount = Math.max(0, subtotal - computedDiscount);
      const rate = taxRate !== undefined ? parseFloat(taxRate) : existing.taxRate;
      taxAmount = parseFloat(((taxableAmount * rate) / 100).toFixed(2));
      total = parseFloat((taxableAmount + taxAmount).toFixed(2));

      // Replace items
      await prisma.invoiceItem.deleteMany({ where: { invoiceId: id } });
    }

    // Determine status if paid
    let resolvedStatus = status || existing.status;
    if (existing.amountPaid >= total && total > 0) {
      resolvedStatus = 'PAID';
    } else if (existing.amountPaid > 0 && existing.amountPaid < total) {
      resolvedStatus = 'PARTIALLY_PAID';
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        clientId: clientId !== undefined ? clientId : existing.clientId,
        projectId: projectId !== undefined ? projectId : existing.projectId,
        invoiceNumber: invoiceNumber !== undefined ? invoiceNumber : existing.invoiceNumber,
        issueDate: issueDate ? new Date(issueDate) : existing.issueDate,
        dueDate: dueDate ? new Date(dueDate) : existing.dueDate,
        status: resolvedStatus,
        currency: currency !== undefined ? currency : existing.currency,
        discountAmount: discountAmount !== undefined ? parseFloat(discountAmount) : existing.discountAmount,
        discountType: discountType !== undefined ? discountType : existing.discountType,
        taxRate: taxRate !== undefined ? parseFloat(taxRate) : existing.taxRate,
        taxAmount,
        subtotal,
        total,
        notes: notes !== undefined ? notes : existing.notes,
        terms: terms !== undefined ? terms : existing.terms,
        isRecurring: isRecurring !== undefined ? Boolean(isRecurring) : existing.isRecurring,
        recurringInterval: recurringInterval !== undefined ? recurringInterval : existing.recurringInterval,
        items: items && Array.isArray(items) ? { create: parsedItems } : undefined,
      },
      include: {
        client: true,
        project: true,
        items: true,
      },
    });

    await logAudit({
      userId: req.user!.id,
      teamId: req.teamId,
      action: 'UPDATE',
      entity: 'INVOICE',
      entityId: updated.id,
      ipAddress: req.ip,
      metadata: { invoiceNumber: updated.invoiceNumber, status: updated.status },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update invoice' });
  }
}

export async function recordPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const scope = getTenantScope(req);
    const { id: invoiceId } = req.params;
    const { amount, paymentDate, paymentMethod, reference, notes } = req.body;

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, ...scope },
    });

    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    const payAmount = parseFloat(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      res.status(400).json({ success: false, error: 'Valid payment amount is required' });
      return;
    }

    const payment = await prisma.payment.create({
      data: {
        userId: req.user!.id,
        teamId: req.teamId || null,
        invoiceId,
        amount: payAmount,
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        paymentMethod: paymentMethod || 'BANK_TRANSFER',
        reference,
        notes,
      },
    });

    const newAmountPaid = invoice.amountPaid + payAmount;
    let newStatus = invoice.status;
    if (newAmountPaid >= invoice.total) {
      newStatus = 'PAID';
    } else {
      newStatus = 'PARTIALLY_PAID';
    }

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        amountPaid: newAmountPaid,
        status: newStatus,
      },
    });

    await logAudit({
      userId: req.user!.id,
      teamId: req.teamId,
      action: 'CREATE',
      entity: 'INVOICE',
      entityId: invoiceId,
      ipAddress: req.ip,
      metadata: { action: 'recorded_payment', amount: payAmount, reference },
    });

    res.status(201).json({ success: true, data: payment });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to record payment' });
  }
}

export async function downloadInvoicePdf(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const scope = getTenantScope(req);
    const { id } = req.params;

    const invoice = await prisma.invoice.findFirst({
      where: { id, ...scope },
      include: {
        client: true,
        items: true,
      },
    });

    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    const setting = await prisma.setting.findUnique({
      where: { userId: invoice.userId },
    });

    const pdfData: InvoicePdfData = {
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate.toISOString().split('T')[0],
      dueDate: invoice.dueDate.toISOString().split('T')[0],
      status: invoice.status,
      currency: invoice.currency,
      businessName: setting?.businessName || 'FreelanceVault',
      businessEmail: setting?.email || req.user!.email,
      businessAddress: setting?.address || undefined,
      businessTaxId: setting?.taxIdEncrypted ? decryptText(setting.taxIdEncrypted) : undefined,
      bankDetails: setting?.bankDetailsEncrypted ? decryptText(setting.bankDetailsEncrypted) : undefined,
      clientName: invoice.client.name,
      clientCompany: invoice.client.company || undefined,
      clientEmail: invoice.client.email || undefined,
      clientAddress: invoice.client.address || undefined,
      items: invoice.items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        total: i.total,
      })),
      subtotal: invoice.subtotal,
      discountAmount: invoice.discountAmount,
      taxRate: invoice.taxRate,
      taxAmount: invoice.taxAmount,
      total: invoice.total,
      amountPaid: invoice.amountPaid,
      notes: invoice.notes || undefined,
      terms: invoice.terms || undefined,
    };

    const pdfBuffer = await generateInvoicePdf(pdfData);

    await logAudit({
      userId: req.user!.id,
      teamId: req.teamId,
      action: 'EXPORT',
      entity: 'INVOICE',
      entityId: invoice.id,
      ipAddress: req.ip,
      metadata: { invoiceNumber: invoice.invoiceNumber, format: 'PDF' },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Invoice-${invoice.invoiceNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate PDF' });
  }
}

export async function deleteInvoice(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const scope = getTenantScope(req);
    const { id } = req.params;

    const existing = await prisma.invoice.findFirst({
      where: { id, ...scope },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    await prisma.invoice.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await logAudit({
      userId: req.user!.id,
      teamId: req.teamId,
      action: 'DELETE',
      entity: 'INVOICE',
      entityId: id,
      ipAddress: req.ip,
      metadata: { invoiceNumber: existing.invoiceNumber },
    });

    res.json({ success: true, message: 'Invoice moved to recycle bin' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete invoice' });
  }
}
