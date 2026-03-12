// packages/llm/src/providers/openai.ts
import OpenAI from "openai";
import {
  LlmClient,
  LlmRequest,
  LlmResponse,
  LlmError,
  LlmUsage,
} from "../types.js";

export function createOpenAiClient(config: {
  apiKey: string;
  model: string;
  temperature?: number;
  baseUrl?: string;
}): LlmClient {
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
  });

  return {
    async generate(req: LlmRequest): Promise<LlmResponse> {
      const { prompt } = req;

      const temperature = req.temperature ?? config.temperature ?? 0.05;

      try {
        const request: any = {
          model: config.model,
          temperature,
          messages: [
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.user },
          ],
        };

        if (req.maxTokens !== undefined) {
          request.max_tokens = req.maxTokens;
        }

        const res = await client.chat.completions.create(request);

        const text = res.choices[0]?.message?.content;

        if (!text) {
          throw new Error("OpenAI returned empty response");
        }

        const usage: LlmUsage | undefined =
          res.usage && res.usage.prompt_tokens !== undefined
            ? {
                promptTokens: res.usage.prompt_tokens,
                completionTokens: res.usage.completion_tokens ?? 0,
                totalTokens:
                  res.usage.total_tokens ??
                  res.usage.prompt_tokens + (res.usage.completion_tokens ?? 0),
              }
            : undefined;

        if (usage) {
          return { text, usage };
        }

        return { text };
      } catch (err) {
        throw new LlmError("OpenAI request failed", err);
      }
    },
  };
}
