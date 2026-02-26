# PRSense

PRSense is an open-source, CLI-first, LLM-assisted pull request reviewer that surfaces high-confidence review signals from code changes.

Instead of generating noisy comments, rewriting code, or acting autonomously, PRSense focuses on helping you understand risk: what changed, why it matters, and where human attention is warranted.

PRSense is designed for senior developers who want intentional, inspectable, and self-hosted reviews.

---

## Table of Contents

- [Philosophy](#philosophy)
- [Features](#features)
- [What PRSense Does Not Do](#what-prsense-does-not-do)
- [Requirements](#requirements)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [Design](#design)
- [Architecture](#architecture)
- [Command Reference](#command-reference)
- [Project Status](#project-status)
- [Contributing](#contributing)
- [License](#license)

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

## Features

- **Fast, local-first CLI** for reviewing and analyzing code changes
- **Self-hosted by default** — run entirely on your own machine or infrastructure
- **Persistent background daemon**
  - Idempotent job creation
- **Diff-first intelligence**, understanding:
  - local changes
  - pull request diffs
- **Pluggable LLM backends** - Ollama, Anthropic, Google, OpenAI
- **Flexible outputs** for humans and machines:
  - terminal summaries
  - GitHub/GitLab pull request comments

---

## Requirements

- Node.Js (22.x) + npm
- Docker
- Ollama(optional)
- PostgreSQL + pgvector(optional)

---

## Installation

`npm i -g @prsense/cli`

---

## What PRSense Does Not Do

PRSense intentionally avoids actions that reduce developer agency:

- It does not write or modify code
- It does not open or merge pull requests
- It does not enforce opinions or style choices
- It does not act autonomously

PRSense makes reasoning visible, not automatic.

---

## Usage

PRSense is currently used as a local CLI tool.

Example:

prsense review .

This compares your current working branch against a base branch and prints review signals to stdout.

PRSense can also review git ranges, patch files, or diffs from stdin.

Future integrations (GitHub App, CI, background workers) are planned, but not required to use PRSense today.

---

## Configuration

See [Configuration](../../docs/configuration.md)

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
  bench/ # benchmarking primitives
```

---

## Command Reference

A complete command reference is available in:

[docs/man/prsense.1](docs/man/prsense.1)

---

## Project Status

PRSense is under active development.

Interfaces and core concepts are stabilizing, while integrations and performance improvements continue.

---

## ToDo

- [ ] setup concurrency
- [ ] exclude bundled prsense.yml from indexing
- [ ] JSON output for CI
- [ ] automated tests
- [ ] codeberg support

---

## Contributing

PRs are welcome

## Similar Projects

- [pr-agent](https://github.com/<>/<>)

---

## License

PRSense is licensed under the Apache 2.0 License.
