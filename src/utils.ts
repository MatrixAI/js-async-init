const AsyncFunction = (async () => {}).constructor;
const GeneratorFunction = function* () {}.constructor;
const AsyncGeneratorFunction = async function* () {}.constructor;

export { AsyncFunction, GeneratorFunction, AsyncGeneratorFunction };
