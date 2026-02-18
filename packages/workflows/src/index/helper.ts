export function detectKind(file: string): "code" | "test" | "doc" | "config" {
  if (file.includes(".test.") || file.includes("__tests__")) {
    return "test";
  }

  if (file.endsWith(".md")) {
    return "doc";
  }

  if (
    file.endsWith(".json") ||
    file.endsWith(".yaml") ||
    file.endsWith(".yml")
  ) {
    return "config";
  }

  return "code";
}
