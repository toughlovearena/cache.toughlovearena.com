import { CacheSummary, UrlCache } from "./cache";

export class CacheManager {
  private readonly cacheByUrl: Record<string, UrlCache> = {};

  async get(url: string) {
    const cache = this.cacheByUrl[url] ?? new UrlCache(url);
    this.cacheByUrl[url] = cache;
    return cache.get();
  }
  summary(): Record<string, CacheSummary> {
    const urls = Object.keys(this.cacheByUrl);
    const summaryByUrl = urls.reduce((obj, curr) => {
      obj[curr] = this.cacheByUrl[curr].summary();
      return obj;
    }, {} as Record<string, CacheSummary>);
    return summaryByUrl;
  }
}
