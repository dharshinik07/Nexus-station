import { Router } from 'express';
import multer from 'multer';
import {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  downloadReceipt,
  exportExpensesCsv,
  importExpensesCsv,
  getExpenseCategories,
} from '../controllers/expenseController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = Router();

// Multer in-memory storage for safe scanning and immediate AES-256-GCM encryption
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter: (req, file, cb) => {
    // Allowed receipt types
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'text/csv',
      'application/vnd.ms-excel',
    ];
    if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: JPG, PNG, WEBP, PDF, CSV.'));
    }
  },
});

router.use(authenticateToken);

router.get('/', getExpenses);
router.get('/categories', getExpenseCategories);
router.get('/export/csv', exportExpensesCsv);
router.post('/import/csv', upload.single('file'), importExpensesCsv);

router.post('/', upload.single('receipt'), createExpense);
router.put('/:id', upload.single('receipt'), updateExpense);
router.delete('/:id', deleteExpense);
router.get('/:id/receipt', downloadReceipt);

export default router;
