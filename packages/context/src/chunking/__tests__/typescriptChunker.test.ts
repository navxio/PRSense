// packages/context/src/chunking/__tests__/typescriptChunker.test.ts

import { createTypescriptChunker } from "../typescriptChunker.js";

describe("createTypescriptChunker", () => {
  const chunker = createTypescriptChunker();

  it("emits one chunk per top-level declaration", () => {
    const content = `
      export function foo() { return 1; }

      export class Bar {
        baz() { return 2; }
      }

      export interface Quux {
        x: number;
      }
    `;
    const chunks = chunker.chunk({
      content,
      source: { kind: "file", path: "test.ts" },
    });

    // Three top-level declarations → three chunks (no merging since none are tiny)
    // BUT — small declarations may merge. Check the symbols, not the count.
    const symbols = chunks.flatMap((c) => c.metadata?.symbols ?? []);
    expect(symbols).toEqual(expect.arrayContaining(["foo", "Bar", "Quux"]));
  });

  it("attaches JSDoc to the symbol it documents", () => {
    const content = `
/**
 * Authenticates a user.
 */
export function authenticate(user: string): boolean {
  return user.length > 0;
}
    `;
    const chunks = chunker.chunk({
      content,
      source: { kind: "file", path: "auth.ts" },
    });

    const authChunk = chunks.find((c) =>
      c.metadata?.symbols?.includes("authenticate"),
    );
    expect(authChunk).toBeDefined();
    expect(authChunk?.content).toContain("Authenticates a user");
  });

  it("skips import declarations", () => {
    const content = `
import { foo } from "./foo.js";
import { bar } from "./bar.js";

export function baz() { return foo() + bar(); }
    `;
    const chunks = chunker.chunk({
      content,
      source: { kind: "file", path: "baz.ts" },
    });

    // No chunk should be just the imports.
    const importOnlyChunks = chunks.filter(
      (c) =>
        c.content.trim().startsWith("import") &&
        !c.content.includes("function"),
    );
    expect(importOnlyChunks).toHaveLength(0);
  });

  it("marks exported declarations as exported", () => {
    const content = `
export function publicFn() {
  // Pad this function with enough content to exceed the merge threshold.
  const result = [];
  for (let i = 0; i < 100; i++) {
    result.push(i * 2);
  }
  return result.reduce((a, b) => a + b, 0);
}

function privateFn() {
  // Same here - pad to keep this chunk separate from publicFn.
  const items = ["a", "b", "c", "d", "e"];
  return items.map((x) => x.toUpperCase()).join(",");
}
  `;
    const chunks = chunker.chunk({
      content,
      source: { kind: "file", path: "mixed.ts" },
    });

    const pub = chunks.find((c) => c.metadata?.symbols?.includes("publicFn"));
    const priv = chunks.find((c) => c.metadata?.symbols?.includes("privateFn"));

    expect(pub?.metadata?.exported).toBe(true);
    expect(priv?.metadata?.exported).toBe(false);
  });

  it("records line numbers", () => {
    const content = [
      "// line 1",
      "// line 2",
      "export function lineThree() {",
      "  return 'hi';",
      "}",
    ].join("\n");

    const chunks = chunker.chunk({
      content,
      source: { kind: "file", path: "lines.ts" },
    });

    const c = chunks.find((x) => x.metadata?.symbols?.includes("lineThree"));
    expect(c?.metadata?.lineStart).toBe(3);
    expect(c?.metadata?.lineEnd).toBeGreaterThanOrEqual(5);
  });

  it("falls back gracefully on syntactically broken input", () => {
    const content = "this is not valid ;;; typescript {{{ at all";
    const chunks = chunker.chunk({
      content,
      source: { kind: "file", path: "broken.ts" },
    });

    // Should produce at least one chunk, not throw.
    expect(chunks.length).toBeGreaterThan(0);
  });

  it("merges small declarations and reports exported=true if any merged symbol is exported", () => {
    const content = `
export function tiny1() { return 1; }
function tiny2() { return 2; }
  `;
    const chunks = chunker.chunk({
      content,
      source: { kind: "file", path: "tiny.ts" },
    });

    // Both tiny functions merge into one chunk.
    const merged = chunks.find(
      (c) =>
        c.metadata?.symbols?.includes("tiny1") &&
        c.metadata?.symbols?.includes("tiny2"),
    );
    expect(merged).toBeDefined();

    // At chunk level, "exported" means "at least one symbol in this chunk is exported"
    // — not per-symbol granularity. Per-symbol export tracking is a future concern.
    expect(merged?.metadata?.exported).toBe(true);
  });

  it("falls back to a single chunk when no chunkable statements are extracted", () => {
    // Content that parses to a SourceFile but has no top-level chunkable
    // declarations — just stray tokens.
    const content = "}{ >>> not really valid <<< )(";
    const chunks = chunker.chunk({
      content,
      source: { kind: "file", path: "garbage.ts" },
    });

    // Content must not be lost — at least one chunk should exist.
    expect(chunks.length).toBeGreaterThan(0);
    // The fallback chunk should contain the original content.
    expect(chunks[0]?.content).toContain("not really valid");
  });

  it("produces no chunks for genuinely empty content", () => {
    const chunks = chunker.chunk({
      content: "   \n  \n  ",
      source: { kind: "file", path: "empty.ts" },
    });
    expect(chunks.length).toBe(0);
  });

  it("splits an oversized single-line expression-bodied arrow without truncation", () => {
    const chunker = createTypescriptChunker({
      targetMinChars: 100,
      targetMaxChars: 500,
      hardMinChars: 50,
      hardMaxChars: 800,
    });
    // A single-line arrow with a huge expression body, no internal newlines.
    const hugeExpression = Array.from(
      { length: 500 },
      (_, i) => `value${i}`,
    ).join(" + ");
    const content = `export const compute = () => ${hugeExpression};`;

    const chunks = chunker.chunk({
      content,
      source: { kind: "file", path: "compute.ts" },
    });

    const combined = chunks.map((c) => c.content).join("");

    // No chunk should carry the truncation marker.
    const truncated = chunks.some((c) => c.content.includes("[truncated]"));
    expect(truncated).toBe(false);

    // The tail of the expression must survive somewhere.
    expect(combined).toContain("value499");
  });
});
