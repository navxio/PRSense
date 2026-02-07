import { GitHubCredentials } from "./credentials/Github.js";
import { GitLabCredentials } from "./credentials/GitLab.js";
import { OpenAICredentials } from "./credentials/OpenAI.js";
import { SlackCredentials } from "./credentials/Slack.js";

export type CredentialContext = {
  mode: "saas" | "self-hosted";

  github?: GitHubCredentials;
  gitlab?: GitLabCredentials;
  openai?: OpenAICredentials;
  slack?: SlackCredentials;
};
