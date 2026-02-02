// packages/llm/src/providers/gemini.ts
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { LlmClient, LlmRequest, LlmResponse, LlmError } from "../types.js";

export function createGeminiClient(config: {
  apiKey: string;
  model: string;
}): LlmClient {
  const genAI = new GoogleGenerativeAI(config.apiKey);

  const model = genAI.getGenerativeModel({
    model: config.model,
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
    ],
  });

  return {
    async generate(req: LlmRequest): Promise<LlmResponse> {
      const { prompt, temperature = 0 } = req;

      try {
        const res = await model.generateContent({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `${prompt.system}\n\n${prompt.user}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature,
          },
        });

        const text = res.response.text();

        if (!text) {
          throw new Error("Gemini returned empty response");
        }

        return { text };
      } catch (err) {
        throw new LlmError("Gemini request failed", err);
      }
    },
  };
}
