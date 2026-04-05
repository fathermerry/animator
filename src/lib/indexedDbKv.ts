export const DB_NAME = "animator";
export const DB_VERSION = 2;
export const KV_STORE = "kv";
export const PROJECTS_STORE = "projects";

export function openAnimatorDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (ev) => {
      const db = (ev.target as IDBOpenDBRequest).result;
      const from = ev.oldVersion;
      if (from < 1) {
        if (!db.objectStoreNames.contains(KV_STORE)) {
          db.createObjectStore(KV_STORE);
        }
      }
      if (from < 2) {
        if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
          db.createObjectStore(PROJECTS_STORE, { keyPath: "id" });
        }
      }
    };
  });
}

export async function idbKvGet<T>(key: string): Promise<T | undefined> {
  const db = await openAnimatorDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KV_STORE, "readonly");
    const store = tx.objectStore(KV_STORE);
    const r = store.get(key);
    r.onerror = () => reject(r.error);
    r.onsuccess = () => resolve(r.result as T | undefined);
  });
}

export async function idbKvSet(key: string, value: unknown): Promise<void> {
  const db = await openAnimatorDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KV_STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(KV_STORE).put(value, key);
  });
}

export async function idbKvDelete(key: string): Promise<void> {
  const db = await openAnimatorDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KV_STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(KV_STORE).delete(key);
  });
}
