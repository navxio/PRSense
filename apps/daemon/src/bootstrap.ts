//apps/daemon/src/bootstrap.ts
import { loadUserConfig, loadEnvConfig } from "@prsense/config";
import {
  resolveConfig,
  validateResolvedConfig,
  buildCredentialContext,
  validateCredentialContext,
} from "@prsense/runtime-config";

export type DaemonContext = {
  config: any;
  credentials: any;
};

export function bootstrapDaemon(): DaemonContext {
  const cwd = process.cwd();

  const user = loadUserConfig(cwd);
  const env = loadEnvConfig();

  const resolved = resolveConfig({
    mode: "daemon",
    repoRoot: cwd,
    repoProvider: "filesystem", // default — webhook will override per job
    user,
    env,
  });

  const credentials = buildCredentialContext(env);

  const domainValidation = validateResolvedConfig(resolved);
  const credentialIssues = validateCredentialContext(resolved, credentials);

  const issues = [...domainValidation.issues, ...credentialIssues];

  const errors = issues.filter((i) => i.level === "error");

  if (errors.length > 0) {
    console.error("Daemon configuration invalid:\n");
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
