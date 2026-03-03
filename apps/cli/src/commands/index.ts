import { Command } from "commander";
import path from "node:path";

import { runIndexWorkflow } from "@prsense/workflows";
import { createPinoLogger, logEvent } from "@prsense/logging";
import { createEventBus, CoreEvents } from "@prsense/core";
import {
  resolveConfig,
  validateResolvedConfig,
  buildCredentialContext,
  validateCredentialContext,
} from "@prsense/runtime-config";
import {
  loadGlobalConfig,
  loadRepoConfig,
  mergeUserConfigs,
  loadEnvConfig,
} from "@prsense/config";

import { createSpinnerRenderer } from "../ui/spinnerRenderer.js";
import { eventToCliTask } from "../ui/eventToTask.js";
import { stdoutConfigReporter } from "@prsense/reporters";

export const indexCommand = new Command("index")
  .argument("[target]", "Path or GitHub/GitLab URL", ".")
  .option("--force", "Rebuild the index from scratch")
  .option("--dry-run", "Show what would be indexed without writing")
  .option("--stats", "Print indexing statistics after completion")
  .option("--chunk-size <n>", "Override chunk size (characters)")
  .action(async (target, options) => {
    try {
      /* ------------------------------------------------- */
      /* Load Config                                       */
      /* ------------------------------------------------- */

      const globalConfig = loadGlobalConfig();
      const repoConfig = loadRepoConfig(process.cwd());
      const user = mergeUserConfigs(globalConfig, repoConfig);
      const env = loadEnvConfig();

      const logger = createPinoLogger({
        level: env.PRSENSE_LOG_LEVEL,
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

      /* ------------------------------------------------- */
      /* CLI Overrides (Before Resolve)                    */
      /* ------------------------------------------------- */

      let effectiveUser = user;

      if (options.chunkSize) {
        const chunkSize = Number(options.chunkSize);
        if (Number.isNaN(chunkSize) || chunkSize <= 0) {
          console.error("--chunk-size must be a positive number");
          process.exit(1);
        }

        effectiveUser = {
          ...user,
          index: {
            ...user.index,
            chunkSizeChars: chunkSize,
          },
        };
      }

      /* ------------------------------------------------- */
      /* Resolve Config                                    */
      /* ------------------------------------------------- */

      const resolved = resolveConfig({
        mode: "cli",
        repoRoot,
        repoProvider,
        user: effectiveUser,
        env,
      });

      /* ------------------------------------------------- */
      /* Credentials + Validation                          */
      /* ------------------------------------------------- */

      const credentials = buildCredentialContext(env);

      const domainValidation = validateResolvedConfig(resolved);
      const credentialIssues = validateCredentialContext(resolved, credentials);

      const issues = [...domainValidation.issues, ...credentialIssues];

      if (issues.some((i) => i.level === "error")) {
        eventBus.emit(CoreEvents.RunFailed, {
          reason: "invalid-config",
        });

        await stdoutConfigReporter.report({ issues });
        process.exit(1);
      }

      /* ------------------------------------------------- */
      /* Run Workflow                                      */
      /* ------------------------------------------------- */

      const result = await runIndexWorkflow({
        config: resolved,
        credentials,
        target,
        force: Boolean(options.force),
        dryRun: Boolean(options.dryRun),
        eventBus,
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
