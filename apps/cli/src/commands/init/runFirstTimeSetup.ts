// apps/cli/src/commands/init/runFirstTimeSetup.ts
import prompts from "prompts";
import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";
import { CONFIG_PATH, PRSENSE_CONFIG_DIR } from "@prsense/core";
import { RuntimeConfigSchema } from "@prsense/config";

// init only offers a subset of LLM providers (Anthropic has no embeddings API)
type InitProvider = "ollama" | "openai" | "google";
type ApiKeyProvider = Exclude<InitProvider, "ollama">;

const DEFAULT_LLM_MODELS: Record<InitProvider, string> = {
  ollama: "deepseek-coder-v2",
  openai: "gpt-5.4-mini",
  google: "gemini-2.5-flash",
};

const DEFAULT_EMBEDDING_MODELS: Record<InitProvider, string> = {
  ollama: "nomic-embed-text",
  openai: "text-embedding-3-small",
  google: "gemini-embedding-001",
};

const ENV_VAR_BY_PROVIDER: Record<ApiKeyProvider, string> = {
  openai: "PRSENSE_OPENAI_API_KEY",
  google: "PRSENSE_GOOGLE_API_KEY",
};

export async function runFirstTimeSetup() {
  console.log("\n⚡ PRSense first-time setup\n");

  const onCancel = () => {
    console.log("\n✖ Setup cancelled\n");
    process.exit(1);
  };

  const { provider } = (await prompts(
    {
      type: "select",
      name: "provider",
      message: "Choose provider (used for both review and embeddings):",
      choices: [
        { title: "Ollama (local)", value: "ollama" },
        { title: "OpenAI", value: "openai" },
        { title: "Google", value: "google" },
      ],
    },
    { onCancel },
  )) as { provider: InitProvider };

  console.log(
    "\nℹ Anthropic isn't offered here because it has no embeddings API.",
  );
  console.log(
    "  To use Claude for review, finish setup with another provider and",
    "edit your config to mix providers.\n",
  );

  // Build config through the schema — defaults fill in everything else.
  const config = RuntimeConfigSchema.parse({
    llm: { provider, model: DEFAULT_LLM_MODELS[provider] },
    embeddings: { provider, model: DEFAULT_EMBEDDING_MODELS[provider] },
  });

  console.log(`✔ LLM model:        ${config.llm.model}`);
  console.log(`✔ Embeddings model: ${config.embeddings.model}\n`);
  console.log("---");
  console.log(yaml.stringify(config));
  console.log("---\n");

  if (provider !== "ollama") {
    await collectAndPersistApiKey(provider, onCancel);
  } else {
    console.log("ℹ Using local Ollama (no API key required)\n");
  }

  if (!fs.existsSync(PRSENSE_CONFIG_DIR)) {
    fs.mkdirSync(PRSENSE_CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_PATH, yaml.stringify(config));

  console.log("\n✔ Config saved:", CONFIG_PATH);
  console.log("✔ Setup complete\n");
}

async function collectAndPersistApiKey(
  provider: ApiKeyProvider,
  onCancel: () => void,
) {
  const { apiKey } = await prompts(
    { type: "password", name: "apiKey", message: "Enter API key:" },
    { onCancel },
  );

  if (!apiKey) {
    console.log("✖ No API key provided\n");
    process.exit(1);
  }

  process.stdout.write("⠋ Validating API key...\r");
  try {
    await validateApiKey(provider, apiKey);
  } catch (err: any) {
    console.log(`✖ ${err.message}\n`);
    process.exit(1);
  }
  console.log("✔ API key valid\n");

  const envVar = ENV_VAR_BY_PROVIDER[provider];
  process.env[envVar] = apiKey;
  const envFile = path.join(process.cwd(), ".env");
  const appended = upsertEnvVar(envFile, envVar, apiKey);
  console.log(`✔ ${appended ? "Wrote" : "Updated"} ${envVar} in ${envFile}\n`);
}

function upsertEnvVar(file: string, key: string, value: string): boolean {
  const line = `${key}=${value}`;
  const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const lines = existing.split("\n");
  const idx = lines.findIndex((l) => l.startsWith(`${key}=`));

  let appended = false;
  if (idx >= 0) {
    lines[idx] = line;
  } else {
    if (existing.length && !existing.endsWith("\n")) lines.push("");
    lines.push(line);
    appended = true;
  }

  fs.writeFileSync(file, lines.join("\n").replace(/\n+$/, "\n"));
  return appended;
}

async function validateApiKey(
  provider: ApiKeyProvider,
  apiKey: string,
): Promise<void> {
  const url =
    provider === "openai"
      ? "https://api.openai.com/v1/models"
      : `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;

  const headers =
    provider === "openai" ? { Authorization: `Bearer ${apiKey}` } : {};

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(await extractError(res));
  } catch (err: any) {
    throw new Error(`API key validation failed: ${err.message}`);
  }
}

async function extractError(res: Response): Promise<string> {
  try {
    const data: any = await res.json();
    if (data?.error) {
      return typeof data.error === "string"
        ? data.error
        : (data.error.message ?? "");
    }
    if (typeof data?.message === "string") return data.message;
  } catch {}
  return res.statusText || `HTTP ${res.status}`;
}
