import { z } from "zod";

export const UserConfigSchema = z.object({
  llm: z.object({
    provider: z.enum(["ollama", "openai"]).default("ollama"),
    model: z.string(),
    temperature: z.number().min(0).max(1).default(0.1),
  }),

  review: z.object({
    confidenceThreshold: z.number().min(0).max(1).default(0.6),
    maxSignals: z.number().int().positive().default(10),
  }),

  context: z.object({
    maxChunks: z.number().int().positive().default(5),
  }),

  git: z.object({
    baseBranch: z.string().default("main"),
  }),
});

export type UserConfig = z.infer<typeof UserConfigSchema>;
