import { Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { getTenantScope } from '../middlewares/tenant.js';
import { encryptText, decryptText } from '../utils/crypto.js';
import { logAudit } from '../utils/audit.js';

export async function getClients(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const scope = getTenantScope(req);
    const { search, status, page = '1', limit = '50' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      ...scope,
    };

    if (status && status !== 'ALL') {
      where.status = status as string;
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { company: { contains: search as string } },
        { email: { contains: search as string } },
      ];
    }

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { updatedAt: 'desc' },
        include: {
          _count: {
            select: {
              projects: true,
              invoices: true,
            },
          },
          invoices: {
            where: { deletedAt: null },
            select: { total: true, amountPaid: true },
          },
        },
      }),
      prisma.client.count({ where }),
    ]);

    const formatted = clients.map((c) => {
      const totalBilled = c.invoices.reduce((sum, inv) => sum + inv.total, 0);
      const totalPaid = c.invoices.reduce((sum, inv) => sum + inv.amountPaid, 0);

      return {
        id: c.id,
        name: c.name,
        company: c.company,
        email: c.email,
        phone: c.phone,
        address: c.address,
        taxId: c.taxId ? decryptText(c.taxId) : null,
        notes: c.notes,
        tags: c.tags ? c.tags.split(',').filter(Boolean) : [],
        status: c.status,
        projectCount: c._count.projects,
        invoiceCount: c._count.invoices,
        totalBilled,
        totalPaid,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      };
    });

    res.json({
      success: true,
      data: formatted,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch clients' });
  }
}

export async function getClientById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const scope = getTenantScope(req);
    const { id } = req.params;

    const client = await prisma.client.findFirst({
      where: { id, ...scope },
      include: {
        projects: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
        },
        invoices: {
          where: { deletedAt: null },
          orderBy: { issueDate: 'desc' },
          include: { items: true },
        },
      },
    });

    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        ...client,
        taxId: client.taxId ? decryptText(client.taxId) : null,
        tags: client.tags ? client.tags.split(',').filter(Boolean) : [],
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch client details' });
  }
}

export async function createClient(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { name, company, email, phone, address, taxId, notes, tags, status } = req.body;

    const client = await prisma.client.create({
      data: {
        userId: req.user!.id,
        teamId: req.teamId || null,
        name,
        company,
        email,
        phone,
        address,
        taxId: taxId ? encryptText(taxId) : null,
        notes,
        tags: Array.isArray(tags) ? tags.join(',') : tags,
        status: status || 'ACTIVE',
      },
    });

    await logAudit({
      userId: req.user!.id,
      teamId: req.teamId,
      action: 'CREATE',
      entity: 'CLIENT',
      entityId: client.id,
      ipAddress: req.ip,
      metadata: { name: client.name, email: client.email },
    });

    res.status(201).json({
      success: true,
      data: {
        ...client,
        taxId: client.taxId ? decryptText(client.taxId) : null,
        tags: client.tags ? client.tags.split(',').filter(Boolean) : [],
      },
    });
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ success: false, error: 'Failed to create client' });
  }
}

export async function updateClient(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const scope = getTenantScope(req);
    const { id } = req.params;
    const { name, company, email, phone, address, taxId, notes, tags, status } = req.body;

    const existing = await prisma.client.findFirst({
      where: { id, ...scope },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    const updated = await prisma.client.update({
      where: { id },
      data: {
        name: name !== undefined ? name : existing.name,
        company: company !== undefined ? company : existing.company,
        email: email !== undefined ? email : existing.email,
        phone: phone !== undefined ? phone : existing.phone,
        address: address !== undefined ? address : existing.address,
        taxId: taxId !== undefined ? (taxId ? encryptText(taxId) : null) : existing.taxId,
        notes: notes !== undefined ? notes : existing.notes,
        tags: tags !== undefined ? (Array.isArray(tags) ? tags.join(',') : tags) : existing.tags,
        status: status !== undefined ? status : existing.status,
      },
    });

    await logAudit({
      userId: req.user!.id,
      teamId: req.teamId,
      action: 'UPDATE',
      entity: 'CLIENT',
      entityId: updated.id,
      ipAddress: req.ip,
      metadata: { name: updated.name },
    });

    res.json({
      success: true,
      data: {
        ...updated,
        taxId: updated.taxId ? decryptText(updated.taxId) : null,
        tags: updated.tags ? updated.tags.split(',').filter(Boolean) : [],
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update client' });
  }
}

export async function deleteClient(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const scope = getTenantScope(req);
    const { id } = req.params;

    const existing = await prisma.client.findFirst({
      where: { id, ...scope },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    // Soft delete
    await prisma.client.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await logAudit({
      userId: req.user!.id,
      teamId: req.teamId,
      action: 'DELETE',
      entity: 'CLIENT',
      entityId: id,
      ipAddress: req.ip,
      metadata: { name: existing.name },
    });

    res.json({ success: true, message: 'Client moved to recycle bin' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete client' });
  }
}
