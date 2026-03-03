// apps/cli/src/commands/daemon/index.ts
import { Command } from "commander";

const daemonCommand = new Command("daemon").description(
  "Manage the PRsense daemon",
);

daemonCommand
  .command("start")
  .option("--foreground", "Run in foreground")
  .action((opts) => console.log("start"));

daemonCommand.command("stop").action(() => console.log("stop"));

daemonCommand.command("status").action(() => console.log("status"));

export default daemonCommand;
