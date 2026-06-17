// packages/config/src/schema.ts
import { z } from "zod";

const LlmConfigSchema = z
  .object({
    provider: z
      .enum(["ollama", "openai", "anthropic", "google"])
      .default("ollama"),
    model: z.string().min(1).default("deepseek-coder-v2"),
    temperature: z.number().min(0).max(2).default(0.1),
  })
  .prefault({});

const EmbeddingConfigSchema = z
  .object({
    provider: z.enum(["ollama", "openai", "google"]).default("ollama"),
    model: z.string().min(1).default("nomic-embed-text"),
  })
  .prefault({});

const IndexConfigSchema = z
  .object({
    chunkSizeChars: z.number().int().positive().default(1000),
    chunkOverlapChars: z.number().int().nonnegative().default(200),
    auto: z.boolean().default(true),
  })
  .refine((v) => v.chunkOverlapChars < v.chunkSizeChars, {
    message: "chunkOverlapChars must be smaller than chunkSizeChars",
    path: ["chunkOverlapChars"],
  })
  .prefault({});

const ReviewConfigSchema = z
  .object({
    confidenceThreshold: z.number().min(0).max(1).default(0.8),
    topSignals: z.number().int().positive().default(3),
  })
  .prefault({});

const ContextConfigSchema = z
  .object({
    maxChunks: z.number().int().positive().default(5),
  })
  .prefault({});

const GitConfigSchema = z
  .object({ baseBranch: z.string().min(1).default("main") })
  .prefault({});

const DeliveryConfigSchema = z.object({
  platform: z.enum(["github", "gitlab"]),
  other: z.array(z.enum(["slack", "jira"])).default([]),
});

const RepositoryConfigSchema = z.object({
  root: z.string().min(1),
  provider: z.enum(["github", "gitlab", "filesystem"]),
});

const runtimeShape = {
  llm: LlmConfigSchema,
  embeddings: EmbeddingConfigSchema,
  index: IndexConfigSchema,
  review: ReviewConfigSchema,
  context: ContextConfigSchema,
  git: GitConfigSchema,
  delivery: DeliveryConfigSchema.optional(),
};

export const RuntimeConfigSchema = z.object(runtimeShape);
export type RuntimeConfig = z.infer<typeof RuntimeConfigSchema>;

const CliResolvedSchema = z.object({
  ...runtimeShape,
  repository: RepositoryConfigSchema,
  mode: z.literal("cli"),
});

const DaemonResolvedSchema = z.object({
  ...runtimeShape,
  repository: RepositoryConfigSchema,
  mode: z.literal("daemon"),
  delivery: DeliveryConfigSchema, // required, overrides optional from runtimeShape
});

export const ResolvedConfigSchema = z.discriminatedUnion("mode", [
  CliResolvedSchema,
  DaemonResolvedSchema,
]);
export type ResolvedConfig = z.infer<typeof ResolvedConfigSchema>;
export type CliResolvedConfig = z.infer<typeof CliResolvedSchema>;
export type DaemonResolvedConfig = z.infer<typeof DaemonResolvedSchema>;
