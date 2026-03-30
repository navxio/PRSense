function clean(obj: any) {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined),
  );
}

export function applyOverrides(config: any, overrides: any) {
  const next = { ...config };

  if (overrides.llm) {
    next.llm = { ...next.llm, ...clean(overrides.llm) };
  }

  if (overrides.review) {
    next.review = { ...next.review, ...clean(overrides.review) };
  }

  if (overrides.context) {
    next.context = { ...next.context, ...clean(overrides.context) };
  }

  if (overrides.git) {
    next.git = { ...next.git, ...clean(overrides.git) };
  }

  if (overrides.embeddings) {
    next.embeddings = {
      ...next.embeddings,
      ...clean(overrides.embeddings),
    };
  }

  if (overrides.index) {
    next.index = { ...next.index, ...clean(overrides.index) };
  }

  return next;
}

export function buildOverrides(options: any) {
  return {
    llm: {
      provider: options.llmProvider,
      model: options.llmModel,
      temperature: options.llmTemperature,
    },
    review: {
      maxSignals: options.maxSignals,
      confidenceThreshold: options.confidenceThreshold,
    },
    context: {
      maxChunks: options.maxChunks,
    },
    git: {
      baseBranch: options.baseBranch,
    },
    embeddings: {
      provider: options.embeddingsProvider,
      model: options.embeddingsModel,
    },
    index: {
      chunkSizeChars: options.chunkSizeChars,
      chunkOverlapChars: options.chunkOverlapChars,
    },
  };
}
