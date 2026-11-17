import { Router } from 'express';
import multer from 'multer';
import {
  getDocuments,
  uploadDocument,
  downloadDocument,
  deleteDocument,
} from '../controllers/documentController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
  fileFilter: (req, file, cb) => {
    // Block executable extensions
    const dangerousExts = ['.exe', '.bat', '.cmd', '.sh', '.msi', '.vbs', '.js', '.jar'];
    const lowerName = file.originalname.toLowerCase();
    if (dangerousExts.some((ext) => lowerName.endsWith(ext))) {
      return cb(new Error('Executable file uploads are strictly prohibited.'));
    }
    cb(null, true);
  },
});

router.use(authenticateToken);

router.get('/', getDocuments);
router.post('/', upload.single('file'), uploadDocument);
router.get('/:id/download', downloadDocument);
router.delete('/:id', deleteDocument);

export default router;
