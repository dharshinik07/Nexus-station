import { Router } from 'express';
import { z } from 'zod';
import {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
} from '../controllers/clientController.js';
import { authenticateToken } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';

const router = Router();

const clientSchema = z.object({
  name: z.string().min(1, 'Client name is required'),
  company: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  taxId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  tags: z.any().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

router.use(authenticateToken);

router.get('/', getClients);
router.get('/:id', getClientById);
router.post('/', validate({ body: clientSchema }), createClient);
router.put('/:id', updateClient);
router.delete('/:id', deleteClient);

export default router;
