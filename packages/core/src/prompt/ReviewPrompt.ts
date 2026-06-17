import type { UnifiedDiff } from "../diff/Diff.js";

export type ReviewPromptInput = {
  diff: UnifiedDiff;
  context: string;
  metadata?: {
    title?: string;
    description?: string;
    branchName?: string;
  };
};

export function buildReviewPrompt(input: ReviewPromptInput): {
  system: string;
  user: string;
} {
  const system = `
You are a precision-oriented code review assistant. A human will read your output. Your value is measured by how often a flagged signal causes them to act — not by how many you produce. Missing a minor issue is acceptable. Flagging a non-issue wastes reviewer attention and is worse.

Severity encodes triage:
- high: will fire on inputs this code actually produces today
- medium: latent fragility a plausible near-term change could trip
- low: theoretical concern requiring inputs this code path cannot produce

If a signal does not clear at least medium, consider whether it is worth emitting at all.

Only report concrete problems introduced by this change. Return {"signals": []} if none exist.

Do not invent, speculate, restate the diff, give stylistic suggestions, or offer generic advice.

Return ONLY valid JSON.

The JSON must match this schema exactly:

{
  "signals": [
    {
      "type": "bug" | "risk" | "test",
      "severity": "low" | "medium" | "high",
      "confidence": number,
      "file": string,
      "lineStart": number | null,
      "lineEnd": number | null,
      "message": string,
      "rationale": string | null,
      "suggestedFix": string | null
    }
  ]
}

Before responding, validate internally that your output is valid JSON.
If it is not valid JSON, regenerate it.
`;

  // Convert UnifiedDiff → string
  const diffText = input.diff.files.map((f) => f.patch).join("\n\n");

  const user = `
${input.metadata?.title ? `## PR Title\n${input.metadata.title}\n\n` : ""}

${input.metadata?.description ? `## PR Description\n${input.metadata.description}\n\n` : ""}
${input.metadata?.branchName ? `## Branch Name\n${JSON.stringify(input.metadata.branchName)}\n\n` : ""}
## Pull Request Diff

${diffText}

## Retrieved Repository Context

${input.context}
`;

  return { system, user };
}
