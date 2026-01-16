export type RepositoryFile = {
  path: string;
  content: string;
  language?: string;
};

export type RepositorySource = {
  repo: {
    id: string;
    name: string;
  };
  files(): AsyncIterable<RepositoryFile>;
};
