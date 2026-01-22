// packages/reporters/src/cli/ui/SilentTaskRunner.ts

import { TaskRunner, Task, TaskHandle } from "@prsense/core";

export class SilentTaskRunner implements TaskRunner {
  start(_task: Task): TaskHandle {
    return {
      update() {},
      succeed() {},
      fail() {},
    };
  }
}
