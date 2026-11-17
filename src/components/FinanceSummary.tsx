import React, { useEffect, useState } from 'react';
import { financeSummary } from '../../shared/finance-summary.js';
import { type Payment, type User } from '../types';

const money = (value: number) => `₪${value.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function FinanceSummary({ payments, users, now }: { payments: Payment[]; users: User[]; now?: Date }) {
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const update = () => setClock(new Date());
    const timer = window.setInterval(update, 60_000);
    const visible = () => { if (document.visibilityState === 'visible') update(); };
    document.addEventListener('visibilitychange', visible);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, []);
  const summary = financeSummary(payments, users, now || clock);
  const [year, month] = summary.month.split('-');
  return <section aria-label="סיכום כספים חודשי ומצטבר" className="space-y-4" dir="rtl">
    <div className="grid gap-4 lg:grid-cols-2">
      {([{ title: `החודש הנוכחי — ${month}/${year}`, value: summary.monthly }, { title: 'מצטבר — כל התקופה המתועדת', value: summary.lifetime }]).map(({ title, value }) => <article key={title} className="rounded-2xl border border-slate-600 bg-slate-900 p-5 text-slate-100">
        <h3 className="text-lg font-black">{title}</h3>
        <p className="mt-3 text-sm text-emerald-200">סה״כ תשלומים בסטטוס שולם — כל המקורות</p>
        <p className="mt-1 text-3xl font-black"><bdi>{money(value.totalAmount)}</bdi></p>
        <p className="mt-1 text-sm">{value.paidCount} עסקאות ששולמו</p>
        <dl className="mt-4 space-y-3 border-t border-slate-600 pt-4 text-sm">
          <div><dt>סה״כ עסקאות מתועדות בתקופה — ללא בדיקות, כולל ממתינות והחזרים</dt><dd>{value.transactionCount}</dd></div>
          <div><dt>שולם ואושר ברווחית — לפי הרשומות שסונכרנו לאפליקציה</dt><dd><bdi>{money(value.rivhit.amount)}</bdi> · {value.rivhit.count} עסקאות</dd></div>
          <div className="pr-3"><dt>מתוכן: חיובי הוראות קבע שאושרו</dt><dd><bdi>{money(value.recurringPaid.amount)}</bdi> · {value.recurringPaid.count} עסקאות</dd></div>
          <div className="pr-3"><dt>מתוכן: תשלומים מיידיים שאושרו</dt><dd><bdi>{money(value.oneTimePaid.amount)}</bdi> · {value.oneTimePaid.count} עסקאות</dd></div>
          <div><dt>שולם ותועד ידנית — לא אישור רווחית</dt><dd><bdi>{money(value.manual.amount)}</bdi> · {value.manual.count} עסקאות</dd></div>
          {value.unclassified.count > 0 && <div className="text-amber-200"><dt>שולם — מקור לא מסווג, נדרש בירור</dt><dd><bdi>{money(value.unclassified.amount)}</bdi> · {value.unclassified.count} עסקאות</dd></div>}
          <div><dt>עסקאות רווחית מתועדות שממתינות לאישור — לא נכללות בסכום ששולם</dt><dd><bdi>{money(value.rivhitPendingAmount)}</bdi> · {value.rivhitPendingCount} עסקאות</dd></div>
          {value.otherPendingCount > 0 && <div><dt>עסקאות ממתינות ממקור אחר או לא מסווג — לא נכללות בסכום</dt><dd><bdi>{money(value.otherPendingAmount)}</bdi> · {value.otherPendingCount} עסקאות</dd></div>}
          <div><dt>עסקאות מהתקופה בסטטוס הוחזר — לא נכללות בסכום</dt><dd>{value.refundedCount}</dd></div>
        </dl>
        {value.invalidAmountCount > 0 && <p role="status" className="mt-3 text-sm text-amber-200">{value.invalidAmountCount} רשומות ״שולם״ לא נכללו בגלל סכום לא תקין; נדרש בירור.</p>}
        {value.invalidPendingAmountCount > 0 && <p role="status" className="mt-3 text-sm text-amber-200">{value.invalidPendingAmountCount} עסקאות ממתינות ללא סכום תקין נספרו אך סכומן לא חושב.</p>}
      </article>)}
    </div>
    <p className="text-sm">החודש מחושב לפי מועד העסקה המתועד ושעון ישראל, מתחילת החודש ועד היום, ולפי סטטוס העסקאות כיום. שיוך לחודש הוא לפי מועד העסקה המקורי, לא מועד ההחזר או בדיקת הסנכרון. התצוגה מתחלפת אוטומטית ב־1 לחודש, ללא מחיקת היסטוריה. רשומות כפולות מאוחדות לפי מזהי עסקה.</p>
    <p className="text-sm">עסקאות המסומנות כבדיקה אינן נכללות בסיכומים ({summary.excludedTestCount} רשומות הוחרגו). אישור חריג ללא תיעוד סכום אינו נחשב כסף ששולם. זהו סיכום תשלומים באפליקציה, לא דוח הפקדות לבנק. חיוב שקיים ברווחית אך טרם סונכרן אינו מופיע כאן כשולם; סכום ממתין אינו מעיד שהחיוב בוצע או נדחה.</p>
    {summary.unassignedDateCount > 0 && <p role="status" className="text-sm text-amber-300">{summary.unassignedDateCount} עסקאות ללא תאריך תקין מופיעות במצטבר בלבד, ולא שויכו לחודש.</p>}
    <div className="rounded-2xl border border-amber-400/50 bg-slate-900 p-4 text-slate-100">
      <h3 className="font-black">אישור חיובי הוראות קבע — מצב נוכחי, לא סכום ששולם</h3>
      <p className="mt-2">{summary.pendingRecurringCount} הוראות ממתינות לאישור חיוב · {summary.failedRecurringCount} הוראות עם כשל חיוב מאומת</p>
      <div className="mt-3 rounded-xl border border-amber-400/50 p-4">
        <h4 className="font-bold">הוראות קבע שממתינות לאישור חיוב — משויכות לחודש {month}/{year}</h4>
        <p className="mt-2 text-2xl font-black"><bdi>{money(summary.pendingRecurring.monthly.amount)}</bdi> · {summary.pendingRecurring.monthly.count} הוראות</p>
        <p className="mt-2 text-sm">סכום של חיוב אחד לכל הוראה, לאחר ההנחה המתועדת. אינו נכלל בסכום ששולם, אינו סכום כל ההתחייבות השנתית ואינו הוכחה שבוצע חיוב. ייתכן שכבר אושר חיוב ברווחית אך האישור טרם סונכרן לאפליקציה. השיוך לחודש לפי מועד אישור ההקמה המתועד או תום התקופה ששולמה; לא לפי מועד בדיקת הסנכרון.</p>
        {summary.pendingRecurring.monthly.unknownAmountCount > 0 && <p role="status">ב־{summary.pendingRecurring.monthly.unknownAmountCount} הוראות הסכום חסר או סותר, ולכן אינו כלול בסכום הממתין.</p>}
      </div>
      <p className="mt-3">כל ההוראות שממתינות כעת: <bdi>{money(summary.pendingRecurring.current.amount)}</bdi> · {summary.pendingRecurring.current.count} הוראות</p>
      {summary.pendingRecurring.otherPeriodCount > 0 && <p className="text-sm">{summary.pendingRecurring.otherPeriodCount} הוראות שויכו לחודש אחר או ללא תאריך תקין ואינן נכללות בסכום הממתין לחודש הנוכחי.</p>}
      {summary.pendingRecurring.current.unknownAmountCount > 0 && <p role="status">ב־{summary.pendingRecurring.current.unknownAmountCount} הוראות אין סכום חד־משמעי; הן נספרות אך סכומן לא חושב.</p>}
      <details className="mt-3 text-sm"><summary className="cursor-pointer font-bold">פירוט ההוראות שאינן כלולות בסכום ששולם</summary>
        <div className="mt-3 overflow-x-auto"><table className="w-full text-right"><thead><tr><th>מתאמנים</th><th>סכום חיוב אחד</th><th>מועד לשיוך</th><th>מצב מתועד באפליקציה</th></tr></thead>
          <tbody>{summary.pendingRecurring.current.rows.map(row => <tr key={row.key} className="border-t border-slate-700"><td className="p-2">{row.names.join(', ')}</td><td className="p-2">{row.amount === null ? 'סכום לא ידוע' : money(row.amount)}</td><td className="p-2">{row.date || 'לא ניתן לשייך לחודש'}</td><td className="p-2">{row.kind === 'FIRST_CHARGE' ? 'טרם תועד אישור חיוב ראשון' : 'טרם תועד אישור חיוב לתקופה הבאה'}</td></tr>)}</tbody>
        </table></div>
      </details>
      <p className="mt-2 text-sm">הוראה משפחתית מאוחדת נספרת פעם אחת. אלה הוראות, לא הוכחה שבוצעה עסקה; אין לחבר את המספר למספר העסקאות שממתינות ביומן. דף תשלום שנפתח וננטש אינו תשלום ולא נכלל בסכומים.</p>
      <details className="mt-3 text-sm"><summary className="cursor-pointer font-bold">מתי נבדק האישור מול רווחית?</summary>
        <ul className="mt-2 list-disc space-y-2 pr-5">
          <li>לאחר החזרה מהסליקה יש בדיקות קצרות חוזרות, וגם הודעת רווחית לשרת יכולה לעדכן את האישור.</li>
          <li>השרת סורק בכל דקה. בקשה חדשה שטרם זוהתה בה הוראה נבדקת בערך בכל דקה ב־10 הדקות הראשונות, ובהמשך בערך כל 15 דקות במהלך היממה הראשונה.</li>
          <li>לאחר זיהוי ההוראה, או אחרי היממה הראשונה, נעשית בדיקה יומית לכל בקשה. הסריקה מוגבלת בעומס, ולכן התזמון אינו התחייבות לאישור בתוך דקה.</li>
          <li>בחזרה למסך התשלום מתבצעת בדיקה אוטומטית של בקשות שמורות. אפשר גם לבצע בדיקה ידנית ללא חיוב מתוך כלי הסנכרון.</li>
          <li>רק אישור חיוב בפועל יוצר רישום ששולם. הקמת הוראה בהמתנה אינה אישור חיוב; תקלה בבדיקה או היעדר תשובה אינם דחיית תשלום.</li>
        </ul>
      </details>
    </div>
  </section>;
}
