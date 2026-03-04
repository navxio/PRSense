// apps/cli/src/version.ts
import pkg from "../package.json" with { type: "json" };

export const PRSENSE_VERSION = pkg.version;
