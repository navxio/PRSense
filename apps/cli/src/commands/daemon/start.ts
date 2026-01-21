// apps/cli/src/daemon/start.ts
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { getDaemonStateDir, getPidFile } from "./state.js";

export async function startDaemon({ foreground }: { foreground: boolean }) {
  await fs.mkdir(getDaemonStateDir(), { recursive: true });

  const child = spawn(process.execPath, ["apps/daemon/dist/index.js"], {
    detached: !foreground,
    stdio: foreground ? "inherit" : "ignore",
  });

  if (!foreground) {
    child.unref();
    await fs.writeFile(getPidFile(), String(child.pid));
    console.log("PRsense daemon started");
  }
}
