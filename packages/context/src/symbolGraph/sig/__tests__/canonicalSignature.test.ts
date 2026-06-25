// packages/context/src/symbolGraph/sig/__tests__/canonicalSignature.test.ts
import { describe, it, expect } from "@jest/globals";
import { Project } from "ts-morph";
import { canonicalSignature } from "../canonicalSignature.js";

function sig(source: string, name: string): string {
  const project = new Project({ useInMemoryFileSystem: true });
  const sf = project.createSourceFile("test.ts", source);
  const symbol = sf.getExportSymbols().find((s) => s.getName() === name);
  if (!symbol) throw new Error(`symbol ${name} not found`);
  return canonicalSignature(symbol);
}

const eq = (a: string, b: string, name = "foo") =>
  sig(a, name) === sig(b, name);

describe("canonicalSignature", () => {
  describe("parameter names excluded", () => {
    it("treats parameter renames as equal", () => {
      expect(
        eq(
          "export function foo(x: string): boolean { return true; }",
          "export function foo(y: string): boolean { return true; }",
        ),
      ).toBe(true);
    });

    it("treats multi-parameter renames as equal", () => {
      expect(
        eq(
          "export function foo(user: string, ttl: number): void {}",
          "export function foo(u: string, t: number): void {}",
        ),
      ).toBe(true);
    });
  });

  describe("structural changes trigger", () => {
    it("differs on added parameter", () => {
      expect(
        eq(
          "export function foo(x: string): void {}",
          "export function foo(x: string, y: number): void {}",
        ),
      ).toBe(false);
    });

    it("differs on parameter type change", () => {
      expect(
        eq(
          "export function foo(x: string): void {}",
          "export function foo(x: number): void {}",
        ),
      ).toBe(false);
    });

    it("differs on return type change", () => {
      expect(
        eq(
          "export function foo(): string { return ''; }",
          "export function foo(): number { return 0; }",
        ),
      ).toBe(false);
    });

    it("differs when optional flag added", () => {
      expect(
        eq(
          "export function foo(x: string): void {}",
          "export function foo(x?: string): void {}",
        ),
      ).toBe(false);
    });

    it("differs when rest flag added", () => {
      expect(
        eq(
          "export function foo(args: string[]): void {}",
          "export function foo(...args: string[]): void {}",
        ),
      ).toBe(false);
    });
  });

  describe("type parameters", () => {
    it("differs when type parameter added", () => {
      expect(
        eq(
          "export function foo(x: string): void {}",
          "export function foo<T>(x: T): void {}",
        ),
      ).toBe(false);
    });

    it("differs when constraint added", () => {
      expect(
        eq(
          "export function foo<T>(x: T): T { return x; }",
          "export function foo<T extends string>(x: T): T { return x; }",
        ),
      ).toBe(false);
    });
  });

  describe("classes", () => {
    it("differs when constructor parameter added", () => {
      expect(
        eq(
          "export class C { constructor(x: string) {} }",
          "export class C { constructor(x: string, y: number) {} }",
          "C",
        ),
      ).toBe(false);
    });
  });

  describe("interfaces", () => {
    it("differs when property type changes", () => {
      expect(
        eq(
          "export interface I { x: string; }",
          "export interface I { x: number; }",
          "I",
        ),
      ).toBe(false);
    });

    it("differs when property added", () => {
      expect(
        eq(
          "export interface I { x: string; }",
          "export interface I { x: string; y: number; }",
          "I",
        ),
      ).toBe(false);
    });
  });

  describe("body-only changes do not trigger", () => {
    it("function body change keeps signature equal", () => {
      expect(
        eq(
          "export function foo(x: string): boolean { return x.length > 0; }",
          "export function foo(x: string): boolean { return false; }",
        ),
      ).toBe(true);
    });
  });
});
