export function applyCliOverrides(config: any, options: any) {
  const next = { ...config };

  // LLM
  if (options.llmProvider) {
    next.llm = { ...next.llm, provider: options.llmProvider };
  }

  if (options.llmModel) {
    next.llm = { ...next.llm, model: options.llmModel };
  }

  if (options.llmTemperature !== undefined) {
    next.llm = { ...next.llm, temperature: options.llmTemperature };
  }

  // Review
  if (options.maxSignals !== undefined) {
    next.review = { ...next.review, maxSignals: Number(options.maxSignals) };
  }

  if (options.confidenceThreshold !== undefined) {
    next.review = {
      ...next.review,
      confidenceThreshold: options.confidenceThreshold,
    };
  }

  // Context
  if (options.maxChunks !== undefined) {
    next.context = {
      ...next.context,
      maxChunks: Number(options.maxChunks),
    };
  }

  // Git
  if (options.baseBranch) {
    next.git = { ...next.git, baseBranch: options.baseBranch };
  }

  return next;
}
