/**
 * A minimal, explicit prompt contract.
 * No chat history, no tools, no streaming (yet).
 */
export type LlmPrompt = {
  system: string;
  user: string;
};

export type LlmUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

/**
 * Raw LLM output.
 * Parsing happens in the engine.
 */
export type LlmResponse = {
  text: string;
  usage?: LlmUsage;
};

export type OllamaConfig = {
  baseUrl?: string;
  model: string;
  temperature?: number;
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

export type ClaudeConfig = {
  apiKey: string;
  model: string; // e.g. "claude-3-5-sonnet-20241022"
};

export type GeminiConfig = {
  apiKey: string;
  model: string; // e.g. "gemini-1.5-pro"
};

export type OpenAiConfig = {
  apiKey: string;
  model: string;
  baseUrl?: string; // supports Azure / proxies
};
