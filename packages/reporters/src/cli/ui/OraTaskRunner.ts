// packages/reporters/src/cli/ui/OraTaskRunner.ts

import ora, { Ora } from "ora";
import { TaskRunner, Task, TaskHandle } from "@prsense/domain";

export class OraTaskRunner implements TaskRunner {
  start(task: Task): TaskHandle {
    const spinner = ora(task.label).start();

    return new OraTaskHandle(spinner);
  }
}

class OraTaskHandle implements TaskHandle {
  constructor(private readonly spinner: Ora) {}

  update(label: string): void {
    this.spinner.text = label;
  }

  succeed(label?: string): void {
    this.spinner.succeed(label);
  }

  fail(label?: string): void {
    this.spinner.fail(label);
  }
}
