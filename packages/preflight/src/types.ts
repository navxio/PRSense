// packages/preflight/src/types.ts
import { ResolvedConfig } from "@prsense/runtime-config";

export type CapabilityStatus =
  | { kind: "ready" }
  | { kind: "missing"; reason: string }
  | { kind: "partial"; reason: string };

export type CapabilityContext = {
  config: ResolvedConfig;
  env: NodeJS.ProcessEnv;
  cwd: string;
};

export type Capability = {
  id: string;
  description: string;

  /**
   * Pure observation.
   * No side effects beyond probing the system.
   */
  check(ctx: CapabilityContext): Promise<CapabilityStatus>;

  /**
   * Optional fix.
   * Only called when check() returns { kind: "missing" }.
   */
  apply?(ctx: CapabilityContext): Promise<void>;
};
