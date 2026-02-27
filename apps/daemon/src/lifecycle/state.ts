//apps/daemon/src/lifecycle/state.ts
import path from "node:path";
import os from "node:os";

export function getDaemonStateDir() {
  const base =
    process.env.XDG_STATE_HOME ?? path.join(os.homedir(), ".local", "state");

  return path.join(base, "prsense", "daemon");
}

export function getPidFile() {
  return path.join(getDaemonStateDir(), "daemon.pid");
}
