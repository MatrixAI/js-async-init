import * as utils from '@/utils';

describe('utils', () => {
  test('RWLock is write-preferring', async () => {
    const results: Array<string> = [];
    const lock = new utils.RWLock();
    const l1 = lock.withRead(async () => {
      results.push('read1');
    });
    const l2 = lock.withRead(async () => {
      results.push('read2');
    });
    const l3 = lock.withWrite(async () => {
      results.push('write1');
    });
    const l4 = lock.withRead(async () => {
      results.push('read3');
    });
    const l5 = lock.withRead(async () => {
      results.push('read4');
    });
    const l6 = lock.withWrite(async () => {
      results.push('write2');
    });
    await l1;
    await l2;
    await l3;
    await l4;
    await l5;
    await l6;
    expect(results).toStrictEqual([
      'read2',
      'read1',
      'write1',
      'read4',
      'read3',
      'write2',
    ]);
  });
});
