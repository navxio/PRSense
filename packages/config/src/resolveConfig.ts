import path from "node:path";
import os from "node:os";

import { loadYamlConfig } from "./loadYamlConfig.js";
import { loadEnv } from "./loadEnv.js";
import { deepMerge } from "./merge.js";
import { defaults } from "./defaults.js";
import { RuntimeConfigSchema } from "./schema.js";
import { buildResolvedConfig } from "./buildResolvedConfig.js";

function getGlobalConfigPath(): string {
  const base =
    process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config");

  return path.join(base, "prsense", "config.yml");
}

export function resolveConfig() {
  const globalConfig = loadYamlConfig(getGlobalConfigPath());

  const repoConfig = loadYamlConfig("prsense.yml");

  const env = loadEnv();

  const merged = deepMerge(
    deepMerge(deepMerge(defaults, globalConfig), repoConfig),
    env,
  );

  const validated = RuntimeConfigSchema.parse(merged);

  return buildResolvedConfig(validated);
}
