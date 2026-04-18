import { Command } from "commander";
import { reviewCommand } from "./commands/review.js";
import { indexCommand } from "./commands/index.js";
import { doctorCommand } from "./commands/doctor.js";
import { setupCommand } from "./commands/setup.js";
import { initCommand } from "./init/init.js";
import daemonCommand from "./commands/daemon.js";
import pkg from "../package.json" with { type: "json" };

const PRSENSE_VERSION = pkg.version;

export const program = new Command()
  .name("prsense")
  .description("PRsense – signal-based pull request reviews")
  .version(PRSENSE_VERSION);

program.addCommand(reviewCommand);
program.addCommand(indexCommand);
program.addCommand(doctorCommand);
program.addCommand(setupCommand);
program.addCommand(daemonCommand);
program.addCommand(initCommand);