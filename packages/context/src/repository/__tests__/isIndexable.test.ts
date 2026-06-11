// packages/context/src/repository/__tests__/isIndexable.test.ts
import { isIndexable } from "../isIndexable.js";

describe("isIndexable", () => {
  describe("keeps ordinary code and config", () => {
    test.each([
      "src/index.ts",
      "packages/core/src/engine.ts",
      "README.md",
      "packages/core/README.md",
      "docs/architecture.md",
      "Dockerfile",
      "tsconfig.json",
      "package.json",
      "prsense.yml",
    ])("%s", (p) => expect(isIndexable(p)).toBe(true));
  });

  describe("keeps code files whose names start with deny stems", () => {
    // Regression for the prefix-too-greedy bug.
    test.each([
      "src/support.ts",
      "src/supportTicket.ts",
      "src/historyManager.ts",
      "src/newsfeed.js",
      "src/security/check.ts",
      "lib/license-parser.ts",
      "src/notices.tsx",
      "src/authorsPanel.tsx",
    ])("%s", (p) => expect(isIndexable(p)).toBe(true));
  });

  describe("denies by path segment", () => {
    test.each([
      "node_modules/lodash/index.js",
      "dist/index.js",
      "packages/core/dist/index.js",
      "coverage/lcov.info",
      "target/release/foo",
      "vendor/github.com/x/y.go",
      ".github/workflows/ci.yml",
      ".gitlab/issue_templates/bug.md",
      ".husky/pre-commit",
      ".vscode/settings.json",
      ".next/cache/index",
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

  describe("denies meta documents (doc extension + matching stem)", () => {
    test.each([
      "LICENSE",
      "LICENSE.md",
      "LICENSE.txt",
      "LICENSE-MIT",
      "LICENSE-MIT.txt",
      "license.rst",
      "Licence",
      "COPYING",
      "NOTICE",
      "CONTRIBUTING.md",
      "CONTRIBUTING.rst",
      "CODE_OF_CONDUCT.md",
      "SECURITY.md",
      "CHANGELOG.md",
      "CHANGELOG-2024.md",
      "AUTHORS",
      "MAINTAINERS.md",
      "SUPPORT.md",
      "HISTORY.md",
      "NEWS",
    ])("%s", (p) => expect(isIndexable(p)).toBe(false));
  });

  describe("keeps meta-named files with non-doc extensions", () => {
    // A LICENSE.json fixture or similar shouldn't be confused with the meta doc.
    test.each([
      "fixtures/license.json",
      "src/license.ts",
      "scripts/changelog.ts",
    ])("%s", (p) => expect(isIndexable(p)).toBe(true));
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
