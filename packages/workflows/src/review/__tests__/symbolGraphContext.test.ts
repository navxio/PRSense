// packages/workflows/src/review/__tests__/symbolGraphContext.test.ts
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { execFile as execFileCb } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type {
  ContextProvider,
  UnifiedDiff,
  RepositoryIdentity,
  EventBus,
  ContextChunk,
} from "@prsense/core";
import { SymbolGraphContextProvider } from "@prsense/context";
import {
  resolveContext,
  type ResolveContextParams,
} from "../steps/resolveContext.js";

const execFile = promisify(execFileCb);
async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFile("git", args, { cwd });
  return stdout.trim();
}

class TestEventBus implements EventBus {
  events: Array<{ event: string; fields?: unknown }> = [];
  emit(event: string, fields?: unknown) {
    this.events.push({ event, fields });
  }
}

// Minimal stand-in for RagContextProvider — returns nothing, marks itself
// unavailable. Isolates the symbol-graph path under test.
class NullRagProvider implements ContextProvider {
  readonly name = "rag";
  async isAvailable() {
    return false;
  }
  async getContextForFile() {
    return [];
  }
}

describe("symbol-graph context (integration)", () => {
  let repoRoot: string;
  let baseSha: string;
  let headSha: string;

  beforeAll(async () => {
    repoRoot = await mkdtemp(join(tmpdir(), "sg-int-"));
    await git(repoRoot, "init", "-q", "--initial-branch=main");
    await git(repoRoot, "config", "user.email", "test@example.com");
    await git(repoRoot, "config", "user.name", "test");
    await git(repoRoot, "config", "commit.gpgsign", "false");

    // Minimal TS project rooted at repo. No monorepo wrinkles.
    await writeFile(
      join(repoRoot, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
        },
      }),
    );
    await writeFile(
      join(repoRoot, "package.json"),
      JSON.stringify({ name: "fixture", type: "module" }),
    );
    await mkdir(join(repoRoot, "src"), { recursive: true });

    // BASE state:
    // - session.ts exports createSession(userId)
    // - session.ts exports destroySession(id) — body-only change later
    // - login.ts calls createSession (the dependent caller)
    // - billing.ts mentions "session" but doesn't call createSession (non-caller)
    await writeFile(
      join(repoRoot, "src/session.ts"),
      [
        "export function createSession(userId: string): { userId: string } {",
        "  return { userId };",
        "}",
        "",
        "export function destroySession(id: string): void {",
        "  console.log('destroy', id);",
        "}",
        "",
      ].join("\n"),
    );
    await writeFile(
      join(repoRoot, "src/login.ts"),
      [
        "import { createSession } from './session.js';",
        "export function login(user: string) {",
        "  const session = createSession(user);",
        "  return session;",
        "}",
        "",
      ].join("\n"),
    );
    await writeFile(
      join(repoRoot, "src/billing.ts"),
      [
        "// This file mentions a session in comments, but does not call createSession.",
        "export function chargeForSession(amount: number): number {",
        "  return amount * 2;",
        "}",
        "",
      ].join("\n"),
    );
    await git(repoRoot, "add", ".");
    await git(repoRoot, "commit", "-q", "-m", "base");
    baseSha = await git(repoRoot, "rev-parse", "HEAD");

    // HEAD state — two changes in session.ts:
    //   1. createSession gains a second parameter (signature change → trigger)
    //   2. destroySession changes only its body (body-only → no trigger)
    await writeFile(
      join(repoRoot, "src/session.ts"),
      [
        "export function createSession(",
        "  userId: string,",
        "  ttl: number,",
        "): { userId: string; ttl: number } {",
        "  return { userId, ttl };",
        "}",
        "",
        "export function destroySession(id: string): void {",
        "  console.log('destroying session', id);",
        "}",
        "",
      ].join("\n"),
    );
    await git(repoRoot, "add", ".");
    await git(repoRoot, "commit", "-q", "-m", "head");
    headSha = await git(repoRoot, "rev-parse", "HEAD");
  });

  afterAll(async () => {
    if (repoRoot) await rm(repoRoot, { recursive: true, force: true });
  });

  it("surfaces dependent callers, excludes non-callers, ignores body-only changes", async () => {
    // Diff covers both files changed in session.ts (signature + body-only).
    // login.ts and billing.ts are unchanged at HEAD.
    const diff: UnifiedDiff = {
      files: [
        {
          path: "src/session.ts",
          patch: "diff --git unused\n",
          hunks: [
            // The signature lines AND the destroySession body lines are
            // both covered; the candidate gate is intentionally permissive,
            // and the signature diff downstream filters body-only out.
            { startLine: 1, endLine: 9, content: "" },
          ],
        },
      ],
    };

    const repositoryIdentity: RepositoryIdentity = {
      provider: "filesystem",
      id: repoRoot,
    };
    const eventBus = new TestEventBus();

    const result = await resolveContext({
      // Cast through unknown for the bits the test doesn't exercise.
      config: {
        repository: { root: repoRoot, provider: "filesystem" },
        embeddings: { provider: "ollama", model: "x" },
        context: { maxChunks: 5 },
      } as unknown as ResolveContextParams["config"],
      repositoryIdentity,
      revision: headSha,
      baseRevision: baseSha,
      diff,
      eventBus,
      repository: {} as unknown as ResolveContextParams["repository"],
      metadataRepository:
        {} as unknown as ResolveContextParams["metadataRepository"],
      providers: [
        new NullRagProvider(),
        new SymbolGraphContextProvider({
          repoRoot,
          baseSha,
        }),
      ],
    });

    expect(result.contextualReviewAvailable).toBe(true);

    const chunks = result.contextByFile.get("src/session.ts") ?? [];

    // 1. Symbol-graph found at least one reference chunk.
    const refChunks = chunks.filter((c) => c.provider === "references");
    expect(refChunks.length).toBeGreaterThan(0);

    // 2. The dependent caller (login.ts) is in the chunks; the non-caller
    //    (billing.ts) is not.
    const refPaths = new Set(
      refChunks.map((c: ContextChunk) => c.metadata?.path),
    );
    expect(refPaths.has("src/login.ts")).toBe(true);
    expect(refPaths.has("src/billing.ts")).toBe(false);
    expect(refPaths.has("src/session.ts")).toBe(false); // self-file excluded

    // 3. Only createSession triggered — destroySession was body-only.
    //    Chunks for destroySession would have its name in metadata.symbols.
    const symbolsSurfaced = new Set(
      refChunks.flatMap((c) => c.metadata?.symbols ?? []),
    );
    expect(symbolsSurfaced.has("createSession")).toBe(true);
    expect(symbolsSurfaced.has("destroySession")).toBe(false);

    // 4. The rendered snippet contains the actual call expression.
    const loginChunk = refChunks.find(
      (c) => c.metadata?.path === "src/login.ts",
    );
    expect(loginChunk?.content).toContain("createSession(user)");

    // 5. Projects-loaded event fired exactly once.
    const projectsLoaded = eventBus.events.filter(
      (e) => e.event === "workflow.review.symbol_graph.projects.loaded",
    );
    expect(projectsLoaded.length).toBe(1);

    // 6. References-retrieved event fired for createSession with the
    //    expected total.
    const refsRetrieved = eventBus.events.find(
      (e) =>
        e.event === "workflow.review.symbol_graph.references.retrieved" &&
        (e.fields as { symbol?: string })?.symbol === "createSession",
    );
    expect(refsRetrieved).toBeDefined();
    expect(
      (refsRetrieved?.fields as { totalRefs?: number })?.totalRefs,
    ).toBeGreaterThanOrEqual(1);
  });
});

describe("symbol-graph type references (integration)", () => {
  let repoRoot: string;
  let baseSha: string;
  let headSha: string;

  beforeAll(async () => {
    repoRoot = await mkdtemp(join(tmpdir(), "sg-type-"));
    await git(repoRoot, "init", "-q", "--initial-branch=main");
    await git(repoRoot, "config", "user.email", "test@example.com");
    await git(repoRoot, "config", "user.name", "test");
    await git(repoRoot, "config", "commit.gpgsign", "false");

    await writeFile(
      join(repoRoot, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
        },
      }),
    );
    await writeFile(
      join(repoRoot, "package.json"),
      JSON.stringify({ name: "fixture", type: "module" }),
    );
    await mkdir(join(repoRoot, "src"), { recursive: true });

    // BASE: User interface + a consumer that takes it as a parameter type.
    // handler depends on User's *shape*, never calls it — value refs miss it.
    await writeFile(
      join(repoRoot, "src/user.ts"),
      "export interface User { id: string; name: string }\n",
    );
    await writeFile(
      join(repoRoot, "src/handler.ts"),
      [
        "import type { User } from './user.js';",
        "export function greet(u: User): string {",
        "  return u.name;",
        "}",
        "",
      ].join("\n"),
    );
    // non-dependent: mentions User in prose only
    await writeFile(
      join(repoRoot, "src/unrelated.ts"),
      [
        "// nothing here references the User type",
        "export function noop(): void {}",
        "",
      ].join("\n"),
    );
    await git(repoRoot, "add", ".");
    await git(repoRoot, "commit", "-q", "-m", "base");
    baseSha = await git(repoRoot, "rev-parse", "HEAD");

    // HEAD: User gains a field → canonicalSignature flips → triggers.
    await writeFile(
      join(repoRoot, "src/user.ts"),
      "export interface User { id: string; name: string; email: string }\n",
    );
    await git(repoRoot, "add", ".");
    await git(repoRoot, "commit", "-q", "-m", "head");
    headSha = await git(repoRoot, "rev-parse", "HEAD");
  });

  afterAll(async () => {
    if (repoRoot) await rm(repoRoot, { recursive: true, force: true });
  });

  it("surfaces declared-type dependents when an interface shape changes", async () => {
    const diff: UnifiedDiff = {
      files: [
        {
          path: "src/user.ts",
          patch: "diff --git unused\n",
          hunks: [{ startLine: 1, endLine: 1, content: "" }],
        },
      ],
    };

    const eventBus = new TestEventBus();
    const result = await resolveContext({
      config: {
        repository: { root: repoRoot, provider: "filesystem" },
        embeddings: { provider: "ollama", model: "x" },
        context: { maxChunks: 5 },
      } as unknown as ResolveContextParams["config"],
      repositoryIdentity: { provider: "filesystem", id: repoRoot },
      revision: headSha,
      baseRevision: baseSha,
      diff,
      eventBus,
      repository: {} as unknown as ResolveContextParams["repository"],
      metadataRepository:
        {} as unknown as ResolveContextParams["metadataRepository"],
      providers: [
        new NullRagProvider(),
        new SymbolGraphContextProvider({ repoRoot, baseSha }),
      ],
    });

    const chunks = result.contextByFile.get("src/user.ts") ?? [];
    const typeChunks = chunks.filter((c) => c.provider === "type-references");

    // 1. The param-type dependent surfaced.
    expect(typeChunks.length).toBeGreaterThan(0);
    const paths = new Set(typeChunks.map((c) => c.metadata?.path));
    expect(paths.has("src/handler.ts")).toBe(true);

    // 2. Non-dependent and self are excluded.
    expect(paths.has("src/unrelated.ts")).toBe(false);
    expect(paths.has("src/user.ts")).toBe(false);

    // 3. Classified as a parameter-type ref, grounded on the real signature.
    const handlerChunk = typeChunks.find(
      (c) => c.metadata?.path === "src/handler.ts",
    );
    expect(handlerChunk?.metadata?.typeRefKind).toBe("param");
    expect(handlerChunk?.content).toContain("u: User");

    // 4. Debug event fired for User with a param count.
    const evt = eventBus.events.find(
      (e) =>
        e.event === "workflow.review.symbol_graph.type_references.retrieved" &&
        (e.fields as { symbol?: string })?.symbol === "User",
    );
    expect(evt).toBeDefined();
    expect((evt?.fields as { paramCount?: number })?.paramCount).toBe(1);
  });
});
