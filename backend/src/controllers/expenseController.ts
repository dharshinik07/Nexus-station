import { Response } from 'express';
import { stringify } from 'csv-stringify/sync';
import { parse } from 'csv-parse/sync';
import { prisma } from '../utils/prisma.js';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { getTenantScope } from '../middlewares/tenant.js';
import { saveEncryptedFile, getDecryptedFile } from '../utils/storage.js';
import { logAudit } from '../utils/audit.js';

export async function getExpenses(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const scope = getTenantScope(req);
    const {
      categoryId,
      clientId,
      projectId,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      isTaxDeductible,
      isBillable,
      search,
      page = '1',
      limit = '50',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = { ...scope };

    if (categoryId) where.categoryId = categoryId as string;
    if (clientId) where.clientId = clientId as string;
    if (projectId) where.projectId = projectId as string;

    if (isTaxDeductible !== undefined) {
      where.isTaxDeductible = isTaxDeductible === 'true';
    }
    if (isBillable !== undefined) {
      where.isBillable = isBillable === 'true';
    }

    if (startDate || endDate) {
      where.expenseDate = {};
      if (startDate) where.expenseDate.gte = new Date(startDate as string);
      if (endDate) where.expenseDate.lte = new Date(endDate as string);
    }

    if (minAmount || maxAmount) {
      where.amount = {};
      if (minAmount) where.amount.gte = parseFloat(minAmount as string);
      if (maxAmount) where.amount.lte = parseFloat(maxAmount as string);
    }

    if (search) {
      where.OR = [
        { vendor: { contains: search as string } },
        { description: { contains: search as string } },
        { categoryName: { contains: search as string } },
      ];
    }

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { expenseDate: 'desc' },
        include: {
          category: { select: { id: true, name: true, color: true } },
          client: { select: { id: true, name: true } },
          project: { select: { id: true, title: true } },
        },
      }),
      prisma.expense.count({ where }),
    ]);

    res.json({
      success: true,
      data: expenses,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch expenses' });
  }
}

export async function createExpense(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const {
      amount,
      currency = 'USD',
      categoryId,
      categoryName: inputCategoryName,
      vendor,
      description,
      expenseDate,
      paymentMethod = 'CARD',
      clientId,
      projectId,
      isBillable = false,
      isTaxDeductible = true,
      tags,
      isRecurring = false,
      recurringFrequency,
    } = req.body;

    let categoryName = inputCategoryName || 'Other';
    if (categoryId) {
      const cat = await prisma.expenseCategory.findUnique({ where: { id: categoryId } });
      if (cat) categoryName = cat.name;
    }

    let receiptData = null;
    if (req.file) {
      const stored = await saveEncryptedFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );
      receiptData = {
        receiptFilename: stored.storedFilename,
        receiptOriginalName: stored.originalFilename,
        receiptMimeType: stored.mimeType,
        receiptSize: stored.fileSize,
      };
    }

    const expense = await prisma.expense.create({
      data: {
        userId: req.user!.id,
        teamId: req.teamId || null,
        amount: parseFloat(amount),
        currency,
        categoryId: categoryId || null,
        categoryName,
        vendor: vendor || 'Unknown Vendor',
        description,
        expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
        paymentMethod,
        clientId: clientId || null,
        projectId: projectId || null,
        isBillable: isBillable === 'true' || isBillable === true,
        isTaxDeductible: isTaxDeductible === 'true' || isTaxDeductible === true,
        tags: Array.isArray(tags) ? tags.join(',') : tags,
        isRecurring: isRecurring === 'true' || isRecurring === true,
        recurringFrequency: recurringFrequency || null,
        ...receiptData,
      },
      include: {
        category: true,
        client: true,
        project: true,
      },
    });

    await logAudit({
      userId: req.user!.id,
      teamId: req.teamId,
      action: 'CREATE',
      entity: 'EXPENSE',
      entityId: expense.id,
      ipAddress: req.ip,
      metadata: { vendor: expense.vendor, amount: expense.amount, category: expense.categoryName },
    });

    res.status(201).json({ success: true, data: expense });
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({ success: false, error: 'Failed to create expense' });
  }
}

export async function updateExpense(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const scope = getTenantScope(req);
    const { id } = req.params;
    const {
      amount,
      currency,
      categoryId,
      categoryName,
      vendor,
      description,
      expenseDate,
      paymentMethod,
      clientId,
      projectId,
      isBillable,
      isTaxDeductible,
      tags,
      isRecurring,
      recurringFrequency,
    } = req.body;

    const existing = await prisma.expense.findFirst({
      where: { id, ...scope },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Expense not found' });
      return;
    }

    let receiptData = undefined;
    if (req.file) {
      const stored = await saveEncryptedFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );
      receiptData = {
        receiptFilename: stored.storedFilename,
        receiptOriginalName: stored.originalFilename,
        receiptMimeType: stored.mimeType,
        receiptSize: stored.fileSize,
      };
    }

    let resolvedCatName = categoryName !== undefined ? categoryName : existing.categoryName;
    if (categoryId && categoryId !== existing.categoryId) {
      const cat = await prisma.expenseCategory.findUnique({ where: { id: categoryId } });
      if (cat) resolvedCatName = cat.name;
    }

    const updated = await prisma.expense.update({
      where: { id },
      data: {
        amount: amount !== undefined ? parseFloat(amount) : existing.amount,
        currency: currency !== undefined ? currency : existing.currency,
        categoryId: categoryId !== undefined ? categoryId : existing.categoryId,
        categoryName: resolvedCatName,
        vendor: vendor !== undefined ? vendor : existing.vendor,
        description: description !== undefined ? description : existing.description,
        expenseDate: expenseDate ? new Date(expenseDate) : existing.expenseDate,
        paymentMethod: paymentMethod !== undefined ? paymentMethod : existing.paymentMethod,
        clientId: clientId !== undefined ? (clientId ? clientId : null) : existing.clientId,
        projectId: projectId !== undefined ? (projectId ? projectId : null) : existing.projectId,
        isBillable: isBillable !== undefined ? Boolean(isBillable) : existing.isBillable,
        isTaxDeductible: isTaxDeductible !== undefined ? Boolean(isTaxDeductible) : existing.isTaxDeductible,
        tags: tags !== undefined ? (Array.isArray(tags) ? tags.join(',') : tags) : existing.tags,
        isRecurring: isRecurring !== undefined ? Boolean(isRecurring) : existing.isRecurring,
        recurringFrequency: recurringFrequency !== undefined ? recurringFrequency : existing.recurringFrequency,
        ...(receiptData || {}),
      },
      include: {
        category: true,
        client: true,
        project: true,
      },
    });

    await logAudit({
      userId: req.user!.id,
      teamId: req.teamId,
      action: 'UPDATE',
      entity: 'EXPENSE',
      entityId: updated.id,
      ipAddress: req.ip,
      metadata: { vendor: updated.vendor, amount: updated.amount },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update expense' });
  }
}

export async function deleteExpense(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const scope = getTenantScope(req);
    const { id } = req.params;

    const existing = await prisma.expense.findFirst({
      where: { id, ...scope },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Expense not found' });
      return;
    }

    await prisma.expense.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await logAudit({
      userId: req.user!.id,
      teamId: req.teamId,
      action: 'DELETE',
      entity: 'EXPENSE',
      entityId: id,
      ipAddress: req.ip,
      metadata: { vendor: existing.vendor, amount: existing.amount },
    });

    res.json({ success: true, message: 'Expense moved to recycle bin' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete expense' });
  }
}

export async function downloadReceipt(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const scope = getTenantScope(req);
    const { id } = req.params;

    const expense = await prisma.expense.findFirst({
      where: { id, ...scope },
    });

    if (!expense || !expense.receiptFilename) {
      res.status(404).json({ success: false, error: 'Receipt not found' });
      return;
    }

    const decryptedBuffer = await getDecryptedFile(expense.receiptFilename);

    res.setHeader('Content-Type', expense.receiptMimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(expense.receiptOriginalName || 'receipt')}"`
    );
    res.send(decryptedBuffer);
  } catch (error) {
    console.error('Error downloading receipt:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve receipt' });
  }
}

export async function exportExpensesCsv(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const scope = getTenantScope(req);
    const expenses = await prisma.expense.findMany({
      where: scope,
      orderBy: { expenseDate: 'desc' },
      include: {
        category: true,
        client: true,
        project: true,
      },
    });

    const records = expenses.map((e) => ({
      Date: e.expenseDate.toISOString().split('T')[0],
      Vendor: e.vendor,
      Category: e.categoryName,
      Amount: e.amount,
      Currency: e.currency,
      PaymentMethod: e.paymentMethod,
      Description: e.description || '',
      Client: e.client?.name || '',
      Project: e.project?.title || '',
      Billable: e.isBillable ? 'Yes' : 'No',
      TaxDeductible: e.isTaxDeductible ? 'Yes' : 'No',
      Tags: e.tags || '',
    }));

    const csvOutput = stringify(records, { header: true });

    await logAudit({
      userId: req.user!.id,
      teamId: req.teamId,
      action: 'EXPORT',
      entity: 'EXPENSE',
      ipAddress: req.ip,
      metadata: { count: expenses.length, format: 'CSV' },
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="expenses_${Date.now()}.csv"`);
    res.send(csvOutput);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to export expenses CSV' });
  }
}

export async function importExpensesCsv(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'CSV file required' });
      return;
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    let importedCount = 0;

    for (const row of records) {
      const amount = parseFloat(row.Amount || row.amount || '0');
      const vendor = row.Vendor || row.vendor || 'Imported Expense';
      const categoryName = row.Category || row.category || 'Other';
      const dateStr = row.Date || row.date;
      const expenseDate = dateStr ? new Date(dateStr) : new Date();

      if (isNaN(amount) || amount <= 0) continue;

      await prisma.expense.create({
        data: {
          userId: req.user!.id,
          teamId: req.teamId || null,
          vendor,
          amount,
          currency: row.Currency || row.currency || 'USD',
          categoryName,
          description: row.Description || row.description || null,
          expenseDate,
          paymentMethod: row.PaymentMethod || row.payment_method || 'CARD',
          isBillable: (row.Billable || row.billable || '').toLowerCase() === 'yes',
          isTaxDeductible: (row.TaxDeductible || row.tax_deductible || 'yes').toLowerCase() !== 'no',
          tags: row.Tags || row.tags || null,
        },
      });
      importedCount++;
    }

    await logAudit({
      userId: req.user!.id,
      teamId: req.teamId,
      action: 'CREATE',
      entity: 'EXPENSE',
      ipAddress: req.ip,
      metadata: { action: 'bulk_csv_import', importedCount },
    });

    res.json({
      success: true,
      message: `Successfully imported ${importedCount} expenses`,
      importedCount,
    });
  } catch (error) {
    console.error('CSV import error:', error);
    res.status(500).json({ success: false, error: 'Failed to import CSV' });
  }
}

export async function getExpenseCategories(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const categories = await prisma.expenseCategory.findMany({
      where: {
        OR: [{ userId: req.user!.id }, { isSystem: true }],
        deletedAt: null,
      },
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
}
