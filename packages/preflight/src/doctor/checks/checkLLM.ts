import { loadEnvConfig, loadUserConfig } from "@prsense/config";
import { DoctorCheckResult } from "../types.js";

export async function checkLLM(): Promise<DoctorCheckResult> {
  try {
    const user = loadUserConfig(process.cwd());
    const env = loadEnvConfig(process.env);

    if (user.llm.provider === "ollama") {
      const host = env.PRSENSE_OLLAMA_HOST;
      if (!host) {
        return {
          status: "fail",
          name: "LLM provider (ollama)",
          message: "PRSENSE_OLLAMA_HOST is not set",
          fix: "Set PRSENSE_OLLAMA_HOST to your Ollama endpoint",
        };
      }

      const res = await fetch(`${host}/api/tags`);
      if (!res.ok) throw new Error("Ollama not reachable");

      return { status: "ok", name: "LLM provider (ollama)" };
    }

    if (user.llm.provider === "openai") {
      if (!env.PRSENSE_OPENAI_API_KEY) {
        return {
          status: "fail",
          name: "LLM provider (openai)",
          message: "Missing OpenAI API key",
          fix: "Set PRSENSE_OPENAI_API_KEY",
        };
      }

      return { status: "ok", name: "LLM provider (openai)" };
    }

    return {
      status: "warn",
      name: "LLM provider",
      message: "Unknown LLM provider configured",
    };
  } catch (err) {
    return {
      status: "fail",
      name: "LLM provider",
      message: err instanceof Error ? err.message : "LLM check failed",
    };
  }
}
