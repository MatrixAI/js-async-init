import { Mutex, tryAcquire } from 'async-mutex';
import { StartStop, ready, running, status, initLock } from '@/StartStop';
import {
  EventAsyncInitStart,
  EventAsyncInitStarted,
  EventAsyncInitStop,
  EventAsyncInitStopped,
} from '@/events';
import { ErrorAsyncInitNotRunning } from '@/errors';
import * as testUtils from './utils';

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
        expect(this[status]).toBe('starting');
        startMock();
      }

      public async stop(): Promise<void> {
        expect(this[status]).toBe('stopping');
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
  test('name is preserved', () => {
    interface X extends StartStop {}
    @StartStop()
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
  test('exception name is preserved', async () => {
    interface X extends StartStop {}
    @StartStop()
    class X {
      @ready()
      public doSomethingSync() {}

      @ready(new Error())
      public async doSomethingAsync() {}

      @ready(new ReferenceError('foo'))
      public *doSomethingGenSync() {}

      @ready(new TypeError('abc'))
      public async *doSomethingGenAsync() {}
    }
    const x = new X();
    let e;
    try {
      x.doSomethingSync();
    } catch (e_) {
      e = e_;
    }
    expect(e.name).toBe(ErrorAsyncInitNotRunning.name);
    expect(e.stack!.slice(0, e.stack.indexOf('\n') + 1)).toBe(
      `${e.name}: ${e.message}\n`,
    );
    try {
      await x.doSomethingAsync();
    } catch (e_) {
      e = e_;
    }
    expect(e.name).toBe('Error');
    expect(e.stack!.slice(0, e.stack.indexOf('\n') + 1)).toBe(`Error: \n`);
    try {
      x.doSomethingGenSync().next();
    } catch (e_) {
      e = e_;
    }
    expect(e.name).toBe('ReferenceError');
    expect(e.stack!.slice(0, e.stack.indexOf('\n') + 1)).toBe(
      `ReferenceError: foo\n`,
    );
    try {
      await x.doSomethingGenAsync().next();
    } catch (e_) {
      e = e_;
    }
    expect(e.name).toBe('TypeError');
    expect(e.stack!.slice(0, e.stack.indexOf('\n') + 1)).toBe(
      `TypeError: abc\n`,
    );
  });
  test('symbols do not conflict with existing properties', async () => {
    interface X extends StartStop {}
    @StartStop()
    class X {
      running: string = 'some property';
      initLock: string = 'some lock';
    }
    const x = new X();
    expect(x[running]).not.toBe(x.running);
    expect(x[initLock]).not.toBe(x.initLock);
  });
  test('calling methods throws not running exceptions when not ready', async () => {
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
    // Make it ready!
    await x.start();
    // Idempotently running
    const startP = x.start();
    expect(x.doSomethingSync.bind(x)).not.toThrow(ErrorAsyncInitNotRunning);
    await expect(x.doSomethingAsync.bind(x)()).resolves.toBeUndefined();
    expect(() => x.doSomethingGenSync().next()).not.toThrow(
      ErrorAsyncInitNotRunning,
    );
    await expect(
      (async () => await x.doSomethingGenAsync().next())(),
    ).resolves.toEqual({ done: true, value: undefined });
    await startP;
    // Ready
    x.doSomethingSync();
    await x.doSomethingAsync();
    x.doSomethingGenSync().next();
    await x.doSomethingGenAsync().next();
    expect(doSomethingAsyncMock.mock.calls.length).toBe(2);
    expect(doSomethingSyncMock.mock.calls.length).toBe(2);
    expect(doSomethingGenSyncMock.mock.calls.length).toBe(2);
    expect(doSomethingGenAsyncMock.mock.calls.length).toBe(2);
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
    ).resolves.toBeUndefined();
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
    ).resolves.toBeUndefined();
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
  test('calling getters and setters throws not running exceptions when not ready', async () => {
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
    ).resolves.toBeUndefined();
    await x.start();
    await expect(
      (async () => {
        const stop = x.stop();
        x.b = 10;
        await stop;
      })(),
    ).resolves.toBeUndefined();
    await x.start();
    x.b = 10;
    expect(x.a).toBe('a');
    await x.stop();
  });
  test('custom not running exceptions', async () => {
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
  });
  test('repeated start and repeated stop are idempotent', async () => {
    interface X extends StartStop {}
    @StartStop()
    class X {}
    const x = new X();
    await x.start();
    await x.start();
    await x.stop();
    await x.stop();
  });
  test('concurrent start and concurrent stop are serialised', async () => {
    interface X extends StartStop {}
    @StartStop()
    class X {
      public async start(f) {
        await f();
      }
      public async stop(f) {
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
  });
  test('start then stop and vice versa is serialised', async () => {
    interface X extends StartStop {}
    @StartStop()
    class X {
      public async start(f?) {
        if (f != null) await f();
      }
      public async stop(f?) {
        if (f != null) await f();
      }
    }
    const x = new X();
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
        return [await r1, await r2];
      })(),
    ).resolves.toEqual([undefined, undefined]);
    expect(callback.mock.calls.length).toBe(2);
    callback.mockClear();
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
  });
  test('calling methods blocking ready', async () => {
    const errorNotRunning = new Error('not running');
    interface X extends StartStop {}
    @StartStop()
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
    const x = new X();
    // Behaves similarly to ready when not starting or stopping
    expect(x.doSomethingSync.bind(x)).toThrow(errorNotRunning);
    await expect(x.doSomethingAsync.bind(x)).rejects.toThrow(errorNotRunning);
    expect(() => x.doSomethingGenSync().next()).toThrow(errorNotRunning);
    await expect(
      async () => await x.doSomethingGenAsync().next(),
    ).rejects.toThrow(errorNotRunning);
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
    interface X extends StartStop {}
    @StartStop()
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
  });
  test('calling async blocking methods do not affect non-blocking methods', async () => {
    interface X extends StartStop {}
    @StartStop()
    class X {
      @ready(undefined, true)
      public async doSomethingAsyncBlocking() {
        await testUtils.sleep(100);
      }

      @ready(undefined)
      public async doSomethingAsync() {}

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
        // eslint-disable-next-line no-empty
        for await (const _ of x.doSomethingGenAsync()) {
        }
        await blockingP;
      })(),
    ).resolves.toBeUndefined();
    await expect(
      (async () => {
        for await (const _ of x.doSomethingGenAsyncBlocking()) {
          // eslint-disable-next-line no-empty
          for await (const _ of x.doSomethingGenAsync()) {
          }
          await x.doSomethingAsync();
        }
      })(),
    ).resolves.toBeUndefined();
    await x.stop();
  });
  test('calling generator methods propagate return value', async () => {
    interface X extends StartStop {}
    @StartStop()
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
    expect(gSync.next()).toStrictEqual({ value: 1, done: false });
    expect(gSync.next()).toStrictEqual({ value: 2, done: true });
    const gAsync = x.doSomethingGenAsync();
    expect(await gAsync.next()).toStrictEqual({ value: 3, done: false });
    expect(await gAsync.next()).toStrictEqual({ value: 4, done: true });
    await x.stop();
  });
  test('calling methods with allowed statuses', async () => {
    const doSomethingSyncMock = jest.fn();
    const doSomethingAsyncMock = jest.fn();
    const doSomethingGenSyncMock = jest.fn();
    const doSomethingGenAsyncMock = jest.fn();
    interface X extends StartStop {}
    @StartStop()
    class X {
      public async start(): Promise<Error> {
        this.doSomethingSync();
        // eslint-disable-next-line no-empty
        for (const _ of this.doSomethingGenSync()) {
        }
        try {
          // eslint-disable-next-line no-empty
          for await (const _ of this.doSomethingGenAsync()) {
          }
        } catch (e) {
          return e;
        }
        throw new Error();
      }

      public async stop(): Promise<Error> {
        await this.doSomethingAsync();
        // eslint-disable-next-line no-empty
        for (const _ of this.doSomethingGenSync()) {
        }
        try {
          // eslint-disable-next-line no-empty
          for await (const _ of this.doSomethingGenAsync()) {
          }
        } catch (e) {
          return e;
        }
        throw new Error();
      }

      @ready(undefined, false, ['starting'])
      public doSomethingSync() {
        doSomethingSyncMock();
      }

      @ready(undefined, false, ['stopping'])
      public async doSomethingAsync() {
        doSomethingAsyncMock();
      }

      // The `block` is ignored when the `[status]` matches the `allowedStatuses`
      @ready(undefined, true, ['starting', 'stopping'])
      public *doSomethingGenSync() {
        doSomethingGenSyncMock();
      }

      @ready(undefined, false, [])
      public async *doSomethingGenAsync() {
        doSomethingGenAsyncMock();
      }
    }
    const x = new X();
    expect(await x.start()).toBeInstanceOf(ErrorAsyncInitNotRunning);
    expect(await x.stop()).toBeInstanceOf(ErrorAsyncInitNotRunning);
    expect(doSomethingAsyncMock.mock.calls.length).toBe(1);
    expect(doSomethingSyncMock.mock.calls.length).toBe(1);
    expect(doSomethingGenSyncMock.mock.calls.length).toBe(2);
    expect(doSomethingGenAsyncMock.mock.calls.length).toBe(0);
  });
  test('stop can interrupt concurrent blocking methods', async () => {
    interface X extends StartStop<void, void> {}
    @StartStop<void, void>()
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
  test('start and stop events', async () => {
    const startMock = jest.fn();
    const startedMock = jest.fn();
    const stopMock = jest.fn();
    const stoppedMock = jest.fn();
    interface X extends StartStop {}
    @StartStop()
    class X {}
    const x = new X();
    x.addEventListener(EventAsyncInitStart.name, (e) => {
      expect(e.target).toBe(x);
      expect(x[status]).toBe('starting');
      expect(x[running]).toBeFalse();
      startMock();
    });
    x.addEventListener(EventAsyncInitStarted.name, (e) => {
      expect(e.target).toBe(x);
      expect(x[status]).toBe('starting');
      expect(x[running]).toBeTrue();
      startedMock();
    });
    x.addEventListener(EventAsyncInitStop.name, (e) => {
      expect(e.target).toBe(x);
      expect(x[status]).toBe('stopping');
      expect(x[running]).toBeTrue();
      stopMock();
    });
    x.addEventListener(EventAsyncInitStopped.name, (e) => {
      expect(e.target).toBe(x);
      expect(x[status]).toBe('stopping');
      expect(x[running]).toBeFalse();
      stoppedMock();
    });
    await x.start();
    expect(startMock.mock.calls.length).toBe(1);
    expect(startedMock.mock.calls.length).toBe(1);
    // Idempotent start
    await x.start();
    expect(startMock.mock.calls.length).toBe(1);
    expect(startedMock.mock.calls.length).toBe(1);
    await x.stop();
    expect(stopMock.mock.calls.length).toBe(1);
    expect(stoppedMock.mock.calls.length).toBe(1);
    // Idempotent stop
    await x.stop();
    expect(stopMock.mock.calls.length).toBe(1);
    expect(stoppedMock.mock.calls.length).toBe(1);
  });
});
