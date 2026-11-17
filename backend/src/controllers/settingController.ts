import { Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { encryptText, decryptText } from '../utils/crypto.js';
import { logAudit } from '../utils/audit.js';

export async function getSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const setting = await prisma.setting.findUnique({
      where: { userId: req.user!.id },
    });

    if (!setting) {
      // Create defaults if not exists
      const created = await prisma.setting.create({
        data: {
          userId: req.user!.id,
          businessName: `${req.user!.fullName}'s Studio`,
          currency: 'USD',
          invoicePrefix: 'INV-',
          nextInvoiceNumber: 1001,
          taxType: 'GST',
          defaultTaxRate: 10,
        },
      });
      res.json({
        success: true,
        data: {
          ...created,
          taxId: null,
          bankDetails: null,
        },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        ...setting,
        taxId: setting.taxIdEncrypted ? decryptText(setting.taxIdEncrypted) : '',
        bankDetails: setting.bankDetailsEncrypted ? decryptText(setting.bankDetailsEncrypted) : '',
        taxIdEncrypted: undefined,
        bankDetailsEncrypted: undefined,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch settings' });
  }
}

export async function updateSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const {
      businessName,
      logoUrl,
      email,
      phone,
      address,
      taxId,
      bankDetails,
      currency,
      dateFormat,
      invoicePrefix,
      nextInvoiceNumber,
      taxType,
      defaultTaxRate,
      reminderDaysBefore,
    } = req.body;

    const current = await prisma.setting.findUnique({ where: { userId: req.user!.id } });

    const updated = await prisma.setting.upsert({
      where: { userId: req.user!.id },
      update: {
        businessName: businessName !== undefined ? businessName : current?.businessName,
        logoUrl: logoUrl !== undefined ? logoUrl : current?.logoUrl,
        email: email !== undefined ? email : current?.email,
        phone: phone !== undefined ? phone : current?.phone,
        address: address !== undefined ? address : current?.address,
        taxIdEncrypted: taxId !== undefined ? (taxId ? encryptText(taxId) : null) : current?.taxIdEncrypted,
        bankDetailsEncrypted: bankDetails !== undefined ? (bankDetails ? encryptText(bankDetails) : null) : current?.bankDetailsEncrypted,
        currency: currency !== undefined ? currency : current?.currency,
        dateFormat: dateFormat !== undefined ? dateFormat : current?.dateFormat,
        invoicePrefix: invoicePrefix !== undefined ? invoicePrefix : current?.invoicePrefix,
        nextInvoiceNumber: nextInvoiceNumber !== undefined ? parseInt(nextInvoiceNumber, 10) : current?.nextInvoiceNumber,
        taxType: taxType !== undefined ? taxType : current?.taxType,
        defaultTaxRate: defaultTaxRate !== undefined ? parseFloat(defaultTaxRate) : current?.defaultTaxRate,
        reminderDaysBefore: reminderDaysBefore !== undefined ? parseInt(reminderDaysBefore, 10) : current?.reminderDaysBefore,
      },
      create: {
        userId: req.user!.id,
        businessName,
        logoUrl,
        email,
        phone,
        address,
        taxIdEncrypted: taxId ? encryptText(taxId) : null,
        bankDetailsEncrypted: bankDetails ? encryptText(bankDetails) : null,
        currency: currency || 'USD',
        dateFormat: dateFormat || 'YYYY-MM-DD',
        invoicePrefix: invoicePrefix || 'INV-',
        nextInvoiceNumber: nextInvoiceNumber ? parseInt(nextInvoiceNumber, 10) : 1001,
        taxType: taxType || 'GST',
        defaultTaxRate: defaultTaxRate ? parseFloat(defaultTaxRate) : 10,
        reminderDaysBefore: reminderDaysBefore ? parseInt(reminderDaysBefore, 10) : 3,
      },
    });

    await logAudit({
      userId: req.user!.id,
      teamId: req.teamId,
      action: 'UPDATE',
      entity: 'SETTING',
      entityId: updated.id,
      ipAddress: req.ip,
      metadata: { businessName: updated.businessName, currency: updated.currency },
    });

    res.json({
      success: true,
      data: {
        ...updated,
        taxId: updated.taxIdEncrypted ? decryptText(updated.taxIdEncrypted) : '',
        bankDetails: updated.bankDetailsEncrypted ? decryptText(updated.bankDetailsEncrypted) : '',
        taxIdEncrypted: undefined,
        bankDetailsEncrypted: undefined,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
}

/**
 * Full encrypted backup of user account data
 */
export async function exportFullBackup(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;

    const [user, settings, clients, projects, timeEntries, invoices, payments, expenses, categories, documents, reminders] =
      await Promise.all([
        prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, fullName: true, createdAt: true } }),
        prisma.setting.findUnique({ where: { userId } }),
        prisma.client.findMany({ where: { userId } }),
        prisma.project.findMany({ where: { userId } }),
        prisma.timeEntry.findMany({ where: { userId } }),
        prisma.invoice.findMany({ where: { userId }, include: { items: true } }),
        prisma.payment.findMany({ where: { userId } }),
        prisma.expense.findMany({ where: { userId } }),
        prisma.expenseCategory.findMany({ where: { userId } }),
        prisma.document.findMany({ where: { userId } }),
        prisma.reminder.findMany({ where: { userId } }),
      ]);

    const backupPayload = {
      exportVersion: '1.0',
      exportedAt: new Date().toISOString(),
      user,
      settings,
      clients,
      projects,
      timeEntries,
      invoices,
      payments,
      expenses,
      categories,
      documents,
      reminders,
    };

    // Encrypt the entire backup json payload with master key
    const encryptedBackup = encryptText(JSON.stringify(backupPayload));

    await logAudit({
      userId,
      teamId: req.teamId,
      action: 'EXPORT',
      entity: 'BACKUP',
      ipAddress: req.ip,
      metadata: { type: 'full_encrypted_account_backup' },
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="freelancevault_backup_${Date.now()}.vault"`);
    res.send(JSON.stringify({ vaultPayload: encryptedBackup }, null, 2));
  } catch (error) {
    console.error('Backup error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate backup' });
  }
}

/**
 * Recycle Bin & Soft Deletes
 */
export async function getRecycleBin(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;

    const [deletedClients, deletedProjects, deletedInvoices, deletedExpenses, deletedDocuments] =
      await Promise.all([
        prisma.client.findMany({ where: { userId, deletedAt: { not: null } } }),
        prisma.project.findMany({ where: { userId, deletedAt: { not: null } } }),
        prisma.invoice.findMany({ where: { userId, deletedAt: { not: null } } }),
        prisma.expense.findMany({ where: { userId, deletedAt: { not: null } } }),
        prisma.document.findMany({ where: { userId, deletedAt: { not: null } } }),
      ]);

    const items = [
      ...deletedClients.map((c) => ({ id: c.id, type: 'CLIENT', name: c.name, deletedAt: c.deletedAt })),
      ...deletedProjects.map((p) => ({ id: p.id, type: 'PROJECT', name: p.title, deletedAt: p.deletedAt })),
      ...deletedInvoices.map((i) => ({ id: i.id, type: 'INVOICE', name: `Invoice ${i.invoiceNumber}`, deletedAt: i.deletedAt })),
      ...deletedExpenses.map((e) => ({ id: e.id, type: 'EXPENSE', name: `${e.vendor} - $${e.amount}`, deletedAt: e.deletedAt })),
      ...deletedDocuments.map((d) => ({ id: d.id, type: 'DOCUMENT', name: d.title, deletedAt: d.deletedAt })),
    ];

    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch recycle bin' });
  }
}

export async function restoreRecycledItem(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const { type, id } = req.body;

    switch (type) {
      case 'CLIENT':
        await prisma.client.updateMany({ where: { id, userId }, data: { deletedAt: null } });
        break;
      case 'PROJECT':
        await prisma.project.updateMany({ where: { id, userId }, data: { deletedAt: null } });
        break;
      case 'INVOICE':
        await prisma.invoice.updateMany({ where: { id, userId }, data: { deletedAt: null } });
        break;
      case 'EXPENSE':
        await prisma.expense.updateMany({ where: { id, userId }, data: { deletedAt: null } });
        break;
      case 'DOCUMENT':
        await prisma.document.updateMany({ where: { id, userId }, data: { deletedAt: null } });
        break;
      default:
        res.status(400).json({ success: false, error: 'Invalid entity type' });
        return;
    }

    await logAudit({
      userId,
      action: 'RESTORE',
      entity: type as any,
      entityId: id,
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Item restored successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to restore item' });
  }
}

export async function permanentlyDeleteItem(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const { type, id } = req.body;

    switch (type) {
      case 'CLIENT':
        await prisma.client.deleteMany({ where: { id, userId } });
        break;
      case 'PROJECT':
        await prisma.project.deleteMany({ where: { id, userId } });
        break;
      case 'INVOICE':
        await prisma.invoice.deleteMany({ where: { id, userId } });
        break;
      case 'EXPENSE':
        await prisma.expense.deleteMany({ where: { id, userId } });
        break;
      case 'DOCUMENT':
        await prisma.document.deleteMany({ where: { id, userId } });
        break;
      default:
        res.status(400).json({ success: false, error: 'Invalid entity type' });
        return;
    }

    await logAudit({
      userId,
      action: 'DELETE',
      entity: type as any,
      entityId: id,
      ipAddress: req.ip,
      metadata: { action: 'permanent_purge' },
    });

    res.json({ success: true, message: 'Item permanently deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to permanently delete item' });
  }
}

export async function getAuditLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const logs = await prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const parsed = logs.map((l) => ({
      ...l,
      metadata: l.metadata ? JSON.parse(l.metadata) : null,
    }));

    res.json({ success: true, data: parsed });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch audit logs' });
  }
}

/**
 * Global Search across Clients, Invoices, Expenses, and Documents
 */
export async function searchGlobal(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const q = (req.query.q as string || '').trim();

    if (!q) {
      res.json({ success: true, data: { clients: [], invoices: [], expenses: [], documents: [] } });
      return;
    }

    const [clients, invoices, expenses, documents] = await Promise.all([
      prisma.client.findMany({
        where: {
          userId,
          deletedAt: null,
          OR: [
            { name: { contains: q } },
            { company: { contains: q } },
            { email: { contains: q } },
          ],
        },
        take: 5,
      }),
      prisma.invoice.findMany({
        where: {
          userId,
          deletedAt: null,
          OR: [
            { invoiceNumber: { contains: q } },
            { client: { name: { contains: q } } },
          ],
        },
        include: { client: { select: { name: true } } },
        take: 5,
      }),
      prisma.expense.findMany({
        where: {
          userId,
          deletedAt: null,
          OR: [
            { vendor: { contains: q } },
            { description: { contains: q } },
            { categoryName: { contains: q } },
          ],
        },
        take: 5,
      }),
      prisma.document.findMany({
        where: {
          userId,
          deletedAt: null,
          OR: [
            { title: { contains: q } },
            { originalFilename: { contains: q } },
            { tags: { contains: q } },
          ],
        },
        take: 5,
      }),
    ]);

    res.json({
      success: true,
      data: { clients, invoices, expenses, documents },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to perform search' });
  }
}
