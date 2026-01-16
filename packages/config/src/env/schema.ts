import { z } from "zod";

export const EnvConfigSchema = z.object({
  PRSENSE_DATABASE_URL: z.string().url(),

  PRSENSE_OPENAI_API_KEY: z.string().optional(),
  PRSENSE_OLLAMA_HOST: z.string().url().optional(),

  PRSENSE_LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type EnvConfig = z.infer<typeof EnvConfigSchema>;
