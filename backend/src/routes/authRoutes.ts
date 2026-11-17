import { Router } from 'express';
import { z } from 'zod';
import {
  register,
  login,
  setup2FA,
  verifyAndEnable2FA,
  disable2FA,
  refreshToken,
  logout,
  logoutAll,
  forgotPassword,
  resetPassword,
  getMe,
} from '../controllers/authController.js';
import { authenticateToken } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { authRateLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  fullName: z.string().min(2, 'Full name is required'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totpCode: z.string().optional(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});

router.post('/register', authRateLimiter, validate({ body: registerSchema }), register);
router.post('/login', authRateLimiter, validate({ body: loginSchema }), login);
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.post('/logout-all', authenticateToken, logoutAll);

router.post('/forgot-password', authRateLimiter, forgotPassword);
router.post('/reset-password', authRateLimiter, validate({ body: resetPasswordSchema }), resetPassword);

// 2FA Endpoints
router.post('/2fa/setup', authenticateToken, setup2FA);
router.post('/2fa/verify', authenticateToken, verifyAndEnable2FA);
router.post('/2fa/disable', authenticateToken, disable2FA);

router.get('/me', authenticateToken, getMe);

export default router;
