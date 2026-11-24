import React from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import './mobile.css';

// A second runtime gate protects against accidentally hosting Pages assets on production.
const allowed = __CONVERSATION_PROTOTYPE__ && (location.hostname === 'menibl.github.io' || ['localhost','127.0.0.1'].includes(location.hostname));
if (allowed) {
  const embedded=new URLSearchParams(location.search).get('embedded');
  if ((embedded==='registration' || embedded==='membership') && window.parent!==window) {
    let initialized=false;
    window.addEventListener('message',event=>{
      if(initialized || event.source!==window.parent || event.origin!==location.origin || event.data?.type!=='BALY_CHAT_DEMO_INIT') return;
      const {draft,scope}=event.data;
      if(typeof scope!=='string' || scope.length>180 || !scope.startsWith(`${embedded}:`)) return;
      initialized=true;
      void Promise.all([import('./Conversation'),import('./model')]).then(([{Conversation},{readDraft,STORAGE_KEY}])=>{
        const storageKey=`${STORAGE_KEY}:embedded:${scope}`;
        const createAccount=embedded==='registration' ? (draft:import('./model').Draft,verifiers:string[])=>new Promise<void>((resolve,reject)=>{
          let registrationId=localStorage.getItem(`${storageKey}:registrationId`);
          if(!registrationId){registrationId=crypto.randomUUID();localStorage.setItem(`${storageKey}:registrationId`,registrationId);}
          const requestId=crypto.randomUUID();
          const finish=(event:MessageEvent)=>{
            if(event.origin!==location.origin || event.source!==window.parent || event.data?.type!=='BALY_CHAT_DEMO_ACCOUNT_RESULT' || event.data.requestId!==requestId) return;
            clearTimeout(timeout);window.removeEventListener('message',finish);
            if(event.data.ok) resolve();else reject(new Error(String(event.data.message || 'שמירת חשבון הדמה נכשלה.')));
          };
          const timeout=setTimeout(()=>{window.removeEventListener('message',finish);reject(new Error('לא התקבל אישור שמירה. אפשר לנסות שוב; לא ייווצר חשבון כפול.'));},15000);
          window.addEventListener('message',finish);
          window.parent.postMessage({type:'BALY_CHAT_DEMO_CREATE_ACCOUNT',requestId,registrationId,draft,verifiers},location.origin);
        }):undefined;
        createRoot(document.getElementById('root')!).render(<Conversation embedded initialState={readDraft(JSON.stringify(draft))} storageKey={storageKey} resume onCreateDemoAccount={createAccount} />);
      });
    });
    window.parent.postMessage({type:'BALY_CHAT_DEMO_READY'},location.origin);
  } else {
    void import('./Conversation').then(({ Conversation }) => createRoot(document.getElementById('root')!).render(<Conversation />));
  }
} else {
  document.getElementById('root')!.textContent = 'אב־הטיפוס זמין בסביבת הבדיקות בלבד.';
}
