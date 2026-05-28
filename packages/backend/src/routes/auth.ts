import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { hashPassword, verifyPassword, signToken } from '../services/authService.js';
import { sendInviteEmail } from '../services/emailService.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminOnly.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const inviteSchema = z.object({
  email: z.string().email(),
  sendEmail: z.boolean().default(true),
});

const acceptSchema = z.object({
  password: z.string().min(8),
});

const updateMeSchema = z.object({
  displayName: z.string().min(1).max(100),
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = signToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      displayName: user.displayName ?? undefined,
    });

    res.json({ token, user: { id: user.id, email: user.email, role: user.role, displayName: user.displayName } });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.sub } });
    res.json({ id: user.id, email: user.email, role: user.role, displayName: user.displayName });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/users  (admin only)
router.get('/users', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const [users, invitations] = await Promise.all([
      prisma.user.findMany({
        select: { id: true, email: true, displayName: true, role: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.invitation.findMany({
        where: { acceptedAt: null, expiresAt: { gt: new Date() } },
        select: { id: true, email: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const result = [
      ...users.map(u => ({ ...u, status: 'active' as const })),
      ...invitations.map(i => ({ id: i.id, email: i.email, displayName: null, role: null, createdAt: i.createdAt, status: 'pending' as const })),
    ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/auth/me
router.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const { displayName } = updateMeSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.user!.sub },
      data: { displayName },
    });
    const token = signToken({ sub: user.id, email: user.email, role: user.role, displayName: user.displayName ?? undefined });
    res.json({ token, user: { id: user.id, email: user.email, role: user.role, displayName: user.displayName } });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/invite  (admin only)
router.post('/invite', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { email, sendEmail } = inviteSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'A user with that email already exists' });
      return;
    }

    // Invalidate any existing pending invite for this address
    await prisma.invitation.updateMany({
      where: { email, acceptedAt: null },
      data: { expiresAt: new Date() },
    });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await prisma.invitation.create({
      data: { email, token, invitedBy: req.user!.sub, expiresAt },
    });

    if (sendEmail) {
      const admin = await prisma.user.findUnique({ where: { id: req.user!.sub } });
      await sendInviteEmail(email, token, admin?.displayName ?? undefined);
    }

    const link = `${process.env.APP_URL}/accept-invite?token=${token}`;
    res.status(201).json({ message: `Invitation created for ${email}`, link });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/invite/:token
router.get('/invite/:token', async (req, res, next) => {
  try {
    const invitation = await prisma.invitation.findUnique({
      where: { token: req.params.token },
    });

    if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
      res.status(404).json({ error: 'Invalid or expired invitation' });
      return;
    }

    res.json({ email: invitation.email });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/invite/:token/accept
router.post('/invite/:token/accept', async (req, res, next) => {
  try {
    const { password } = acceptSchema.parse(req.body);

    const invitation = await prisma.invitation.findUnique({
      where: { token: req.params.token },
    });

    if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
      res.status(404).json({ error: 'Invalid or expired invitation' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email: invitation.email } });
    if (existing) {
      res.status(409).json({ error: 'An account with that email already exists' });
      return;
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: { email: invitation.email, passwordHash, role: 'USER' },
      });
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });
      return newUser;
    });

    const token = signToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      displayName: user.displayName ?? undefined,
    });

    res.status(201).json({ token, user: { id: user.id, email: user.email, role: user.role, displayName: user.displayName } });
  } catch (err) {
    next(err);
  }
});

export { router as authRouter };
