import type {User} from '../types';
import {MEMBERSHIP_TYPE_LABELS, MembershipStatus} from '../types';
import {blankMember,initialDraft,type Draft} from './model';

export const STAGING_CONVERSATION_ENABLED = typeof __CONVERSATION_PROTOTYPE__ !== 'undefined'
  && __CONVERSATION_PROTOTYPE__ && typeof window !== 'undefined'
  && (window.location.hostname==='menibl.github.io' || ['localhost','127.0.0.1'].includes(window.location.hostname));

// The connected test runtime is separate from Pages demo safety fences. Normal
// production builds never emit it; both browser and API must remain loopback-only.
export const ORIGINAL_CHAT_TEST_ENABLED = typeof __CHAT_ORIGINAL_TEST__!=='undefined' && __CHAT_ORIGINAL_TEST__
  && typeof window!=='undefined' && ['localhost','127.0.0.1'].includes(window.location.hostname);
export const PRODUCTION_CHAT_ENABLED=typeof __PRODUCTION_CHAT__!=='undefined' && __PRODUCTION_CHAT__
  && !STAGING_CONVERSATION_ENABLED && !ORIGINAL_CHAT_TEST_ENABLED && typeof window!=='undefined';
// Connected review and original handlers are shared; only the isolated flag may
// rewrite provider URLs or enforce loopback transport.
export const CONNECTED_CHAT_ENABLED=ORIGINAL_CHAT_TEST_ENABLED || PRODUCTION_CHAT_ENABLED;
export const chatUiAvailable=()=>STAGING_CONVERSATION_ENABLED || CONNECTED_CHAT_ENABLED;
const PREFERENCE_KEY='baly-chat-interface-v1';
export const chatUiEnabled=()=>{
  if(!chatUiAvailable())return false;
  const requested=new URLSearchParams(window.location.search).get('ui');
  if(requested==='legacy' || requested==='chat')return requested==='chat';
  try{return sessionStorage.getItem(PREFERENCE_KEY)!=='legacy';}catch{return true;}
};
export function rememberChatInterface(value:'legacy'|'chat'){
  if(!chatUiAvailable())return;
  try{sessionStorage.setItem(PREFERENCE_KEY,value);}catch{/* Explicit URL remains a fallback. */}
}
export function assertOriginalTestUrl(value:string){
  if(!ORIGINAL_CHAT_TEST_ENABLED)return;
  const url=new URL(value,window.location.origin);
  if(url.origin!==window.location.origin || url.protocol!=='http:' || !['localhost','127.0.0.1'].includes(url.hostname))throw new Error('Connected chat tests may contact only their isolated same-origin loopback server.');
}

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
