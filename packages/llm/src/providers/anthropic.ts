// packages/llm/src/providers/anthropic.ts
import Anthropic from "@anthropic-ai/sdk";
import type { TextBlock } from "@anthropic-ai/sdk/resources/messages/messages";
import { LlmClient, LlmRequest, LlmResponse, LlmError } from "../types.js";

export function createAnthropicClient(config: {
  apiKey: string;
  model: string;
  temperature?: number;
}): LlmClient {
  const client = new Anthropic({
    apiKey: config.apiKey,
  });

  return {
    async generate(req: LlmRequest): Promise<LlmResponse> {
      const { prompt, temperature = 0 } = req;

      try {
        const res = await client.messages.create({
          model: config.model,
          max_tokens: 4096,
          temperature,
          system: prompt.system,
          messages: [
            {
              role: "user",
              content: prompt.user,
            },
          ],
        });

        const text = res.content
          .filter((c): c is TextBlock => c.type === "text")
          .map((c) => c.text)
          .join("\n");

        if (!text) {
          throw new Error("Claude returned empty response");
        }

        return { text };
      } catch (err) {
        throw new LlmError("Claude request failed", err);
      }
    },
  };
}
