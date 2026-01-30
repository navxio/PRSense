// packages/preflight/src/capabilities/docker.ts
import { execFileSync } from "node:child_process";
import type { Capability } from "../types.js";

export const dockerCapability: Capability = {
  id: "docker",
  description: "Docker daemon available",

  async check(ctx) {
    // 1️⃣ Check if docker binary exists
    try {
      execFileSync("docker", ["--version"], {
        stdio: "ignore",
      });
    } catch {
      return {
        kind: "missing",
        reason: "`docker` command not found in PATH",
      };
    }

    // 2️⃣ Check if Docker daemon is reachable
    try {
      execFileSync("docker", ["info"], {
        cwd: ctx.cwd,
        stdio: "ignore",
      });
      return { kind: "ready" };
    } catch {
      return {
        kind: "missing",
        reason: "Docker daemon is not running or not accessible",
      };
    }
  },

  /**
   * Docker installation is inherently manual.
   * We expose this so setup can explain, not execute.
   */
  async apply() {
    throw new Error(
      "Docker must be installed and started manually. See https://docs.docker.com/get-docker/",
    );
  },
};
