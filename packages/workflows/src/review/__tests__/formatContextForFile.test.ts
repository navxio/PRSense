// packages/workflows/src/review/__tests__/formatContextForFile.test.ts
import { describe, it, expect } from "@jest/globals";
import type { ContextChunk } from "@prsense/core";
import { formatContextForFile } from "../lib/formatContextForFile.js";

function fileChunk(path: string, content: string): ContextChunk {
  return {
    id: `chunk-${path}`,
    source: { kind: "file", path },
    content,
    provider: "rag",
  };
}

describe("formatContextForFile", () => {
  it("returns empty string for empty input", () => {
    expect(formatContextForFile([])).toBe("");
  });

  it("renders a single chunk with its path as a comment header", () => {
    const out = formatContextForFile([
      fileChunk("helpers/util.ts", "function helper() {}"),
    ]);
    expect(out).toContain("// helpers/util.ts");
    expect(out).toContain("function helper() {}");
  });

  it("renders multiple chunks separated by blank lines", () => {
    const out = formatContextForFile([
      fileChunk("a.ts", "const a = 1;"),
      fileChunk("b.ts", "const b = 2;"),
    ]);
    expect(out).toContain("// a.ts");
    expect(out).toContain("const a = 1;");
    expect(out).toContain("// b.ts");
    expect(out).toContain("const b = 2;");
  });

  it("stops adding chunks once total length would exceed budget", () => {
    const huge = "x".repeat(5000);
    const out = formatContextForFile([
      fileChunk("first.ts", huge),
      fileChunk("second.ts", huge),
    ]);
    expect(out).toContain("// first.ts");
    expect(out).not.toContain("// second.ts");
  });

  it("skips chunks whose source kind is not 'file'", () => {
    const chunks: ContextChunk[] = [
      {
        id: "non-file",
        source: { kind: "commit", sha: "abc123" } as ContextChunk["source"],
        content: "should be skipped",
      },
      fileChunk("real.ts", "real content"),
    ];
    const out = formatContextForFile(chunks);
    expect(out).not.toContain("should be skipped");
    expect(out).toContain("real content");
    expect(out).toContain("// real.ts");
  });
});
