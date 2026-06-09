import { Command } from "commander";
import path from "node:path";

import { runIndexWorkflow, listIndexedRepositories } from "@prsense/workflows";
import { createPinoLogger, logEvent, LogLevel } from "@prsense/logging";
import { createEventBus, CoreEvents } from "@prsense/core";
import { resolveEnvironment, issuesFor, INDEX_PREFIXES } from "@prsense/config";
import { buildServices } from "../composition.js";

import { createSpinnerRenderer } from "../ui/spinnerRenderer.js";
import { eventToCliTask } from "../ui/eventToTask.js";
import {
  stdoutConfigReporter,
  stdoutIndexedReposReporter,
} from "@prsense/reporters";
import { applyOverrides, buildOverrides } from "../shared/configOverride.js";

import pkg from "../../package.json" with { type: "json" };

const PRSENSE_VERSION = pkg.version;

export const indexCommand = new Command("index")
  .argument("[target]", "Path or GitHub/GitLab URL", ".")
  .option("-f, --force", "Rebuild the index from scratch")
  .option("-d, --dry-run", "Show what would be indexed without writing")
  .option("-s, --stats", "Print indexing statistics after completion")
  .option("-c, --chunk-size-chars <n>", "Override chunk size (characters)")
  .option("-o, --chunk-overlap-chars <n>", "Chunk overlap chars")
  .option("-l, --list", "List indexed repositories")
  .option(
    "-p, --embeddings-provider <provider>",
    "LLM provider for generating embeddings",
  )
  .option(
    "-m, --embeddings-model <model>",
    "Canonical model name to use for generating embeddings",
  )
  .action(async (target, options) => {
    const renderer = createSpinnerRenderer(process.stdout);
    const services = buildServices();
    try {
      /* ------------------------------------------------- */
      /* Load Config                                       */
      /* ------------------------------------------------- */

      const logger = createPinoLogger({
        level: (process.env.PRSENSE_LOG_LEVEL ?? "warn") as LogLevel,
        pretty: true,
      });

      const eventBus = createEventBus((event) => {
        logEvent(logger, event);

        const mapped = eventToCliTask(event);
        if (!mapped) return;

        if (mapped.kind === "start") {
          renderer.start(mapped.task);
        } else if (mapped.kind === "update") {
          renderer.update(mapped.task);
        } else {
          renderer.finish(mapped.task);
        }
      });

      eventBus.emit(CoreEvents.RunStarted, {
        mode: "cli",
        command: "index",
      });

      /* ------------------------------------------------- */
      /* Determine Repository Provider                     */
      /* ------------------------------------------------- */

      const isGithub = /github\.com/.test(target);
      const isGitlab = /gitlab\.com/.test(target);

      const repoProvider = isGithub
        ? "github"
        : isGitlab
          ? "gitlab"
          : "filesystem";

      const repoRoot =
        repoProvider === "filesystem" ? path.resolve(target) : target;

      const env = resolveEnvironment("cli", {
        root: repoRoot,
        provider: repoProvider,
      });

      if (env.issues.some((i) => i.level === "error")) {
        eventBus.emit(CoreEvents.RunFailed, {
          reason: "invalid-config",
        });

        await stdoutConfigReporter.report({ issues: env.issues });
        process.exit(1);
      }

      /* ------------------------------------------------- */
      /* CLI Overrides (Before Resolve)                    */
      /* ------------------------------------------------- */

      const overrides = buildOverrides(options);
      const effectiveConfig = applyOverrides(env.config, overrides);

      const indexConfigurationIssues = issuesFor(env.issues, INDEX_PREFIXES);

      if (indexConfigurationIssues.some((i) => i.level === "error")) {
        eventBus.emit(CoreEvents.RunFailed, {
          reason: "invalid-cli-config",
        });

        await stdoutConfigReporter.report({ issues: indexConfigurationIssues });
        process.exit(1);
      }
      if (options.list) {
        const repos = await listIndexedRepositories(services.metadataRepo);

        await stdoutIndexedReposReporter.report(repos);
        eventBus.emit(CoreEvents.RunFinished);

        return;
      }

      /* ------------------------------------------------- */
      /* Run Workflow                                      */
      /* ------------------------------------------------- */

      const result = await runIndexWorkflow({
        chunkRepository: services.chunkRepo,
        metadataRepository: services.metadataRepo,
        config: effectiveConfig,
        credentials: env.credentials,
        target,
        force: Boolean(options.force),
        dryRun: Boolean(options.dryRun),
        eventBus,
        version: PRSENSE_VERSION,
      });

      eventBus.emit(CoreEvents.RunFinished, {
        outcome: result.outcome,
      });

      /*
       *
       * dry run
       */
      if (options.dryRun) {
        const { chunksIndexed, commitSha, upToDate } = result.payload;

        renderer.stop();
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
      }

      /* ------------------------------------------------- */
      /* Optional Stats                                    */
      /* ------------------------------------------------- */

      renderer.stop();
      if (options.stats && !options.dryRun) {
        const { chunksIndexed, commitSha, upToDate } = result.payload;

        if (upToDate) {
          console.log(`Index is up to date (commit ${commitSha ?? "unknown"})`);
        } else {
          console.log(
            `Indexed ${chunksIndexed} chunks (commit ${commitSha ?? "unknown"})`,
          );
        }
      }

      renderer.stop();
      process.exit(result.outcome === "failure" ? 1 : 0);
    } catch (err) {
      renderer.stop();
      console.error(err instanceof Error ? err.message : String(err));

      process.exit(1);
    } finally {
      services.close();
    }
  });
