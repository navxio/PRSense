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

Important:
- Only report real, concrete issues introduced by this change.
- If the change is correct and introduces no meaningful problems, return:
  {
    "signals": []
  }
- Do NOT invent issues.
- Do NOT speculate.
- Do NOT provide stylistic suggestions unless clearly warranted.
- Do NOT generate generic advice.
- Do NOT repeat what the diff already clearly shows.
- Do NOT summarize the changes.
- Only report problems, risks, or missing tests.
- Every signal must identify a specific problem, not a description.
- If there is no problem, return an empty signals array.

You MUST return ONLY valid JSON.
You MUST NOT include explanations.
You MUST NOT include markdown.

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
