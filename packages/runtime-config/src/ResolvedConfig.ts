const OTHER_CHANNELS = ["jira", "slack"] as const;
export type OtherChannel = (typeof OTHER_CHANNELS)[number];
export type VCSDeliveryChannel = "github" | "gitlab";

export type Delivery = {
  vcs: VCSDeliveryChannel;
  other: readonly OtherChannel[];
};

export type ResolvedConfig = {
  mode: "cli" | "daemon";

  repository: {
    root: string;
    provider: "github" | "gitlab" | "filesystem";
  };

  index: {
    chunkSizeChars: number;
    chunkOverlapChars: number;
    maxFileSizeByets: number;
  };

  review: {
    confidenceThreshold: number;
    maxSignals: number;
  };

  context: {
    maxChunks: number; // retrieval
  };

  llm: {
    provider: "ollama" | "openai";
    model: string;
    temperature: number;
  };

  embeddings: {
    provider: "ollama" | "openai";
    model: string;
  };

  delivery: Delivery;

  database: {
    url: string;
    mode: "bundled" | "external";
  };
};
