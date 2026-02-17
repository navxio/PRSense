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

  review: {
    confidenceThreshold: number;
    maxSignals: number;
  };

  context: {
    maxChunks: number; // retrieval
    chunkSize: number; // indexing
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
