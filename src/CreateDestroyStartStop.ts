import { Mutex } from 'async-mutex';
import {
  AsyncFunction,
  GeneratorFunction,
  AsyncGeneratorFunction,
} from './utils';
import {
  ErrorAsyncInitRunning,
  ErrorAsyncInitNotRunning,
  ErrorAsyncInitDestroyed,
} from './errors';

/**
 * Symbols prevents name clashes with decorated classes
 */
const _running = Symbol('_running');
const running = Symbol('running');
const _destroyed = Symbol('_destroyed');
const destroyed = Symbol('destroyed');
const initLock = Symbol('initLock');

interface CreateDestroyStartStop<
  StartReturn = unknown,
  StopReturn = unknown,
  DestroyReturn = unknown,
> {
  get [running](): boolean;
  get [destroyed](): boolean;
  readonly [initLock]: Mutex;
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
) {
  return <
    T extends {
      new (...args: any[]): {
        start?(...args: Array<any>): Promise<StartReturn | void>;
        stop?(...args: Array<any>): Promise<StopReturn | void>;
        destroy?(...args: Array<any>): Promise<DestroyReturn | void>;
      };
    },
  >(
    constructor: T,
  ) => {
    return class extends constructor {
      public [_running]: boolean = false;
      public [_destroyed]: boolean = false;
      public readonly [initLock]: Mutex = new Mutex();

      public get [running](): boolean {
        return this[_running];
      }

      public get [destroyed](): boolean {
        return this[_destroyed];
      }

      public async destroy(...args: Array<any>): Promise<DestroyReturn | void> {
        const release = await this[initLock].acquire();
        try {
          if (this[_destroyed]) {
            return;
          }
          if (this[_running]) {
            throw errorRunning;
          }
          let result;
          if (typeof super['destroy'] === 'function') {
            result = await super.destroy(...args);
          }
          this[_destroyed] = true;
          return result;
        } finally {
          release();
        }
      }

      public async start(...args: Array<any>): Promise<StartReturn | void> {
        const release = await this[initLock].acquire();
        try {
          if (this[_running]) {
            return;
          }
          if (this[_destroyed]) {
            throw errorDestroyed;
          }
          let result;
          if (typeof super['start'] === 'function') {
            result = await super.start(...args);
          }
          this[_running] = true;
          return result;
        } finally {
          release();
        }
      }

      public async stop(...args: Array<any>): Promise<StopReturn | void> {
        const release = await this[initLock].acquire();
        try {
          if (!this[_running]) {
            return;
          }
          if (this[_destroyed]) {
            // It is not possible to be running and destroyed
            // however this line is here for completion
            throw errorDestroyed;
          }
          let result;
          if (typeof super['stop'] === 'function') {
            result = await super.stop(...args);
          }
          this[_running] = false;
          return result;
        } finally {
          release();
        }
      }
    };
  };
}

function ready(
  errorNotRunning: Error = new ErrorAsyncInitNotRunning(),
  wait: boolean = false,
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
    const f: Function = descriptor[kind];
    if (typeof f !== 'function') {
      throw new TypeError(`${key} is not a function`);
    }
    if (f instanceof AsyncFunction) {
      descriptor[kind] = async function (...args) {
        if (wait) {
          await this[initLock].waitForUnlock();
        } else {
          if (this[initLock].isLocked()) {
            throw errorNotRunning;
          }
        }
        if (!this[_running]) {
          throw errorNotRunning;
        }
        return f.apply(this, args);
      };
    } else if (f instanceof GeneratorFunction) {
      descriptor[kind] = function* (...args) {
        if (this[initLock].isLocked()) {
          throw errorNotRunning;
        }
        if (!this[_running]) {
          throw errorNotRunning;
        }
        yield* f.apply(this, args);
      };
    } else if (f instanceof AsyncGeneratorFunction) {
      descriptor[kind] = async function* (...args) {
        if (wait) {
          await this[initLock].waitForUnlock();
        } else {
          if (this[initLock].isLocked()) {
            throw errorNotRunning;
          }
        }
        if (!this[_running]) {
          throw errorNotRunning;
        }
        yield* f.apply(this, args);
      };
    } else {
      descriptor[kind] = function (...args) {
        if (this[initLock].isLocked()) {
          throw errorNotRunning;
        }
        if (!this[_running]) {
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

export { CreateDestroyStartStop, ready, running, destroyed, initLock };
