import { createApp } from "./app.js";
import { runMigrations } from "./db/migrate.js";
import { startWorker } from "./jobs/worker.js";
import { env } from "./config/env.js";
import { logger } from "./core/logger.js";

async function main(): Promise<void> {
  await runMigrations();

  const worker = startWorker();
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(`Server listening on port ${env.PORT}`);
  });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      logger.info(`Received ${signal}, shutting down`);
      worker.stop();
      server.close(() => process.exit(0));
    });
  }
}

main().catch((err) => {
  logger.error(err, "Fatal error during startup");
  process.exit(1);
});
