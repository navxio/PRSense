// packages/config/src/resolveConfig.ts
import path from "node:path";
import os from "node:os";

import { loadYamlConfig } from "./loadYamlConfig.js";
import { deepMerge } from "./merge.js";
import { RuntimeConfigSchema } from "./schema.js";
import { buildResolvedConfig } from "./buildResolvedConfig.js";
import type { ResolvedConfig, RuntimeMode } from "./types.js";
import { RepositoryProvider } from "packages/core/dist/index.js";

export function getGlobalConfigPath(): string {
  const base =
    process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config");
  return path.join(base, "prsense", "config.yml");
}

const cache = new Map<string, ResolvedConfig>();

export function resolveConfig(
  mode: RuntimeMode,
  repository: {
    root: string;
    provider: RepositoryProvider;
  },
): ResolvedConfig {
  const key = `${mode}::${repository.root}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const globalConfig = loadYamlConfig(getGlobalConfigPath());
  const repoConfig = loadYamlConfig(path.join(repository.root, "prsense.yml"));

  const merged = deepMerge(globalConfig, repoConfig);
  const runtime = RuntimeConfigSchema.parse(merged); // defaults applied here
  const resolved = buildResolvedConfig(runtime, mode, repository);

  cache.set(key, resolved);
  return resolved;
}

export function __resetConfigCache() {
  cache.clear();
}
