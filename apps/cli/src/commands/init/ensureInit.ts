import { configExists } from "@prsense/core";
import { runFirstTimeSetup } from "./runFirstTimeSetup.js";

export async function ensureInit() {
  if (!configExists()) {
    console.log("\n⚡ No PRSense config found\n");
    await runFirstTimeSetup();
  }
}
