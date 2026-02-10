import { CliTask, CliTaskRenderer } from "./tasks.js";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function createSpinnerRenderer(
  output: NodeJS.WritableStream,
): CliTaskRenderer {
  let timer: NodeJS.Timeout | null = null;
  let frame = 0;
  let currentTask: CliTask | null = null;

  function render() {
    if (!currentTask) return;

    const icon =
      currentTask.state === "running"
        ? FRAMES[frame % FRAMES.length]
        : currentTask.state === "succeeded"
          ? "✔"
          : "✖";

    output.write(`\r${icon} ${currentTask.label}`);
    frame++;
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    output.write("\n");
  }

  return {
    start(task) {
      currentTask = task;
      frame = 0;

      if (!timer) {
        timer = setInterval(render, 80);
      }
    },

    update(task) {
      currentTask = task;
    },

    finish(task) {
      currentTask = task;
      render();
      stop();
      currentTask = null;
    },
  };
}
