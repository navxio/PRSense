import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";
import { PrsenseConfigSchema, PrsenseConfig } from "./schema.js";

function findConfigFile(startDir: string): string | null {
  let dir = startDir;

  while (true) {
    const candidate = path.join(dir, "config.yml");
    if (fs.existsSync(candidate)) {
      return candidate;
    }

    const parent = path.dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }

  return null;
}

export function loadPrsenseConfig(
  cwd: string,
  overrides?: unknown,
): PrsenseConfig {
  const configPath = findConfigFile(cwd);

  let fileConfig: unknown = {};
  if (configPath) {
    console.debug(`Using config file: ${configPath}`);
    const raw = fs.readFileSync(configPath, "utf8");

    const parsed = yaml.parse(raw);
    fileConfig = typeof parsed === "object" && parsed !== null ? parsed : {};
  }

  const baseConfig = PrsenseConfigSchema.parse(fileConfig);

  if (!overrides) {
    return baseConfig;
  }

  const overrideConfig = PrsenseConfigSchema.partial().parse(overrides);

  return PrsenseConfigSchema.parse({
    ...baseConfig,
    ...overrideConfig,
  });
}
