import { z } from "zod";

export const EnvConfigSchema = z.object({
  PRSENSE_GITLAB_WEBHOOK_SECRET: z.string().optional(),
  PRSENSE_GITLAB_TOKEN: z.string().optional(),
  PRSENSE_DATABASE_URL: z.url().optional(),

  PRSENSE_GITHUB_TOKEN: z.string().optional(),
  PRSENSE_OPENAI_API_KEY: z.string().optional(),
  PRSENSE_OLLAMA_HOST: z.url().optional().default("http://127.0.0.1:11434"),

  PRSENSE_LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type EnvConfig = z.infer<typeof EnvConfigSchema>;
