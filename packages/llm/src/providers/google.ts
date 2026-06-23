import { GoogleGenAI, HarmBlockThreshold, HarmCategory } from "@google/genai";
import { LlmClient, LlmRequest, LlmResponse, LlmError } from "../types.js";

export function createGoogleClient(config: {
  apiKey: string;
  model: string;
  temperature?: number;
}): LlmClient {
  const ai = new GoogleGenAI({ apiKey: config.apiKey });

  return {
    async generate(req: LlmRequest): Promise<LlmResponse> {
      try {
        const response = await ai.models.generateContent({
          model: config.model,
          contents: req.prompt.user,
          config: {
            systemInstruction: req.prompt.system,
            temperature: req.temperature ?? config.temperature ?? 0.05,
            maxOutputTokens: req.maxTokens ?? 2048,
            responseMimeType: "application/json",
            safetySettings: [
              {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.BLOCK_NONE,
              },
            ],
          },
        });

        const text = response.text?.trim();
        if (!text) {
          const finishReason = response.candidates?.[0]?.finishReason;
          const blockReason = response.promptFeedback?.blockReason;
          throw new Error(
            `Gemini returned empty response (finishReason=${finishReason ?? "?"}, blockReason=${blockReason ?? "none"})`,
          );
        }

        try {
          JSON.parse(text);
        } catch (err) {
          throw new Error(
            `Gemini returned invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
          );
        }

        return {
          text,
          usage: {
            promptTokens: response.usageMetadata?.promptTokenCount ?? 0,
            completionTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
            totalTokens: response.usageMetadata?.totalTokenCount ?? 0,
          },
        };
      } catch (err) {
        const detail = formatGoogleError(err);
        throw new LlmError(`Gemini request failed: ${detail}`, err);
      }
    },
  };
}

function formatGoogleError(err: unknown): string {
  if (err instanceof Error) {
    // @google/genai surfaces HTTP failures with status + structured error
    // on the Error object; shape varies, so we read defensively.
    const anyErr = err as any;
    const status = anyErr.status ?? anyErr.statusCode;
    const code = anyErr.error?.code ?? anyErr.code;
    const reason = anyErr.error?.status ?? anyErr.error?.message;
    const parts = [
      status && String(status),
      code && String(code),
      reason && `(${reason})`,
      err.message,
    ].filter(Boolean);
    return parts.join(" ");
  }
  return String(err);
}
