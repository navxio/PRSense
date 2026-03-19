// packages/bench/src/models.ts
import type { ModelConfig } from "./types.js";

export const modelMatrix: ModelConfig[] = [
  { provider: "anthropic", model: "claude-opus-4-6", temperature: 0.05 },
  { provider: "anthropic", model: "claude-sonnet-4-6", temperature: 0.05 },
  { provider: "openai", model: "gpt-5.4", temperature: 0.05 },

  { provider: "openai", model: "gpt-5.3", temperature: 0.05 },
  { provider: "google", model: "gemini-2.5-pro", temperature: 0.05 },
  { provider: "google", model: "gemini-flash-latest", temperature: 0.05 },
  { provider: "ollama", model: "qwen2.5-coder", temperature: 0.05 },
  { provider: "ollama", model: "deepseek-coder-v2", temperature: 0.05 },
];
