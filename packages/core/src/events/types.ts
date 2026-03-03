// packages/core/src/types.ts

//TODO: convert it to a discriminated union
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
