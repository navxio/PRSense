// apps/daemon/src/lifecycle/start.ts
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { getDaemonStateDir, getPidFile } from "./state.js";

export async function startDaemon({ foreground }: { foreground: boolean }) {
  await fs.mkdir(getDaemonStateDir(), { recursive: true });

  let child;
  try {
    child = spawn("prsense-daemon", [], {
      detached: !foreground,
      stdio: foreground ? "inherit" : "ignore",
    });
  } catch (err) {
    console.error(
      "prsense-daemon not found. Is @prsense/daemon installed and linked?",
    );
    process.exit(1);
  }

  if (!foreground) {
    child.unref();
    await fs.writeFile(getPidFile(), String(child.pid));
    console.log("PRSense daemon started");
  }
}
