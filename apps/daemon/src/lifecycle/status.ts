//apps/daemon/src/lifecycle/status.ts
import fs from "node:fs/promises";
import process from "node:process";
import { getPidFile } from "./state.js";

export async function daemonStatus() {
  try {
    const pid = Number(await fs.readFile(getPidFile(), "utf8"));
    process.kill(pid, 0);
    console.log(`PRsense daemon is running (PID ${pid})`);
  } catch {
    console.log("PRsense daemon is not running");
  }
}
