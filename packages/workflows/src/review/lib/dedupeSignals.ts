import { ReviewSignal } from "@prsense/core";
export function dedupeSignals(signals: ReviewSignal[]): ReviewSignal[] {
  const seen = new Set<string>();
  return signals.filter((s) => {
    const key = `${s.file}:${s.lineStart}:${s.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
