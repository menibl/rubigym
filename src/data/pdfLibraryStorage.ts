import { PdfPageContent } from '../types';

const DATABASE_NAME = 'baly_pdf_library_v1';
const STORE_NAME = 'documents';

export interface StoredPdfDocumentContent {
  id: string;
  blob: Blob;
  pages: PdfPageContent[];
}

const openDatabase = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(DATABASE_NAME, 1);

  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(STORE_NAME)) {
      database.createObjectStore(STORE_NAME, { keyPath: 'id' });
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error('לא ניתן לפתוח את מאגר קובצי ה-PDF'));
});

const runRequest = async <T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> => {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = action(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('פעולת האחסון נכשלה'));
      transaction.onerror = () => reject(transaction.error ?? new Error('פעולת האחסון נכשלה'));
    });
  } finally {
    database.close();
  }
};

export const savePdfDocumentContent = (content: StoredPdfDocumentContent) =>
  runRequest<IDBValidKey>('readwrite', store => store.put(content));

export const getPdfDocumentContent = (id: string) =>
  runRequest<StoredPdfDocumentContent | undefined>('readonly', store => store.get(id));

export const deletePdfDocumentContent = (id: string) =>
  runRequest<undefined>('readwrite', store => store.delete(id));
