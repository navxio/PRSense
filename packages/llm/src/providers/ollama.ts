import fetch from "node-fetch";
import { LlmClient, LlmRequest, LlmResponse, OllamaConfig } from "../types.js";

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
          prompt: `${prompt.system}\n\n${prompt.user}`,
          stream: false,
        }),
      });

      if (!res.ok) {
        throw new Error(`Ollama error: ${res.statusText}`);
      }

      const json = (await res.json()) as { response: string };

      return { text: json.response };
    },
  };
}
