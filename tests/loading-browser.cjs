// Weak-network regression: real Chromium, synthetic public REST and image traffic.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/tmp/homepage-validation/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.TEST_URL||'http://127.0.0.1:8019/';
const host='https://uzjvnbaspmnxmzdjwgtl.supabase.co',ROOT='12b1d5ba-432f-47b5-857d-793347769c16';
const jpg=fs.readFileSync(path.join(__dirname,'../assets/images/asset-7304b7cd13c3.jpg'));
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--autoplay-policy=user-gesture-required']});
async function context(){const c=await browser.newContext();c.setDefaultTimeout(15000);await c.route('https://fonts.googleapis.com/**',r=>r.abort());return c;}
for(const child of [false,true]){
 const c=await context(),p=await c.newPage(),issues=[];if(!child)await c.route('https://fonts.googleapis.com/**',()=>new Promise(()=>{}));p.on('pageerror',e=>issues.push(e.message));p.on('dialog',async d=>{issues.push(d.message());await d.dismiss()});
 const folder=child?'profiles/test_child':ROOT;const image=n=>host+'/storage/v1/object/public/detective-v13-media/'+folder+'/'+n+'.jpg';
 const row={...(child?{slug:'test_child'}:{id:1}),owner_id:child?'00000000-0000-4000-8000-000000000001':ROOT,revision:0,content:{statement:child?'子链接资料':'主链接资料',media:{'0-0':image('aaaa'),'0-1':image('bbbb'),'1-0':image('cccc')}}};
 let release;const gate=new Promise(resolve=>release=resolve);let hold=true,failFirst=false,reads=0,allowSecond=false;const images=new Map();let background=0;
 p.on('request',r=>{if(/\.(m4a|mp4)(?:\?|$)/.test(r.url()))background++});
 await c.route(host+'/**',async route=>{
  const req=route.request(),u=new URL(req.url()),headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','content-type':'application/json'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  if(u.pathname.startsWith('/rest/v1/')){
   reads++;if(hold)await gate;
   if(failFirst){failFirst=false;return route.fulfill({status:503,headers,body:'{}'})}
   return route.fulfill({headers,body:JSON.stringify([row])});
  }
  if(u.pathname.includes('/storage/v1/object/public/')){
   const name=u.pathname.split('/').pop(),n=(images.get(name)||0)+1;images.set(name,n);
   if(name==='aaaa.jpg'&&n===1||name==='bbbb.jpg'&&!allowSecond)return route.fulfill({status:503,headers,body:'{}'});
   return route.fulfill({headers:{...headers,'content-type':'image/jpeg'},body:jpg});
  }
  throw Error('Unexpected external request '+u.pathname);
 });
 await p.goto(base+(child?'?profile=test_child':''),{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof DetectiveCloud!=='undefined'&&document.querySelector('.cloud-notice').textContent.includes('正在读取'));
 await p.click('[data-section="0"]');assert.equal(await p.locator('#slots .slot').count(),6);assert((await p.locator('#slots').textContent()).includes('读取中'));assert.equal(background,0,'default audio/smoke must not compete with initial data read');assert.deepEqual(issues,[]);
 hold=false;release();await p.waitForFunction(()=>document.querySelector('.cloud-notice').hidden);
 await p.waitForFunction(()=>{const i=document.querySelector('#slots .slot img');return i?.complete&&i.naturalWidth>0});assert.equal(images.get('aaaa.jpg'),2,'transient image error retries automatically');
 const second=p.locator('#slots .slot').nth(1);await second.getByRole('button',{name:'重新加载图片'}).waitFor({state:'visible'});assert.equal(images.get('bbbb.jpg'),3,'automatic image retries are bounded');allowSecond=true;await second.getByRole('button',{name:'重新加载图片'}).click();await p.waitForFunction(()=>{const i=document.querySelectorAll('#slots .slot')[1].querySelector('img');return i.complete&&i.naturalWidth>0});
 const oldImageCount=[...images.values()].reduce((a,b)=>a+b,0);const previousReads=reads;
 await p.evaluate(async()=>{window.testImage=document.querySelector('#slots img');await Promise.all([DetectiveCloud.load(),DetectiveCloud.load(),DetectiveCloud.load()]);});
 assert.equal(reads,previousReads+1,'concurrent lifecycle refreshes share a request');assert.equal(await p.evaluate(()=>window.testImage===document.querySelector('#slots img')),true,'unchanged data must retain loaded DOM images');assert.equal([...images.values()].reduce((a,b)=>a+b,0),oldImageCount);
 failFirst=true;const retryReads=reads;await p.evaluate(()=>DetectiveCloud.load());assert.equal(reads,retryReads+2,'transient REST error recovers automatically');
 await p.evaluate(()=>{openPanel(1);openPanel(0)});await p.waitForFunction(()=>document.querySelectorAll('#slots .slot').length===6&&document.querySelectorAll('#slots img').length===2);assert.equal(await p.locator('#slots .slot').count(),6,'rapid switching cannot leave mixed/duplicate slots');
 assert.deepEqual(issues,[]);await c.close();console.log('PASS:',child?'child':'main','early-open six slots; no premature media downloads; transient REST/image recovery; bounded failures/manual image retry; shared reads; unchanged images retained; rapid-switch render isolation');
}
// A response whose headers arrive but JSON body never completes must also time out.
const c=await context(),p=await c.newPage();await p.clock.install();
await p.addInitScript(()=>{
 const real=window.fetch;window.stalledReads=0;window.recoverReads=false;
 window.fetch=async(url,options)=>{
  if(String(url).includes('/rest/v1/')&&!window.recoverReads){window.stalledReads++;return {ok:true,status:200,json:()=>new Promise(()=>{})};}
  return real(url,options);
 };
});
await c.route(host+'/rest/v1/**',r=>r.fulfill({headers:{'access-control-allow-origin':'*','content-type':'application/json'},body:JSON.stringify([{id:1,owner_id:ROOT,revision:1,content:{statement:'已恢复'}}])}));
await p.goto(base,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.stalledReads===1);
await p.click('[data-section="0"]');
for(let i=0;i<3;i++){
 await p.clock.runFor(8100);
 if(i<2){await p.clock.runFor(1000);await p.waitForFunction(n=>window.stalledReads>=n,i+2);}
}
await p.waitForFunction(()=>document.querySelector('.cloud-notice').textContent.includes('超时'));
assert.equal(await p.evaluate(()=>window.stalledReads),3);assert((await p.locator('#slots').textContent()).includes('资料未读取'));
await p.evaluate(()=>{window.recoverReads=true;window.dispatchEvent(new Event('online'));});await p.waitForFunction(()=>statementView.textContent==='已恢复');assert.equal(await p.locator('.cloud-notice').isVisible(),false);
let imageRequests=0;
await c.route(host+'/storage/v1/object/public/**',async r=>{
 imageRequests++;if(imageRequests===1)return new Promise(()=>{});
 return r.fulfill({headers:{'access-control-allow-origin':'*','content-type':'image/jpeg'},body:jpg});
});
const waiting=p.waitForRequest(r=>r.url().includes('timeout.jpg'));
await p.evaluate(url=>{const host=document.querySelector('#slots .slot');const img=document.createElement('img');host.append(img);DetectiveImages.bind(img,url,host);},host+'/storage/v1/object/public/detective-v13-media/'+ROOT+'/timeout.jpg');
await waiting;await p.clock.runFor(12100);await p.clock.runFor(600);
await p.waitForFunction(()=>{const i=document.querySelector('#slots img');return i?.complete&&i.naturalWidth>0});assert.equal(imageRequests,2,'stalled image request times out and retries successfully');
await c.close();
// Terminal missing links do not repeatedly hit the backend or fall back to root.
const missingContext=await context(),missing=await missingContext.newPage();let missingReads=0;
await missingContext.route(host+'/rest/v1/**',r=>{missingReads++;return r.fulfill({headers:{'access-control-allow-origin':'*','content-type':'application/json'},body:'[]'})});
await missing.goto(base+'?profile=missing_link',{waitUntil:'domcontentloaded'});await missing.waitForFunction(()=>document.querySelector('.cloud-notice').textContent.includes('不存在'));assert.equal(missingReads,1);
await missing.locator('.cloud-notice button').click();await missing.waitForFunction(()=>document.querySelector('.cloud-notice').textContent.includes('不存在'));assert.equal(missingReads,2,'failed read lock releases for manual retry');
await missing.goto(base+'?profile=',{waitUntil:'domcontentloaded'});await missing.waitForFunction(()=>document.querySelector('.cloud-notice').textContent.includes('无效'));await missing.locator('.cloud-notice button').click();await missing.waitForFunction(()=>document.querySelector('.cloud-notice').textContent.includes('无效'));assert.equal(missingReads,2);
await missingContext.close();await browser.close();console.log('PASS: stalled JSON body bounded timeout/retry and recovery; terminal errors stop; invalid links release read lock; no root fallback. Synthetic network; not a physical WeChat test.');
})().catch(e=>{console.error(e);process.exit(1)});
