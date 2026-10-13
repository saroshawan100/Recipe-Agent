const DB_NAME = "pantry-chef";
const DB_VERSION = 1;

export type StoreName = "recipes" | "sessions" | "kv";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("recipes")) db.createObjectStore("recipes", { keyPath: "id" });
      if (!db.objectStoreNames.contains("sessions")) db.createObjectStore("sessions", { keyPath: "id" });
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error ?? new Error("Couldn't open browser storage"));
    };
  });
  return dbPromise;
}

async function run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req ? req.result : (undefined as T));
    tx.onerror = () => reject(tx.error ?? new Error("Browser storage error"));
    tx.onabort = () => reject(tx.error ?? new Error("Browser storage transaction aborted"));
  });
}

export const idb = {
  get: <T>(store: StoreName, key: string) => run<T | undefined>(store, "readonly", (s) => s.get(key)),
  getAll: <T>(store: StoreName) => run<T[]>(store, "readonly", (s) => s.getAll()),
  put: <T>(store: StoreName, value: T, key?: string) =>
    run<IDBValidKey>(store, "readwrite", (s) => s.put(value, key)).then(() => value),
  putMany: <T>(store: StoreName, values: T[]) =>
    run<void>(store, "readwrite", (s) => {
      for (const v of values) s.put(v);
    }),
  deleteMany: (store: StoreName, keys: string[]) =>
    run<void>(store, "readwrite", (s) => {
      for (const k of keys) s.delete(k);
    }),
};
