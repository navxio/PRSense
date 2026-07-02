// packages/context/src/diff/httpDiffClient.ts

// common class to refactor all diff providers
// to use
const RETRYABLE = new Set([502, 503, 504]);

export type AuthHeader = { name: string; value: string } | undefined;

/** A non-retryable failure. Distinguishes "give up now" from "try again". */
class TerminalHttpError extends Error {}

/**
 * Minimal fetch transport shared by the remote diff providers.
 *
 * Owns the two concerns every provider needs and nothing else: transient-error
 * retry with exponential backoff, and a single auth header. Response parsing is
 * left to each provider so the API-shape boundary stays typed and local.
 *
 * `fetchImpl` is injected for testing; production passes the global fetch.
 */
export class HttpDiffClient {
  constructor(
    private readonly baseUrl: string,
    private readonly auth: AuthHeader,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async get(path: string, accept = "application/json"): Promise<Response> {
    const headers: Record<string, string> = { Accept: accept };
    if (this.auth) headers[this.auth.name] = this.auth.value;
    return this.retry(() =>
      this.fetchImpl(`${this.baseUrl}${path}`, { headers }),
    );
  }

  private async retry(
    fn: () => Promise<Response>,
    attempts = 4,
  ): Promise<Response> {
    let lastError: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        const res = await fn();
        if (res.ok) return res;
        // A non-retryable status is terminal: fail now rather than looping.
        if (!RETRYABLE.has(res.status)) {
          throw new TerminalHttpError(
            `HTTP ${res.status}: ${await res.text()}`,
          );
        }
        lastError = new Error(`HTTP ${res.status}`);
      } catch (err) {
        // Terminal errors (non-retryable status) stop immediately. Transient
        // network failures fall through to the next attempt.
        if (err instanceof TerminalHttpError) throw err;
        lastError = err;
      }
      await new Promise((r) => setTimeout(r, 300 * 2 ** i));
    }
    throw lastError;
  }
}
