import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import yaml from "yaml";
import { UserConfigSchema, UserConfig } from "./schema.js";

function getGlobalConfigPath(): string {
  const base =
    process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config");

  return path.join(base, "prsense", "config.yml");
}

export function loadGlobalConfig(): UserConfig {
  const configPath = getGlobalConfigPath();
  console.debug("Loading config from : ", configPath);

  if (!fs.existsSync(configPath)) {
    return UserConfigSchema.parse({});
  }

  const raw = fs.readFileSync(configPath, "utf8");
  const parsed = yaml.parse(raw);

  return UserConfigSchema.parse(parsed ?? {});
}
