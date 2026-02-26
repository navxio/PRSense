const OTHER_CHANNELS = ["jira", "slack"] as const;
export type OtherChannel = (typeof OTHER_CHANNELS)[number];
export type VCSDeliveryChannel = "github" | "gitlab";

export type Delivery = {
  vcs: VCSDeliveryChannel;
  other: readonly OtherChannel[];
};

type BaseResolvedConfig = {
  repository: {
    root: string;
    provider: "github" | "gitlab" | "filesystem";
  };

  index: {
    chunkSizeChars: number;
    chunkOverlapChars: number;
    maxFileSizeBytes: number;
  };

  review: {
    confidenceThreshold: number;
    maxSignals: number;
  };

  context: {
    maxChunks: number;
  };

  llm: {
    provider: "ollama" | "openai" | "google" | "anthropic";
    model: string;
    temperature: number;
  };

  embeddings: {
    provider: "ollama" | "openai";
    model: string;
  };

  database: {
    url: string;
    mode: "bundled" | "external";
  };
};

export type CliResolvedConfig = BaseResolvedConfig & {
  mode: "cli";
};

export type DaemonResolvedConfig = BaseResolvedConfig & {
  mode: "daemon";

  delivery: Delivery;
};

export type ResolvedConfig = CliResolvedConfig | DaemonResolvedConfig;
