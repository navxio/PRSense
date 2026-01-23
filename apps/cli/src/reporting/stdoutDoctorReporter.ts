import { DoctorCheckResult } from "../shared/types.js";

export async function stdoutDoctorReporter(
  results: DoctorCheckResult[],
): Promise<void> {
  console.log("");
  console.log("PRSENSE DOCTOR");
  console.log("");

  for (const result of results) {
    if (result.status === "ok") {
      console.log(`[OK]   ${result.name}`);
    }

    if (result.status === "warn") {
      console.log(`[WARN] ${result.name}`);
      console.log(`       ${result.message}`);
    }

    if (result.status === "fail") {
      console.log(`[FAIL] ${result.name}`);
      console.log(`       ${result.message}`);
      if (result.fix) {
        console.log(`       Fix: ${result.fix}`);
      }
    }
  }

  const failures = results.filter((r) => r.status === "fail").length;

  console.log("");
  if (failures === 0) {
    console.log("No problems detected.");
  } else {
    console.log(`${failures} problem(s) detected.`);
  }
}
