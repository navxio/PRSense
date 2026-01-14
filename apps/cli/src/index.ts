#!/usr/bin/env node
import { Command } from "commander";
import { reviewCommand } from "./commands/review.js";

const program = new Command();

program
  .name("prsense")
  .description("PRsense – signal-based pull request reviews")
  .version("0.1.0");

program.addCommand(reviewCommand);

program.parse(process.argv);
