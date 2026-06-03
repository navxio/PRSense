// packages/context/src/index/detectKind.ts
export type FileKind = "code" | "test" | "doc" | "config";

export function detectKind(filePath: string): FileKind {
  const lower = filePath.toLowerCase();

  // Docs
  if (
    lower.endsWith(".md") ||
    lower.endsWith(".rst") ||
    lower.includes("readme") ||
    lower.includes("changelog") ||
    lower.includes("contributing")
  ) {
    return "doc";
  }

  // Tests
  if (
    lower.includes("/test") ||
    lower.includes("__tests__") ||
    lower.endsWith(".spec.ts") ||
    lower.endsWith(".spec.js") ||
    lower.endsWith(".test.ts") ||
    lower.endsWith(".test.js")
  ) {
    return "test";
  }

  // Config
  if (
    lower.endsWith(".json") ||
    lower.endsWith(".yml") ||
    lower.endsWith(".yaml") ||
    lower.endsWith(".toml") ||
    lower.endsWith(".ini") ||
    lower.endsWith(".env")
  ) {
    return "config";
  }

  return "code";
}
