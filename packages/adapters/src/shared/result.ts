import type { AdapterError } from "./errors.js";
import type { ReviewInput } from "@prsense/domain";

export type AdapterResult =
  | { ok: true; value: ReviewInput }
  | { ok: false; error: AdapterError };
