# חיבור RIVHIT iCredit לתשלומי BALY

האפליקציה משתמשת ב־Hosted Payment Page של iCredit. פרטי הכרטיס מוזנים רק בדף המאובטח של RIVHIT ואינם מגיעים ל־BALY.

## משתני סביבה בשרת

יש להוסיף ל־`/etc/gymflow/production.env` בלי לשמור ערכים אמיתיים ב־Git:

```dotenv
RIVHIT_ENVIRONMENT=test
RIVHIT_GROUP_PRIVATE_TOKEN=
RIVHIT_ENABLE_RECURRING=false
RIVHIT_USE_3DS=false
PAYMENT_SIGNING_SECRET=
PUBLIC_APP_URL=https://balywellness.com/
PAYMENT_STAGING_APP_URL=https://menibl.github.io/rubigym/
PAYMENT_ALLOWED_ORIGIN=https://balywellness.com,https://menibl.github.io
VITE_PAYMENT_API_URL=https://balywellness.com
```

`PAYMENT_SIGNING_SECRET` חייב להיות ערך אקראי ארוך וקבוע. החלפתו מבטלת תשלומים שנמצאים באמצע התהליך.

## מצב TEST

- `RIVHIT_ENVIRONMENT=test` מפנה רק אל `testicredit.rivhit.co.il`.
- משתמשים בכרטיסי הבדיקה וב־Group Private Token שקיבלתם מ־RIVHIT.
- התשלום מופעל במערכת רק אחרי `SaleDetails` ואימות נוסף מול `Verify`.
- ה־webhook זמין ב־`https://balywellness.com/api/payments/rivhit/webhook` והוא חסין לכפילויות.

## חיובים חודשיים

יש להשאיר `RIVHIT_ENABLE_RECURRING=false` עד ש־RIVHIT מאשרת שהשירות והמסוף מורשים לחיובים מחזוריים. לאחר האישור ניתן להפעיל אותו; במסלולים שנתיים נוצרת בקשה חודשית ל־12 חיובים. לפני מעבר לייצור יש לאשר עם RIVHIT אם ספירת 12 החיובים כוללת את החיוב הראשון ולהריץ עסקת קצה מלאה בסביבת TEST.

## מעבר לייצור

רק לאחר בדיקות מוצלחות:

1. מחליפים ל־`RIVHIT_ENVIRONMENT=production`.
2. מכניסים Group Private Token של סביבת הייצור.
3. בודקים ש־IPN מתקבל ונבדק ב־Verify.
4. מבצעים רכישה קטנה אמיתית, בודקים מסמך, זיכוי ושיוך מסלול.

אין לשים את `RIVHIT_GROUP_PRIVATE_TOKEN` במשתנה `VITE_*`, בקוד הדפדפן או ב־GitHub Pages.
