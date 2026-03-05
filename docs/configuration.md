## Configuration

PRSense separates **review behavior** from **runtime infrastructure configuration**.

Configuration is layered and deterministic.

### Configuration Layers (Lowest → Highest Priority)

1. Built-in defaults
2. Global config (`~/.config/prsense/config.yml`)
3. Repository config (`prsense.yml`)
4. CLI flags (when applicable)

Environment variables are used exclusively for **credentials and infrastructure**, never review behavior.

This ensures:

- Reproducible reviews
- No secrets in source control
- Deterministic layering
- Clear separation of domain vs runtime concerns

# Global Configuration (Optional)

Location:

```
$XDG_CONFIG_HOME/prsense/config.yml
```

or

```
~/.config/prsense/config.yml
```

Global config defines personal defaults applied to all repositories.

Example:

```yaml
llm:
  provider: ollama
  model: qwen2.5-coder
  temperature: 0.1

embeddings:
  provider: ollama
  model: nomic-embed-text
```

Repository config overrides global config.

# Repository Configuration (`prsense.yml`)

Placed at the root of your repository.

This file defines review behavior:

- LLM provider and model
- Embedding model
- Chunking strategy
- Review thresholds
- Retrieval limits
- Delivery channels (daemon mode)

## Example

```yaml
llm:
  provider: ollama # ollama | openai | google | anthropic
  model: qwen2.5-coder
  temperature: 0.1

embeddings:
  provider: ollama # ollama | openai
  model: nomic-embed-text

index:
  chunkSizeChars: 1000
  chunkOverlapChars: 200
  maxFileSizeBytes: 1048576

review:
  confidenceThreshold: 0.6
  maxSignals: 10

context:
  maxChunks: 5

git:
  baseBranch: main

# Daemon mode only
delivery:
  - github
  - slack
```

# Configuration Sections Explained

## `llm`

Controls review generation model.

Supported providers:

- `ollama`
- `openai`
- `google`
- `anthropic`

`temperature` controls randomness.

Lower values produce more deterministic output.

## `embeddings`

Controls vector embeddings used for indexing and retrieval.

If changed:

- Re-indexing is required.
- Embedding dimensions must match the database schema.

## `index`

Controls repository chunking.

- `chunkSizeChars` — characters per chunk.
- `chunkOverlapChars` — overlap between chunks.
- `maxFileSizeBytes` — skip large files.

## `review`

Controls signal filtering.

- `confidenceThreshold` — minimum confidence.
- `maxSignals` — maximum number of emitted signals.

## `context`

Controls retrieval (RAG).

- `maxChunks` — number of chunks retrieved per review.

## `delivery` (Daemon Mode Only)

Defines where review results are posted.

Example:

```yaml
delivery:
  - github
  - slack
```

Rules:

- Only one VCS channel allowed (`github` or `gitlab`)
- Additional channels optional (`slack`, `jira`)

Ignored in CLI mode.

# Environment Variables

Environment variables configure runtime infrastructure and credentials.

They are never stored in `prsense.yml`.

## LLM Credentials

| Provider | Variable                         |
| -------- | -------------------------------- |
| OpenAI   | `PRSENSE_OPENAI_API_KEY`         |
| Gemini   | `PRSENSE_GEMINI_API_KEY`         |
| Claude   | `PRSENSE_CLAUDE_API_KEY`         |
| Ollama   | `PRSENSE_OLLAMA_HOST` (optional) |

## Embeddings (OpenAI)

```
PRSENSE_OPENAI_API_KEY
```

## Database

Used for indexing.

If not provided:

- CLI may use bundled Docker Postgres
- Daemon requires valid configuration

```
PRSENSE_DATABASE_URL
```

Example:

```
postgresql://prsense:prsense@localhost:10000/prsense_dev
```

## GitHub Delivery

### Personal Access Token

```
PRSENSE_GITHUB_TOKEN
PRSENSE_GITHUB_WEBHOOK_SECRET
```

### GitHub App (Recommended)

```
PRSENSE_GITHUB_APP_ID
PRSENSE_GITHUB_APP_PRIVATE_KEY
PRSENSE_GITHUB_INSTALLATION_ID
PRSENSE_GITHUB_WEBHOOK_SECRET
```

## GitLab Delivery

```
PRSENSE_GITLAB_TOKEN
PRSENSE_GITLAB_WEBHOOK_SECRET
```

## Slack Delivery

```
PRSENSE_SLACK_BOT_TOKEN
```

## Logging

```
PRSENSE_LOG_LEVEL=debug | info | warn | error
```

# CLI Mode vs Daemon Mode

## CLI Mode

- Loads global + repo config
- Ignores `delivery`
- No webhook secrets required
- Can run fully local

Example:

```sh
prsense review .
```

## Daemon Mode

- Loads global config at startup
- Validates credentials at boot
- Requires delivery configuration
- Requires webhook secrets
- Loads repo config dynamically per review job

Start daemon:

```sh
prsense daemon start
```

Daemon refuses to start if:

- Delivery enabled but credentials missing
- Webhook secret missing
- Required LLM credentials missing

# Inspecting Effective Configuration

You can inspect merged configuration:

```sh
prsense config inspect
```

This shows:

- Global config
- Repository config
- Effective merged config
- Runtime resolved config
- Credential availability

# Defaults

If no configuration is provided:

- `ollama` is used as default LLM
- `nomic-embed-text` used for embeddings
- Safe chunking defaults applied
- No delivery enabled

# Security Notes

- Never commit API keys.
- Never commit webhook secrets.
- Prefer GitHub App over PAT in production.
- Use separate credentials for staging/production.
- Global config should not contain secrets.

# Configuration Summary

| Type              | Location                              | Purpose                |
| ----------------- | ------------------------------------- | ---------------------- |
| Global defaults   | `~/.config/prsense/config.yml`        | Personal defaults      |
| Repository config | `prsense.yml`                         | Review behavior        |
| Credentials       | Environment variables                 | Secrets / API access   |
| Database          | Environment variables                 | Index storage          |
| Delivery channels | `prsense.yml` + environment variables | Posting review results |

PRSense enforces strict separation between domain behavior and runtime credentials to ensure reproducibility, determinism, and security.
