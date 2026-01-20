import type { WorkflowResult } from "../types/core.js";
export type IndexStats = {
  filesIndexed: number;
  chunksCreated: number;
  chunksStored: number;
};

export type IndexedRepository = {
  /** Logical repo identifier */
  id: string;

  /** Human-readable name */
  name: string;
};

export type IndexPayload = {
  repo: IndexedRepository;
  stats: IndexStats;
};

export type IndexWorkflowInput = {
  /**
   * Repository source specification.
   * Resolution to adapters happens in workflow.
   */
  repoPath: string;

  chunking: {
    size: number;
    overlap: number;
  };
};

export type IndexWorkflowResult = WorkflowResult<IndexPayload>;
