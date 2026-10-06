import React from 'react';
import { SystemSettings } from '../types';
import { DEFAULT_INVOICE_DESCRIPTION, invoiceDescription } from '../../shared/invoice-description.js';

export const InvoiceDescriptionSettings = ({ settings, onChange }: {
  settings: SystemSettings;
  onChange: (settings: SystemSettings) => void;
}) => <fieldset className="mb-4 space-y-3 rounded-xl border border-slate-600 bg-slate-900 p-4 text-slate-100" dir="rtl">
  <legend className="px-2 text-sm font-black">תיאור לחשבונית</legend>
  <p className="text-xs text-slate-300">התיאור יישלח לרווחית בעסקאות חדשות בלבד. שם המסלול, המחיר והזכויות במערכת אינם משתנים.</p>
  <label className="block text-sm font-bold">מקור התיאור
    <select value={settings.invoiceDescriptionMode || 'FIXED'} onChange={event => onChange({ ...settings, invoiceDescriptionMode: event.target.value as 'FIXED' | 'PLAN_NAME' })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 text-slate-100">
      <option value="FIXED">תיאור אחיד לכל העסקאות</option>
      <option value="PLAN_NAME">שם המסלול שנרכש</option>
    </select>
  </label>
  {settings.invoiceDescriptionMode !== 'PLAN_NAME' && <label className="block text-sm font-bold">טקסט התיאור
    <input maxLength={100} value={settings.invoiceDescriptionText ?? DEFAULT_INVOICE_DESCRIPTION} onChange={event => onChange({ ...settings, invoiceDescriptionText: event.target.value })} placeholder={DEFAULT_INVOICE_DESCRIPTION} className="mt-1 min-h-11 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 text-slate-100" />
  </label>}
  <p className="text-xs text-slate-300">תצוגה מקדימה: <strong className="text-white">{invoiceDescription(settings, 'שם המסלול שנרכש')}</strong></p>
</fieldset>;
