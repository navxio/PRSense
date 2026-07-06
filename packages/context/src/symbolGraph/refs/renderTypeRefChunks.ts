// packages/context/src/symbolGraph/refs/renderTypeRefChunks.ts
import { createHash } from "node:crypto";
import type { ContextChunk } from "@prsense/core";
import type { TriggeredCandidate } from "../sig/diffSignature.js";
import type { TypeRefHit } from "./findTypeReferences.js";

export type RankedTypeRefs = { shown: TypeRefHit[]; total: number };

export type PerSymbolTypeRefs = {
  candidate: TriggeredCandidate;
  typeRefs: RankedTypeRefs;
};

const LABEL: Record<TypeRefHit["kind"], string> = {
  param: "parameter type",
  return: "return type",
  field: "field type",
};

export function renderTypeRefChunks(
  perSymbol: PerSymbolTypeRefs[],
): ContextChunk[] {
  const out: ContextChunk[] = [];
  for (const { candidate, typeRefs } of perSymbol) {
    const { shown, total } = typeRefs;
    const truncated = total > shown.length;
    shown.forEach((ref, i) => {
      const note = `// ${LABEL[ref.kind]} depends on ${candidate.name}\n`;
      const chunk: ContextChunk = {
        id: chunkId(candidate.name, ref.filePath, ref.lineStart, ref.kind),
        source: { kind: "file", path: ref.filePath },
        content: note + ref.enclosingStatement.getText(),
        provider: "type-references",
        metadata: {
          symbols: [candidate.name],
          language: "typescript",
          lineStart: ref.lineStart,
          lineEnd: ref.lineEnd,
          path: ref.filePath,
          kind: ref.isTest ? "test" : "code",
          typeRefKind: ref.kind,
          declarationKind: candidate.kind,
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

function chunkId(
  symbol: string,
  path: string,
  line: number,
  kind: string,
): string {
  return (
    "sgt-" +
    createHash("sha1")
      .update(`${symbol}\0${path}\0${line}\0${kind}`)
      .digest("hex")
      .slice(0, 16)
  );
}
