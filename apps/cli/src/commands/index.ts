import { Command } from "commander";
import path from "node:path";

import { runIndexWorkflow, listIndexedRepositories } from "@prsense/workflows";
import { createPinoLogger, logEvent, LogLevel } from "@prsense/logging";
import { createEventBus, CoreEvents } from "@prsense/core";
import { resolveEnvironment } from "@prsense/config";

import { createSpinnerRenderer } from "../ui/spinnerRenderer.js";
import { eventToCliTask } from "../ui/eventToTask.js";
import {
  stdoutConfigReporter,
  stdoutIndexedReposReporter,
} from "@prsense/reporters";

import pkg from "../../package.json" with { type: "json" };

const PRSENSE_VERSION = pkg.version;

export const indexCommand = new Command("index")
  .argument("[target]", "Path or GitHub/GitLab URL", ".")
  .option("--force", "Rebuild the index from scratch")
  .option("--dry-run", "Show what would be indexed without writing")
  .option("--stats", "Print indexing statistics after completion")
  .option("--chunk-size-chars <n>", "Override chunk size (characters)")
  .option("--chunk-overlap-chars <n>", "Chunk overlap chars")
  .option("--max-file-size-bytes <n>", "Chunk overlap chars")
  .option("--list", "List indexed repositories")
  .action(async (target, options) => {
    try {
      /* ------------------------------------------------- */
      /* Load Config                                       */
      /* ------------------------------------------------- */

      const logger = createPinoLogger({
        level: (process.env.PRSENSE_LOG_LEVEL ?? "warn") as LogLevel,
        pretty: true,
      });

      const renderer = createSpinnerRenderer(process.stdout);

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
      const resolved = env.config;

      /* ------------------------------------------------- */
      /* CLI Overrides (Before Resolve)                    */
      /* ------------------------------------------------- */

      if (options.list) {
        const repos = await listIndexedRepositories(resolved);

        await stdoutIndexedReposReporter.report(repos);
        eventBus.emit(CoreEvents.RunFinished);

        return;
      }

      if (env.issues.some((i) => i.level === "error")) {
        eventBus.emit(CoreEvents.RunFailed, {
          reason: "invalid-config",
        });

        await stdoutConfigReporter.report({ issues: env.issues });
        process.exit(1);
      }

      /* ------------------------------------------------- */
      /* Run Workflow                                      */
      /* ------------------------------------------------- */

      const result = await runIndexWorkflow({
        config: resolved,
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

      /* ------------------------------------------------- */
      /* Optional Stats                                    */
      /* ------------------------------------------------- */

      if (options.stats) {
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
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
