// packages/llm/src/providers/google.ts
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { LlmClient, LlmRequest, LlmResponse } from "../types.js";

export function createGoogleClient(config: {
  apiKey: string;
  model: string;
  temperature?: number;
}): LlmClient {
  const genAI = new GoogleGenerativeAI(config.apiKey);

  return {
    async generate(req: LlmRequest): Promise<LlmResponse> {
      const { prompt, temperature = 0.05 } = req;

      const model = genAI.getGenerativeModel({
        model: config.model,
        systemInstruction: prompt.system,
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
        ],
      });

      const res = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt.user }],
          },
        ],
        generationConfig: {
          temperature,
          maxOutputTokens: 1024,
        },
      });

      const candidate = res.response.candidates?.[0];

      const text =
        candidate?.content?.parts
          ?.map((p) => ("text" in p ? p.text : ""))
          .join("") ?? "";

      if (!text) {
        throw new Error("Gemini returned empty response");
      }

      return {
        text,
        usage: {
          promptTokens: res.response.usageMetadata?.promptTokenCount ?? 0,
          completionTokens:
            res.response.usageMetadata?.candidatesTokenCount ?? 0,
          totalTokens: res.response.usageMetadata?.totalTokenCount ?? 0,
        },
      };
    },
  };
}
