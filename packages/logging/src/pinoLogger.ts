import pino from "pino";
import { Logger, LogLevel } from "./logger.js";

export function createPinoLogger(opts: {
  level: LogLevel;
  pretty?: boolean;
}): Logger {
  const logger = pino({
    level: opts.level,
    transport: opts.pretty
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss",
            ignore: "pid,hostname",
          },
        }
      : undefined,
  });

  return {
    debug: (msg, fields) => logger.debug(fields ?? {}, msg),
    info: (msg, fields) => logger.info(fields ?? {}, msg),
    warn: (msg, fields) => logger.warn(fields ?? {}, msg),
    error: (msg, fields) => logger.error(fields ?? {}, msg),
  };
}
