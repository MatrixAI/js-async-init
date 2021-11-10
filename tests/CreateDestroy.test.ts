import { CreateDestroy, ready } from '@/CreateDestroy';
import { ErrorAsyncInitDestroyed } from '@/errors';

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
  test('calling methods throws running exceptions when not ready', async () => {
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
  test('destroy is idempotent', async () => {
    interface X extends CreateDestroy {}
    @CreateDestroy()
    class X {}
    const x = new X();
    await x.destroy();
    await x.destroy();
  });
});
