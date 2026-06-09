import { ResolvedConfigSchema, type RuntimeConfig } from "./schema.js";
import type { ResolvedConfig, RuntimeMode } from "./types.js";

export function buildResolvedConfig(
  runtime: RuntimeConfig,
  mode: RuntimeMode,
  repository: { root: string; provider: "github" | "gitlab" | "filesystem" },
): ResolvedConfig {
  return ResolvedConfigSchema.parse({ ...runtime, mode, repository });
}
