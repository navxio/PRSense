import { z } from "zod";

const SeverityEnum = z.enum(["low", "medium", "high"]);

export const PrsenseConfigSchema = z.object({
  llm: z
    .object({
      provider: z.enum(["ollama", "openai"]),
      model: z.string(),
      temperature: z.number().min(0).max(1).default(0.1),
    })
    .optional()
    .default({
      provider: "ollama",
      model: "llama3.1",
      temperature: 0.1,
    }),

  review: z
    .object({
      confidenceThreshold: z.number().min(0).max(1).default(0.6),
      maxSignals: z.number().int().positive().default(10),
    })
    .optional()
    .default({
      confidenceThreshold: 0.6,
      maxSignals: 10,
    }),

  rules: z
    .object({
      enable: z.array(z.string()).default([]),
      severityOverrides: z.record(z.string(), SeverityEnum).default({}),
    })
    .optional()
    .default({
      enable: [],
      severityOverrides: {},
    }),

  rag: z
    .object({
      enabled: z.boolean().default(false),
      maxChunks: z.number().int().positive().default(5),
    })
    .optional()
    .default({
      enabled: false,
      maxChunks: 5,
    }),

  git: z
    .object({
      baseBranch: z.string(),
    })
    .optional()
    .default({
      baseBranch: "main",
    }),
});

export type PrsenseConfig = z.infer<typeof PrsenseConfigSchema>;
