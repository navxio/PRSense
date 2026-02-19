CREATE TABLE IF NOT EXISTS prsense_index_metadata (
  repository_provider TEXT NOT NULL,
  repository_id TEXT NOT NULL,

  commit_sha TEXT NOT NULL,

  embedding_provider TEXT NOT NULL,
  embedding_model TEXT NOT NULL,
  embedding_dimension INTEGER NOT NULL,

  chunk_strategy TEXT NOT NULL,
  chunk_version INTEGER NOT NULL,

  prsense_version TEXT NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  PRIMARY KEY (repository_provider, repository_id)
);
