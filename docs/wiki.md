# Wiki

## Architecture

          ┌─────────────┐
          │   GitHub    │
          │   / Git     │
          └──────┬──────┘
                 │
          [PR / Diff Event]
                 │
        ┌────────▼────────┐
        │   Ingestion     │
        │ (diff + meta)   │
        └────────┬────────┘
                 │
        ┌────────▼────────┐
        │ Context Builder │◄──── Repo, history, config
        └────────┬────────┘
                 │
        ┌────────▼────────┐
        │ Review Engine   │
        │ (rules + LLM)   │
        └────────┬────────┘
                 │
        ┌────────▼────────┐
        │ Signal Compiler │
        └────────┬────────┘
                 │
        ┌────────▼────────┐
        │ Reporters       │
        │ (GitHub, CLI)   │
        └─────────────────┘

## Monorepo layout

```
apps/
  api/                 # tRPC server (Node.js)
  worker/              # async jobs (reviews, retries)
  integrations/github/          # webhook receiver + auth
  cli/                 # local CLI (prsense review .)

packages/
  domain/              # CORE: signals, rules, prompts (pure TS)
  engine/              # review engine (rules + llm orchestration)
  llm/                 # provider abstraction + implementations
  context/             # diff parsing, context building, RAG-lite
  config/              # prsense.yml parsing + validation
  adapters/            # GitHub, GitLab, filesystem
  reporters/           # GitHub comments, JSON, stdout
```
