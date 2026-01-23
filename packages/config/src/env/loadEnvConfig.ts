import { EnvConfigSchema, EnvConfig } from "./schema.js";

export function loadEnvConfig(): EnvConfig {
  const parsed = EnvConfigSchema.safeParse(process.env);

  if (!parsed.success) {
    throw new Error("Invalid environment configuration:\n" + parsed.error);
  }

  return parsed.data;
}
