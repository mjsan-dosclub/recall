export type LocalClip = { id: string; ownerId: string; blob: Blob; recordedAt: string; language: 'en' | 'ta' };
const DB_NAME = 'recall-local-audio';
const STORE = 'clips';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveLocalClip(clip: LocalClip): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store=tx.objectStore(STORE);
      const existing=store.getAll();
      existing.onsuccess=()=>{
        for(const previous of existing.result as LocalClip[])if(previous.ownerId===clip.ownerId)store.delete(previous.id);
        store.put(clip);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

export async function getLatestLocalClip(ownerId: string): Promise<LocalClip | undefined> {
  const db=await openDb();
  try {
    return await new Promise((resolve,reject)=>{
      const request=db.transaction(STORE,'readonly').objectStore(STORE).getAll();
      request.onsuccess=()=>resolve((request.result as LocalClip[]).filter(clip=>clip.ownerId===ownerId).sort((a,b)=>b.recordedAt.localeCompare(a.recordedAt))[0]);
      request.onerror=()=>reject(request.error);
    });
  } finally {db.close()}
}

export async function getLocalClip(id: string): Promise<LocalClip | undefined> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
      request.onsuccess = () => resolve(request.result as LocalClip | undefined);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}
