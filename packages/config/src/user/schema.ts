import { z } from "zod";

const VcsChannelSchema = z.enum(["github", "gitlab"]);
const OtherChannelSchema = z.enum(["slack", "jira"]);

export const UserConfigSchema = z.object({
  llm: z.object({
    provider: z
      .enum(["ollama", "openai", "anthropic", "google"])
      .default("ollama"),
    model: z.string(),
    temperature: z.number().min(0).max(1).default(0.1),
  }),

  embeddings: z.object({
    provider: z.enum(["ollama", "openai"]).default("ollama"),
    model: z.string().default("nomic-embed-text"),
  }),

  index: z.object({
    chunkSizeChars: z.number().int().positive().default(1000),
    chunkOverlapChars: z.number().int().positive().default(200),
    maxFileSizeBytes: z.number().int().positive().default(1_000_000),
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

  delivery: z
    .object({
      vcs: VcsChannelSchema,
      other: z.array(OtherChannelSchema).default([]),
    })
    .optional(),
});

export type UserConfig = z.infer<typeof UserConfigSchema>;
