// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

import { getServerEnv } from "@lingua/config";
import { buildApp } from "./app";

async function main(): Promise<void> {
  const env = getServerEnv();
  const app = await buildApp();

  // Finish in-flight requests before exiting so a deploy does not sever a
  // graded attempt mid-transaction.
  const shutdown = (signal: NodeJS.Signals): void => {
    app.log.info({ signal }, "shutting down");
    void app
      .close()
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        app.log.error({ err: error }, "error during shutdown");
        process.exit(1);
      });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await app.listen({ host: env.API_HOST, port: env.API_PORT });
}

main().catch((error: unknown) => {
  // The app logger may not exist yet, so this is the one place console is right.
  console.error("failed to start API", error);
  process.exit(1);
});
