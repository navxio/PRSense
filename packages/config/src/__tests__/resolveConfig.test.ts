import { resolveConfig, __resetConfigCache } from "../resolveConfig.js";
import { makeTmpRepo, rmTmp } from "./_helpers/fs.js";
import { snapshotEnv, restoreEnv, clearPrsenseEnv } from "./_helpers/env.js";

describe("resolveConfig", () => {
  let repoDir: string;
  let homeDir: string;

  beforeEach(() => {
    snapshotEnv();
    clearPrsenseEnv();
    __resetConfigCache();
  });

  afterEach(() => {
    restoreEnv();
    if (repoDir) rmTmp(repoDir);
    if (homeDir) rmTmp(homeDir);
  });

  it("layers defaults < global < repo", () => {
    homeDir = makeTmpRepo({
      "prsense/config.yml": "llm:\n  model: from-global\n",
    });
    repoDir = makeTmpRepo({
      "prsense.yml": "llm:\n  temperature: 0.5\n",
    });
    process.env.XDG_CONFIG_HOME = homeDir;

    const cfg = resolveConfig("cli", { root: repoDir, provider: "filesystem" });
    expect(cfg.llm.model).toBe("from-global"); // global beats defaults
    expect(cfg.llm.temperature).toBe(0.5); // repo beats global
    expect(cfg.llm.provider).toBe("ollama"); // defaults survive
  });

  it("repo config overrides global", () => {
    homeDir = makeTmpRepo({ "prsense/config.yml": "llm:\n  model: a\n" });
    repoDir = makeTmpRepo({ "prsense.yml": "llm:\n  model: b\n" });
    process.env.XDG_CONFIG_HOME = homeDir;

    const cfg = resolveConfig("cli", { root: repoDir, provider: "filesystem" });
    expect(cfg.llm.model).toBe("b");
  });

  it("caches per (mode, root)", () => {
    repoDir = makeTmpRepo();
    const a = resolveConfig("cli", { root: repoDir, provider: "filesystem" });
    const b = resolveConfig("cli", { root: repoDir, provider: "filesystem" });
    expect(a).toBe(b); // identity equal — cache hit
  });

  it("does not cross-pollinate caches between modes", () => {
    repoDir = makeTmpRepo();
    const cli = resolveConfig("cli", { root: repoDir, provider: "filesystem" });
    const daemon = (() => {
      try {
        return resolveConfig("daemon", {
          root: repoDir,
          provider: "filesystem",
        });
      } catch (e) {
        return e;
      }
    })();
    // daemon should throw (no delivery), proving distinct paths
    expect(cli.mode).toBe("cli");
    expect(daemon).toBeInstanceOf(Error);
  });
});
