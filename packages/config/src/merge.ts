// packages/config/src/merge.ts
export function deepMerge(base: any, override: any) {
  const result = { ...base };

  for (const key in override) {
    const value = override[key];

    if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = deepMerge(base[key] ?? {}, value);
    } else {
      result[key] = value;
    }
  }

  return result;
}
