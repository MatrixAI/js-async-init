/**
 * Symbols prevents name clashes with decorated classes
 */
const _running = Symbol('_running');
const running = Symbol('running');
const _destroyed = Symbol('_destroyed');
const destroyed = Symbol('destroyed');
const _status = Symbol('_status');
const status = Symbol('status');
const initLock = Symbol('initLock');

const AsyncFunction = (async () => {}).constructor;
const GeneratorFunction = function* () {}.constructor;
const AsyncGeneratorFunction = async function* () {}.constructor;

const hasCaptureStackTrace = 'captureStackTrace' in Error;

/**
 * Ready wrappers take exception objects
 * JS exception traces are created when the exception is instantiated
 * This function rewrites the stack trace according to where the wrapped
 * function is called, giving a more useful stack trace
 */
// eslint-disable-next-line @typescript-eslint/ban-types
function resetStackTrace(error: Error, decorated?: Function): void {
  if (error.stack != null) {
    const stackTitle = error.stack.slice(0, error.stack.indexOf('\n') + 1);
    if (hasCaptureStackTrace) {
      // Only available on v8
      // This will start the trace where the decorated function is called
      Error.captureStackTrace(error, decorated);
    } else {
      // Non-V8 systems have to do with just a normal stack
      // it is bit more noisy
      error.stack = new Error().stack ?? '';
    }
    error.stack = error.stack.replace(/[^\n]+\n/, stackTitle);
  }
}

export {
  _running,
  running,
  _destroyed,
  destroyed,
  _status,
  status,
  initLock,
  AsyncFunction,
  GeneratorFunction,
  AsyncGeneratorFunction,
  hasCaptureStackTrace,
  resetStackTrace,
};
