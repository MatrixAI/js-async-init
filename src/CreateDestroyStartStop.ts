import type { Status, Class } from './types.js';
import { Evented } from '@matrixai/events';
import { RWLockWriter } from '@matrixai/async-locks';
import {
  _running,
  running,
  _destroyed,
  destroyed,
  _status,
  status,
  initLock,
  AsyncFunction,
  GeneratorFunction,
  AsyncGeneratorFunction,
  resetStackTrace,
} from './utils.js';
import {
  EventAsyncInitStart,
  EventAsyncInitStarted,
  EventAsyncInitStop,
  EventAsyncInitStopped,
  EventAsyncInitDestroy,
  EventAsyncInitDestroyed,
} from './events.js';
import {
  ErrorAsyncInitRunning,
  ErrorAsyncInitNotRunning,
  ErrorAsyncInitDestroyed,
} from './errors.js';

interface CreateDestroyStartStop<
  StartReturn = unknown,
  StopReturn = unknown,
  DestroyReturn = unknown,
> extends Evented {
  get [running](): boolean;
  get [destroyed](): boolean;
  get [status](): Status;
  readonly [initLock]: RWLockWriter;
  start(...args: Array<any>): Promise<StartReturn | void>;
  stop(...args: Array<any>): Promise<StopReturn | void>;
  destroy(...args: Array<any>): Promise<DestroyReturn | void>;
}

function CreateDestroyStartStop<
  StartReturn = unknown,
  StopReturn = unknown,
  DestroyReturn = unknown,
>(
  errorRunning: Error = new ErrorAsyncInitRunning(),
  errorDestroyed: Error = new ErrorAsyncInitDestroyed(),
  {
    eventStart = EventAsyncInitStart,
    eventStarted = EventAsyncInitStarted,
    eventStop = EventAsyncInitStop,
    eventStopped = EventAsyncInitStopped,
    eventDestroy = EventAsyncInitDestroy,
    eventDestroyed = EventAsyncInitDestroyed,
  }: {
    eventStart?: Class<Event>;
    eventStarted?: Class<Event>;
    eventStop?: Class<Event>;
    eventStopped?: Class<Event>;
    eventDestroy?: Class<Event>;
    eventDestroyed?: Class<Event>;
  } = {},
) {
  return <
    T extends {
      new (...args: Array<any>): {
        start?(...args: Array<any>): Promise<StartReturn | void>;
        stop?(...args: Array<any>): Promise<StopReturn | void>;
        destroy?(...args: Array<any>): Promise<DestroyReturn | void>;
      };
    },
  >(
    constructor: T,
  ): {
    new (
      ...args: Array<any>
    ): CreateDestroyStartStop<StartReturn, StopReturn, DestroyReturn>;
  } & T => {
    const constructor_ = class extends Evented()(constructor) {
      public [_running]: boolean = false;
      public [_destroyed]: boolean = false;
      public [_status]: Status = null;
      public readonly [initLock]: RWLockWriter = new RWLockWriter();

      public get [running](): boolean {
        return this[_running];
      }

      public get [destroyed](): boolean {
        return this[_destroyed];
      }

      public get [status](): Status {
        return this[_status];
      }

      public async destroy(...args: Array<any>): Promise<DestroyReturn | void> {
        return this[initLock].withWriteF(async () => {
          this[_status] = 'destroying';
          try {
            if (this[_destroyed]) {
              return;
            }
            if (this[_running]) {
              // Unfortunately `this.destroy` doesn't work as the decorated function
              resetStackTrace(errorRunning);
              throw errorRunning;
            }
            this.dispatchEvent(new eventDestroy());
            let result;
            if (typeof super['destroy'] === 'function') {
              result = await super.destroy(...args);
            }
            this[_destroyed] = true;
            this.dispatchEvent(new eventDestroyed());
            return result;
          } finally {
            this[_status] = null;
          }
        });
      }

      public async start(...args: Array<any>): Promise<StartReturn | void> {
        return this[initLock].withWriteF(async () => {
          this[_status] = 'starting';
          try {
            if (this[_running]) {
              return;
            }
            if (this[_destroyed]) {
              // Unfortunately `this.start` doesn't work as the decorated function
              resetStackTrace(errorDestroyed);
              throw errorDestroyed;
            }
            this.dispatchEvent(new eventStart());
            let result;
            if (typeof super['start'] === 'function') {
              result = await super.start(...args);
            }
            this[_running] = true;
            this.dispatchEvent(new eventStarted());
            return result;
          } finally {
            this[_status] = null;
          }
        });
      }

      public async stop(...args: Array<any>): Promise<StopReturn | void> {
        return this[initLock].withWriteF(async () => {
          this[_status] = 'stopping';
          try {
            if (!this[_running]) {
              return;
            }
            if (this[_destroyed]) {
              // It is not possible to be running and destroyed
              // however this line is here for completion
              // Unfortunately `this.stop` doesn't work as the decorated function
              resetStackTrace(errorDestroyed);
              throw errorDestroyed;
            }
            this.dispatchEvent(new eventStop());
            let result;
            if (typeof super['stop'] === 'function') {
              result = await super.stop(...args);
            }
            this[_running] = false;
            this.dispatchEvent(new eventStopped());
            return result;
          } finally {
            this[_status] = null;
          }
        });
      }
    };
    // Preserve the name
    Object.defineProperty(
      constructor_,
      'name',
      Object.getOwnPropertyDescriptor(constructor, 'name')!,
    );
    return constructor_;
  };
}

function ready(
  errorNotRunning: Error = new ErrorAsyncInitNotRunning(),
  block: boolean = false,
  allowedStatuses: Array<Status> = [],
) {
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    let kind;
    if (descriptor.value != null) {
      kind = 'value';
    } else if (descriptor.get != null) {
      kind = 'get';
    } else if (descriptor.set != null) {
      kind = 'set';
    }
    const f: Function = descriptor[kind]; // eslint-disable-line @typescript-eslint/ban-types
    if (typeof f !== 'function') {
      throw new TypeError(`${key} is not a function`);
    }
    if (f instanceof AsyncFunction) {
      descriptor[kind] = async function (...args) {
        if (allowedStatuses.includes(this[_status])) {
          return f.apply(this, args);
        }
        if (block) {
          return this[initLock].withReadF(async () => {
            if (!this[_running]) {
              resetStackTrace(errorNotRunning, descriptor[kind]);
              throw errorNotRunning;
            }
            return f.apply(this, args);
          });
        } else {
          if (this[initLock].isLocked('write') || !this[_running]) {
            resetStackTrace(errorNotRunning, descriptor[kind]);
            throw errorNotRunning;
          }
          return f.apply(this, args);
        }
      };
    } else if (f instanceof GeneratorFunction) {
      descriptor[kind] = function* (...args) {
        if (allowedStatuses.includes(this[_status])) {
          return yield* f.apply(this, args);
        }
        if (this[initLock].isLocked('write') || !this[_running]) {
          resetStackTrace(errorNotRunning, descriptor[kind]);
          throw errorNotRunning;
        }
        return yield* f.apply(this, args);
      };
    } else if (f instanceof AsyncGeneratorFunction) {
      descriptor[kind] = async function* (...args) {
        if (allowedStatuses.includes(this[_status])) {
          return yield* f.apply(this, args);
        }
        if (block) {
          return yield* this[initLock].withReadG(() => {
            if (!this[_running]) {
              resetStackTrace(errorNotRunning, descriptor[kind]);
              throw errorNotRunning;
            }
            return f.apply(this, args);
          });
        } else {
          if (this[initLock].isLocked('write') || !this[_running]) {
            resetStackTrace(errorNotRunning, descriptor[kind]);
            throw errorNotRunning;
          }
          return yield* f.apply(this, args);
        }
      };
    } else {
      descriptor[kind] = function (...args) {
        if (allowedStatuses.includes(this[_status])) {
          return f.apply(this, args);
        }
        if (this[initLock].isLocked('write') || !this[_running]) {
          resetStackTrace(errorNotRunning, descriptor[kind]);
          throw errorNotRunning;
        }
        return f.apply(this, args);
      };
    }
    // Preserve the name
    Object.defineProperty(descriptor[kind], 'name', { value: key });
    return descriptor;
  };
}

export { CreateDestroyStartStop, ready, running, destroyed, status, initLock };
