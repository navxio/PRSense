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

You MUST return ONLY valid JSON.
You MUST NOT include explanations.
You MUST NOT include markdown.
You MUST NOT include prose.

Your entire response must be strictly valid JSON.

The JSON must match this schema exactly:

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
No backticks.
No commentary.
No extra text.
Before responding, validate internally that your output is valid JSON.
If it is not valid JSON, regenerate it.
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
