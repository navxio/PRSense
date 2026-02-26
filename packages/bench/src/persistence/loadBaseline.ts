import fs from "node:fs/promises";

export async function loadBaseline(path: string) {
  const raw = await fs.readFile(path, "utf8");
  return JSON.parse(raw);
}
