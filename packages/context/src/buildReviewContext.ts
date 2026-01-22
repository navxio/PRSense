import type { ReviewInput, ReviewContext } from "@prsense/core";
import { parseUnifiedDiff } from "./diff.js";

/**
 * Convert adapter-level ReviewInput into
 * engine-ready ReviewContext.
 */
export async function buildReviewContext(
  input: ReviewInput,
): Promise<ReviewContext> {
  const repoRoot = input.repoRoot ?? process.cwd();
  const baseBranch = input.baseBranch ?? "main";

  const diff = parseUnifiedDiff(input.diffText);

  return {
    repoRoot,
    baseBranch,
    diff,
    // metadata intentionally minimal for now
  };
}
