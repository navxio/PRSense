// packages/workflows/src/review/lib/normalizeSignal.ts
import type { ReviewSignal } from "@prsense/core";

const allowedTypes = ["bug", "risk", "test"] as const;
const allowedSeverity = ["low", "medium", "high"] as const;

export function normalizeSignal(raw: any, index: number): ReviewSignal | null {
  if (!raw || typeof raw !== "object") return null;

  if (!allowedTypes.includes(raw.type)) return null;
  if (!allowedSeverity.includes(raw.severity)) return null;

  const confidence =
    typeof raw.confidence === "number"
      ? Math.max(0, Math.min(1, raw.confidence))
      : 0.5;

  if (!raw.file || typeof raw.file !== "string") return null;
  if (!raw.message || typeof raw.message !== "string") return null;

  return {
    id: `signal-${index}`,
    type: raw.type,
    severity: raw.severity,
    confidence,
    file: raw.file,
    lineStart: typeof raw.lineStart === "number" ? raw.lineStart : undefined,
    lineEnd: typeof raw.lineEnd === "number" ? raw.lineEnd : undefined,
    message: raw.message,
    rationale: typeof raw.rationale === "string" ? raw.rationale : undefined,
    suggestedFix:
      typeof raw.suggestedFix === "string" ? raw.suggestedFix : undefined,
    source: "llm",
  };
}
