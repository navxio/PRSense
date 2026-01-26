import { LlmClient, LlmMiddleware } from "./types.js";

// helper function for composition
export function composeLlm(
  client: LlmClient,
  ...middlewares: LlmMiddleware[]
): LlmClient {
  return middlewares.reduce((acc, mw) => mw(acc), client);
}

// usage
// const base = createOllamaClient(config)
// const llm = composeLlm(base, withTimeout(30_000), withRetries({retries: 2}))
