import type {User} from '../types';
import {MEMBERSHIP_TYPE_LABELS, MembershipStatus} from '../types';
import {blankMember,initialDraft,type Draft} from './model';

export const STAGING_CONVERSATION_ENABLED = typeof __CONVERSATION_PROTOTYPE__ !== 'undefined'
  && __CONVERSATION_PROTOTYPE__ && typeof window !== 'undefined'
  && (window.location.hostname==='menibl.github.io' || ['localhost','127.0.0.1'].includes(window.location.hostname));

// Minimal read-only projection. Never pass user objects, credentials, phone, health,
// signatures, provider tokens or payment references to the isolated prototype.
export function accountChatSnapshot(activeUser: User,users: User[]): Draft {
  const family=activeUser.familyId ? users.filter(u=>u.familyId===activeUser.familyId):[activeUser];
  const members=(family.length ? family:[activeUser]).slice(0,6);
  const statuses: Record<string,string> = {
    [MembershipStatus.ACTIVE]:'פעיל',[MembershipStatus.EXPIRED]:'פג תוקף',
    [MembershipStatus.DEBT]:'חוב / לא שולם',
  };
  return {...initialDraft(),family:members.length>1,familyName:activeUser.familyName || '',fromAccount:true,step:'account',
    members:members.map(u=>{
      const parts=u.name.trim().split(/\s+/);
      const types=[u.membershipType,...(u.secondaryMemberships || [])].filter(Boolean);
      return {...blankMember(),name:u.name,firstName:parts[0] || '',lastName:parts.slice(1).join(' '),
        currentPlans:types.map(t=>`${MEMBERSHIP_TYPE_LABELS[t!]?.label || t}${u.membershipPlanExpiries?.[t!] ? ` · תוקף ${u.membershipPlanExpiries[t!]}`:''}`).join(' · ') || 'לא הוגדר מסלול',
        currentExpiry:u.membershipExpiry || 'לא הוגדר',currentStatus:[statuses[u.membershipStatus || ''] || u.membershipStatus || 'לא הוגדר',u.offlinePaymentApproved ? 'אישור חריג ידני — אינו הוכחת חיוב':'',Object.values(u.recurringMemberships || {}).some(r=>r?.status==='PENDING_FIRST_CHARGE') ? 'ממתין לאישור חיוב ראשון':''].filter(Boolean).join(' · '),
        // No claim that the simplified fictional catalog represents existing entitlements.
        plan:'none',extras:[],credentialsReady:false};
    })};
}
