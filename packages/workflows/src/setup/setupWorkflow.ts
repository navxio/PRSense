// packages/workflows/src/setup/runSetupWorkflow.ts
import type { Capability, CapabilityContext } from "@prsense/preflight";
import type { EventBus } from "@prsense/core";
import { CoreEvents } from "@prsense/core";

import type { SetupWorkflowResult, SetupStepResult } from "./types.js";

export async function runSetupWorkflow({
  capabilities,
  ctx,
  eventBus,
}: {
  capabilities: Capability[];
  ctx: CapabilityContext;
  eventBus: EventBus;
}): Promise<SetupWorkflowResult> {
  eventBus.emit(CoreEvents.WorkflowSetupStarted);

  const steps: SetupStepResult[] = [];

  for (const cap of capabilities) {
    eventBus.emit(CoreEvents.CapabilityCheckStarted, {
      capability: cap.id,
    });

    const status = await cap.check(ctx);

    eventBus.emit(CoreEvents.CapabilityCheckFinished, {
      capability: cap.id,
      status: status.kind,
    });

    // 1️⃣ Not applicable → skip silently
    if (status.kind === "non-applicable") {
      steps.push({ id: cap.id, outcome: "skipped" });
      continue;
    }

    // 2️⃣ Already ready → skip
    if (status.kind === "ready") {
      steps.push({ id: cap.id, outcome: "skipped" });
      continue;
    }

    // 3️⃣ Partial → never auto-fix
    if (status.kind === "partial") {
      steps.push({
        id: cap.id,
        outcome: "failed",
        error: status.reason,
      });
      break;
    }

    // 4️⃣ Missing → attempt apply if possible
    if (status.kind === "missing") {
      if (!cap.apply) {
        steps.push({
          id: cap.id,
          outcome: "failed",
          error: status.reason,
        });
        break;
      }

      eventBus.emit(CoreEvents.TaskStarted, {
        taskId: `setup.${cap.id}`,
        label: `Setting up ${cap.description}`,
      });

      try {
        await cap.apply(ctx);

        eventBus.emit(CoreEvents.TaskSucceeded, {
          taskId: `setup.${cap.id}`,
        });

        steps.push({
          id: cap.id,
          outcome: "applied",
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);

        eventBus.emit(CoreEvents.TaskFailed, {
          taskId: `setup.${cap.id}`,
          error: message,
        });

        steps.push({
          id: cap.id,
          outcome: "failed",
          error: message,
        });
        break;
      }
    }
  }

  const failed = steps.some((s) => s.outcome === "failed");

  eventBus.emit(CoreEvents.WorkflowSetupFinished, {
    outcome: failed ? "failure" : "success",
  });

  return {
    outcome: failed ? "failure" : "success",
    steps,
  };
}
