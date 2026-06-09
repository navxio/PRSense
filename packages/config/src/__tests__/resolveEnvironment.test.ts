// packages/config/src/__tests__/resolveEnvironment.test.ts
import { resolveEnvironment } from "../resolveEnvironment.js";
import { __resetConfigCache } from "../resolveConfig.js";
import { makeTmpRepo, rmTmp } from "./_helpers/fs.js";
import { snapshotEnv, restoreEnv, clearPrsenseEnv } from "./_helpers/env.js";

describe("resolveEnvironment", () => {
  let repoDir: string;

  beforeEach(() => {
    snapshotEnv();
    clearPrsenseEnv();
    __resetConfigCache();
  });
  afterEach(() => {
    restoreEnv();
    if (repoDir) rmTmp(repoDir);
  });

  it("returns config + credentials + issues bundle", () => {
    repoDir = makeTmpRepo();
    const env = resolveEnvironment("cli", {
      root: repoDir,
      provider: "filesystem",
    });
    expect(env.config.mode).toBe("cli");
    expect(env.credentials).toBeDefined();
    expect(Array.isArray(env.issues)).toBe(true);
  });

  it("surfaces credential issues for openai without key", () => {
    repoDir = makeTmpRepo({
      "prsense.yml":
        "llm:\n  provider: openai\n  model: gpt-5\n  temperature: 0.1\n",
    });
    const env = resolveEnvironment("cli", {
      root: repoDir,
      provider: "filesystem",
    });
    expect(env.issues.some((i) => i.path === "llm.provider")).toBe(true);
  });
});
