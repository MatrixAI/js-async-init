import type { MutexInterface } from 'async-mutex';
import { Mutex } from 'async-mutex';

/**
 * Symbols prevents name clashes with decorated classes
 */
const _running = Symbol('_running');
const running = Symbol('running');
const _destroyed = Symbol('_destroyed');
const destroyed = Symbol('destroyed');
const initLock = Symbol('initLock');

class RWLock {
  protected _readerCount: number = 0;
  protected _writerCount: number = 0;
  protected lock: Mutex = new Mutex();
  protected release: MutexInterface.Releaser;

  public get readerCount(): number {
    return this._readerCount;
  }

  public get writerCount(): number {
    return this._writerCount;
  }

  public async read<T>(f: () => Promise<T>): Promise<T> {
    let readerCount = ++this._readerCount;
    // The first reader locks
    if (readerCount === 1) {
      this.release = await this.lock.acquire();
    }
    try {
      return await f();
    } finally {
      readerCount = --this._readerCount;
      // The last reader unlocks
      if (readerCount === 0) {
        this.release();
      }
    }
  }

  public async write<T>(f: () => Promise<T>): Promise<T> {
    this.release = await this.lock.acquire();
    ++this._writerCount;
    try {
      return await f();
    } finally {
      --this._writerCount;
      this.release();
    }
  }

  public async acquireRead(): Promise<() => void> {
    const readerCount = ++this._readerCount;
    // The first reader locks
    if (readerCount === 1) {
      this.release = await this.lock.acquire();
    }
    return () => {
      const readerCount = --this._readerCount;
      // The last reader unlocks
      if (readerCount === 0) {
        this.release();
      }
    };
  }

  public async acquireWrite(): Promise<() => void> {
    this.release = await this.lock.acquire();
    ++this._writerCount;
    return () => {
      --this._writerCount;
      this.release();
    };
  }

  public isLocked(): boolean {
    return this.lock.isLocked();
  }

  public async waitForUnlock(): Promise<void> {
    return this.lock.waitForUnlock();
  }
}

const AsyncFunction = (async () => {}).constructor;
const GeneratorFunction = function* () {}.constructor;
const AsyncGeneratorFunction = async function* () {}.constructor;

export {
  _running,
  running,
  _destroyed,
  destroyed,
  initLock,
  RWLock,
  AsyncFunction,
  GeneratorFunction,
  AsyncGeneratorFunction,
};
