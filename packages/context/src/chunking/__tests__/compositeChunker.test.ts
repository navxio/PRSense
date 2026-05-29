// packages/context/src/chunking/__tests__/compositeChunker.test.ts

import { createCompositeChunker } from "../compositeChunker.js";

describe("createCompositeChunker", () => {
  const chunker = createCompositeChunker({
    char: { maxChars: 1000, overlapChars: 200 },
  });

  it("routes .ts files to the TypeScript chunker", () => {
    const chunks = chunker.chunk({
      content: "export function foo() { return 1; }",
      source: { kind: "file", path: "foo.ts" },
    });
    const symbols = chunks.flatMap((c) => c.metadata?.symbols ?? []);
    expect(symbols).toContain("foo");
  });

  it("routes non-TS files to the char chunker", () => {
    const chunks = chunker.chunk({
      content: "package main\nfunc foo() {}",
      source: { kind: "file", path: "main.go" },
    });
    // Char chunker doesn't extract symbols.
    expect(chunks[0]?.metadata?.symbols).toBeUndefined();
  });
});
