# PRSense

PRSense is an open-source, CLI-first, LLM-assisted pull request reviewer that surfaces high-confidence review signals from code changes.

Instead of generating noisy comments, rewriting code, or acting autonomously, PRSense focuses on helping you understand risk: what changed, why it matters, and where human attention is warranted.

PRSense is designed for senior developers who want intentional, inspectable, and self-hosted reviews.

---

## Table of Contents

- [Philosophy](#philosophy)
- [What PRSense Does](#what-prsense-does)
- [What PRSense Does Not Do](#what-prsense-does-not-do)
- [Why PRSense Exists](#why-prsense-exists)
- [Features](#features)
- [Requirements](#requirements)
- [Usage](#usage)
- [Configuration](#configuration)
- [Design](#design)
- [Architecture](#architecture)
- [Command Reference](#command-reference)
- [Project Status](#project-status)
- [License](#license)

---

## What PRSense Does

PRSense analyzes:

- your git diff
- relevant surrounding code context
- repository conventions
- test and documentation impact

and produces structured review signals such as:

- potential bugs or edge cases
- missing or insufficient tests
- unclear or overly clever code
- documentation gaps
- modularity or design concerns

Each review signal includes:

- severity (low / medium / high)
- confidence
- a concise explanation
- references to relevant code or context

PRSense assists human reviewers. It does not replace them.

---

## What PRSense Does Not Do

PRSense intentionally avoids actions that reduce developer agency:

- It does not write or modify code
- It does not open or merge pull requests
- It does not enforce opinions or style choices
- It does not act autonomously

PRSense makes reasoning visible, not automatic.

---

## Why PRSense Exists

Modern code review tools tend to fall into two extremes:

- purely rule-based tools that miss context
- LLM-based tools that hallucinate or overreach

PRSense sits between these extremes.

It combines:

- full diff awareness
- contextual retrieval (RAG)
- disciplined LLM reasoning
- structured, inspectable output

The result is explainable, auditable review feedback that developers can trust.

---

## Usage

PRSense is currently used as a local CLI tool.

Example:

prsense review .

This compares your current working branch against a base branch and prints review signals to stdout.

PRSense can also review git ranges, patch files, or diffs from stdin.

Future integrations (GitHub App, CI, background workers) are planned, but not required to use PRSense today.

---

## Requirements

- Node.Js (22.x) + npm
- Docker
- Ollama(optional)
- PostgreSQL + pgvector(optional)

---

## Features

- **Fast, local-first CLI** for reviewing and analyzing code changes
- **Self-hosted by default** — run entirely on your own machine or infrastructure
- **Persistent background daemon**
- **Diff-first intelligence**, understanding:
  - local changes
  - generated outputs
  - pull request diffs
- **Pluggable LLM backends**, including Ollama and OpenAI(more on the roadmap)
- **Flexible outputs** for humans and machines:
  - terminal summaries
  - JSON for CI / tooling
  - GitHub pull request annotations

---

## Configuration

PRSense separates review intent from runtime configuration.

### Repository configuration (prsense.yml)

Review behavior is configured via a YAML file placed at the repository root.

Example:

```
llm:
  provider: ollama
  model: qwen2.5-coder
  temperature: 0.1

embeddings:
  provider: ollama
  model: nomic-embed-text

review:
  confidenceThreshold: 0.6
  maxSignals: 10

context:
  maxChunks: 5

git:
  baseBranch: trunk

delivery:
  - github
  - slack
  - gitlab
```

This configuration defines how PRSense behaves as a reviewer for the repository.

If no configuration file is present, PRSense uses sensible defaults.

### Environment variables

Environment variables configure runtime and infrastructure details such as:

- LLM endpoints or API keys
- database connections
- logging levels

Examples:

PRSENSE_OLLAMA_HOST  
PRSENSE_OPENAI_API_KEY  
PRSENSE_DATABASE_URL

Environment variables do not control review behavior.

---

## Design

PRSense is built using a hexagonal (ports-and-adapters) architecture.

This design separates core review logic from external concerns such as Git, filesystems, databases, LLM providers, and user interfaces. The goal is to keep the system easy to reason about, test, and extend.

### Core (Domain + Engine)

At the center of PRSense is a small, declarative core:

- domain types such as ReviewSignal and ReviewContext
- pure review logic and orchestration
- no direct IO
- no network access
- no filesystem assumptions

The core does not know where data comes from or where results go. It only operates on well-defined inputs and produces structured outputs.

This makes the core:

- deterministic
- testable
- portable
- resistant to integration churn

### Ports

Ports are the abstract boundaries through which the core interacts with the outside world.

In PRSense, ports take the form of TypeScript interfaces and function contracts, for example:

- context retrievers
- LLM providers
- embedding generators
- vector stores
- reporters

Ports describe _what_ the core needs, not _how_ it is implemented.

### Adapters

Adapters live at the edges of the system and implement ports.

Examples include:

- filesystem-based context retrieval
- git diff ingestion
- Ollama or OpenAI LLM providers
- PostgreSQL + pgvector storage
- CLI reporters

Adapters are inherently imperative and may fail. Those failures are handled at the boundary, not inside the core.

### Imperative Shell

The outermost layer consists of applications:

- the CLI
- background workers
- future GitHub integrations

These applications:

- parse user input
- load configuration
- wire adapters together
- call the core
- present results

The shell is free to be messy. The core is not.

### Why This Matters

This architecture allows PRSense to:

- run locally, in CI, or as a service
- swap LLM providers without touching review logic
- add new retrieval strategies without rewriting the engine
- remain understandable as complexity grows

Most importantly, it allows PRSense to treat LLMs as interchangeable tools rather than structural dependencies.

The result is a system that is flexible without being fragile.

## Architecture

          ┌─────────────┐
          │   Git / PR  │
          └──────┬──────┘
                 │
            [ Diff Input ]
                 │
        ┌────────▼────────┐
        │ Ingestion       │
        │ (diff + meta)   │
        └────────┬────────┘
                 │
        ┌────────▼────────┐
        │ Context Builder │◄──── Repository, files, history
        └────────┬────────┘
                 │
        ┌────────▼────────┐
        │ Review Engine   │
        │ (LLM + Context) │
        └────────┬────────┘
                 │
        ┌────────▼────────┐
        │ Signal Compiler │
        └────────┬────────┘
                 │
        ┌────────▼────────┐
        │ Reporters       │
        │ (CLI, others)   │
        └─────────────────┘

PRSense follows a hexagonal architecture:

- a declarative domain core
- a functional review engine
- imperative adapters for IO, git, LLMs, and storage

```


CLI / Daemon / CI / GitHub App
─────────────── execution environments
Workflows
─────────────── orchestration
Engine / Context / Adapters / LLM
─────────────── capabilities
Domain
─────────────── pure types


```

---

### Monorepo Layout

```
apps/
  cli/ # CLI entrypoint
  daemon/ # http + scheduler

packages/
  core/ # core domain types and engine
  context/ # diff parsing and contextual retrieval
  llm/ # LLM provider abstractions
  config/ # prsense.yml and env validation
  reporters/ # CLI and other output formats
  workflows/ # all workflows (cli+daemon)
  preflight/ #executable infa truths and enforcement
  logging/ # structured logging
  runtime-config/ # runtime config primitives
```

---

## Command Reference

A complete command reference is available in:

[docs/man/prsense.1](docs/man/prsense.1)

---

## Philosophy

PRSense is built around a few core principles:

- human-in-the-loop decision making
- high signal, low noise
- local-first and self-hosted operation
- transparency over automation
- inspectable reasoning
- composability over monoliths

PRSense treats LLMs as reasoning engines, not authorities.

---

## Project Status

PRSense is under active development.

Interfaces and core concepts are stabilizing, while integrations and performance improvements continue.

---

## ToDo

- [ ] move both commands to task runner UI
- [ ] create service mode with GH webhook listeners
- [ ] add `--rebuild` option to index command
- [ ] `prsense setup db` (bundle postgres+pgvector with docker)
- [x] update manpage
- [ ] setup concurrency

---

## License

PRSense is licensed under the Apache 2.0 License.
