export type SetupStepResult =
  | { id: string; status: "applied" }
  | { id: string; status: "skipped" }
  | { id: string; status: "failed"; error: Error };

export type SetupWorkflowResult = {
  results: SetupStepResult[];
};
