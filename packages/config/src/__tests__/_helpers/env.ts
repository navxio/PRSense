// packages/config/src/__tests__/_helpers/env.ts
const PRSENSE_ENV_KEYS = [
  "PRSENSE_OPENAI_API_KEY",
  "PRSENSE_GOOGLE_API_KEY",
  "PRSENSE_ANTHROPIC_API_KEY",
  "PRSENSE_GITHUB_TOKEN",
  "PRSENSE_GITHUB_APP_ID",
  "PRSENSE_GITHUB_APP_PRIVATE_KEY",
  "PRSENSE_GITHUB_INSTALLATION_ID",
  "PRSENSE_GITHUB_WEBHOOK_SECRET",
  "PRSENSE_GITLAB_TOKEN",
  "PRSENSE_GITLAB_WEBHOOK_SECRET",
  "PRSENSE_SLACK_BOT_TOKEN",
  "XDG_CONFIG_HOME",
  "HOME",
];

let snapshot: Record<string, string | undefined> = {};

export function snapshotEnv() {
  snapshot = {};
  for (const k of PRSENSE_ENV_KEYS) snapshot[k] = process.env[k];
}

export function restoreEnv() {
  for (const k of PRSENSE_ENV_KEYS) {
    if (snapshot[k] === undefined) delete process.env[k];
    else process.env[k] = snapshot[k];
  }
}

export function clearPrsenseEnv() {
  for (const k of PRSENSE_ENV_KEYS) delete process.env[k];
}
