import { Mutex, tryAcquire } from 'async-mutex';
import { CreateDestroy, ready, destroyed, initLock } from '@/CreateDestroy';
import { ErrorAsyncInitDestroyed } from '@/errors';
import * as testUtils from './utils';

describe('CreateDestroy', () => {
  test('creates, destroys', async () => {
    const createMock = jest.fn();
    const constructorMock = jest.fn();
    const destroyMock = jest.fn();
    const doSomethingMock = jest.fn();
    interface X extends CreateDestroy {}
    @CreateDestroy()
    class X {
      public static async createX() {
        createMock();
        return new X();
      }

      public constructor() {
        constructorMock();
      }

      public async destroy(): Promise<void> {
        destroyMock();
      }

      @ready()
      public async doSomething() {
        doSomethingMock();
      }
    }
    const x = await X.createX();
    expect(createMock.mock.calls.length).toBe(1);
    expect(constructorMock.mock.calls.length).toBe(1);
    await x.doSomething();
    expect(doSomethingMock.mock.calls.length).toBe(1);
    await x.destroy();
    expect(destroyMock.mock.calls.length).toBe(1);
  });
  test('creates, destroys for parent class', async () => {
    const createMock = jest.fn();
    const constructorMock = jest.fn();
    const destroyMock = jest.fn();
    const doSomethingMock = jest.fn();
    // Decorator on parent but not on child
    // decorator cannot be used on both parent and child
    interface X extends CreateDestroy {}
    @CreateDestroy()
    class X {
      public constructor() {
        constructorMock();
      }

      public async destroy(): Promise<void> {
        destroyMock();
      }

      @ready()
      public async doSomething() {
        doSomethingMock();
      }
    }
    class Y extends X {
      public static async createY() {
        createMock();
        return new Y();
      }

      public async destroy(): Promise<void> {
        return await super.destroy();
      }
    }
    const y = await Y.createY();
    expect(createMock.mock.calls.length).toBe(1);
    expect(constructorMock.mock.calls.length).toBe(1);
    await y.doSomething();
    expect(doSomethingMock.mock.calls.length).toBe(1);
    await y.destroy();
    expect(destroyMock.mock.calls.length).toBe(1);
  });
  test('creates, destroys for child class', async () => {
    const createMock = jest.fn();
    const constructorMock = jest.fn();
    const destroyMock = jest.fn();
    const doSomethingMock = jest.fn();
    // Decorator on child but not on parent
    // decorator cannot be used on both parent and child
    class X {
      public constructor() {
        constructorMock();
      }

      public async destroy(): Promise<void> {
        destroyMock();
      }

      public async doSomething() {
        doSomethingMock();
      }
    }
    interface Y extends CreateDestroy {}
    @CreateDestroy()
    class Y extends X {
      public static async createY() {
        createMock();
        return new Y();
      }

      public async destroy(): Promise<void> {
        return await super.destroy();
      }

      @ready()
      public async doSomething() {
        return super.doSomething();
      }
    }
    const y = await Y.createY();
    expect(createMock.mock.calls.length).toBe(1);
    expect(constructorMock.mock.calls.length).toBe(1);
    await y.doSomething();
    expect(doSomethingMock.mock.calls.length).toBe(1);
    await y.destroy();
    expect(destroyMock.mock.calls.length).toBe(1);
  });
  test('creates, destroys for derived abstract class', async () => {
    const createMock = jest.fn();
    const constructorMock = jest.fn();
    const destroyMock = jest.fn();
    const doSomethingMock = jest.fn();
    abstract class X {
      public constructor() {
        constructorMock();
      }

      public async destroy(): Promise<void> {
        destroyMock();
      }

      public async doSomething() {
        doSomethingMock();
      }
    }
    interface Y extends CreateDestroy {}
    @CreateDestroy()
    class Y extends X {
      public static async createY() {
        createMock();
        return new Y();
      }

      public async destroy(): Promise<void> {
        return await super.destroy();
      }

      @ready()
      public async doSomething() {
        return super.doSomething();
      }
    }
    const y = await Y.createY();
    expect(createMock.mock.calls.length).toBe(1);
    expect(constructorMock.mock.calls.length).toBe(1);
    await y.doSomething();
    expect(doSomethingMock.mock.calls.length).toBe(1);
    await y.destroy();
    expect(destroyMock.mock.calls.length).toBe(1);
  });
  test('symbols do not conflict with existing properties', async () => {
    interface X extends CreateDestroy {}
    @CreateDestroy()
    class X {
      destroyed: string = 'some property';
      initLock: string = 'some lock';
    }
    const x = new X();
    expect(x[destroyed]).not.toBe(x.destroyed);
    expect(x[initLock]).not.toBe(x.initLock);
  });
  test('calling methods throws destroyed exceptions when not ready', async () => {
    const doSomethingSyncMock = jest.fn();
    const doSomethingAsyncMock = jest.fn();
    const doSomethingGenSyncMock = jest.fn();
    const doSomethingGenAsyncMock = jest.fn();
    interface X extends CreateDestroy {}
    @CreateDestroy()
    class X {
      @ready()
      public doSomethingSync() {
        doSomethingSyncMock();
      }

      @ready()
      public async doSomethingAsync() {
        doSomethingAsyncMock();
      }

      @ready()
      public *doSomethingGenSync() {
        doSomethingGenSyncMock();
      }

      @ready()
      public async *doSomethingGenAsync() {
        doSomethingGenAsyncMock();
      }
    }
    const x = new X();
    // Ready
    x.doSomethingSync();
    await x.doSomethingAsync();
    x.doSomethingGenSync().next();
    await x.doSomethingGenAsync().next();
    expect(doSomethingAsyncMock.mock.calls.length).toBe(1);
    expect(doSomethingSyncMock.mock.calls.length).toBe(1);
    expect(doSomethingGenSyncMock.mock.calls.length).toBe(1);
    expect(doSomethingGenAsyncMock.mock.calls.length).toBe(1);
    await x.destroy();
    // Not ready
    await expect(x.doSomethingAsync.bind(x)).rejects.toThrow(
      ErrorAsyncInitDestroyed,
    );
    expect(x.doSomethingSync.bind(x)).toThrow(ErrorAsyncInitDestroyed);
    expect(() => x.doSomethingGenSync().next()).toThrow(
      ErrorAsyncInitDestroyed,
    );
    await expect(
      async () => await x.doSomethingGenAsync().next(),
    ).rejects.toThrow(ErrorAsyncInitDestroyed);
    await expect(
      (async () => {
        const x = new X();
        const destroy = x.destroy();
        x.doSomethingSync();
        await destroy;
      })(),
    ).rejects.toThrow(ErrorAsyncInitDestroyed);
    await expect(
      (async () => {
        const x = new X();
        const destroy = x.destroy();
        await x.doSomethingAsync();
        await destroy;
      })(),
    ).rejects.toThrow(ErrorAsyncInitDestroyed);
    await expect(
      (async () => {
        const x = new X();
        const destroy = x.destroy();
        x.doSomethingGenSync().next();
        await destroy;
      })(),
    ).rejects.toThrow(ErrorAsyncInitDestroyed);
    await expect(
      (async () => {
        const x = new X();
        const destroy = x.destroy();
        await x.doSomethingGenAsync().next();
        await destroy;
      })(),
    ).rejects.toThrow(ErrorAsyncInitDestroyed);
  });
  test('calling getters and setters throws destroyed exceptions when destroyed', async () => {
    const aMock = jest.fn();
    const bMock = jest.fn();
    interface X extends CreateDestroy {}
    @CreateDestroy()
    class X {
      protected _b: any;

      @ready()
      get a() {
        aMock();
        return 'a';
      }

      @ready()
      set b(v: any) {
        bMock();
        this._b = v;
      }
    }
    const x = new X();
    const b = x.a;
    x.b = b;
    // Ready
    expect(aMock.mock.calls.length).toBe(1);
    expect(bMock.mock.calls.length).toBe(1);
    await x.destroy();
    // Not ready
    expect(() => x.a).toThrow(ErrorAsyncInitDestroyed);
    expect(() => {
      x.b = 3;
    }).toThrow(ErrorAsyncInitDestroyed);
    // During destroy
    await expect(
      (async () => {
        const x = new X();
        const destroy = x.destroy();
        x.a;
        await destroy;
      })(),
    ).rejects.toThrow(ErrorAsyncInitDestroyed);
    await expect(
      (async () => {
        const x = new X();
        const destroy = x.destroy();
        x.b = 10;
        await destroy;
      })(),
    ).rejects.toThrow(ErrorAsyncInitDestroyed);
  });
  test('custom running, not running and destroyed exceptions', async () => {
    const errorDestroyed = new Error('destroyed');
    interface X extends CreateDestroy {}
    @CreateDestroy()
    class X {
      @ready(errorDestroyed)
      public doSomethingSync() {}

      @ready(errorDestroyed)
      public async doSomethingAsync() {}

      @ready(errorDestroyed)
      public *doSomethingGenSync() {}

      @ready(errorDestroyed)
      public async *doSomethingGenAsync() {}
    }
    const x = new X();
    await x.destroy();
    expect(x.doSomethingSync.bind(x)).toThrow(errorDestroyed);
    await expect(x.doSomethingAsync.bind(x)).rejects.toThrow(errorDestroyed);
    expect(() => x.doSomethingGenSync().next()).toThrow(errorDestroyed);
    await expect(
      async () => await x.doSomethingGenAsync().next(),
    ).rejects.toThrow(errorDestroyed);
  });
  test('repeated destroy is idempotent', async () => {
    interface X extends CreateDestroy {}
    @CreateDestroy()
    class X {}
    const x = new X();
    await x.destroy();
    await x.destroy();
  });
  test('concurrent destroy is serialised', async () => {
    interface X extends CreateDestroy {}
    @CreateDestroy()
    class X {
      public async destroy(f) {
        await f();
      }
    }
    const x = new X();
    const lock = new Mutex();
    const destroyCallback = jest.fn().mockImplementation(async () => {
      // This will raise E_ALREADY_LOCKED
      // if the lock is already locked
      const release = await tryAcquire(lock).acquire();
      // Sleep to ensure enough time for mutual exclusion
      await testUtils.sleep(100);
      release();
    });
    await expect(
      Promise.all([x.destroy(destroyCallback), x.destroy(destroyCallback)]),
    ).resolves.toEqual([undefined, undefined]);
    expect(destroyCallback.mock.calls.length).toBe(1);
  });
  test('calling methods waiting for destruction', async () => {
    const errorDestroyed = new Error('destroyed');
    interface X extends CreateDestroy {}
    @CreateDestroy()
    class X {
      public async destroy(f?) {
        if (f != null) await f();
      }

      @ready(errorDestroyed, true)
      public doSomethingSync() {}

      @ready(errorDestroyed, true)
      public async doSomethingAsync() {}

      @ready(errorDestroyed, true)
      public *doSomethingGenSync() {}

      @ready(errorDestroyed, true)
      public async *doSomethingGenAsync() {}
    }
    // Behaves as normal
    const x = new X();
    await x.destroy();
    expect(x.doSomethingSync.bind(x)).toThrow(errorDestroyed);
    await expect(x.doSomethingAsync.bind(x)).rejects.toThrow(errorDestroyed);
    expect(() => x.doSomethingGenSync().next()).toThrow(errorDestroyed);
    await expect(
      async () => await x.doSomethingGenAsync().next(),
    ).rejects.toThrow(errorDestroyed);
    await expect(
      (async () => {
        const x = new X();
        const destroy = x.destroy();
        x.doSomethingSync();
        await destroy;
      })(),
    ).rejects.toThrow(errorDestroyed);
    await expect(
      (async () => {
        const x = new X();
        const destroy = x.destroy();
        await x.doSomethingAsync();
        await destroy;
      })(),
    ).rejects.toThrow(errorDestroyed);
    await expect(
      (async () => {
        const x = new X();
        const destroy = x.destroy();
        x.doSomethingGenSync().next();
        await destroy;
      })(),
    ).rejects.toThrow(errorDestroyed);
    await expect(
      (async () => {
        const x = new X();
        const destroy = x.destroy();
        await x.doSomethingGenAsync().next();
        await destroy;
      })(),
    ).rejects.toThrow(errorDestroyed);
    // Failing to destroy will result in success
    // for waiting async operations
    await expect(
      (async () => {
        const x = new X();
        const destroy = x.destroy(async () => {
          throw new Error('failed to destroy');
        });
        const async = x.doSomethingAsync();
        const genAsync = x.doSomethingGenAsync().next();
        try {
          await destroy;
        } catch (e) {
          expect(e).toBeInstanceOf(Error);
        }
        await Promise.all([async, genAsync]);
      })(),
    ).resolves.toBeUndefined();
  });
});
