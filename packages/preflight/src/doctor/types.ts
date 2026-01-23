import { CapabilityId, CapabilityStatus } from "../types.js";

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
