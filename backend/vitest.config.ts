import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      MONGO_URI: 'mongodb://127.0.0.1:27017/unused-in-tests',
      JWT_SECRET: 'test-secret-test-secret-test-secret',
      AUTHORITY_INVITE_CODE: 'test-invite',
      // AI engine and weather deliberately point at a dead port: tests prove SOS works without them
      AI_ENGINE_URL: 'http://127.0.0.1:9',
      WEATHER_API_URL: 'http://127.0.0.1:9',
      GEOCODER_URL: 'http://127.0.0.1:9',
      OVERPASS_URL: 'http://127.0.0.1:9',
      AI_MAX_RETRIES: '2',
      AI_RETRY_BASE_MS: '20',
      AI_TIMEOUT_MS: '1000',
    },
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
