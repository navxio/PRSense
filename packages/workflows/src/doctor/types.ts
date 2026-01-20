import type { WorkflowResult } from "../types/core.js";
import type { WorkflowCheck } from "../types/checks.js";

export type DoctorPayload = {
  checks: WorkflowCheck[];
};

export type DoctorWorkflowResult = WorkflowResult<DoctorPayload>;
