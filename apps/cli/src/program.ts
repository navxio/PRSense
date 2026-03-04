import { Command } from "commander";
import { reviewCommand } from "./commands/review.js";
import { indexCommand } from "./commands/index.js";
import { doctorCommand } from "./commands/doctor.js";
import { setupCommand } from "./commands/setup.js";
import { configCommand } from "./commands/config.js";
import { PRSENSE_VERSION } from "./version.js";

export const program = new Command()
  .name("prsense")
  .description("PRsense – signal-based pull request reviews")
  .version(PRSENSE_VERSION);

program.addCommand(reviewCommand);
program.addCommand(indexCommand);
program.addCommand(doctorCommand);
program.addCommand(setupCommand);
program.addCommand(configCommand);
