// packages/workflows/src/review/lib/formatContextForFile.ts
import type { ContextChunk } from "@prsense/core";

const MAX_CHARS_PER_FILE = 8000;

type Provider = NonNullable<ContextChunk["provider"]>;

const SECTION_LABELS: Record<Provider, string> = {
  references: "### Direct callers of changed symbols",
  "type-references": "### Type-shape dependents of changed symbols",
  rag: "### Similar code",
};
const SECTION_ORDER: Provider[] = ["references", "type-references", "rag"];

export function formatContextForFile(chunks: ContextChunk[]): string {
  if (chunks.length === 0) return "";

  const grouped = new Map<Provider, ContextChunk[]>();
  for (const c of chunks) {
    if (c.source.kind !== "file") continue;
    const key: Provider = c.provider ?? "rag";
    const arr = grouped.get(key) ?? [];
    arr.push(c);
    grouped.set(key, arr);
  }

  let acc = "";
  for (const provider of SECTION_ORDER) {
    const groupChunks = grouped.get(provider);
    if (!groupChunks || groupChunks.length === 0) continue;

    const section = renderSection(
      provider,
      groupChunks,
      MAX_CHARS_PER_FILE - acc.length,
    );
    if (!section) break;
    acc += section;
  }

  return acc;
}

function renderSection(
  provider: Provider,
  chunks: ContextChunk[],
  budget: number,
): string {
  const header = `${SECTION_LABELS[provider]}\n\n`;
  if (header.length >= budget) return "";

  let body = "";
  let remaining = budget - header.length;

  if (provider === "references") {
    // Sub-group by symbol so the "N references; M shown" marker
    // renders once per symbol, immediately above its refs.
    const bySymbol = new Map<string, ContextChunk[]>();
    for (const c of chunks) {
      const symbol = c.metadata?.symbols?.[0] ?? "<unknown>";
      const arr = bySymbol.get(symbol) ?? [];
      arr.push(c);
      bySymbol.set(symbol, arr);
    }

    for (const [symbol, group] of bySymbol) {
      const block = renderReferenceGroup(symbol, group);
      if (block.length > remaining) break;
      body += block;
      remaining -= block.length;
    }
  } else {
    for (const c of chunks) {
      const block = renderChunk(c);
      if (block.length > remaining) break;
      body += block;
      remaining -= block.length;
    }
  }

  if (body.length === 0) return "";
  return header + body;
}

function renderReferenceGroup(symbol: string, chunks: ContextChunk[]): string {
  let acc = "";

  const truncated = readTruncated(chunks[0]);
  if (truncated) {
    acc += `// ${truncated.total} references to ${symbol}; ${truncated.shown} shown\n`;
  }

  for (const c of chunks) {
    acc += renderChunk(c);
  }

  return acc;
}

function renderChunk(c: ContextChunk): string {
  if (c.source.kind !== "file") return "";
  const lineSuffix = formatLineSuffix(
    c.metadata?.lineStart,
    c.metadata?.lineEnd,
  );
  const testTag = c.metadata?.kind === "test" ? " (test)" : "";
  return `// ${c.source.path}${lineSuffix}${testTag}\n${c.content}\n\n`;
}

function formatLineSuffix(
  start: number | undefined,
  end: number | undefined,
): string {
  if (start == null) return "";
  if (end == null || end === start) return `:${start}`;
  return `:${start}-${end}`;
}

function readTruncated(
  c: ContextChunk | undefined,
): { shown: number; total: number } | undefined {
  const raw = c?.metadata?.truncated;
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.shown !== "number" || typeof obj.total !== "number") {
    return undefined;
  }
  return { shown: obj.shown, total: obj.total };
}
