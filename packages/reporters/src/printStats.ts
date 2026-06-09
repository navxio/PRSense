// packages/reporters/src/stats/printStats.ts

//TODO: move to proper stats reporter
import kleur from "kleur";
import { computeStats } from "./computeStats.js";
import type { ReportStatsInput } from "./types.js";

export function printStats(input: ReportStatsInput) {
  const stats = computeStats(input);

  const seconds = (stats.durationMs / 1000).toFixed(2);

  console.log("\n" + kleur.bold("PRSense Review Report"));
  console.log(kleur.gray("────────────────────────────────"));

  // --- Model Info ---
  console.log("\n" + kleur.bold("Model"));
  console.log(`  Provider     ${kleur.cyan(input.model.provider)}`);
  console.log(`  Model        ${kleur.cyan(input.model.name)}`);

  // --- Indexing ---
  if (input.context.indexing?.enabled) {
    console.log("\n" + kleur.bold("Indexing"));
    console.log(
      `  Embeddings   ${input.context.indexing.provider}/${input.context.indexing.model}`,
    );
  }

  // --- Outcome ---
  console.log("\n" + kleur.bold("Outcome"));
  console.log(
    `  Status       ${
      input.outcome === "success"
        ? kleur.green("success")
        : kleur.red("failure")
    }`,
  );

  // --- Signals ---
  console.log("\n" + kleur.bold("Signals"));
  console.log(`  Count        ${stats.totalSignals}`);
  console.log(`  Hallucinated ${kleur.yellow(stats.hallucinated)}`);
  console.log(`  Rate         ${(stats.hallucinationRate * 100).toFixed(1)}%`);

  // --- Tokens ---
  console.log("\n" + kleur.bold("Tokens"));
  console.log(`  Prompt       ${stats.promptTokens}`);
  console.log(`  Completion   ${stats.completionTokens}`);
  console.log(`  Total        ${stats.totalTokens}`);
  console.log(`  / Signal     ${stats.tokensPerSignal.toFixed(2)}`);

  // --- Performance ---
  console.log("\n" + kleur.bold("Performance"));
  console.log(`  Latency      ${seconds}s`);
  console.log(`  Signals/sec  ${stats.signalsPerSecond.toFixed(2)}`);
  console.log(`  Tokens/sec   ${stats.tokensPerSecond.toFixed(2)}`);

  console.log("");
}
