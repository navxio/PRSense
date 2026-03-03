import type { DoctorWorkflowResult } from "@prsense/core";
import type { OutputReporter } from "./types.js";

export const stdoutDoctorReporter: OutputReporter<DoctorWorkflowResult> = {
  async report(result) {
    const results = result.checks;

    console.log("");
    console.log("PRSENSE DOCTOR");
    console.log("");

    for (const check of results) {
      switch (check.status) {
        case "ok":
          console.log(`[OK]   ${check.label}`);
          break;

        case "warn":
          console.log(`[WARN] ${check.label}`);
          if (check.message) {
            console.log(`       ${check.message}`);
          }
          break;

        case "fail":
          console.log(`[FAIL] ${check.label}`);
          if (check.message) {
            console.log(`       ${check.message}`);
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
