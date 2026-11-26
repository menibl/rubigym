// Full client-adapter -> HTTP -> original worker -> PostgreSQL -> fake-provider flow.
// No production configuration, scheduler, network service or environment file is used.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {build} from 'esbuild';
import pg from 'pg';
import {createDatabaseStore} from '../server/database.js';
import worker from '../server/index.js';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import {extname,sep} from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const [portArg,optIn]=process.argv.slice(2);
const serve=process.argv.includes('--serve');
assert.equal(optIn,'--isolated-postgres');
const dbPort=Number(portArg);assert.ok(Number.isInteger(dbPort) && dbPort>1024);
const database=`gymflow_chat_e2e_${Date.now()}`;
assert.match(database,/^gymflow_chat_e2e_\d+$/);
const admin=new pg.Client({host:'127.0.0.1',port:dbPort,user:'gymflow_test',database:'postgres',ssl:false});
await admin.connect();
try{
  // The client always connects to loopback. In CI Docker's published-loopback
  // port legitimately reports a private container inet_server_addr() in SQL.
  assert.equal(admin.connectionParameters.host,'127.0.0.1');
  const identity=(await admin.query('SELECT current_database() AS db,current_user AS role,version()')).rows[0];
  assert.equal(identity.db,'postgres');assert.equal(identity.role,'gymflow_test');assert.match(identity.version,/PostgreSQL 17\./);
  await admin.query(`CREATE DATABASE "${database}"`);
}finally{await admin.end();}
const dbUrl=`postgresql://gymflow_test@127.0.0.1:${dbPort}/${database}`;
const store=await createDatabaseStore(dbUrl,'false');
const catalog=[{id:'OPEN_GYM',label:'Fixture Open',price:281,active:true,category:'PRIMARY',paymentMode:'RECURRING',billingPeriod:'MONTHLY_ANNUAL_COMMITMENT'},
  {id:'WORKOUT_COACHING',label:'Fixture Program',price:300,active:true,category:'ADD_ON',paymentMode:'ONE_TIME',billingPeriod:'THREE_MONTHS'},
  {id:'PERSONAL_TRAINING',label:'Fixture Personal',price:173,active:true,category:'ADD_ON',paymentMode:'ONE_TIME',billingPeriod:'SESSION_PACK',supportsTrainingCard:true},
  {id:'DUO_TRAINING',label:'Fixture Duo',price:141,active:true,category:'ADD_ON',paymentMode:'ONE_TIME',billingPeriod:'SESSION_PACK',supportsTrainingCard:true}];
await store.putClubState('isolated-chat',{users:[],payments:[],messages:[],settings:{membershipPlans:catalog},discountCodes:[{id:'fixture-discount',code:'SAVE13',discountPercent:13,isSingleUse:true,isUsed:false}]},0);
let origin,providerCreates=0,providerReads=0,externalAttempts=0,httpRequests=0,cookie='',assigned='';
const signed=new Map(),redirects=new Map(),finished=new Set();
const env={STATE_STORE:store,CLUB_ID:'isolated-chat',SMS_TEST_MODE:'true',SMS_OTP_SIGNING_SECRET:'isolated-fixture-only-signing-value',
  RIVHIT_ENVIRONMENT:'test',RIVHIT_GROUP_PRIVATE_TOKEN:'isolated-fixture-only',RIVHIT_RECURRING_GROUP_PRIVATE_TOKEN:'isolated-fixture-only',
  PAYMENT_SIGNING_SECRET:'isolated-fixture-payment-only',RIVHIT_ENABLE_RECURRING:'true',RIVHIT_ENABLE_FAMILY_SPLIT_RECURRING:'true',RIVHIT_RECURRING_CALENDAR_VERIFIED:'true',
  RIVHIT_FETCH:async(url,init)=>{
    const body=JSON.parse(init.body);
    if(url.endsWith('/GetUrl')){
      const id=`fixture-sale-${++providerCreates}`;
      signed.set(id,{SaleId:id,Custom1:body.Custom1,Amount:body.Items[0].UnitPrice,TransactionAmount:body.Items[0].UnitPrice,
        CustomerTransactionId:`fixture-tx-${providerCreates}`,...(body.CreateRecurringSale ? {RecurringId:`fixture-series-${providerCreates}`,RecurringSaleChargeNumber:0,TransactionStatus:0,TransactionParamJ:5}:{})});
      redirects.set(id,body.RedirectURL);
      return Response.json({Status:0,URL:`https://testicredit.rivhit.co.il/payment/${id}`,PrivateSaleToken:id});
    }
    providerReads++;
    if(url.endsWith('/SaleDetails')){const id=body.SalePrivateToken || body.SaleId;return Response.json({Status:0,data:serve && !finished.has(id) ? []:[signed.get(id)]});}
    if(url.endsWith('/Verify'))return Response.json({Status:'VERIFIED'});
    throw new Error('Unrecognized fake-provider operation');
  }};
const originalFetch=globalThis.fetch;
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,origin);
    if(serve && url.pathname==='/__mock_checkout'){
      const reference=new URL(url.searchParams.get('reference') || 'https://invalid.test/');
      const id=reference.pathname.split('/').pop();
      if(reference.origin!=='https://testicredit.rivhit.co.il' || !signed.has(id)){res.writeHead(404);res.end('Unknown fixture');return;}
      if(url.searchParams.get('complete')==='1'){finished.add(id);res.writeHead(302,{Location:redirects.get(id)});res.end();return;}
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
      res.end(`<html dir="rtl"><meta name="viewport" content="width=device-width"><h1>ספק תשלום מדומה בלבד</h1><p>אין להזין פרטי אשראי. אפשר לחזור לאפליקציה בלי להשלים, או להשלים את עסקת הדמה.</p><a href="${url.pathname+url.search}&complete=1">השלמת תשלום דמה וחזרה לאפליקציה</a></html>`);return;
    }
    if(serve && !url.pathname.startsWith('/api/')){
      const dist=resolve(root,'dist');const target=resolve(dist,'.'+decodeURIComponent(url.pathname==='/' ? '/index.html':url.pathname));
      if(!target.startsWith(dist+sep)){res.writeHead(403);res.end();return;}
      let content;try{content=await readFile(target);}catch{res.writeHead(404);res.end('Not found');return;}
      const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.mjs':'text/javascript'};
      res.writeHead(200,{'Content-Type':mime[extname(target)] || 'application/octet-stream','Cache-Control':'no-store'});res.end(content);return;
    }
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const result=await worker.fetch(new Request(origin+req.url,{method:req.method,headers:req.headers,
      ...(['GET','HEAD'].includes(req.method) ? {}:{body:Buffer.concat(chunks),duplex:'half'})}),env);
    res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));
  }catch{res.writeHead(500);res.end(JSON.stringify({message:'Isolated test request failed'}));}
});
await new Promise(resolve=>server.listen(serve ? 55440:0,'127.0.0.1',resolve));
origin=`http://127.0.0.1:${server.address().port}`;env.PUBLIC_APP_URL=origin+'/';
if(serve){
  globalThis.fetch=async()=>{externalAttempts++;throw new Error('External HTTP forbidden in the fixture server');};
  console.log(`Isolated chat UI: ${origin}/?screen=register — fictional data only; OTP 1111; no real provider/SMS.`);
  await new Promise(done=>process.once('SIGINT',done));
  await new Promise(done=>server.close(done));await store.close();process.exit(0);
}
const fakeStorage=()=>{const values=new Map();return{getItem:key=>values.get(key) ?? null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};};
globalThis.localStorage=fakeStorage();globalThis.sessionStorage=fakeStorage();
globalThis.window={location:{origin,hostname:'127.0.0.1',href:origin+'/',assign(url){assert.equal(new URL(url).origin,origin);assigned=url;},reload(){}},
  history:{replaceState(_state,_title,url){window.location.href=new URL(url,origin).href;}},confirm:()=>true,alert:()=>{},dispatchEvent:()=>{}};
globalThis.fetch=async(input,init={})=>{
  const url=new URL(typeof input==='string' ? input:input.url || input.href);
  if(url.origin!==origin){externalAttempts++;throw new Error('Non-loopback HTTP forbidden');}
  httpRequests++;
  const response=await originalFetch(url,{...init,headers:{...Object.fromEntries(new Headers(init.headers)),...(cookie ? {Cookie:cookie}:{})}});
  const set=response.headers.get('Set-Cookie');if(set)cookie=set.split(';')[0];
  return response;
};
try{
  const bundle=await build({stdin:{contents:`export {requestPhoneCode,verifyRegistrationPhone,registerServerUser,registerFamilyMember,getClubState,loginWithPassword} from './src/data/clubServer.ts'; export {requestOriginalCheckoutQuote,refreshOriginalCheckoutQuote,originalQuoteMatchesSelections,startRivhitPayment,continueFamilySplitPayment,getPendingRivhitPayment} from './src/data/rivhitPayments.ts'; export {chatUiEnabled,chatUiAvailable} from './src/prototype/integration.ts';`,resolveDir:root},bundle:true,write:false,format:'esm',platform:'browser',
    define:{'__CONVERSATION_PROTOTYPE__':'false','__CHAT_ORIGINAL_TEST__':'true','import.meta.env':JSON.stringify({VITE_APP_MODE:'server',VITE_API_URL:origin,VITE_PAYMENT_API_URL:origin})}});
  const client=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].contents).toString('base64'));
  assert.equal(client.chatUiEnabled(),true);
  window.location.href=origin+'/?ui=legacy';window.location.search='?ui=legacy';assert.equal(client.chatUiEnabled(),false);
  window.location.search='?ui=chat';assert.equal(client.chatUiEnabled(),true);
  await client.requestPhoneCode('0500000201','REGISTER');
  const phone=await client.verifyRegistrationPhone('0500000201','1111');
  const payer={id:phone.registrationUserId,name:'Fixture Parent',username:'fixture-parent',email:'parent@example.invalid',phone:'0500000201',password:'Fixture-Password-123!',role:'TRAINEE',birthDate:'1990-01-01',gender:'FEMALE',
    healthDeclarationSigned:true,healthDeclarationAnswers:{heart:'NO'},healthDeclarationSignatureName:'Fixture Parent',clubAgreementSigned:true,clubAgreementDate:'2026-11-26'};
  await client.registerServerUser(payer,undefined,[],phone.phoneVerificationToken);
  await client.loginWithPassword('fixture-parent',payer.password);
  const child={id:'fixture-child',name:'Fixture Child',username:'fixture-child',email:payer.email,phone:'',password:'Fixture-Child-123!',role:'TRAINEE',birthDate:'2012-01-01',gender:'FEMALE',healthDeclarationSigned:true,clubAgreementSigned:true,
    familyId:`fam-${payer.id}`,familyName:'Fixture Family',familyPayerId:payer.id,healthDeclarationParentConsent:true,healthDeclarationParentName:payer.name};
  await client.registerFamilyMember(child);
  const loaded=await client.getClubState();assert.equal(loaded.payload.users.length,2);
  assert.equal(loaded.payload.users.find(user=>user.id===child.id).familyPayerId,payer.id);
  const selection=[{memberId:payer.id,memberName:payer.name,participation:'INCLUDED',membershipType:'OPEN_GYM'},
    {memberId:child.id,memberName:child.name,participation:'INCLUDED',membershipType:'PERSONAL_TRAINING',trainingSessionsCount:2,additionalPlans:[{membershipType:'DUO_TRAINING',trainingSessionsCount:1}]}];
  const request={userId:payer.id,userName:payer.name,email:payer.email,phone:payer.phone,membershipType:'FAMILY_MEMBERSHIP',mode:'PRIMARY',familyBillingMode:'CUSTOM_COMBINED',familyMembersCount:2,familyMemberPlans:selection,discountCode:'SAVE13'};
  const quote=await client.requestOriginalCheckoutQuote(request);assert.equal(providerCreates,0);
  assert.equal(quote.items.filter(item=>item.recurring).length,1);assert.equal(quote.items.filter(item=>!item.recurring).length,1);
  assert.equal(quote.items.reduce((sum,item)=>sum+Math.round(item.amount*100),0),66816);
  assert.equal(client.originalQuoteMatchesSelections(request,quote),true);
  const changed=structuredClone(request);changed.familyMemberPlans[1].trainingSessionsCount=3;
  assert.equal(client.originalQuoteMatchesSelections(changed,quote),false);
  const revised=await client.refreshOriginalCheckoutQuote(changed,quote.batchId);
  assert.equal(client.originalQuoteMatchesSelections(changed,revised),true);assert.equal(providerCreates,0);
  await client.refreshOriginalCheckoutQuote(request,revised.batchId);
  await client.startRivhitPayment(request);assert.equal(providerCreates,1);assert.match(assigned,/__mock_checkout/);
  const pending=client.getPendingRivhitPayment();assert.ok(pending.familySplitBatchId);
  // Back/resume the original saved page: no duplicate provider dispatch.
  await client.startRivhitPayment(request);assert.equal(providerCreates,1);
  await client.continueFamilySplitPayment(pending.familySplitBatchId,payer.id,pending.familySplitItemId);
  assert.equal(providerCreates,2); // the distinct one-time group, not a duplicate series
  const second=client.getPendingRivhitPayment();assert.notEqual(second.familySplitItemId,pending.familySplitItemId);
  await client.continueFamilySplitPayment(second.familySplitBatchId,payer.id,second.familySplitItemId);
  const complete=await store.getClubState('isolated-chat');
  assert.equal(complete.payload.users.find(user=>user.id===child.id).personalTrainingRemaining,2);
  assert.equal(complete.payload.users.find(user=>user.id===child.id).duoTrainingRemaining,1);
  assert.equal(complete.payload.users.find(user=>user.id===payer.id).recurringMemberships.OPEN_GYM.status,'PENDING_FIRST_CHARGE');
  assert.ok(complete.payload.payments.every(payment=>payment.isMock));
  const paymentCount=complete.payload.payments.length;
  await client.continueFamilySplitPayment(second.familySplitBatchId,payer.id,second.familySplitItemId);
  assert.equal((await store.getClubState('isolated-chat')).payload.payments.length,paymentCount);
  assert.equal(providerCreates,2);assert.equal(externalAttempts,0);
  const nextReview=await client.requestOriginalCheckoutQuote({...request,discountCode:undefined});
  assert.equal(nextReview.items.find(item=>item.recurring).status,'EXISTING_RECURRING');
  assert.equal(providerCreates,2);assert.equal(externalAttempts,0);
  console.log(JSON.stringify({ok:true,database,httpRequests,fakeProviderCreates:providerCreates,fakeProviderReads:providerReads,externalAttempts,
    checks:['client registration and fake OTP over HTTP','family addition persisted in PostgreSQL','old/chat interface switch','original server cents and discounts','mixed recurring/one-off continuation','abandoned checkout resumes without duplicate','pending-first-charge vs paid semantics','personal/duo beneficiary balances','duplicate verification idempotent']},null,2));
}catch(error){console.error('Connected runtime test failed:',error.message);process.exitCode=1;}finally{
  globalThis.fetch=originalFetch;await new Promise(resolve=>server.close(resolve));await store.close();
}
