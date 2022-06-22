import { Mutex, tryAcquire } from 'async-mutex';
import {
  CreateDestroyStartStop,
  ready,
  running,
  destroyed,
  status,
  initLock,
} from '@/CreateDestroyStartStop';
import {
  ErrorAsyncInitDestroyed,
  ErrorAsyncInitNotRunning,
  ErrorAsyncInitRunning,
} from '@/errors';
import * as testUtils from './utils';

describe('CreateDestroyStartStop', () => {
  test('creates, destroys, starts and stops', async () => {
    const createMock = jest.fn();
    const constructorMock = jest.fn();
    const startMock = jest.fn();
    const stopMock = jest.fn();
    const destroyMock = jest.fn();
    const doSomethingMock = jest.fn();
    interface X extends CreateDestroyStartStop {}
    @CreateDestroyStartStop()
    class X {
      public static async createX() {
        createMock();
        const x = new X();
        await x.start();
        return x;
      }

      public constructor() {
        constructorMock();
      }

      public async start(): Promise<string> {
        expect(this[status]).toBe('starting');
        startMock();
        return 'hello world';
      }

      public async stop(): Promise<void> {
        expect(this[status]).toBe('stopping');
        stopMock();
      }

      public async destroy(): Promise<void> {
        expect(this[status]).toBe('destroying');
        destroyMock();
      }

      @ready()
      public async doSomething() {
        doSomethingMock();
      }
    }
    const x = await X.createX();
    await x.start(); // Idiomatically should be a noop
    expect(createMock.mock.calls.length).toBe(1);
    expect(constructorMock.mock.calls.length).toBe(1);
    expect(startMock.mock.calls.length).toBe(1);
    await x.doSomething();
    expect(doSomethingMock.mock.calls.length).toBe(1);
    await x.stop();
    expect(stopMock.mock.calls.length).toBe(1);
    await x.destroy();
    expect(destroyMock.mock.calls.length).toBe(1);
  });
  test('creates, destroys, starts and stops for parent class', async () => {
    const createMock = jest.fn();
    const constructorMock = jest.fn();
    const startMock = jest.fn();
    const stopMock = jest.fn();
    const destroyMock = jest.fn();
    const doSomethingMock = jest.fn();
    // Decorator on parent but not on child
    // decorator cannot be used on both parent and child
    interface X extends CreateDestroyStartStop {}
    @CreateDestroyStartStop()
    class X {
      public static async createX() {
        createMock();
        const x = new X();
        await x.start();
        return x;
      }

      public constructor() {
        constructorMock();
      }

      public async start(): Promise<void> {
        startMock();
      }

      public async stop(): Promise<void> {
        stopMock();
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
        const y = new Y();
        await y.start();
        return y;
      }

      public async destroy(): Promise<void> {
        return await super.destroy();
      }
    }
    const y = await Y.createY();
    await y.start(); // Idiomatically should be a noop
    expect(createMock.mock.calls.length).toBe(1);
    expect(constructorMock.mock.calls.length).toBe(1);
    expect(startMock.mock.calls.length).toBe(1);
    await y.doSomething();
    expect(doSomethingMock.mock.calls.length).toBe(1);
    await y.stop();
    expect(stopMock.mock.calls.length).toBe(1);
    await y.destroy();
    expect(destroyMock.mock.calls.length).toBe(1);
  });
  test('creates, destroys, starts and stops for child class', async () => {
    const createMock = jest.fn();
    const constructorMock = jest.fn();
    const startMock = jest.fn();
    const stopMock = jest.fn();
    const destroyMock = jest.fn();
    const doSomethingMock = jest.fn();
    // Decorator on child but not on parent
    // decorator cannot be used on both parent and child
    class X {
      public static async createX() {
        createMock();
        const x = new X();
        await x.start();
        return x;
      }

      public constructor() {
        constructorMock();
      }

      public async start(): Promise<void> {
        startMock();
      }

      public async stop(): Promise<void> {
        stopMock();
      }

      public async destroy(): Promise<void> {
        destroyMock();
      }

      public async doSomething() {
        doSomethingMock();
      }
    }
    interface Y extends CreateDestroyStartStop {}
    @CreateDestroyStartStop()
    class Y extends X {
      public static async createY() {
        createMock();
        const y = new Y();
        await y.start();
        return y;
      }

      public async start() {
        return await super.start();
      }

      public async stop() {
        return await super.stop();
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
    await y.start(); // Idiomatically should be a noop
    expect(createMock.mock.calls.length).toBe(1);
    expect(constructorMock.mock.calls.length).toBe(1);
    expect(startMock.mock.calls.length).toBe(1);
    await y.doSomething();
    expect(doSomethingMock.mock.calls.length).toBe(1);
    await y.stop();
    expect(stopMock.mock.calls.length).toBe(1);
    await y.destroy();
    expect(destroyMock.mock.calls.length).toBe(1);
  });
  test('creates, destroys, starts and stops for derived abstract class', async () => {
    const createMock = jest.fn();
    const constructorMock = jest.fn();
    const startMock = jest.fn();
    const stopMock = jest.fn();
    const destroyMock = jest.fn();
    const doSomethingMock = jest.fn();
    // Decorator on child but not on parent
    // decorator cannot be used on both parent and child
    abstract class X {
      public constructor() {
        constructorMock();
      }

      public async start(): Promise<void> {
        startMock();
      }

      public async stop(): Promise<void> {
        stopMock();
      }

      public async destroy(): Promise<void> {
        destroyMock();
      }

      public async doSomething() {
        doSomethingMock();
      }
    }
    interface Y extends CreateDestroyStartStop {}
    @CreateDestroyStartStop()
    class Y extends X {
      public static async createY() {
        createMock();
        const y = new Y();
        await y.start();
        return y;
      }

      public async start() {
        return await super.start();
      }

      public async stop() {
        return await super.stop();
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
    await y.start(); // Idiomatically should be a noop
    expect(createMock.mock.calls.length).toBe(1);
    expect(constructorMock.mock.calls.length).toBe(1);
    expect(startMock.mock.calls.length).toBe(1);
    await y.doSomething();
    expect(doSomethingMock.mock.calls.length).toBe(1);
    await y.stop();
    expect(stopMock.mock.calls.length).toBe(1);
    await y.destroy();
    expect(destroyMock.mock.calls.length).toBe(1);
  });
  test('name is preserved', () => {
    interface X extends CreateDestroyStartStop {}
    @CreateDestroyStartStop()
    class X {
      static g() {
        return this.name;
      }
      prop = [this.constructor.name];
      public f() {
        return this.constructor.name;
      }
    }
    const x = new X();
    expect(X.g()).toBe('X');
    expect(x.f()).toBe('X');
    expect(x.prop).toStrictEqual(['X']);
  });
  test('symbols do not conflict with existing properties', async () => {
    interface X extends CreateDestroyStartStop {}
    @CreateDestroyStartStop()
    class X {
      running: string = 'some property';
      destroyed: string = 'another property';
      initLock: string = 'some lock';
    }
    const x = new X();
    expect(x[running]).not.toBe(x.running);
    expect(x[destroyed]).not.toBe(x.destroyed);
    expect(x[initLock]).not.toBe(x.initLock);
  });
  test('calling methods throws running exceptions when not ready', async () => {
    const doSomethingSyncMock = jest.fn();
    const doSomethingAsyncMock = jest.fn();
    const doSomethingGenSyncMock = jest.fn();
    const doSomethingGenAsyncMock = jest.fn();
    interface X extends CreateDestroyStartStop {}
    @CreateDestroyStartStop()
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
    let x = new X();
    // Not ready
    expect(x.doSomethingSync.bind(x)).toThrow(ErrorAsyncInitNotRunning);
    await expect(x.doSomethingAsync.bind(x)).rejects.toThrow(
      ErrorAsyncInitNotRunning,
    );
    expect(() => x.doSomethingGenSync().next()).toThrow(
      ErrorAsyncInitNotRunning,
    );
    await expect(
      async () => await x.doSomethingGenAsync().next(),
    ).rejects.toThrow(ErrorAsyncInitNotRunning);
    await x.start();
    // Ready
    x.doSomethingSync();
    await x.doSomethingAsync();
    x.doSomethingGenSync().next();
    await x.doSomethingGenAsync().next();
    expect(doSomethingAsyncMock.mock.calls.length).toBe(1);
    expect(doSomethingSyncMock.mock.calls.length).toBe(1);
    expect(doSomethingGenSyncMock.mock.calls.length).toBe(1);
    expect(doSomethingGenAsyncMock.mock.calls.length).toBe(1);
    await x.stop();
    // Not ready
    await expect(x.doSomethingAsync.bind(x)).rejects.toThrow(
      ErrorAsyncInitNotRunning,
    );
    expect(x.doSomethingSync.bind(x)).toThrow(ErrorAsyncInitNotRunning);
    expect(() => x.doSomethingGenSync().next()).toThrow(
      ErrorAsyncInitNotRunning,
    );
    await expect(
      async () => await x.doSomethingGenAsync().next(),
    ).rejects.toThrow(ErrorAsyncInitNotRunning);
    await x.destroy();
    // Still not ready!
    await expect(x.doSomethingAsync.bind(x)).rejects.toThrow(
      ErrorAsyncInitNotRunning,
    );
    expect(x.doSomethingSync.bind(x)).toThrow(ErrorAsyncInitNotRunning);
    expect(() => x.doSomethingGenSync().next()).toThrow(
      ErrorAsyncInitNotRunning,
    );
    await expect(
      async () => await x.doSomethingGenAsync().next(),
    ).rejects.toThrow(ErrorAsyncInitNotRunning);
    x = new X();
    // Not ready when in the middle of starting
    await expect(
      (async () => {
        const start = x.start();
        x.doSomethingSync();
        await start;
      })(),
    ).rejects.toThrow(ErrorAsyncInitNotRunning);
    await x.stop();
    await expect(
      (async () => {
        const start = x.start();
        await x.doSomethingAsync();
        await start;
      })(),
    ).rejects.toThrow(ErrorAsyncInitNotRunning);
    await x.stop();
    await expect(
      (async () => {
        const start = x.start();
        x.doSomethingGenSync().next();
        await start;
      })(),
    ).rejects.toThrow(ErrorAsyncInitNotRunning);
    await x.stop();
    await expect(
      (async () => {
        const start = x.start();
        await x.doSomethingGenAsync().next();
        await start;
      })(),
    ).rejects.toThrow(ErrorAsyncInitNotRunning);
    await x.stop();
    // Not ready when in the middle of stopping
    await x.start();
    await expect(
      (async () => {
        const stop = x.stop();
        x.doSomethingSync();
        await stop;
      })(),
    ).rejects.toThrow(ErrorAsyncInitNotRunning);
    await x.start();
    await expect(
      (async () => {
        const stop = x.stop();
        await x.doSomethingAsync();
        await stop;
      })(),
    ).rejects.toThrow(ErrorAsyncInitNotRunning);
    await x.start();
    await expect(
      (async () => {
        const stop = x.stop();
        x.doSomethingGenSync().next();
        await stop;
      })(),
    ).rejects.toThrow(ErrorAsyncInitNotRunning);
    await x.start();
    await expect(
      (async () => {
        const stop = x.stop();
        await x.doSomethingGenAsync().next();
        await stop;
      })(),
    ).rejects.toThrow(ErrorAsyncInitNotRunning);
    await x.stop();
  });
  test('calling getters and setters throws running exceptions when not ready', async () => {
    const aMock = jest.fn();
    const bMock = jest.fn();
    interface X extends CreateDestroyStartStop {}
    @CreateDestroyStartStop()
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
    let x = new X();
    // Not ready
    expect(() => x.a).toThrow(ErrorAsyncInitNotRunning);
    expect(() => {
      x.b = 3;
    }).toThrow(ErrorAsyncInitNotRunning);
    await x.start();
    // Ready
    const b = x.a;
    x.b = b;
    expect(aMock.mock.calls.length).toBe(1);
    expect(bMock.mock.calls.length).toBe(1);
    await x.stop();
    // Not ready
    expect(() => x.a).toThrow(ErrorAsyncInitNotRunning);
    expect(() => {
      x.b = 3;
    }).toThrow(ErrorAsyncInitNotRunning);
    await x.destroy();
    // Still not ready!
    expect(() => x.a).toThrow(ErrorAsyncInitNotRunning);
    expect(() => {
      x.b = 3;
    }).toThrow(ErrorAsyncInitNotRunning);
    x = new X();
    // Getters and setters are synchronous
    // Therefore they can only throw exceptions during starting or stopping
    // During starting
    await expect(
      (async () => {
        const start = x.start();
        x.a;
        await start;
      })(),
    ).rejects.toThrow(ErrorAsyncInitNotRunning);
    await x.stop();
    await expect(
      (async () => {
        const start = x.start();
        x.b = 10;
        await start;
      })(),
    ).rejects.toThrow(ErrorAsyncInitNotRunning);
    await x.stop();
    // During stopping
    await x.start();
    await expect(
      (async () => {
        const stop = x.stop();
        x.a;
        await stop;
      })(),
    ).rejects.toThrow(ErrorAsyncInitNotRunning);
    await x.start();
    await expect(
      (async () => {
        const stop = x.stop();
        x.b = 10;
        await stop;
      })(),
    ).rejects.toThrow(ErrorAsyncInitNotRunning);
    await x.start();
    x.b = 10;
    expect(x.a).toBe('a');
    await x.stop();
  });
  test('custom running, not running and destroyed exceptions', async () => {
    const errorRunning = new Error('running');
    const errorNotRunning = new Error('not running');
    const errorDestroyed = new Error('destroyed');
    interface X extends CreateDestroyStartStop {}
    @CreateDestroyStartStop(errorRunning, errorDestroyed)
    class X {
      @ready(errorNotRunning)
      public doSomethingSync() {}

      @ready(errorNotRunning)
      public async doSomethingAsync() {}

      @ready(errorNotRunning)
      public *doSomethingGenSync() {}

      @ready(errorNotRunning)
      public async *doSomethingGenAsync() {}
    }
    const x = new X();
    expect(x.doSomethingSync.bind(x)).toThrow(errorNotRunning);
    await expect(x.doSomethingAsync.bind(x)).rejects.toThrow(errorNotRunning);
    expect(() => x.doSomethingGenSync().next()).toThrow(errorNotRunning);
    await expect(
      async () => await x.doSomethingGenAsync().next(),
    ).rejects.toThrow(errorNotRunning);
    await x.start();
    await expect(x.destroy.bind(x)).rejects.toThrow(errorRunning);
    await x.stop();
    await x.destroy();
    await expect(x.start.bind(x)).rejects.toThrow(errorDestroyed);
  });
  test('repeated start, stop and destroy are idempotent', async () => {
    interface X extends CreateDestroyStartStop {}
    @CreateDestroyStartStop()
    class X {}
    const x = new X();
    await x.start();
    await x.start();
    await x.stop();
    await x.stop();
    await x.destroy();
    await x.destroy();
  });
  test('cannot destroy while running', async () => {
    interface X extends CreateDestroyStartStop {}
    @CreateDestroyStartStop()
    class X {}
    let x = new X();
    await x.start();
    // Cannot destroy before stop when running
    await expect(x.destroy.bind(x)).rejects.toThrow(ErrorAsyncInitRunning);
    await x.stop();
    await x.destroy();
    // Destroy before start
    x = new X();
    await x.destroy();
    await expect(x.start.bind(x)).rejects.toThrow(ErrorAsyncInitDestroyed);
  });
  test('concurrent start, stop and destroy are serialised', async () => {
    interface X extends CreateDestroyStartStop {}
    @CreateDestroyStartStop()
    class X {
      public async start(f) {
        await f();
      }
      public async stop(f) {
        await f();
      }
      public async destroy(f) {
        await f();
      }
    }
    const x = new X();
    const lock = new Mutex();
    const startCallback = jest.fn().mockImplementation(async () => {
      // This will raise E_ALREADY_LOCKED
      // if the lock is already locked
      const release = await tryAcquire(lock).acquire();
      // Sleep to ensure enough time for mutual exclusion
      await testUtils.sleep(100);
      release();
    });
    await expect(
      Promise.all([x.start(startCallback), x.start(startCallback)]),
    ).resolves.toEqual([undefined, undefined]);
    expect(startCallback.mock.calls.length).toBe(1);
    const stopCallback = jest.fn().mockImplementation(async () => {
      // This will raise E_ALREADY_LOCKED
      // if the lock is already locked
      const release = await tryAcquire(lock).acquire();
      // Sleep to ensure enough time for mutual exclusion
      await testUtils.sleep(100);
      release();
    });
    await expect(
      Promise.all([x.stop(stopCallback), x.stop(stopCallback)]),
    ).resolves.toEqual([undefined, undefined]);
    expect(stopCallback.mock.calls.length).toBe(1);
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
  test('start, stop then destroy and vice versa is serialised', async () => {
    interface X extends CreateDestroyStartStop {}
    @CreateDestroyStartStop()
    class X {
      public async start(f?) {
        if (f != null) await f();
      }
      public async stop(f?) {
        if (f != null) await f();
      }
      public async destroy(f?) {
        if (f != null) await f();
      }
    }
    let x = new X();
    const lock = new Mutex();
    const callback = jest.fn().mockImplementation(async () => {
      // This will raise E_ALREADY_LOCKED
      // if the lock is already locked
      const release = await tryAcquire(lock).acquire();
      // Sleep to ensure enough time for mutual exclusion
      await testUtils.sleep(100);
      release();
    });
    await expect(
      (async () => {
        const r1 = x.start(callback);
        const r2 = x.stop(callback);
        const r3 = x.destroy(callback);
        return [await r1, await r2, await r3];
      })(),
    ).resolves.toEqual([undefined, undefined, undefined]);
    expect(callback.mock.calls.length).toBe(3);
    callback.mockClear();
    x = new X();
    await x.start();
    await expect(
      (async () => {
        const r1 = x.stop(callback);
        const r2 = x.start(callback);
        return [await r1, await r2];
      })(),
    ).resolves.toEqual([undefined, undefined]);
    expect(callback.mock.calls.length).toBe(2);
    await x.stop();
    x = new X();
    await x.start();
    await expect(
      (async () => {
        const r1 = x.stop(callback);
        const r2 = x.destroy(callback);
        return [await r1, await r2];
      })(),
    ).resolves.toEqual([undefined, undefined]);
  });
  test('calling methods blocking ready', async () => {
    const errorNotRunning = new Error('not running');
    interface X extends CreateDestroyStartStop {}
    @CreateDestroyStartStop()
    class X {
      @ready(errorNotRunning, true)
      public doSomethingSync() {}

      @ready(errorNotRunning, true)
      public async doSomethingAsync() {}

      @ready(errorNotRunning, true)
      public *doSomethingGenSync() {}

      @ready(errorNotRunning, true)
      public async *doSomethingGenAsync() {}
    }
    let x = new X();
    // Behaves similarly to ready when not starting or stopping
    expect(x.doSomethingSync.bind(x)).toThrow(errorNotRunning);
    await expect(x.doSomethingAsync.bind(x)).rejects.toThrow(errorNotRunning);
    expect(() => x.doSomethingGenSync().next()).toThrow(errorNotRunning);
    await expect(
      async () => await x.doSomethingGenAsync().next(),
    ).rejects.toThrow(errorNotRunning);
    await x.start();
    await expect(x.destroy.bind(x)).rejects.toThrow(ErrorAsyncInitRunning);
    await x.stop();
    await x.destroy();
    await expect(x.start.bind(x)).rejects.toThrow(ErrorAsyncInitDestroyed);
    x = new X();
    // Synchronous cannot wait, they will throw exception
    await expect(
      (async () => {
        const start = x.start();
        x.doSomethingSync();
        await start;
      })(),
    ).rejects.toThrow(errorNotRunning);
    await x.stop();
    // Asynchronous will wait
    await expect(
      (async () => {
        const start = x.start();
        await x.doSomethingAsync();
        await start;
      })(),
    ).resolves.toBeUndefined();
    await x.stop();
    // Synchronous cannot wait, they will throw exception
    await expect(
      (async () => {
        const start = x.start();
        x.doSomethingGenSync().next();
        await start;
      })(),
    ).rejects.toThrow(errorNotRunning);
    await x.stop();
    // Asynchronous will wait
    await expect(
      (async () => {
        const start = x.start();
        await x.doSomethingGenAsync().next();
        await start;
      })(),
    ).resolves.toBeUndefined();
    await x.stop();
  });
  test('calling async blocking methods do not block each other', async () => {
    interface X extends CreateDestroyStartStop {}
    @CreateDestroyStartStop()
    class X {
      @ready(undefined, true)
      public async doSomethingAsync1(end: boolean = false) {
        if (end) {
          expect(this[initLock].readerCount).toBe(5);
          expect(this[initLock].writerCount).toBe(0);
          return 'hello world';
        } else {
          expect(this[initLock].readerCount).toBe(1);
          expect(this[initLock].writerCount).toBe(0);
          return await this.doSomethingAsync2();
        }
      }

      @ready(undefined, true)
      public async doSomethingAsync2() {
        expect(this[initLock].readerCount).toBe(2);
        expect(this[initLock].writerCount).toBe(0);
        let result = '';
        for await (const v of this.doSomethingGenAsync1()) {
          result += v;
        }
        return result;
      }

      @ready(undefined, true)
      public async *doSomethingGenAsync1() {
        expect(this[initLock].readerCount).toBe(3);
        expect(this[initLock].writerCount).toBe(0);
        yield* this.doSomethingGenAsync2();
      }

      @ready(undefined, true)
      public async *doSomethingGenAsync2() {
        expect(this[initLock].readerCount).toBe(4);
        expect(this[initLock].writerCount).toBe(0);
        const s = await this.doSomethingAsync1(true);
        for (const c of s) {
          yield c;
        }
      }
    }
    const x = new X();
    await x.start();
    expect(await x.doSomethingAsync1()).toBe('hello world');
    expect(x[initLock].readerCount).toBe(0);
    expect(x[initLock].writerCount).toBe(0);
    await x.stop();
    await x.destroy();
  });
  test('calling async blocking methods do not affect non-blocking methods', async () => {
    interface X extends CreateDestroyStartStop {}
    @CreateDestroyStartStop()
    class X {
      @ready(undefined, true)
      public async doSomethingAsyncBlocking() {
        await testUtils.sleep(100);
      }

      @ready(undefined)
      public async doSomethingAsync() {
      }

      @ready(undefined, true)
      public async *doSomethingGenAsyncBlocking() {
        await testUtils.sleep(100);
        yield 1;
        await testUtils.sleep(100);
        yield 2;
      }

      @ready(undefined)
      public async *doSomethingGenAsync() {
        yield 1;
        yield 2;
      }
    }
    const x = new X();
    await x.start();
    await expect(
      (async () => {
        const blockingP = x.doSomethingAsyncBlocking();
        await x.doSomethingAsync();
        for await (const _ of x.doSomethingGenAsync()) { }
        await blockingP;
      })()
    ).resolves.toBeUndefined();
    await expect((async () => {
      for await (const _ of x.doSomethingGenAsyncBlocking()) {
        for await (const _ of x.doSomethingGenAsync()) { }
        await x.doSomethingAsync();
      }
    })()).resolves.toBeUndefined();
    await x.stop();
    await x.destroy();
  });
  test('calling generator methods propagate return value', async () => {
    interface X extends CreateDestroyStartStop {}
    @CreateDestroyStartStop()
    class X {
      @ready(undefined)
      public *doSomethingGenSync() {
        yield 1;
        return 2;
      }

      @ready(undefined)
      public async *doSomethingGenAsync() {
        yield 3;
        return 4;
      }
    }
    const x = new X();
    await x.start();
    const gSync = x.doSomethingGenSync();
    expect(gSync.next()).toStrictEqual({ value: 1, done: false});
    expect(gSync.next()).toStrictEqual({ value: 2, done: true});
    const gAsync = x.doSomethingGenAsync();
    expect(await gAsync.next()).toStrictEqual({ value: 3, done: false});
    expect(await gAsync.next()).toStrictEqual({ value: 4, done: true});
    await x.stop();
    await x.destroy();
  });
  test('stop can interrupt concurrent blocking methods', async () => {
    interface X extends CreateDestroyStartStop<void, void> {}
    @CreateDestroyStartStop<void, void>()
    class X {
      @ready(undefined, true)
      public async doSomethingAsync() {}
    }
    const x = new X();
    await x.start();
    const ops: Array<Promise<void>> = [];
    for (let i = 0; i < 10; i++) {
      ops.push(x.doSomethingAsync());
      if (i === 4) {
        // Halfway point call stop
        ops.push(x.stop());
      }
    }
    const results = await Promise.allSettled(ops);
    // 5 ops are fulfilled
    expect(results.slice(0, 5).every((v) => v.status === 'fulfilled')).toBe(
      true,
    );
    // 6th op is the stop op
    expect(results[5].status).toBe('fulfilled');
    // 5 ops are rejected
    expect(results.slice(6).every((v) => v.status === 'rejected')).toBe(true);
  });
});
