import React from 'react';
import {chatUiAvailable,chatUiEnabled,rememberChatInterface} from './integration';

export function ChatInterfaceSwitch(){
  if(!chatUiAvailable())return null;
  return <button type="button" className="logic-secondary" onClick={()=>{
    const next=chatUiEnabled() ? 'legacy':'chat';rememberChatInterface(next);
    const url=new URL(window.location.href);url.searchParams.set('ui',next);window.location.assign(url.href);
  }}>{chatUiEnabled() ? 'חזרה לממשק הישן':'מעבר לממשק הצ׳אט'}</button>;
}
