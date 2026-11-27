import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {productionChatBuildEnabled} from './buildFlags';

test('production chat is opt-in; Pages and isolated builds cannot inherit its flag',()=>{
  for(const [event,flag,expected] of [['build',undefined,false],['build','true',true],['build','false',false],['build:pages','true',false],['build:chat-test','true',false],['dev','true',false]] as const)assert.equal(productionChatBuildEnabled(event,flag),expected);
  const vite=readFileSync(new URL('../../vite.config.ts',import.meta.url),'utf8');
  assert.match(vite,/productionChatBuildEnabled\(process.env.npm_lifecycle_event,process.env.VITE_CHAT_UI_ENABLED\)/);
  assert.match(vite,/__PRODUCTION_CHAT__:JSON.stringify\(productionChat\)/);
  const docker=readFileSync(new URL('../../Dockerfile',import.meta.url),'utf8');
  const compose=readFileSync(new URL('../../deploy/compose.yaml',import.meta.url),'utf8');
  assert.match(docker,/ARG VITE_CHAT_UI_ENABLED=false/);
  assert.match(compose,/VITE_CHAT_UI_ENABLED: \$\{VITE_CHAT_UI_ENABLED:-false\}/);
});

test('production chat renders original fields, never demo notices, and legacy preference survives navigation without changing storage',async()=>{
  const globals=globalThis as Record<string,unknown>;
  const previous={window:globals.window,sessionStorage:globals.sessionStorage};
  try{
    const values=new Map<string,string>([['baly_rivhit_pending_payment_v1','unchanged-pending-fixture']]);
    globals.sessionStorage={getItem:(key:string)=>values.get(key) || null,setItem:(key:string,value:string)=>values.set(key,value)};
    globals.window={location:{hostname:'baly.example.invalid',origin:'https://baly.example.invalid',search:''}};
    const source=`import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import {StagingRegistrationSurface} from './src/prototype/StagingLogicChat.tsx'; export * from './src/prototype/integration.ts'; export const markup=()=>renderToStaticMarkup(React.createElement(StagingRegistrationSurface,null,React.createElement('input',{name:'original-birth',type:'date',value:'1990-01-01',readOnly:true})));`;
    for(const enabled of [false,true]){
      // Bundle React too, so the in-memory module has no external resolution.
      const selfContained=await build({stdin:{contents:source,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',banner:{js:`import {createRequire} from 'node:module';const require=createRequire(${JSON.stringify(resolve('package.json'))});`},define:{__CONVERSATION_PROTOTYPE__:'false',__CHAT_ORIGINAL_TEST__:'false',__PRODUCTION_CHAT__:String(enabled),'import.meta.env':JSON.stringify({VITE_APP_MODE:'server'}),'process.env.NODE_ENV':'"production"'}});
      const module=await import('data:text/javascript;base64,'+Buffer.from(selfContained.outputFiles[0].contents).toString('base64'));
      const win=globals.window as {location:{search:string}};win.location.search='?ui=chat';
      assert.equal(module.chatUiAvailable(),enabled);assert.equal(module.chatUiEnabled(),enabled);
      assert.equal(module.ORIGINAL_CHAT_TEST_ENABLED,false);assert.equal(module.STAGING_CONVERSATION_ENABLED,false);
      assert.equal(module.CONNECTED_CHAT_ENABLED,enabled);
      const html=module.markup();assert.match(html,/name="original-birth"/);assert.match(html,/value="1990-01-01"/);
      if(enabled){
        assert.match(html,/הרשמה בצ׳אט/);assert.doesNotMatch(html,/נתוני בדיקה בלבד|DB מבודד|staging ·/);
        module.rememberChatInterface('legacy');win.location.search='';assert.equal(module.chatUiEnabled(),false);
        win.location.search='?ui=chat';assert.equal(module.chatUiEnabled(),true);
        module.rememberChatInterface('chat');win.location.search='';assert.equal(module.chatUiEnabled(),true);
      }
      assert.equal(values.get('baly_rivhit_pending_payment_v1'),'unchanged-pending-fixture');
    }
  }finally{globals.window=previous.window;globals.sessionStorage=previous.sessionStorage;}
});
