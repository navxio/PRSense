// packages/preflight/src/capabilities/dataDir.ts
import fs from "node:fs";
import { PRSENSE_DATA_DIR, DB_PATH } from "@prsense/core";
import type {
  Capability,
  CapabilityContext,
  CapabilityStatus,
} from "../types.js";

export const dataDirCapability: Capability = {
  id: "data-dir",
  description: "Data directory is writable",

  async check(_ctx: CapabilityContext): Promise<CapabilityStatus> {
    try {
      fs.mkdirSync(PRSENSE_DATA_DIR, { recursive: true });
      // probe write access — mkdirSync above can succeed on a read-only mount
      // if the dir already exists, so do an explicit access check
      fs.accessSync(PRSENSE_DATA_DIR, fs.constants.W_OK);
    } catch (err: any) {
      return {
        kind: "missing",
        reason: `Data directory not writable: ${PRSENSE_DATA_DIR} (${err.code ?? err.message})`,
      };
    }

    // If the DB file exists, make sure we can open it.
    // We don't validate schema — openDatabase() ensures it on open.
    if (fs.existsSync(DB_PATH)) {
      try {
        fs.accessSync(DB_PATH, fs.constants.R_OK | fs.constants.W_OK);
      } catch (err: any) {
        return {
          kind: "partial",
          reason: `Database file exists but is not readable/writable: ${DB_PATH}`,
        };
      }
    }

    return { kind: "ready" };
  },

  async apply(_ctx: CapabilityContext): Promise<void> {
    // The only "fix" we can offer is creating the dir; permissions/disk-full
    // problems require user intervention.
    fs.mkdirSync(PRSENSE_DATA_DIR, { recursive: true });
  },
};
