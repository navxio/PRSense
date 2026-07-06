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

  it("indexes export default function declarations", () => {
    const content = `
export default function compute(x: number): number {
  return x * 2;
}
`;
    const chunks = chunker.chunk({
      content,
      source: { kind: "file", path: "default.ts" },
    });

    const combined = chunks.map((c) => c.content).join("\n");
    expect(combined).toContain("function compute");
    expect(combined).toContain("return x * 2");
  });

  it("indexes export default class declarations", () => {
    const content = `
export default class Service {
  run() { return "ok"; }
}
`;
    const chunks = chunker.chunk({
      content,
      source: { kind: "file", path: "default.ts" },
    });

    const combined = chunks.map((c) => c.content).join("\n");
    expect(combined).toContain("class Service");
    expect(combined).toContain('return "ok"');
  });
});

// Cluster #1: oversized-declaration splitting paths (subSplitLargeDeclaration,
// subSplitClassDeclaration, findSplittableBody, splitTextAtLineBoundaries).
// Reachable only with a small hardMaxChars so ordinary declarations overflow.
//
// Every assertion here was verified against the real chunker's output, not the
// intended behavior. Robust fields only (symbols / symbolKind / content
// preservation / truncation), so post-split merging can't make them brittle.

describe("createTypescriptChunker — oversized-declaration splitting", () => {
  // Small enough that a handful of statements overflows, exercising the split
  // paths. Valid: targetMax(150) <= hardMax(200), hardMin(20) <= targetMin(40).
  const tiny = () =>
    createTypescriptChunker({
      targetMinChars: 40,
      targetMaxChars: 150,
      hardMinChars: 20,
      hardMaxChars: 200,
    });

  const kinds = (chunks: ReturnType<ReturnType<typeof tiny>["chunk"]>) =>
    chunks.map((c) => c.metadata?.symbolKind as string | undefined);
  const allSymbols = (chunks: ReturnType<ReturnType<typeof tiny>["chunk"]>) =>
    chunks.flatMap((c) => c.metadata?.symbols ?? []);
  const joined = (chunks: ReturnType<ReturnType<typeof tiny>["chunk"]>) =>
    chunks.map((c) => c.content).join("");
  const noTruncation = (chunks: ReturnType<ReturnType<typeof tiny>["chunk"]>) =>
    chunks.every((c) => !c.content.includes("[truncated]"));

  it("splits an oversized function into a header + body chunks, preserving every statement", () => {
    const stmts = Array.from(
      { length: 20 },
      (_, i) => `  const v${i} = ${i} + 1;`,
    ).join("\n");
    const content = `export function big(x) {\n${stmts}\n  return x;\n}`;

    const chunks = tiny().chunk({
      content,
      source: { kind: "file", path: "big.ts" },
    });

    // Header + body split both executed.
    expect(kinds(chunks)).toContain("function-header");
    expect(kinds(chunks)).toContain("function-body");
    // Symbol name propagated to the split pieces.
    expect(allSymbols(chunks)).toContain("big");
    // Nothing lost across the split boundary: first and last statements survive.
    expect(joined(chunks)).toContain("v0 =");
    expect(joined(chunks)).toContain("v19 =");
    expect(noTruncation(chunks)).toBe(true);
  });

  it("line-splits an oversized single body statement without truncation", () => {
    // One body statement whose text alone exceeds hardMaxChars, forcing the
    // in-body flush + splitTextAtLineBoundaries branch.
    const hugeExpr = Array.from({ length: 60 }, (_, i) => `v${i}`).join(" + ");
    const content = `export function huge() {\n  const r = ${hugeExpr};\n  return r;\n}`;

    const chunks = tiny().chunk({
      content,
      source: { kind: "file", path: "huge.ts" },
    });

    expect(kinds(chunks)).toContain("function-header");
    // The oversized statement is emitted as -partial line-split pieces.
    expect(kinds(chunks)).toContain("function-partial");
    expect(allSymbols(chunks)).toContain("huge");
    expect(joined(chunks)).toContain("v59"); // tail survived the split
    expect(noTruncation(chunks)).toBe(true);
  });

  it("splits an oversized class on member boundaries, collecting member names", () => {
    const methods = Array.from(
      { length: 12 },
      (_, i) => `  m${i}() { return ${i}; }`,
    ).join("\n");
    const content = `export class Svc {\n${methods}\n}`;

    const chunks = tiny().chunk({
      content,
      source: { kind: "file", path: "svc.ts" },
    });

    expect(kinds(chunks)).toContain("class-header");
    expect(kinds(chunks)).toContain("class-members");
    // Class name + individual member names both recorded.
    const syms = allSymbols(chunks);
    expect(syms).toContain("Svc");
    expect(syms).toContain("m0");
    expect(syms).toContain("m11");
    expect(joined(chunks)).toContain("m11()");
    expect(noTruncation(chunks)).toBe(true);
  });

  it("line-splits an oversized single class member, tagging it with the member name", () => {
    const hugeExpr = Array.from({ length: 60 }, (_, i) => `v${i}`).join(" + ");
    const content = `export class Big {\n  method() { const r = ${hugeExpr}; return r; }\n}`;

    const chunks = tiny().chunk({
      content,
      source: { kind: "file", path: "bigmember.ts" },
    });

    expect(kinds(chunks)).toContain("class-header");
    expect(kinds(chunks)).toContain("class-member-partial");
    // Oversized member falls to line-splitting under its own name, not the class.
    expect(allSymbols(chunks)).toContain("method");
    expect(joined(chunks)).toContain("v59");
    expect(noTruncation(chunks)).toBe(true);
  });

  it("falls back to line-splitting for a bodyless oversized declaration (type alias)", () => {
    // No splittable block body → findSplittableBody returns undefined →
    // splitTextAtLineBoundaries emits -partial chunks, keeping the symbol name.
    const union = Array.from({ length: 40 }, (_, i) => `"m${i}"`).join(" | ");
    const content = `export type Big = ${union};`;

    const chunks = tiny().chunk({
      content,
      source: { kind: "file", path: "union.ts" },
    });

    expect(kinds(chunks)).toContain("type-partial");
    expect(allSymbols(chunks)).toContain("Big");
    expect(joined(chunks)).toContain("m0");
    expect(joined(chunks)).toContain("m39");
    expect(noTruncation(chunks)).toBe(true);
  });

  it("splits an oversized variable-statement arrow via its function body", () => {
    // Exercises findSplittableBody's VariableStatement branch: the arrow's block
    // body is selected and split like a function body.
    const stmts = Array.from(
      { length: 20 },
      (_, i) => `  const v${i} = ${i} + 1;`,
    ).join("\n");
    const content = `export const f = (x) => {\n${stmts}\n  return x;\n};`;

    const chunks = tiny().chunk({
      content,
      source: { kind: "file", path: "arrow.ts" },
    });

    expect(kinds(chunks)).toContain("variable-header");
    expect(kinds(chunks)).toContain("variable-body");
    expect(allSymbols(chunks)).toContain("f");
    expect(joined(chunks)).toContain("v0 =");
    expect(joined(chunks)).toContain("v19 =");
    expect(noTruncation(chunks)).toBe(true);
  });

  it("line-splits an oversized declaration with an empty body (no body statements)", () => {
    // Huge signature, `{}` body → bodyStatements.length === 0 branch →
    // splitTextAtLineBoundaries over the whole declaration.
    const params = Array.from({ length: 30 }, (_, i) => `"p${i}"`).join(" | ");
    const content = `export function e(x: ${params}) {}`;

    const chunks = tiny().chunk({
      content,
      source: { kind: "file", path: "emptybody.ts" },
    });

    expect(kinds(chunks)).toContain("function-partial");
    expect(allSymbols(chunks)).toContain("e");
    expect(joined(chunks)).toContain("p0");
    expect(joined(chunks)).toContain("p29");
    expect(noTruncation(chunks)).toBe(true);
  });
});
