import { loadUserConfig } from "@prsense/config";
import { DoctorCheckResult } from "../../../shared/doctorTypes.js";

export async function checkUserConfig(): Promise<DoctorCheckResult> {
  try {
    loadUserConfig(process.cwd());
    return { status: "ok", name: "User configuration" };
  } catch (err) {
    return {
      status: "fail",
      name: "User configuration",
      message: err instanceof Error ? err.message : "Invalid prsense.yml",
      fix: "Fix prsense.yml or remove it to use defaults",
    };
  }
}
