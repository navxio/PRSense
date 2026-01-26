import type { LlmMiddleware } from "../types.js";
export function withRetries(opts: {
  retries: number;
  backoffMs?: number;
}): LlmMiddleware {
  const { retries, backoffMs = 200 } = opts;

  return (client) => ({
    async generate(req) {
      let lastErr: unknown;

      for (let i = 0; i <= retries; i++) {
        try {
          return await client.generate(req);
        } catch (err) {
          lastErr = err;
          if (i < retries) {
            await new Promise((r) => setTimeout(r, backoffMs * (i + 1)));
          }
        }
      }

      throw lastErr;
    },
  });
}
