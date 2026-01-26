import { LlmMiddleware } from "../types.js";
export function withTimeout(ms: number): LlmMiddleware {
  return (client) => ({
    async generate(req) {
      return Promise.race([
        client.generate(req),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("LLM timeout")), ms),
        ),
      ]);
    },
  });
}
