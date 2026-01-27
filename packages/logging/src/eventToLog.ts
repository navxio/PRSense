import { Logger } from "./logger.js";

export function logEvent(
  logger: Logger,
  event: { event: string; fields?: Record<string, unknown> },
) {
  const name = event.event;

  if (name.endsWith(".failed")) {
    logger.error(name, event.fields);
  } else if (name.includes("retry") || name.includes("truncated")) {
    logger.warn(name, event.fields);
  } else if (name.endsWith(".started")) {
    logger.debug(name, event.fields);
  } else {
    logger.info(name, event.fields);
  }
}
