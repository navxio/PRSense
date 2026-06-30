// packages/llm/src/providers/openai.ts
import OpenAI from "openai";
import {
  LlmClient,
  LlmRequest,
  LlmResponse,
  LlmError,
  LlmUsage,
} from "../types.js";

// Models discovered (via 400) to reject an explicit temperature.
// Server is the source of truth; we learn once, then respect it.
const temperatureRejected = new Set<string>();
const temperatureWarned = new Set<string>();

function isTemperature400(err: unknown): boolean {
  return (
    err instanceof OpenAI.APIError &&
    err.status === 400 &&
    /temperature/i.test(err.message)
  );
}

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

      const call = (includeTemp: boolean) => {
        const request: any = {
          model: config.model,
          messages: [
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.user },
          ],
        };
        if (includeTemp) {
          request.temperature = temperature;
        }
        if (req.maxTokens !== undefined) {
          request.max_tokens = req.maxTokens;
        }
        return client.chat.completions.create(request);
      };

      try {
        const includeTemp = !temperatureRejected.has(config.model);
        let res;
        try {
          res = await call(includeTemp);
        } catch (err) {
          if (includeTemp && isTemperature400(err)) {
            temperatureRejected.add(config.model);
            if (!temperatureWarned.has(config.model)) {
              temperatureWarned.add(config.model);
              console.warn(
                `[prsense] model '${config.model}' ignores temperature; using its default.`,
              );
            }
            res = await call(false);
          } else {
            throw err;
          }
        }

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
        const detail =
          err instanceof OpenAI.APIError
            ? `${err.status ?? "?"} ${err.type ?? ""} ${err.code ?? ""}: ${err.message}`.trim()
            : err instanceof Error
              ? err.message
              : String(err);
        throw new LlmError(`OpenAI request failed: ${detail}`, err);
      }
    },
  };
}
