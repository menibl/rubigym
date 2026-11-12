export function medicalRecords(user) {
  if (Array.isArray(user.healthDeclarationHistory) && user.healthDeclarationHistory.length) return user.healthDeclarationHistory;
  const signed = Date.parse(user.healthDeclarationDate || '');
  if (!Number.isFinite(signed)) return [];
  const expiry = new Date(signed); expiry.setUTCFullYear(expiry.getUTCFullYear() + 1);
  return [{ id: `legacy-${user.id}`, signedAt: new Date(signed).toISOString(), validUntil: expiry.toISOString().slice(0, 10),
    signed: Boolean(user.healthDeclarationSigned), answers: user.healthDeclarationAnswers,
    requiresMedicalCertificate: user.healthDeclarationRequiresMedicalCertificate,
    medicalCertificateApproved: user.healthDeclarationMedicalCertificateApproved,
    signatureName: user.healthDeclarationSignatureName, signatureUrl: user.healthDeclarationSignatureUrl,
    parentConsent: user.healthDeclarationParentConsent, parentName: user.healthDeclarationParentName,
    parentIdNumber: user.healthDeclarationParentIdNumber,
    medicalCertificateFileName: user.healthDeclarationMedicalCertificateFileName,
    medicalCertificateDataUrl: user.healthDeclarationMedicalCertificateDataUrl }];
}

export function medicalDocument(record) {
  return record.medicalCertificateUploads?.at(-1) || (record.medicalCertificateDataUrl ? {
    id: `original-${record.id}`, fileName: record.medicalCertificateFileName || 'אישור רפואי', dataUrl: record.medicalCertificateDataUrl
  } : undefined);
}

export function pendingMedicalReview(user) {
  const requires = user.healthDeclarationRequiresMedicalCertificate || Object.values(user.healthDeclarationAnswers || {}).includes('YES');
  return { ...user, healthDeclarationRequiresMedicalCertificate: Boolean(requires), healthDeclarationMedicalCertificateApproved: false,
    healthDeclarationMedicalCertificateApprovedAt: undefined, healthDeclarationMedicalCertificateApprovedBy: undefined,
    healthDeclarationHistory: Array.isArray(user.healthDeclarationHistory) ? user.healthDeclarationHistory.map(record => ({ ...record, medicalCertificateApproved: false,
      medicalCertificateUploads: undefined, medicalCertificateAudit: undefined })) : undefined };
}

// A trainee may submit a new signed declaration, but cannot approve a file or
// replace past signed records with fabricated review/audit metadata.
export function mergeOwnHealthReview(previous, updated, requested) {
  const oldRecords = medicalRecords(previous);
  const fresh = (Array.isArray(requested.healthDeclarationHistory) ? requested.healthDeclarationHistory : []).filter(record => record?.id && !oldRecords.some(old => old.id === record.id))
    .slice(0, 1).map(record => ({ id: record.id, signedAt: record.signedAt, validUntil: record.validUntil, signed: record.signed,
      answers: record.answers, signatureName: record.signatureName, signatureUrl: record.signatureUrl,
      parentConsent: record.parentConsent, parentName: record.parentName, parentIdNumber: record.parentIdNumber,
      requiresMedicalCertificate: Boolean(record.requiresMedicalCertificate || Object.values(record.answers || {}).includes('YES')),
      medicalCertificateApproved: false, medicalCertificateFileName: record.medicalCertificateFileName,
      medicalCertificateDataUrl: record.medicalCertificateDataUrl }));
  const changed = fresh.length || ['healthDeclarationDate', 'healthDeclarationAnswers', 'healthDeclarationSignatureName',
    'healthDeclarationMedicalCertificateDataUrl'].some(key => key in requested && JSON.stringify(requested[key]) !== JSON.stringify(previous[key]));
  return { ...updated, healthDeclarationHistory: [...fresh, ...oldRecords],
    healthDeclarationSigned: changed ? updated.healthDeclarationSigned : previous.healthDeclarationSigned,
    healthDeclarationRequiresMedicalCertificate: Boolean(Object.values(updated.healthDeclarationAnswers || {}).includes('YES')
      || (fresh.length ? fresh[0].requiresMedicalCertificate : previous.healthDeclarationRequiresMedicalCertificate)),
    healthDeclarationMedicalCertificateApproved: changed ? false : previous.healthDeclarationMedicalCertificateApproved,
    healthDeclarationMedicalCertificateApprovedAt: changed ? undefined : previous.healthDeclarationMedicalCertificateApprovedAt,
    healthDeclarationMedicalCertificateApprovedBy: changed ? undefined : previous.healthDeclarationMedicalCertificateApprovedBy };
}
