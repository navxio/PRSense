// packages/workflows/src/doctor/runDoctorWorkflow.ts

import type { DoctorWorkflowResult } from "./types.js";

import { checkEnvConfig } from "./checks/checkEnvConfig.js";
import { checkUserConfig } from "./checks/checkUserConfig.js";
import { checkLLM } from "./checks/checkLLM.js";
import { checkVectorStore } from "./checks/checkVectorStore.js";
import { checkRepository } from "./checks/checkRepository.js";

export async function runDoctorWorkflow(): Promise<DoctorWorkflowResult> {
  // NOTE: sequential for now; safe to parallelize later
  const checks = [
    await checkEnvConfig(),
    await checkUserConfig(),
    await checkLLM(),
    await checkVectorStore(),
    await checkRepository(),
  ];

  const hasFailure = checks.some((c) => c.status === "fail");

  return {
    outcome: hasFailure ? "failure" : "success",
    payload: {
      checks,
    },
  };
}
