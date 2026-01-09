import fs from "node:fs/promises";
import path from "node:path";

import type { Adapter } from "./types.js";
import type { AdapterResult } from "./result.js";

export type FilesystemAdapterOptions = {
  repoRoot: string;
  diffPath: string;
};

export function filesystemAdapter(options: FilesystemAdapterOptions): Adapter {
  const { repoRoot, diffPath } = options;

  return async (): Promise<AdapterResult> => {
    try {
      const diffText = await fs.readFile(
        path.resolve(repoRoot, diffPath),
        "utf8",
      );

      return {
        ok: true,
        value: {
          repo: {
            owner: "local",
            name: path.basename(repoRoot),
          },
          repoRoot,
          diffText,
        },
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return {
          ok: false,
          error: {
            kind: "NotFoundError",
            message: `Diff file not found at ${diffPath}`,
          },
        };
      }

      return {
        ok: false,
        error: {
          kind: "IOError",
          message: "Failed to read diff from filesystem",
          cause: err,
        },
      };
    }
  };
}
