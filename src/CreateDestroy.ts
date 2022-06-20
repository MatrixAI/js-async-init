import type { Status } from './types';
import { RWLockWriter } from '@matrixai/async-locks';
import {
  _destroyed,
  destroyed,
  _status,
  status,
  initLock,
  AsyncFunction,
  GeneratorFunction,
  AsyncGeneratorFunction,
} from './utils';
import { ErrorAsyncInitDestroyed } from './errors';

interface CreateDestroy<DestroyReturn = unknown> {
  get [destroyed](): boolean;
  get [status](): Status;
  readonly [initLock]: RWLockWriter;
  destroy(...args: Array<any>): Promise<DestroyReturn | void>;
}

function CreateDestroy<DestroyReturn = unknown>() {
  return <
    T extends {
      new (...args: any[]): {
        destroy?(...args: Array<any>): Promise<DestroyReturn | void>;
      };
    },
  >(
    constructor: T,
  ) => {
    const constructor_ = class extends constructor {
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
            let result;
            if (typeof super['destroy'] === 'function') {
              result = await super.destroy(...args);
            }
            this[_destroyed] = true;
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
        if (block) {
          return this[initLock].withReadF(async () => {
            if (this[_destroyed]) {
              errorDestroyed.stack = new Error().stack ?? '';
              throw errorDestroyed;
            }
            return f.apply(this, args);
          });
        } else {
          if (this[initLock].isLocked()) {
            errorDestroyed.stack = new Error().stack ?? '';
            throw errorDestroyed;
          }
          if (this[_destroyed]) {
            errorDestroyed.stack = new Error().stack ?? '';
            throw errorDestroyed;
          }
          return f.apply(this, args);
        }
      };
    } else if (f instanceof GeneratorFunction) {
      descriptor[kind] = function* (...args) {
        // If locked, it is during destroy
        // Consider it already destroyed
        if (this[initLock].isLocked()) {
          errorDestroyed.stack = new Error().stack ?? '';
          throw errorDestroyed;
        }
        if (this[_destroyed]) {
          errorDestroyed.stack = new Error().stack ?? '';
          throw errorDestroyed;
        }
        yield* f.apply(this, args);
      };
    } else if (f instanceof AsyncGeneratorFunction) {
      descriptor[kind] = async function* (...args) {
        if (block) {
          yield* this[initLock].withReadG(() => {
            if (this[_destroyed]) {
              errorDestroyed.stack = new Error().stack ?? '';
              throw errorDestroyed;
            }
            return f.apply(this, args);
          });
        } else {
          if (this[initLock].isLocked()) {
            errorDestroyed.stack = new Error().stack ?? '';
            throw errorDestroyed;
          }
          if (this[_destroyed]) {
            errorDestroyed.stack = new Error().stack ?? '';
            throw errorDestroyed;
          }
          yield* f.apply(this, args);
        }
      };
    } else {
      descriptor[kind] = function (...args) {
        // If locked, it is during destroy
        // Consider it already destroyed
        if (this[initLock].isLocked()) {
          errorDestroyed.stack = new Error().stack ?? '';
          throw errorDestroyed;
        }
        if (this[_destroyed]) {
          errorDestroyed.stack = new Error().stack ?? '';
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
