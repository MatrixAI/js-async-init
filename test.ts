import CreateDestroyStartStop, { ready } from './src/CreateDestroyStartStop';

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
