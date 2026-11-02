import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  MONGO_URI: z.string().min(1),
  CLIENT_URL: z.string().default('http://localhost:5173'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_DAYS: z.coerce.number().default(7),
  AUTHORITY_INVITE_CODE: z.string().default(''),

  AI_ENGINE_URL: z.string().default('http://localhost:8000'),
  AI_ENGINE_API_KEY: z.string().default(''),
  AI_TIMEOUT_MS: z.coerce.number().default(20000),
  AI_MAX_RETRIES: z.coerce.number().default(3),
  AI_RETRY_BASE_MS: z.coerce.number().default(2000),

  GEOCODER_URL: z.string().default('https://nominatim.openstreetmap.org'),
  GEOCODER_USER_AGENT: z.string().default('SentinelSafetyPlatform/2.0 (set GEOCODER_USER_AGENT with your contact email)'),
  OVERPASS_URL: z.string().default('https://overpass-api.de/api/interpreter'),

  VAPID_PUBLIC_KEY: z.string().default(''),
  VAPID_PRIVATE_KEY: z.string().default(''),
  VAPID_SUBJECT: z.string().default('mailto:admin@example.com'),

  WEATHER_API_URL: z.string().default('https://api.open-meteo.com/v1/forecast'),
  WEATHER_CACHE_MIN: z.coerce.number().default(15),
  WEATHER_STALE_MIN: z.coerce.number().default(120),
});

export const env = schema.parse(process.env);
