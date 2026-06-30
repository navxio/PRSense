// packages/llm/src/providers/ollama.ts
import fetch from "node-fetch";
import {
  LlmClient,
  LlmRequest,
  LlmResponse,
  OllamaConfig,
  LlmUsage,
} from "../types.js";

type OllamaResponse = {
  response: string;
  prompt_eval_count?: number;
  eval_count?: number;
};

// Local models frequently wrap JSON in a markdown code fence despite the
// "Return ONLY JSON" instruction. Strip a leading/enclosing fence so the
// downstream JSON.parse sees raw JSON. No fence -> returned trimmed as-is.
function stripCodeFence(text: string): string {
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i);
  if (fenced && fenced[1] !== undefined) return fenced[1].trim();
  return text.trim();
}

export function createOllamaClient(config: OllamaConfig): LlmClient {
  const baseUrl = config.baseUrl ?? "http://localhost:11434";
  return {
    async generate(req: LlmRequest): Promise<LlmResponse> {
      const { prompt } = req;
      const res = await fetch(`${baseUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          prompt: `
${prompt.system}
### REVIEW INPUT START ###
${prompt.user}
### REVIEW INPUT END ###
Remember:
Return ONLY JSON.
`,
          stream: false,
          options: {
            temperature: config.temperature ?? 0.1,
            top_p: 0.9,
          },
        }),
      });
      if (!res.ok) {
        throw new Error(`Ollama error: ${res.statusText}`);
      }
      const json = (await res.json()) as OllamaResponse;
      const text = stripCodeFence(json.response);
      const usage: LlmUsage | undefined =
        json.prompt_eval_count !== undefined && json.eval_count !== undefined
          ? {
              promptTokens: json.prompt_eval_count,
              completionTokens: json.eval_count,
              totalTokens: json.prompt_eval_count + json.eval_count,
            }
          : undefined;
      if (usage) {
        return {
          text,
          usage,
        };
      }
      return {
        text,
      };
    },
  };
}
