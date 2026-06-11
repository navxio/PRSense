// apps/cli/src/commands/init/ollamaHelper.ts
const OLLAMA_HOST = process.env.PRSENSE_OLLAMA_HOST ?? "http://localhost:11434";

export async function checkOllama(
  llmModel: string,
  embeddingModel: string,
): Promise<void> {
  // 1. Daemon reachable?
  let installed: string[];
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { models?: Array<{ name: string }> };
    installed = (data.models ?? []).map((m) => m.name);
  } catch (err: any) {
    throw new Error(
      `Ollama not reachable at ${OLLAMA_HOST}: ${err.message}\n` +
        `  Start it with \`ollama serve\` or set PRSENSE_OLLAMA_HOST.`,
    );
  }

  console.log(`✔ Ollama reachable at ${OLLAMA_HOST}`);

  // 2. Both models present? (ollama tags often include `:latest`)
  const has = (model: string) =>
    installed.some((name) => name === model || name.startsWith(`${model}:`));

  const missing = [llmModel, embeddingModel].filter((m) => !has(m));
  if (missing.length === 0) {
    console.log(`✔ Both models available: ${llmModel}, ${embeddingModel}\n`);
    return;
  }

  console.log(`⚠ Missing models: ${missing.join(", ")}`);
  for (const m of missing) console.log(`    ollama pull ${m}`);
  console.log(""); // spacer — init continues
}
