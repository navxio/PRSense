// packages/core/src/prompt/__tests__/ReviewPrompt.test.ts
import { describe, it, expect } from "@jest/globals";
import { buildReviewPrompt } from "../ReviewPrompt.js";
import type { UnifiedDiff } from "../../diff/Diff.js";

const sampleDiff: UnifiedDiff = {
  files: [
    {
      path: "src/auth.ts",
      patch: `--- a/src/auth.ts
+++ b/src/auth.ts
@@ -1,3 +1,3 @@
 export function login(user: string) {
-  return user.length > 0;
+  return user.trim().length > 0;
 }`,
      hunks: [
        {
          startLine: 1,
          endLine: 3,
          content: "  return user.trim().length > 0;",
        },
      ],
    },
  ],
};

describe("buildReviewPrompt", () => {
  it("renders the full prompt with all metadata fields and context", () => {
    const prompt = buildReviewPrompt({
      diff: sampleDiff,
      context: `// helpers/validation.ts\nexport function isValidUser(s: string) { return s.length > 0; }`,
      metadata: {
        title: "Trim user input before length check",
        description:
          "Whitespace-only usernames currently authenticate. Fix by trimming first.",
        branchName: "fix/auth-trim-whitespace",
      },
    });

    expect(prompt.system).toMatchInlineSnapshot(`
"You are a precision-oriented code review assistant. A human will read your output. Your value is measured by how often a flagged signal causes them to act — not by how many you produce. Missing a minor issue is acceptable. Flagging a non-issue wastes reviewer attention and is worse.

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
"
`);
    expect(prompt.user).toMatchInlineSnapshot(`
"## PR Title
Trim user input before length check

## PR Description
Whitespace-only usernames currently authenticate. Fix by trimming first.

## Branch Name
fix/auth-trim-whitespace

## Pull Request Diff
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -1,3 +1,3 @@
 export function login(user: string) {
-  return user.length > 0;
+  return user.trim().length > 0;
 }

## Retrieved Repository Context
// helpers/validation.ts
export function isValidUser(s: string) { return s.length > 0; }"
`);
  });

  it("renders the prompt with no metadata and empty context", () => {
    const prompt = buildReviewPrompt({
      diff: sampleDiff,
      context: "",
    });

    expect(prompt.system).toMatchInlineSnapshot(`
"You are a precision-oriented code review assistant. A human will read your output. Your value is measured by how often a flagged signal causes them to act — not by how many you produce. Missing a minor issue is acceptable. Flagging a non-issue wastes reviewer attention and is worse.

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
"
`);
    expect(prompt.user).toMatchInlineSnapshot(`
"## Pull Request Diff
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -1,3 +1,3 @@
 export function login(user: string) {
-  return user.length > 0;
+  return user.trim().length > 0;
 }

## Retrieved Repository Context
"
`);
  });
});
