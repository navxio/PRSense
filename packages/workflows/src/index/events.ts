export type IndexDebugEvent =
  | { type: "file_discovered"; path: string }
  | { type: "chunk_created"; startLine?: number; endLine?: number }
  | { type: "embedding_created"; vectorSize: number }
  | { type: "chunk_stored"; chunkId: string };
