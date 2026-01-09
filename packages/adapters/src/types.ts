// packages/adapters/src/types.ts
import type { ReviewInput } from "@prsense/domain";

/**
 * Adapter = infrastructure ingress.
 *
 * Fetches data from the outside world and
 * normalizes it into ReviewInput.
 */
export type Adapter = () => Promise<ReviewInput>;
