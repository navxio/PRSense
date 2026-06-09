// packages/config/src/__tests__/buildResolvedConfig.test.ts
import { buildResolvedConfig } from "../buildResolvedConfig.js";
import { RuntimeConfigSchema } from "../schema.js";

const runtime = () => RuntimeConfigSchema.parse({}) as any;
const repo = { root: "/tmp/x", provider: "filesystem" as const };

describe("buildResolvedConfig", () => {
  it("produces cli config without delivery", () => {
    const r = buildResolvedConfig(runtime(), "cli", repo);
    expect(r.mode).toBe("cli");
    expect((r as any).delivery).toBeUndefined();
  });

  it("throws in daemon mode without delivery", () => {
    expect(() => buildResolvedConfig(runtime(), "daemon", repo)).toThrow();
  });

  it("produces daemon config with delivery", () => {
    const r = buildResolvedConfig(
      { ...runtime(), delivery: { platform: "github", other: [] } },
      "daemon",
      repo,
    );
    expect(r.mode).toBe("daemon");
    if (r.mode === "daemon") {
      expect(r.delivery.platform).toBe("github");
    }
  });
});
