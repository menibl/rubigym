import React from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import './mobile.css';

// A second runtime gate protects against accidentally hosting Pages assets on production.
const allowed = __CONVERSATION_PROTOTYPE__ && (location.hostname === 'menibl.github.io' || ['localhost','127.0.0.1'].includes(location.hostname));
if (allowed) {
  void import('./Conversation').then(({ Conversation }) => createRoot(document.getElementById('root')!).render(<Conversation />));
} else {
  document.getElementById('root')!.textContent = 'אב־הטיפוס זמין בסביבת הבדיקות בלבד.';
}
