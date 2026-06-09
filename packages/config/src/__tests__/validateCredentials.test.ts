// packages/config/src/__tests__/validateCredentials.test.ts
import { validateCredentials } from "../validateCredentials.js";
import type { ResolvedConfig, CredentialContext } from "../types.js";

const cliCfg = (overrides: Partial<any> = {}): ResolvedConfig =>
  ({
    mode: "cli",
    repository: { root: "/tmp", provider: "filesystem" },
    llm: { provider: "ollama", model: "x", temperature: 0.1 },
    embeddings: { provider: "ollama", model: "x" },
    index: { chunkSizeChars: 1000, chunkOverlapChars: 200, auto: true },
    review: { confidenceThreshold: 0.8, maxSignals: 3 },
    context: { maxChunks: 5 },
    git: { baseBranch: "main" },
    logLevel: "warn",
    ...overrides,
  }) as any;

const noCreds: CredentialContext = {};

describe("validateCredentials", () => {
  it("passes for ollama llm with no creds", () => {
    expect(validateCredentials(cliCfg(), noCreds)).toEqual([]);
  });

  it("fails when openai selected without key", () => {
    const issues = validateCredentials(
      cliCfg({ llm: { provider: "openai", model: "gpt-5", temperature: 0.1 } }),
      noCreds,
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        level: "error",
        path: "llm.provider",
      }),
    );
  });

  it("fails when openai embeddings selected without key", () => {
    const issues = validateCredentials(
      cliCfg({
        embeddings: { provider: "openai", model: "text-embedding-3-small" },
      }),
      noCreds,
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        path: "embeddings.provider",
      }),
    );
  });

  it("daemon + github delivery requires github creds + webhook secret", () => {
    const cfg = cliCfg({
      mode: "daemon",
      delivery: { platform: "github", other: [] },
    });
    const issues = validateCredentials(cfg, noCreds);
    expect(issues.length).toBeGreaterThanOrEqual(2); // creds + webhook
    expect(issues.every((i) => i.level === "error")).toBe(true);
  });

  it("daemon + github passes with token + webhook secret", () => {
    const cfg = cliCfg({
      mode: "daemon",
      delivery: { platform: "github", other: [] },
    });
    const creds: CredentialContext = {
      github: {
        available: true,
        mode: "token",
        token: "x",
        webhookSecret: "s",
      },
    };
    expect(validateCredentials(cfg, creds)).toEqual([]);
  });

  it("daemon + slack other-channel requires bot token", () => {
    const cfg = cliCfg({
      mode: "daemon",
      delivery: { platform: "github", other: ["slack"] },
    });
    const creds: CredentialContext = {
      github: {
        available: true,
        mode: "token",
        token: "x",
        webhookSecret: "s",
      },
    };
    const issues = validateCredentials(cfg, creds);
    expect(issues).toContainEqual(
      expect.objectContaining({ path: "delivery.other" }),
    );
  });
});
