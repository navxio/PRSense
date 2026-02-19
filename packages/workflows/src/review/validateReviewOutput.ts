export function validateReviewOutput(parsed: any): {
  signals: any[];
} {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Review output must be an object");
  }

  if (!Array.isArray(parsed.signals)) {
    throw new Error("Review output missing 'signals' array");
  }

  return parsed;
}
