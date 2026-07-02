// packages/context/src/diff/__tests__/GithubPrDiffProvider.test.ts
import { describe, it, expect } from "@jest/globals";
import { GitHubPrDiffProvider } from "../GitHubPrDiffProvider.js";

const META = {
  title: "Add widget",
  body: "Adds a widget",
  head: { sha: "headsha123", ref: "feat/widget" },
  base: { sha: "basesha456" },
};

const DIFF = [
  "diff --git a/src/widget.ts b/src/widget.ts",
  "--- a/src/widget.ts",
  "+++ b/src/widget.ts",
  "@@ -1 +1 @@",
  "-old",
  "+new",
  "",
].join("\n");

const wantsDiff = (init?: RequestInit) =>
  new Headers(init?.headers).get("accept")?.includes("diff") ?? false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
const diffText = (body: string, status = 200) =>
  new Response(body, { status, headers: { "content-type": "text/plain" } });

/** Provider wired to a scripted fake fetch. */
function providerWith(
  handler: (url: string, wantsDiff: boolean) => Response | Promise<Response>,
): GitHubPrDiffProvider {
  const fetchImpl: typeof fetch = async (input, init) =>
    handler(
      typeof input === "string" ? input : input.toString(),
      wantsDiff(init as RequestInit),
    );
  return new GitHubPrDiffProvider(
    "acme",
    "widgets",
    "42",
    undefined,
    fetchImpl,
  );
}

describe("GitHubPrDiffProvider", () => {
  it("maps metadata and diff into a LoadResult", async () => {
    const result = await providerWith((_url, diff) =>
      diff ? diffText(DIFF) : json(META),
    ).load();

    expect(result.revision).toBe("headsha123");
    expect(result.baseRevision).toBe("basesha456");
    expect(result.repositoryIdentity).toEqual({
      provider: "github",
      id: "acme/widgets",
    });
    expect(result.metadata).toEqual({
      title: "Add widget",
      description: "Adds a widget",
      branchName: "feat/widget",
    });
    expect(result.diff.files).toHaveLength(1);
    expect(result.diff.files[0]?.path).toBe("src/widget.ts");
  });

  it("retries a 503 then succeeds", async () => {
    let metaCalls = 0;
    const result = await providerWith((_url, diff) => {
      if (diff) return diffText(DIFF);
      metaCalls += 1;
      return metaCalls === 1 ? json({ message: "down" }, 503) : json(META);
    }).load();

    expect(metaCalls).toBe(2);
    expect(result.revision).toBe("headsha123");
  });

  it("does not retry a 404 and swallows the metadata error", async () => {
    let metaCalls = 0;
    const result = await providerWith((_url, diff) => {
      if (diff) return diffText(DIFF);
      metaCalls += 1;
      return json({ message: "not found" }, 404);
    }).load();

    expect(metaCalls).toBe(1);
    expect(result.metadata).toEqual({});
    expect(result.revision).toBe("unknown");
    expect(result.diff.files).toHaveLength(1);
  });

  it("sends a Bearer auth header when a token is set", async () => {
    const seen: Array<string | null> = [];
    const fetchImpl: typeof fetch = async (_input, init) => {
      seen.push(new Headers(init?.headers).get("authorization"));
      return wantsDiff(init as RequestInit) ? diffText(DIFF) : json(META);
    };
    await new GitHubPrDiffProvider(
      "acme",
      "widgets",
      "42",
      "ghp_secret",
      fetchImpl,
    ).load();

    expect(seen.every((h) => h === "Bearer ghp_secret")).toBe(true);
  });

  it("caches load() so the transport is hit once per request", async () => {
    let calls = 0;
    const provider = providerWith((_url, diff) => {
      calls += 1;
      return diff ? diffText(DIFF) : json(META);
    });
    const [a, b] = await Promise.all([provider.load(), provider.load()]);

    expect(a).toBe(b);
    expect(calls).toBe(2);
  });
});
