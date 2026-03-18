// steps/createLlmClient.ts

import type { ResolvedConfig, CredentialContext } from "@prsense/config";

import {
  createOpenAiClient,
  createOllamaClient,
  createGoogleClient,
  createAnthropicClient,
} from "@prsense/llm";
export function createLlmClientSafe(
  config: ResolvedConfig,
  credentials: CredentialContext,
) {
  switch (config.llm.provider) {
    case "openai": {
      const apiKey = credentials.openai?.apiKey;
      if (!apiKey) throw new Error("OpenAI credentials missing");

      return createOpenAiClient({
        apiKey,
        model: config.llm.model,
        temperature: config.llm.temperature,
      });
    }

    case "google": {
      const apiKey = credentials.google?.apiKey;
      if (!apiKey) throw new Error("Google credentials missing");

      return createGoogleClient({
        apiKey,
        model: config.llm.model,
        temperature: config.llm.temperature,
      });
    }

    case "anthropic": {
      const apiKey = credentials.anthropic?.apiKey;
      if (!apiKey) throw new Error("Anthropic credentials missing");

      return createAnthropicClient({
        apiKey,
        model: config.llm.model,
        temperature: config.llm.temperature,
      });
    }

    default:
      return createOllamaClient({
        model: config.llm.model,
        temperature: config.llm.temperature,
      });
  }
}
