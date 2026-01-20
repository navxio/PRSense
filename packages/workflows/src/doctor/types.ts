import type { WorkflowResult } from "../types/core.js";
import type { WorkflowCheck } from "../types/checks.js";
import { CapabilityId, CapabilityStatus } from "../_shared/capability.js";

export type DoctorPayload = {
  checks: WorkflowCheck[];
};

export type DoctorWorkflowResult = WorkflowResult<DoctorPayload>;

export type DoctorCheck = {
  id: CapabilityId;
  description: string;
  run(): Promise<CapabilityStatus>;
  fixHint?: string;
};
