export type DoctorCheckStatus = "ok" | "warn" | "fail";

export type DoctorCheckResult = {
  name: string;
  status: DoctorCheckStatus;
  message?: string;
  fix?: string;
};

export type DoctorWorkflowResult = {
  checks: DoctorCheckResult[];
};

/**
 * A single diagnostic check.
 * Domain-neutral, execution-neutral.
 */
export type DiagnosticCheck = {
  /** Stable identifier (used for reporting & automation) */
  id: string;

  /** Human-readable label */
  label: string;

  status: DoctorCheckStatus;

  /** Optional short explanation */
  message?: string;

  /** Optional structured details */
  details?: unknown;
};
