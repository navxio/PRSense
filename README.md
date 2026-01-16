# PRsense

PRsense is an open-source, CLI-first, LLM-assisted pull request reviewer that surfaces high-confidence review signals from code changes.

Instead of generating noisy comments, rewriting code, or acting autonomously, PRsense focuses on helping you understand risk: what changed, why it matters, and where human attention is warranted.

PRsense is designed for senior developers who want intentional, inspectable, and self-hosted reviews.

---

## Table of Contents

- [What PRsense Does](#what-prsense-does)
- [What PRsense Does Not Do](#what-prsense-does-not-do)
- [Why PRsense Exists](#why-prsense-exists)
- [How PRsense Is Used](#how-prsense-is-used)
- [Configuration](#configuration)
- [Design](#design)
- [Architecture](#architecture)
- [Monorepo Layout](#monorepo-layout)
- [Command Reference](#command-reference)
- [Philosophy](#philosophy)
- [Project Status](#project-status)
- [License](#license)

---

## What PRsense Does

PRsense analyzes:

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

PRsense assists human reviewers. It does not replace them.

---

## What PRsense Does Not Do

PRsense intentionally avoids actions that reduce developer agency:

- It does not write or modify code
- It does not open or merge pull requests
- It does not enforce opinions or style choices
- It does not act autonomously

PRsense makes reasoning visible, not automatic.

---

## Why PRsense Exists

Modern code review tools tend to fall into two extremes:

- purely rule-based tools that miss context
- LLM-based tools that hallucinate or overreach

PRsense sits between these extremes.

It combines:

- full diff awareness
- contextual retrieval (RAG)
- disciplined LLM reasoning
- structured, inspectable output

The result is explainable, auditable review feedback that developers can trust.

---

## How PRsense Is Used

PRsense is currently used as a local CLI tool.

Example:

prsense review .

This compares your current working branch against a base branch and prints review signals to stdout.

PRsense can also review git ranges, patch files, or diffs from stdin.

Future integrations (GitHub App, CI, background workers) are planned, but not required to use PRsense today.

---

## Configuration

PRsense separates review intent from runtime configuration.

### Repository configuration (prsense.yml)

Review behavior is configured via a YAML file placed at the repository root.

Example:

llm:
provider: ollama
model: qwen2.5-coder
temperature: 0.1

review:
confidenceThreshold: 0.6
maxSignals: 10

context:
maxChunks: 5

git:
baseBranch: trunk

This configuration defines how PRsense behaves as a reviewer for the repository.

If no configuration file is present, PRsense uses sensible defaults.

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

PRsense is built using a hexagonal (ports-and-adapters) architecture.

This design separates core review logic from external concerns such as Git, filesystems, databases, LLM providers, and user interfaces. The goal is to keep the system easy to reason about, test, and extend.

### Core (Domain + Engine)

At the center of PRsense is a small, declarative core:

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

In PRsense, ports take the form of TypeScript interfaces and function contracts, for example:

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

This architecture allows PRsense to:

- run locally, in CI, or as a service
- swap LLM providers without touching review logic
- add new retrieval strategies without rewriting the engine
- remain understandable as complexity grows

Most importantly, it allows PRsense to treat LLMs as interchangeable tools rather than structural dependencies.

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

PRsense follows a hexagonal architecture:

- a declarative domain core
- a functional review engine
- imperative adapters for IO, git, LLMs, and storage

---

## Monorepo Layout
```
apps/
cli/ # CLI entrypoint
worker/ # background jobs (future)
integrations/github/ # GitHub App (future)

packages/
domain/ # core domain types and signals
engine/ # review engine orchestration
context/ # diff parsing and contextual retrieval
llm/ # LLM provider abstractions
config/ # prsense.yml and env validation
adapters/ # git, filesystem, database, LLM adapters
reporters/ # CLI and other output formats
```
---

## Command Reference

A complete command reference is available in:

docs/man/prsense.1

---

## Philosophy

PRsense is built around a few core principles:

- human-in-the-loop decision making
- high signal, low noise
- local-first and self-hosted operation
- transparency over automation
- inspectable reasoning
- composability over monoliths

PRsense treats LLMs as reasoning engines, not authorities.

---

## Project Status

PRsense is under active development.

Interfaces and core concepts are stabilizing, while integrations and performance improvements continue.

---

## License

PRsense is licensed under the Apache 2.0 License.
