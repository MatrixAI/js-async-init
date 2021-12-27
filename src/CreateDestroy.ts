import {
  _destroyed,
  destroyed,
  initLock,
  RWLock,
  AsyncFunction,
  GeneratorFunction,
  AsyncGeneratorFunction,
} from './utils';
import { ErrorAsyncInitDestroyed } from './errors';

interface CreateDestroy<DestroyReturn = unknown> {
  get [destroyed](): boolean;
  readonly [initLock]: RWLock;
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
    return class extends constructor {
      public [_destroyed]: boolean = false;
      public readonly [initLock]: RWLock = new RWLock();

      public get [destroyed](): boolean {
        return this[_destroyed];
      }

      public async destroy(...args: Array<any>): Promise<DestroyReturn | void> {
        const release = await this[initLock].acquireWrite();
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
          release();
        }
      }
    };
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
    const f: Function = descriptor[kind];
    if (typeof f !== 'function') {
      throw new TypeError(`${key} is not a function`);
    }
    if (f instanceof AsyncFunction) {
      descriptor[kind] = async function (...args) {
        if (block) {
          const release = await this[initLock].acquireRead();
          try {
            if (this[_destroyed]) {
              throw errorDestroyed;
            }
            // Await the async operation before releasing
            return await f.apply(this, args);
          } finally {
            release();
          }
        } else {
          if (this[initLock].isLocked()) {
            throw errorDestroyed;
          }
          if (this[_destroyed]) {
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
          throw errorDestroyed;
        }
        if (this[_destroyed]) {
          throw errorDestroyed;
        }
        yield* f.apply(this, args);
      };
    } else if (f instanceof AsyncGeneratorFunction) {
      descriptor[kind] = async function* (...args) {
        if (block) {
          const release = await this[initLock].acquireRead();
          try {
            if (this[_destroyed]) {
              throw errorDestroyed;
            }
            yield* f.apply(this, args);
          } finally {
            release();
          }
        } else {
          if (this[initLock].isLocked()) {
            throw errorDestroyed;
          }
          if (this[_destroyed]) {
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
          throw errorDestroyed;
        }
        if (this[_destroyed]) {
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

export { CreateDestroy, ready, destroyed, initLock };
