import {
  AsyncFunction,
  GeneratorFunction,
  AsyncGeneratorFunction,
} from './utils';
import { ErrorAsyncInitNotRunning } from './errors';

interface StartStop {
  get running(): boolean;
  start(...args: Array<any>): Promise<void>;
  stop(...args: Array<any>): Promise<void>;
}

function StartStop() {
  return <
    T extends {
      new (...args: any[]): {
        start?(...args: Array<any>): Promise<void>;
        stop?(...args: Array<any>): Promise<void>;
      };
    },
  >(
    constructor: T,
  ) => {
    return class extends constructor {
      public _running: boolean = false;

      get running(): boolean {
        return this._running;
      }

      public async start(...args: Array<any>): Promise<void> {
        try {
          if (this._running) {
            return;
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

      public async stop(...args: Array<any>) {
        try {
          if (!this._running) {
            return;
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

export { StartStop, ready };
