import type { UnifiedDiff } from "../diff/Diff.js";

export type ReviewPromptInput = {
  diff: UnifiedDiff;
  context: string;
  metadata?: {
    title?: string;
    description?: string;
  };
};

export function buildReviewPrompt(input: ReviewPromptInput): {
  system: string;
  user: string;
} {
  const system = `
You are a senior software engineer performing a code review.

You must:
- Identify bugs
- Identify risks
- Identify missing tests
- Identify convention issues

You MUST return valid JSON in the following format:

{
  "signals": [
    {
      "type": "bug" | "risk" | "test" | "style",
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

Return ONLY JSON.
`;

  // Convert UnifiedDiff → string
  const diffText = input.diff.files.map((f) => f.patch).join("\n\n");

  const user = `
${input.metadata?.title ? `## PR Title\n${input.metadata.title}\n\n` : ""}

${input.metadata?.description ? `## PR Description\n${input.metadata.description}\n\n` : ""}
## Pull Request Diff

${diffText}

## Retrieved Repository Context

${input.context}
`;

  return { system, user };
}
