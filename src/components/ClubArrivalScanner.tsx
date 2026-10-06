import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera } from 'lucide-react';
import { CLUB_CHECK_IN_CODE } from '../../shared/club-check-in.js';
import { ArrivalChoice, getArrivalChoices, saveClubArrival } from '../data/clubServer';
import { AttendanceLog } from '../types';

export function ClubArrivalScanner({ logs }: { logs: AttendanceLog[] }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const frame = useRef(0);
  const generation = useRef(0);
  const mounted = useRef(true);
  const busyRef = useRef(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [choices, setChoices] = useState<ArrivalChoice[] | null>(null);
  const [selected, setSelected] = useState<ArrivalChoice | null>(null);
  const [partnerId, setPartnerId] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState('');
  const stop = () => {
    generation.current++;
    cancelAnimationFrame(frame.current);
    stream.current?.getTracks().forEach(t => t.stop()); stream.current = null;
    if (video.current) video.current.srcObject = null;
    if (mounted.current) setScanning(false);
  };
  const arrive = async (choice: ArrivalChoice, partner?: string) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      await saveClubArrival({ code: CLUB_CHECK_IN_CODE, type: choice.type, targetId: choice.targetId, trainingType: choice.trainingType, partnerId: partner });
      if (mounted.current) {
        setChoices(null); setSelected(null);
        setSuccess(`נרשמת לאימון: ${choice.title}. הגעתך תועדה.${!choice.registered && choice.type === 'SESSION' ? ' נוכה קרדיט אחד מהכרטיסייה שנבחרה.' : ''}`);
      }
    } catch (e) { if (mounted.current) setError(e.message); }
    finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  };
  const scanned = async () => {
    stop(); setError(''); setBusy(true);
    try {
      const { choices: available } = await getArrivalChoices();
      if (!mounted.current) return;
      const pending = available.filter(c => !c.checkedIn);
      if (!pending.length) { setError(available.length ? 'ההגעה לאימונים הזמינים כבר תועדה.' : 'אין כעת אימון פנוי שמתאים למנוי שלך. יש לפנות למאמן.'); return; }
      setChoices(pending);
      if (pending.length === 1 && (pending[0].trainingType !== 'DUO' || pending[0].registered)) await arrive(pending[0]);
    } catch (e) { if (mounted.current) setError(e.message); }
    finally { if (mounted.current) setBusy(false); }
  };
  const start = async () => {
    stop(); setError(''); setSuccess(''); setChoices(null); setSelected(null);
    const attempt = generation.current;
    if (!navigator.mediaDevices?.getUserMedia) { setError('המצלמה אינה זמינה. יש לפתוח את האתר בדפדפן עם חיבור מאובטח.'); return; }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 } }, audio: false });
      if (!mounted.current || attempt !== generation.current) { media.getTracks().forEach(t => t.stop()); return; }
      stream.current = media; setScanning(true);
      const canvas = document.createElement('canvas'), context = canvas.getContext('2d', { willReadFrequently: true });
      let last = 0;
      const scan = (time: number) => {
        const element = video.current;
        if (!stream.current || !mounted.current) return;
        if (element && element.srcObject !== media) { element.srcObject = media; void element.play().catch(() => undefined); }
        if (element?.readyState >= 2 && context && time - last >= 200) {
          last = time;
          canvas.width = Math.min(640, element.videoWidth);
          canvas.height = Math.round(element.videoHeight * canvas.width / element.videoWidth);
          context.drawImage(element, 0, 0, canvas.width, canvas.height);
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'dontInvert' });
          if (code?.data === CLUB_CHECK_IN_CODE) { void scanned(); return; }
          if (code) setError('זה אינו קוד המועדון. כוונו אל קוד הכניסה של BALY WELLNESS.');
        }
        frame.current = requestAnimationFrame(scan);
      };
      frame.current = requestAnimationFrame(scan);
    } catch { if (mounted.current && attempt === generation.current) setError('לא התקבל אישור למצלמה. יש לאפשר גישה למצלמה בהגדרות הדפדפן ולנסות שוב.'); }
  };
  useEffect(() => {
    mounted.current = true;
    void start();
    const hide = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', hide);
    return () => { mounted.current = false; stop(); document.removeEventListener('visibilitychange', hide); };
  }, []);
  const label = (c: ArrivalChoice) => c.trainingType === 'DUO' ? 'אימון זוגי' : c.trainingType === 'SOLO' ? 'אימון אישי' : c.trainingType === 'GROUP' ? 'אימון קבוצתי' : 'Open Gym';
  return <section className="w-full max-w-lg space-y-4 rounded-2xl bg-slate-900 p-5 text-white text-right" dir="rtl" aria-label="סריקת כניסה למועדון">
    <h3 className="text-xl font-bold">סריקת קוד המועדון</h3>
    <p className="text-sm text-slate-300">בחרו אימון זמין בהגעה. רישום אישי או זוגי חדש מנכה קרדיט אחד בלבד; הרשמה קיימת לא תחויב שוב.</p>
    {scanning && <><video ref={video} autoPlay muted playsInline className="w-full rounded-xl bg-black" /><button type="button" onClick={stop} className="p-3">סגירת מצלמה</button></>}
    {error && <p role="alert" className="text-rose-300">{error}</p>}
    {success && <p role="status" className="rounded-xl bg-emerald-950 p-4 text-emerald-200">{success}</p>}
    {choices && <div className="space-y-3" aria-busy={busy}>
      <h4 className="text-lg font-bold">לאיזה אימון הגעת?</h4>
      {choices.map(c => <button type="button" disabled={busy} key={c.key} onClick={() => {
        setSelected(c); setPartnerId('');
        if (c.trainingType !== 'DUO' || c.registered) void arrive(c);
      }} className="block w-full rounded-xl border border-slate-600 bg-slate-800 p-4 text-right disabled:opacity-50">
        <strong>{label(c)} — {c.title}</strong><div className="text-sm text-slate-300">{c.time} · {c.registered ? 'רשום מראש — ללא חיוב נוסף' : c.type === 'OPEN_GYM' ? 'רישום ותיעוד הגעה בלבד' : 'רישום וניכוי קרדיט אחד'}</div>
      </button>)}
      {selected?.trainingType === 'DUO' && !selected.registered && <div className="space-y-3">
        <label className="block">בן/בת זוג לאימון<select value={partnerId} onChange={e => setPartnerId(e.target.value)} className="mt-2 w-full rounded-xl bg-slate-800 p-3"><option value="">בחירת בן משפחה</option>{selected.partners?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <button type="button" disabled={busy || !partnerId} onClick={() => void arrive(selected, partnerId)} className="w-full rounded-xl bg-amber-400 p-3 font-bold text-black disabled:opacity-50">אישור אימון זוגי וניכוי קרדיט אחד</button>
      </div>}
    </div>}
    {busy && <p role="status">שומר רישום הגעה…</p>}
    {!scanning && <button type="button" disabled={busy} onClick={() => void start()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 p-4 font-bold text-black disabled:opacity-50"><Camera size={20} />פתיחת מצלמה וסריקה</button>}
    <section aria-label="היסטוריית הגעה" className="border-t border-slate-700 pt-4">
      <h4 className="font-bold">היסטוריית כניסות למועדון</h4>
      <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
        {logs.slice().sort((a, b) => `${b.date}T${b.timestamp}`.localeCompare(`${a.date}T${a.timestamp}`)).map(log => <div key={log.id} className="rounded-xl bg-slate-800 p-3 text-sm"><strong>{log.targetTitle}</strong><div className="text-slate-300">{log.date} · {log.timestamp}</div></div>)}
        {!logs.length && <p className="text-sm text-slate-300">אין עדיין רישומי הגעה.</p>}
      </div>
    </section>
  </section>;
}
