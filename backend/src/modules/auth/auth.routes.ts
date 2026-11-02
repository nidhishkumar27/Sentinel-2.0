import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../../config/env';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { ApiError } from '../../utils/ApiError';
import { asyncHandler } from '../../utils/asyncHandler';
import { audit } from '../audit/audit.service';
import { User } from '../users/user.model';
import { issueTokens, revokeAllForUser, revokeRefreshToken, rotateRefreshToken } from './tokens.service';

const router = Router();
router.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 50, standardHeaders: true, legacyHeaders: false }));


const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  phone: z.string().min(7).max(20),
  password: z.string().min(8).max(100),
  inviteCode: z.string().optional(),
  badgeId: z.string().optional(),
  department: z.enum([
    'POLICE',
    'MEDICAL',
    'FIRE',
    'DISASTER',
    'OTHER',
  ]).optional(),
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const refreshSchema = z.object({ refreshToken: z.string().min(20) });
const meta = (req: any) => ({ ip: req.ip, userAgent: req.headers['user-agent'] });
const emailHash = (e: string) => crypto.createHash('sha256').update(e.toLowerCase()).digest('hex').slice(0, 16);

router.post(
  '/register',
  validate({ body: registerSchema }),
  
asyncHandler(async (req, res) => {
  const {
    name,
    email,
    phone,
    password,
    inviteCode,
    badgeId,
    department,
  } = req.body;

  if (await User.exists({ email: email.toLowerCase() })) {
    throw new ApiError(
      409,
      'Email already registered',
      undefined,
      'EMAIL_TAKEN'
    );
  }

  const isAuthority =
    !!env.AUTHORITY_INVITE_CODE &&
    inviteCode === env.AUTHORITY_INVITE_CODE;

  if (inviteCode && !isAuthority) {
    throw new ApiError(
      403,
      'Invalid invite code',
      undefined,
      'INVALID_INVITE_CODE'
    );
  }

  if (isAuthority && !department) {
    throw new ApiError(
      400,
      'Please select an authority department',
      undefined,
      'DEPARTMENT_REQUIRED'
    );
  }

  if (!isAuthority && department) {
    throw new ApiError(
      403,
      'Department selection is only allowed for authority accounts',
      undefined,
      'INVALID_DEPARTMENT'
    );
  }

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    phone,
    passwordHash: await bcrypt.hash(password, 12),
    role: isAuthority ? 'authority' : 'user',
    badgeId: isAuthority ? badgeId : undefined,
    department: isAuthority ? department : undefined,
  });

  await audit(req, {
    action: 'auth.register',
    actor: user,
    targetType: 'User',
    targetId: user._id,
    meta: {
      role: user.role,
      department: user.department,
    },
  });

  const tokens = await issueTokens(user, meta(req));

  res.status(201).json({
    success: true,
    data: {
      user,
      ...tokens,
    },
  });
})

);

router.post(
  '/login',
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email.toLowerCase() }).select('+passwordHash');
    if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) {
      await audit(req, { action: 'auth.login_failed', meta: { emailHash: emailHash(req.body.email) } });
      throw new ApiError(401, 'Invalid email or password', undefined, 'INVALID_CREDENTIALS');
    }
    if (!user.isActive) throw new ApiError(403, 'Account disabled', undefined, 'ACCOUNT_DISABLED');
    await audit(req, { action: 'auth.login', actor: user, targetType: 'User', targetId: user._id });
    const tokens = await issueTokens(user, meta(req));
    res.json({ success: true, data: { user, ...tokens } });
  })
);

router.post(
  '/refresh',
  validate({ body: refreshSchema }),
  asyncHandler(async (req, res) => {
    const { user, tokens } = await rotateRefreshToken(req.body.refreshToken, meta(req));
    res.json({ success: true, data: { user, ...tokens } });
  })
);

router.post(
  '/logout',
  validate({ body: refreshSchema }),
  asyncHandler(async (req, res) => {
    await revokeRefreshToken(req.body.refreshToken);
    res.json({ success: true });
  })
);

router.post(
  '/logout-all',
  authenticate,
  asyncHandler(async (req, res) => {
    await revokeAllForUser(req.user!._id);
    await audit(req, { action: 'auth.logout_all', targetType: 'User', targetId: req.user!._id });
    res.json({ success: true });
  })
);

router.get('/me', authenticate, (req, res) => res.json({ success: true, data: req.user }));

export default router;
