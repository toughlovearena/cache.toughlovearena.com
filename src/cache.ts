import fetch from 'node-fetch';
import { CachePullError } from './error';
import { RealClock, TimeKeeper } from './time';

export type ResBody = any;
interface CacheRecord {
  value: ResBody;
  expiresAt: number;
}
export type CacheSummary = CacheRecord | undefined;

export class UrlCache {
  protected readonly url: string;
  private readonly timeKeeper: TimeKeeper;
  readonly TTL = 60 * 1000; // 1 minute
  private record: CacheRecord | undefined;
  private lock = {
    promise: Promise.resolve(),
    locked: false,
  };

  constructor(url: string, timeKeeper?: TimeKeeper) {
    this.url = url;
    this.timeKeeper = timeKeeper ?? RealClock;
  }

  // protected so test can override
  protected async pull(): Promise<ResBody> {
    const resp = await fetch(this.url);
    const json = await resp.json();
    return json as ResBody;
  }

  async get(): Promise<ResBody> {
    const { lock, timeKeeper } = this;

    // if lock present, wait for the promise
    if (lock.locked) {
      await lock.promise;
    }

    // if record expired, set a lock and pull
    const now = timeKeeper.now();
    if (!this.record || this.record.expiresAt < now) {
      // synchronously set lock for other threads
      lock.locked = true;
      lock.promise = new Promise(async (resolve, reject) => {
        // release the lock once the pull is complete
        try {
          const resp = await this.pull();
          this.record = {
            value: resp,
            expiresAt: now + this.TTL,
          };
          resolve();
          // release future requests
          lock.locked = false;
        } catch (err) {
          // unlock blocked requests
          lock.locked = false;
          reject(new CachePullError(err?.message));
        }
      });

      // wait for the lock to release aka the pull to complete
      await lock.promise;
    }

    // return the cached value
    return this.record.value;
  }
  summary(): CacheSummary {
    return this.record;
  }
}
