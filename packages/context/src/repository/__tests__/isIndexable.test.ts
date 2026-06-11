// packages/context/src/repository/__tests__/isIndexable.test.ts
import { isIndexable } from "../isIndexable.js";

describe("isIndexable", () => {
  describe("keeps", () => {
    test.each([
      "src/index.ts",
      "packages/core/src/engine.ts",
      "README.md",
      "packages/core/README.md",
      "docs/architecture.md",
      "Dockerfile",
      "tsconfig.json",
      "package.json",
    ])("%s", (p) => expect(isIndexable(p)).toBe(true));
  });

  describe("denies by segment", () => {
    test.each([
      "node_modules/lodash/index.js",
      "dist/index.js",
      "packages/core/dist/index.js",
      "coverage/lcov.info",
      "target/release/foo",
      "vendor/github.com/x/y.go",
      ".github/workflows/ci.yml",
      ".husky/pre-commit",
      ".vscode/settings.json",
    ])("%s", (p) => expect(isIndexable(p)).toBe(false));
  });

  describe("denies dotfiles", () => {
    test.each([
      ".prettierrc",
      ".prettierrc.json",
      ".editorconfig",
      ".gitattributes",
      ".nvmrc",
      ".node-version",
      ".tool-versions",
      ".rsyncignore",
      ".env.example",
    ])("%s", (p) => expect(isIndexable(p)).toBe(false));
  });

  describe("denies meta files (case-insensitive, prefix)", () => {
    test.each([
      "LICENSE",
      "LICENSE.md",
      "LICENSE-MIT",
      "license.txt",
      "Licence",
      "COPYING",
      "NOTICE",
      "CONTRIBUTING.md",
      "CODE_OF_CONDUCT.md",
      "SECURITY.md",
      "CHANGELOG.md",
      "AUTHORS",
      "MAINTAINERS.md",
    ])("%s", (p) => expect(isIndexable(p)).toBe(false));
  });

  describe("edges", () => {
    test("empty path", () => expect(isIndexable("")).toBe(false));
    test("windows separator", () =>
      expect(isIndexable("dist\\index.js")).toBe(false));
    test("README kept at any depth", () => {
      expect(isIndexable("README.md")).toBe(true);
      expect(isIndexable("packages/foo/README.md")).toBe(true);
    });
  });
});
