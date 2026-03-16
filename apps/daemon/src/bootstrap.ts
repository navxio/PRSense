// apps/daemon/src/bootstrap.ts
import type { CredentialContext, ResolvedConfig } from "@prsense/config";
import { resolveEnvironment } from "@prsense/config";

type DaemonContext = {
  config: ResolvedConfig;
  credentials: CredentialContext;
};
export function bootstrapDaemon(): DaemonContext {
  const cwd = process.cwd();

  const env = resolveEnvironment("daemon", {
    root: cwd,
    provider: "filesystem",
  });

  // 1️⃣ Load global-only user config
  const errors = env.issues.filter((i) => i.level === "error");

  if (errors.length > 0) {
    console.error("❌ PRSense daemon configuration invalid:\n");
    for (const err of errors) {
      console.error(`- ${err.message}`);
    }
    process.exit(1);
  }

  return {
    config: env.config,
    credentials: env.credentials,
  };
}
