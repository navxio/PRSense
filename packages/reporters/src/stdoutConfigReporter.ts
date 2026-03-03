import type { ConfigValidationIssue } from "@prsense/runtime-config";
import type { OutputReporter } from "./types.js";

export type ConfigValidationResult = {
  issues: ConfigValidationIssue[];
};

export const stdoutConfigReporter: OutputReporter<ConfigValidationResult> = {
  async report(result) {
    const issues = result.issues;

    if (issues.length === 0) return;

    console.error("❌ Configuration is invalid:\n");

    for (const issue of issues) {
      const prefix = issue.level === "error" ? "ERROR" : "WARN";
      console.error(`  [${prefix}] ${issue.message}`);
      if (issue.path) {
        console.error(`          at ${issue.path}`);
      }
    }

    console.error("\nFix the configuration and re-run `prsense doctor`.");
  },
};
