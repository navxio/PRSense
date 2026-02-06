// apps/cli/src/reporting/stdoutConfigReporter.ts

import type { ConfigValidationIssue } from "@prsense/runtime-config";

export async function stdoutConfigReporter(issues: ConfigValidationIssue[]) {
  console.error("❌ Configuration is invalid:\n");

  for (const issue of issues) {
    const prefix = issue.level === "error" ? "ERROR" : "WARN";
    console.error(`  [${prefix}] ${issue.message}`);
    if (issue.path) {
      console.error(`          at ${issue.path}`);
    }
  }

  console.error("\nFix the configuration and re-run `prsense doctor`.");
}
