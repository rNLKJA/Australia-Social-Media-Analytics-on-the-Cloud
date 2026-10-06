/**
 * The browser-local IndexedDB database behind the AI audit log and the saved
 * benchmark runs. Nothing in it leaves the browser unless the visitor exports it.
 */

const DB_NAME = "social-sense-ai";
const VERSION = 1;
export const AUDIT_STORE = "audit_log";
export const EVAL_STORE = "eval_runs";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this browser"));
      return;
    }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of [AUDIT_STORE, EVAL_STORE]) {
        if (!db.objectStoreNames.contains(name))
          db.createObjectStore(name, { keyPath: "id" }).createIndex("timestamp", "timestamp");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Run one request in a transaction and resolve with its result once the transaction commits. */
export function tx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  return open().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const t = db.transaction(storeName, mode);
        const req = run(t.objectStore(storeName));
        t.oncomplete = () => {
          db.close();
          resolve(req ? req.result : undefined);
        };
        t.onerror = () => {
          db.close();
          reject(t.error);
        };
        t.onabort = () => {
          db.close();
          reject(t.error);
        };
      }),
  );
}
