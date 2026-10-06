export const DEFAULT_INVOICE_DESCRIPTION = 'ייעוץ ואימון';

// Resolve only trusted club settings, never checkout fields supplied by a payer.
export function invoiceDescription(settings, planLabel) {
  const value = settings?.invoiceDescriptionMode === 'PLAN_NAME'
    ? planLabel : settings?.invoiceDescriptionText;
  return (typeof value === 'string' ? value.replace(/[\r\n\t]+/g, ' ').trim().slice(0, 100) : '')
    || DEFAULT_INVOICE_DESCRIPTION;
}
