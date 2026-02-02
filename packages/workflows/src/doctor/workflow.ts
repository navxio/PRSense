// packages/workflows/src/doctor/workflow.ts
import type { ResolvedConfig } from "@prsense/runtime-config";
import type { EventBus } from "@prsense/core";
import type { DoctorWorkflowResult, DiagnosticCheck } from "./types.js";

import type { Capability, CapabilityContext } from "@prsense/preflight";
import {
  gitRepositoryCapability,
  dockerCapability,
  ollamaCapability,
  pgVectorCapability,
  postgresCapability,
} from "@prsense/preflight";

export async function runDoctorWorkflow({
  config,
  eventBus,
}: {
  config: ResolvedConfig;
  eventBus: EventBus;
}): Promise<DoctorWorkflowResult> {
  eventBus.emit("workflow.doctor.started");

  const ctx: CapabilityContext = {
    config,
    env: process.env,
    cwd: process.cwd(),
  };

  const capabilities: Capability[] = [
    gitRepositoryCapability,
    dockerCapability,
    postgresCapability,
    pgVectorCapability,
    ollamaCapability,
  ];

  const checks: DiagnosticCheck[] = [];

  for (const cap of capabilities) {
    eventBus.emit("doctor.capability.check.started", {
      capability: cap.id,
    });

    const status = await cap.check(ctx);

    // Skip truly irrelevant capabilities
    if (status.kind === "non-applicable") {
      continue;
    }

    let check: DiagnosticCheck;

    switch (status.kind) {
      case "ready":
        check = {
          id: cap.id,
          label: cap.description,
          status: "pass",
        };
        break;

      case "missing":
        check = {
          id: cap.id,
          label: cap.description,
          status: "fail",
          message: status.reason,
        };
        break;

      case "partial":
        check = {
          id: cap.id,
          label: cap.description,
          status: "warn",
          message: status.reason,
        };
        break;
    }

    checks.push(check);

    eventBus.emit("doctor.capability.check.finished", {
      capability: cap.id,
      status: check.status,
    });
  }

  const hasFailure = checks.some((c) => c.status === "fail");

  eventBus.emit("workflow.doctor.finished", {
    outcome: hasFailure ? "failure" : "success",
  });

  return {
    outcome: hasFailure ? "failure" : "success",
    payload: {
      checks,
    },
  };
}
