import app from './app.js';
import config from './config/index.js';
import logger from './utils/logger.js';

const server = app.listen(config.port, () => {
  logger.info(`🚀 Server running on port ${config.port} [${config.nodeEnv}]`);
  logger.info(`📡 API: http://localhost:${config.port}/api/${config.apiVersion}`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down...');
  server.close(() => process.exit(0));
});
