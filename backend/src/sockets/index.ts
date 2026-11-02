import http from 'http';
import { Server } from 'socket.io';
import { env } from '../config/env';
import { User } from '../modules/users/user.model';
import { verifyToken } from '../utils/jwt';
import { logger } from '../utils/logger';

let io: Server | null = null;

/**
 * Auth: io(URL, { auth: { token: '<access token>' } })
 * Rooms: `user:<id>` (private to that user) and `authorities` (role = authority, checked server-side).
 *
 * Privacy rule: socket payloads carry ONLY minimal status/marker data. No names, phones, medical or
 * free-text details are ever pushed. Clients fetch details through the REST API, where role and
 * ownership are enforced. Every event is wrapped as { v, serverTime, data } so clients can show
 * stale-data indicators and fall back to REST polling (GET /incidents?updatedAfter=...).
 */
export function initSocket(server: http.Server) {
  io = new Server(server, { cors: { origin: env.CLIENT_URL, credentials: true } });

  io.use(async (socket, next) => {
    try {
      const payload = verifyToken(socket.handshake.auth?.token as string);
      const user = await User.findById(payload.sub).select('role isActive').lean();
      if (!user || !user.isActive) return next(new Error('unauthorized'));
      socket.data.userId = String(user._id);
      socket.data.role = user.role; // role comes from the DB, not the token
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.userId}`);
    if (socket.data.role === 'authority') socket.join('authorities');
    socket.on('error', (e) => logger.warn('socket error', e?.message));
  });

  return io;
}

const envelope = (data: unknown) => ({ v: 1, serverTime: new Date().toISOString(), data });

export const emitToUser = (userId: unknown, event: string, data: unknown) =>
  io?.to(`user:${String(userId)}`).emit(event, envelope(data));
export const emitToAuthorities = (event: string, data: unknown) => io?.to('authorities').emit(event, envelope(data));
export const broadcast = (event: string, data: unknown) => io?.emit(event, envelope(data)); // public data only (alerts)
