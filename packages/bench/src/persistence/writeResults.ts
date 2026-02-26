import fs from "node:fs/promises";
import path from "node:path";
import type { BenchReport } from "../types.js";

export async function writeResults(report: BenchReport) {
  const dir = path.resolve("bench-results");
  await fs.mkdir(dir, { recursive: true });

  const file = path.join(dir, `${report.timestamp.replace(/:/g, "-")}.json`);

  await fs.writeFile(file, JSON.stringify(report, null, 2));
  return file;
}
