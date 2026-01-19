// packages/reporters/src/cli/ui/SilentTaskRunner.ts

import { TaskRunner, Task, TaskHandle } from "@prsense/domain";

export class SilentTaskRunner implements TaskRunner {
  start(_task: Task): TaskHandle {
    return {
      update() {},
      succeed() {},
      fail() {},
    };
  }
}
