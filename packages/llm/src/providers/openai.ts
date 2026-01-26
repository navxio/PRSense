//packages/llm/src/providers/openai.ts
import fetch from "node-fetch";
import { LlmClient, LlmRequest, LlmResponse } from "../types.js";

export function createOpenAiClient(opts: {
  apiKey: string;
  model: string;
  baseUrl?: string;
}): LlmClient {
  const baseUrl = opts.baseUrl ?? "https://api.openai.com/v1";

  return {
    async generate(req: LlmRequest): Promise<LlmResponse> {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${opts.apiKey}`,
        },
        body: JSON.stringify({
          model: opts.model,
          messages: [
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.user },
          ],
          temperature: 0,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`OpenAI error (${res.status}): ${body}`);
      }

      const json = (await res.json()) as {
        choices?: Array<{
          message?: { content?: string };
        }>;
      };

      const text = json.choices?.[0]?.message?.content;

      if (!text) {
        throw new Error("OpenAI returned empty response");
      }

      return { text };
    },
  };
}
