// packages/runtime-config/src/resolveConfig.ts

import type { EnvConfig, UserConfig } from "@prsense/config";
import type {
  ResolvedConfig,
  CliResolvedConfig,
  DaemonResolvedConfig,
} from "./ResolvedConfig.js";

const DEFAULT_DB_URL =
  "postgresql://prsense:prsense@localhost:10000/prsense_dev?sslmode=disable";

export type ResolveConfigInput = {
  mode: "cli" | "daemon";
  repoRoot: string;
  repoProvider: "github" | "gitlab" | "filesystem";
  user: UserConfig;
  env: EnvConfig;
};

export function resolveConfig(input: ResolveConfigInput): ResolvedConfig {
  const { mode, repoRoot, repoProvider, user, env } = input;

  /* ------------------------------ */
  /* Shared Base Config             */
  /* ------------------------------ */

  const base = {
    repository: {
      root: repoRoot,
      provider: repoProvider,
    },

    review: {
      confidenceThreshold: user.review?.confidenceThreshold ?? 0.6,
      maxSignals: user.review?.maxSignals ?? 10,
    },

    index: {
      chunkSizeChars: user.index?.chunkSizeChars ?? 1000,
      chunkOverlapChars: user.index?.chunkOverlapChars ?? 200,
      maxFileSizeBytes: user.index?.maxFileSizeBytes ?? 1_000_000,
    },

    context: {
      maxChunks: user.context?.maxChunks ?? 5,
    },

    llm: {
      provider: user.llm?.provider ?? "ollama",
      model: user.llm?.model ?? "qwen2.5-coder",
      temperature: user.llm?.temperature ?? 0.1,
    },

    embeddings: {
      provider: user.embeddings?.provider ?? "ollama",
      model: user.embeddings?.model ?? "nomic-embed-text",
    },

    database: env.PRSENSE_DATABASE_URL
      ? {
          url: env.PRSENSE_DATABASE_URL,
          mode: "external" as const,
        }
      : {
          url: DEFAULT_DB_URL,
          mode: "bundled" as const,
        },
  };

  /* ------------------------------ */
  /* Mode-Specific Branching        */
  /* ------------------------------ */

  if (mode === "cli") {
    const cliConfig: CliResolvedConfig = {
      mode: "cli",
      ...base,
    };

    return cliConfig;
  } else {
    // daemon mode
    const inferredVcs =
      user.delivery?.vcs ??
      (repoProvider === "github" || repoProvider === "gitlab"
        ? repoProvider
        : undefined);

    if (!inferredVcs) {
      throw new Error(
        "Daemon mode requires an explicit VCS delivery channel (github or gitlab).",
      );
    }

    const daemonConfig: DaemonResolvedConfig = {
      mode: "daemon",
      ...base,
      delivery: {
        vcs: inferredVcs,
        other: user.delivery?.other ?? [],
      },
    };

    return daemonConfig;
  }
}
