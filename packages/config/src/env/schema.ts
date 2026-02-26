import { z } from "zod";

export const EnvConfigSchema = z.object({
  PRSENSE_GITLAB_WEBHOOK_SECRET: z.string().optional(),
  PRSENSE_GITHUB_WEBHOOK_SECRET: z.string().optional(),
  PRSENSE_GITLAB_TOKEN: z.string().optional(),
  PRSENSE_DATABASE_URL: z.url().optional(),
  PRSENSE_GEMINI_API_KEY: z.string().optional(),
  PRSENSE_CLAUDE_API_KEY: z.string().optional(),

  PRSENSE_GITHUB_TOKEN: z.string().optional(),
  PRSENSE_OPENAI_API_KEY: z.string().optional(),
  PRSENSE_OLLAMA_HOST: z.url().optional().default("http://127.0.0.1:11434"),

  PRSENSE_LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  PRSENSE_GITHUB_APP_ID: z.string().optional(),
  PRSENSE_GITHUB_APP_PRIVATE_KEY: z.string().optional(),
  PRSENSE_GITHUB_INSTALLATION_ID: z.string().optional(),
  PRSENSE_SLACK_BOT_TOKEN: z.string().optional(),
  PRSENSE_SELF_HOSTED: z.boolean().default(false),
});

export type EnvConfig = z.infer<typeof EnvConfigSchema>;
