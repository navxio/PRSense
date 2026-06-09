import { Command } from "commander";
import { reviewCommand } from "./commands/review.js";
import { indexCommand } from "./commands/index.js";
import { doctorCommand } from "./commands/doctor.js";
import { initCommand } from "./commands/init/init.js";
import { hookCommand } from "./commands/hook.js";
import { configCommand } from "./commands/config.js";
import pkg from "../package.json" with { type: "json" };

const PRSENSE_VERSION = pkg.version;

export const program = new Command()
  .name("prsense")
  .description("Code Reviews grounded in diff")
  .version(PRSENSE_VERSION);

program.addCommand(reviewCommand);
program.addCommand(indexCommand);
program.addCommand(doctorCommand);
program.addCommand(initCommand);
program.addCommand(hookCommand);
program.addCommand(configCommand);
