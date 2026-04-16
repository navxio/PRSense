import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function getDirname() {
  if (typeof __filename !== "undefined") {
    return path.dirname(__filename);
  } else {
    const metaUrl = (new Function("return import.meta.url"))();
    const filename = fileURLToPath(metaUrl);
    return path.dirname(filename);
  }
}

export function loadMigrationSql(filename: string): string {
  const dirname = getDirname();
  const sqlPath = path.join(dirname, filename);
  return fs.readFileSync(sqlPath, "utf8");
}