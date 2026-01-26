// packages/llm/src/providers/claude.ts
import Anthropic from "@anthropic-ai/sdk";
import { LlmClient, LlmRequest, LlmResponse } from "../types.js";
import { LlmError } from "../types.js";

export function createClaudeClient(config: {
  apiKey: string;
  model: string;
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
          .filter((c): c is { type: "text"; text: string } => c.type === "text")
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
