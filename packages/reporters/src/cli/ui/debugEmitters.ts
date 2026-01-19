import { TaskDebugEvent } from "@prsense/domain";

export function stderrJsonEmitter(event: TaskDebugEvent) {
  process.stderr.write(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      ...event,
    }) + "\n",
  );
}

function formatTime(date = new Date()): string {
  return date.toISOString().split("T")[1].replace("Z", "");
}

export function stderrHumanEmitter(event: TaskDebugEvent) {
  const time = formatTime();

  switch (event.type) {
    case "task:start":
      process.stderr.write(`[${time}] ▶ ${event.task.label}\n`);
      break;

    case "task:update":
      process.stderr.write(`[${time}] … ${event.label}\n`);
      break;

    case "task:succeed":
      process.stderr.write(`[${time}] ✔ ${event.taskId}\n`);
      break;

    case "task:fail":
      process.stderr.write(
        `[${time}] ✖ ${event.taskId}${
          event.error ? ` — ${event.error}` : ""
        }\n`,
      );
      break;
  }
}
