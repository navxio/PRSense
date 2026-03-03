export type DoctorCheckStatus = "ok" | "warn" | "fail";

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

export type DoctorWorkflowResult = {
  checks: DiagnosticCheck[];
};
