import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import { prisma } from '../utils/prisma.js';
import {
  hashPassword,
  verifyPassword,
  generateRandomToken,
  generateTotpSecret,
  verifyTotpToken,
} from '../utils/crypto.js';
import { logAudit } from '../utils/audit.js';
import { ENV } from '../config/env.js';
import { AuthenticatedRequest } from '../middlewares/auth.js';

const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Software and Subscriptions', color: '#3b82f6' },
  { name: 'Equipment', color: '#10b981' },
  { name: 'Travel', color: '#f59e0b' },
  { name: 'Food and Meals', color: '#ec4899' },
  { name: 'Internet and Phone', color: '#8b5cf6' },
  { name: 'Rent/Coworking', color: '#06b6d4' },
  { name: 'Marketing', color: '#f97316' },
  { name: 'Education', color: '#6366f1' },
  { name: 'Professional Fees', color: '#14b8a6' },
  { name: 'Taxes', color: '#ef4444' },
  { name: 'Bank Charges', color: '#64748b' },
  { name: 'Other', color: '#94a3b8' },
];

function generateTokens(user: { id: string; email: string; sessionVersion: number }) {
  const accessToken = jwt.sign(
    { userId: user.id, email: user.email, sessionVersion: user.sessionVersion },
    ENV.JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { userId: user.id, email: user.email, sessionVersion: user.sessionVersion },
    ENV.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
}

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, fullName } = req.body;

    const existingUser = await prisma.user.findFirst({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      res.status(409).json({ success: false, error: 'User with this email already exists' });
      return;
    }

    const passwordHash = await hashPassword(password);
    const verificationToken = generateRandomToken(24);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        fullName,
        verificationToken,
        isEmailVerified: true, // Auto-verified for local/production setup
        setting: {
          create: {
            businessName: `${fullName}'s Studio`,
            currency: 'USD',
            invoicePrefix: 'INV-',
            nextInvoiceNumber: 1001,
            taxType: 'GST',
            defaultTaxRate: 10,
          },
        },
      },
    });

    // Seed default expense categories for the user
    await prisma.expenseCategory.createMany({
      data: DEFAULT_EXPENSE_CATEGORIES.map((cat) => ({
        userId: user.id,
        name: cat.name,
        color: cat.color,
        isSystem: true,
      })),
    });

    await logAudit({
      userId: user.id,
      action: 'CREATE',
      entity: 'USER',
      entityId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { email: user.email, fullName: user.fullName },
    });

    const { accessToken, refreshToken } = generateTokens({
      id: user.id,
      email: user.email,
      sessionVersion: user.currentSessionVersion,
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: ENV.COOKIE_SECURE,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          twoFactorEnabled: user.twoFactorEnabled,
        },
        accessToken,
      },
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, error: 'Internal server error during registration' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, totpCode } = req.body;

    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
    });

    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      await logAudit({
        action: 'LOGIN',
        entity: 'AUTH',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: { attemptedEmail: email, reason: 'Bad password' },
      });
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }

    // Check 2FA if enabled
    if (user.twoFactorEnabled) {
      if (!totpCode) {
        res.status(200).json({
          success: true,
          require2FA: true,
          message: '2FA authentication required. Please enter your 6-digit authenticator code.',
        });
        return;
      }

      if (!user.twoFactorSecret || !verifyTotpToken(totpCode, user.twoFactorSecret)) {
        res.status(401).json({ success: false, error: 'Invalid two-factor authentication code' });
        return;
      }
    }

    const { accessToken, refreshToken } = generateTokens({
      id: user.id,
      email: user.email,
      sessionVersion: user.currentSessionVersion,
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: ENV.COOKIE_SECURE,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    await logAudit({
      userId: user.id,
      action: 'LOGIN',
      entity: 'USER',
      entityId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { twoFactorUsed: user.twoFactorEnabled },
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          twoFactorEnabled: user.twoFactorEnabled,
        },
        accessToken,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Internal server error during login' });
  }
}

export async function setup2FA(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const { secret, otpauthUrl } = generateTotpSecret(user.email);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    // Temporarily save secret until verified
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: secret },
    });

    res.json({
      success: true,
      data: {
        secret,
        qrCodeDataUrl,
        otpauthUrl,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to initiate 2FA setup' });
  }
}

export async function verifyAndEnable2FA(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { token } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });

    if (!user || !user.twoFactorSecret) {
      res.status(400).json({ success: false, error: '2FA setup was not initiated' });
      return;
    }

    const isValid = verifyTotpToken(token, user.twoFactorSecret);
    if (!isValid) {
      res.status(400).json({ success: false, error: 'Invalid verification code' });
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true },
    });

    await logAudit({
      userId: user.id,
      action: 'UPDATE',
      entity: 'USER',
      entityId: user.id,
      ipAddress: req.ip,
      metadata: { twoFactorEnabled: true },
    });

    res.json({ success: true, message: 'Two-factor authentication successfully enabled!' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to verify and enable 2FA' });
  }
}

export async function disable2FA(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { password } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ success: false, error: 'Invalid password to disable 2FA' });
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });

    await logAudit({
      userId: user.id,
      action: 'UPDATE',
      entity: 'USER',
      entityId: user.id,
      ipAddress: req.ip,
      metadata: { twoFactorEnabled: false },
    });

    res.json({ success: true, message: 'Two-factor authentication disabled' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to disable 2FA' });
  }
}

export async function refreshToken(req: Request, res: Response): Promise<void> {
  try {
    const rawToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!rawToken) {
      res.status(401).json({ success: false, error: 'Refresh token required' });
      return;
    }

    const payload = jwt.verify(rawToken, ENV.JWT_REFRESH_SECRET) as {
      userId: string;
      sessionVersion: number;
    };

    const user = await prisma.user.findFirst({
      where: { id: payload.userId, deletedAt: null },
    });

    if (!user || user.currentSessionVersion !== payload.sessionVersion) {
      res.status(401).json({ success: false, error: 'Session invalidated. Please login again.' });
      return;
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens({
      id: user.id,
      email: user.email,
      sessionVersion: user.currentSessionVersion,
    });

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: ENV.COOKIE_SECURE,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      data: { accessToken },
    });
  } catch (error) {
    res.status(401).json({ success: false, error: 'Invalid refresh token' });
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  res.clearCookie('refreshToken');
  res.json({ success: true, message: 'Logged out successfully' });
}

export async function logoutAll(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { currentSessionVersion: { increment: 1 } },
    });

    res.clearCookie('refreshToken');

    await logAudit({
      userId: req.user!.id,
      action: 'LOGOUT',
      entity: 'USER',
      entityId: req.user!.id,
      ipAddress: req.ip,
      metadata: { action: 'logout_all_devices' },
    });

    res.json({ success: true, message: 'Logged out from all devices successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to invalidate all sessions' });
  }
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  try {
    const { email } = req.body;
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
    });

    if (user) {
      const resetToken = generateRandomToken(32);
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetPasswordToken: resetToken,
          resetPasswordExpires: expires,
        },
      });

      await logAudit({
        userId: user.id,
        action: 'UPDATE',
        entity: 'USER',
        entityId: user.id,
        ipAddress: req.ip,
        metadata: { action: 'requested_password_reset' },
      });
    }

    // Always respond with generic message to prevent email enumeration
    res.json({
      success: true,
      message: 'If the email exists, a password reset link has been dispatched.',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to process request' });
  }
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  try {
    const { token, newPassword } = req.body;
    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: { gt: new Date() },
        deletedAt: null,
      },
    });

    if (!user) {
      res.status(400).json({ success: false, error: 'Invalid or expired password reset token' });
      return;
    }

    const passwordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        currentSessionVersion: { increment: 1 }, // invalidate old sessions
      },
    });

    await logAudit({
      userId: user.id,
      action: 'UPDATE',
      entity: 'USER',
      entityId: user.id,
      ipAddress: req.ip,
      metadata: { action: 'password_reset_completed' },
    });

    res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to reset password' });
  }
}

export async function getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        setting: true,
        teamMemberships: {
          include: { team: true },
        },
      },
    });

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        twoFactorEnabled: user.twoFactorEnabled,
        setting: user.setting,
        teams: user.teamMemberships.map((m) => ({
          teamId: m.teamId,
          name: m.team.name,
          role: m.role,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch user profile' });
  }
}
