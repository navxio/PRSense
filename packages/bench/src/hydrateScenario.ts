// packages/bench/src/hydrateScenario.ts
import type { BenchmarkScenario } from "./types.js";
import { GitHubPrDiffProvider } from "@prsense/context";
import { extractPRDetails } from "./utils/PR.js";

type HydratedScenario = BenchmarkScenario & {
  diffSummary: {
    files: string[];
  };
};

const scenarioCache = new Map<string, HydratedScenario>();

export async function hydrateScenario(
  scenario: BenchmarkScenario,
): Promise<HydratedScenario> {
  if (scenarioCache.has(scenario.id)) {
    return scenarioCache.get(scenario.id)!;
  }

  const prUrl = scenario.reviewTarget;
  const prDetails: ReturnType<typeof extractPRDetails> =
    extractPRDetails(prUrl);
  const diffProvider = new GitHubPrDiffProvider(
    prDetails["owner"],
    prDetails["repo"],
    String(prDetails["prNumber"]),
  );

  const { diff } = await diffProvider.load();

  const hydrated: HydratedScenario = {
    ...scenario,
    diffSummary: {
      files: diff.files.map((f) => f.path),
    },
  };

  scenarioCache.set(scenario.id, hydrated);

  return hydrated;
}
