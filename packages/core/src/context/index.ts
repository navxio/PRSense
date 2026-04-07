export type RetrievedContext = {
  chunks: ContextChunk[];
  stats: {
    totalChunks: number;
    truncated: boolean;
  };
};

export type ContextSource =
  | {
      kind: "file";
      path: string;
    }
  | {
      kind: "symbol";
      name: string;
      path?: string;
    }
  | {
      kind: "commit";
      sha: string;
    }
  | {
      kind: "doc";
      id: string;
    }
  | {
      kind: "manual";
      label: string;
    };

export type ContextChunk = {
  id: string;
  source: ContextSource;
  content: string;
  metadata?: {
    symbols?: string[];
    language?: string;
    lineStart?: number;
    lineEnd?: number;
    kind?: "code" | "test" | "doc" | "config";
    [key: string]: unknown;
  };
};
