// packages/workflows/src/review/steps/finaliseSignals.ts
import type { ReviewSignal, EventBus, ReviewSeverity } from "@prsense/core";
import { CoreEvents } from "@prsense/core";
import type { ResolvedConfig } from "@prsense/config";
import { dedupeSignals } from "../lib/dedupeSignals.js";
import { normalizeSignal } from "../lib/normalizeSignal.js";

const SEVERITY_RANK: Record<ReviewSeverity, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export function finalizeSignals(
  allSignals: ReviewSignal[],
  config: ResolvedConfig,
  eventBus: EventBus,
) {
  const deduped = dedupeSignals(
    allSignals
      .map(normalizeSignal)
      .filter((s): s is ReviewSignal => !!s)
      .filter((s) => s.confidence >= config.review.confidenceThreshold),
  );

  const ranked = deduped.sort((a, b) => {
    const sev = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    return sev !== 0 ? sev : b.confidence - a.confidence;
  });

  const signals = ranked.slice(0, config.review.topSignals);

  eventBus.emit(CoreEvents.SignalCompiled, {
    count: signals.length,
    droppedByCap: ranked.length - signals.length,
  });

  return signals;
}
