// packages/config/src/__tests__/schema.test.ts
import { RuntimeConfigSchema, ResolvedConfigSchema } from "../schema.js";

const validRuntime = () => RuntimeConfigSchema.parse({}) as any;
describe("RuntimeConfigSchema", () => {
  it("accepts defaults", () => {
    expect(() => RuntimeConfigSchema.parse(validRuntime())).not.toThrow();
  });

  it("rejects chunkOverlap >= chunkSize", () => {
    const cfg = validRuntime();
    cfg.index.chunkOverlapChars = 1000;
    cfg.index.chunkSizeChars = 1000;
    expect(() => RuntimeConfigSchema.parse(cfg)).toThrow(
      /chunkOverlapChars must be smaller/,
    );
  });

  it("rejects negative chunkOverlap", () => {
    const cfg = validRuntime();
    cfg.index.chunkOverlapChars = -1;
    expect(() => RuntimeConfigSchema.parse(cfg)).toThrow();
  });

  it("rejects confidenceThreshold out of [0,1]", () => {
    const cfg = validRuntime();
    cfg.review.confidenceThreshold = 1.5;
    expect(() => RuntimeConfigSchema.parse(cfg)).toThrow();
  });

  it("rejects unknown llm provider", () => {
    const cfg = validRuntime();
    cfg.llm.provider = "groq";
    expect(() => RuntimeConfigSchema.parse(cfg)).toThrow();
  });

  it("rejects empty model strings", () => {
    const cfg = validRuntime();
    cfg.llm.model = "  ";
    // depending on how you implement min(1).trim() — adjust assertion
    expect(() =>
      RuntimeConfigSchema.parse({ ...cfg, llm: { ...cfg.llm, model: "" } }),
    ).toThrow();
  });

  it("treats delivery as optional", () => {
    const cfg = validRuntime();
    delete cfg.delivery;
    expect(() => RuntimeConfigSchema.parse(cfg)).not.toThrow();
  });

  it("applies index.auto default when omitted", () => {
    const parsed = RuntimeConfigSchema.parse({
      index: { chunkSizeChars: 500, chunkOverlapChars: 100 },
    });
    expect(parsed.index.auto).toBe(true);
  });
});

describe("ResolvedConfigSchema", () => {
  const repo = { root: "/tmp/x", provider: "filesystem" as const };

  it("accepts cli mode without delivery", () => {
    const cfg = { ...validRuntime(), mode: "cli", repository: repo };
    expect(() => ResolvedConfigSchema.parse(cfg)).not.toThrow();
  });

  it("rejects daemon mode without delivery", () => {
    const cfg = { ...validRuntime(), mode: "daemon", repository: repo };
    expect(() => ResolvedConfigSchema.parse(cfg)).toThrow();
  });

  it("accepts daemon mode with delivery", () => {
    const cfg = {
      ...validRuntime(),
      mode: "daemon",
      repository: repo,
      delivery: { platform: "github", other: [] },
    };
    expect(() => ResolvedConfigSchema.parse(cfg)).not.toThrow();
  });

  it("rejects unknown delivery platform", () => {
    const cfg = {
      ...validRuntime(),
      mode: "daemon",
      repository: repo,
      delivery: { platform: "bitbucket", other: [] },
    };
    expect(() => ResolvedConfigSchema.parse(cfg)).toThrow();
  });
});
