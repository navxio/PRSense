import type { UserConfig } from "./schema.js";

function mergeObjects<T extends Record<string, any>>(
  base: T,
  override: Partial<T>,
): T {
  const result: Record<string, any> = { ...base };

  for (const key of Object.keys(override)) {
    const value = override[key as keyof T];

    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof result[key] === "object"
    ) {
      result[key] = mergeObjects(result[key], value);
    } else if (value !== undefined) {
      result[key] = value;
    }
  }

  return result as T;
}

export function mergeUserConfigs(
  globalConfig: UserConfig,
  repoConfig: UserConfig,
): UserConfig {
  return mergeObjects(globalConfig, repoConfig);
}
