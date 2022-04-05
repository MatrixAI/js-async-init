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
};
