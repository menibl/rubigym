import React from 'react';
import type {FamilyRenewalSummary} from './familyRenewalSummary';

const money=(amount:number)=>amount.toLocaleString('he-IL',{minimumFractionDigits:2,maximumFractionDigits:2});
export function FamilyRenewalPriceSummary({summary,onEdit}:{summary:FamilyRenewalSummary;onEdit:(memberId:string)=>void}){
  return <>{summary.rows.map(row=><article key={row.memberId} className="family-summary">
    <strong>{row.memberName}</strong>
    {row.lines.map(line=><div key={line.id}><p>{line.label}{line.includedSessions ? ` × ${line.includedSessions}`:''}</p><p>מחיר: ₪{money(line.baseAmount)} · הנחה: ₪{money(line.discountAmount || 0)} · לאחר הנחה: ₪{money(line.amount)}</p></div>)}
    {row.excluded.map(line=><p key={line.id}>{line.label} — {line.status==='EXISTING_RECURRING' ? 'הוראת קבע קיימת':'כבר שולם'}; לא נכלל בחידוש ולא בסכום לתשלום.</p>)}
    {row.lines.length ? <><p>מחיר לפני הנחה: ₪{money(row.base)}</p><p>הנחה לבן המשפחה: ₪{money(row.discount)}</p><p><strong>סה״כ לבן המשפחה: ₪{money(row.total)}</strong></p><button type="button" className="logic-secondary" onClick={()=>onEdit(row.memberId)}>עריכת הבחירה — {row.memberName}</button></>:<p>לא נכלל בחידוש — ללא חיוב (₪0.00)</p>}
  </article>)}<div className="family-summary"><p>מחיר המשפחה לפני הנחה: ₪{money(summary.base)}</p><p>סה״כ הנחות: ₪{money(summary.discount)}</p><strong>סה״כ בחירה לחידוש: ₪{money(summary.total)}</strong><p>הסכומים לפי מנוע החישוב הקיים, לאחר החרגת תשלומים מתועדים והוראות קיימות. תשלומים מחזוריים וחד־פעמיים מופרדים בהמשך לפי התנאים הקיימים.</p><p>בדיקת staging בלבד: אין חיוב, אין שינוי תוקף ואין פתיחת מנוי. זהו חישוב דמה, ללא אימות חי מול רווחית.</p></div></>;
}
