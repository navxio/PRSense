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

/**
 * LLM port used by the engine.
 * Providers implement this.
 */
export type LlmClient = {
  generate(prompt: LlmPrompt): Promise<LlmResponse>;
};

export type OllamaConfig = {
  baseUrl?: string;
  model: string;
};
