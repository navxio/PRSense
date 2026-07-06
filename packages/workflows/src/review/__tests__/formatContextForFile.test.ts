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

  it("renders the type-references section under its own label", () => {
    const chunk: ContextChunk = {
      id: "t1",
      source: { kind: "file", path: "svc.ts" },
      content: "greet(u: User)",
      provider: "type-references",
    };
    const out = formatContextForFile([chunk]);
    expect(out).toContain("### Type-shape dependents of changed symbols");
    expect(out).toContain("greet(u: User)");
  });

  it("orders references before type-references before rag", () => {
    const mk = (p: ContextChunk["provider"], c: string): ContextChunk => ({
      id: c,
      source: { kind: "file", path: `${c}.ts` },
      content: c,
      provider: p,
    });
    const out = formatContextForFile([
      mk("rag", "ragbody"),
      mk("type-references", "typebody"),
      mk("references", "refbody"),
    ]);
    const iRef = out.indexOf("refbody");
    const iType = out.indexOf("typebody");
    const iRag = out.indexOf("ragbody");
    expect(iRef).toBeGreaterThan(-1);
    expect(iType).toBeGreaterThan(-1);
    expect(iRag).toBeGreaterThan(-1);
    expect(iRef).toBeLessThan(iType);
    expect(iType).toBeLessThan(iRag);
  });
});

// Covers the provider-section machinery the existing tests skip (they only use
// "rag"): section ordering + labels, reference sub-grouping by symbol, the
// truncated marker + its guards, renderChunk line-suffix / (test) variants, and
// budget exhaustion cutting off later sections.
// All assertions verified against real output.

function chunk(o: Partial<ContextChunk> & { content: string }): ContextChunk {
  return {
    id: "x",
    source: { kind: "file", path: "f.ts" },
    content: o.content,
    provider: o.provider,
    metadata: o.metadata,
  } as ContextChunk;
}

describe("formatContextForFile — provider sections", () => {
  it("renders sections in reference → type-reference → rag order with labels", () => {
    const out = formatContextForFile([
      chunk({ provider: "rag", content: "RAGC" }),
      chunk({
        provider: "references",
        content: "REFC",
        metadata: { symbols: ["foo"] },
      }),
      chunk({
        provider: "type-references",
        content: "TYPEC",
        metadata: { symbols: ["bar"] },
      }),
    ]);

    expect(out).toContain("### Direct callers of changed symbols");
    expect(out).toContain("### Type-shape dependents of changed symbols");
    expect(out).toContain("### Similar code");
    // Ordering: references section precedes type-references precedes rag.
    expect(out.indexOf("Direct callers")).toBeLessThan(
      out.indexOf("Type-shape dependents"),
    );
    expect(out.indexOf("Type-shape dependents")).toBeLessThan(
      out.indexOf("Similar code"),
    );
  });

  it("defaults a chunk with no provider into the rag section", () => {
    const out = formatContextForFile([chunk({ content: "NOPROV" })]);
    expect(out).toContain("### Similar code");
    expect(out).toContain("NOPROV");
  });
});

describe("formatContextForFile — reference grouping", () => {
  it("groups references by symbol and emits a truncation marker per symbol", () => {
    const out = formatContextForFile([
      chunk({
        provider: "references",
        content: "R1",
        metadata: { symbols: ["foo"], truncated: { shown: 2, total: 5 } },
      }),
      chunk({
        provider: "references",
        content: "R2",
        metadata: { symbols: ["foo"] },
      }),
    ]);
    expect(out).toContain("// 5 references to foo; 2 shown");
    expect(out).toContain("R1");
    expect(out).toContain("R2");
  });

  it("falls back to <unknown> when a reference chunk has no symbols", () => {
    const out = formatContextForFile([
      chunk({ provider: "references", content: "R", metadata: {} }),
    ]);
    expect(out).toContain("R");
    // No marker without truncation metadata.
    expect(out).not.toContain("references to");
  });

  it("omits the marker when truncated metadata is malformed", () => {
    const out = formatContextForFile([
      chunk({
        provider: "references",
        content: "A",
        metadata: { symbols: ["z"], truncated: true }, // not an object
      }),
      chunk({
        provider: "references",
        content: "B",
        metadata: { symbols: ["y"], truncated: { shown: 1 } }, // missing total
      }),
    ]);
    expect(out).not.toContain("references to");
    expect(out).toContain("A");
    expect(out).toContain("B");
  });
});

describe("formatContextForFile — chunk rendering", () => {
  it("formats line suffixes and tags test chunks", () => {
    const out = formatContextForFile([
      chunk({ content: "A", metadata: { lineStart: 5 } }), // :5
      chunk({ content: "B", metadata: { lineStart: 5, lineEnd: 9 } }), // :5-9
      chunk({
        content: "T",
        metadata: { lineStart: 1, lineEnd: 1, kind: "test" },
      }), // :1 (test)
    ]);
    expect(out).toContain("// f.ts:5\nA");
    expect(out).toContain("// f.ts:5-9\nB");
    expect(out).toContain("// f.ts:1 (test)\nT");
  });

  it("omits the line suffix when no line numbers are present", () => {
    const out = formatContextForFile([chunk({ content: "X" })]);
    expect(out).toContain("// f.ts\nX");
    expect(out).not.toContain("// f.ts:");
  });
});

describe("formatContextForFile — budget", () => {
  it("drops later sections once the budget is exhausted", () => {
    // A references section that nearly fills the 8000-char budget leaves no
    // room for the rag section → the main loop breaks on the empty section.
    const huge = "x".repeat(7945);
    const out = formatContextForFile([
      chunk({
        provider: "references",
        content: huge,
        metadata: { symbols: ["foo"] },
      }),
      chunk({ provider: "rag", content: "RAGTAIL" }),
    ]);
    expect(out).toContain("### Direct callers of changed symbols");
    expect(out).not.toContain("### Similar code");
    expect(out).not.toContain("RAGTAIL");
  });
});
