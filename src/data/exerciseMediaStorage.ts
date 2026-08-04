const DATABASE_NAME = 'baly_exercise_media_v1';
const STORE_NAME = 'media';

interface StoredExerciseMedia {
  id: string;
  blob: Blob;
}

const openDatabase = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(DATABASE_NAME, 1);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE_NAME)) {
      request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error('לא ניתן לפתוח את מאגר המדיה'));
});

const runRequest = async <T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = action(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('פעולת המדיה נכשלה'));
    });
  } finally {
    database.close();
  }
};

export const saveExerciseMedia = (id: string, blob: Blob) =>
  runRequest<IDBValidKey>('readwrite', store => store.put({ id, blob } satisfies StoredExerciseMedia));

export const getExerciseMedia = (id: string) =>
  runRequest<StoredExerciseMedia | undefined>('readonly', store => store.get(id));

export const deleteExerciseMedia = (id: string) =>
  runRequest<undefined>('readwrite', store => store.delete(id));
