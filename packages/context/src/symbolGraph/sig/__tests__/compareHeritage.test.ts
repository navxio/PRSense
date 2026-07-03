// packages/context/src/symbolGraph/sig/__tests__/compareHeritage.test.ts
import { describe, it, expect } from "@jest/globals";
import { Project, type Symbol } from "ts-morph";
import { compareHeritage } from "../compareHeritage.js";

function sym(project: Project, name: string): Symbol {
  const s = project
    .getSourceFiles()
    .flatMap((sf) => sf.getExportSymbols())
    .find((s) => s.getName() === name);
  if (!s) throw new Error(`symbol ${name} not found`);
  return s;
}

function build(iface: string, impl: string): Project {
  const p = new Project({ useInMemoryFileSystem: true });
  p.createSourceFile("x.ts", iface);
  p.createSourceFile("c.ts", `import type { X } from "./x.js";\n${impl}`);
  return p;
}

describe("compareHeritage", () => {
  it("drift: implementer member shape went stale", () => {
    const base = build("export interface X { foo(a: string): void; }", "");
    const head = build(
      "export interface X { foo(a: number): void; }",
      "export class C implements X { foo(a: string): void {} }",
    );
    const breaks = compareHeritage({
      base: sym(base, "X"),
      head: sym(head, "X"),
      implementer: sym(head, "C"),
    });
    expect(breaks).toEqual([{ kind: "drift", member: "foo" }]);
  });

  it("missing: interface gained a member the implementer lacks", () => {
    const base = build("export interface X { foo(): void; }", "");
    const head = build(
      "export interface X { foo(): void; bar(): void; }",
      "export class C implements X { foo(): void {} }",
    );
    const breaks = compareHeritage({
      base: sym(base, "X"),
      head: sym(head, "X"),
      implementer: sym(head, "C"),
    });
    expect(breaks).toEqual([{ kind: "missing", member: "bar" }]);
  });

  it("clean: unchanged member does not fire", () => {
    const base = build("export interface X { foo(): void; }", "");
    const head = build(
      "export interface X { foo(): void; }",
      "export class C implements X { foo(): void {} }",
    );
    const breaks = compareHeritage({
      base: sym(base, "X"),
      head: sym(head, "X"),
      implementer: sym(head, "C"),
    });
    expect(breaks).toEqual([]);
  });
});
