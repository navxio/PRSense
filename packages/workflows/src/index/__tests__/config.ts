export function testConfig(): any {
  return {
    database: {
      url: "postgres://prsense:prsense@localhost:10001/prsense_test",
    },
    embeddings: {
      provider: "ollama",
      model: "test",
    },
    index: {
      chunkSizeChars: 500,
      chunkOverlapChars: 50,
    },

    // ---- REQUIRED BUT UNUSED IN INDEX WORKFLOW ----
    repository: {},
    review: {},
    context: {},
    llm: {},
  };
}
export function testCredentials() {
  return {};
}