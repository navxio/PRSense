import { execSync } from "node:child_process";
import { DoctorCheckResult } from "../../../shared/doctorTypes.js";

export async function checkRepository(): Promise<DoctorCheckResult> {
  try {
    execSync("git rev-parse --is-inside-work-tree", {
      stdio: "ignore",
    });

    return { status: "ok", name: "Repository state" };
  } catch {
    return {
      status: "fail",
      name: "Repository state",
      message: "Not inside a git repository",
      fix: "Run PRsense inside a git repository",
    };
  }
}
