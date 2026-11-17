import { Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { getTenantScope } from '../middlewares/tenant.js';
import { logAudit } from '../utils/audit.js';

export async function getProjects(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const scope = getTenantScope(req);
    const { status, clientId, search } = req.query;

    const where: any = {
      ...scope,
    };

    if (status && status !== 'ALL') {
      where.status = status as string;
    }

    if (clientId) {
      where.clientId = clientId as string;
    }

    if (search) {
      where.OR = [
        { title: { contains: search as string } },
        { description: { contains: search as string } },
        { client: { name: { contains: search as string } } },
      ];
    }

    const projects = await prisma.project.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        client: {
          select: { id: true, name: true, company: true },
        },
        invoices: {
          where: { deletedAt: null },
          select: { total: true, amountPaid: true },
        },
        expenses: {
          where: { deletedAt: null },
          select: { amount: true },
        },
        timeEntries: {
          where: { deletedAt: null },
          select: { durationMinutes: true, startTime: true, endTime: true },
        },
      },
    });

    const formatted = projects.map((p) => {
      const totalInvoiced = p.invoices.reduce((sum, inv) => sum + inv.total, 0);
      const totalPaid = p.invoices.reduce((sum, inv) => sum + inv.amountPaid, 0);
      const totalExpenses = p.expenses.reduce((sum, exp) => sum + exp.amount, 0);
      const netProfit = totalPaid - totalExpenses;
      const totalMinutes = p.timeEntries.reduce((sum, te) => sum + te.durationMinutes, 0);
      const totalHours = parseFloat((totalMinutes / 60).toFixed(2));

      // Check if there is an active running timer
      const activeTimer = p.timeEntries.find((te) => te.endTime === null);

      return {
        id: p.id,
        title: p.title,
        description: p.description,
        client: p.client,
        status: p.status,
        billingType: p.billingType,
        rate: p.rate,
        budget: p.budget,
        startDate: p.startDate,
        endDate: p.endDate,
        totalInvoiced,
        totalPaid,
        totalExpenses,
        netProfit,
        profitMargin: totalPaid > 0 ? parseFloat(((netProfit / totalPaid) * 100).toFixed(1)) : 0,
        totalHours,
        activeTimer: activeTimer
          ? { id: activeTimer.startTime, startTime: activeTimer.startTime }
          : null,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      };
    });

    res.json({ success: true, data: formatted });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch projects' });
  }
}

export async function getProjectById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const scope = getTenantScope(req);
    const { id } = req.params;

    const project = await prisma.project.findFirst({
      where: { id, ...scope },
      include: {
        client: true,
        invoices: {
          where: { deletedAt: null },
          orderBy: { issueDate: 'desc' },
        },
        expenses: {
          where: { deletedAt: null },
          orderBy: { expenseDate: 'desc' },
        },
        timeEntries: {
          where: { deletedAt: null },
          orderBy: { startTime: 'desc' },
        },
      },
    });

    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    const totalInvoiced = project.invoices.reduce((sum, inv) => sum + inv.total, 0);
    const totalPaid = project.invoices.reduce((sum, inv) => sum + inv.amountPaid, 0);
    const totalExpenses = project.expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const netProfit = totalPaid - totalExpenses;
    const totalMinutes = project.timeEntries.reduce((sum, te) => sum + te.durationMinutes, 0);

    res.json({
      success: true,
      data: {
        ...project,
        totalInvoiced,
        totalPaid,
        totalExpenses,
        netProfit,
        totalHours: parseFloat((totalMinutes / 60).toFixed(2)),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch project' });
  }
}

export async function createProject(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { title, clientId, description, status, billingType, rate, budget, startDate, endDate } = req.body;

    // Verify client belongs to user/team
    const client = await prisma.client.findFirst({
      where: { id: clientId, ...getTenantScope(req) },
    });

    if (!client) {
      res.status(404).json({ success: false, error: 'Linked client not found' });
      return;
    }

    const project = await prisma.project.create({
      data: {
        userId: req.user!.id,
        teamId: req.teamId || null,
        clientId,
        title,
        description,
        status: status || 'IN_PROGRESS',
        billingType: billingType || 'FIXED',
        rate: rate ? parseFloat(rate) : 0,
        budget: budget ? parseFloat(budget) : null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
      include: { client: true },
    });

    await logAudit({
      userId: req.user!.id,
      teamId: req.teamId,
      action: 'CREATE',
      entity: 'PROJECT',
      entityId: project.id,
      ipAddress: req.ip,
      metadata: { title: project.title, client: client.name },
    });

    res.status(201).json({ success: true, data: project });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ success: false, error: 'Failed to create project' });
  }
}

export async function updateProject(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const scope = getTenantScope(req);
    const { id } = req.params;
    const { title, clientId, description, status, billingType, rate, budget, startDate, endDate } = req.body;

    const existing = await prisma.project.findFirst({
      where: { id, ...scope },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    const updated = await prisma.project.update({
      where: { id },
      data: {
        title: title !== undefined ? title : existing.title,
        clientId: clientId !== undefined ? clientId : existing.clientId,
        description: description !== undefined ? description : existing.description,
        status: status !== undefined ? status : existing.status,
        billingType: billingType !== undefined ? billingType : existing.billingType,
        rate: rate !== undefined ? parseFloat(rate) : existing.rate,
        budget: budget !== undefined ? (budget ? parseFloat(budget) : null) : existing.budget,
        startDate: startDate !== undefined ? (startDate ? new Date(startDate) : null) : existing.startDate,
        endDate: endDate !== undefined ? (endDate ? new Date(endDate) : null) : existing.endDate,
      },
      include: { client: true },
    });

    await logAudit({
      userId: req.user!.id,
      teamId: req.teamId,
      action: 'UPDATE',
      entity: 'PROJECT',
      entityId: updated.id,
      ipAddress: req.ip,
      metadata: { title: updated.title },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update project' });
  }
}

export async function deleteProject(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const scope = getTenantScope(req);
    const { id } = req.params;

    const existing = await prisma.project.findFirst({
      where: { id, ...scope },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    await prisma.project.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await logAudit({
      userId: req.user!.id,
      teamId: req.teamId,
      action: 'DELETE',
      entity: 'PROJECT',
      entityId: id,
      ipAddress: req.ip,
      metadata: { title: existing.title },
    });

    res.json({ success: true, message: 'Project moved to recycle bin' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete project' });
  }
}

// Time Tracking methods
export async function startProjectTimer(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const scope = getTenantScope(req);
    const { id: projectId } = req.params;
    const { description } = req.body;

    const project = await prisma.project.findFirst({
      where: { id: projectId, ...scope },
    });

    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    // Stop any other currently running timer for this user
    const runningTimers = await prisma.timeEntry.findMany({
      where: { userId: req.user!.id, endTime: null, deletedAt: null },
    });

    for (const timer of runningTimers) {
      const end = new Date();
      const diffMinutes = Math.round((end.getTime() - timer.startTime.getTime()) / 60000);
      await prisma.timeEntry.update({
        where: { id: timer.id },
        data: { endTime: end, durationMinutes: Math.max(1, diffMinutes) },
      });
    }

    const newTimer = await prisma.timeEntry.create({
      data: {
        userId: req.user!.id,
        teamId: req.teamId || null,
        projectId,
        description: description || 'Working on project',
        startTime: new Date(),
        isBillable: true,
      },
    });

    res.status(201).json({ success: true, data: newTimer });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to start timer' });
  }
}

export async function stopProjectTimer(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id: projectId } = req.params;

    const activeTimer = await prisma.timeEntry.findFirst({
      where: {
        userId: req.user!.id,
        projectId,
        endTime: null,
        deletedAt: null,
      },
      orderBy: { startTime: 'desc' },
    });

    if (!activeTimer) {
      res.status(400).json({ success: false, error: 'No active timer running for this project' });
      return;
    }

    const endTime = new Date();
    const durationMinutes = Math.max(
      1,
      Math.round((endTime.getTime() - activeTimer.startTime.getTime()) / 60000)
    );

    const updated = await prisma.timeEntry.update({
      where: { id: activeTimer.id },
      data: {
        endTime,
        durationMinutes,
      },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to stop timer' });
  }
}

export async function logManualTime(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const scope = getTenantScope(req);
    const { id: projectId } = req.params;
    const { description, durationMinutes, startTime, isBillable } = req.body;

    const project = await prisma.project.findFirst({
      where: { id: projectId, ...scope },
    });

    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    const start = startTime ? new Date(startTime) : new Date();
    const duration = parseInt(durationMinutes, 10);
    const end = new Date(start.getTime() + duration * 60000);

    const entry = await prisma.timeEntry.create({
      data: {
        userId: req.user!.id,
        teamId: req.teamId || null,
        projectId,
        description,
        startTime: start,
        endTime: end,
        durationMinutes: duration,
        isBillable: isBillable !== undefined ? isBillable : true,
      },
    });

    res.status(201).json({ success: true, data: entry });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to log time entry' });
  }
}
