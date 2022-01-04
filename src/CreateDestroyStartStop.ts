import type { Status } from './types';
import {
  _running,
  running,
  _destroyed,
  destroyed,
  _status,
  status,
  initLock,
  RWLock,
  AsyncFunction,
  GeneratorFunction,
  AsyncGeneratorFunction,
} from './utils';
import {
  ErrorAsyncInitRunning,
  ErrorAsyncInitNotRunning,
  ErrorAsyncInitDestroyed,
} from './errors';

interface CreateDestroyStartStop<
  StartReturn = unknown,
  StopReturn = unknown,
  DestroyReturn = unknown,
> {
  get [running](): boolean;
  get [destroyed](): boolean;
  get [status](): Status;
  readonly [initLock]: RWLock;
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
      public [_status]: Status = null;
      public readonly [initLock]: RWLock = new RWLock();

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
        const release = await this[initLock].acquireWrite();
        this[_status] = 'destroying';
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
          this[_status] = null;
          release();
        }
      }

      public async start(...args: Array<any>): Promise<StartReturn | void> {
        const release = await this[initLock].acquireWrite();
        this[_status] = 'starting';
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

export { CreateDestroyStartStop, ready, running, destroyed, status, initLock };
