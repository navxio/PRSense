// packages/llm/src/providers/anthropic.ts
import Anthropic from "@anthropic-ai/sdk";
import type { TextBlock } from "@anthropic-ai/sdk/resources/messages/messages";
import {
  LlmClient,
  LlmRequest,
  LlmResponse,
  LlmError,
  LlmUsage,
} from "../types.js";

export function createAnthropicClient(config: {
  apiKey: string;
  model: string;
  temperature?: number;
}): LlmClient {
  const client = new Anthropic({ apiKey: config.apiKey });

  return {
    async generate(req: LlmRequest): Promise<LlmResponse> {
      const { prompt, temperature = 0 } = req;

      try {
        const res = await client.messages.create({
          model: config.model,
          max_tokens: req.maxTokens ?? 4096,
          temperature,
          system: prompt.system,
          messages: [{ role: "user", content: prompt.user }],
        });

        const text = res.content
          .filter((c): c is TextBlock => c.type === "text")
          .map((c) => c.text)
          .join("\n");

        if (!text) {
          throw new Error(
            `Claude returned empty response (stopReason=${res.stop_reason ?? "?"})`,
          );
        }

        const usage: LlmUsage | undefined =
          res.usage && res.usage.input_tokens !== undefined
            ? {
                promptTokens: res.usage.input_tokens,
                completionTokens: res.usage.output_tokens ?? 0,
                totalTokens:
                  res.usage.input_tokens + (res.usage.output_tokens ?? 0),
              }
            : undefined;

        return usage ? { text, usage } : { text };
      } catch (err) {
        const detail =
          err instanceof Anthropic.APIError
            ? `${err.status ?? "?"} ${(err as any).error?.error?.type ?? ""} ${(err as any).error?.error?.message ?? err.message}`.trim()
            : err instanceof Error
              ? err.message
              : String(err);
        throw new LlmError(`Claude request failed: ${detail}`, err);
      }
    },
  };
}
