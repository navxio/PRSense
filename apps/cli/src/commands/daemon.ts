// apps/cli/src/commands/daemon/index.ts
import { Command } from "commander";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";

const STATE_DIR = path.join(os.homedir(), ".local", "state", "prsense");
const PID_FILE = path.join(STATE_DIR, "daemon.pid");
const DAEMON_PORT = 3000;

function ensureStateDir() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function checkHealth(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(
      {
        hostname: "127.0.0.1",
        port: DAEMON_PORT,
        path: "/health",
        timeout: 1000,
      },
      (res) => {
        resolve(res.statusCode === 200);
      },
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

const daemonCommand = new Command("daemon").description(
  "Manage the PRsense daemon",
);

daemonCommand
  .command("start")
  .option("--foreground", "Run in foreground")
  .action(async (opts) => {
    ensureStateDir();

    if (fs.existsSync(PID_FILE)) {
      const pid = Number(fs.readFileSync(PID_FILE, "utf8"));
      if (isProcessRunning(pid)) {
        console.log("Daemon already running.");
        return;
      }
    }

    const child = spawn("prsense-daemon", [], {
      detached: !opts.foreground,
      stdio: opts.foreground ? "inherit" : "ignore",
    });

    if (!opts.foreground) {
      child.unref();
      fs.writeFileSync(PID_FILE, String(child.pid));
      console.log("Daemon started.");
    }
  });

daemonCommand.command("stop").action(() => {
  if (!fs.existsSync(PID_FILE)) {
    console.log("Daemon not running.");
    return;
  }

  const pid = Number(fs.readFileSync(PID_FILE, "utf8"));

  try {
    process.kill(pid, "SIGTERM");
    fs.unlinkSync(PID_FILE);
    console.log("Daemon stopped.");
  } catch {
    console.log("Failed to stop daemon.");
  }
});

daemonCommand.command("status").action(async () => {
  if (!fs.existsSync(PID_FILE)) {
    console.log("Daemon not running.");
    return;
  }

  const pid = Number(fs.readFileSync(PID_FILE, "utf8"));

  if (!isProcessRunning(pid)) {
    console.log("Daemon not running (stale PID).");
    return;
  }

  const healthy = await checkHealth();

  if (healthy) {
    console.log("Daemon is running and healthy.");
  } else {
    console.log("Daemon process running but health check failed.");
  }
});

export default daemonCommand;
