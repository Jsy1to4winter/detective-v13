// Real Chromium and vendored Supabase SDK; synthetic Auth/REST/Storage.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || '/tmp/homepage-validation/node_modules/playwright');
const assert=require('node:assert/strict');const fs=require('node:fs');
const root=require('node:path').resolve(__dirname,'..');
const base=process.env.TEST_URL || 'http://127.0.0.1:8019/';
const owner='12b1d5ba-432f-47b5-857d-793347769c16';
const host='https://uzjvnbaspmnxmzdjwgtl.supabase.co';
let row={id:1,owner_id:owner,content:{},revision:0},failRead=false,failSave=false,conflict=false,failUpload=false;
const objects=new Map();let writes=0;const alerts=[];
const token=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:owner,exp:4102444800})).toString('base64url')+'.test';
const user={id:owner,email:'fuguang036@gmail.com',aud:'authenticated',role:'authenticated'};
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--autoplay-policy=user-gesture-required']});
async function context(){const c=await browser.newContext();c.setDefaultTimeout(15000);await c.route('https://fonts.googleapis.com/**',r=>r.abort());await c.route(host+'/**',async route=>{
const req=route.request(),u=new URL(req.url()),headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-expose-headers':'*','content-type':'application/json'};
const reply=(body,status=200)=>route.fulfill({status,headers,body:JSON.stringify(body)});
if(req.method()==='OPTIONS')return reply({});
if(u.pathname==='/auth/v1/token'){const creds=req.postDataJSON();if(creds.password!=='test-password')return reply({msg:'Invalid login credentials'},400);return reply({access_token:token,token_type:'bearer',refresh_token:'test-refresh',expires_in:3600,user})}
if(u.pathname==='/auth/v1/user')return reply(user);
if(u.pathname==='/auth/v1/logout')return reply({});
if(u.pathname==='/rest/v1/detective_v13_page'){
if(req.method()==='PATCH'){
assert.equal(req.headers().authorization,'Bearer '+token);writes++;
if(failSave)return reply({message:'simulated write failure'},503);
if(conflict){conflict=false;row={...row,revision:row.revision+1,content:{...row.content,statement:'另一台设备的新证词'}};return reply([])}
if(u.searchParams.get('revision')!=='eq.'+row.revision)return reply([]);
row={...row,content:req.postDataJSON().content,revision:row.revision+1};return reply([row]);}
if(failRead)return reply({message:'offline'},503);return reply([row]);}
const prefix='/storage/v1/object/';
if(u.pathname.startsWith(prefix+'public/detective-v13-media/')){const path=u.pathname.slice((prefix+'public/detective-v13-media/').length);const obj=objects.get(path);return obj?route.fulfill({headers:{...headers,'content-type':obj.type},body:obj.body}):reply({},404)}
if(req.method()==='POST'&&u.pathname.startsWith(prefix+'detective-v13-media/')){if(failUpload)return reply({message:'Storage unavailable'},503);const path=u.pathname.slice((prefix+'detective-v13-media/').length);assert(path.startsWith(owner+'/'));let body=req.postDataBuffer();const isAudio=path.endsWith('.m4a');objects.set(path,{type:isAudio?'audio/mp4':'image/jpeg',body:fs.readFileSync(root+(isAudio?'/assets/audio/suspense-music-2.0.m4a':'/assets/images/asset-7304b7cd13c3.jpg'))});return reply({Key:'detective-v13-media/'+path});}
if(req.method()==='DELETE'&&u.pathname===prefix+'detective-v13-media'){for(const path of req.postDataJSON().prefixes)objects.delete(path);return reply([])}
throw Error('Unexpected request '+req.method()+' '+u.pathname);
});return c;}
async function page(c){let p=await c.newPage();p.on('dialog',async d=>{alerts.push(d.message());console.log('DIALOG',d.message());await d.accept()});p.on('pageerror',e=>{throw e});await p.goto(base,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>document.querySelector('.cloud-notice').hidden);return p;}
console.log('STEP','const c=await context();');const c=await context();const p=await page(c);
await p.evaluate(()=>localStorage.setItem('casefile-witness-statement-v2','PRIVATE LOCAL DRAFT'));await p.reload({waitUntil:'domcontentloaded'});assert(!(await p.locator('#statementView').textContent()).includes('PRIVATE'));
console.log('STEP',"await p.click('#masterEdit');");await p.click('#masterEdit');await p.waitForSelector('#cloudLogin.show');assert(!await p.locator('#adminOverlay').evaluate(e=>e.classList.contains('show')));
await p.fill('#cloudEmail','fuguang036@gmail.com');await p.fill('#cloudPassword','wrong');await p.click('#cloudLoginSubmit');await p.waitForFunction(()=>cloudLoginStatus.textContent.includes('登录失败'));
await p.fill('#cloudPassword','test-password');await p.click('#cloudLoginSubmit');await p.waitForSelector('#adminOverlay.show');
console.log('STEP',"await p.fill('#adminStatement','来自云端的证词');");await p.fill('#adminStatement','来自云端的证词');await p.click('#adminSaveStatement');await p.waitForFunction(()=>document.getElementById('statementView').textContent==='来自云端的证词');assert.equal(row.content.statement,'来自云端的证词');
await p.fill('#witnessTag1','可靠');await p.fill('#witnessTag2','耐心');await p.fill('#witnessTag3','');await p.click('#saveWitnessTags');await p.waitForFunction(()=>tagSaveStatus.textContent.includes('云端'));assert.deepEqual(row.content.tags,['可靠','耐心']);
for(const [i,title]of ['资料','照片','规则'].entries())await p.fill('#sectionTitle'+i,title);
await p.click('#saveSectionTitles');await p.waitForFunction(()=>sectionTitleStatus.textContent.includes('已保存'));assert.deepEqual(row.content.sectionTitles,['资料','照片','规则']);
console.log('STEP',"await p.setInputFiles('#adminWitnessUpload'");await p.setInputFiles('#adminWitnessUpload',root+'/assets/images/asset-7304b7cd13c3.jpg');await p.waitForFunction(()=>document.getElementById('witnessImg').src.includes('/storage/'));assert(row.content.media['witness-portrait'].startsWith(host));
await p.setInputFiles('#coverEditor input[type=file]',[]).catch(()=>{});
await p.locator('#coverEditor input[type=file]').first().setInputFiles(root+'/assets/images/asset-c95b9332b8bf.jpg');await p.waitForFunction(()=>document.querySelector('[data-section="0"] .poster-image').src.includes('/storage/'));
await p.locator('#adminSlots input[type=file]').first().setInputFiles(root+'/assets/images/asset-7304b7cd13c3.jpg');await p.waitForFunction(()=>document.querySelector('#adminSlots img'));
console.log('STEP',"await p.setInputFiles('#adminMusicUpload'");await p.setInputFiles('#adminMusicUpload',root+'/assets/audio/suspense-music-2.0.m4a');await p.waitForFunction(()=>adminMusicStatus.textContent.includes('保存到云端'));assert(row.content.media['case-background-music'].startsWith(host));
console.log('STEP','const v=await page');const v=await page(await context());assert.equal(await v.locator('#statementView').textContent(),'来自云端的证词');assert.equal(await v.locator('[data-section="0"] .fname b').textContent(),'资料');await v.waitForFunction(()=>witnessImg.complete&&witnessImg.naturalWidth>0);await v.click('[data-section="0"]');await v.waitForSelector('#slots img');await v.click('#slots img');assert(await v.locator('#lightbox').evaluate(e=>e.classList.contains('show')));await v.click('#lightClose');await v.click('#close');await v.click('#masterEdit');await v.waitForSelector('#cloudLogin.show');await v.waitForFunction(()=>caseBackgroundMusic.currentTime>0);assert.equal(await v.evaluate(()=>caseBackgroundMusic.muted),false);
console.log('STEP','failSave=true;');failSave=true;await p.fill('#sectionTitle0','失败标题');await p.click('#saveSectionTitles');await p.waitForFunction(()=>sectionTitleStatus.textContent.includes('保存失败'));assert.equal(await p.locator('[data-section="0"] .fname b').textContent(),'资料');assert.equal(row.content.sectionTitles[0],'资料');await p.fill('#adminStatement','不应保存的内容');await p.click('#adminSaveStatement');await p.waitForFunction(()=>document.querySelector('.cloud-notice').textContent.includes('保存失败'));assert.equal(row.content.statement,'来自云端的证词');assert.equal(await p.locator('#statementView').textContent(),'来自云端的证词');failSave=false;
console.log('STEP','conflict=true;');conflict=true;await p.click('#adminSaveStatement');await p.waitForFunction(()=>document.querySelector('.cloud-notice').textContent.includes('其他页面'));assert.equal(row.content.statement,'另一台设备的新证词');await p.click('.cloud-notice button');await p.waitForFunction(()=>adminStatement.value==='另一台设备的新证词');
const music=row.content.media['case-background-music'];failUpload=true;await p.setInputFiles('#adminMusicUpload',root+'/assets/audio/suspense-music-2.0.m4a');await p.waitForFunction(()=>document.querySelector('.cloud-notice').textContent.includes('文件上传失败'));assert.equal(row.content.media['case-background-music'],music);failUpload=false;
console.log('STEP',"await p.click('#adminMusicReset');");await p.click('#adminMusicReset');await p.waitForFunction(()=>caseBackgroundMusic.getAttribute('src')==='assets/audio/suspense-music-2.0.m4a');assert(!row.content.media['case-background-music']);
console.log('STEP',"await p.click('#cloudLogout');");await p.click('#cloudLogout');await p.waitForFunction(()=>!document.getElementById('adminOverlay').classList.contains('show'));assert(!await p.locator('#adminOverlay').evaluate(e=>e.classList.contains('show')));const previous=writes;await p.evaluate(()=>DetectiveCloud.setText('statement','unauthorized').catch(e=>e.message));assert.equal(writes,previous);
console.log('STEP','failRead=true;');failRead=true;const c3=await context();const p3=await c3.newPage();await p3.goto(base,{waitUntil:'domcontentloaded'});await p3.waitForFunction(()=>document.querySelector('.cloud-notice').textContent.includes('读取失败'));failRead=false;await p3.click('.cloud-notice button');await p3.waitForFunction(()=>statementView.textContent==='另一台设备的新证词');
console.log('STEP','const c4=await context();');const c4=await context();await c4.route('**/vendor/supabase.js',r=>r.abort());const p4=await page(c4);assert.equal(await p4.locator('#statementView').textContent(),'另一台设备的新证词');
console.log('STEP local migration');
await p.click('#masterEdit');await p.waitForSelector('#cloudLogin.show');await p.fill('#cloudEmail','fuguang036@gmail.com');await p.fill('#cloudPassword','test-password');await p.click('#cloudLoginSubmit');await p.waitForSelector('#adminOverlay.show');
await p.evaluate(async()=>{localStorage.setItem('casefile-witness-traits-v1',JSON.stringify(['旧标签']));const image=await (await fetch('assets/images/asset-7304b7cd13c3.jpg')).blob();const value=await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.readAsDataURL(image)});await new Promise((resolve,reject)=>{const r=indexedDB.open('casefile-027a',1);r.onupgradeneeded=()=>r.result.createObjectStore('images');r.onerror=reject;r.onsuccess=()=>{const db=r.result;const tx=db.transaction('images','readwrite');tx.objectStore('images').put(value,'2-5');tx.oncomplete=()=>{db.close();resolve()}}})});
await p.click('#cloudMigrate');await p.waitForFunction(()=>statementView.textContent==='PRIVATE LOCAL DRAFT');assert.equal(row.content.statement,'PRIVATE LOCAL DRAFT');assert.deepEqual(row.content.tags,['旧标签']);assert(row.content.media['2-5'].startsWith(host));assert.equal(await p.evaluate(()=>localStorage.getItem('casefile-witness-statement-v2')),'PRIVATE LOCAL DRAFT');
assert.equal(require('node:crypto').createHash('sha256').update(fs.readFileSync(root+'/css/styles.css','utf8').replace('\n','\n'+"@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Noto+Serif+SC:wght@400;600&display=swap');\n")).digest('hex'),'cf963ea9a55d68f5eb17933527c1af46d61a6dbdcf9d64131ca5aa0b18787b7c');
console.log('PASS: real SDK/Chromium; visitor isolation from local drafts; login/wrong-password; owner statement/tags/avatar/cover/attachment/music upload; independent visitor reads/images/audio; failed save/upload preserves content; optimistic conflict blocks overwrite; explicit retry; music reset; logout blocks writes; public reads without SDK; theme rules unchanged; font loading nonblocking. Mock services, not live Supabase.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
