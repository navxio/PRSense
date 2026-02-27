// apps/cli/src/commands/daemon/index.ts
import { Command } from "commander";
import { startDaemon, stopDaemon, daemonStatus } from "@prsense/daemon";

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
