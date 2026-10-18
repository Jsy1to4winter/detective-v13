// Real browser + SDK + actual Edge Function handler, with synthetic Auth/REST/Storage.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/tmp/homepage-validation/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT='12b1d5ba-432f-47b5-857d-793347769c16',HOST='https://uzjvnbaspmnxmzdjwgtl.supabase.co';
const base=process.env.TEST_URL||'http://127.0.0.1:8019/';const root=path.resolve(__dirname,'..');
const profiles=new Map(),editors=new Map(),users=new Map(),limits=new Map(),objects=new Map();let next=0,failRpc=false;
const main={id:1,owner_id:ROOT,revision:0,content:{statement:'主链接已有资料，不可复制'}};
users.set(ROOT,{id:ROOT,email:'fuguang036@gmail.com',password:'root-password'});
function token(id){const u=users.get(id);return Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:id,email:u?.email,exp:4102444800})).toString('base64url')+'.test'}
function userFor(t){for(const [id,user]of users)if(token(id)===t)return user;return null}
function session(user){return {access_token:token(user.id),refresh_token:'refresh-'+user.id,expires_in:3600,token_type:'bearer',user:{id:user.id,email:user.email,aud:'authenticated',role:'authenticated'}}}
const admin={from(table){let filter;assert.equal(table,'detective_v13_editors');return {select(){return this},eq(k,v){filter=v;return this},async maybeSingle(){return {data:editors.get(filter)||null}},async order(){return {data:[...editors].map(([slug,e])=>({slug,created_at:e.created_at}))}}}},
 auth:{async getUser(t){const u=userFor(t);return {data:{user:u?{id:u.id}:null}}},admin:{async createUser({email,password}){const id='00000000-0000-4000-8000-'+String(++next).padStart(12,'0');const u={id,email,password};users.set(id,u);return {data:{user:u}}},async deleteUser(id){users.delete(id);return {}},async updateUserById(id){users.get(id).banned=true;return {data:{user:users.get(id)}}}}},
 async rpc(name,args){if(failRpc)return {error:{code:'SIMULATED'}};const slug=args.p_slug;
 if(name==='detective_v13_take_login_attempt'){const n=(limits.get(slug)||0)+1;limits.set(slug,n);return {data:n<=20}}
 if(name==='detective_v13_create_editor'){if(editors.has(slug))return {error:{code:'DUPLICATE'}};editors.set(slug,{user_id:args.p_user_id,login_email:args.p_email,created_at:'2026-10-19T00:00:00Z'});profiles.set(slug,{slug,owner_id:args.p_user_id,revision:0,content:{}});return {}}
 assert.equal(name,'detective_v13_replace_editor');assert.equal(editors.get(slug).user_id,args.p_expected_user);editors.set(slug,{...editors.get(slug),user_id:args.p_new_user,login_email:args.p_email});const p=profiles.get(slug);p.owner_id=args.p_new_user;p.revision++;limits.delete(slug);return {}}
};
const publicClient={auth:{async signInWithPassword({email,password}){const u=[...users.values()].find(u=>u.email===email&&u.password===password&&!u.banned);return u?{data:{session:session(u)}}:{error:{message:'Invalid credentials'},data:{}}}}};
(async()=>{const {createHandler}=await import('../supabase/functions/detective-access/handler.mjs');const handler=createHandler({createClient:(url,key)=>key==='service-test'?admin:publicClient,env:{get:n=>({SUPABASE_URL:HOST,SUPABASE_ANON_KEY:'public-test',SUPABASE_SERVICE_ROLE_KEY:'service-test'})[n]},logger:{error(){},warn(){}}});
async function direct(body,t){const r=await handler(new Request(HOST+'/functions/v1/smart-service',{method:'POST',headers:{'content-type':'application/json',...(t?{authorization:'Bearer '+t}:{})},body:JSON.stringify(body)}));return {status:r.status,data:await r.json()}}
assert.equal((await direct({action:'create',slug:'child_a',password:'child-a-password'})).status,401);
assert.equal((await direct({action:'create',slug:'main',password:'child-a-password'},token(ROOT))).status,400);
assert.equal((await direct({action:'create',slug:'child_a',password:'short'},token(ROOT))).status,400);
const before=users.size;failRpc=true;assert.equal((await direct({action:'create',slug:'failed_profile',password:'child-a-password'},token(ROOT))).status,500);failRpc=false;assert.equal(users.size,before,'failed creation cleans up unlinked Auth identity');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--autoplay-policy=user-gesture-required']});
async function context(){const c=await browser.newContext();c.setDefaultTimeout(15000);await c.route('https://fonts.googleapis.com/**',r=>r.abort());await c.route(HOST+'/**',async route=>{
 const req=route.request(),u=new URL(req.url()),headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','content-type':'application/json'};const reply=(body,status=200)=>route.fulfill({status,headers,body:JSON.stringify(body)});
 if(req.method()==='OPTIONS')return reply({});
 const bearer=req.headers().authorization?.replace(/^Bearer /,'');const auth=userFor(bearer);
 if(u.pathname==='/functions/v1/smart-service'){const r=await handler(new Request(req.url(),{method:'POST',headers:req.headers(),body:req.postData()}));return route.fulfill({status:r.status,headers:Object.fromEntries(r.headers),body:await r.text()})}
 if(u.pathname==='/auth/v1/token'){const body=req.postDataJSON();let user;if(body.grant_type==='refresh_token')user=null;else user=[...users.values()].find(x=>x.email===body.email&&x.password===body.password&&!x.banned);return user?reply(session(user)):reply({msg:'Invalid credentials'},400)}
 if(u.pathname==='/auth/v1/user')return auth?reply({id:auth.id,email:auth.email,aud:'authenticated',role:'authenticated'}):reply({},401);
 if(u.pathname==='/auth/v1/logout')return reply({});
 if(u.pathname.startsWith('/rest/v1/')){
  const table=u.pathname.slice('/rest/v1/'.length);if(!['detective_v13_page','detective_v13_profiles'].includes(table))return reply({},403);
  const isChild=table==='detective_v13_profiles';const id=u.searchParams.get('slug')?.replace(/^eq\./,'');const row=isChild?profiles.get(id):main;
  if(req.method()==='PATCH'){
   if(!auth||auth.id!==row?.owner_id)return reply([]);
   if(u.searchParams.get('revision')!=='eq.'+row.revision)return reply([]);
   row.content=req.postDataJSON().content;row.revision++;return reply([row]);
  }return reply(row?[row]:[]);
 }
 const prefix='/storage/v1/object/';
 if(u.pathname.startsWith(prefix+'public/detective-v13-media/')){const k=u.pathname.slice((prefix+'public/detective-v13-media/').length);const obj=objects.get(k);return obj?route.fulfill({headers:{...headers,'content-type':obj.type},body:obj.body}):reply({},404)}
 if(req.method()==='POST'&&u.pathname.startsWith(prefix+'detective-v13-media/')){const k=u.pathname.slice((prefix+'detective-v13-media/').length),parts=k.split('/');const allowed=auth&&(auth.id===ROOT?parts[0]===ROOT:parts[0]==='profiles'&&profiles.get(parts[1])?.owner_id===auth.id);if(!allowed)return reply({message:'RLS denied'},403);const audio=k.endsWith('.m4a');objects.set(k,{type:audio?'audio/mp4':'image/jpeg',body:fs.readFileSync(root+(audio?'/assets/audio/suspense-music-2.0.m4a':'/assets/images/asset-7304b7cd13c3.jpg'))});return reply({Key:'detective-v13-media/'+k})}
 if(req.method()==='DELETE'&&u.pathname===prefix+'detective-v13-media'){for(const k of req.postDataJSON().prefixes){const parts=k.split('/');if(auth&&(auth.id===ROOT?parts[0]===ROOT:profiles.get(parts[1])?.owner_id===auth.id))objects.delete(k)}return reply([])}
 throw Error('Unexpected request '+req.method()+' '+u.pathname);
 });return c;}
const errors=[];
async function page(c,slug){const p=await c.newPage();p.on('dialog',d=>d.accept());p.on('pageerror',e=>errors.push(e.message));await p.goto(base+(slug===undefined?'':'?profile='+encodeURIComponent(slug)),{waitUntil:'domcontentloaded'});if(slug!=='missing_profile'&&slug!=='!')await p.waitForFunction(()=>document.querySelector('.cloud-notice').hidden);return p;}
const rootContext=await context();const p=await page(rootContext);await p.click('#masterEdit');await p.waitForSelector('#cloudLogin.show');await p.fill('#cloudEmail','fuguang036@gmail.com');await p.fill('#cloudPassword','root-password');await p.click('#cloudLoginSubmit');await p.waitForSelector('#adminOverlay.show');
for(const [slug,password]of [['child_a','child-a-password'],['child_b','child-b-password']]){await p.fill('#childSlug',slug);await p.fill('#childPassword',password);await p.click('#childCreate');await p.waitForFunction(s=>document.getElementById('childStatus').textContent.includes('已创建')&&document.getElementById('childResultUrl').value.endsWith('profile='+s)&&!document.getElementById('childCreate').disabled,slug);assert.deepEqual(profiles.get(slug).content,{})}
assert.equal(await p.locator('.child-link-row').count(),2);assert.equal(main.content.statement,'主链接已有资料，不可复制');
const shared=await context();const a=await page(shared,'child_a');const b=await page(shared,'child_b');assert(!(await a.locator('#statementView').textContent()).includes('主链接已有'));
async function unlock(pg,password){await pg.click('#masterEdit');await pg.waitForSelector('#cloudLogin.show');assert(!await pg.locator('#cloudEmail').isVisible());await pg.fill('#cloudPassword',password);await pg.click('#cloudLoginSubmit');await pg.waitForSelector('#adminOverlay.show');assert.equal(await pg.locator('#childCreate').count(),0);assert.equal(await pg.locator('#cloudMigrate').count(),0)}
await a.click('#masterEdit');await a.fill('#cloudPassword','child-b-password');await a.click('#cloudLoginSubmit');await a.waitForFunction(()=>cloudLoginStatus.textContent.includes('不正确'));assert(!await a.locator('#adminOverlay').evaluate(e=>e.classList.contains('show')));await a.fill('#cloudPassword','child-a-password');await a.click('#cloudLoginSubmit');await a.waitForSelector('#adminOverlay.show');await unlock(b,'child-b-password');
for(const [pg,text]of [[a,'甲的独立资料'],[b,'乙的独立资料']]){await pg.fill('#adminStatement',text);await pg.click('#adminSaveStatement');await pg.waitForFunction(s=>statementView.textContent===s,text)}
assert.equal(profiles.get('child_a').content.statement,'甲的独立资料');assert.equal(profiles.get('child_b').content.statement,'乙的独立资料');
for(const [i,title]of ['介绍','作品','约定'].entries())await a.fill('#sectionTitle'+i,title);
await a.click('#saveSectionTitles');await a.waitForFunction(()=>sectionTitleStatus.textContent.includes('已保存'));
assert.deepEqual(profiles.get('child_a').content.sectionTitles,['介绍','作品','约定']);assert.equal(await b.locator('[data-admin-section="0"]').textContent(),'话术');
await a.setInputFiles('#adminWitnessUpload',root+'/assets/images/asset-7304b7cd13c3.jpg');await a.waitForFunction(()=>witnessImg.src.includes('profiles/child_a/'));await a.setInputFiles('#adminMusicUpload',root+'/assets/audio/suspense-music-2.0.m4a');await a.waitForFunction(()=>adminMusicStatus.textContent.includes('保存到云端'));
const aId=editors.get('child_a').user_id,aToken=token(aId);const count=editors.size;
for(const action of ['create','list','reset']){const out=await direct({action,slug:'grandchild',password:'not-authorized-password'},aToken);assert.equal(out.status,403)}assert.equal(editors.size,count);
assert.equal((await direct({action:'create',slug:'child_a',password:'another-password'},token(ROOT))).status,409);
const invalid=await page(await context(),'!');await invalid.waitForFunction(()=>document.querySelector('.cloud-notice').textContent.includes('无效'));assert(!(await invalid.locator('#statementView').textContent()).includes('主链接已有'));
const missing=await page(await context(),'missing_profile');await missing.waitForFunction(()=>document.querySelector('.cloud-notice').textContent.includes('不存在'));
const visitor=await page(await context(),'child_a');assert.equal(await visitor.locator('#statementView').textContent(),'甲的独立资料');assert.equal(await visitor.locator('[data-section="0"] .fname b').textContent(),'介绍');await visitor.click('[data-section="2"]');await visitor.waitForFunction(()=>panelTitle.textContent==='约定');await visitor.click('#close');await visitor.waitForFunction(()=>witnessImg.complete&&witnessImg.naturalWidth>0);await visitor.click('#masterEdit');await visitor.waitForFunction(()=>caseBackgroundMusic.currentTime>0);assert.equal(await visitor.locator('#childCreate').count(),0);
await a.reload({waitUntil:'domcontentloaded'});await a.waitForFunction(()=>document.querySelector('.cloud-notice').hidden);await a.click('#masterEdit');await a.waitForSelector('#adminOverlay.show');await b.reload({waitUntil:'domcontentloaded'});await b.waitForFunction(()=>document.querySelector('.cloud-notice').hidden);await b.click('#masterEdit');await b.waitForSelector('#adminOverlay.show');
const beforeFiles=objects.size;await p.locator('.child-link-row').filter({hasText:'child_a'}).getByRole('button',{name:'重置编辑密码'}).click();await p.waitForFunction(()=>childStatus.textContent.includes('密码已重置'));const newPassword=await p.locator('#childResultPassword').inputValue();assert.notEqual(editors.get('child_a').user_id,aId);assert.equal(objects.size,beforeFiles);assert.equal(profiles.get('child_a').content.statement,'甲的独立资料');
await a.fill('#adminStatement','旧会话不能覆盖');await a.click('#adminSaveStatement');await a.waitForFunction(()=>document.querySelector('.cloud-notice').textContent.includes('已失效'));assert.equal(profiles.get('child_a').content.statement,'甲的独立资料');
const old=await direct({action:'unlock',slug:'child_a',password:'child-a-password'});assert.equal(old.status,401);
const fresh=await page(await context(),'child_a');await unlock(fresh,newPassword);await fresh.fill('#adminStatement','重置后仍可编辑');await fresh.click('#adminSaveStatement');await fresh.waitForFunction(()=>statementView.textContent==='重置后仍可编辑');await fresh.click('#adminMusicReset');await fresh.waitForFunction(()=>caseBackgroundMusic.getAttribute('src')==='assets/audio/suspense-music-2.0.m4a');assert(objects.size<beforeFiles);
assert.equal(profiles.get('child_b').content.statement,'乙的独立资料');assert.equal(main.content.statement,'主链接已有资料，不可复制');
const payload=await direct({action:'list'},token(ROOT));assert(!JSON.stringify(payload).includes('@profiles.invalid'));assert(!JSON.stringify(payload).includes('service-test'));
for(let i=0;i<21;i++)await direct({action:'unlock',slug:'child_b',password:'wrong-password'});assert.equal((await direct({action:'unlock',slug:'child_b',password:'child-b-password'})).status,429);
assert.deepEqual(errors,[]);console.log('PASS: actual handler + real SDK/Chromium; root-only create/list/reset and blank template creation; child password-only login/wrong-link rejection; per-link sessions in one browser; isolated text/avatar/music; visitor media playback; invalid/missing links do not expose root drafts; child has no distribution/migration UI and server denies all management actions; reset preserves data/files and immediately blocks old writes/password; new session can edit and clean old media; private directory/privileged keys not exposed; failed-create cleanup and throttling. Mock services, not live Supabase.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
