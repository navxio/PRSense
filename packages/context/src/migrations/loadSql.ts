import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function loadMigrationSql(filename: string): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const sqlPath = path.join(__dirname, filename);

  return fs.readFileSync(sqlPath, "utf8");
}
