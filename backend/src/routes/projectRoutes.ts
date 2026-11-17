import { Router } from 'express';
import { z } from 'zod';
import {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  startProjectTimer,
  stopProjectTimer,
  logManualTime,
} from '../controllers/projectController.js';
import { authenticateToken } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';

const router = Router();

const projectSchema = z.object({
  title: z.string().min(1, 'Project title is required'),
  clientId: z.string().min(1, 'Client is required'),
  description: z.string().optional().nullable(),
  status: z.string().optional(),
  billingType: z.enum(['FIXED', 'HOURLY']).optional(),
  rate: z.number().or(z.string()).optional(),
  budget: z.number().or(z.string()).optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

router.use(authenticateToken);

router.get('/', getProjects);
router.get('/:id', getProjectById);
router.post('/', validate({ body: projectSchema }), createProject);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);

// Time tracking
router.post('/:id/timer/start', startProjectTimer);
router.post('/:id/timer/stop', stopProjectTimer);
router.post('/:id/time-entry', logManualTime);

export default router;
