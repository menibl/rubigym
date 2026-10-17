import { splitPersonName } from '../../shared/person-name.js';
import type { User } from '../types';

export function familyMemberSurname(user: User, users: User[]) {
  const payer = users.find(member => member.id === user.familyPayerId) || user;
  return splitPersonName(payer.name).lastName || String(payer.familyName || '').replace(/^משפחת\s+/, '').trim();
}

export function missingFamilyMemberFields(form: {
  firstName: string; lastName: string; username: string; email: string; password: string;
  birthDate: string; healthApproved: boolean; agreementApproved: boolean;
}) {
  const fields: [string, boolean][] = [
    ['שם פרטי', /\p{L}/u.test(form.firstName)], ['שם משפחה', /\p{L}/u.test(form.lastName)],
    ['שם משתמש להתחברות', Boolean(form.username.trim())], ['אימייל', Boolean(form.email.trim())],
    ['סיסמה', Boolean(form.password.trim())], ['תאריך לידה', Boolean(form.birthDate)],
    ['חתימה על הצהרת בריאות', form.healthApproved], ['אישור הסכם ההצטרפות והתקנון', form.agreementApproved]
  ];
  return fields.filter(([, filled]) => !filled).map(([label]) => label);
}
