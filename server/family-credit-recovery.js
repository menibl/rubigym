const diagnostics = {
  RIVHIT_UNAVAILABLE: 'שירות רווחית לא היה זמין או החזיר תשובה לא תקינה. ניתן לנסות שוב בדיקה וסנכרון.',
  RIVHIT_PAYMENT_FAILED: 'רווחית לא החזירה פרטי עסקה תקינים לבקשה השמורה. אין בכך הוכחה שהבקשה בוטלה או שלא שולם עליה.',
  RIVHIT_PAYMENT_NOT_VERIFIED: 'רווחית לא אישרה שהתשלום הושלם.',
  AMOUNT_MISMATCH: 'הסכום שהוחזר מרווחית אינו תואם לסכום בבקשת התשלום השמורה.',
  CLUB_STATE_MISSING: 'נתוני המועדון לא זמינים לסנכרון.',
  PAYMENT_USER_NOT_FOUND: 'המשתמש המשויך לבקשה לא נמצא בזמן הסנכרון.'
};

export async function recoverFamilyCredit({ store, clubId, payment, payments, action, managerId, reason, readOrder, verifyAndPersist, now = Date.now(), logDiagnostic = () => {} }) {
  const diagnostic = (code, stage) => {
    // Never log provider response text, references, tokens, names or card data.
    const details = { code, stage };
    logDiagnostic(details);
    return details;
  };
  const claim = await store.getFamilyCreditClaim(clubId, payment.id);
  if (!claim) return { ok: true, state: 'NONE', message: 'אין שמירת קיזוז פעילה לתשלום זה.' };
  if (payments.some(item => item.familyCreditSourcePaymentId === payment.id) || claim.checkout?.completed) {
    return { ok: true, state: 'USED', message: 'הקיזוז כבר שימש לעסקה שהושלמה. אין לשחרר אותו.' };
  }
  const safeToRelease = claim.recovery_stage === 'RESERVED' && !claim.checkout
    && now - Date.parse(claim.created_at) > 5 * 60 * 1000;
  if (action === 'release') {
    if (!safeToRelease) return { ok: true, state: 'BLOCKED', message: 'אין הוכחה שהבקשה לא נשלחה לרווחית. השחרור נחסם כדי למנוע קיזוז כפול.' };
    const released = await store.releaseUndispatchedFamilyCredit(clubId, payment.id, claim.claim_id, managerId, reason);
    return { ok: true, state: released ? 'RELEASED' : 'BLOCKED', message: released
      ? 'שמירת הקיזוז שוחררה ותועדה. התשלום המקורי נשמר. ניתן להתחיל שוב את הבחירה המשפחתית.'
      : 'מצב הבקשה השתנה. לא שוחרר קיזוז; יש לבדוק מחדש.' };
  }
  if (safeToRelease) return { ok: true, state: 'RELEASABLE', message: 'הבקשה נשמרה אך לא נשלחה לספק. ניתן לשחרר את שמירת הקיזוז.' };
  if (!claim.checkout?.paymentReference) return { ok: true, state: 'REVIEW_REQUIRED', message: 'בקשה ישנה או לא ודאית ללא מזהה עסקה שמור. נדרש בירור מול רווחית; לא שוחרר קיזוז ולא נוצר חיוב.' };
  let order;
  try { order = await readOrder(claim.checkout.paymentReference); }
  catch { return { ok: true, state: 'REVIEW_REQUIRED', diagnostic: diagnostic('STORED_REQUEST_INVALID', 'read-order'), message: 'לא ניתן לאמת את הבקשה השמורה. נדרש בירור; הקיזוז נשאר מוגן.' }; }
  if (order.u !== payment.traineeId || order.cs !== payment.id || order.m !== 'FAMILY_MEMBERSHIP' || order.d !== 'PRIMARY') {
    return { ok: true, state: 'BLOCKED', message: 'הבקשה השמורה אינה תואמת למשתמש ולתשלום. נדרש בירור מנהל.' };
  }
  try {
    await verifyAndPersist(claim.checkout.paymentReference);
    return { ok: true, state: 'SYNCED', message: 'העסקה אומתה מול רווחית וסונכרנה. אין לשלם שוב. יש לרענן את נתוני המתאמן.' };
  } catch (error) {
    const code = Object.hasOwn(diagnostics, error?.message) ? error.message : 'RECOVERY_UNKNOWN_ERROR';
    const details = diagnostic(code, 'verify-and-sync');
    // Only an explicit unsuccessful Verify may offer the same existing page.
    // Network errors, missing details and mismatches are never proof of nonpayment.
    if (error.message === 'RIVHIT_PAYMENT_NOT_VERIFIED' && now - Number(order.t) < 24 * 60 * 60 * 1000) {
      let url;
      try { url = new URL(claim.checkout.url); } catch { /* Fail closed below. */ }
      if (url?.protocol === 'https:' && ['icredit.rivhit.co.il', 'testicredit.rivhit.co.il'].includes(url.hostname)) {
        return { ok: true, state: 'EXISTING_PAGE', diagnostic: details, url: url.href, message: 'התשלום טרם אומת. זהו הקישור לבקשה הקיימת בלבד; אין לפתוח עסקה נוספת. לאחר השלמה יש ללחוץ שוב בדיקה וסנכרון.' };
      }
    }
    const ageNotice = code === 'RIVHIT_PAYMENT_NOT_VERIFIED' && now - Number(order.t) >= 24 * 60 * 60 * 1000
      ? ' הבקשה בת יותר מ־24 שעות ולכן המערכת לא מציעה להמשיך בקישור הישן; אין בכך אישור שהספק ביטל אותו.' : '';
    return { ok: true, state: 'REVIEW_REQUIRED', diagnostic: details, message: `${diagnostics[code] || 'אירעה שגיאה לא מזוהה באימות או בסנכרון הבקשה.'}${ageNotice} הקיזוז לא שוחרר ולא נוצר חיוב חדש. יש לברר את מצב הבקשה לפני פתיחת תשלום נוסף.` };
  }
}
