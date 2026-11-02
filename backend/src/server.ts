import http from 'http';
import mongoose from 'mongoose';
import { app } from './app';
import { connectDB } from './config/db';
import { env } from './config/env';
import { resumePendingBriefings } from './modules/ai-integration/briefing.service';
import { initSocket } from './sockets';
import { logger } from './utils/logger';

async function main() {
  await connectDB();
  const server = http.createServer(app);
  initSocket(server);
  resumePendingBriefings().catch((e) => logger.error('resume briefings failed', e));
  server.listen(env.PORT, () => logger.info(`Sentinel backend running on :${env.PORT} (${env.NODE_ENV})`));

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('Failed to start server', err);
  process.exit(1);
});
