// packages/context/src/debug/IndexDebugEvent.ts
export type IndexDebugEvent =
  | { type: "file_discovered"; path: string; kind: string }
  | {
      type: "chunk_created";
      path: string;
      startLine?: number;
      endLine?: number;
    }
  | { type: "embedding_created"; chunkId: string; vectorSize: number }
  | { type: "chunk_stored"; chunkId: string };
