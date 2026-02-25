-- packages/context/migrations/0001_init.sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS rag_chunks (
  id TEXT PRIMARY KEY,

  -- repository identity
  repo_provider TEXT NOT NULL,
  repo_owner TEXT,
  repo_name TEXT NOT NULL,
  repo_ref TEXT,

  -- source info
  path TEXT NOT NULL,
  kind TEXT NOT NULL,        -- code | test | doc | config
  language TEXT,

  -- content
  content TEXT NOT NULL,

  -- optional metadata
  line_start INTEGER,
  line_end INTEGER,

  -- embedding
  embedding VECTOR(768),

  indexed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE INDEX ON rag_chunks
USING ivfflat (embedding vector_l2_ops)
WITH (lists = 100);

-- SELECT
--   id,
--   path,
--   kind,
--   language,
--   content,
--   line_start,
--   line_end,
--   embedding <-> $1 AS distance
-- FROM rag_chunks
-- WHERE
--   repo_provider = $2
--   AND repo_name = $3
--   AND (repo_ref = $4 OR repo_ref IS NULL)
-- ORDER BY embedding <-> $1
-- LIMIT $5;
--

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
