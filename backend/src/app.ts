import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler, notFound } from './middleware/error';
import { requestId } from './middleware/requestId';
import aiRoutes from './modules/ai-integration/ai.routes';
import alertRoutes from './modules/alerts/alerts.routes';
import authRoutes from './modules/auth/auth.routes';
import digitalIdRoutes from './modules/digital-id/digitalId.routes';
import contactRoutes from './modules/emergency-contacts/contacts.routes';
import geoRoutes from './modules/geo/geo.routes';
import incidentRoutes from './modules/incidents/incidents.routes';
import notificationRoutes from './modules/notifications/notifications.routes';
import pushRoutes from './modules/push/push.routes';
import safetyMapRoutes from './modules/safety-map/safetyMap.routes';
import userRoutes from './modules/users/users.routes';
import weatherRoutes from './modules/weather/weather.routes';

export const app = express();

morgan.token('id', (req: any) => req.id);

app.set('trust proxy', 1);
app.use(requestId);
app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '1mb' }));
if (env.NODE_ENV !== 'test') app.use(morgan(':id :method :url :status :response-time ms'));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false }));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'sentinel-backend', time: new Date().toISOString() }));

const api = express.Router();
api.use('/auth', authRoutes);
api.use('/users', userRoutes);
api.use('/incidents', incidentRoutes);
api.use('/emergency-contacts', contactRoutes);
api.use('/digital-id', digitalIdRoutes);
api.use('/safety-map', safetyMapRoutes);
api.use('/alerts', alertRoutes);
api.use('/weather', weatherRoutes);
api.use('/geo', geoRoutes);
api.use('/push', pushRoutes);
api.use('/notifications', notificationRoutes);
api.use('/ai', aiRoutes);
app.use('/api/v1', api);

app.use(notFound);
app.use(errorHandler);
