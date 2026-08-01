import React, { useMemo, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  FileText,
  Loader2,
  Lock,
  Search,
  Trash2,
  Upload,
  Users
} from 'lucide-react';
import { CoachPdfDocument, CoachPdfVisibility, PdfPageContent, User } from '../types';
import {
  deletePdfDocumentContent,
  getPdfDocumentContent,
  savePdfDocumentContent
} from '../data/pdfLibraryStorage';

GlobalWorkerOptions.workerSrc = pdfWorker;

interface CoachPdfLibraryPanelProps {
  activeUser: User;
  documents: CoachPdfDocument[];
  onUpdateDocuments: (documents: CoachPdfDocument[]) => void;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024;

const formatFileSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const statusDetails = {
  PROCESSING: { label: 'מעבד את הקובץ', className: 'bg-sky-50 text-sky-700 border-sky-200' },
  READY: { label: 'מוכן לצ׳אט', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  NEEDS_OCR: { label: 'נדרש OCR', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  ERROR: { label: 'שגיאה בעיבוד', className: 'bg-red-50 text-red-700 border-red-200' }
} as const;

export const CoachPdfLibraryPanel: React.FC<CoachPdfLibraryPanelProps> = ({
  activeUser,
  documents,
  onUpdateDocuments
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('תוכניות אימון');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [visibility, setVisibility] = useState<CoachPdfVisibility>('TEAM');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isUploading, setIsUploading] = useState(false);
  const [formError, setFormError] = useState('');
  const [preview, setPreview] = useState<{ document: CoachPdfDocument; pages: PdfPageContent[] } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const visibleDocuments = useMemo(() => documents.filter(document =>
    document.visibility === 'TEAM' || document.uploadedById === activeUser.id
  ), [activeUser.id, documents]);

  const filteredDocuments = useMemo(() => visibleDocuments.filter(document => {
    const haystack = [document.title, document.fileName, document.category, document.description, ...document.tags]
      .join(' ')
      .toLowerCase();
    return haystack.includes(searchTerm.trim().toLowerCase())
      && (statusFilter === 'ALL' || document.status === statusFilter);
  }), [searchTerm, statusFilter, visibleDocuments]);

  const resetForm = () => {
    setSelectedFile(null);
    setTitle('');
    setDescription('');
    setTags('');
    setFormError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileSelected = (file?: File) => {
    setFormError('');
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setFormError('ניתן להעלות קובצי PDF בלבד.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setFormError('גודל הקובץ המרבי בגרסת ההדגמה הוא 20MB.');
      return;
    }
    setSelectedFile(file);
    setTitle(file.name.replace(/\.pdf$/i, ''));
  };

  const handleUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedFile || !title.trim() || isUploading) return;

    const id = crypto.randomUUID();
    const baseDocument: CoachPdfDocument = {
      id,
      title: title.trim(),
      fileName: selectedFile.name,
      fileSize: selectedFile.size,
      pageCount: 0,
      category,
      description: description.trim(),
      tags: tags.split(',').map(tag => tag.trim()).filter(Boolean),
      visibility,
      status: 'PROCESSING',
      extractedCharacterCount: 0,
      uploadedAt: new Date().toISOString(),
      uploadedById: activeUser.id,
      uploadedByName: activeUser.name
    };

    setIsUploading(true);
    setFormError('');
    onUpdateDocuments([baseDocument, ...documents]);

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      const pages: PdfPageContent[] = [];

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const text = content.items
          .map(item => ('str' in item ? item.str : ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        pages.push({ pageNumber, text });
      }

      const extractedCharacterCount = pages.reduce((sum, page) => sum + page.text.length, 0);
      await savePdfDocumentContent({ id, blob: selectedFile, pages });
      const completedDocument: CoachPdfDocument = {
        ...baseDocument,
        pageCount: pdf.numPages,
        extractedCharacterCount,
        status: extractedCharacterCount >= Math.max(30, pdf.numPages * 10) ? 'READY' : 'NEEDS_OCR'
      };
      onUpdateDocuments([completedDocument, ...documents]);
      resetForm();
    } catch (error) {
      const failedDocument: CoachPdfDocument = {
        ...baseDocument,
        status: 'ERROR',
        errorMessage: error instanceof Error ? error.message : 'לא ניתן לעבד את הקובץ'
      };
      onUpdateDocuments([failedDocument, ...documents]);
      setFormError('הקובץ נשמר ברשימה, אך לא ניתן היה לחלץ ממנו תוכן.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleOpenSource = async (document: CoachPdfDocument) => {
    const content = await getPdfDocumentContent(document.id);
    if (!content) {
      window.alert('הקובץ אינו שמור במכשיר הזה. בגרסת השרת הוא יהיה זמין לכל הצוות.');
      return;
    }
    const url = URL.createObjectURL(content.blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const handlePreviewText = async (document: CoachPdfDocument) => {
    setIsLoadingPreview(true);
    try {
      const content = await getPdfDocumentContent(document.id);
      if (!content) {
        window.alert('התוכן אינו שמור במכשיר הזה.');
        return;
      }
      setPreview({ document, pages: content.pages });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleDelete = async (document: CoachPdfDocument) => {
    if (!window.confirm(`למחוק את “${document.title}” מספריית המקורות?`)) return;
    await deletePdfDocumentContent(document.id).catch(() => undefined);
    onUpdateDocuments(documents.filter(item => item.id !== document.id));
  };

  return (
    <section className="space-y-6" dir="rtl">
      <div className="rounded-2xl bg-gradient-to-l from-slate-900 to-slate-800 p-5 text-white shadow-lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-amber-300">
              <FileText size={20} />
              <span className="text-sm font-extrabold">מאגר הידע המקצועי</span>
            </div>
            <h2 className="text-2xl font-black">ספריית PDF למאמנים</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              העלו אימונים קיימים, תייגו אותם והפכו אותם למקורות שעליהם יתבסס הצ׳אט בבניית תוכנית למתאמן.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
            <strong className="block text-lg text-white">{visibleDocuments.filter(item => item.status === 'READY').length}</strong>
            מקורות מוכנים לצ׳אט
          </div>
        </div>
      </div>

      <form onSubmit={handleUpload} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Upload className="text-sky-600" size={20} />
          <h3 className="text-lg font-black text-slate-900">העלאת מקור חדש</h3>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center transition hover:border-sky-400 hover:bg-sky-50">
            <Upload className="mb-2 text-slate-500" size={26} />
            <span className="font-bold text-slate-800">{selectedFile ? selectedFile.name : 'לחצו לבחירת קובץ PDF'}</span>
            <span className="mt-1 text-xs text-slate-500">עד 20MB · הקובץ נשמר במכשיר בגרסת ההדגמה</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={event => handleFileSelected(event.target.files?.[0])}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2 text-sm font-bold text-slate-700">
              שם המקור
              <input value={title} onChange={event => setTitle(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" placeholder="לדוגמה: אימון כוח למתחילים" />
            </label>
            <label className="text-sm font-bold text-slate-700">
              קטגוריה
              <select value={category} onChange={event => setCategory(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal">
                <option>תוכניות אימון</option>
                <option>שיקום ומגבלות</option>
                <option>כוח והיפרטרופיה</option>
                <option>אירובי וסבולת</option>
                <option>תזונה</option>
                <option>מקור אחר</option>
              </select>
            </label>
            <label className="text-sm font-bold text-slate-700">
              הרשאה
              <select value={visibility} onChange={event => setVisibility(event.target.value as CoachPdfVisibility)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal">
                <option value="TEAM">כל צוות האימון</option>
                <option value="PRIVATE_COACH">רק אני</option>
              </select>
            </label>
            <label className="sm:col-span-2 text-sm font-bold text-slate-700">
              תגיות (מופרדות בפסיק)
              <input value={tags} onChange={event => setTags(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" placeholder="מתחילים, ברכיים, 45 דקות" />
            </label>
          </div>
        </div>
        <label className="mt-4 block text-sm font-bold text-slate-700">
          תיאור והנחיות לשימוש בצ׳אט
          <textarea value={description} onChange={event => setDescription(event.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" placeholder="מתי המקור מתאים וממה חשוב להיזהר" />
        </label>
        {formError && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{formError}</p>}
        <div className="mt-4 flex justify-end">
          <button type="submit" disabled={!selectedFile || !title.trim() || isUploading} className="flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 font-extrabold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50">
            {isUploading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
            {isUploading ? 'מחלץ תוכן מהקובץ...' : 'העלה ועבד מקור'}
          </button>
        </div>
      </form>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row">
        <label className="relative flex-1">
          <Search className="absolute right-3 top-2.5 text-slate-400" size={18} />
          <input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} className="w-full rounded-lg border border-slate-300 py-2 pl-3 pr-10" placeholder="חיפוש בשם, קטגוריה או תגית" />
        </label>
        <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2">
          <option value="ALL">כל הסטטוסים</option>
          <option value="READY">מוכן לצ׳אט</option>
          <option value="NEEDS_OCR">נדרש OCR</option>
          <option value="ERROR">שגיאה</option>
        </select>
      </div>

      {filteredDocuments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-500">
          <FileText className="mx-auto mb-3" size={34} />
          <p className="font-bold">עדיין אין מקורות בספרייה</p>
          <p className="mt-1 text-sm">העלו את קובץ האימון הראשון כדי להכין אותו לשימוש הצ׳אט.</p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredDocuments.map(document => {
            const status = statusDetails[document.status];
            const canDelete = document.uploadedById === activeUser.id || activeUser.role === 'MANAGER';
            return (
              <article key={document.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <div className="rounded-xl bg-red-50 p-2.5 text-red-600"><FileText size={24} /></div>
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-black text-slate-900">{document.title}</h3>
                      <p className="truncate text-xs text-slate-500">{document.fileName}</p>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-extrabold ${status.className}`}>{status.label}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 font-bold text-slate-700">{document.category}</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{document.pageCount || '—'} עמודים</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{formatFileSize(document.fileSize)}</span>
                  <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                    {document.visibility === 'TEAM' ? <Users size={12} /> : <Lock size={12} />}
                    {document.visibility === 'TEAM' ? 'צוות' : 'פרטי'}
                  </span>
                </div>
                {document.tags.length > 0 && <p className="mt-3 text-xs font-bold text-sky-700">{document.tags.map(tag => `#${tag}`).join(' ')}</p>}
                {document.description && <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{document.description}</p>}
                {document.status === 'NEEDS_OCR' && (
                  <div className="mt-3 flex gap-2 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                    <AlertTriangle className="shrink-0" size={17} />
                    זהו כנראה PDF סרוק. הקובץ נשמר, אך נדרש OCR בשלב חיבור השרת לפני שהצ׳אט יוכל לקרוא אותו.
                  </div>
                )}
                {document.status === 'READY' && (
                  <div className="mt-3 flex items-center gap-2 text-xs font-bold text-emerald-700">
                    <CheckCircle2 size={16} /> {document.extractedCharacterCount.toLocaleString('he-IL')} תווים חולצו ונשמרו לפי עמוד
                  </div>
                )}
                {document.status === 'ERROR' && <p className="mt-3 text-xs font-bold text-red-700">{document.errorMessage || 'העיבוד נכשל'}</p>}
                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                  <button onClick={() => handleOpenSource(document)} className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"><Eye size={15} /> מקור PDF</button>
                  {document.status !== 'ERROR' && <button disabled={isLoadingPreview} onClick={() => handlePreviewText(document)} className="flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700 hover:bg-sky-100"><FileText size={15} /> תוכן שחולץ</button>}
                  {canDelete && <button onClick={() => handleDelete(document)} className="mr-auto flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"><Trash2 size={15} /> מחיקה</button>}
                </div>
                <p className="mt-3 text-[11px] text-slate-400">הועלה על ידי {document.uploadedByName} · {new Date(document.uploadedAt).toLocaleDateString('he-IL')}</p>
              </article>
            );
          })}
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" onClick={() => setPreview(null)}>
          <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <div><h3 className="font-black text-slate-900">{preview.document.title}</h3><p className="text-xs text-slate-500">תוכן שחולץ לפי עמוד</p></div>
              <button onClick={() => setPreview(null)} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-700">סגירה</button>
            </div>
            <div className="max-h-[75vh] space-y-4 overflow-y-auto bg-slate-50 p-4">
              {preview.pages.map(page => (
                <section key={page.pageNumber} className="rounded-xl border border-slate-200 bg-white p-4">
                  <h4 className="mb-3 text-sm font-black text-sky-700">עמוד {page.pageNumber}</h4>
                  <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{page.text || 'לא נמצא טקסט בעמוד זה.'}</p>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
