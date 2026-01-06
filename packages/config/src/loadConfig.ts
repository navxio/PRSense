import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";
import { PrsenseConfigSchema, PrsenseConfig } from "./schema.js";

export function loadPrsenseConfig(
  cwd: string,
  overrides: Partial<PrsenseConfig> = {},
): PrsenseConfig {
  const configPath = path.join(cwd, "prsense.yml");

  let fileConfig = {};
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, "utf8");
    fileConfig = yaml.parse(raw) ?? {};
  }

  const merged = {
    ...fileConfig,
    ...overrides,
  };

  return PrsenseConfigSchema.parse(merged);
}
