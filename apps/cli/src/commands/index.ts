import { Command } from "commander";
import { runIndexWorkflow } from "@prsense/workflows";
import { createPinoLogger, logEvent } from "@prsense/logging";
import { createEventBus, CoreEvents } from "@prsense/core";
import {
  validateResolvedConfig,
  buildCredentialContext,
} from "@prsense/runtime-config";
import { loadUserConfig, loadEnvConfig } from "@prsense/config";
import { resolveConfig } from "../resolveConfig.js";
import { createSpinnerRenderer } from "../ui/spinnerRenderer.js";
import { eventToCliTask } from "../ui/eventToTask.js";
import { stdoutConfigReporter } from "../reporting/stdoutConfigReporter.js";

export const indexCommand = new Command("index")
  .argument("[target]", "Path or GitHub URL", ".")
  .option("--force", "Rebuild the index from scratch")
  .option("--dry-run", "Show what would be indexed without writing")
  .option("--stats", "Print indexing statistics after completion")
  .option("--chunk-size <n>", "Chunk size (lines)")
  .action(async (path, options) => {
    const logLevel = (process.env.PRSENSE_LOG_LEVEL as any) ?? "warn";

    const logger = createPinoLogger({
      level: logLevel,
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

    try {
      const user = loadUserConfig(process.cwd());
      const env = loadEnvConfig();

      const credentialContext = buildCredentialContext(env, {
        mode: "self-hosted",
      });

      const repoRoot = path;
      const repoProvider = "filesystem";

      const resolved = resolveConfig({
        mode: "cli",
        repoRoot,
        repoProvider,
        user,
        env,
      });

      // CLI overrides
      if (options.chunkSize) {
        const n = Number(options.chunkSize);
        if (Number.isNaN(n)) {
          console.error("chunk-size must be a number");
          process.exit(1);
        }
        resolved.context.chunkSize = n;
      }

      const validation = validateResolvedConfig(resolved, credentialContext);

      if (!validation.valid) {
        eventBus.emit(CoreEvents.RunFailed, {
          reason: "invalid-config",
        });

        await stdoutConfigReporter(validation.issues);
        process.exit(1);
      }

      const result = await runIndexWorkflow({
        config: resolved,
        target: path,
        force: Boolean(options.force),
        dryRun: Boolean(options.dryRun),
        eventBus,
      });

      eventBus.emit(CoreEvents.RunFinished, {
        outcome: result.outcome,
      });

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
      eventBus.emit(CoreEvents.RunFailed, {
        error: String(err),
      });

      process.exit(1);
    }
  });
