import chalk from "chalk";
import { ReviewSignal } from "@prsense/domain";
import type { CliReviewResult } from "./types";
export function summarize(signals: ReviewSignal[]): CliReviewResult {
  const summary = {
    total: signals.length,
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const s of signals) {
    summary[s.severity]++;
  }

  return { signals, summary };
}

export function printResult(result: CliReviewResult) {
  for (const signal of result.signals) {
    const sev =
      signal.severity === "high"
        ? chalk.red("HIGH")
        : signal.severity === "medium"
          ? chalk.yellow("MEDIUM")
          : chalk.gray("LOW");

    console.log(
      `${chalk.cyan(signal.file)}\n  [${sev} | ${signal.confidence.toFixed(
        2,
      )}] ${signal.message}\n`,
    );
  }

  console.log(
    chalk.bold(
      `Summary: ${result.summary.total} signal(s) ` +
        `(high: ${result.summary.high}, ` +
        `medium: ${result.summary.medium}, ` +
        `low: ${result.summary.low})`,
    ),
  );
}
