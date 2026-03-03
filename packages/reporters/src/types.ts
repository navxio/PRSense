export type ReviewContext = {
  targetUrl: string;
  repositoryProvider: "github" | "gitlab";
};

export type Reporter<T> = {
  report(result: T): Promise<void>;
};
