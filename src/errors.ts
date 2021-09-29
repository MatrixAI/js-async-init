import { CustomError } from 'ts-custom-error';

class ErrorAsyncInit extends CustomError {}

class ErrorAsyncInitRunning extends ErrorAsyncInit {}

class ErrorAsyncInitNotRunning extends ErrorAsyncInit {}

class ErrorAsyncInitDestroyed extends ErrorAsyncInit {}

export {
  ErrorAsyncInit,
  ErrorAsyncInitRunning,
  ErrorAsyncInitNotRunning,
  ErrorAsyncInitDestroyed,
};
