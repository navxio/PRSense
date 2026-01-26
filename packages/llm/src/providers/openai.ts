// packages/llm/src/providers/openai.ts
import OpenAI from "openai";
import { LlmClient, LlmRequest, LlmResponse } from "../types.js";
import { LlmError } from "../types.js";

export function createOpenAiClient(config: {
  apiKey: string;
  model: string;
  baseUrl?: string;
}): LlmClient {
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl, // optional, supports Azure / gateways
  });

  return {
    async generate(req: LlmRequest): Promise<LlmResponse> {
      const { prompt, temperature = 0 } = req;

      try {
        const res = await client.chat.completions.create({
          model: config.model,
          temperature,
          messages: [
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.user },
          ],
        });

        const text = res.choices[0]?.message?.content;

        if (!text) {
          throw new Error("OpenAI returned empty response");
        }

        return { text };
      } catch (err) {
        throw new LlmError("OpenAI request failed", err);
      }
    },
  };
}
