// packages/context/src/types/IndexDebugEvent.ts
export type IndexWorkflowEvent =
  | {
      type: "file_discovered";
      path: string;
    }
  | {
      type: "chunk_created";
      path: string;
      startLine?: number;
      endLine?: number;
    }
  | {
      type: "embedding_created";
      dimensions: number;
    }
  | {
      type: "chunk_stored";
      id: string;
    };

export type IndexEventSink = (event: IndexWorkflowEvent) => void;
