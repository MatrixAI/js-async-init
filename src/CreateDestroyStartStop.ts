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
  start(...args: Array<any>): Promise<any>;
  stop(...args: Array<any>): Promise<any>;
  destroy(...args: Array<any>): Promise<any>;
}

function CreateDestroyStartStop(
  errorRunning: Error = new ErrorAsyncInitRunning(),
  errorDestroyed: Error = new ErrorAsyncInitDestroyed(),
) {
  return <
    T extends {
      new (...args: any[]): {
        start?(...args: Array<any>): Promise<any>;
        stop?(...args: Array<any>): Promise<any>;
        destroy?(...args: Array<any>): Promise<any>;
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

      public async destroy(...args: Array<any>): Promise<any> {
        try {
          if (this._destroyed) {
            return;
          }
          if (this._running) {
            throw errorRunning;
          }
          this._destroyed = true;
          if (typeof super['destroy'] === 'function') {
            return await super.destroy(...args);
          }
        } catch (e) {
          this._destroyed = false;
          throw e;
        }
      }

      public async start(...args: Array<any>): Promise<any> {
        try {
          if (this._running) {
            return;
          }
          if (this._destroyed) {
            throw errorDestroyed;
          }
          this._running = true;
          if (typeof super['start'] === 'function') {
            return await super.start(...args);
          }
        } catch (e) {
          this._running = false;
          throw e;
        }
      }

      public async stop(...args: Array<any>): Promise<any> {
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
            return await super.stop(...args);
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
        if (!this._running) {
          throw errorNotRunning;
        }
        return f.apply(this, args);
      };
    } else if (f instanceof GeneratorFunction) {
      descriptor[kind] = function* (...args) {
        if (!this._running) {
          throw errorNotRunning;
        }
        yield* f.apply(this, args);
      };
    } else if (f instanceof AsyncGeneratorFunction) {
      descriptor[kind] = async function* (...args) {
        if (!this._running) {
          throw errorNotRunning;
        }
        yield* f.apply(this, args);
      };
    } else {
      descriptor[kind] = function (...args) {
        if (!this._running) {
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

export { CreateDestroyStartStop, ready };
