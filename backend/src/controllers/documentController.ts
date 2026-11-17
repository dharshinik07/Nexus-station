import { Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { getTenantScope } from '../middlewares/tenant.js';
import { saveEncryptedFile, getDecryptedFile, deleteEncryptedFile } from '../utils/storage.js';
import { logAudit } from '../utils/audit.js';

export async function getDocuments(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const scope = getTenantScope(req);
    const { docType, clientId, projectId, search } = req.query;

    const where: any = { ...scope };

    if (docType && docType !== 'ALL') {
      where.docType = docType as string;
    }
    if (clientId) where.clientId = clientId as string;
    if (projectId) where.projectId = projectId as string;

    if (search) {
      where.OR = [
        { title: { contains: search as string } },
        { originalFilename: { contains: search as string } },
        { tags: { contains: search as string } },
      ];
    }

    const documents = await prisma.document.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, title: true } },
      },
    });

    const formatted = documents.map((d) => ({
      id: d.id,
      title: d.title,
      docType: d.docType,
      originalFilename: d.originalFilename,
      mimeType: d.mimeType,
      fileSize: d.fileSize,
      tags: d.tags ? d.tags.split(',').filter(Boolean) : [],
      expiresAt: d.expiresAt,
      isExpired: d.expiresAt ? new Date(d.expiresAt) < new Date() : false,
      notes: d.notes,
      client: d.client,
      project: d.project,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch documents' });
  }
}

export async function uploadDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded' });
      return;
    }

    const { title, docType = 'CONTRACT', clientId, projectId, tags, expiresAt, notes } = req.body;

    // Encrypt file at rest using AES-256-GCM
    const stored = await saveEncryptedFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    const document = await prisma.document.create({
      data: {
        userId: req.user!.id,
        teamId: req.teamId || null,
        clientId: clientId || null,
        projectId: projectId || null,
        title: title || req.file.originalname,
        docType,
        storedFilename: stored.storedFilename,
        originalFilename: stored.originalFilename,
        mimeType: stored.mimeType,
        fileSize: stored.fileSize,
        tags: Array.isArray(tags) ? tags.join(',') : tags,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        notes,
      },
      include: {
        client: true,
        project: true,
      },
    });

    // If expiration date provided, automatically create a Reminder
    if (expiresAt) {
      await prisma.reminder.create({
        data: {
          userId: req.user!.id,
          teamId: req.teamId || null,
          title: `Document Expiry: ${document.title}`,
          reminderType: 'CONTRACT_EXPIRY',
          dueDate: new Date(expiresAt),
          linkedEntityId: document.id,
          notes: `Document [${document.originalFilename}] expires on ${expiresAt}`,
        },
      });
    }

    await logAudit({
      userId: req.user!.id,
      teamId: req.teamId,
      action: 'CREATE',
      entity: 'DOCUMENT',
      entityId: document.id,
      ipAddress: req.ip,
      metadata: { title: document.title, filename: document.originalFilename },
    });

    res.status(201).json({ success: true, data: document });
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({ success: false, error: 'Failed to upload document' });
  }
}

export async function downloadDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const scope = getTenantScope(req);
    const { id } = req.params;

    const document = await prisma.document.findFirst({
      where: { id, ...scope },
    });

    if (!document) {
      res.status(404).json({ success: false, error: 'Document not found or access denied' });
      return;
    }

    // Decrypt on the fly and stream back
    const decryptedBuffer = await getDecryptedFile(document.storedFilename);

    await logAudit({
      userId: req.user!.id,
      teamId: req.teamId,
      action: 'EXPORT',
      entity: 'DOCUMENT',
      entityId: document.id,
      ipAddress: req.ip,
      metadata: { title: document.title, filename: document.originalFilename },
    });

    res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(document.originalFilename)}"`
    );
    res.send(decryptedBuffer);
  } catch (error) {
    console.error('Error downloading document:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve document' });
  }
}

export async function deleteDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const scope = getTenantScope(req);
    const { id } = req.params;

    const document = await prisma.document.findFirst({
      where: { id, ...scope },
    });

    if (!document) {
      res.status(404).json({ success: false, error: 'Document not found' });
      return;
    }

    // Soft delete
    await prisma.document.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await logAudit({
      userId: req.user!.id,
      teamId: req.teamId,
      action: 'DELETE',
      entity: 'DOCUMENT',
      entityId: id,
      ipAddress: req.ip,
      metadata: { title: document.title },
    });

    res.json({ success: true, message: 'Document moved to recycle bin' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete document' });
  }
}
