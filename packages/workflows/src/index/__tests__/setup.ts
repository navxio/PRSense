
jest.mock("@prsense/llm", () => ({
  createOpenAiEmbeddingClient: () => ({
    dimension: async () => 768,
    embed: async (texts: string[]) =>
      texts.map(() => Array(768).fill(0.1)),
  }),
  createOllamaEmbeddingClient: () => ({
    dimension: async () => 768,
    embed: async (texts: string[]) =>
      texts.map(() => Array(768).fill(0.1)),
  }),
}));

jest.mock("@octokit/rest", () => ({
  Octokit: function () { },
}));