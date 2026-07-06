// packages/context/src/symbolGraph/refs/__tests__/findTypeReferences.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { Project } from "ts-morph";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findTypeReferences } from "../findTypeReferences.js";

describe("findTypeReferences (integration)", () => {
  let root: string;
  let project: Project;

  const find = () =>
    findTypeReferences({
      head: project,
      declarationFile: "src/user.ts",
      symbolName: "User",
      workspaceRoot: root,
    });

  const key = (h: { filePath: string; lineStart: number; kind: string }) =>
    `${h.filePath}:${h.lineStart}:${h.kind}`;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "findtyperefs-"));
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
          skipLibCheck: true,
        },
      }),
    );

    const files: Record<string, string> = {
      "src/user.ts": "export interface User { id: string; name: string }",

      // param, return, field — the three scoped kinds
      "src/svc.ts": [
        "import type { User } from './user.js';",
        "export function greet(u: User): void { void u; }", // param @2
        "export function load(): User { return { id: '', name: '' }; }", // return @3
        "export class Session { user: User; constructor() { this.user = load(); } }", // field @4
      ].join("\n"),

      // generic nesting → still classified by outer owner
      "src/coll.ts": [
        "import type { User } from './user.js';",
        "export function many(us: User[]): void { void us; }", // param @2
        "export async function fetchOne(): Promise<User> { return { id: '', name: '' }; }", // return @3
        ,
      ].join("\n"),

      // value-position use: never a type ref, must be dropped
      "src/value.ts": [
        "import type { User } from './user.js';",
        "export const cast = (x: unknown) => x as User;", // as-cast, not param/return/field
      ].join("\n"),

      // test file — surfaced, flagged isTest
      "src/__tests__/user.test.ts": [
        "import type { User } from '../user.js';",
        "export function mk(u: User): void { void u; }", // param @2
      ].join("\n"),

      // generated — ignored
      "dist/leak.ts": [
        "import type { User } from '../src/user.js';",
        "export function g(u: User): void { void u; }",
      ].join("\n"),

      "src/ns.ts": [
        "import * as api from './user.js';",
        "export function nsParam(u: api.User): void { void u; }", // @2
      ].join("\n"),
    };

    for (const [rel, content] of Object.entries(files)) {
      await writeFile(join(root, rel), content + "\n");
    }

    project = new Project({ tsConfigFilePath: join(root, "tsconfig.json") });
  });

  afterAll(async () => {
    if (root) await rm(root, { recursive: true, force: true });
  });

  it("classifies param, return, and field positions", () => {
    const k = find().map(key);
    expect(k).toContain("src/svc.ts:2:param");
    expect(k).toContain("src/svc.ts:3:return");
    expect(k).toContain("src/svc.ts:4:field");
  });

  it("classifies through generic nesting by outer owner", () => {
    const k = find().map(key);
    expect(k).toContain("src/coll.ts:2:param"); // User[]
    expect(k).toContain("src/coll.ts:3:return"); // Promise<User>
  });

  it("excludes the declaration file itself", () => {
    expect(find().some((h) => h.filePath === "src/user.ts")).toBe(false);
  });

  it("ignores generated output", () => {
    expect(find().some((h) => h.filePath.startsWith("dist/"))).toBe(false);
  });

  it("drops value-position uses (as-cast)", () => {
    expect(find().some((h) => h.filePath === "src/value.ts")).toBe(false);
  });

  it("surfaces test files, flagged isTest", () => {
    const t = find().find((h) => h.filePath.includes("__tests__"));
    expect(t).toBeDefined();
    expect(t?.isTest).toBe(true);
  });

  it("classifies namespace-qualified type refs (api.User)", () => {
    expect(find().map(key)).toContain("src/ns.ts:2:param");
  });
});
