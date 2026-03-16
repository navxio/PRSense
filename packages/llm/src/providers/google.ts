// packages/llm/src/providers/google.ts
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { LlmClient, LlmRequest, LlmResponse } from "../types.js";

function stripMarkdownJson(text: string): string {
  const trimmed = text.trim();

  if (!trimmed.startsWith("```")) return trimmed;

  const lines = trimmed.split("\n");

  if (lines[0]?.startsWith("```")) lines.shift();
  if (lines.at(-1)?.startsWith("```")) lines.pop();

  return lines.join("\n").trim();
}

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
          responseMimeType: "application/json",
        },
      });

      const candidate = res.response.candidates?.[0];

      const raw =
        candidate?.content?.parts
          ?.map((p) => ("text" in p ? p.text : ""))
          .join("") ?? "";

      if (!raw) {
        throw new Error("Gemini returned empty response");
      }

      const text = stripMarkdownJson(raw);

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
