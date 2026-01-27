// packages/core/src/eventBus.ts

export type DomainEvent<T extends string = string> = {
  event: T;
  fields?: Record<string, unknown>;
};

export type EventSink = (event: DomainEvent) => void;

export type EmitEvent = <T extends string>(
  event: T,
  fields?: Record<string, unknown>,
) => void;

export type EventBus = {
  emit: EmitEvent;
};

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
