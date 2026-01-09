export type AdapterError =
  | {
      kind: "AuthError";
      message: string;
    }
  | {
      kind: "NotFoundError";
      message: string;
    }
  | {
      kind: "InvalidInputError";
      message: string;
    }
  | {
      kind: "IOError";
      message: string;
      cause?: unknown;
    }
  | {
      kind: "UnknownError";
      message: string;
      cause?: unknown;
    };
