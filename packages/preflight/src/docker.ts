import { execSync } from "node:child_process";
import type { Capability, CapabilityStatus } from "./types.js";

function checkDockerAvailable(): CapabilityStatus {
  try {
    execSync("docker info", { stdio: "ignore" });
    return { kind: "ready" };
  } catch {
    return {
      kind: "missing",
      reason: "Docker is not installed or the daemon is not running",
    };
  }
}

export const dockerCapability: Capability = {
  id: "docker",
  description: "Docker is available",

  async check() {
    return checkDockerAvailable();
  },

  async apply() {
    throw new Error(
      "Docker must be installed manually. See https://docs.docker.com/get-docker/",
    );
  },
};
