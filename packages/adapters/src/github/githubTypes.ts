export type GitHubPullRequest = {
  title: string;
  body: string | null;
  base: {
    ref: string;
  };
  user: {
    login: string;
  } | null;
};
