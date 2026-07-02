// packages/context/src/symbolGraph/refs/__tests__/findReferences.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { Project } from "ts-morph";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findReferences } from "../findReferences.js";

// Real on-disk TS project so ts-morph resolves cross-file references,
// including re-export/alias chains. Mirrors the symbol-graph fixture style.
describe("findReferences (integration)", () => {
  let root: string;
  let project: Project;

  const find = (symbolName: string, declarationFile = "src/session.ts") =>
    findReferences({
      head: project,
      declarationFile,
      symbolName,
      isDefaultExport: false,
      workspaceRoot: root,
    });

  const paths = (hits: ReturnType<typeof find>) =>
    hits.map((h) => `${h.filePath}:${h.lineStart}`).sort();

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "findrefs-"));
    await mkdir(join(root, "src"), { recursive: true });
    await mkdir(join(root, "src/__tests__"), { recursive: true });
    await mkdir(join(root, "dist"), { recursive: true });

    await writeFile(
      join(root, "tsconfig.json"),
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

    const files: Record<string, string> = {
      "src/session.ts": [
        "export function createSession(userId: string) { return { userId }; }",
        "export function destroySession(id: string): void { console.log(id); }",
      ].join("\n"),

      // direct caller
      "src/login.ts": [
        "import { createSession } from './session.js';",
        "export function login(u: string) {",
        "  const s = createSession(u);",
        "  return s;",
        "}",
      ].join("\n"),

      // mentions session in prose, never calls createSession
      "src/billing.ts": [
        "// charges for a session, but does not call createSession",
        "export function charge(n: number): number { return n * 2; }",
      ].join("\n"),

      // two calls on the SAME line → one hit; two calls on distinct lines → two
      "src/multi.ts": [
        "import { createSession } from './session.js';",
        "export function a() { return createSession('a'); }",
        "export function b() { const x = createSession('b'); const y = createSession('c'); return [x, y]; }",
      ].join("\n"),

      // foo(foo()) on one statement → single hit
      "src/onestmt.ts": [
        "import { createSession } from './session.js';",
        "export function n() { return createSession(createSession('i').userId); }",
      ].join("\n"),

      // call nested inside a callback still resolves
      "src/nested.ts": [
        "import { createSession } from './session.js';",
        "export function outer() { return [1].map(() => createSession('n')); }",
      ].join("\n"),

      // re-export under an alias, then a call through that alias
      "src/reexport.ts":
        "export { createSession as makeSession } from './session.js';",
      "src/viaAlias.ts": [
        "import { makeSession } from './reexport.js';",
        "export function boot() { return makeSession('x'); }",
      ].join("\n"),

      // local function of the same name — must NOT be attributed
      "src/shadow.ts": [
        "function createSession(x: number) { return x; }",
        "export function useLocal() { return createSession(5); }",
      ].join("\n"),

      // type-only import is not a call site
      "src/typeonly.ts": [
        "import type { createSession } from './session.js';",
        "export type T = typeof createSession;",
      ].join("\n"),

      // test file — surfaced but flagged isTest
      "src/__tests__/session.test.ts": [
        "import { createSession } from '../session.js';",
        "test('x', () => { createSession('t'); });",
      ].join("\n"),

      // generated output — must be ignored
      "dist/leak.js": [
        "import { createSession } from '../src/session.js';",
        "createSession('gen');",
      ].join("\n"),
    };

    for (const [rel, content] of Object.entries(files)) {
      await writeFile(join(root, rel), content + "\n");
    }

    project = new Project({
      tsConfigFilePath: join(root, "tsconfig.json"),
    });
  });

  afterAll(async () => {
    if (root) await rm(root, { recursive: true, force: true });
  });

  it("surfaces direct callers and excludes non-callers", () => {
    const p = paths(find("createSession"));
    expect(p).toContain("src/login.ts:3");
    expect(p.some((x) => x.startsWith("src/billing.ts"))).toBe(false);
  });

  it("excludes the declaration file itself", () => {
    const p = paths(find("createSession"));
    expect(p.some((x) => x.startsWith("src/session.ts"))).toBe(false);
  });

  it("dedupes multiple references on one statement into a single hit", () => {
    const p = paths(find("createSession"));
    expect(p.filter((x) => x === "src/onestmt.ts:2")).toHaveLength(1);
  });

  it("keeps distinct call sites on different lines", () => {
    const p = paths(find("createSession"));
    expect(p).toContain("src/multi.ts:2");
    expect(p).toContain("src/multi.ts:3");
  });

  it("collapses two same-line calls to one hit", () => {
    const hits = find("createSession").filter(
      (h) => h.filePath === "src/multi.ts" && h.lineStart === 3,
    );
    expect(hits).toHaveLength(1);
  });

  it("resolves calls through a re-export alias chain", () => {
    const p = paths(find("createSession"));
    expect(p).toContain("src/viaAlias.ts:2");
  });

  it("resolves calls nested inside a callback", () => {
    const p = paths(find("createSession"));
    expect(p).toContain("src/nested.ts:2");
  });

  it("does not attribute a same-named local function", () => {
    const p = paths(find("createSession"));
    expect(p.some((x) => x.startsWith("src/shadow.ts"))).toBe(false);
  });

  it("ignores type-only references (not call sites)", () => {
    const p = paths(find("createSession"));
    expect(p.some((x) => x.startsWith("src/typeonly.ts"))).toBe(false);
  });

  it("ignores generated output paths", () => {
    const p = paths(find("createSession"));
    expect(p.some((x) => x.startsWith("dist/"))).toBe(false);
  });

  it("flags test files via isTest without dropping them", () => {
    const testHit = find("createSession").find((h) =>
      h.filePath.includes("__tests__"),
    );
    expect(testHit).toBeDefined();
    expect(testHit?.isTest).toBe(true);
  });

  it("returns nothing for a symbol with no call sites", () => {
    // destroySession is exported but never called anywhere.
    expect(find("destroySession")).toHaveLength(0);
  });

  it("returns nothing for an unknown symbol", () => {
    expect(find("noSuchSymbol")).toHaveLength(0);
  });
});
