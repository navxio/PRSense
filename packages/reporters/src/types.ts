import type { ReviewSignal } from "@prsense/core";

/**
 * Reporter = infrastructure egress.
 *
 * Takes review signals and delivers them
 * to some output (stdout, GitHub, JSON, etc).
 */
export type Reporter = (signals: ReviewSignal[]) => Promise<void>;
