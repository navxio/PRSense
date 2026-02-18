export type ReviewPromptInput = {
  diff: string;
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
You are an expert senior software engineer reviewing a pull request.

Use the provided diff and surrounding repository context to:
- Identify bugs
- Identify risks
- Identify missing tests
- Identify style or convention issues
`;

  const user = `
## Pull Request Diff

${input.diff}

## Retrieved Repository Context

${input.context}

Provide a structured review.
`;

  return { system, user };
}
