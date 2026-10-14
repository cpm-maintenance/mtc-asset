// Polyfill localStorage for Node.js 26+ vitest environments
if (typeof globalThis.localStorage === "undefined" || typeof globalThis.localStorage.getItem !== "function") {
  const storage = new Map();
  const mock = {
    getItem: (k) => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
    clear: () => storage.clear(),
    get length() { return storage.size; },
    key: (i) => Array.from(storage.keys())[i] ?? null
  };
  try {
    Object.defineProperty(globalThis, "localStorage", { value: mock, configurable: true, writable: true });
  } catch (_e) {
    globalThis.localStorage = mock;
  }
}
