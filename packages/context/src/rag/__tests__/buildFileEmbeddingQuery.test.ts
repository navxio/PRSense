// packages/context/src/providers/rag/__tests__/buildFileEmbeddingQuery.test.ts
import { describe, it, expect } from "@jest/globals";
import type { DiffFile } from "@prsense/core";
import { buildFileEmbeddingQuery } from "../buildFileEmbeddingQuery.js";

function makeFile(overrides: Partial<DiffFile> = {}): DiffFile {
  return {
    path: "src/auth/session.ts",
    patch:
      "--- a/src/auth/session.ts\n+++ b/src/auth/session.ts\n@@ -1,5 +1,5 @@\n-old\n+new",
    hunks: [
      {
        startLine: 1,
        endLine: 5,
        content:
          "@@ -1,5 +1,5 @@\nexport function createSession(userId: string) {\n  return { userId };\n}",
      },
    ],
    ...overrides,
  };
}

describe("buildFileEmbeddingQuery", () => {
  it("includes the file path", () => {
    const query = buildFileEmbeddingQuery({ file: makeFile() });
    expect(query).toContain("src/auth/session.ts");
  });

  it("includes hunk content when hunks are present", () => {
    const query = buildFileEmbeddingQuery({ file: makeFile() });
    expect(query).toContain("createSession");
  });

  it("falls back to the raw patch when hunks are absent", () => {
    const query = buildFileEmbeddingQuery({
      file: makeFile({ hunks: undefined }),
    });
    expect(query).toContain("--- a/src/auth/session.ts");
  });

  it("includes the PR title when provided", () => {
    const query = buildFileEmbeddingQuery({
      file: makeFile(),
      prMetadata: { title: "Add TTL to session creation" },
    });
    expect(query).toContain("Add TTL to session creation");
  });

  it("omits PR title prefix when no metadata provided", () => {
    const query = buildFileEmbeddingQuery({ file: makeFile() });
    expect(query).not.toContain("PR title:");
  });

  it("truncates the body to fit an explicit maxChars", () => {
    const largeHunk = "x".repeat(10_000);
    const query = buildFileEmbeddingQuery({
      file: makeFile({
        hunks: [{ startLine: 1, endLine: 100, content: largeHunk }],
      }),
      maxChars: 1000,
    });
    expect(query.length).toBeLessThanOrEqual(1000);
  });

  it("does not truncate when content fits within budget", () => {
    const query = buildFileEmbeddingQuery({
      file: makeFile(),
      maxChars: 10_000,
    });
    expect(query.length).toBeLessThan(10_000);
    expect(query).toContain("createSession");
  });

  it("applies a default maxChars when none is specified", () => {
    const largeHunk = "x".repeat(20_000);
    const query = buildFileEmbeddingQuery({
      file: makeFile({
        hunks: [{ startLine: 1, endLine: 100, content: largeHunk }],
      }),
    });
    // Default is 4000; allow the header to push it slightly under
    expect(query.length).toBeLessThanOrEqual(4000);
  });

  it("preserves the header even when the body is heavily truncated", () => {
    const largeHunk = "x".repeat(20_000);
    const query = buildFileEmbeddingQuery({
      file: makeFile({
        path: "important/file.ts",
        hunks: [{ startLine: 1, endLine: 100, content: largeHunk }],
      }),
      prMetadata: { title: "Critical PR" },
      maxChars: 500,
    });
    expect(query).toContain("Critical PR");
    expect(query).toContain("important/file.ts");
  });
});
