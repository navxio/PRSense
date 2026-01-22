// packages/adapters/src/gitlab/types.ts

export type GitLabUser = {
  id: number;
  username: string;
  name: string;
};

export type GitLabProject = {
  id: number;
  path_with_namespace: string;
  web_url: string;
  default_branch: string;
};

export type GitLabMergeRequest = {
  id: number;
  iid: number; // project-scoped MR number
  title: string;
  description: string | null;
  state: "opened" | "closed" | "merged";

  source_branch: string;
  target_branch: string;

  web_url: string;

  author: GitLabUser;
};

export type GitLabMergeRequestEvent = {
  object_kind: "merge_request";
  event_type: "merge_request";

  user: GitLabUser;
  project: GitLabProject;

  object_attributes: GitLabMergeRequest;
};
export type GitLabWebhookEvent = GitLabMergeRequestEvent;
