import {
  AsyncFunction,
  GeneratorFunction,
  AsyncGeneratorFunction,
} from './utils';
import { ErrorAsyncInitDestroyed } from './errors';

interface CreateDestroy {
  get destroyed(): boolean;
  destroy(...args: Array<any>): Promise<void>;
}

function CreateDestroy() {
  return <
    T extends {
      new (...args: any[]): {
        destroy?(...args: Array<any>): Promise<void>;
      };
    },
  >(
    constructor: T,
  ) => {
    return class extends constructor {
      public _destroyed: boolean = false;

      get destroyed(): boolean {
        return this._destroyed;
      }

      public async destroy(...args: Array<any>): Promise<void> {
        try {
          if (this._destroyed) {
            return;
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
    };
  };
}

function ready(errorDestroyed: Error = new ErrorAsyncInitDestroyed()) {
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
        if (this._destroyed) {
          throw errorDestroyed;
        }
        return f.apply(this, args);
      };
    } else if (f instanceof GeneratorFunction) {
      descriptor[kind] = function* (...args) {
        if (this._destroyed) {
          throw errorDestroyed;
        }
        yield* f.apply(this, args);
      };
    } else if (f instanceof AsyncGeneratorFunction) {
      descriptor[kind] = async function* (...args) {
        if (this._destroyed) {
          throw errorDestroyed;
        }
        yield* f.apply(this, args);
      };
    } else {
      descriptor[kind] = function (...args) {
        if (this._destroyed) {
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

export { CreateDestroy, ready };
