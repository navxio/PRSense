//apps/daemon/src/lifecycle/stop.ts
import fs from "node:fs/promises";
import process from "node:process";
import { getPidFile } from "./state.js";

export async function stopDaemon() {
  const pid = Number(await fs.readFile(getPidFile(), "utf8"));

  process.kill(pid, "SIGTERM");

  await fs.unlink(getPidFile());
  console.log("PRsense daemon stopped");
}
