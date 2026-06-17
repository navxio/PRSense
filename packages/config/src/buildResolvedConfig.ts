import { ResolvedConfigSchema, type RuntimeConfig } from "./schema.js";
import type { ResolvedConfig, RuntimeMode } from "./types.js";
import { RepositoryProvider } from "@prsense/core";

export function buildResolvedConfig(
  runtime: RuntimeConfig,
  mode: RuntimeMode,
  repository: {
    root: string;
    provider: RepositoryProvider;
  },
): ResolvedConfig {
  return ResolvedConfigSchema.parse({ ...runtime, mode, repository });
}
