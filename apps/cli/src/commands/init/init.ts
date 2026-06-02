import { Command } from "commander";
import { runFirstTimeSetup } from "../init/runFirstTimeSetup.js";

export const initCommand = new Command("init")
  .description("Initialize PRSense configuration")
  .action(async (opts) => {
    await runFirstTimeSetup();
  });