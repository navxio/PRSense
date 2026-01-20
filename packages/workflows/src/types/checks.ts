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
