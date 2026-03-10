import type { EventBus } from "@prsense/core";

export function silentEventBus(): EventBus {
  return {
    emit() {},
    on() {},
  } as EventBus;
}
