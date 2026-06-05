export function ensureEnv(provider: string) {
  const map: Record<string, string> = {
    openai: "PRSENSE_OPENAI_API_KEY",
    anthropic: "PRSENSE_ANTHROPIC_API_KEY",
    google: "PRSENSE_GOOGLE_API_KEY",
  };

  const envVar = map[provider];

  if (!envVar) return;

  if (!process.env[envVar]) {
    console.error(`\n❌ Missing ${envVar}\n`);
    console.error("Run `prsense setup` to configure.\n");
    process.exit(1);
  }
}