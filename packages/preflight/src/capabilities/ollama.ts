// packages/preflight/src/capabilities/ollama.ts
import { execFileSync } from "node:child_process";
import type { Capability } from "../types.js";

const OLLAMA_URL = "http://localhost:11434";

export const ollamaCapability: Capability = {
  id: "ollama",
  description: "Ollama service reachable",

  async check() {
    // 1️⃣ Check if ollama binary exists
    try {
      execFileSync("ollama", ["--version"], {
        stdio: "ignore",
      });
    } catch {
      return {
        kind: "partial",
        reason: "`ollama` command not found in PATH",
      };
    }

    // 2️⃣ Check if daemon is reachable
    let res: Response;
    try {
      res = await fetch(`${OLLAMA_URL}/api/tags`);
    } catch {
      return {
        kind: "partial",
        reason: "Ollama daemon is not running or not reachable",
      };
    }

    // 3️⃣ Check API health
    if (!res.ok) {
      return {
        kind: "partial",
        reason: `Ollama API returned ${res.status}`,
      };
    }

    return { kind: "ready" };
  },

  // apply could be added later (e.g. `ollama serve`)
};
