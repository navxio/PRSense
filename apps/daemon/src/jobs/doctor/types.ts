// apps/daemon/src/jobs/doctor/types.ts
import type { DoctorWorkflowResult } from "@prsense/workflows";

export type DoctorJobInput = {
  // empty for now; future flags can go here
};

export type DoctorJobResult = DoctorWorkflowResult;
