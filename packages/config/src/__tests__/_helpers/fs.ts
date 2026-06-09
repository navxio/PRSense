// packages/config/src/__tests__/_helpers/fs.ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function makeTmpRepo(files: Record<string, string> = {}): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "prsense-test-"));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return dir;
}

export function rmTmp(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}
