// packages/context/src/symbolGraph/refs/renderChunks.ts
import { createHash } from "node:crypto";
import type { ContextChunk } from "@prsense/core";
import type { TriggeredCandidate } from "../sig/diffSignature.js";
import type { RankedReferences } from "./rankAndCap.js";

export type PerSymbolReferences = {
  candidate: TriggeredCandidate;
  references: RankedReferences;
};

export function renderChunks(perSymbol: PerSymbolReferences[]): ContextChunk[] {
  const out: ContextChunk[] = [];

  for (const { candidate, references } of perSymbol) {
    const { shown, total } = references;
    const truncated = total > shown.length;

    shown.forEach((ref, i) => {
      const content = ref.enclosingStatement.getText();
      const chunk: ContextChunk = {
        id: chunkId(candidate.name, ref.filePath, ref.lineStart),
        source: { kind: "file", path: ref.filePath },
        content,
        provider: "references",
        metadata: {
          symbols: [candidate.name],
          language: "typescript",
          lineStart: ref.lineStart,
          lineEnd: ref.lineEnd,
          path: ref.filePath,
          kind: ref.isTest ? "test" : "code",
          declarationKind: candidate.kind,
          // Truncation marker on the first chunk per symbol only.
          // formatContextForFile reads this off the group head.
          ...(i === 0 && truncated
            ? { truncated: { shown: shown.length, total } }
            : {}),
        },
      };
      out.push(chunk);
    });
  }

  return out;
}

function chunkId(symbol: string, path: string, line: number): string {
  return (
    "sg-" +
    createHash("sha1")
      .update(`${symbol}\0${path}\0${line}`)
      .digest("hex")
      .slice(0, 16)
  );
}
