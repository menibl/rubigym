import { HealthDeclarationRecord } from '../types';

interface HealthDeclarationRecordInput {
  signed: boolean;
  answers?: Record<string, 'YES' | 'NO'>;
  requiresMedicalCertificate?: boolean;
  medicalCertificateApproved?: boolean;
  parentConsent?: boolean;
  parentName?: string;
  parentIdNumber?: string;
  signatureName?: string;
  signatureUrl?: string;
  medicalCertificateFileName?: string;
  medicalCertificateDataUrl?: string;
}

export const createHealthDeclarationRecord = (input: HealthDeclarationRecordInput): HealthDeclarationRecord => {
  const signedAt = new Date();
  const validUntil = new Date(signedAt);
  validUntil.setFullYear(validUntil.getFullYear() + 1);
  return {
    id: `health-${signedAt.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    signedAt: signedAt.toISOString(),
    validUntil: validUntil.toISOString().split('T')[0],
    signed: input.signed,
    answers: input.answers,
    requiresMedicalCertificate: input.requiresMedicalCertificate,
    medicalCertificateApproved: input.medicalCertificateApproved,
    parentConsent: input.parentConsent,
    parentName: input.parentName,
    parentIdNumber: input.parentIdNumber,
    signatureName: input.signatureName,
    signatureUrl: input.signatureUrl,
    medicalCertificateFileName: input.medicalCertificateFileName,
    medicalCertificateDataUrl: input.medicalCertificateDataUrl
  };
};
