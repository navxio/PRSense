// packages/core/src/eventBus.ts

export type DomainEvent<T extends string = string> = {
  event: T;
  fields?: Record<string, unknown>;
};

export type EventSink = (event: DomainEvent) => void;

/**
 * Minimal event emitter used by the core.
 * Defaults to no-op.
 */
export function createEventBus(sink?: EventSink) {
  return {
    emit<T extends string>(event: T, fields?: Record<string, unknown>) {
      sink?.({ event, fields });
    },
  };
}
