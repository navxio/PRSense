import chalk from "chalk";
import type { Reporter } from "./types.js";
import type { ReviewSignal } from "@prsense/core";

type Summary = {
  total: number;
  high: number;
  medium: number;
  low: number;
};

function summarize(signals: ReviewSignal[]): Summary {
  const summary: Summary = {
    total: signals.length,
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const s of signals) {
    summary[s.severity]++;
  }

  return summary;
}

export const stdoutReporter: Reporter = async (signals: ReviewSignal[]) => {
  if (signals.length === 0) {
    console.log(chalk.green("No issues found."));
    return;
  }

  for (const signal of signals) {
    const sev =
      signal.severity === "high"
        ? chalk.red("HIGH")
        : signal.severity === "medium"
          ? chalk.yellow("MEDIUM")
          : chalk.gray("LOW");

    const file = signal.file
      ? chalk.cyan(signal.file)
      : chalk.cyan("<unknown>");

    console.log(`${file}\n  [${sev}] ${signal.message}\n`);
  }

  const summary = summarize(signals);

  console.log(
    chalk.bold(
      `Summary: ${summary.total} signal(s) ` +
        `(high: ${summary.high}, ` +
        `medium: ${summary.medium}, ` +
        `low: ${summary.low})`,
    ),
  );
};
