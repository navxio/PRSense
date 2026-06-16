// packages/llm/src/providers/google.ts
import { GoogleGenAI, HarmBlockThreshold, HarmCategory } from "@google/genai";

import { LlmClient, LlmRequest, LlmResponse } from "../types.js";

export function createGoogleClient(config: {
  apiKey: string;
  model: string;
  temperature?: number;
}): LlmClient {
  /**
   * Migration note (2026):
   *
   * Google migrated from:
   *
   *   @google/generative-ai
   *
   * to:
   *
   *   @google/genai
   *
   * Key changes:
   *
   * - GoogleGenerativeAI -> GoogleGenAI
   * - getGenerativeModel() removed
   * - generateContent() now hangs off ai.models
   * - systemInstruction moved into config
   * - response.text is available directly
   *
   * Keep provider-specific behavior isolated here so the
   * rest of PRSense remains provider-agnostic.
   */
  const ai = new GoogleGenAI({
    apiKey: config.apiKey,
  });

  return {
    async generate(req: LlmRequest): Promise<LlmResponse> {
      const response = await ai.models.generateContent({
        model: config.model,

        /**
         * The new SDK accepts a plain string for simple
         * single-turn interactions.
         */
        contents: req.prompt.user,

        config: {
          systemInstruction: req.prompt.system,

          temperature: req.temperature ?? config.temperature ?? 0.05,

          /**
           * Runtime hint from the engine.
           *
           * Providers may ignore unsupported fields,
           * but Gemini supports output token limits.
           */
          maxOutputTokens: req.maxTokens ?? 2048,

          /**
           * PRSense expects machine-readable JSON.
           */
          responseMimeType: "application/json",

          /**
           * Source-code reviews frequently discuss
           * security-sensitive topics. Disable the
           * dangerous-content safety filter to reduce
           * false positives.
           */
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
        throw new Error("Gemini returned empty response");
      }

      /**
       * Fail fast if Gemini violates JSON mode.
       */
      try {
        JSON.parse(text);
      } catch (err) {
        throw new Error(
          `Gemini returned invalid JSON: ${
            err instanceof Error ? err.message : String(err)
          }`,
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
    },
  };
}
