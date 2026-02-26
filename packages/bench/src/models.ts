import type { ModelConfig } from "./types.js";

export const modelMatrix: ModelConfig[] = [
  { provider: "ollama", model: "qwen2.5-coder", temperature: 0.05 },
  { provider: "ollama", model: "gemma3", temperature: 0.05 },
  { provider: "ollama", model: "llama3.2", temperature: 0.05 },
];
