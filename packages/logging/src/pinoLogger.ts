import pino from "pino";
import { Logger, LogLevel } from "./logger.js";

export function createPinoLogger(opts: {
  level: LogLevel;
  pretty?: boolean;
}): Logger {
  const options: pino.LoggerOptions = {
    level: opts.level,
  };

  if (opts.pretty) {
    options.transport = {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss",
        ignore: "pid,hostname",
      },
    };
  }

  const destination = pino.destination({ fd: 2 });
  const logger = pino(options, destination);

  return {
    debug: (msg, fields) => logger.debug(fields ?? {}, msg),
    info: (msg, fields) => logger.info(fields ?? {}, msg),
    warn: (msg, fields) => logger.warn(fields ?? {}, msg),
    error: (msg, fields) => logger.error(fields ?? {}, msg),
  };
}
