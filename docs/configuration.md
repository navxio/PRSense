## Configuration

PRSense separates review behavior from runtime infrastructure configuration.

- `prsense.yml` → defines how PRSense behaves as a reviewer (domain configuration).
- Environment variables → configure credentials, delivery, and infrastructure (runtime configuration).

This separation ensures reproducible reviews while keeping secrets out of source control.

---

## Repository Configuration (`prsense.yml`)

Placed at the root of your repository.

This file defines:

- LLM selection
- Embeddings model
- Indexing behavior
- Review thresholds
- Retrieval limits
- Delivery channels (daemon mode)

### Example

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
  maxFileSizeBytes: 1048576 # 1 MB

review:
  confidenceThreshold: 0.6
  maxSignals: 10

context:
  maxChunks: 5

git:
  baseBranch: main

# Only required in daemon mode
delivery:
  vcs: github # github | gitlab
  other:
    - slack
```

---

## Configuration Sections Explained

### `llm`

Controls the language model used for review generation.

Supported providers:

- `ollama`
- `openai`
- `google` (Gemini)
- `anthropic` (Claude)

`temperature` controls randomness (lower = more deterministic).

### `embeddings`

Controls the embedding model used for indexing and retrieval.

- Must match the model used during indexing.
- Changing embeddings requires re-indexing.

### `index`

Controls repository chunking behavior.

- `chunkSizeChars` — max characters per chunk.
- `chunkOverlapChars` — overlap between chunks.
- `maxFileSizeBytes` — files larger than this are skipped.

### `review`

Controls post-processing of model output.

- `confidenceThreshold` — minimum confidence to emit a signal.
- `maxSignals` — maximum number of issues returned.

### `context`

Controls retrieval (RAG).

- `maxChunks` — maximum indexed chunks retrieved per review.

### `delivery` (Daemon Mode Only)

Defines where PRSense posts review results.

```yaml
delivery:
  vcs: github
  other:
    - slack
```

- `vcs` → the primary version control system.
- `other` → optional additional channels.

This section is ignored in CLI mode.

---

## Environment Variables

Environment variables configure runtime infrastructure and credentials.

They are never stored in `prsense.yml`.

### LLM Credentials

| Provider | Required Variable                                                      |
| -------- | ---------------------------------------------------------------------- |
| OpenAI   | `PRSENSE_OPENAI_API_KEY`                                               |
| Gemini   | `PRSENSE_GEMINI_API_KEY`                                               |
| Claude   | `PRSENSE_CLAUDE_API_KEY`                                               |
| Ollama   | `PRSENSE_OLLAMA_HOST` (optional, defaults to `http://127.0.0.1:11434`) |

### Embeddings (if using OpenAI)

```
PRSENSE_OPENAI_API_KEY
```

### Database

Used for indexing. If not provided, PRSense uses a bundled Docker Postgres instance.

```
PRSENSE_DATABASE_URL
```

Example:

```
postgresql://prsense:prsense@localhost:10000/prsense_dev
```

### GitHub Delivery

**Option 1 — Personal Access Token**

```
PRSENSE_GITHUB_TOKEN
PRSENSE_GITHUB_WEBHOOK_SECRET
```

**Option 2 — GitHub App (recommended for SaaS)**

```
PRSENSE_GITHUB_APP_ID
PRSENSE_GITHUB_APP_PRIVATE_KEY
PRSENSE_GITHUB_INSTALLATION_ID
PRSENSE_GITHUB_WEBHOOK_SECRET
```

### GitLab Delivery

```
PRSENSE_GITLAB_TOKEN
PRSENSE_GITLAB_WEBHOOK_SECRET
```

### Slack Delivery

```
PRSENSE_SLACK_BOT_TOKEN
```

### Logging

```
PRSENSE_LOG_LEVEL=debug | info | warn | error
```

---

## CLI Mode vs Daemon Mode

### CLI Mode

- No delivery required.
- Can review local repositories.
- No webhook secrets required.
- Delivery section in `prsense.yml` is ignored.

Example:

```sh
prsense review .
```

### Daemon Mode

- Requires delivery configuration.
- Requires webhook secret.
- Requires VCS credentials.
- Validates credentials at startup.

Example:

```sh
prsense daemon start
```

Daemon will refuse to start if:

- Delivery is enabled but credentials are missing.
- Webhook secret is not configured.
- LLM credentials are missing.

---

## Defaults

If `prsense.yml` is missing, PRSense uses:

- `ollama` as LLM
- `nomic-embed-text` for embeddings
- Safe chunking defaults
- No delivery (CLI mode)

---

## Security Notes

- Never commit API keys.
- Never commit webhook secrets.
- Prefer GitHub App over PAT in production.
- Use environment-specific credentials for daemon mode.

---

## Summary

| Configuration Type | Location              | Purpose                     |
| ------------------ | --------------------- | --------------------------- |
| Review behavior    | `prsense.yml`         | Controls model and indexing |
| Credentials        | Environment variables | Secrets and API access      |
| Database           | Environment variables | Index storage               |
| Delivery           | `prsense.yml` + env   | Posting review results      |

PRSense enforces strict separation between domain behavior and runtime credentials to ensure reproducibility and security.
