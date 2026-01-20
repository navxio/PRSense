export type CapabilityStatus =
  | { kind: "ready" }
  | { kind: "missing"; reason: string }
  | { kind: "partial"; reason: string };

export type Capability = {
  id: string;
  description: string;

  check(): Promise<CapabilityStatus>;
  apply?: () => Promise<void>;
};
