import type {
  Capability,
  CapabilityContext,
  CapabilityStatus,
} from "@prsense/capabilities";

export type DoctorCheckResult = {
  id: string;
  status: "ok" | "fail";
  message: string;
  fix?: {
    command: string;
  };
};

function mapStatus(
  cap: Capability,
  status: CapabilityStatus,
): DoctorCheckResult {
  if (status.kind === "ready") {
    return {
      id: cap.id,
      status: "ok",
      message: cap.description,
    };
  }

  let result: DoctorCheckResult = {
    id: cap.id,
    status: "fail",
    message: status.reason,
  };

  if (cap.apply) {
    result["fix"] = { command: suggestFix(cap.id) };
  }

  return result;
}

function suggestFix(capabilityId: string): string {
  switch (capabilityId) {
    case "docker":
      return "Install Docker and ensure it is running";
    case "postgres":
      return "prsense setup db";
    case "pgvector":
      return "prsense setup db";
    default:
      return "See documentation";
  }
}

export async function runCapabilityCheck(
  cap: Capability,
  ctx: CapabilityContext,
): Promise<DoctorCheckResult> {
  const status = await cap.check(ctx);
  return mapStatus(cap, status);
}
