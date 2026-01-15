# PRsense

PRsense is an open-source, LLM-assisted pull request reviewer that surfaces high-confidence review signals from your code changes.

Instead of generating noisy comments or rewriting your code, PRsense focuses on helping you understand risk: what changed, why it matters, and where attention is warranted.

## What PRsense does

PRsense analyzes:

- your git diff
- relevant local project context
- deterministic review rules
- optional LLM-assisted analysis

and produces structured review signals such as:

- potential bugs or edge cases
- risky TODOs or swallowed errors
- missing tests or unsafe assumptions
- design or maintainability concerns

Each signal includes:

- severity (low / medium / high)
- confidence
- a concise explanation

PRsense is designed to assist human reviewers, not replace them.

## What PRsense does not do

PRsense intentionally avoids actions that reduce developer agency:

- It does not write or modify code
- It does not open or merge pull requests
- It does not enforce opinions or style choices
- It does not act autonomously

PRsense makes decisions visible, not automatic.

## Why PRsense exists

Code review today suffers from two extremes:

- purely rule-based tools that miss context
- LLM tools that hallucinate or overreach

PRsense sits in between.

It combines:

- deterministic rules (for reliability)
- contextual retrieval (for relevance)
- LLMs (for reasoning, not authority)

The result is explainable, auditable review output.

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

## How PRsense is used

Currently, PRsense runs as a local CLI:
`prsense review .`

It compares your current working branch against a base branch and reports review signals to stdout.

Future integrations (GitHub App, CI, background workers) are planned but not required to use PRsense today.

## Configuration

PRsense is configured via a simple YAML file (config.yml) at the repository root.

This lets you control:

- which rules are enabled
- severity overrides
- confidence thresholds
- base branch selection
- LLM provider and model
- context retrieval behavior

Secrets and infrastructure details live outside the repo (for example, .env).

## Philosophy

PRsense is built around a few core principles:

- human-in-the-loop decision making
- high signal, low noise
- local-first operation
- explainability
- composability of rules, context, and models

PRsense treats LLMs as reasoning engines, not authorities.

## Project status

PRsense is under active development.

## License

PRsense is licensed under the Apache 2.0 License.
