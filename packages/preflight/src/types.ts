export type CapabilityStatus =
  | { kind: "ready" }
  | { kind: "missing"; reason: string }
  | { kind: "partial"; reason: string };

export type DatabaseConfig = {
  /**
   * Fully resolved database URL.
   * Comes from @prsense/config.
   */
  url: string;

  /**
   * How Postgres is expected to be provided.
   * - bundled: PRsense manages a local container
   * - external: user/self-hosted DB
   */
  mode: "bundled" | "external";
};

export type CapabilityContext = {
  database?: DatabaseConfig;
};

export type Capability = {
  id: string;
  description: string;

  check(ctx: CapabilityContext): Promise<CapabilityStatus>;

  /**
   * Applies the capability if possible.
   * Must be safe to call only when check() != ready.
   */
  apply?(ctx: CapabilityContext): Promise<void>;
};
