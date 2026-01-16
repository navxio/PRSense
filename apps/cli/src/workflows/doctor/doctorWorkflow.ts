import { stdoutDoctorReporter } from "../../reporting/stdoutDoctorReporter.js";

import { checkEnvConfig } from "./checks/checkEnvConfig.js";
import { checkUserConfig } from "./checks/checkUserConfig.js";
import { checkLLM } from "./checks/checkLLM.js";
import { checkVectorStore } from "./checks/checkVectorStore.js";
import { checkRepository } from "./checks/checkRepository.js";

export async function runDoctorWorkflow(): Promise<number> {
  //PERF: concurrent?
  const results = [
    await checkEnvConfig(),
    await checkUserConfig(),
    await checkLLM(),
    await checkVectorStore(),
    await checkRepository(),
  ];

  await stdoutDoctorReporter(results);

  return results.some((r) => r.status === "fail") ? 1 : 0;
}
