import { createPinoLogger, type Logger } from "@prsense/logging";
import { loadEnvConfig } from "@prsense/config";

export function createDaemonLogger(): Logger {
  const env = loadEnvConfig();

  return createPinoLogger({
    level: env.PRSENSE_LOG_LEVEL,
    pretty: false,
  });
}
