// steps/finalizeSignals.ts

import type { ReviewSignal, EventBus } from "@prsense/core";
import { CoreEvents } from "@prsense/core";
import type { ResolvedConfig } from "@prsense/config";
import { dedupeSignals } from "../dedupeSignals.js";

import { normalizeSignal } from "../normalizeSignal.js";
export function finalizeSignals(
  allSignals: ReviewSignal[],
  config: ResolvedConfig,
  eventBus: EventBus,
) {
  const signals = dedupeSignals(
    allSignals
      .map(normalizeSignal)
      .filter((s): s is ReviewSignal => !!s)
      .filter((s) => s.confidence >= config.review.confidenceThreshold),
  );

  eventBus.emit(CoreEvents.SignalCompiled, {
    count: signals.length,
  });
  return signals;
}
