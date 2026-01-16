import { Command } from "commander";
import { reviewCommand } from "./commands/review.js";
import { indexCommand } from "./commands/index.js";
import { doctorCommand } from "./commands/doctor.js";

export const program = new Command()
  .name("prsense")
  .description("PRsense – signal-based pull request reviews")
  .version("0.1.0");

program.addCommand(reviewCommand);
program.addCommand(indexCommand);
program.addCommand(doctorCommand);
