import prompts from "prompts";
import fs from "fs";
import yaml from "yaml";
import { PRSENSE_DIR, CONFIG_PATH } from "./firstRun.js";
import { DEFAULT_CONFIG } from "./defaultConfig.js";

type Provider = "ollama" | "openai" | "anthropic" | "google";
const DEFAULT_MODELS: Record<Provider, string> = {
  ollama: "qwen2.5-coder",
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-sonnet-latest",
  google: "gemini-1.5-pro",
};

export async function runFirstTimeSetup() {
  console.log("\n⚡ PRSense first-time setup\n");

  // Handle Ctrl+C cleanly
  const onCancel = () => {
    console.log("\n✖ Setup cancelled\n");
    process.exit(1);
  };

  const { provider } = await prompts(
    {
      type: "select",
      name: "provider",
      message: "Choose LLM provider:",
      choices: [
        { title: "Ollama (local)", value: "ollama" },
        { title: "OpenAI", value: "openai" },
        { title: "Anthropic", value: "anthropic" },
        { title: "Google", value: "google" },
      ],
    },
    { onCancel }
  ) as { provider: Provider };

  let apiKey: string | null = null;

  if (provider !== "ollama") {
    const res = await prompts(
      {
        type: "password",
        name: "apiKey",
        message: "Enter API key:",
      },
      { onCancel }
    );

    apiKey = res.apiKey;
  }

  // ensure dir exists
  if (!fs.existsSync(PRSENSE_DIR)) {
    fs.mkdirSync(PRSENSE_DIR, { recursive: true });
  }

  // clone default config
  const config = structuredClone(DEFAULT_CONFIG);

  config.llm.provider = provider;
  config.llm.model = DEFAULT_MODELS[provider];
  console.log(`✔ Using model: ${config.llm.model}\n`);

  fs.writeFileSync(CONFIG_PATH, yaml.stringify(config));

  console.log("\n✔ Config saved:", CONFIG_PATH);

  // ✅ print config (dev trust boost)
  console.log("\n---");
  console.log(yaml.stringify(config));
  console.log("---\n");

  // ✅ API key instructions
  if (apiKey) {
    const envVar = getEnvVarName(provider);
    process.env[envVar] = apiKey;

    console.log("👉 Add this to your shell:\n");
    console.log(`export ${envVar}=${apiKey}\n`);
  } else {
    console.log("ℹ Using local Ollama (no API key required)\n");
  }

  console.log("✔ Setup complete\n");
}

function getEnvVarName(provider: Provider): string {
  switch (provider) {
    case "openai":
      return "PRSENSE_OPENAI_API_KEY";
    case "anthropic":
      return "PRSENSE_ANTHROPIC_API_KEY";
    case "google":
      return "PRSENSE_GOOGLE_API_KEY";
    default:
      return "";
  }
}