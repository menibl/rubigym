import React,{useEffect,useMemo,useRef} from 'react';
import type {User} from '../types';
import {accountChatSnapshot,STAGING_CONVERSATION_ENABLED} from '../prototype/integration';
import {initialDraft} from '../prototype/model';

export function StagingConversationFrame({mode,onClose,activeUser,users=[]}: {
  mode:'registration'|'membership';onClose:()=>void;activeUser?:User;users?:User[];
}) {
  const frame=useRef<HTMLIFrameElement>(null);
  const close=useRef<HTMLButtonElement>(null);
  const draft=useMemo(()=>mode==='membership' && activeUser ? accountChatSnapshot(activeUser,users):{...initialDraft(),step:'kind'},[mode,activeUser,users]);
  const snapshotVersion=JSON.stringify(draft.members).split('').reduce((hash,c)=>Math.imul(hash^c.charCodeAt(0),16777619),2166136261)>>>0;
  const scope=`${mode}:${activeUser?.id || 'guest'}:${snapshotVersion.toString(16)}`;
  const initialize=()=>frame.current?.contentWindow?.postMessage({type:'BALY_CHAT_DEMO_INIT',draft,scope},window.location.origin);
  useEffect(()=>{
    if(!STAGING_CONVERSATION_ENABLED) return;
    const previous=document.activeElement as HTMLElement | null;
    const overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';close.current?.focus();
    const ready=(event:MessageEvent)=>{
      if(event.origin===window.location.origin && event.source===frame.current?.contentWindow && event.data?.type==='BALY_CHAT_DEMO_READY') initialize();
    };
    window.addEventListener('message',ready);
    return ()=>{document.body.style.overflow=overflow;window.removeEventListener('message',ready);previous?.focus();};
  },[draft,scope]);
  if(!STAGING_CONVERSATION_ENABLED) return null;
  return <section role="dialog" aria-modal="true" aria-labelledby="staging-chat-title" style={{position:'fixed',inset:0,zIndex:10000,background:'#101218',display:'flex',flexDirection:'column',height:'100dvh'}} dir="rtl">
    <header style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:12,padding:'10px 16px',borderBottom:'1px solid #45404e',background:'#171923',color:'#eee'}}>
      <strong id="staging-chat-title" style={{fontSize:14,flex:1}}>{mode==='registration' ? 'הרשמה בצ׳אט':'המנוי והתשלומים שלי — בצ׳אט'} · סביבת בדיקות</strong>
      <button ref={close} type="button" onClick={onClose} style={{minHeight:44,padding:'8px 16px',border:'1px solid #83748e',borderRadius:10,color:'#eee',background:'#242735',cursor:'pointer'}}>{mode==='registration' ? 'כבר רשומים? לכניסה':'חזרה לאפליקציה'}</button>
    </header>
    <iframe key={scope} ref={frame} title={mode==='registration' ? 'שאלון רישום מדומה':'שאלון ניהול מנוי ותשלום מדומה'}
      src={`${import.meta.env?.BASE_URL || '/rubigym/'}conversation-prototype.html?embedded=${mode}`}
      onLoad={initialize} sandbox="allow-scripts allow-same-origin allow-modals"
      style={{border:0,width:'100%',flex:1,minHeight:0,background:'#101218'}}/>
  </section>;
}
