import type { Status, Class } from './types';
import { Evented } from '@matrixai/events';
import { RWLockWriter } from '@matrixai/async-locks';
import {
  _running,
  running,
  _status,
  status,
  _statusP,
  statusP,
  resolveStatusP,
  initLock,
  AsyncFunction,
  GeneratorFunction,
  AsyncGeneratorFunction,
  promise,
  resetStackTrace,
} from './utils';
import {
  EventAsyncInitStart,
  EventAsyncInitStarted,
  EventAsyncInitStop,
  EventAsyncInitStopped,
} from './events';
import { ErrorAsyncInitNotRunning } from './errors';

interface StartStop<StartReturn = unknown, StopReturn = unknown>
  extends Evented {
  get [running](): boolean;
  get [status](): Status;
  get [statusP](): Promise<Status>;
  readonly [initLock]: RWLockWriter;
  start(...args: Array<any>): Promise<StartReturn | void>;
  stop(...args: Array<any>): Promise<StopReturn | void>;
}

function StartStop<StartReturn = unknown, StopReturn = unknown>({
  eventStart = EventAsyncInitStart,
  eventStarted = EventAsyncInitStarted,
  eventStop = EventAsyncInitStop,
  eventStopped = EventAsyncInitStopped,
}: {
  eventStart?: Class<Event>;
  eventStarted?: Class<Event>;
  eventStop?: Class<Event>;
  eventStopped?: Class<Event>;
} = {}) {
  return <
    T extends {
      new (...args: Array<any>): {
        start?(...args: Array<any>): Promise<StartReturn | void>;
        stop?(...args: Array<any>): Promise<StopReturn | void>;
      };
    },
  >(
    constructor: T,
  ): {
    new (...args: Array<any>): StartStop<StartReturn, StopReturn>;
  } & T => {
    const { p, resolveP } = promise<Status>();
    const constructor_ = class extends Evented()(constructor) {
      public [_running]: boolean = false;
      public [_status]: Status = null;
      public [_statusP]: Promise<Status> = p;
      public [resolveStatusP]: (status: Status) => void = resolveP;
      public readonly [initLock]: RWLockWriter = new RWLockWriter();

      public get [running](): boolean {
        return this[_running];
      }

      public get [status](): Status {
        return this[_status];
      }

      public get [statusP](): Promise<Status> {
        return this[_statusP];
      }

      public async start(...args: Array<any>): Promise<StartReturn | void> {
        return this[initLock]
          .withWriteF(async () => {
            if (this[_running]) {
              return;
            }
            this[_status] = 'starting';
            this[resolveStatusP]('starting');
            const { p, resolveP } = promise<Status>();
            this[_statusP] = p;
            this[resolveStatusP] = resolveP;
            this.dispatchEvent(new eventStart());
            let result;
            if (typeof super['start'] === 'function') {
              result = await super.start(...args);
            }
            this[_running] = true;
            this.dispatchEvent(new eventStarted());
            return result;
          })
          .finally(() => {
            this[_status] = null;
            this[resolveStatusP](null);
            const { p, resolveP } = promise<Status>();
            this[_statusP] = p;
            this[resolveStatusP] = resolveP;
          });
      }

      public async stop(...args: Array<any>): Promise<StopReturn | void> {
        return this[initLock]
          .withWriteF(async () => {
            if (!this[_running]) {
              return;
            }
            this[_status] = 'stopping';
            this[resolveStatusP]('stopping');
            const { p, resolveP } = promise<Status>();
            this[_statusP] = p;
            this[resolveStatusP] = resolveP;
            this.dispatchEvent(new eventStop());
            let result;
            if (typeof super['stop'] === 'function') {
              result = await super.stop(...args);
            }
            this[_running] = false;
            this.dispatchEvent(new eventStopped());
            return result;
          })
          .finally(() => {
            this[_status] = null;
            this[resolveStatusP](null);
            const { p, resolveP } = promise<Status>();
            this[_statusP] = p;
            this[resolveStatusP] = resolveP;
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
        // If it is write locked, wait until the status has changed
        // This method may be called in between write locked and status change
        if (this[initLock].isLocked('write') && this[_status] === null) {
          await this[_statusP];
        }
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
        if (
          (this[initLock].isLocked('write') && this[status] !== null) ||
          !this[_running]
        ) {
          resetStackTrace(errorNotRunning, descriptor[kind]);
          throw errorNotRunning;
        }
        return yield* f.apply(this, args);
      };
    } else if (f instanceof AsyncGeneratorFunction) {
      descriptor[kind] = async function* (...args) {
        // If it is write locked, wait until the status has changed
        // This method may be called in between write locked and status change
        if (this[initLock].isLocked('write') && this[_status] === null) {
          await this[_statusP];
        }
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
        if (
          (this[initLock].isLocked('write') && this[status] !== null) ||
          !this[_running]
        ) {
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

export { StartStop, ready, running, status, statusP, initLock };
