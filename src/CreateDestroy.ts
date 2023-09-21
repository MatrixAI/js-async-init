import type { Status, Class } from './types';
import { Evented } from '@matrixai/events';
import { RWLockWriter } from '@matrixai/async-locks';
import {
  _destroyed,
  destroyed,
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
import { EventAsyncInitDestroy, EventAsyncInitDestroyed } from './events';
import { ErrorAsyncInitDestroyed } from './errors';

interface CreateDestroy<DestroyReturn = unknown> extends Evented {
  get [destroyed](): boolean;
  get [status](): Status;
  get [statusP](): Promise<Status>;
  readonly [initLock]: RWLockWriter;
  destroy(...args: Array<any>): Promise<DestroyReturn | void>;
}

function CreateDestroy<DestroyReturn = unknown>({
  eventDestroy = EventAsyncInitDestroy,
  eventDestroyed = EventAsyncInitDestroyed,
}: {
  eventDestroy?: Class<Event>;
  eventDestroyed?: Class<Event>;
} = {}) {
  return <
    T extends {
      new (...args: any[]): {
        destroy?(...args: Array<any>): Promise<DestroyReturn | void>;
      };
    },
  >(
    constructor: T,
  ): {
    new (...args: Array<any>): CreateDestroy<DestroyReturn>;
  } & T => {
    const { p, resolveP } = promise<Status>();
    const constructor_ = class extends Evented()(constructor) {
      public [_destroyed]: boolean = false;
      public [_status]: Status = null;
      public [_statusP]: Promise<Status> = p;
      public [resolveStatusP]: (status: Status) => void = resolveP;
      public readonly [initLock]: RWLockWriter = new RWLockWriter();

      public get [destroyed](): boolean {
        return this[_destroyed];
      }

      public get [status](): Status {
        return this[_status];
      }

      public get [statusP](): Promise<Status> {
        return this[_statusP];
      }

      public async destroy(...args: Array<any>): Promise<DestroyReturn | void> {
        return this[initLock]
          .withWriteF(async () => {
            if (this[_destroyed]) {
              return;
            }
            this[_status] = 'destroying';
            this[resolveStatusP]('destroying');
            const { p, resolveP } = promise<Status>();
            this[_statusP] = p;
            this[resolveStatusP] = resolveP;
            this.dispatchEvent(new eventDestroy());
            let result;
            if (typeof super['destroy'] === 'function') {
              result = await super.destroy(...args);
            }
            this[_destroyed] = true;
            this.dispatchEvent(new eventDestroyed());
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
  errorDestroyed: Error = new ErrorAsyncInitDestroyed(),
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
            if (this[_destroyed]) {
              resetStackTrace(errorDestroyed, descriptor[kind]);
              throw errorDestroyed;
            }
            return f.apply(this, args);
          });
        } else {
          if (this[initLock].isLocked('write') || this[_destroyed]) {
            resetStackTrace(errorDestroyed, descriptor[kind]);
            throw errorDestroyed;
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
          this[_destroyed]
        ) {
          resetStackTrace(errorDestroyed, descriptor[kind]);
          throw errorDestroyed;
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
            if (this[_destroyed]) {
              resetStackTrace(errorDestroyed, descriptor[kind]);
              throw errorDestroyed;
            }
            return f.apply(this, args);
          });
        } else {
          if (this[initLock].isLocked('write') || this[_destroyed]) {
            resetStackTrace(errorDestroyed, descriptor[kind]);
            throw errorDestroyed;
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
          this[_destroyed]
        ) {
          resetStackTrace(errorDestroyed, descriptor[kind]);
          throw errorDestroyed;
        }
        return f.apply(this, args);
      };
    }
    // Preserve the name
    Object.defineProperty(descriptor[kind], 'name', { value: key });
    return descriptor;
  };
}

export { CreateDestroy, ready, destroyed, status, statusP, initLock };
