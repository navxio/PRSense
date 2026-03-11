import path from "node:path";
import os from "node:os";

import { loadYamlConfig } from "./loadYamlConfig.js";
import { deepMerge } from "./merge.js";
import { defaults } from "./defaults.js";
import { RuntimeConfigSchema, type RuntimeConfig } from "./schema.js";
import { buildResolvedConfig } from "./buildResolvedConfig.js";
import type { ResolvedConfig, RuntimeMode } from "./types.js";

export function getGlobalConfigPath(): string {
  const base =
    process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config");

  return path.join(base, "prsense", "config.yml");
}

let cachedConfig: ResolvedConfig | null = null;

export function resolveConfig(
  mode: RuntimeMode,
  repository: {
    root: string;
    provider: "github" | "gitlab" | "filesystem";
  },
): ResolvedConfig {
  if (cachedConfig) return cachedConfig;
  const globalConfig = loadYamlConfig(getGlobalConfigPath());

  const repoConfig = loadYamlConfig("prsense.yml");

  const merged = deepMerge(deepMerge(defaults, globalConfig), repoConfig);

  const runtimeConfig: RuntimeConfig = RuntimeConfigSchema.parse(merged);
  const resolvedConfig = buildResolvedConfig(runtimeConfig, mode, repository);
  cachedConfig = resolvedConfig;
  return cachedConfig;
}
