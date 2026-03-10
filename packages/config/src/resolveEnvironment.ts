import { resolveConfig } from "./resolveConfig.js";
import { resolveCredentials } from "./resolveCredentials.js";
import { validateEnvironment } from "./validateEnvironment.js";

import type { RuntimeEnvironment } from "./types.js";

export function resolveEnvironment(): RuntimeEnvironment {
  const config = resolveConfig();

  const credentials = resolveCredentials();

  const issues = validateEnvironment(config, credentials);

  return {
    config,
    credentials,
    issues,
  };
}
