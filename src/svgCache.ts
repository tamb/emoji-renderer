const DEFAULT_MAX_ENTRIES = 128;

export class SvgCache {
  #entries = new Map<string, string>();
  #maxEntries: number;

  constructor(maxEntries = DEFAULT_MAX_ENTRIES) {
    this.#maxEntries = maxEntries;
  }

  get(key: string): string | undefined {
    const value = this.#entries.get(key);
    if (value === undefined) {
      return undefined;
    }

    this.#entries.delete(key);
    this.#entries.set(key, value);
    return value;
  }

  set(key: string, value: string): void {
    if (this.#entries.has(key)) {
      this.#entries.delete(key);
    }

    this.#entries.set(key, value);

    while (this.#entries.size > this.#maxEntries) {
      const oldestKey = this.#entries.keys().next().value;
      if (oldestKey === undefined) {
        break;
      }
      this.#entries.delete(oldestKey);
    }
  }

  clear(): void {
    this.#entries.clear();
  }
}

export const sharedSvgCache = new SvgCache();
