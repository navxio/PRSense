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

    case CoreEvents.WorkflowIndexStarted:
      return {
        kind: "start",
        task: {
          id: "index",
          label: "Indexing repository",
          state: "running",
        },
      };

    case CoreEvents.WorkflowIndexFinished:
      return {
        kind: "finish",
        task: {
          id: "index",
          label: "Indexing completed",
          state: "succeeded",
        },
      };

    case CoreEvents.WorkflowIndexFailed:
      return {
        kind: "finish",
        task: {
          id: "index",
          label: "Indexing failed",
          state: "failed",
        },
      };

    case CoreEvents.WorkflowIndexUpToDate:
      return {
        kind: "finish",
        task: {
          id: "index",
          label: "Index is up to date",
          state: "succeeded",
        },
      };

    case CoreEvents.WorkflowIndexRebuildRequired:
      return {
        kind: "finish",
        task: {
          id: "index",
          label: "Index outdated. Use --force to rebuild",
          state: "failed",
        },
      };

    default:
      return null;
  }
}
