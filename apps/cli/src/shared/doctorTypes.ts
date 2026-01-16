export type DoctorCheckResult =
  | { status: "ok"; name: string }
  | { status: "warn"; name: string; message: string }
  | { status: "fail"; name: string; message: string; fix?: string };
