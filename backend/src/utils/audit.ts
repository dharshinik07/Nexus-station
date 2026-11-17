import { prisma } from './prisma.js';

export interface AuditLogOptions {
  userId?: string | null;
  teamId?: string | null;
  action: 'LOGIN' | 'LOGOUT' | 'CREATE' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'RESTORE';
  entity: 'USER' | 'CLIENT' | 'PROJECT' | 'INVOICE' | 'EXPENSE' | 'DOCUMENT' | 'SETTING' | 'BACKUP' | 'AUTH';
  entityId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, any> | null;
}

export async function logAudit(options: AuditLogOptions): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: options.userId || null,
        teamId: options.teamId || null,
        action: options.action,
        entity: options.entity,
        entityId: options.entityId || null,
        ipAddress: options.ipAddress || null,
        userAgent: options.userAgent ? options.userAgent.substring(0, 255) : null,
        metadata: options.metadata ? JSON.stringify(options.metadata) : null,
      },
    });
  } catch (error) {
    console.error('Failed to create audit log entry:', error);
  }
}
