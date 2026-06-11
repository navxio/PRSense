// packages/reporters/src/printSignals.ts
import chalk from "chalk";
import wrapAnsi from "wrap-ansi";
import type { ReviewSignal } from "@prsense/core";

// ---------------------------------------------------------------------------
// Styling
// ---------------------------------------------------------------------------

const SEVERITY_BADGE: Record<string, (s: string) => string> = {
  high: chalk.bgRed.white.bold,
  medium: chalk.bgYellow.black.bold,
  low: chalk.bgBlue.white.bold,
  info: chalk.bgGray.white.bold,
};

const styles = {
  path: chalk.cyan,
  claim: chalk.white,
  evidence: chalk.gray,
  suggestion: chalk.green,
  codeInEvidence: chalk.white,
  codeInSuggestion: chalk.greenBright,
  codeInClaim: chalk.bold,
  footer: chalk.dim,
  ok: chalk.green,
};

// ---------------------------------------------------------------------------
// Width / wrapping
// ---------------------------------------------------------------------------

const MIN_WIDTH = 40;
const MAX_WIDTH = 100;

function getWrapWidth(): number {
  const cols = process.stdout.columns ?? 80;
  return Math.min(Math.max(cols, MIN_WIDTH), MAX_WIDTH);
}

/**
 * Apply outer + inline-code styling segment-by-segment.
 * Avoids chalk nesting issues (inner resets blow away outer color).
 */
function styleWithInlineCode(
  text: string,
  outer: (s: string) => string,
  code: (s: string) => string,
): string {
  return text
    .split(/(`[^`]+`)/g)
    .map((part) =>
      part.startsWith("`") && part.endsWith("`") && part.length > 2
        ? code(part.slice(1, -1))
        : outer(part),
    )
    .join("");
}

function wrap(text: string, width: number): string[] {
  return wrapAnsi(text, width, {
    hard: false,
    trim: false,
    wordWrap: true,
  }).split("\n");
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function renderHeader(signal: ReviewSignal): string {
  const sev = signal.severity.toLowerCase();
  const fallback: (s: string) => string = chalk.bgGray.white.bold;
  const style = SEVERITY_BADGE[sev] ?? fallback;
  const badge = style(` ${signal.severity.toUpperCase()} `);
  return `${badge}  ${styles.path(signal.file)}`;
}

function renderClaim(message: string, width: number): string {
  const styled = styleWithInlineCode(message, styles.claim, styles.codeInClaim);
  return wrap(styled, width).join("\n");
}

function renderBlock(
  text: string,
  leader: string,
  outer: (s: string) => string,
  code: (s: string) => string,
  width: number,
  continuationIndent: string,
): string {
  const styled = styleWithInlineCode(text, outer, code);
  const lines = wrap(styled, width - leader.length);
  return lines
    .map((line, i) =>
      i === 0 ? `  ${leader}${line}` : `${continuationIndent}${line}`,
    )
    .join("\n");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function printSignals(signals: ReadonlyArray<ReviewSignal>): void {
  if (signals.length === 0) {
    console.log(`${styles.ok("✔")} No review signals (change looks safe)`);
    return;
  }

  const width = getWrapWidth();

  for (const signal of signals) {
    console.log();
    console.log(renderHeader(signal));
    console.log(renderClaim(signal.message, width));

    if (signal.rationale) {
      console.log(
        renderBlock(
          signal.rationale,
          styles.evidence("↳ "),
          styles.evidence,
          styles.codeInEvidence,
          width,
          "    ",
        ),
      );
    }

    if (signal.suggestedFix) {
      console.log(
        renderBlock(
          signal.suggestedFix,
          "💡 ",
          styles.suggestion,
          styles.codeInSuggestion,
          width,
          "     ",
        ),
      );
    }
  }

  console.log();
  console.log(
    styles.footer(`${signals.length} signal${signals.length === 1 ? "" : "s"}`),
  );
}
