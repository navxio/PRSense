// packages/workflows/src/doctor/runDoctorWorkflow.ts
import type { DoctorWorkflowResult } from "./types.js";

import { checkEnvConfig } from "./checks/checkEnvConfig.js";
import { checkUserConfig } from "./checks/checkUserConfig.js";
import { checkLLM } from "./checks/checkLLM.js";
import { checkRepository } from "./checks/checkRepository.js";

import {
  dockerCapability,
  postgresCapability,
  pgVectorCapability,
} from "../index.js";

import { buildCapabilityContext } from "./buildCapabilityContext.js";
import { runCapabilityCheck } from "./adaptCapability.js";

export async function runDoctorWorkflow(): Promise<DoctorWorkflowResult> {
  const ctx = await buildCapabilityContext();

  const checks = [
    await checkEnvConfig(),
    await checkUserConfig(),
    await checkLLM(),
    await checkRepository(),

    // Capability-backed checks
    await runCapabilityCheck(dockerCapability, ctx),
    await runCapabilityCheck(postgresCapability, ctx),
    await runCapabilityCheck(pgVectorCapability, ctx),
  ];

  const hasFailure = checks.some((c) => c.status === "fail");

  return {
    outcome: hasFailure ? "failure" : "success",
    payload: { checks },
  };
}
