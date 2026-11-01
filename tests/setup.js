// Polyfill localStorage + sessionStorage for Node.js vitest environments.
// `sessionStorage` dipakai ai.js untuk API key (tidak boleh di localStorage).
const makeStorage = () => {
  const storage = new Map();
  return {
    getItem: (k) => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
    clear: () => storage.clear(),
    get length() { return storage.size; },
    key: (i) => Array.from(storage.keys())[i] ?? null
  };
};

for (const name of ["localStorage", "sessionStorage"]) {
  if (typeof globalThis[name] === "undefined" || typeof globalThis[name].getItem !== "function") {
    const mock = makeStorage();
    try {
      Object.defineProperty(globalThis, name, { value: mock, configurable: true, writable: true });
    } catch {
      globalThis[name] = mock;
    }
  }
}
