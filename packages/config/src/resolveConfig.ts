import path from "node:path";
import os from "node:os";

import { loadYamlConfig } from "./loadYamlConfig.js";
import { deepMerge } from "./merge.js";
import { defaults } from "./defaults.js";

function getGlobalConfigPath(): string {
  const base =
    process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config");

  return path.join(base, "prsense", "config.yml");
}

export function resolveConfig() {
  const globalConfig = loadYamlConfig(getGlobalConfigPath());

  const repoConfig = loadYamlConfig("prsense.yml");

  const merged = deepMerge(deepMerge(defaults, globalConfig), repoConfig);

  return merged;
}
