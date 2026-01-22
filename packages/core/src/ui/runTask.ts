// packages/engine/src/ui/runTask.ts

import { TaskRunner, Task } from "@prsense/core";

export async function runTask<T>(
  runner: TaskRunner,
  task: Task,
  fn: (handle: { update(label: string): void }) => Promise<T>,
): Promise<T> {
  const handle = runner.start(task);

  try {
    const result = await fn({
      update: handle.update.bind(handle),
    });
    handle.succeed();
    return result;
  } catch (err) {
    handle.fail();
    throw err;
  }
}
