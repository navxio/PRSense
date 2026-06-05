// apps/cli/src/commands/init/runFirstTimeSetup.ts
import prompts from "prompts";
import fs from "fs";
import yaml from "yaml";
import { CONFIG_PATH, PRSENSE_CONFIG_DIR } from "@prsense/core";
import { defaults as DEFAULT_CONFIG } from "@prsense/config";

type Provider = "ollama" | "openai" | "google";

const DEFAULT_LLM_MODELS: Record<Provider, string> = {
  ollama: "deepseek-coder-v2",
  openai: "gpt-4o-mini",
  google: "gemini-1.5-pro",
};

const DEFAULT_EMBEDDING_MODELS: Record<Provider, string> = {
  ollama: "nomic-embed-text",
  openai: "text-embedding-3-small",
  google: "text-embedding-004",
};

export async function runFirstTimeSetup() {
  console.log("\n⚡ PRSense first-time setup\n");

  // Handle Ctrl+C cleanly
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
  )) as { provider: Provider };

  console.log(
    "\nℹ Anthropic isn't offered here because it has no embeddings API.",
  );
  console.log(
    "  To use Claude for review, finish setup with another provider and",
    "edit your config to mix providers (e.g. Claude for review + Voyage",
    "for embeddings).\n",
  );

  let apiKey: string | null = null;

  if (provider !== "ollama") {
    const res = await prompts(
      {
        type: "password",
        name: "apiKey",
        message: "Enter API key:",
      },
      { onCancel },
    );

    apiKey = res.apiKey;
  }

  // ensure dir exists
  if (!fs.existsSync(PRSENSE_CONFIG_DIR)) {
    fs.mkdirSync(PRSENSE_CONFIG_DIR, { recursive: true });
  }

  // clone default config
  const config = structuredClone(DEFAULT_CONFIG);

  config.llm.provider = provider;
  config.llm.model = DEFAULT_LLM_MODELS[provider];
  config.embeddings.provider = provider;
  config.embeddings.model = DEFAULT_EMBEDDING_MODELS[provider];

  console.log(`✔ LLM model:        ${config.llm.model}`);
  console.log(`✔ Embeddings model: ${config.embeddings.model}\n`);

  // ✅ print config (dev trust boost)
  console.log("\n---");
  console.log(yaml.stringify(config));
  console.log("---\n");

  // ✅ API key instructions
  if (apiKey) {
    process.stdout.write("⠋ Validating API key...\r");

    try {
      await validateApiKey(provider, apiKey);
      console.log("✔ API key valid\n");

      const envVar = getEnvVarName(provider);
      process.env[envVar] = apiKey;

      console.log("👉 Add this to your shell:\n");
      console.log(`export ${envVar}=${apiKey}\n`);
    } catch (err: any) {
      console.log(`✖ ${err.message}\n`);
      process.exit(1);
    }
  } else {
    console.log("ℹ Using local Ollama (no API key required)\n");
  }

  fs.writeFileSync(CONFIG_PATH, yaml.stringify(config));

  console.log("\n✔ Config saved:", CONFIG_PATH);
  console.log("✔ Setup complete\n");
}

function getEnvVarName(provider: Provider): string {
  switch (provider) {
    case "openai":
      return "PRSENSE_OPENAI_API_KEY";
    case "google":
      return "PRSENSE_GOOGLE_API_KEY";
    default:
      return "";
  }
}

async function validateApiKey(
  provider: Provider,
  apiKey: string,
): Promise<void> {
  if (provider === "ollama") return;

  try {
    switch (provider) {
      case "openai": {
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        });

        if (!res.ok) throw new Error(await extractError(res));
        return;
      }

      case "google": {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`,
        );

        if (!res.ok) throw new Error(await extractError(res));
        return;
      }

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  } catch (err: any) {
    throw new Error(`API key validation failed: ${err.message}`);
  }
}

async function extractError(res: Response): Promise<string> {
  try {
    const data: any = await res.json();

    if (data && typeof data === "object") {
      if ("error" in data) {
        const err = data.error as any;
        if (typeof err === "string") return err;
        if (err?.message) return err.message;
      }

      if ("message" in data && typeof data.message === "string") {
        return data.message;
      }
    }

    return res.statusText || `HTTP ${res.status}`;
  } catch {
    return res.statusText || `HTTP ${res.status}`;
  }
}
