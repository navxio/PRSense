// packages/config/src/user/loadUserConfig.ts
import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";
import { UserConfigSchema, UserConfig } from "./schema.js";

const CONFIG_FILENAME = "prsense.yml";

function findConfigFile(startDir: string): string | null {
  let dir = startDir;

  while (true) {
    const candidate = path.join(dir, CONFIG_FILENAME);
    if (fs.existsSync(candidate)) return candidate;

    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function loadRepoConfig(cwd: string): UserConfig {
  const configPath = findConfigFile(cwd);

  if (!configPath) {
    return UserConfigSchema.parse({});
  }

  const raw = fs.readFileSync(configPath, "utf8");
  const parsed = yaml.parse(raw);

  return UserConfigSchema.parse(parsed ?? {});
}
