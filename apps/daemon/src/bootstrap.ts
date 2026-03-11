// apps/daemon/src/bootstrap.ts

import { loadGlobalConfig, loadEnvConfig } from "@prsense/config";
import {
  resolveConfig,
  validateResolvedConfig,
  buildCredentialContext,
  validateCredentialContext,
  type ResolvedConfig,
  type CredentialContext,
} from "@prsense/config;

export type DaemonContext = {
  config: ResolvedConfig;
  credentials: CredentialContext;
};

export function bootstrapDaemon(): DaemonContext {
  const cwd = process.cwd();

  // 1️⃣ Load global-only user config
  const globalConfig = loadGlobalConfig();

  // 2️⃣ Load env config
  const env = loadEnvConfig();

  // 3️⃣ Resolve into daemon-mode config
  const resolved = resolveConfig({
    mode: "daemon",
    repoRoot: cwd,
    repoProvider: "filesystem", // placeholder — job-level override later
    user: globalConfig,
    env,
  });

  // 4️⃣ Build credential context
  const credentials = buildCredentialContext(env);

  // 5️⃣ Validate domain config
  const domainValidation = validateResolvedConfig(resolved);

  // 6️⃣ Validate credentials
  const credentialIssues = validateCredentialContext(resolved, credentials);

  const issues = [...domainValidation.issues, ...credentialIssues];

  const errors = issues.filter((i) => i.level === "error");

  if (errors.length > 0) {
    console.error("❌ PRSense daemon configuration invalid:\n");
    for (const err of errors) {
      console.error(`- ${err.message}`);
    }
    process.exit(1);
  }

  return {
    config: resolved,
    credentials,
  };
}
