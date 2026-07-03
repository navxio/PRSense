// packages/context/src/symbolGraph/refs/__tests__/findReferences.heritage.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { Project } from "ts-morph";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findReferences } from "../findReferences.js";

// Heritage needs a real base/head split: the interface changes shape
// between base and head, and an implementer in head still carries the
// old member. compare-first only fires when base !== head per member.
describe("findReferences — heritage (integration)", () => {
  let headRoot: string;
  let baseRoot: string;
  let head: Project;
  let base: Project;

  const tsconfig = JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
    },
  });

  const find = () =>
    findReferences({
      head,
      base,
      declarationFile: "src/port.ts",
      symbolName: "Port",
      isDefaultExport: false,
      workspaceRoot: headRoot,
    });

  beforeAll(async () => {
    headRoot = await mkdtemp(join(tmpdir(), "heritage-head-"));
    baseRoot = await mkdtemp(join(tmpdir(), "heritage-base-"));
    await mkdir(join(headRoot, "src"), { recursive: true });
    await mkdir(join(baseRoot, "src"), { recursive: true });
    await writeFile(join(headRoot, "tsconfig.json"), tsconfig);
    await writeFile(join(baseRoot, "tsconfig.json"), tsconfig);

    // BASE: Port.load(a: string), single member.
    await writeFile(
      join(baseRoot, "src/port.ts"),
      "export interface Port { load(a: string): void; }\n",
    );

    // HEAD: Port.load shape drifted (string→number) AND a new member added.
    await writeFile(
      join(headRoot, "src/port.ts"),
      "export interface Port { load(a: number): void; save(): void; }\n",
    );

    // HEAD implementer: still old load shape (drift), missing save (missing).
    await writeFile(
      join(headRoot, "src/adapter.ts"),
      [
        "import type { Port } from './port.js';",
        "export class Adapter implements Port {",
        "  load(a: string): void { console.log(a); }",
        "}",
      ].join("\n") + "\n",
    );

    // HEAD clean implementer of an UNCHANGED interface — must not fire.
    await writeFile(
      join(headRoot, "src/other.ts"),
      "export interface Other { ping(): void; }\n",
    );
    await writeFile(
      join(headRoot, "src/otherAdapter.ts"),
      [
        "import type { Other } from './other.js';",
        "export class OtherAdapter implements Other {",
        "  ping(): void {}",
        "}",
      ].join("\n") + "\n",
    );

    head = new Project({ tsConfigFilePath: join(headRoot, "tsconfig.json") });
    base = new Project({ tsConfigFilePath: join(baseRoot, "tsconfig.json") });
  });

  afterAll(async () => {
    if (headRoot) await rm(headRoot, { recursive: true, force: true });
    if (baseRoot) await rm(baseRoot, { recursive: true, force: true });
  });

  it("surfaces the implementer as a heritage hit", () => {
    const hit = find().find((h) => h.filePath === "src/adapter.ts");
    expect(hit).toBeDefined();
    expect(hit?.refKind).toBe("heritage");
  });

  it("reports drift on the stale member", () => {
    const hit = find().find((h) => h.filePath === "src/adapter.ts");
    expect(hit?.breaks).toContainEqual({ kind: "drift", member: "load" });
  });

  it("reports the missing newly-added member", () => {
    const hit = find().find((h) => h.filePath === "src/adapter.ts");
    expect(hit?.breaks).toContainEqual({ kind: "missing", member: "save" });
  });

  it("drops implementers of unchanged interfaces (compare-first)", () => {
    // Querying Other (unchanged base==head) yields no heritage hit.
    const hits = findReferences({
      head,
      base,
      declarationFile: "src/other.ts",
      symbolName: "Other",
      isDefaultExport: false,
      workspaceRoot: headRoot,
    });
    expect(hits.some((h) => h.filePath === "src/otherAdapter.ts")).toBe(false);
  });
});
