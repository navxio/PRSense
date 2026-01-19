// packages/reporters/src/cli/ui/createTaskRunner.ts
// detect whether it's running on tty or not
import { TaskRunner } from "@prsense/domain";
import { OraTaskRunner } from "./OraTaskRunner.js";
import { SilentTaskRunner } from "./SilentTaskRunner.js";
import { DebugTaskRunner } from "./DebugTaskRunner.js";
import { stderrHumanEmitter } from "./debugEmitters.js";

export function createTaskRunner(): TaskRunner {
  const baseRunner = process.stdout.isTTY
    ? new OraTaskRunner()
    : new SilentTaskRunner();

  if (process.env.PRSENSE_DEBUG === "1") {
    return new DebugTaskRunner(baseRunner, stderrHumanEmitter);
  }

  return baseRunner;
}
