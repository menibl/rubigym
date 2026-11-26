import React from 'react';
import {chatUiAvailable,chatUiEnabled} from './integration';

export function ChatInterfaceSwitch(){
  if(!chatUiAvailable())return null;
  return <button type="button" className="logic-secondary" onClick={()=>{
    const url=new URL(window.location.href);url.searchParams.set('ui',chatUiEnabled() ? 'legacy':'chat');window.location.assign(url.href);
  }}>{chatUiEnabled() ? 'חזרה לממשק הישן':'מעבר לממשק הצ׳אט'}</button>;
}
