import { StartStop, ready } from '@/StartStop';
import { ErrorAsyncInitNotRunning } from '@/errors';

describe('StartStop', () => {
  test('starts and stops', async () => {
    const constructorMock = jest.fn();
    const startMock = jest.fn();
    const stopMock = jest.fn();
    const doSomethingMock = jest.fn();
    interface X extends StartStop {}
    @StartStop()
    class X {
      public constructor() {
        constructorMock();
      }

      public async start(): Promise<void> {
        startMock();
      }

      public async stop(): Promise<void> {
        stopMock();
      }

      @ready()
      public async doSomething() {
        doSomethingMock();
      }
    }
    const x = new X();
    expect(constructorMock.mock.calls.length).toBe(1);
    await x.start();
    expect(startMock.mock.calls.length).toBe(1);
    await x.doSomething();
    expect(doSomethingMock.mock.calls.length).toBe(1);
    await x.stop();
    expect(stopMock.mock.calls.length).toBe(1);
  });
  test('calling methods throws running exceptions when not ready', async () => {
    const doSomethingSyncMock = jest.fn();
    const doSomethingAsyncMock = jest.fn();
    const doSomethingGenSyncMock = jest.fn();
    const doSomethingGenAsyncMock = jest.fn();
    interface X extends StartStop {}
    @StartStop()
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
  });
  test('calling getters and setters throws running exceptions when not ready', async () => {
    const aMock = jest.fn();
    const bMock = jest.fn();
    interface X extends StartStop {}
    @StartStop()
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
  });
  test('custom running, not running and destroyed exceptions', async () => {
    const errorNotRunning = new Error('not running');
    interface X extends StartStop {}
    @StartStop()
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
    await x.stop();
  });
  test('start, stop  are idempotent', async () => {
    interface X extends StartStop {}
    @StartStop()
    class X {}
    const x = new X();
    await x.start();
    await x.start();
    await x.stop();
    await x.stop();
  });
});
