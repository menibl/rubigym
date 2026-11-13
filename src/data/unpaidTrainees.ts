import { MembershipStatus, UserRole, type User } from '../types';

// Drill-down of the finance card, not a new inference about provider charges.
export const activeDebtTrainees = (users: User[]) => users.filter(user => user.role === UserRole.TRAINEE && user.membershipStatus === MembershipStatus.DEBT);
const text = (value?: string) => String(value || '').normalize('NFKC').toLocaleLowerCase('he-IL').replace(/\s+/g, ' ').trim();
const phone = (value?: string) => String(value || '').replace(/\D/g, '').replace(/^00972/, '0').replace(/^972/, '0');

export function filterDebtTrainees(users: User[], search: string, allUsers: User[] = users) {
  const query = text(search), phoneQuery = phone(search);
  return activeDebtTrainees(users).filter(user => {
    if (!query) return true;
    const payer = allUsers.find(candidate => candidate.id === user.familyPayerId);
    return [user.name, user.email, user.phone, user.familyName, payer?.name].some(value => text(value).includes(query))
      || (phoneQuery.length >= 3 && phone(user.phone).includes(phoneQuery));
  }).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'he'));
}
