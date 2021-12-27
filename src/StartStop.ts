import { Mutex } from 'async-mutex';
import {
  AsyncFunction,
  GeneratorFunction,
  AsyncGeneratorFunction,
} from './utils';
import { ErrorAsyncInitNotRunning } from './errors';

/**
 * Symbols prevents name clashes with decorated classes
 */
const _running = Symbol('_running');
const running = Symbol('running');
const initLock = Symbol('initLock');

interface StartStop<StartReturn = unknown, StopReturn = unknown> {
  get [running](): boolean;
  readonly [initLock]: Mutex;
  start(...args: Array<any>): Promise<StartReturn | void>;
  stop(...args: Array<any>): Promise<StopReturn | void>;
}

function StartStop<StartReturn = unknown, StopReturn = unknown>() {
  return <
    T extends {
      new (...args: any[]): {
        start?(...args: Array<any>): Promise<StartReturn | void>;
        stop?(...args: Array<any>): Promise<StopReturn | void>;
      };
    },
  >(
    constructor: T,
  ) => {
    return class extends constructor {
      public [_running]: boolean = false;
      public readonly [initLock]: Mutex = new Mutex();

      public get [running](): boolean {
        return this[_running];
      }

      public async start(...args: Array<any>): Promise<StartReturn | void> {
        const release = await this[initLock].acquire();
        try {
          if (this[_running]) {
            return;
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

export { StartStop, ready, running, initLock };
