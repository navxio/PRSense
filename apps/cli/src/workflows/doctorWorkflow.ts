import { loadEnvConfig, loadUserConfig } from "@prsense/config";
import { stdoutDoctorReporter } from "@prsense/reporters";
import { DoctorCheckResult } from "../shared/types.js";

import { checkRepository } from "../checks/checkRepository.js";
import { checkVectorStore } from "../checks/checkVectorStore.js";
import { checkLLM } from "../checks/checkLLM.js";

export async function runDoctorWorkflow(): Promise<number> {
  const results: DoctorCheckResult[] = [];

  // 1. Environment config
  try {
    loadEnvConfig(process.env);
    results.push({ status: "ok", name: "Environment variables" });
  } catch (err) {
    results.push({
      status: "fail",
      name: "Environment variables",
      message:
        err instanceof Error ? err.message : "Invalid environment config",
      fix: "Check required PRSENSE_* environment variables",
    });
  }

  // 2. User config
  try {
    loadUserConfig(process.cwd());
    results.push({ status: "ok", name: "User configuration" });
  } catch (err) {
    results.push({
      status: "fail",
      name: "User configuration",
      message: err instanceof Error ? err.message : "Invalid prsense.yml",
      fix: "Fix or remove prsense.yml to use defaults",
    });
  }

  // 3. LLM provider
  results.push(await checkLLM());

  // 4. Vector database
  results.push(await checkVectorStore());

  // 5. Repository state
  results.push(checkRepository());

  // 6. Report
  await stdoutDoctorReporter(results);

  // 7. Exit code
  return results.some((r) => r.status === "fail") ? 1 : 0;
}
