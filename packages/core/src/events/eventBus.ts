import { EmitEvent, EventSink, EventBus } from "./types.js";
export const noopEmit: EmitEvent = () => {};
/**
 * Minimal event emitter used by the core.
 * Defaults to no-op.
 */
export function createEventBus(sink?: EventSink): EventBus {
  return {
    emit(event, fields) {
      if (!sink) return;

      if (fields === undefined) {
        sink({ event });
      } else {
        sink({ event, fields });
      }
    },
  };
}
