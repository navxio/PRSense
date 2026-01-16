import { loadEnvConfig } from "@prsense/config";
import { DoctorCheckResult } from "../../../shared/doctorTypes.js";

export async function checkEnvConfig(): Promise<DoctorCheckResult> {
  try {
    loadEnvConfig(process.env);
    return { status: "ok", name: "Environment variables" };
  } catch (err) {
    return {
      status: "fail",
      name: "Environment variables",
      message:
        err instanceof Error
          ? err.message
          : "Invalid environment configuration",
      fix: "Set required PRSENSE_* environment variables",
    };
  }
}
