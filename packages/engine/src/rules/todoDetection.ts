import { ReviewContext, ReviewRule, ReviewSignal } from "@prsense/domain";

export const todoDetectionRule: ReviewRule = {
  id: "todo-detection",
  title: "TODO comments in changed code",
  type: "style",
  defaultSeverity: "low",
  defaultConfidence: 0.9,

  applies(ctx: ReviewContext): boolean {
    return ctx.diff.files.length > 0;
  },

  run(ctx: ReviewContext): ReviewSignal[] {
    const signals: ReviewSignal[] = [];

    for (const file of ctx.diff.files) {
      // naive but correct for v1
      if (file.patch.includes("TODO") || file.patch.includes("FIXME")) {
        signals.push({
          id: `${this.id}:${file.path}`,
          type: this.type,
          severity: this.defaultSeverity,
          confidence: this.defaultConfidence,
          file: file.path,
          message: "TODO or FIXME comment introduced in changed code",
          source: "rule",
        });
      }
    }

    return signals;
  },
};
