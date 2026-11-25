import {STAGING_CONVERSATION_ENABLED} from './integration';
import {isPagesDemoMode} from '../data/appMode';
const KEY='baly-staging-original-registration-v1';
const fields=['firstName','lastName','username','email','phone','birthDate','gender'] as const;
export function readStagingRegistrationDraft():Record<string,string>{
  if(!STAGING_CONVERSATION_ENABLED || !isPagesDemoMode())return {};
  try{const input=JSON.parse(sessionStorage.getItem(KEY) || '{}');return Object.fromEntries(fields.filter(key=>typeof input[key]==='string').map(key=>[key,input[key].slice(0,120)]));}catch{return {};}
}
export function saveStagingRegistrationDraft(input:Record<string,string>){
  if(!STAGING_CONVERSATION_ENABLED || !isPagesDemoMode())return;
  try{sessionStorage.setItem(KEY,JSON.stringify(Object.fromEntries(fields.map(key=>[key,(input[key] || '').slice(0,120)]))));}catch{/* browser storage is optional; original server partial registration remains available */}
}
export function clearStagingRegistrationDraft(){if(STAGING_CONVERSATION_ENABLED){try{sessionStorage.removeItem(KEY);for(const key of ['phone','otp','profile','plans'])sessionStorage.removeItem(`baly-staging-question:${key}`);}catch{/* Successful original registration must not fail because draft cleanup was blocked. */}}}
