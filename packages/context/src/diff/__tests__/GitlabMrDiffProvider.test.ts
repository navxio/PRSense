// packages/context/src/diff/__tests__/GitlabMrDiffProvider.test.ts
import { describe, it, expect } from "@jest/globals";
import { GitLabMrDiffProvider } from "../GitLabMrDiffProvider.js";

// GitLab returns snake_case; base_sha lives under diff_refs.
const META = {
  title: "Add widget",
  description: "Adds a widget",
  sha: "headsha123",
  source_branch: "feat/widget",
  diff_refs: { base_sha: "basesha456" },
};

const CHANGES = {
  changes: [
    {
      old_path: "src/widget.ts",
      new_path: "src/widget.ts",
      diff: ["@@ -1 +1 @@", "-old", "+new"].join("\n"),
    },
  ],
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const isChanges = (url: string) => url.endsWith("/changes");

function providerWith(
  handler: (url: string) => Response | Promise<Response>,
): GitLabMrDiffProvider {
  const fetchImpl: typeof fetch = async (input) =>
    handler(typeof input === "string" ? input : input.toString());
  return new GitLabMrDiffProvider(
    "acme",
    "widgets",
    "13",
    undefined,
    fetchImpl,
  );
}

describe("GitLabMrDiffProvider", () => {
  it("builds a single-encoded project path (guards the double-encode bug)", async () => {
    const seen: string[] = [];
    await providerWith((url) => {
      seen.push(url);
      return json(isChanges(url) ? CHANGES : META);
    }).load();

    expect(seen.some((u) => u.includes("acme%2Fwidgets"))).toBe(true);
    expect(seen.some((u) => u.includes("%252F"))).toBe(false);
  });

  it("maps metadata and diff into a LoadResult", async () => {
    const result = await providerWith((url) =>
      json(isChanges(url) ? CHANGES : META),
    ).load();

    expect(result.revision).toBe("headsha123");
    // Regression guard: reads diff_refs.base_sha (not camelCase diffRefs).
    expect(result.baseRevision).toBe("basesha456");
    expect(result.repositoryIdentity).toEqual({
      provider: "gitlab",
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

  it("retries a 503 on metadata then succeeds", async () => {
    let metaCalls = 0;
    const result = await providerWith((url) => {
      if (isChanges(url)) return json(CHANGES);
      metaCalls += 1;
      return metaCalls === 1 ? json({ message: "down" }, 503) : json(META);
    }).load();

    expect(metaCalls).toBe(2);
    expect(result.revision).toBe("headsha123");
  });

  it("does not retry a 404 and swallows the metadata error", async () => {
    let metaCalls = 0;
    const result = await providerWith((url) => {
      if (isChanges(url)) return json(CHANGES);
      metaCalls += 1;
      return json({ message: "not found" }, 404);
    }).load();

    expect(metaCalls).toBe(1);
    expect(result.metadata).toEqual({});
    expect(result.revision).toBe("unknown");
    expect(result.diff.files).toHaveLength(1);
  });

  it("sends a PRIVATE-TOKEN header when a token is set", async () => {
    const seen: Array<string | null> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      seen.push(new Headers(init?.headers).get("private-token"));
      const url = typeof input === "string" ? input : input.toString();
      return json(isChanges(url) ? CHANGES : META);
    };
    await new GitLabMrDiffProvider(
      "acme",
      "widgets",
      "13",
      "glpat_secret",
      fetchImpl,
    ).load();

    expect(seen.every((h) => h === "glpat_secret")).toBe(true);
  });

  it("caches load() so each endpoint is hit once", async () => {
    let calls = 0;
    const provider = providerWith((url) => {
      calls += 1;
      return json(isChanges(url) ? CHANGES : META);
    });
    const [a, b] = await Promise.all([provider.load(), provider.load()]);

    expect(a).toBe(b);
    expect(calls).toBe(2);
  });
});
