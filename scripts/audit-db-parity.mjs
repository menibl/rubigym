// Explicit, isolated PostgreSQL audit. Never reads environment files or starts the app/schedulers.
import assert from 'node:assert/strict';
import {resolve,join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import pg from 'pg';
import ts from 'typescript';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const [mainRootArg,portArg,confirmation]=process.argv.slice(2);
assert.equal(confirmation,'--isolated-postgres','Explicit isolated DB opt-in required');
const mainRoot=resolve(mainRootArg || '');
const port=Number(portArg);
assert.ok(Number.isInteger(port) && port>=1024 && port<=65535);
const connection=database=>({host:'127.0.0.1',port,user:'gymflow_test',database,ssl:false});
const prefix=`gymflow_parity_${Date.now()}`;
const databases=[`${prefix}_main`,`${prefix}_staging`];
let networkAttempts=0;
globalThis.fetch=async()=>{networkAttempts++;throw new Error('External HTTP is forbidden in the isolated DB audit');};
const importFrom=(directory,file)=>import(pathToFileURL(join(directory,file)).href);
const {stagingCheckoutQuote}=await importFrom(root,'src/prototype/stagingCheckout.ts');
const gitSha=directory=>execFileSync('git',['rev-parse','HEAD'],{cwd:directory,encoding:'utf8'}).trim();
const json=value=>JSON.parse(JSON.stringify(value));
const normalize=value=>{
  if(Array.isArray(value))return value.map(normalize);
  if(value && typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,normalize(value[key])]));
  if(typeof value==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value))return '<generated-time>';
  if(typeof value==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))return '<generated-uuid>';
  return value;
};

// Compare the actual original/chat form DTO initializers, rather than claiming that
// equal hand-written fixtures alone prove frontend field mapping parity.
function initializer(directory,file,name){
  const source=ts.createSourceFile(file,readFileSync(join(directory,file),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let result;
  const visit=node=>{if(ts.isVariableDeclaration(node) && node.name.getText(source)===name && node.initializer)result=node.initializer;ts.forEachChild(node,visit);};
  visit(source);assert.ok(result,`Missing DTO initializer ${name}`);
  return ts.createPrinter({removeComments:true}).printNode(ts.EmitHint.Expression,result,source);
}
for(const [file,name] of [['src/components/AuthGateway.tsx','newUser'],['src/components/AuthGateway.tsx','familyUsers'],['src/components/UserSettingsModal.tsx','newSubUser']]){
  assert.equal(initializer(root,file,name),initializer(mainRoot,file,name),`Frontend DTO differs: ${name}`);
}
for(const file of ['server/database.js','server/index.js','server/auth.js','server/family-split.js','shared/family-pricing.js','shared/family-multiple-plans.js','src/data/familyMembership.ts','src/types.ts']){
  assert.equal(readFileSync(join(root,file),'utf8'),readFileSync(join(mainRoot,file),'utf8'),`Core logic changed: ${file}`);
}

const admin=new pg.Client(connection('postgres'));
await admin.connect();
try {
  const server=await admin.query('SELECT version(),host(inet_server_addr()) AS host');
  assert.equal(server.rows[0].host,'127.0.0.1');
  assert.match(server.rows[0].version,/PostgreSQL 17\./);
  for(const database of databases){assert.match(database,/^gymflow_parity_\d+_(main|staging)$/);await admin.query(`CREATE DATABASE "${database}"`);}
} finally {await admin.end();}

const catalog=[{id:'OPEN_GYM',label:'בדיקה Open',price:281,active:true,category:'PRIMARY',paymentMode:'RECURRING',billingPeriod:'MONTHLY_ANNUAL_COMMITMENT'},
  {id:'WORKOUT_COACHING',label:'בדיקה תוכנית',price:300,active:true,category:'ADD_ON',paymentMode:'ONE_TIME',billingPeriod:'THREE_MONTHS'},
  {id:'PERSONAL_TRAINING',label:'בדיקה אישי',price:173,active:true,category:'ADD_ON',paymentMode:'ONE_TIME',billingPeriod:'SESSION_PACK',supportsTrainingCard:true},
  {id:'DUO_TRAINING',label:'בדיקה זוגי',price:141,active:true,category:'ADD_ON',paymentMode:'ONE_TIME',billingPeriod:'SESSION_PACK',supportsTrainingCard:true}];
const coupons=[{id:'percent',code:'P13',discountPercent:13},{id:'fixed',code:'FIXED',discountAmount:99.99},
  {id:'used',code:'USED',discountAmount:10,isSingleUse:true,isUsed:true},{id:'single',code:'SINGLE',discountAmount:10,isSingleUse:true,isUsed:false}];
const health={healthDeclarationSigned:true,healthDeclarationDate:'2026-11-26',healthDeclarationAnswers:{heart:'NO'},healthDeclarationSignatureName:'בדיקה נבדק',
  healthDeclarationRequiresMedicalCertificate:false,healthDeclarationMedicalCertificateApproved:false,
  clubAgreementSigned:true,clubAgreementDate:'2026-11-26',pushNotificationsEnabled:false,workoutRemindersEnabled:false};
const person=(id,extra={})=>({id,name:`בדיקה ${id}`,username:`test-${id}`,email:`${id}@example.invalid`,phone:'',password:'Fictional-Test-Only-123!',role:'TRAINEE',birthDate:'1990-01-01',gender:'FEMALE',...health,...extra});

async function run(directory,database){
  const {createDatabaseStore}=await importFrom(directory,'server/database.js');
  const {default:worker}=await importFrom(directory,'server/index.js');
  const {createPhoneVerificationToken}=await importFrom(directory,'server/sms-auth.js');
  const store=await createDatabaseStore(`postgresql://gymflow_test@127.0.0.1:${port}/${database}`,'false');
  let storeClosed=false;
  const inspect=new pg.Client(connection(database));await inspect.connect();
  const env={STATE_STORE:store,CLUB_ID:'parity',SMS_TEST_MODE:'true',SMS_OTP_SIGNING_SECRET:'isolated-fixture-signing-not-live',
    RIVHIT_ENVIRONMENT:'test',RIVHIT_GROUP_PRIVATE_TOKEN:'isolated-fixture-not-live',RIVHIT_RECURRING_GROUP_PRIVATE_TOKEN:'isolated-fixture-not-live',
    RIVHIT_ENABLE_RECURRING:'true',RIVHIT_ENABLE_FAMILY_SPLIT_RECURRING:'true',RIVHIT_RECURRING_CALENDAR_VERIFIED:'true',
    PAYMENT_SIGNING_SECRET:'isolated-fixture-payment-signing-not-live',PUBLIC_APP_URL:'https://club.test/',
    RIVHIT_FETCH:async()=>{networkAttempts++;throw new Error('Provider requests forbidden');}};
  const outcomes=[];
  const request=async(path,body,cookie)=>{
    const response=await worker.fetch(new Request(`https://club.test${path}`,{method:body===undefined ? 'GET':'POST',headers:{'Content-Type':'application/json',...(cookie ? {Cookie:cookie}:{})},...(body===undefined ? {}:{body:JSON.stringify(body)})}),env);
    return {status:response.status,body:await response.json(),cookie:response.headers.get('Set-Cookie')?.split(';')[0]};
  };
  const state=()=>store.getClubState('parity');
  const update=async transform=>{const before=await state();const result=await store.putClubState('parity',transform(before.payload),before.revision);assert.equal(result.conflict,false);};
  // Independent fixture cases must not resume the prior case's saved quote.
  const resetQuote=async()=>{const previous=await store.getFamilySplitCheckout('parity','payer');if(previous.payload)assert.equal(await store.putFamilySplitCheckout('parity','payer',{id:'fixture-reset',items:[],cancelled:true},previous.revision),true);};
  const compareChatQuote=async(body,result)=>{
    const quote=stagingCheckoutQuote(body,(await state()).payload);
    const serverLines=result.items.flatMap(item=>item.groupLines || [item]);
    const project=lines=>lines.map(line=>({id:line.id,memberId:line.memberId,membershipType:line.membershipType,
      amount:line.amount,baseAmount:line.baseAmount,discountAmount:line.discountAmount,status:line.status,
      includedSessions:line.includedSessions,recurring:line.recurring})).sort((a,b)=>a.id.localeCompare(b.id));
    assert.deepEqual(json(project(quote.lines)),json(project(serverLines)),'Chat and original DB-backed checkout line prices differ');
    assert.equal(Math.round(quote.total*100),result.items.filter(item=>item.status==='READY').reduce((sum,item)=>sum+Math.round(item.amount*100),0));
  };
  const register=async(user,familyUsers=[])=>{
    const phoneVerificationToken=await createPhoneVerificationToken({env,clubId:'parity',phone:user.phone});
    const result=await request('/api/auth/register',{user,familyUsers,phoneVerificationToken});
    assert.equal(result.status,201,JSON.stringify(result.body));
    for(const entry of [result.body.user,...(result.body.familyUsers || [])]){
      const profile=(await inspect.query('SELECT profile FROM auth_accounts WHERE club_id=$1 AND user_id=$2',['parity',entry.id])).rows[0]?.profile;
      const canonical=(await state()).payload.users.find(candidate=>candidate.id===entry.id);
      assert.deepEqual(profile,canonical);assert.deepEqual(profile,json(entry));
      const source=[user,...familyUsers].find(candidate=>candidate.id===entry.id);
      for(const field of ['name','username','email','phone','birthDate','gender','healthDeclarationSigned','healthDeclarationAnswers','healthDeclarationSignatureName',
        'healthDeclarationMedicalCertificateDataUrl','healthDeclarationMedicalCertificateFileName','healthDeclarationParentConsent','healthDeclarationParentName','healthDeclarationParentIdNumber',
        'healthDeclarationHistory','clubAgreementSigned','clubAgreementDate','familyId','familyName','familyPayerId','familyMemberPlans']){
        if(source[field]!==undefined)assert.deepEqual(profile[field],source[field],`SQL field ${field}`);
      }
      assert.equal('password' in canonical,false);assert.equal(canonical.membershipStatus,'DEBT');
      assert.equal(canonical.healthDeclarationMedicalCertificateApproved,false);
    }
    const login=await request('/api/auth/login',{login:user.username,password:user.password});assert.equal(login.status,200);
    assert.equal((await request('/api/state',undefined,login.cookie)).status,200);
    return result;
  };
  try {
    await store.putClubState('parity',{users:[],payments:[],messages:[],settings:{membershipPlans:catalog},discountCodes:coupons},0);
    await register(person('adult',{phone:'0500000101'}));
    await register(person('medical',{phone:'0500000102',healthDeclarationAnswers:{heart:'YES'},healthDeclarationRequiresMedicalCertificate:true,healthDeclarationMedicalCertificateApproved:true,
      healthDeclarationMedicalCertificateFileName:'fixture.txt',healthDeclarationMedicalCertificateDataUrl:'data:text/plain;base64,VGVzdA==',
      healthDeclarationHistory:[{id:'fixture-medical',signed:true,answers:{heart:'YES'},medicalCertificateApproved:false}]}));
    await register(person('minor',{phone:'0500000103',birthDate:'2012-01-01',healthDeclarationParentConsent:true,healthDeclarationParentName:'הורה בדיקה',healthDeclarationParentIdNumber:'111111111'}));
    const payer=person('payer',{phone:'0500000104',familyId:'family-fixture',familyName:'משפחת בדיקה',isFamilyPayer:true,familyMembersCount:2,familyBillingMode:'CUSTOM_COMBINED',
      familyMemberPlans:[{memberId:'payer',memberName:'בדיקה payer',participation:'INCLUDED',membershipType:'OPEN_GYM'},{memberId:'child',memberName:'בדיקה child',participation:'INCLUDED',membershipType:'WORKOUT_COACHING'}]});
    const child=person('child',{familyId:payer.familyId,familyPayerId:payer.id,birthDate:'2012-01-01'});
    const registered=await register(payer,[child]);
    const sibling=person('sibling',{familyId:payer.familyId,familyPayerId:payer.id,familyName:payer.familyName,healthDeclarationRequiresMedicalCertificate:true,
      healthDeclarationMedicalCertificateApproved:true,healthDeclarationMedicalCertificateDataUrl:'data:text/plain;base64,VGVzdA=='});
    const added=await request('/api/auth/family-members',{user:sibling},registered.cookie);assert.equal(added.status,201,JSON.stringify(added.body));
    const addedProfile=(await inspect.query('SELECT profile FROM auth_accounts WHERE user_id=$1',['sibling'])).rows[0].profile;
    assert.deepEqual(addedProfile,(await state()).payload.users.find(user=>user.id==='sibling'));
    assert.equal(addedProfile.familyPayerId,'payer');assert.equal(addedProfile.healthDeclarationMedicalCertificateApproved,false);
    assert.equal((await request('/api/auth/family-members',{user:sibling},registered.cookie)).status,400);
    for(const [code,status] of [['p13',200],['FIXED',200],['SINGLE',200],['USED',400],['MISSING',400]]){
      const result=await request('/api/payments/rivhit/discount/validate',{code},registered.cookie);assert.equal(result.status,status);outcomes.push({code,status,body:result.body});
    }
    const picks=[{memberId:'payer',memberName:payer.name,participation:'INCLUDED',membershipType:'OPEN_GYM',additionalPlans:[{membershipType:'WORKOUT_COACHING'}]},
      {memberId:'child',memberName:child.name,participation:'INCLUDED',membershipType:'PERSONAL_TRAINING',trainingSessionsCount:4,additionalPlans:[{membershipType:'DUO_TRAINING',trainingSessionsCount:2}]},
      {memberId:'sibling',memberName:sibling.name,participation:'SKIP',membershipType:''}];
    const quoteRequest={userId:'payer',membershipType:'FAMILY_MEMBERSHIP',mode:'PRIMARY',familyBillingMode:'CUSTOM_COMBINED',familyMembersCount:3,familyMemberPlans:picks,quoteOnly:true};
    for(const code of [undefined,'P13','FIXED'])for(const grouping of ['COMBINED','SEPARATE']){
      await resetQuote();
      const result=await request('/api/payments/rivhit/create',{...quoteRequest,discountCode:code,familyPaymentGrouping:grouping},registered.cookie);
      assert.equal(result.status,200,JSON.stringify(result.body));assert.equal(result.body.split,true);
      await compareChatQuote({...quoteRequest,discountCode:code,familyPaymentGrouping:grouping},result.body);
      const journal=await store.getFamilySplitCheckout('parity','payer');
      assert.equal(journal.payload.items.length,result.body.items.length);
      assert.deepEqual(journal.payload.items.map(item=>({id:item.id,amount:item.amount,status:item.status})),result.body.items.map(item=>({id:item.id,amount:item.amount,status:item.status})));
      outcomes.push({scenario:`family-${code || 'none'}-${grouping}`,body:normalize(result.body)});
    }
    // Additional-only individual purchase uses the exact same existing route.
    const individualRequest={userId:'adult',membershipType:'PERSONAL_TRAINING',mode:'ADDON',quoteOnly:true,
      individualSelections:[{membershipType:'PERSONAL_TRAINING',trainingSessionsCount:3},{membershipType:'DUO_TRAINING',trainingSessionsCount:2}],discountCode:'P13'};
    const individual=await request('/api/payments/rivhit/create',individualRequest,(await request('/api/auth/login',{login:'test-adult',password:person('adult').password})).cookie);
    assert.equal(individual.status,200,JSON.stringify(individual.body));await compareChatQuote(individualRequest,individual.body);outcomes.push({scenario:'individual-personal-duo',body:normalize(individual.body)});
    const today=new Date().toISOString();
    await update(payload=>({...payload,payments:[{id:'fixture-paid',traineeId:'payer',status:'PAID',membershipTypePurchased:'OPEN_GYM',amount:281,date:today.slice(0,10),timestamp:today,isMock:true}]}));
    await resetQuote();
    const alreadyPaid=await request('/api/payments/rivhit/create',{...quoteRequest,discountCode:'FIXED',familyPaymentGrouping:'SEPARATE'},registered.cookie);
    assert.equal(alreadyPaid.status,200);assert.equal(alreadyPaid.body.items.find(item=>item.memberId==='payer' && item.membershipType==='OPEN_GYM').status,'ALREADY_PAID');
    await compareChatQuote({...quoteRequest,discountCode:'FIXED',familyPaymentGrouping:'SEPARATE'},alreadyPaid.body);
    outcomes.push({scenario:'exclude-paid',body:normalize(alreadyPaid.body)});
    // PostgreSQL optimistic concurrency prevents an old browser revision overwriting new data.
    const prior=await state();assert.equal((await store.putClubState('parity',{...prior.payload,auditMarker:'current'},prior.revision)).conflict,false);
    assert.equal((await store.putClubState('parity',{...prior.payload,auditMarker:'stale'},prior.revision)).conflict,true);
    assert.equal((await state()).payload.auditMarker,'current');
    const persisted=await state();
    assert.equal(persisted.payload.payments.length,1); // fixture only: no checkout generated payment
    assert.equal(persisted.payload.users.every(user=>user.membershipStatus==='DEBT'),true);
    assert.equal(persisted.payload.discountCodes.find(code=>code.code==='SINGLE').isUsed,false);
    assert.equal(persisted.payload.discountCodes.some(code=>code.reservedFamilySplitId || code.reservedRecurringOrderId),false);
    const accounts=(await inspect.query('SELECT user_id,username_normalized,email_normalized,phone_normalized,role,profile FROM auth_accounts ORDER BY user_id')).rows;
    const hashes=await inspect.query("SELECT count(*)::int AS count FROM auth_accounts WHERE password_hash IS NOT NULL AND password_hash <> $1",[person('adult').password]);
    assert.equal(hashes.rows[0].count,6);
    const snapshot={accounts:normalize(accounts),state:normalize(persisted.payload),outcomes:normalize(outcomes)};
    // Close and recreate the store: verify SQL durability, not an in-memory cache.
    await store.close();storeClosed=true;
    const reopened=await createDatabaseStore(`postgresql://gymflow_test@127.0.0.1:${port}/${database}`,'false');
    try {assert.deepEqual(normalize((await reopened.getClubState('parity')).payload),snapshot.state);}finally{await reopened.close();}
    return snapshot;
  } finally {if(!storeClosed)await store.close();await inspect.end();}
}

try {
  const baseline=await run(mainRoot,databases[0]);
  const candidate=await run(root,databases[1]);
  assert.deepEqual(candidate,baseline,'MAIN and staging persisted data/results differ');
  assert.equal(networkAttempts,0,'No SMS, provider or HTTP request is permitted');
  console.log(JSON.stringify({ok:true,main:gitSha(mainRoot),staging:gitSha(root),postgres:'17.12',databases,
    comparedAccounts:baseline.accounts.length,quoteAndDiscountScenarios:baseline.outcomes.length,networkAttempts,
    checks:['original frontend DTO initializers identical','original server/schema/pricing code identical','registration and health SQL persistence','family signup and additional member','password login and persisted sessions','percent/fixed/used/single-use coupons','recurring and one-time grouping','individual add-ons without gym','already-paid exclusion','chat prices equal original DB-backed checkout','PostgreSQL revision conflicts','close/reopen durability','no grants or new receipts']},null,2));
} catch(error){console.error('Isolated DB parity audit failed:',error.message);process.exitCode=1;}
