// packages/config/src/schema.ts
import { z } from "zod";

const LlmConfigSchema = z.object({
  provider: z.enum(["ollama", "openai", "anthropic", "google"]),
  model: z.string().min(1),
  temperature: z.number().min(0).max(2),
});

const EmbeddingConfigSchema = z.object({
  provider: z.enum(["ollama", "openai"]),
  model: z.string().min(1),
});

const IndexConfigSchema = z
  .object({
    chunkSizeChars: z.number().int().positive(),
    chunkOverlapChars: z.number().int().nonnegative(),
    auto: z.boolean().default(true),
  })
  .refine((v) => v.chunkOverlapChars < v.chunkSizeChars, {
    message: "chunkOverlapChars must be smaller than chunkSizeChars",
    path: ["chunkOverlapChars"],
  });

const ReviewConfigSchema = z.object({
  confidenceThreshold: z.number().min(0).max(1),
  maxSignals: z.number().int().positive(),
});

const ContextConfigSchema = z.object({
  maxChunks: z.number().int().positive(),
});

const GitConfigSchema = z.object({ baseBranch: z.string().min(1) });

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
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("warn"),
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
