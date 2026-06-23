// apps/cli/src/__tests__/helper.ts
import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export function git(cmd: string, cwd: string) {
  execSync(cmd, { cwd, stdio: "ignore" });
}

export async function createTestRepo() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "prsense-"));

  git("git init", dir);
  git('git config user.email "test@test.com"', dir);
  git('git config user.name "test"', dir);

  return dir;
}

export async function writeFile(repo: string, file: string, content: string) {
  const full = path.join(repo, file);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content);
}

export function commitAll(
  repo: string,
  message: string,
  options?: { allowEmpty?: boolean },
) {
  git("git add .", repo);

  const allowEmptyFlag = options?.allowEmpty ? " --allow-empty" : "";

  git(`git commit${allowEmptyFlag} -m "${message}"`, repo);
}

export class TestEventBus {
  events: any[] = [];

  emit(event: any, fields?: any) {
    this.events.push({ event, fields });
  }
}
