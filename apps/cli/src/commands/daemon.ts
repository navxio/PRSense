// apps/cli/src/commands/daemon/index.ts
import { Command } from "commander";
import { createRequire } from "node:module";
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
  .option(
    "--delivery <provider>",
    "Run the daemon with configured delivery provider",
  )
  .action(async (opts) => {
    ensureStateDir();

    if (fs.existsSync(PID_FILE)) {
      const pid = Number(fs.readFileSync(PID_FILE, "utf8"));

      if (isProcessRunning(pid)) {
        console.log("Daemon already running.");
        return;
      }

      fs.unlinkSync(PID_FILE);
    }

    const require = createRequire(import.meta.url);
    const daemonBin = require.resolve("@prsense/daemon/dist/index.js");

    const logFile = path.join(STATE_DIR, "daemon.log");

    const child = spawn(process.execPath, [daemonBin], {
      detached: !opts.foreground,
      cwd: process.cwd(),
      stdio: opts.foreground
        ? "inherit"
        : ["ignore", fs.openSync(logFile, "a"), fs.openSync(logFile, "a")],
    });

    if (!opts.foreground) {
      child.unref();
      fs.writeFileSync(PID_FILE, String(child.pid));

      // wait for daemon health
      for (let i = 0; i < 15; i++) {
        await new Promise((r) => setTimeout(r, 200));

        if (await checkHealth()) {
          console.log("Daemon started.");
          return;
        }

        if (!isProcessRunning(child.pid!)) {
          console.error("Daemon failed to start. See logs:");
          console.error(logFile);
          fs.unlinkSync(PID_FILE);
          return;
        }
      }

      console.error("Daemon did not become healthy.");
      console.error("Check logs:", logFile);
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
