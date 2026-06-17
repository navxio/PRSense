// packages/config/src/__tests__/merge.test.ts
import { deepMerge } from "../merge.js";

describe("deepMerge", () => {
  it("overrides primitives", () => {
    expect(deepMerge({ a: 1 }, { a: 2 })).toEqual({ a: 2 });
  });

  it("merges nested objects", () => {
    expect(deepMerge({ a: { b: 1, c: 2 } }, { a: { b: 9 } })).toEqual({
      a: { b: 9, c: 2 },
    });
  });

  it("replaces arrays wholesale (does not concat)", () => {
    expect(deepMerge({ a: [1, 2] }, { a: [3] })).toEqual({ a: [3] });
  });

  it("treats null override as a value, not a merge target", () => {
    expect(deepMerge({ a: { b: 1 } }, { a: null })).toEqual({ a: null });
  });

  it("does not mutate inputs", () => {
    const base = { a: { b: 1 } };
    const over = { a: { b: 2 } };
    deepMerge(base, over);
    expect(base).toEqual({ a: { b: 1 } });
    expect(over).toEqual({ a: { b: 2 } });
  });
});
