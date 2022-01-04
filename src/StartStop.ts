import type { Status } from './types';
import {
  _running,
  running,
  _status,
  status,
  initLock,
  RWLock,
  AsyncFunction,
  GeneratorFunction,
  AsyncGeneratorFunction,
} from './utils';
import { ErrorAsyncInitNotRunning } from './errors';

interface StartStop<StartReturn = unknown, StopReturn = unknown> {
  get [running](): boolean;
  get [status](): Status;
  readonly [initLock]: RWLock;
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
      public [_status]: Status = null;
      public readonly [initLock]: RWLock = new RWLock();

      public get [running](): boolean {
        return this[_running];
      }

      public get [status](): Status {
        return this[_status];
      }

      public async start(...args: Array<any>): Promise<StartReturn | void> {
        const release = await this[initLock].acquireWrite();
        this[_status] = 'starting';
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
          this[_status] = null;
          release();
        }
      }

      public async stop(...args: Array<any>): Promise<StopReturn | void> {
        const release = await this[initLock].acquireWrite();
        this[_status] = 'stopping';
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
          this[_status] = null;
          release();
        }
      }
    };
  };
}

function ready(
  errorNotRunning: Error = new ErrorAsyncInitNotRunning(),
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
    const f: Function = descriptor[kind];
    if (typeof f !== 'function') {
      throw new TypeError(`${key} is not a function`);
    }
    if (f instanceof AsyncFunction) {
      descriptor[kind] = async function (...args) {
        if (block) {
          const release = await this[initLock].acquireRead();
          try {
            if (!this[_running]) {
              throw errorNotRunning;
            }
            // Await the async operation before releasing
            return await f.apply(this, args);
          } finally {
            release();
          }
        } else {
          if (this[initLock].isLocked()) {
            throw errorNotRunning;
          }
          if (!this[_running]) {
            throw errorNotRunning;
          }
          return f.apply(this, args);
        }
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
        if (block) {
          const release = await this[initLock].acquireRead();
          try {
            if (!this[_running]) {
              throw errorNotRunning;
            }
            yield* f.apply(this, args);
          } finally {
            release();
          }
        } else {
          if (this[initLock].isLocked()) {
            throw errorNotRunning;
          }
          if (!this[_running]) {
            throw errorNotRunning;
          }
          yield* f.apply(this, args);
        }
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

export { StartStop, ready, running, status, initLock };
