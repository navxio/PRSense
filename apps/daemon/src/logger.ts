import { createPinoLogger, type Logger, type LogLevel } from "@prsense/logging";

export function createDaemonLogger(): Logger {
  return createPinoLogger({
    level: (process.env.PRSENSE_LOG_LEVEL ?? "warn") as LogLevel,
    pretty: false,
  });
}
