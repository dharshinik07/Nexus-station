import { Router } from 'express';
import { z } from 'zod';
import {
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  recordPayment,
  downloadInvoicePdf,
  deleteInvoice,
} from '../controllers/invoiceController.js';
import { authenticateToken } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';

const router = Router();

const invoiceItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().or(z.string()),
  unitPrice: z.number().or(z.string()),
});

const invoiceSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  projectId: z.string().optional().nullable(),
  invoiceNumber: z.string().optional(),
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  currency: z.string().optional(),
  discountAmount: z.number().or(z.string()).optional(),
  discountType: z.enum(['FIXED', 'PERCENTAGE']).optional(),
  taxRate: z.number().or(z.string()).optional(),
  notes: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  isRecurring: z.boolean().optional(),
  recurringInterval: z.string().optional().nullable(),
  items: z.array(invoiceItemSchema).min(1, 'At least one line item is required'),
});

const paymentSchema = z.object({
  amount: z.number().or(z.string()),
  paymentDate: z.string().optional(),
  paymentMethod: z.string().optional(),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

router.use(authenticateToken);

router.get('/', getInvoices);
router.get('/:id', getInvoiceById);
router.get('/:id/pdf', downloadInvoicePdf);
router.post('/', validate({ body: invoiceSchema }), createInvoice);
router.put('/:id', updateInvoice);
router.delete('/:id', deleteInvoice);

router.post('/:id/payments', validate({ body: paymentSchema }), recordPayment);

export default router;
