import { ResBody, UrlCache } from "../cache";
import { CachePullError } from "../error";
import { TimeKeeper } from "../time";
import { FakeTimeKeeper } from './fakeTimeKeeper';

interface PromiseCallback {
  resolve(): void;
  reject(): void;
}

class TestableCache extends UrlCache {
  private pendingPulls: PromiseCallback[] = [];
  testValue: ResBody;
  testPullCount = 0;

  constructor(tk: TimeKeeper) {
    super('test.com', tk);
  }

  // override
  protected async pull() {
    this.testPullCount += 1;
    const promise = new Promise<void>((resolve, reject) => {
      this.pendingPulls.push({ resolve, reject });
    });
    await promise;
    return this.testValue;
  }

  // test methods
  public resolvePull() {
    this.pendingPulls.forEach(cb => cb.resolve());
    this.pendingPulls = [];
  }
  public rejectPull() {
    this.pendingPulls.forEach(cb => cb.reject());
    this.pendingPulls = [];
  }
}

describe('cache', () => {
  const expected1 = 'cached response';
  const expected2 = 'new response';
  let tk: FakeTimeKeeper;
  let cache: TestableCache;
  beforeEach(() => {
    tk = new FakeTimeKeeper();
    cache = new TestableCache(tk);
  });

  test('summary()', async () => {
    expect(cache.summary()).toBeUndefined();

    cache.testValue = expected1;
    const promise1 = cache.get();
    cache.resolvePull();
    await promise1;

    expect(cache.summary()).toStrictEqual({
      value: expected1,
      expiresAt: 0 + cache.TTL,
    });

    const timePassed = cache.TTL * 2;
    tk._increment(timePassed);
    cache.testValue = expected2;
    const promise2 = cache.get();
    cache.resolvePull();
    await promise2;

    expect(cache.summary()).toStrictEqual({
      value: expected2,
      expiresAt: timePassed + cache.TTL,
    });
  });

  test('get() returns result from pull()', async () => {
    cache.testValue = expected1;
    const promise = cache.get();
    cache.resolvePull();
    const result = await promise;
    expect(result).toBe(expected1);
  });

  test('get() caches', async () => {
    expect(cache.testPullCount).toBe(0);

    cache.testValue = expected1;
    const promise1 = cache.get();
    expect(cache.testPullCount).toBe(1);
    cache.resolvePull();
    const result1 = await promise1;
    expect(result1).toBe(expected1);

    cache.testValue = expected2;
    const promise2 = cache.get();
    expect(cache.testPullCount).toBe(1);
    const result2 = await promise2;
    expect(result2).toBe(expected1);
  });

  test('get() cache expires', async () => {
    expect(cache.testPullCount).toBe(0);

    cache.testValue = expected1;
    const promise1 = cache.get();
    expect(cache.testPullCount).toBe(1);
    cache.resolvePull();
    const result1 = await promise1;
    expect(result1).toBe(expected1);

    tk._increment(cache.TTL + 1);

    cache.testValue = expected2;
    const promise2 = cache.get();
    expect(cache.testPullCount).toBe(2);
    cache.resolvePull();
    const result2 = await promise2;
    expect(result2).toBe(expected2);
  });

  test('get() cache locks', async () => {
    expect(cache.testPullCount).toBe(0);

    cache.testValue = expected1;
    const promise1 = cache.get();
    expect(cache.testPullCount).toBe(1);

    const promise2 = cache.get();
    expect(cache.testPullCount).toBe(1);
    const promise3 = cache.get();
    expect(cache.testPullCount).toBe(1);

    cache.resolvePull();
    const result1 = await promise1;
    expect(result1).toBe(expected1);

    // the rest should also resolve from the single pull
    const result2 = await promise2;
    expect(result2).toBe(expected1);
    const result3 = await promise3;
    expect(result3).toBe(expected1);
  });

  test('get() error is thrown', async () => {
    cache.testValue = expected1;
    const promise = cache.get();
    cache.rejectPull();
    await expect(promise).rejects.toThrowError(CachePullError);
  });

  test('get() error does not prevent future requests', async () => {
    cache.testValue = expected1;

    const promise1 = cache.get();
    expect(cache.testPullCount).toBe(1);
    cache.rejectPull();
    await expect(promise1).rejects.toThrowError(CachePullError);

    const promise2 = cache.get();
    expect(cache.testPullCount).toBe(2);
    cache.resolvePull();
    await expect(promise2).resolves.toBe(expected1);
  });

  test('get() error throws all locks', async () => {
    expect(cache.testPullCount).toBe(0);

    cache.testValue = expected1;
    const promise1 = cache.get();
    expect(cache.testPullCount).toBe(1);

    const promise2 = cache.get();
    expect(cache.testPullCount).toBe(1);
    const promise3 = cache.get();
    expect(cache.testPullCount).toBe(1);

    cache.rejectPull();
    await expect(promise1).rejects.toThrowError(CachePullError);

    // the rest should also resolve from the single pull
    await expect(promise2).rejects.toThrowError(CachePullError);
    await expect(promise3).rejects.toThrowError(CachePullError);
  });
});
