// packages/adapters/src/types.ts
import type { AdapterResult } from "./result.js";

/**
 * Adapter = infrastructure ingress.
 * Never throws for expected failures.
 */
export type Adapter = () => Promise<AdapterResult>;
