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

interface CreateDestroyStartStop {
  get running(): boolean;
  get destroyed(): boolean;
  start(...args: Array<any>): Promise<void>;
  stop(...args: Array<any>): Promise<void>;
  destroy(...args: Array<any>): Promise<void>;
}

function CreateDestroyStartStop(
  errorRunning: Error = new ErrorAsyncInitRunning(),
  errorDestroyed: Error = new ErrorAsyncInitDestroyed(),
) {
  return <
    T extends {
      new (...args: any[]): {
        start?(...args: Array<any>): Promise<void>;
        stop?(...args: Array<any>): Promise<void>;
        destroy?(...args: Array<any>): Promise<void>;
      };
    },
  >(
    constructor: T,
  ) => {
    return class extends constructor {
      public _running: boolean = false;
      public _destroyed: boolean = false;

      get running(): boolean {
        return this._running;
      }

      get destroyed(): boolean {
        return this._destroyed;
      }

      public async destroy(...args: Array<any>): Promise<void> {
        try {
          if (this._destroyed) {
            return;
          }
          if (this._running) {
            throw errorRunning;
          }
          this._destroyed = true;
          if (typeof super['destroy'] === 'function') {
            await super.destroy(...args);
          }
        } catch (e) {
          this._destroyed = false;
          throw e;
        }
      }

      public async start(...args: Array<any>): Promise<void> {
        try {
          if (this._running) {
            return;
          }
          if (this._destroyed) {
            throw errorDestroyed;
          }
          this._running = true;
          if (typeof super['start'] === 'function') {
            await super.start(...args);
          }
        } catch (e) {
          this._running = false;
          throw e;
        }
      }

      public async stop(...args: Array<any>): Promise<void> {
        try {
          if (!this._running) {
            return;
          }
          if (this._destroyed) {
            // It is not possible to be running and destroyed
            // however this line is here for completion
            throw errorDestroyed;
          }
          this._running = false;
          if (typeof super['stop'] === 'function') {
            await super.stop(...args);
          }
        } catch (e) {
          this._running = true;
          throw e;
        }
      }
    };
  };
}

function ready(errorNotRunning: Error = new ErrorAsyncInitNotRunning()) {
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    const f = descriptor.value;
    if (typeof f !== 'function') {
      throw new TypeError(`${key} is not a function`);
    }
    if (descriptor.value instanceof AsyncFunction) {
      descriptor.value = async function (...args) {
        if (!this._running) {
          throw errorNotRunning;
        }
        return f.apply(this, args);
      };
    } else if (descriptor.value instanceof GeneratorFunction) {
      descriptor.value = function* (...args) {
        if (!this._running) {
          throw errorNotRunning;
        }
        yield* f.apply(this, args);
      };
    } else if (descriptor.value instanceof AsyncGeneratorFunction) {
      descriptor.value = async function* (...args) {
        if (!this._running) {
          throw errorNotRunning;
        }
        yield* f.apply(this, args);
      };
    } else {
      descriptor.value = function (...args) {
        if (!this._running) {
          throw errorNotRunning;
        }
        return f.apply(this, args);
      };
    }
    // Preserve the name
    Object.defineProperty(descriptor.value, 'name', { value: key });
    return descriptor;
  };
}

export default CreateDestroyStartStop;

export { ready };

export type { CreateDestroyStartStop };
