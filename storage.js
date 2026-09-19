const DB_NAME = "pixelmark-cv-builder";
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("drafts")) {
        const store = db.createObjectStore("drafts", { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
      }
      if (!db.objectStoreNames.contains("files")) {
        const store = db.createObjectStore("files", { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
      if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings", { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function tx(storeName, mode, callback) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    let result;
    try { result = callback(store); } catch (e) { reject(e); return; }
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
  });
}

async function saveDraft(draft) {
  const value = structuredClone(draft);
  value.updatedAt = new Date().toISOString();
  return tx("drafts", "readwrite", store => store.put(value));
}
async function getDraft(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction("drafts").objectStore("drafts").get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
async function listDrafts() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction("drafts").objectStore("drafts").index("updatedAt").getAll();
    req.onsuccess = () => resolve((req.result || []).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)));
    req.onerror = () => reject(req.error);
  });
}
async function deleteDraft(id) { return tx("drafts", "readwrite", store => store.delete(id)); }

async function saveFileRecord(record) {
  return tx("files", "readwrite", store => store.put(record));
}
async function listFiles() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction("files").objectStore("files").index("createdAt").getAll();
    req.onsuccess = () => resolve((req.result || []).sort((a,b) => b.createdAt.localeCompare(a.createdAt)));
    req.onerror = () => reject(req.error);
  });
}
async function getFileRecord(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction("files").objectStore("files").get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
async function deleteFileRecord(id) { return tx("files", "readwrite", store => store.delete(id)); }

async function saveSetting(key, value) {
  return tx("settings", "readwrite", store => store.put({ key, value }));
}
async function getSetting(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction("settings").objectStore("settings").get(key);
    req.onsuccess = () => resolve(req.result?.value);
    req.onerror = () => reject(req.error);
  });
}
window.PixelStorage={saveDraft,getDraft,listDrafts,deleteDraft,saveFileRecord,listFiles,getFileRecord,deleteFileRecord,saveSetting,getSetting};
