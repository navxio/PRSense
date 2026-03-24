import { z } from "zod";

export const RuntimeConfigSchema = z.object({
  llm: z.object({
    provider: z.enum(["ollama", "openai", "anthropic", "google"]),
    model: z.string(),
    temperature: z.number().min(0).max(1),
  }),

  embeddings: z.object({
    provider: z.enum(["ollama", "openai"]),
    model: z.string(),
  }),

  index: z.object({
    chunkSizeChars: z.number().int().positive(),
    chunkOverlapChars: z.number().int().positive(),
  }),

  review: z.object({
    confidenceThreshold: z.number().min(0).max(1),
    maxSignals: z.number().int().positive(),
  }),

  context: z.object({
    maxChunks: z.number().int().positive(),
  }),

  database: z
    .object({
      url: z.string(),
      mode: z.enum(["bundled", "external"]),
    })
    .optional(),

  git: z.object({
    baseBranch: z.string(),
  }),

  delivery: z
    .object({
      platform: z.enum(["github", "gitlab"]),
      other: z.array(z.enum(["slack", "jira"])).default([]),
    })
    .optional(),

  logLevel: z.enum(["debug", "info", "warn", "error"]).default("warn"),
});

export type RuntimeConfig = z.infer<typeof RuntimeConfigSchema>;
