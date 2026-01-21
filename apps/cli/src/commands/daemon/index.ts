// apps/cli/src/commands/daemon/index.ts
import { Command } from "commander";
import { startDaemon } from "./start.js";
import { stopDaemon } from "./stop.js";
import { daemonStatus } from "./status.js";

const daemonCommand = new Command("daemon").description(
  "Manage the PRsense daemon",
);

daemonCommand
  .command("start")
  .option("--foreground", "Run in foreground")
  .action((opts) => startDaemon(opts));

daemonCommand.command("stop").action(() => stopDaemon());

daemonCommand.command("status").action(() => daemonStatus());

export default daemonCommand;
