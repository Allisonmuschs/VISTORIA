// IndexedDB wrapper. Two stores:
//   inspections: one JSON document per inspection (small, rewritten on every edit)
//   photos:      one record per photo (Blob + metadata); used from step (b)

const DB_NAME = 'vistoria';
const DB_VERSION = 1;
let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains('inspections')) {
          d.createObjectStore('inspections', { keyPath: 'id' });
        }
        if (!d.objectStoreNames.contains('photos')) {
          d.createObjectStore('photos', { keyPath: 'id' }).createIndex('inspectionId', 'inspectionId');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

// Run fn(...stores) inside one transaction; resolves with the last request's result.
function run(storeNames, mode, fn) {
  return open().then(
    (d) =>
      new Promise((resolve, reject) => {
        const t = d.transaction(storeNames, mode);
        const stores = storeNames.map((n) => t.objectStore(n));
        const req = fn(...stores);
        t.oncomplete = () => resolve(req && 'result' in req ? req.result : undefined);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

export const db = {
  list: () => run(['inspections'], 'readonly', (s) => s.getAll()),
  get: (id) => run(['inspections'], 'readonly', (s) => s.get(id)),
  put: (insp) => run(['inspections'], 'readwrite', (s) => s.put(insp)),
  putMany: (list) =>
    run(['inspections'], 'readwrite', (s) => {
      let r;
      for (const x of list) r = s.put(x);
      return r;
    }),

  photos: {
    put: (rec) => run(['photos'], 'readwrite', (s) => s.put(rec)),
    get: (id) => run(['photos'], 'readonly', (s) => s.get(id)),
    byInspection: (inspectionId) => run(['photos'], 'readonly', (s) => s.index('inspectionId').getAll(inspectionId)),
    deleteMany: (ids) =>
      run(['photos'], 'readwrite', (s) => {
        let r;
        for (const id of ids) r = s.delete(id);
        return r;
      }),
  },

  // Deleting an inspection also deletes its photos.
  delete: (id) =>
    run(['inspections', 'photos'], 'readwrite', (insps, photos) => {
      const cur = photos.index('inspectionId').openKeyCursor(IDBKeyRange.only(id));
      cur.onsuccess = () => {
        const c = cur.result;
        if (c) {
          photos.delete(c.primaryKey);
          c.continue();
        }
      };
      return insps.delete(id);
    }),

  clearAll: () =>
    run(['inspections', 'photos'], 'readwrite', (insps, photos) => {
      photos.clear();
      return insps.clear();
    }),
};
