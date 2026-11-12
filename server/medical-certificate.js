import { medicalRecords, medicalDocument } from '../shared/medical-certificate.js';
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };

export function validateMedicalFile(file) {
  if (!file || typeof file.fileName !== 'string' || !file.fileName.trim() || file.fileName.length > 200
    || typeof file.dataUrl !== 'string' || file.dataUrl.length > 7_000_000) fail('קובץ האישור חסר או גדול מדי. המגבלה היא 5MB.');
  const match = /^data:(application\/pdf|image\/png|image\/jpeg|image\/webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(file.dataUrl);
  if (!match) fail('יש לצרף PDF או תמונת PNG, JPEG או WebP תקינים.');
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > 5 * 1024 * 1024 || bytes.toString('base64') !== match[2]) fail('קובץ האישור אינו תקין או גדול מ־5MB.');
  const valid = match[1] === 'application/pdf' ? bytes.subarray(0, 5).toString() === '%PDF-'
    : match[1] === 'image/png' ? bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a'
      : match[1] === 'image/jpeg' ? bytes.subarray(0, 3).toString('hex') === 'ffd8ff'
        : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  if (!valid) fail('תוכן הקובץ אינו תואם לסוג הקובץ שצורף.');
  return { fileName: file.fileName.trim(), dataUrl: file.dataUrl };
}

export function reviewMedicalCertificate(user, body, actor, now = new Date()) {
  const records = medicalRecords(user);
  const record = records.find(item => item.id === body.recordId);
  if (!record) fail('הצהרת הבריאות לא נמצאה. יש לרענן ולבחור הצהרה קיימת.', 409);
  const document = medicalDocument(record);
  if ((document?.id || '') !== (body.expectedDocumentId || '')) fail('האישור הרפואי השתנה. יש לרענן ולבדוק את הקובץ העדכני.', 409);
  let updated;
  const time = now.toISOString();
  if (body.action === 'upload') {
    const file = validateMedicalFile(body.document);
    if (document?.dataUrl === file.dataUrl && document.fileName === file.fileName) return user;
    const upload = { ...file, id: crypto.randomUUID(), uploadedAt: time, uploadedBy: actor.id };
    updated = { ...record, medicalCertificateApproved: false,
      medicalCertificateUploads: [...(record.medicalCertificateUploads || []), upload],
      medicalCertificateAudit: [...(record.medicalCertificateAudit || []), { action: 'UPLOAD', documentId: upload.id, at: time, by: actor.id }] };
  } else if (body.action === 'approve') {
    if (!document) fail('יש להעלות אישור רופא לפני אישור מנהל.');
    validateMedicalFile(document);
    if (!record.signed && !record.signatureName) fail('אין חתימה מתועדת של המתאמן. יש לבקש ממנו להשלים הצהרה.');
    const expiry = new Date(record.signedAt); expiry.setUTCFullYear(expiry.getUTCFullYear() + 1);
    if (!Number.isFinite(expiry.getTime()) || now > expiry) fail('הצהרת הבריאות פגה. אישור רופא אינו מחדש את חתימת המתאמן.');
    if (record.medicalCertificateApproved) return user;
    updated = { ...record, medicalCertificateApproved: true,
      medicalCertificateAudit: [...(record.medicalCertificateAudit || []), { action: 'APPROVE', documentId: document.id, at: time, by: actor.id }] };
  } else fail('פעולה לא מוכרת.');
  const latest = records[0]?.id === record.id;
  return { ...user, healthDeclarationHistory: records.map(item => item.id === record.id ? updated : item),
    ...(latest ? { healthDeclarationMedicalCertificateApproved: updated.medicalCertificateApproved,
      healthDeclarationMedicalCertificateApprovedAt: updated.medicalCertificateApproved ? time : undefined,
      healthDeclarationMedicalCertificateApprovedBy: updated.medicalCertificateApproved ? actor.id : undefined,
      ...(updated.medicalCertificateApproved ? { healthDeclarationSigned: true } : {}) } : {}) };
}
