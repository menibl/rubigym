import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Printer, QrCode } from 'lucide-react';

export const CLUB_CHECK_IN_CODE = 'BALY-CLUB-CHECKIN-V1';

interface ClubCheckInBarcodeProps {
  compact?: boolean;
}

export const ClubCheckInBarcode: React.FC<ClubCheckInBarcodeProps> = ({ compact = false }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, CLUB_CHECK_IN_CODE, {
      width: compact ? 170 : 240,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: { dark: '#09090b', light: '#ffffff' }
    }).catch(() => setError('לא ניתן היה ליצור את קוד הסריקה.'));
  }, [compact]);

  const downloadBarcode = () => {
    const dataUrl = canvasRef.current?.toDataURL('image/png');
    if (!dataUrl) return;
    const anchor = document.createElement('a');
    anchor.href = dataUrl;
    anchor.download = 'baly-club-check-in-qr.png';
    anchor.click();
  };

  const printBarcode = () => {
    const dataUrl = canvasRef.current?.toDataURL('image/png');
    if (!dataUrl) return;
    const popup = window.open('', '_blank', 'width=640,height=760');
    if (!popup) return;
    popup.document.write(`<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><title>קוד כניסה BALY</title><style>body{font-family:Arial,sans-serif;text-align:center;padding:48px;color:#111}img{width:360px;max-width:90vw}h1{margin-bottom:8px}p{font-size:18px}</style><h1>BALY WELLNESS</h1><p>סרקו את הקוד באפליקציה לאישור הגעה לאימון</p><img src="${dataUrl}" alt="קוד כניסה למועדון"><script>onload=()=>print()</script></html>`);
    popup.document.close();
  };

  return <section className={`rounded-2xl border border-amber-300/40 bg-white text-center shadow-sm ${compact ? 'p-3' : 'p-5'}`} dir="rtl">
    <div className="mb-3 flex items-center justify-center gap-2 text-slate-900"><QrCode size={20} className="text-amber-600" /><strong className="text-sm">קוד אישור כניסה למועדון</strong></div>
    <canvas ref={canvasRef} className="mx-auto rounded-xl border border-slate-100" aria-label="ברקוד לסריקת כניסה למועדון" />
    {error ? <p className="mt-2 text-xs text-rose-700">{error}</p> : <p className="mt-2 text-[11px] text-slate-500">הציגו או הדפיסו את הקוד בכניסה. האפליקציה מאמתת הרשמה, תשלום והצהרת בריאות.</p>}
    {!compact && <div className="mt-4 flex justify-center gap-2">
      <button type="button" onClick={downloadBarcode} className="flex min-h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-black text-white"><Download size={15} /> הורדת הקוד</button>
      <button type="button" onClick={printBarcode} className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-black text-slate-800"><Printer size={15} /> הדפסה</button>
    </div>}
  </section>;
};
