# PRSense

PRSense is an open-source, AI-powered code review engine that surfaces high-confidence review signals from pull request changes.

It does not rewrite your code.
It does not flood your PR with generic comments.
It does not act autonomously.

Instead, PRSense focuses on what matters:

- What changed
- Where risk exists
- Why human attention is warranted

It is built for senior engineers who want review assistance that is:

- Intentional
- Inspectable
- Deterministic
- Self-hosted

PRSense separates review logic from delivery. The same core engine can run:

- Locally via CLI
- As a long-lived daemon
- Behind webhooks
- Inside CI pipelines

This keeps the review system transparent and infrastructure-friendly while remaining flexible in how it is deployed.

PRSense is not a chat interface for code. It is a review system designed to augment human judgment — not replace it.

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

PRSense is an AI-powered code review engine that can run in two modes:

- **CLI mode** — local, interactive usage
- **Daemon mode** — long-lived HTTP service for automation and webhooks

Both modes use the same core review engine and configuration model.

---

### CLI Mode

The CLI is ideal for local development and experimentation.

#### Review a local repository

```bash
prsense review .
```

Compares your current branch against the configured base branch and prints review signals to stdout.

#### Review a GitHub Pull Request

```bash
prsense review https://github.com/owner/repo/pull/123
```

#### Review a GitLab Merge Request

```bash
prsense review https://gitlab.com/group/project/-/merge_requests/42
```

#### Index a repository (enable contextual review)

```bash
prsense index .
```

This builds a semantic index of the repository to enable contextual (RAG-enhanced) reviews.

Optional flags:

```bash
prsense index . --force
prsense index . --dry-run
prsense index . --stats
```

#### Run setup checks

```bash
prsense setup
```

Ensures required infrastructure (database, embeddings, etc.) is available.

---

### Daemon Mode

The daemon runs PRSense as a long-lived HTTP service, intended for automation, CI integration, and webhook-based review.

#### Start the daemon

```bash
prsense-daemon
```

By default, it listens on:

```
http://localhost:3000
```

#### Health & Readiness

```
GET /health
GET /ready
```

Example:

```bash
curl http://localhost:3000/health
```

#### Trigger Review via API

```
POST /jobs/review
```

Example:

```bash
curl -X POST http://localhost:3000/jobs/review \
  -H "Content-Type: application/json" \
  -d '{"target":"https://github.com/owner/repo/pull/123"}'
```

Response:

```json
{
  "jobId": "..."
}
```

#### Trigger Indexing via API

```
POST /jobs/index
```

Example:

```bash
curl -X POST http://localhost:3000/jobs/index \
  -H "Content-Type: application/json" \
  -d '{"target":"https://github.com/owner/repo"}'
```

---

### Webhook Endpoints

The daemon supports webhook-triggered reviews.

#### GitHub

```
POST /webhooks/github
```

Requires: `PRSENSE_GITHUB_WEBHOOK_SECRET`

Supports `pull_request` events: `opened`, `synchronize`.

#### GitLab

```
POST /webhooks/gitlab
```

Requires: `PRSENSE_GITLAB_WEBHOOK_SECRET`

Supports `merge_request` events.

---

### How It All Fits Together

- **CLI mode** is interactive and developer-focused.
- **Daemon mode** is automation-focused.
- Both share the same configuration, indexing system, review workflow, and validation pipeline.

PRSense is delivery-agnostic — the core engine remains the same.

---

### Typical Workflows

#### Local Development

1. `prsense index .`
2. `prsense review .`

#### Team Automation

1. Run `prsense-daemon`
2. Configure GitHub/GitLab webhook
3. Reviews trigger automatically on PR/MR updates

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
- [ ] README
  - [ ] Quickstart
  - [ ] Self hosted deployment
  - [ ] update manpage

---

## Contributing

PRs are welcome

## Similar Projects

- [pr-agent](https://github.com/<>/<>)

---

## License

PRSense is licensed under the Apache 2.0 License.
