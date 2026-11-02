import crypto from 'crypto';
import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import { signAccessToken } from '../../utils/jwt';
import { User, UserDocument } from '../users/user.model';
import { RefreshToken } from './refreshToken.model';

const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');
interface Meta {
  ip?: string;
  userAgent?: string;
}

export async function issueTokens(user: UserDocument, meta: Meta = {}, family?: string) {
  const accessToken = signAccessToken({ sub: String(user._id), role: user.role });
  const refreshToken = crypto.randomBytes(48).toString('hex');
  await RefreshToken.create({
    user: user._id,
    tokenHash: sha256(refreshToken),
    family: family ?? crypto.randomUUID(),
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 86_400_000),
    ...meta,
  });
  return { accessToken, refreshToken, accessTokenExpiresIn: env.JWT_ACCESS_EXPIRES_IN };
}

/** Rotation with reuse detection: replaying a used refresh token revokes the whole session. */
export async function rotateRefreshToken(raw: string, meta: Meta = {}) {
  const hash = sha256(raw);
  const doc = await RefreshToken.findOneAndUpdate({ tokenHash: hash, revokedAt: { $exists: false } }, { revokedAt: new Date() });
  if (!doc) {
    const reused = await RefreshToken.findOne({ tokenHash: hash });
    if (reused) await RefreshToken.updateMany({ family: reused.family }, { revokedAt: new Date() });
    throw new ApiError(401, 'Invalid refresh token', undefined, 'INVALID_REFRESH_TOKEN');
  }
  if (doc.expiresAt < new Date()) throw new ApiError(401, 'Refresh token expired', undefined, 'INVALID_REFRESH_TOKEN');
  const user = await User.findById(doc.user);
  if (!user || !user.isActive) throw new ApiError(401, 'Account not found or disabled');
  return { user, tokens: await issueTokens(user, meta, doc.family) };
}

export async function revokeRefreshToken(raw: string) {
  await RefreshToken.updateOne({ tokenHash: sha256(raw), revokedAt: { $exists: false } }, { revokedAt: new Date() });
}

export const revokeAllForUser = (userId: unknown) =>
  RefreshToken.updateMany({ user: userId, revokedAt: { $exists: false } }, { revokedAt: new Date() });
