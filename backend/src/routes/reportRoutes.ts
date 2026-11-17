import { Router } from 'express';
import {
  getDashboardData,
  getReports,
  exportReport,
} from '../controllers/reportController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = Router();

router.use(authenticateToken);

router.get('/dashboard', getDashboardData);
router.get('/financial', getReports);
router.get('/export', exportReport);

export default router;
