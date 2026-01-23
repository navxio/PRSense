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

export type DoctorCheckResult = {
  id: string;
  status: "ok" | "fail";
  message: string;
  fix?: {
    command: string;
  };
};

export type CheckStatus = "pass" | "warn" | "fail";

/**
 * A single diagnostic check.
 * Domain-neutral, execution-neutral.
 */
export type WorkflowCheck = {
  /** Stable identifier (used for reporting & automation) */
  id: string;

  /** Human-readable label */
  label: string;

  status: CheckStatus;

  /** Optional short explanation */
  message?: string;

  /** Optional structured details */
  details?: unknown;
};
