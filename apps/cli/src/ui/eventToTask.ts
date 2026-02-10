import { CliTask } from "./tasks.js";
import { CoreEvents } from "@prsense/core";
import type { DomainEvent } from "@prsense/core";

export function eventToCliTask(
  event: DomainEvent,
): { kind: "start" | "update" | "finish"; task: CliTask } | null {
  switch (event.event) {
    case CoreEvents.RunStarted:
      return {
        kind: "start",
        task: {
          id: "run",
          label: "Running PRSense",
          state: "running",
        },
      };

    case CoreEvents.RunFinished:
      return {
        kind: "finish",
        task: {
          id: "run",
          label: "PRSense completed",
          state: "succeeded",
        },
      };

    case CoreEvents.RunFailed:
      return {
        kind: "finish",
        task: {
          id: "run",
          label: "PRSense failed",
          state: "failed",
        },
      };

    default:
      return null;
  }
}
