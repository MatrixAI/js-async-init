import { AbstractError } from '@matrixai/errors';

class ErrorAsyncInit<T> extends AbstractError<T> {
  static description = 'Async init error';
}

class ErrorAsyncInitRunning<T> extends ErrorAsyncInit<T> {
  static description = 'Async init is running';
}

class ErrorAsyncInitNotRunning<T> extends ErrorAsyncInit<T> {
  static description = 'Async init is not running';
}

class ErrorAsyncInitDestroyed<T> extends ErrorAsyncInit<T> {
  static description = 'Async init is destroyed';
}

export {
  ErrorAsyncInit,
  ErrorAsyncInitRunning,
  ErrorAsyncInitNotRunning,
  ErrorAsyncInitDestroyed,
};
