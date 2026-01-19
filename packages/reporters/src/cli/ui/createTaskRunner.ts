// packages/reporters/src/cli/ui/createTaskRunner.ts
// detect whether it's running on tty or not
import { TaskRunner } from "@prsense/domain";
import { OraTaskRunner } from "./OraTaskRunner.js";
import { SilentTaskRunner } from "./SilentTaskRunner.js";

export function createTaskRunner(): TaskRunner {
  if (!process.stdout.isTTY) {
    return new SilentTaskRunner();
  }

  return new OraTaskRunner();
}
