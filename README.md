# js-async-init

[![pipeline status](https://gitlab.com/MatrixAI/open-source/js-async-init/badges/master/pipeline.svg)](https://gitlab.com/MatrixAI/open-source/js-async-init/commits/master)

Asynchronous initialisation and deinitilisation decorators for JavaScript/TypeScript applications.

Because decorators are experimental, you must enable: `"experimentalDecorators": true` in your `tsconfig.json` to use this library.

Example Usage:

```ts
import { CreateDestroyStartStop, ready } from '@matrixai/async-init/dist/CreateDestroyStartStop';

// this hack is necessary to ensure that X's type is decorated
interface X extends CreateDestroyStartStop {};
@CreateDestroyStartStop(new Error('Running'), new Error('Destroyed'))
class X {
  protected y: Y;

  public static async createX(
    {
      y
    }: {
      y?: Y
    } = {}
  ) {
    y = y ?? await Y.createY();
    const x = new X({ y });
    await x.start();
    return x;
  }

  public constructor ({ y }: { y: Y }) {
    this.y = y;
  }

  public async start(): Promise<void> {
    await this.y.start();
    console.log('X started');
  }

  public async stop(): Promise<void> {
    await this.y.stop();
    console.log('X stopped');
  }

  public async destroy(): Promise<void> {
    await this.y.destroy();
    console.log('X destroyed');
  }

  @ready(new Error('Not Running'))
  public async doSomething() {
    await this.y.doSomething();
    console.log('X did something');
  }
}

// this hack is necessary to ensure that Y's type is decorated
interface Y extends CreateDestroyStartStop {};
@CreateDestroyStartStop(new Error('Running'), new Error('Destroyed'))
class Y {
  public static async createY() {
    return new Y;
  }

  public constructor () {
  }

  public async destroy(): Promise<void> {
    console.log('Y destroyed');
  }

  @ready(new Error('Not Running'))
  public async doSomething(): Promise<void> {
    console.log('Y did something');
  }
}

async function main () {
  const x = await X.createX();
  await x.doSomething();
  await x.stop();
  await x.destroy();
  console.log(x);
}

main();
```

Note that it is unsafe to call the create, destroy, start and stop methods concurrently with other method calls. There is no concurrency control. Instead a simple method of making the methods idempotent is used.

Refer to https://gist.github.com/CMCDragonkai/1dbf5069d9efc11585c27cc774271584 for further the motivation of this library.

## Installation

```sh
npm install --save @matrixai/async-init
```

## Development

Run `nix-shell`, and once you're inside, you can use:

```sh
# install (or reinstall packages from package.json)
npm install
# build the dist
npm run build
# run the repl (this allows you to import from ./src)
npm run ts-node
# run the tests
npm run test
# lint the source code
npm run lint
# automatically fix the source
npm run lintfix
```

### Docs Generation

```sh
npm run docs
```

See the docs at: https://matrixai.github.io/js-async-init/

### Publishing

```sh
# npm login
npm version patch # major/minor/patch
npm run build
npm publish --access public
git push
git push --tags
```
