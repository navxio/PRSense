export type SetupStepResult =
  | { id: string; outcome: "skipped" }
  | { id: string; outcome: "applied" }
  | { id: string; outcome: "failed"; error: string };

export type SetupWorkflowResult = {
  outcome: "success" | "failure";
  steps: SetupStepResult[];
};
