//packages/reporters/src/cli/ui/DebugTaskRunner.ts
import { TaskRunner, Task, TaskHandle, TaskDebugEvent } from "@prsense/core";

export class DebugTaskRunner implements TaskRunner {
  constructor(
    private readonly inner: TaskRunner,
    private readonly emit: (event: TaskDebugEvent) => void,
  ) {}

  start(task: Task): TaskHandle {
    this.emit({ type: "task:start", task });

    const handle = this.inner.start(task);

    return {
      update: (label: string) => {
        this.emit({
          type: "task:update",
          taskId: task.id,
          label,
        });
        handle.update(label);
      },

      succeed: (label?: string) => {
        this.emit({
          type: "task:succeed",
          taskId: task.id,
        });
        handle.succeed(label);
      },

      fail: (label?: string) => {
        this.emit({
          type: "task:fail",
          taskId: task.id,
          error: label,
        });
        handle.fail(label);
      },
    };
  }
}
