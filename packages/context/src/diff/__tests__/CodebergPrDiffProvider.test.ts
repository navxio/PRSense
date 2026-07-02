// packages/context/src/diff/__tests__/CodebergPrDiffProvider.test.ts
import { describe, it, expect } from "@jest/globals";
import { CodebergPrDiffProvider } from "../CodebergPrDiffProvider.js";

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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
const text = (body: string, status = 200) =>
  new Response(body, { status, headers: { "content-type": "text/plain" } });

const isDiff = (url: string) => url.endsWith(".diff");

function providerWith(
  handler: (url: string) => Response | Promise<Response>,
  token?: string,
): CodebergPrDiffProvider {
  const fetchImpl: typeof fetch = async (input) =>
    handler(typeof input === "string" ? input : input.toString());
  return new CodebergPrDiffProvider(
    "acme",
    "widgets",
    "7",
    token,
    "codeberg.org",
    fetchImpl,
  );
}

describe("CodebergPrDiffProvider", () => {
  it("maps metadata and diff into a LoadResult", async () => {
    const result = await providerWith((url) =>
      isDiff(url) ? text(DIFF) : json(META),
    ).load();

    expect(result.revision).toBe("headsha123");
    expect(result.baseRevision).toBe("basesha456");
    expect(result.repositoryIdentity).toEqual({
      provider: "codeberg",
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

  it("retries a 502 on the diff request then succeeds", async () => {
    let diffCalls = 0;
    const result = await providerWith((url) => {
      if (!isDiff(url)) return json(META);
      diffCalls += 1;
      return diffCalls === 1 ? text("bad gateway", 502) : text(DIFF);
    }).load();

    expect(diffCalls).toBe(2);
    expect(result.diff.files).toHaveLength(1);
  });

  it("does not retry a 401 and swallows the metadata error", async () => {
    const result = await providerWith((url) =>
      isDiff(url) ? text(DIFF) : json({ message: "unauthorized" }, 401),
    ).load();

    expect(result.metadata).toEqual({});
    expect(result.revision).toBe("unknown");
    expect(result.diff.files).toHaveLength(1);
  });

  it("sends a token auth header when a token is set", async () => {
    const seen: Array<string | null> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      seen.push(new Headers(init?.headers).get("authorization"));
      const url = typeof input === "string" ? input : input.toString();
      return isDiff(url) ? text(DIFF) : json(META);
    };
    await new CodebergPrDiffProvider(
      "acme",
      "widgets",
      "7",
      "cb_secret",
      "codeberg.org",
      fetchImpl,
    ).load();

    expect(seen.every((h) => h === "token cb_secret")).toBe(true);
  });

  it("caches load() so the transport is hit once per request", async () => {
    let calls = 0;
    const provider = providerWith((url) => {
      calls += 1;
      return isDiff(url) ? text(DIFF) : json(META);
    });
    const [a, b] = await Promise.all([provider.load(), provider.load()]);

    expect(a).toBe(b);
    expect(calls).toBe(2);
  });
});
