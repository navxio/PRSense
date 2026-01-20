import type { Capability, CapabilityContext } from "@prsense/capabilities";
import type { SetupWorkflowResult, SetupStepResult } from "./types.js";

export async function runSetupWorkflow(
  capabilities: Capability[],
  ctx: CapabilityContext,
): Promise<SetupWorkflowResult> {
  const results: SetupStepResult[] = [];

  for (const cap of capabilities) {
    const status = await cap.check(ctx);

    if (status.kind === "ready") {
      results.push({ id: cap.id, status: "skipped" });
      continue;
    }

    if (!cap.apply) {
      results.push({
        id: cap.id,
        status: "failed",
        error: new Error(
          `Capability "${cap.id}" cannot be applied automatically`,
        ),
      });
      break;
    }

    try {
      await cap.apply(ctx);
      results.push({ id: cap.id, status: "applied" });
    } catch (err) {
      results.push({
        id: cap.id,
        status: "failed",
        error: err as Error,
      });
      break;
    }
  }

  return { results };
}
