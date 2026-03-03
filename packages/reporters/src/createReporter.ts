import type { DeliveryReporter } from "./types.js";
import { GitHubReporter } from "./githubReporter.js";
import { GitLabReporter } from "./gitlabReporter.js";
import type { CredentialContext } from "@prsense/runtime-config";

export function createReporter(
  provider: "github" | "gitlab",
  credentials: CredentialContext,
): DeliveryReporter | null {
  if (provider === "github") {
    if (!credentials.github?.token) return null;
    return new GitHubReporter(credentials.github.token);
  }

  if (provider === "gitlab") {
    if (!credentials.gitlab?.token) return null;
    return new GitLabReporter(credentials.gitlab.token);
  }

  return null;
}
