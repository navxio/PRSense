// packages/llm/src/providers/pinstripes.ts
import { createOpenAiClient } from "./openai.js";
import { LlmClient } from "../types.js";

const PINSTRIPES_BASE_URL = "https://api.pinstripes.io/v1";

export function createPinStripesClient(config: {
  apiKey: string;
  model: string;
  temperature?: number;
}): LlmClient {
  return createOpenAiClient({
    ...config,
    baseUrl: PINSTRIPES_BASE_URL,
  });
}
