import { CreateDestroyStartStop, ready } from '@/CreateDestroyStartStop';
import {
  ErrorAsyncInitDestroyed,
  ErrorAsyncInitNotRunning,
  ErrorAsyncInitRunning,
} from '@/errors';

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
        startMock();
        return 'hello world';
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
    const x = new X();
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
    const x = new X();
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
  test('start, stop and destroy are idempotent', async () => {
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
});
