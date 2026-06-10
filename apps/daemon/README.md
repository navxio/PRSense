### @prsense/daemon

`@prsense/daemon`
The daemon runs PRSense as a long-lived HTTP service, intended for automation and webhook-based review. It is distributed as a separate package.

#### Install and start the daemon

```bash
npm i -g @prsense/daemon
prsense-daemon
```

By default, it listens on:

```
http://localhost:11000
```

#### Health & Readiness

```
GET /health
GET /ready
```

Example:

```bash
curl http://localhost:11000/health
```

#### Trigger Review via API

```
POST /jobs/review
```

Example:

```bash
curl -X POST http://localhost:11000/jobs/review \
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
curl -X POST http://localhost:11000/jobs/index \
  -H "Content-Type: application/json" \
  -d '{"target":"https://github.com/owner/repo"}'
```

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

## Configuration

### Example Config

```yaml
llm:
  provider: ollama # ollama | openai | google | anthropic
  model: deepseek-coder-v2
  temperature: 0.1

embeddings:
  provider: ollama # ollama | openai
  model: nomic-embed-text

index:
  chunkSizeChars: 1000
  chunkOverlapChars: 200

review:
  confidenceThreshold: 0.8
  maxSignals: 3

context:
  maxChunks: 5

git:
  baseBranch: main

delivery:
  platform: github # github | gitlab
```

## `delivery`

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

### Daemon Mode

- Loads global config at startup
- Validates credentials at boot
- Requires delivery configuration
- Requires webhook secrets
- Loads repo config dynamically per review job

Start daemon:

```sh
prsense-daemon
```

Daemon refuses to start if:

- Delivery enabled but credentials missing
- Webhook secret missing
- Required LLM credentials missing
