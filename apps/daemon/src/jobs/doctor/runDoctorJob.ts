// apps/daemon/src/jobs/doctor/runDoctorJob.ts
import { runDoctorWorkflow } from "@prsense/workflows";
import type { DoctorJobResult } from "./types.js";

export async function runDoctorJob(): Promise<DoctorJobResult> {
  return runDoctorWorkflow();
}
