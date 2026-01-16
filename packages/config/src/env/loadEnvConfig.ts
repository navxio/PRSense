import { EnvConfigSchema, EnvConfig } from "./schema.js";

export function loadEnvConfig(env: NodeJS.ProcessEnv): EnvConfig {
  const parsed = EnvConfigSchema.safeParse(env);

  if (!parsed.success) {
    throw new Error("Invalid environment configuration:\n" + parsed.error);
  }

  return parsed.data;
}
