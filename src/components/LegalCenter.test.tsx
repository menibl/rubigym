import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LegalDocumentModal, LegalLinks, type LegalDocumentId } from './LegalCenter';

const documentHtml = (documentId: LegalDocumentId) => renderToStaticMarkup(<LegalDocumentModal documentId={documentId} onClose={() => {}} />);

test('all canonical legal documents are available as accessible touch targets', () => {
  const html = renderToStaticMarkup(<LegalLinks />);
  for (const label of ['פרטיות', 'תנאי שימוש', 'קוקיז', 'ביטולים והחזרים', 'נגישות', 'פרטי העסק']) assert.ok(html.includes(label));
  assert.equal((html.match(/aria-haspopup="dialog"/g) || []).length, 6);
  assert.match(html, /min-h-11/);
  for (const id of ['privacy', 'terms', 'cookies', 'refunds', 'accessibility', 'business'] as const) {
    assert.match(documentHtml(id), /role="dialog" aria-modal="true" aria-labelledby="legal-title"/);
    assert.match(documentHtml(id), /סגירת החלון/);
  }
});

test('annual notice is a payable service period, not a double charge or unconditional penalty', () => {
  const html = documentHtml('refunds');
  for (const text of ['בתום חודש ממסירת הודעת הביטול', 'ולא קנס נוסף', 'לא ייגבו פעמיים', 'מכר מרחוק', 'אינה מותנית באישור מנהל', 'לא אוטומטית מכוח נוסח זה']) assert.ok(html.includes(text), text);
});

test('freezing is one consecutive month per 12 months and never promises automatic debit suspension', () => {
  const html = documentHtml('refunds');
  for (const text of ['חודש אחד רצוף בלבד', 'פעם אחת בכל 12 חודשים', 'אינה עוצרת או מפחיתה אוטומטית חיוב', 'הוראה משפחתית מאוחדת', 'בלי לגרוע מזכות אחרת לפי דין']) assert.ok(html.includes(text), text);
});

test('safe use duties preserve mandatory liability and do not retroactively accept terms', () => {
  const html = documentHtml('terms');
  for (const text of ['שימוש זהיר וסביר', 'לדווח לצוות מיד', 'אין בתנאים אלה ויתור', 'אחריות לרשלנות', 'אינה משנה בדיעבד עסקה קיימת']) assert.ok(html.includes(text), text);
});

test('authenticated footer stays outside workspace switches and is not hidden on phones', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
  const footer = app.slice(app.indexOf('{/* Aesthetic Footer */}'), app.indexOf('<UserSettingsModal', app.indexOf('{/* Aesthetic Footer */}')));
  assert.match(footer, /<LegalLinks businessDetails=\{settings.businessDetails\}/);
  assert.doesNotMatch(footer, /isAuthenticated|UserRole|workspaceView/);
  assert.doesNotMatch(css, /[^{}]*\.app-footer[^{}]*\{[^{}]*display:\s*none/);
  assert.match(css, /\.role-trainee \.app-footer\s*\{[^}]*safe-area-inset-bottom/);
});
