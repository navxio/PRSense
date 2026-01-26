/**
 * A minimal, explicit prompt contract.
 * No chat history, no tools, no streaming (yet).
 */
export type LlmPrompt = {
  system: string;
  user: string;
};

/**
 * Raw LLM output.
 * Parsing happens in the engine.
 */
export type LlmResponse = {
  text: string;
};

export type OllamaConfig = {
  baseUrl?: string;
  model: string;
};

export type LlmRequest = {
  prompt: LlmPrompt;
  /*
   *
   * Optional runtime hints.
   * Providers may ignore unsupported fields
   */
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
};

/**
 * LLM port used by the engine.
 * Providers implement this.
 */
export type LlmClient = {
  generate(req: LlmRequest): Promise<LlmResponse>;
};

export type LlmMiddleware = (client: LlmClient) => LlmClient;

export class LlmError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
  }
}
