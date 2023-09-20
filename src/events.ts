import { AbstractEvent } from '@matrixai/events';

abstract class EventAsyncInit extends AbstractEvent {}

class EventAsyncInitStart extends EventAsyncInit {}

class EventAsyncInitStarted extends EventAsyncInit {}

class EventAsyncInitStop extends EventAsyncInit {}

class EventAsyncInitStopped extends EventAsyncInit {}

class EventAsyncInitDestroy extends EventAsyncInit {}

class EventAsyncInitDestroyed extends EventAsyncInit {}

export {
  EventAsyncInit,
  EventAsyncInitStart,
  EventAsyncInitStarted,
  EventAsyncInitStop,
  EventAsyncInitStopped,
  EventAsyncInitDestroy,
  EventAsyncInitDestroyed,
};
