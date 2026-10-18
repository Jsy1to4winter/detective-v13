
const sections=[{name:'话术',desc:'INTERROGATION RECORD // 所有留存的话语，皆可成为证词。'},{name:'评价',desc:'WITNESS TESTIMONY // 证人的叙述，将成为下一条线索。'},{name:'须知',desc:'CASE PROTOCOL // 介入调查前，请先阅读相关条例。'}];let active=0;let db;const overlay=document.getElementById('overlay'), slots=document.getElementById('slots'),lightbox=document.getElementById('lightbox');
const request=indexedDB.open('casefile-027a',1);request.onupgradeneeded=e=>{e.target.result.createObjectStore('images')};request.onsuccess=e=>{db=e.target.result};request.onerror=()=>alert('本浏览器不支持持久储存，上传可能无法保留');
function key(n){return active+'-'+n}function getImage(k){return new Promise(resolve=>{if(!db)return resolve(null);let r=db.transaction('images','readonly').objectStore('images').get(k);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>resolve(null)})}function putImage(k,v){return new Promise(resolve=>{if(!db)return resolve();let t=db.transaction('images','readwrite');t.objectStore('images').put(v,k);t.oncomplete=resolve;t.onerror=resolve})}function delImage(k){return new Promise(resolve=>{if(!db)return resolve();let t=db.transaction('images','readwrite');t.objectStore('images').delete(k);t.oncomplete=resolve;t.onerror=resolve})}
function compress(file){return new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>{let im=new Image();im.onload=()=>{let scale=Math.min(1,1250/Math.max(im.width,im.height));let c=document.createElement('canvas');c.width=Math.max(1,Math.round(im.width*scale));c.height=Math.max(1,Math.round(im.height*scale));c.getContext('2d').drawImage(im,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',.82))};im.src=reader.result};reader.readAsDataURL(file)})}
async function render(){let a=active;slots.replaceChildren();for(let i=0;i<6;i++){let el=document.createElement('div');el.className='slot';el.innerHTML='<div class="idx">附件 0'+(i+1)+'</div><span>＋</span><div>待归档</div><div>EXHIBIT / 0'+(i+1)+'</div>';slots.appendChild(el);let pic=await getImage(a+'-'+i);if(active!==a)return;if(pic){el.innerHTML='<img alt="已上传证物图片"><div class="idx">EVIDENCE 0'+(i+1)+'</div>';el.querySelector('img').src=pic;el.querySelector('img').onclick=()=>{document.getElementById('largeImage').src=pic;lightbox.classList.add('show')};}}}
function openPanel(n){active=n;document.getElementById('panelTitle').textContent=sections[n].name;document.getElementById('panelDesc').textContent=sections[n].desc;document.getElementById('panelNumber').textContent='EVIDENCE / 00'+(n+1);overlay.classList.add('show');overlay.setAttribute('aria-hidden','false');render()};document.querySelectorAll('.fitem').forEach(el=>el.onclick=()=>openPanel(Number(el.dataset.section)));function close(){overlay.classList.remove('show');overlay.setAttribute('aria-hidden','true')};document.getElementById('close').onclick=close;overlay.onclick=e=>{if(e.target===overlay)close()};document.getElementById('lightClose').onclick=()=>lightbox.classList.remove('show');lightbox.onclick=e=>{if(e.target===lightbox)lightbox.classList.remove('show')};document.onkeydown=e=>{if(e.key==='Escape'){lightbox.classList.remove('show');close()}};

// 证人照片独立存储，与三个板块的十八张图片互不干扰。
const witnessInput=document.getElementById('witnessInput'),witnessPhoto=document.getElementById('witnessPhoto'),witnessImg=document.getElementById('witnessImg');
function witnessPick(){witnessInput.click()}
document.getElementById('witnessUploadBtn').onclick=witnessPick;
async function loadWitness(){const pic=await getImage('witness-portrait');if(pic){witnessImg.src=pic;witnessImg.hidden=false;document.querySelector('.witness-placeholder').hidden=true}}
witnessInput.onchange=async e=>{const f=e.target.files[0];if(!f)return;const src=await compress(f);await putImage('witness-portrait',src);witnessImg.src=src;witnessImg.hidden=false;document.querySelector('.witness-placeholder').hidden=true;witnessInput.value=''};
const statementView=document.getElementById('statementView'),statementEdit=document.getElementById('statementEdit'),statementControls=document.getElementById('statementControls'),editStatement=document.getElementById('editStatement');
try{const saved=localStorage.getItem('casefile-witness-statement-v2');if(saved!==null)statementView.textContent=saved}catch(e){}
function closeEditor(){statementEdit.hidden=true;statementControls.hidden=true;statementView.hidden=false;editStatement.hidden=false}
editStatement.onclick=()=>{statementEdit.value=statementView.textContent;statementView.hidden=true;statementEdit.hidden=false;statementControls.hidden=false;editStatement.hidden=true;statementEdit.focus()};
document.getElementById('cancelStatement').onclick=closeEditor;
document.getElementById('saveStatement').onclick=()=>{statementView.textContent=statementEdit.value;try{localStorage.setItem('casefile-witness-statement-v2',statementEdit.value)}catch(e){alert('当前浏览器未允许保存文字')}closeEditor()};
request.addEventListener('success',loadWitness);

// Coordinates are measured from actual thumbtacks after layout, so the red twine
// always reaches all three photos at every mobile width (including 320px).
function alignEvidenceThread(){
 const fb=document.querySelector('.fb'),svg=document.getElementById('evidenceThreads');
 if(!fb||!svg)return;
 const b=fb.getBoundingClientRect();
 const pins=[...document.querySelectorAll('.fitem')].map(item=>[item.offsetLeft+item.offsetWidth/2,item.offsetTop+6]);
 if(pins.length!==3)return;
 svg.setAttribute('viewBox',`0 0 ${b.width} ${b.height}`);
 const seg=(a,c)=>{const mx=(a[0]+c[0])/2,my=(a[1]+c[1])/2,sag=Math.hypot(c[0]-a[0],c[1]-a[1])*.035;return `M ${a[0].toFixed(2)} ${a[1].toFixed(2)} Q ${mx.toFixed(2)} ${(my+sag).toFixed(2)} ${c[0].toFixed(2)} ${c[1].toFixed(2)}`};
 document.getElementById('threadMain').setAttribute('d',seg(pins[0],pins[1]));
 document.getElementById('threadSecondary').setAttribute('d',seg(pins[0],pins[2]));
 const r=Math.max(5.5,b.width*.0145);
 document.getElementById('pinDots').replaceChildren();
}
window.addEventListener('resize',alignEvidenceThread);
window.addEventListener('load',alignEvidenceThread);
requestAnimationFrame(alignEvidenceThread);

// Centralized V4 editor: browsing is read-only; all changes live here.
const adminOverlay=document.getElementById('adminOverlay');let adminActive=0;
document.getElementById('masterEdit').onclick=()=>{close();adminOverlay.classList.add('show');adminOverlay.setAttribute('aria-hidden','false');document.getElementById('adminStatement').value=statementView.textContent;renderAdminSlots();renderCoverEditor()};
function closeAdmin(){adminOverlay.classList.remove('show');adminOverlay.setAttribute('aria-hidden','true')}
document.getElementById('adminClose').onclick=closeAdmin;adminOverlay.addEventListener('click',e=>{if(e.target===adminOverlay)closeAdmin()});
document.getElementById('adminWitnessUpload').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;const result=await compress(f);await putImage('witness-portrait',result);witnessImg.src=result;witnessImg.hidden=false;document.querySelector('.witness-placeholder').hidden=true;e.target.value=''});
document.getElementById('adminSaveStatement').onclick=()=>{const val=document.getElementById('adminStatement').value;statementView.textContent=val;try{localStorage.setItem('casefile-witness-statement-v2',val)}catch(err){alert('文字保存失败，请检查浏览器存储权限')}alert('证词已保存')};
document.querySelectorAll('[data-admin-section]').forEach(btn=>btn.addEventListener('click',()=>{adminActive=+btn.dataset.adminSection;document.querySelectorAll('[data-admin-section]').forEach(x=>x.classList.toggle('selected',x===btn));renderAdminSlots()}));
async function renderAdminSlots(){const a=adminActive;const host=document.getElementById('adminSlots');host.replaceChildren();for(let i=0;i<6;i++){const el=document.createElement('div');el.className='admin-slot';const current=await getImage(a+'-'+i);if(a!==adminActive)return;const title=document.createElement('div');title.textContent='FILE '+(a+1)+' / '+String(i+1).padStart(2,'0');title.style.fontSize='10px';el.appendChild(title);if(current){const im=document.createElement('img');im.src=current;im.alt='第'+(i+1)+'张证物';el.appendChild(im)}else{let empty=document.createElement('div');empty.className='admin-empty';empty.textContent='＋ 添加图片';el.appendChild(empty)}const input=document.createElement('input');input.type='file';input.accept='image/*';input.setAttribute('aria-label','上传第'+(i+1)+'张图片');input.addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;await putImage(a+'-'+i,await compress(file));renderAdminSlots()});el.appendChild(input);if(current){const del=document.createElement('button');del.type='button';del.textContent='删除此图片';del.onclick=async()=>{await delImage(a+'-'+i);renderAdminSlots()};el.appendChild(del)}host.appendChild(el)}}


async function loadPosterCovers(){
 for(let i=0;i<3;i++){
 const face=document.querySelector('[data-section="'+i+'"] .fface');
 const img=face.querySelector('img');const pic=await getImage('poster-cover-'+i);
 face.classList.toggle('has-cover',!!pic);img.hidden=!pic;
 if(pic)img.src=pic;else img.removeAttribute('src');
 }
}
async function renderCoverEditor(){
 const host=document.getElementById('coverEditor');host.replaceChildren();
 for(let i=0;i<3;i++){
 const el=document.createElement('div');el.className='cover-edit';
 const label=document.createElement('strong');label.textContent=sections[i].name;el.appendChild(label);
 const pic=await getImage('poster-cover-'+i);
 if(pic){const im=document.createElement('img');im.src=pic;im.alt=sections[i].name+'封面';el.appendChild(im)}
 const input=document.createElement('input');input.type='file';input.accept='image/*';input.setAttribute('aria-label','替换'+sections[i].name+'卡片封面');
 input.onchange=async()=>{const f=input.files[0];if(!f)return;await putImage('poster-cover-'+i,await compress(f));await loadPosterCovers();renderCoverEditor()};el.appendChild(input);
 if(pic){const del=document.createElement('button');del.textContent='移除封面';del.onclick=async()=>{await delImage('poster-cover-'+i);await loadPosterCovers();renderCoverEditor()};el.appendChild(del)}
 host.appendChild(el);
 }
}
request.addEventListener('success',loadPosterCovers);

const sealedSilhouette=document.querySelector('.scene-silhouette');
function replaySilhouetteRise(){
 sealedSilhouette.classList.remove('rising');
 void sealedSilhouette.offsetWidth;
 sealedSilhouette.classList.add('rising');
}
document.querySelector('.caution-zone').addEventListener('click',replaySilhouetteRise);
sealedSilhouette.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();replaySilhouetteRise()}});
sealedSilhouette.querySelector('img').addEventListener('animationend',()=>sealedSilhouette.classList.remove('rising'));

const caseAudio=document.getElementById('caseBackgroundMusic');
const caseMusicButton=document.getElementById('caseMusicToggle');
const caseMusicLabel=document.getElementById('caseMusicLabel');
let caseMusicStarted=false,caseMusicUserPaused=false;
caseAudio.volume=.55;
function updateCaseMusic(){const playing=!caseAudio.paused;caseMusicButton.setAttribute('aria-pressed',String(playing));caseMusicButton.setAttribute('aria-label',playing?'暂停背景音乐':'播放背景音乐');caseMusicLabel.textContent=playing?'背景音乐 · 播放中':caseMusicStarted?'背景音乐 · 已暂停':'背景音乐 · 点击播放'}
function startCaseMusic(){const result=caseAudio.play();if(result)result.catch(updateCaseMusic)}
function unlockCaseMusic(e){if(e.target instanceof Element&&e.target.closest('#caseMusicToggle'))return;if(!caseMusicStarted&&!caseMusicUserPaused)startCaseMusic()}
caseAudio.addEventListener('playing',()=>{caseMusicStarted=true;updateCaseMusic();document.removeEventListener('pointerdown',unlockCaseMusic);document.removeEventListener('keydown',unlockCaseMusic)});
caseAudio.addEventListener('pause',updateCaseMusic);
caseMusicButton.addEventListener('click',()=>{if(caseAudio.paused){caseMusicUserPaused=false;startCaseMusic()}else{caseMusicUserPaused=true;caseAudio.pause()}});
document.addEventListener('pointerdown',unlockCaseMusic,{passive:true});
document.addEventListener('keydown',unlockCaseMusic);
startCaseMusic();

const smokeVideo=document.getElementById('caseSmoke');
smokeVideo.muted=true;smokeVideo.defaultMuted=true;
function startSmoke(){if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;const playback=smokeVideo.play();if(playback)playback.catch(()=>{})}
startSmoke();
document.addEventListener('pointerdown',()=>{if(smokeVideo.paused)startSmoke()},{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden)smokeVideo.pause();else startSmoke()});

const embeddedCaseMusic=caseAudio.getAttribute('src');
const adminMusicStatus=document.getElementById('adminMusicStatus');
async function restoreSavedMusic(){const saved=await getImage('case-background-music');if(saved){caseAudio.src=saved;caseMusicUserPaused=false;caseMusicStarted=false;startCaseMusic()}}
request.addEventListener('success',restoreSavedMusic);
document.getElementById('adminMusicUpload').addEventListener('change',async e=>{
 const file=e.target.files[0];if(!file)return;
 const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)}).catch(()=>null);
 if(!data){adminMusicStatus.textContent='读取音乐失败，请重新选择';return}
 const oldSrc=caseAudio.src;
 const checked=await new Promise(resolve=>{const test=new Audio();test.preload='metadata';test.onloadedmetadata=()=>{test.removeAttribute('src');test.load();resolve(true)};test.onerror=()=>resolve(false);test.src=data});
 if(!checked){adminMusicStatus.textContent='当前浏览器无法播放此格式，请选择 MP3 或 M4A';e.target.value='';return}
 await putImage('case-background-music',data);caseAudio.src=data;caseMusicUserPaused=false;caseMusicStarted=false;startCaseMusic();adminMusicStatus.textContent='音乐已更换并保存';e.target.value='';
});
document.getElementById('adminMusicReset').addEventListener('click',async()=>{await delImage('case-background-music');caseAudio.src=embeddedCaseMusic;caseMusicUserPaused=false;caseMusicStarted=false;startCaseMusic();adminMusicStatus.textContent='已恢复默认背景音乐'});
caseAudio.addEventListener('canplay',()=>{if(!caseMusicUserPaused&&caseAudio.paused)startCaseMusic()});
window.addEventListener('pageshow',()=>{if(!caseMusicUserPaused&&caseAudio.paused)startCaseMusic()});

const witnessTagsHost=document.getElementById('witnessTags');
const witnessTagInputs=[1,2,3].map(n=>document.getElementById('witnessTag'+n));
let witnessTraitTags=['冷静','敏锐','独立'];
try{const stored=JSON.parse(localStorage.getItem('casefile-witness-traits-v1'));if(Array.isArray(stored))witnessTraitTags=stored.slice(0,3).filter(t=>typeof t==='string').map(t=>t.trim().slice(0,4)).filter(Boolean)}catch(e){}
function renderWitnessTags(){witnessTagsHost.replaceChildren();witnessTagsHost.hidden=!witnessTraitTags.length;for(const label of witnessTraitTags){const tag=document.createElement('span');tag.className='witness-tag';tag.textContent=label;witnessTagsHost.appendChild(tag)}}
witnessTagInputs.forEach((input,i)=>input.value=witnessTraitTags[i]||'');renderWitnessTags();
document.getElementById('saveWitnessTags').addEventListener('click',()=>{
 witnessTraitTags=witnessTagInputs.map(el=>el.value.trim().slice(0,4)).filter(Boolean).slice(0,3);renderWitnessTags();
 try{localStorage.setItem('casefile-witness-traits-v1',JSON.stringify(witnessTraitTags));document.getElementById('tagSaveStatus').textContent='标签已保存'}catch(e){document.getElementById('tagSaveStatus').textContent='暂时无法保存，请检查浏览器存储权限'}
});
