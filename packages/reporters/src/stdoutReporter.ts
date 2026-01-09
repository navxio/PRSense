import type { ReviewSignal } from "@prsense/domain";
import type { Reporter } from "./types.js";

export const stdoutReporter: Reporter = async (signals: ReviewSignal[]) => {
  if (signals.length === 0) {
    console.log("No issues found.");
    return;
  }

  for (const signal of signals) {
    const location = signal.file ? ` (${signal.file})` : "";

    console.log(
      `[${signal.severity.toUpperCase()}] ${signal.message}${location}`,
    );
  }
};
