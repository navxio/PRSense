// apps/cli/src/commands/index.ts
import { Command } from "commander";
import { runIndexWorkflow, listIndexedRepositories } from "@prsense/workflows";
import { createPinoLogger, logEvent, LogLevel } from "@prsense/logging";
import { createEventBus, CoreEvents } from "@prsense/core";
import {
  resolveEnvironment,
  issuesFor,
  INDEX_PREFIXES,
  validateEnvironment,
} from "@prsense/config";
import { buildServices } from "../composition.js";

import { createSpinnerRenderer } from "../ui/spinnerRenderer.js";
import { eventToCliTask } from "../ui/eventToTask.js";
import {
  stdoutConfigReporter,
  stdoutIndexedReposReporter,
} from "@prsense/reporters";
import { applyOverrides, buildOverrides } from "../shared/configOverride.js";
import { classifyTarget } from "../shared/classifyTarget.js";

import pkg from "../../package.json" with { type: "json" };

const PRSENSE_VERSION = pkg.version;

function makeEventBus(renderer: ReturnType<typeof createSpinnerRenderer>) {
  const logger = createPinoLogger({
    level: (process.env.PRSENSE_LOG_LEVEL ?? "warn") as LogLevel,
    pretty: true,
  });
  return createEventBus((event) => {
    logEvent(logger, event);
    const mapped = eventToCliTask(event);
    if (!mapped) return;
    if (mapped.kind === "start") renderer.start(mapped.task);
    else if (mapped.kind === "update") renderer.update(mapped.task);
    else renderer.finish(mapped.task);
  });
}

const listCommand = new Command("list")
  .description("List indexed repositories")
  .action(async () => {
    const services = buildServices();
    try {
      const repos = await listIndexedRepositories(services.metadataRepo);
      await stdoutIndexedReposReporter.report(repos);
    } finally {
      services.close();
    }
  });

const runCommand = new Command("index")
  .argument("[target]", "Path or GitHub/GitLab/Codeberg URL", ".")
  .option("-c, --chunk-size-chars <n>", "Override chunk size (characters)")
  .option("-o, --chunk-overlap-chars <n>", "Chunk overlap chars")
  .option(
    "-p, --embeddings-provider <provider>",
    "LLM provider for generating embeddings",
  )
  .option(
    "-m, --embeddings-model <model>",
    "Canonical model name to use for generating embeddings",
  )
  .option("-f, --force", "Rebuild the index from scratch")
  .option("-d, --dry-run", "Show what would be indexed without writing")
  .option("-s, --stats", "Print indexing statistics after completion")
  .action(async (target, options) => {
    const renderer = createSpinnerRenderer(process.stdout);
    const services = buildServices();

    try {
      const t = classifyTarget(target); // throws on bad target — caught below
      const eventBus = makeEventBus(renderer);

      eventBus.emit(CoreEvents.RunStarted, { mode: "cli", command: "index" });

      const env = resolveEnvironment("cli", {
        root: t.root,
        provider: t.provider,
      });

      if (env.issues.some((i) => i.level === "error")) {
        eventBus.emit(CoreEvents.RunFailed, { reason: "invalid-config" });
        await stdoutConfigReporter.report({ issues: env.issues });
        process.exit(1);
      }

      const overrides = buildOverrides(options);
      const effectiveConfig = applyOverrides(env.config, overrides);
      const effectiveIssues = validateEnvironment(
        effectiveConfig,
        env.credentials,
      );
      const indexConfigurationIssues = issuesFor(
        effectiveIssues,
        INDEX_PREFIXES,
      );

      if (indexConfigurationIssues.some((i) => i.level === "error")) {
        eventBus.emit(CoreEvents.RunFailed, { reason: "invalid-cli-config" });
        await stdoutConfigReporter.report({ issues: indexConfigurationIssues });
        process.exit(1);
      }

      eventBus.emit(CoreEvents.RunConfigDetermined, {
        config: effectiveConfig,
      });

      const result = await runIndexWorkflow({
        chunkRepository: services.chunkRepo,
        metadataRepository: services.metadataRepo,
        config: effectiveConfig,
        credentials: env.credentials,
        target: t,
        force: Boolean(options.force),
        dryRun: Boolean(options.dryRun),
        eventBus,
        version: PRSENSE_VERSION,
      });

      eventBus.emit(CoreEvents.RunFinished, { outcome: result.outcome });

      renderer.stop();

      if (options.dryRun) {
        const { chunksIndexed, commitSha, upToDate } = result.payload;
        console.log("\n[DRY RUN]");
        console.log("-----------------------------");
        if (upToDate) {
          console.log(
            `Index is already up to date (commit ${commitSha ?? "unknown"})`,
          );
        } else {
          console.log(`Would index approximately ${chunksIndexed} chunks`);
          console.log(`Target commit: ${commitSha ?? "unknown"}`);
        }
        console.log("\nNo changes were written.\n");
      } else if (options.stats) {
        const { chunksIndexed, commitSha, upToDate } = result.payload;
        if (upToDate) {
          console.log(`Index is up to date (commit ${commitSha ?? "unknown"})`);
        } else {
          console.log(
            `Indexed ${chunksIndexed} chunks (commit ${commitSha ?? "unknown"})`,
          );
        }
      }

      process.exit(result.outcome === "failure" ? 1 : 0);
    } catch (err) {
      renderer.stop();
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    } finally {
      services.close();
    }
  });

export const indexCommand = runCommand.addCommand(listCommand);
