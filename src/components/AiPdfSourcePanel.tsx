import React, { useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { CheckCircle2, FileText, Loader2, Upload } from 'lucide-react';
import { CoachPdfDocument, PdfPageContent, User } from '../types';
import { savePdfDocumentContent } from '../data/pdfLibraryStorage';

GlobalWorkerOptions.workerSrc = pdfWorker;

interface AiPdfSourcePanelProps {
  activeUser: User;
  category: string;
  documents: CoachPdfDocument[];
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  onUpdateDocuments: (documents: CoachPdfDocument[]) => void;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024;

export const AiPdfSourcePanel: React.FC<AiPdfSourcePanelProps> = ({
  activeUser,
  category,
  documents,
  selectedIds,
  onSelectedIdsChange,
  onUpdateDocuments
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  const visibleDocuments = documents.filter(document =>
    document.visibility === 'TEAM' || document.uploadedById === activeUser.id
  );

  const upload = async (file?: File) => {
    if (!file || isUploading) return;
    setError('');
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('ניתן להעלות קובצי PDF בלבד.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('גודל הקובץ המרבי הוא 20MB.');
      return;
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const baseDocument: CoachPdfDocument = {
      id,
      title: file.name.replace(/\.pdf$/i, ''),
      fileName: file.name,
      fileSize: file.size,
      pageCount: 0,
      category,
      description: `הועלה מתוך עוזר הבנייה החכם – ${category}`,
      tags: [category, 'AI'],
      visibility: 'TEAM',
      status: 'PROCESSING',
      extractedCharacterCount: 0,
      uploadedAt: now,
      uploadedById: activeUser.id,
      uploadedByName: activeUser.name
    };

    setIsUploading(true);
    onUpdateDocuments([baseDocument, ...documents]);
    try {
      const pdf = await getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      const pages: PdfPageContent[] = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const text = content.items.map(item => ('str' in item ? item.str : '')).join(' ').replace(/\s+/g, ' ').trim();
        pages.push({ pageNumber, text });
      }
      const extractedCharacterCount = pages.reduce((sum, page) => sum + page.text.length, 0);
      await savePdfDocumentContent({ id, blob: file, pages });
      const completed: CoachPdfDocument = {
        ...baseDocument,
        pageCount: pdf.numPages,
        extractedCharacterCount,
        status: extractedCharacterCount >= Math.max(30, pdf.numPages * 10) ? 'READY' : 'NEEDS_OCR'
      };
      onUpdateDocuments([completed, ...documents]);
      if (completed.status === 'READY') onSelectedIdsChange([...new Set([...selectedIds, id])]);
      else setError('הקובץ נשמר, אך לא נמצא בו מספיק טקסט. ייתכן שנדרש OCR.');
    } catch (uploadError) {
      onUpdateDocuments([{ ...baseDocument, status: 'ERROR', errorMessage: uploadError instanceof Error ? uploadError.message : 'שגיאה בעיבוד' }, ...documents]);
      setError('לא ניתן היה לקרוא את קובץ ה־PDF.');
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return <div className="space-y-3">
    <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={event => void upload(event.target.files?.[0])} />
    <button type="button" disabled={isUploading} onClick={() => inputRef.current?.click()} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-amber-400/50 bg-amber-400/10 px-3 text-xs font-black text-amber-200 disabled:opacity-50">
      {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} {isUploading ? 'מעלה ומחלץ תוכן…' : `העלאת PDF – ${category}`}
    </button>
    {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-[10px] leading-5 text-rose-200">{error}</p>}
    <div className="space-y-2">
      {visibleDocuments.map(document => {
        const ready = document.status === 'READY';
        const selected = selectedIds.includes(document.id);
        return <button key={document.id} type="button" disabled={!ready} onClick={() => onSelectedIdsChange(selected ? selectedIds.filter(id => id !== document.id) : [...selectedIds, document.id])} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-right ${selected ? 'border-amber-400 bg-amber-400/10' : 'border-white/10 bg-white/5'} disabled:opacity-45`}>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/5"><FileText size={17} className="text-amber-300" /></span>
          <span className="min-w-0 flex-1"><strong className="block truncate text-xs text-white">{document.title}</strong><small className="mt-1 block text-[9px] text-zinc-400">{document.pageCount || 0} עמודים · {ready ? 'מוכן לשימוש בצ׳אט' : document.status === 'PROCESSING' ? 'בעיבוד' : 'לא זמין לצ׳אט'}</small></span>
          {selected && <CheckCircle2 size={17} className="shrink-0 text-amber-300" />}
        </button>;
      })}
      {visibleDocuments.length === 0 && <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-[11px] text-zinc-500">אין עדיין קובצי PDF. אפשר להעלות קובץ ישירות מכאן.</p>}
    </div>
  </div>;
};
