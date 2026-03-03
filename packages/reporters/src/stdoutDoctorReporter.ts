import type { DoctorWorkflowResult } from "@prsense/core";
import type { Reporter } from "./types.js";

export const stdoutDoctorReporter: Reporter<DoctorWorkflowResult> = {
  async report(result) {
    const results = result.checks;

    console.log("");
    console.log("PRSENSE DOCTOR");
    console.log("");

    for (const check of results) {
      switch (check.status) {
        case "ok":
          console.log(`[OK]   ${check.name}`);
          break;

        case "warn":
          console.log(`[WARN] ${check.name}`);
          if (check.message) {
            console.log(`       ${check.message}`);
          }
          break;

        case "fail":
          console.log(`[FAIL] ${check.name}`);
          if (check.message) {
            console.log(`       ${check.message}`);
          }
          if (check.fix) {
            console.log(`       Fix: ${check.fix}`);
          }
          break;
      }
    }

    const failures = results.filter((r) => r.status === "fail").length;

    console.log("");
    if (failures === 0) {
      console.log("No problems detected.");
    } else {
      console.log(`${failures} problem(s) detected.`);
    }
  },
};
