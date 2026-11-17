import { Router } from 'express';
import {
  getSettings,
  updateSettings,
  exportFullBackup,
  getRecycleBin,
  restoreRecycledItem,
  permanentlyDeleteItem,
  getAuditLogs,
  searchGlobal,
} from '../controllers/settingController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = Router();

router.use(authenticateToken);

router.get('/', getSettings);
router.put('/', updateSettings);
router.get('/backup', exportFullBackup);

router.get('/recycle-bin', getRecycleBin);
router.post('/recycle-bin/restore', restoreRecycledItem);
router.post('/recycle-bin/purge', permanentlyDeleteItem);

router.get('/audit-logs', getAuditLogs);
router.get('/search', searchGlobal);

export default router;
