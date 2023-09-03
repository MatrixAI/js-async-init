import type { Status, Class } from './types.js';
import { RWLockWriter } from '@matrixai/async-locks';
import { Evented } from '@matrixai/events';
import {
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
import { EventAsyncInitDestroy, EventAsyncInitDestroyed } from './events.js';
import { ErrorAsyncInitDestroyed } from './errors.js';

interface CreateDestroy<DestroyReturn = unknown> extends Evented {
  get [destroyed](): boolean;
  get [status](): Status;
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
      new (...args: Array<any>): {
        destroy?(...args: Array<any>): Promise<DestroyReturn | void>;
      };
    },
  >(
    constructor: T,
  ): {
    new (...args: Array<any>): CreateDestroy<DestroyReturn>;
  } & T => {
    const constructor_ = class extends Evented()(constructor) {
      public [_destroyed]: boolean = false;
      public [_status]: Status = null;
      public readonly [initLock]: RWLockWriter = new RWLockWriter();

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
        if (this[initLock].isLocked('write') || this[_destroyed]) {
          resetStackTrace(errorDestroyed, descriptor[kind]);
          throw errorDestroyed;
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
        if (this[initLock].isLocked('write') || this[_destroyed]) {
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

export { CreateDestroy, ready, destroyed, status, initLock };
