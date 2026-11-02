import { randomUUID } from 'crypto';
import { RequestHandler } from 'express';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.headers['x-request-id'];
  req.id = (typeof incoming === 'string' && incoming.slice(0, 100)) || randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
};
