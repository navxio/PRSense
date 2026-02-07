import { EnvConfig } from "packages/config/dist/index.js";
export type RuntimeMode = "saas" | "self-hosted";

export function inferRuntimeMode(env: EnvConfig): RuntimeMode {
  if (env.PRSENSE_SELF_HOSTED === true) return "self-hosted";

  // strong SaaS signal: no user-managed credentials expected
  if (env.PRSENSE_GITHUB_APP_ID && env.PRSENSE_GITHUB_APP_PRIVATE_KEY) {
    return "saas";
  }

  return "self-hosted";
}
