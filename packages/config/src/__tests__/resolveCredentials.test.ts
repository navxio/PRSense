// packages/config/src/__tests__/resolveCredentials.test.ts
import { resolveCredentials } from "../resolveCredentials.js";
import { snapshotEnv, restoreEnv, clearPrsenseEnv } from "./_helpers/env.js";

describe("resolveCredentials", () => {
  beforeEach(() => {
    snapshotEnv();
    clearPrsenseEnv();
  });
  afterEach(() => restoreEnv());

  it("marks providers unavailable when env unset", () => {
    const c = resolveCredentials();
    expect(c.openai?.available).toBe(false);
    expect(c.github?.available).toBe(false);
    expect(c.codeberg?.available).toBe(false);
  });

  it("picks up openai key", () => {
    process.env.PRSENSE_OPENAI_API_KEY = "sk-test";
    expect(resolveCredentials().openai).toEqual({
      available: true,
      apiKey: "sk-test",
    });
  });

  it("prefers github token over app credentials when both set", () => {
    process.env.PRSENSE_GITHUB_TOKEN = "ghp_x";
    process.env.PRSENSE_GITHUB_APP_ID = "123";
    process.env.PRSENSE_GITHUB_APP_PRIVATE_KEY = "...";
    process.env.PRSENSE_GITHUB_INSTALLATION_ID = "1";
    const c = resolveCredentials();
    expect(c.github?.mode).toBe("token");
  });

  it("uses github app mode when only app creds set", () => {
    process.env.PRSENSE_GITHUB_APP_ID = "123";
    process.env.PRSENSE_GITHUB_APP_PRIVATE_KEY = "...";
    process.env.PRSENSE_GITHUB_INSTALLATION_ID = "1";
    expect(resolveCredentials().github?.mode).toBe("app");
  });

  it("requires all three app fields for app mode", () => {
    process.env.PRSENSE_GITHUB_APP_ID = "123";
    expect(resolveCredentials().github?.available).toBe(false);
  });

  it("picks up codeberg token", () => {
    process.env.PRSENSE_CODEBERG_TOKEN = "cb_test";
    expect(resolveCredentials().codeberg).toEqual({
      available: true,
      token: "cb_test",
    });
  });

  it("includes codeberg webhook secret when set alongside token", () => {
    process.env.PRSENSE_CODEBERG_TOKEN = "cb_test";
    process.env.PRSENSE_CODEBERG_WEBHOOK_SECRET = "whsec";
    expect(resolveCredentials().codeberg).toEqual({
      available: true,
      token: "cb_test",
      webhookSecret: "whsec",
    });
  });
});
