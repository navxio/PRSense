import path from "node:path";
import { existsSync } from "node:fs";

import type { RuntimeConfig } from "./schema.js";
import type {
  ResolvedConfig,
  CliResolvedConfig,
  DaemonResolvedConfig,
  PlatformDeliveryChannel,
} from "./types.js";

/* -------------------------------------------------- */
/* Database resolution                                */
/* -------------------------------------------------- */

function resolveDatabase() {
  const url = process.env.PRSENSE_DATABASE_URL;

  if (url) {
    return {
      url,
      mode: "external" as const,
    };
  }

  return {
    url: "postgresql://prsense:prsense@localhost:10000/prsense_dev",
    mode: "bundled" as const,
  };
}

/* -------------------------------------------------- */
/* Delivery resolution                                */
/* -------------------------------------------------- */

function resolveDelivery(runtime: RuntimeConfig) {
  if (!runtime.delivery) return undefined;

  return {
    platform: runtime.delivery.platform as PlatformDeliveryChannel,
    other: runtime.delivery.other ?? [],
  };
}

/* -------------------------------------------------- */
/* Main builder                                       */
/* -------------------------------------------------- */

export function buildResolvedConfig(
  runtime: RuntimeConfig,
  mode: "cli" | "daemon",
  repository: { root: string; provider: "github" | "gitlab" | "filesystem" },
): ResolvedConfig {
  const database = resolveDatabase();

  const base = {
    repository,
    index: runtime.index,
    review: runtime.review,
    context: runtime.context,
    llm: runtime.llm,
    embeddings: runtime.embeddings,
    database,
  };

  if (mode === "cli") {
    const resolved: CliResolvedConfig = {
      ...base,
      mode: "cli",
    };

    return resolved;
  }

  const delivery = resolveDelivery(runtime);

  const resolved: DaemonResolvedConfig = {
    ...base,
    mode: "daemon",
    delivery: delivery!,
  };

  return resolved;
}
