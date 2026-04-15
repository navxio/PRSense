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

    // ---------------- INDEX ----------------

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
          state: "failed",
          label: "Index outdated. Run with --force to rebuild",
        },
      };

    case CoreEvents.WorkflowIndexProgress: {
      if (!event.fields) return null;

      const { processed, total } = event.fields;

      return {
        kind: "update",
        task: {
          id: "index",
          label: `Embedding ${processed} / ${total} chunks`,
          state: "running",
        },
      };
    }

    // ---------------- REVIEW ----------------

    case CoreEvents.WorkflowReviewContextUnavailable:
      return {
        kind: "update",
        task: {
          id: "review",
          label: "Running diff-only review (no index)",
          state: "running",
        },
      };

    case CoreEvents.WorkflowReviewIndexOutdated:
      return {
        kind: "update",
        task: {
          id: "review",
          label: "Index outdated — running diff-only review",
          state: "running",
        },
      };

    case CoreEvents.WorkflowReviewContextAvailable:
      return {
        kind: "update",
        task: {
          id: "review",
          label: "Using indexed repository context",
          state: "running",
        },
      };

    case CoreEvents.WorkflowReviewInvalidJson:
      return {
        kind: "update",
        task: {
          id: "review",
          label: "Model returned invalid JSON (see debug logs)",
          state: "failed",
        },
      };

    // ---------------- SETUP ----------------

    case CoreEvents.WorkflowSetupStarted:
      return {
        kind: "start",
        task: {
          id: "setup",
          label: "Running setup checks",
          state: "running",
        },
      };

    case CoreEvents.CapabilityCheckStarted: {
      if (!event.fields) return null;

      return {
        kind: "update",
        task: {
          id: "setup",
          label: `Checking ${event.fields.capability}`,
          state: "running",
        },
      };
    }

    case CoreEvents.WorkflowSetupFinished: {
      if (!event.fields) return null;

      return {
        kind: "finish",
        task: {
          id: "setup",
          label:
            event.fields.outcome === "success"
              ? "Setup completed"
              : "Setup failed",
          state: event.fields.outcome === "success" ? "succeeded" : "failed",
        },
      };
    }

    default:
      return null;
  }
}
