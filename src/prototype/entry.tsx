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
        createRoot(document.getElementById('root')!).render(<Conversation embedded initialState={readDraft(JSON.stringify(draft))} storageKey={`${STORAGE_KEY}:embedded:${scope}`} resume />);
      });
    });
    window.parent.postMessage({type:'BALY_CHAT_DEMO_READY'},location.origin);
  } else {
    void import('./Conversation').then(({ Conversation }) => createRoot(document.getElementById('root')!).render(<Conversation />));
  }
} else {
  document.getElementById('root')!.textContent = 'אב־הטיפוס זמין בסביבת הבדיקות בלבד.';
}
