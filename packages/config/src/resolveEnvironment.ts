import { resolveConfig } from "./resolveConfig.js";
import { resolveCredentials } from "./resolveCredentials.js";
import { validateEnvironment } from "./validateEnvironment.js";

import type { RuntimeEnvironment, RuntimeMode } from "./types.js";
import { RepositoryProvider } from "packages/core/dist/index.js";

export function resolveEnvironment(
  mode: RuntimeMode,
  repository: {
    root: string;
    provider: RepositoryProvider;
  },
): RuntimeEnvironment {
  const config = resolveConfig(mode, repository);

  const credentials = resolveCredentials();

  const issues = validateEnvironment(config, credentials);

  return {
    config,
    credentials,
    issues,
  };
}
