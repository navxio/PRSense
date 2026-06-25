// packages/context/src/symbolGraph/ast/__tests__/findExportedDeclarations.test.ts
import { describe, it, expect } from "@jest/globals";
import { findExportedDeclarations } from "../findExportedDeclarations.js";

function find(content: string, path = "test.ts") {
  return findExportedDeclarations(path, content);
}

describe("findExportedDeclarations", () => {
  describe("declaration kinds", () => {
    it("captures an exported function", () => {
      const result = find("export function foo() {}");
      expect(result).toEqual([
        { name: "foo", kind: "function", startLine: 1, endLine: 1 },
      ]);
    });

    it("captures an exported class", () => {
      const result = find("export class Foo {}");
      expect(result).toEqual([
        { name: "Foo", kind: "class", startLine: 1, endLine: 1 },
      ]);
    });

    it("captures an exported interface", () => {
      const result = find("export interface Foo { x: number; }");
      expect(result).toEqual([
        { name: "Foo", kind: "interface", startLine: 1, endLine: 1 },
      ]);
    });

    it("captures an exported type alias", () => {
      const result = find("export type Foo = string;");
      expect(result).toEqual([
        { name: "Foo", kind: "typeAlias", startLine: 1, endLine: 1 },
      ]);
    });

    it("captures a single const export", () => {
      const result = find("export const foo = 1;");
      expect(result).toEqual([
        { name: "foo", kind: "constExport", startLine: 1, endLine: 1 },
      ]);
    });

    it("captures multiple bindings in a single const statement", () => {
      const result = find("export const a = 1, b = 2;");
      expect(result).toEqual([
        { name: "a", kind: "constExport", startLine: 1, endLine: 1 },
        { name: "b", kind: "constExport", startLine: 1, endLine: 1 },
      ]);
    });

    it("captures default function export with its declared name", () => {
      const result = find("export default function foo() {}");
      expect(result).toEqual([
        { name: "foo", kind: "defaultExport", startLine: 1, endLine: 1 },
      ]);
    });

    it("captures default class export with its declared name", () => {
      const result = find("export default class Foo {}");
      expect(result).toEqual([
        { name: "Foo", kind: "defaultExport", startLine: 1, endLine: 1 },
      ]);
    });

    it("captures default export of a named identifier", () => {
      const result = find("const foo = 1;\nexport default foo;");
      expect(result).toEqual([
        { name: "foo", kind: "defaultExport", startLine: 2, endLine: 2 },
      ]);
    });

    it("falls back to name 'default' for anonymous default expressions", () => {
      const result = find("export default 42;");
      expect(result).toEqual([
        { name: "default", kind: "defaultExport", startLine: 1, endLine: 1 },
      ]);
    });
  });

  describe("non-exported declarations", () => {
    it("ignores a function without the export modifier", () => {
      expect(find("function foo() {}")).toEqual([]);
    });

    it("ignores a const without the export modifier", () => {
      expect(find("const foo = 1;")).toEqual([]);
    });
  });

  describe("deliberately skipped patterns", () => {
    it("skips named re-exports", () => {
      expect(find('export { foo } from "./bar";')).toEqual([]);
    });

    it("skips star re-exports", () => {
      expect(find('export * from "./bar";')).toEqual([]);
    });

    it("skips enums", () => {
      expect(find("export enum Color { Red, Green }")).toEqual([]);
    });

    it("skips namespaces", () => {
      expect(find("export namespace Foo { export const x = 1; }")).toEqual([]);
    });

    it("skips CommonJS-style export equals", () => {
      expect(find("export = { foo: 1 };")).toEqual([]);
    });

    it("skips destructuring patterns in const exports", () => {
      // `a` is exported, but via a destructuring pattern; v1 doesn't
      // attempt to walk the pattern.
      expect(find("export const { a } = { a: 1 };")).toEqual([]);
    });
  });

  describe("line ranges", () => {
    it("spans the full body of a multi-line function", () => {
      const content = [
        "export function foo() {",
        "  const x = 1;",
        "  return x;",
        "}",
      ].join("\n");
      expect(find(content)).toEqual([
        { name: "foo", kind: "function", startLine: 1, endLine: 4 },
      ]);
    });

    it("startLine reflects the declaration, not preceding JSDoc", () => {
      const content = [
        "/**",
        " * docs here",
        " */",
        "export function foo() {}",
      ].join("\n");
      const [decl] = find(content);
      expect(decl?.startLine).toBe(4);
    });

    it("captures multiple exports across a file with correct line ranges", () => {
      const content = [
        "export const a = 1;",
        "",
        "export function b() {",
        "  return 2;",
        "}",
        "",
        "export class C {}",
      ].join("\n");
      expect(find(content)).toEqual([
        { name: "a", kind: "constExport", startLine: 1, endLine: 1 },
        { name: "b", kind: "function", startLine: 3, endLine: 5 },
        { name: "C", kind: "class", startLine: 7, endLine: 7 },
      ]);
    });
  });

  describe("file kinds", () => {
    it("parses TSX without error and captures exports", () => {
      const content = [
        "export function Button() {",
        "  return <button />;",
        "}",
      ].join("\n");
      const result = find(content, "Button.tsx");
      expect(result).toEqual([
        { name: "Button", kind: "function", startLine: 1, endLine: 3 },
      ]);
    });
  });
});
