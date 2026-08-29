import { createAuricCore } from "../core/index.js";
import { getConfig } from "../core/kernel/config.js";
import { rootLogger } from "../core/kernel/logging/logger.js";

/**
 * Dev / single-process entrypoint. Runs migrations, seeds, starts the outbox
 * worker, and serves the HTTP API — the whole modular monolith in one
 * process (§3.0).
 */
async function main() {
  const config = getConfig();
  const core = createAuricCore();

  await core.start();

  const server = core.app.listen(config.port, () => {
    rootLogger.info({ port: config.port, url: `http://localhost:${config.port}/api/health` }, "listening");
  });

  const shutdown = async (signal: string) => {
    rootLogger.info({ signal }, "shutting down");
    server.close();
    await core.stop();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  rootLogger.fatal({ err }, "failed to start");
  process.exit(1);
});
