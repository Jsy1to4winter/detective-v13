
const sections=[{name:'话术',desc:'INTERROGATION RECORD // 所有留存的话语，皆可成为证词。'},{name:'评价',desc:'WITNESS TESTIMONY // 证人的叙述，将成为下一条线索。'},{name:'须知',desc:'CASE PROTOCOL // 介入调查前，请先阅读相关条例。'}];let active=0;let db;const overlay=document.getElementById('overlay'), slots=document.getElementById('slots'),lightbox=document.getElementById('lightbox');
const request=new EventTarget();
function key(n){return active+'-'+n}
async function getImage(k){return DetectiveCloud.media(k)}
async function putImage(k,v){return DetectiveCloud.putMedia(k,v)}
async function delImage(k){return DetectiveCloud.removeMedia(k)}
function compress(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(Error('图片读取失败'));reader.onload=()=>{let im=new Image();im.onerror=()=>reject(Error('图片格式无法读取'));im.onload=()=>{let scale=Math.min(1,1250/Math.max(im.width,im.height));let c=document.createElement('canvas');c.width=Math.max(1,Math.round(im.width*scale));c.height=Math.max(1,Math.round(im.height*scale));c.getContext('2d').drawImage(im,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',.82))};im.src=reader.result};reader.readAsDataURL(file)})}
let renderVersion=0,adminRenderVersion=0,coverRenderVersion=0;
async function render(){
 const version=++renderVersion,a=active;slots.replaceChildren();
 for(let i=0;i<6;i++){
  const el=document.createElement('div');el.className='slot';
  el.innerHTML='<div class="idx">附件 0'+(i+1)+'</div><span>＋</span><div>'+ (DetectiveCloud.hasLoaded?'待归档':DetectiveCloud.readError?'资料未读取，请点下方重新读取':'资料读取中…')+'</div><div>EXHIBIT / 0'+(i+1)+'</div>';slots.appendChild(el);
  if(!DetectiveCloud.hasLoaded)continue;
  const pic=await getImage(a+'-'+i);if(version!==renderVersion)return;
  if(pic){
   el.innerHTML='<img alt="已上传证物图片"><div class="idx">EVIDENCE 0'+(i+1)+'</div>';
   const img=el.querySelector('img');DetectiveImages.bind(img,pic,el);
   img.onclick=()=>{lightbox.classList.add('show');DetectiveImages.bind(document.getElementById('largeImage'),pic,lightbox)};
  }
 }
}
function openPanel(n){active=n;document.getElementById('panelTitle').textContent=sections[n].name;document.getElementById('panelDesc').textContent=sections[n].desc;document.getElementById('panelNumber').textContent='EVIDENCE / 00'+(n+1);overlay.classList.add('show');overlay.setAttribute('aria-hidden','false');render()};document.querySelectorAll('.fitem').forEach(el=>el.onclick=()=>openPanel(Number(el.dataset.section)));function close(){renderVersion++;overlay.classList.remove('show');overlay.setAttribute('aria-hidden','true')};document.getElementById('close').onclick=close;overlay.onclick=e=>{if(e.target===overlay)close()};document.getElementById('lightClose').onclick=()=>lightbox.classList.remove('show');lightbox.onclick=e=>{if(e.target===lightbox)lightbox.classList.remove('show')};document.onkeydown=e=>{if(e.key==='Escape'){lightbox.classList.remove('show');close()}};

// 证人照片独立存储，与三个板块的十八张图片互不干扰。
const witnessInput=document.getElementById('witnessInput'),witnessPhoto=document.getElementById('witnessPhoto'),witnessImg=document.getElementById('witnessImg');
function witnessPick(){witnessInput.click()}
document.getElementById('witnessUploadBtn').onclick=witnessPick;
async function loadWitness(){const pic=await getImage('witness-portrait');witnessImg.hidden=!pic;document.querySelector('.witness-placeholder').hidden=!!pic;if(pic)DetectiveImages.bind(witnessImg,pic,witnessPhoto);else{DetectiveImages.clear(witnessImg);witnessImg.removeAttribute('src')}}
witnessInput.onchange=async e=>{const f=e.target.files[0];if(!f)return;const src=await putImage('witness-portrait',await compress(f));witnessImg.hidden=false;DetectiveImages.bind(witnessImg,src,witnessPhoto);document.querySelector('.witness-placeholder').hidden=true;witnessInput.value=''};
const statementView=document.getElementById('statementView'),statementEdit=document.getElementById('statementEdit'),statementControls=document.getElementById('statementControls'),editStatement=document.getElementById('editStatement');
const defaultStatement=statementView.textContent;
function closeEditor(){statementEdit.hidden=true;statementControls.hidden=true;statementView.hidden=false;editStatement.hidden=false}
editStatement.onclick=()=>{statementEdit.value=statementView.textContent;statementView.hidden=true;statementEdit.hidden=false;statementControls.hidden=false;editStatement.hidden=true;statementEdit.focus()};
document.getElementById('cancelStatement').onclick=closeEditor;
document.getElementById('saveStatement').onclick=async()=>{const value=statementEdit.value;await DetectiveCloud.setText('statement',value);statementView.textContent=value;closeEditor()};
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
document.getElementById('masterEdit').onclick=()=>DetectiveCloud.edit(()=>{close();adminOverlay.classList.add('show');adminOverlay.setAttribute('aria-hidden','false');document.getElementById('adminStatement').value=statementView.textContent;renderAdminSlots();renderCoverEditor()});
function closeAdmin(){adminOverlay.classList.remove('show');adminOverlay.setAttribute('aria-hidden','true')}
document.getElementById('adminClose').onclick=closeAdmin;adminOverlay.addEventListener('click',e=>{if(e.target===adminOverlay)closeAdmin()});
document.getElementById('adminWitnessUpload').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;const result=await putImage('witness-portrait',await compress(f));witnessImg.hidden=false;DetectiveImages.bind(witnessImg,result,witnessPhoto);document.querySelector('.witness-placeholder').hidden=true;e.target.value=''});
document.getElementById('adminSaveStatement').onclick=async()=>{const val=document.getElementById('adminStatement').value;await DetectiveCloud.setText('statement',val);statementView.textContent=val;alert('证词已保存到云端')};
document.querySelectorAll('[data-admin-section]').forEach(btn=>btn.addEventListener('click',()=>{adminActive=+btn.dataset.adminSection;document.querySelectorAll('[data-admin-section]').forEach(x=>x.classList.toggle('selected',x===btn));renderAdminSlots()}));
async function renderAdminSlots(){const version=++adminRenderVersion,a=adminActive;const host=document.getElementById('adminSlots');host.replaceChildren();for(let i=0;i<6;i++){const el=document.createElement('div');el.className='admin-slot';const current=await getImage(a+'-'+i);if(version!==adminRenderVersion)return;const title=document.createElement('div');title.textContent='FILE '+(a+1)+' / '+String(i+1).padStart(2,'0');title.style.fontSize='10px';el.appendChild(title);if(current){const im=document.createElement('img');im.alt='第'+(i+1)+'张证物';el.appendChild(im)}else{let empty=document.createElement('div');empty.className='admin-empty';empty.textContent='＋ 添加图片';el.appendChild(empty)}const input=document.createElement('input');input.type='file';input.accept='image/*';input.setAttribute('aria-label','上传第'+(i+1)+'张图片');input.addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;await putImage(a+'-'+i,await compress(file));renderAdminSlots()});el.appendChild(input);if(current){const del=document.createElement('button');del.type='button';del.textContent='删除此图片';del.onclick=async()=>{await delImage(a+'-'+i);renderAdminSlots()};el.appendChild(del)}host.appendChild(el);if(current)DetectiveImages.bind(el.querySelector('img'),current,el)}}


async function loadPosterCovers(){
 for(let i=0;i<3;i++){
 const face=document.querySelector('[data-section="'+i+'"] .fface');
 const img=face.querySelector('img');const pic=await getImage('poster-cover-'+i);
 face.classList.toggle('has-cover',!!pic);img.hidden=!pic;
 if(pic)DetectiveImages.bind(img,pic,face);else{DetectiveImages.clear(img);img.removeAttribute('src');}
 }
}
async function renderCoverEditor(){
 const version=++coverRenderVersion;const host=document.getElementById('coverEditor');host.replaceChildren();
 for(let i=0;i<3;i++){
 const el=document.createElement('div');el.className='cover-edit';
 const label=document.createElement('strong');label.textContent=sections[i].name;el.appendChild(label);
 const pic=await getImage('poster-cover-'+i);if(version!==coverRenderVersion)return;
 if(pic){const im=document.createElement('img');im.alt=sections[i].name+'封面';el.appendChild(im)}
 const input=document.createElement('input');input.type='file';input.accept='image/*';input.setAttribute('aria-label','替换'+sections[i].name+'卡片封面');
 input.onchange=async()=>{const f=input.files[0];if(!f)return;await putImage('poster-cover-'+i,await compress(f));await loadPosterCovers();renderCoverEditor()};el.appendChild(input);
 if(pic){const del=document.createElement('button');del.textContent='移除封面';del.onclick=async()=>{await delImage('poster-cover-'+i);await loadPosterCovers();renderCoverEditor()};el.appendChild(del)}
 host.appendChild(el);if(pic)DetectiveImages.bind(el.querySelector('img'),pic,el);
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
function startCaseMusic(){if(!DetectiveCloud.hasLoaded)return;const result=caseAudio.play();if(result)result.catch(updateCaseMusic)}
function unlockCaseMusic(e){if(e.target instanceof Element&&e.target.closest('#caseMusicToggle'))return;if(!caseMusicStarted&&!caseMusicUserPaused)startCaseMusic()}
caseAudio.addEventListener('playing',()=>{caseMusicStarted=true;updateCaseMusic();document.removeEventListener('pointerdown',unlockCaseMusic);document.removeEventListener('keydown',unlockCaseMusic)});
caseAudio.addEventListener('pause',updateCaseMusic);
caseMusicButton.addEventListener('click',()=>{if(caseAudio.paused){caseMusicUserPaused=false;startCaseMusic()}else{caseMusicUserPaused=true;caseAudio.pause()}});
document.addEventListener('pointerdown',unlockCaseMusic,{passive:true});
document.addEventListener('keydown',unlockCaseMusic);
startCaseMusic();

const smokeVideo=document.getElementById('caseSmoke');
smokeVideo.muted=true;smokeVideo.defaultMuted=true;
function startSmoke(){if(!DetectiveCloud.hasLoaded||document.hidden)return;if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;const playback=smokeVideo.play();if(playback)playback.catch(()=>{})}
startSmoke();
window.addEventListener('detective-cloud-loaded',()=>setTimeout(startSmoke,1800));
document.addEventListener('pointerdown',()=>{if(smokeVideo.paused)startSmoke()},{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden)smokeVideo.pause();else startSmoke()});

const embeddedCaseMusic=caseAudio.getAttribute('src');
const adminMusicStatus=document.getElementById('adminMusicStatus');
async function restoreSavedMusic(){const saved=await getImage('case-background-music');const source=saved||embeddedCaseMusic;if(caseAudio.getAttribute('src')!==source){caseAudio.src=source;caseMusicStarted=false}if(!caseMusicUserPaused&&caseAudio.paused)startCaseMusic()}
request.addEventListener('success',restoreSavedMusic);
document.getElementById('adminMusicUpload').addEventListener('change',async e=>{
 const file=e.target.files[0];if(!file)return;
 if(file.size>50*1024*1024){adminMusicStatus.textContent='音乐不能超过 50 MB';e.target.value='';return}
 const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)}).catch(()=>null);
 if(!data){adminMusicStatus.textContent='读取音乐失败，请重新选择';return}
 const checked=await new Promise(resolve=>{const test=new Audio();let done=false;const finish=value=>{if(done)return;done=true;clearTimeout(timer);test.onloadedmetadata=null;test.onerror=null;test.removeAttribute('src');test.load();resolve(value)};const timer=setTimeout(()=>finish(false),10000);test.preload='metadata';test.onloadedmetadata=()=>finish(true);test.onerror=()=>finish(false);test.src=data});
 if(!checked){adminMusicStatus.textContent='无法读取此音频，请选择有效的 MP3 或 M4A';e.target.value='';return}
 const src=await putImage('case-background-music',data);caseAudio.src=src;caseMusicUserPaused=false;caseMusicStarted=false;startCaseMusic();adminMusicStatus.textContent='音乐已更换并保存到云端';e.target.value='';
});
document.getElementById('adminMusicReset').addEventListener('click',async()=>{await delImage('case-background-music');caseAudio.src=embeddedCaseMusic;caseMusicUserPaused=false;caseMusicStarted=false;startCaseMusic();adminMusicStatus.textContent='已恢复默认背景音乐'});
caseAudio.addEventListener('canplay',()=>{if(!caseMusicUserPaused&&caseAudio.paused)startCaseMusic()});
window.addEventListener('pageshow',()=>{if(!caseMusicUserPaused&&caseAudio.paused)startCaseMusic()});

const witnessTagsHost=document.getElementById('witnessTags');
const witnessTagInputs=[1,2,3].map(n=>document.getElementById('witnessTag'+n));
let witnessTraitTags=['冷静','敏锐','独立'];

function renderWitnessTags(){witnessTagsHost.replaceChildren();witnessTagsHost.hidden=!witnessTraitTags.length;for(const label of witnessTraitTags){const tag=document.createElement('span');tag.className='witness-tag';tag.textContent=label;witnessTagsHost.appendChild(tag)}}
witnessTagInputs.forEach((input,i)=>input.value=witnessTraitTags[i]||'');renderWitnessTags();
document.getElementById('saveWitnessTags').addEventListener('click',async()=>{
 const next=witnessTagInputs.map(el=>el.value.trim().slice(0,4)).filter(Boolean).slice(0,3);
 await DetectiveCloud.setText('tags',next);witnessTraitTags=next;renderWitnessTags();
 document.getElementById('tagSaveStatus').textContent='标签已保存到云端';
});

const cloudGroup=document.createElement('div');cloudGroup.className='admin-group';
cloudGroup.innerHTML='<h3>云端账户</h3><p class="admin-tip">资料公开可见，仅管理员登录后可修改。</p><button type="button" class="admin-save" id="cloudLogout">退出登录</button><p class="admin-tip">仅当此浏览器在当前网址保存过旧版资料时，才需要迁移。迁移不会删除本地原件。</p><button type="button" class="admin-save" id="cloudMigrate">迁移本浏览器旧资料到云端</button>';
if(DetectiveCloud.isChild)cloudGroup.innerHTML='<h3>编辑会话</h3><p class="admin-tip">仅可编辑当前子链接的资料。布局和模板固定，无法分发其他链接。</p><button type="button" class="admin-save" id="cloudLogout">退出编辑</button>';
document.querySelector('.admin-body').prepend(cloudGroup);
document.getElementById('cloudLogout').onclick=async()=>{await DetectiveCloud.logout();closeAdmin()};
if(document.getElementById('cloudMigrate'))document.getElementById('cloudMigrate').onclick=async()=>{try{await DetectiveCloud.migrateLocal()}catch(e){alert('迁移未全部完成：'+e.message+' 已成功的项目保留，原本地资料未删除。')}};
const defaultSectionTitles=['话术','评价','须知'];
const titleEditor=document.createElement('div');titleEditor.id='sectionTitleEditor';titleEditor.className='section-title-editor';
for(let i=0;i<3;i++){
 const label=document.createElement('label');label.className='admin-label';label.textContent='卷宗 '+(i+1)+' 标题';
 const input=document.createElement('input');input.id='sectionTitle'+i;input.type='text';input.maxLength=12;input.value=defaultSectionTitles[i];input.setAttribute('aria-label','卷宗 '+(i+1)+' 标题');label.append(input);titleEditor.append(label);
}
const saveTitles=document.createElement('button');saveTitles.id='saveSectionTitles';saveTitles.className='admin-save';saveTitles.type='button';saveTitles.textContent='保存卷宗标题';
const titleStatus=document.createElement('p');titleStatus.id='sectionTitleStatus';titleStatus.className='admin-tip';titleStatus.setAttribute('role','status');titleStatus.textContent='每个标题最多 12 字，主页入口和档案标题同步更新。';
titleEditor.append(saveTitles,titleStatus);document.querySelector('.admin-switch').before(titleEditor);
function applySectionTitles(){
 const values=DetectiveCloud.current().sectionTitles;
 for(let i=0;i<3;i++){
  const title=Array.isArray(values)&&typeof values[i]==='string'&&values[i].trim()?values[i].trim().slice(0,12):defaultSectionTitles[i];
  sections[i].name=title;document.getElementById('sectionTitle'+i).value=title;
  const item=document.querySelector('[data-section="'+i+'"]');item.querySelector('.fname b').textContent=title;item.setAttribute('aria-label',title);
  document.querySelector('[data-admin-section="'+i+'"]').textContent=title;
 }
 if(overlay.classList.contains('show'))document.getElementById('panelTitle').textContent=sections[active].name;
}
saveTitles.onclick=async()=>{
 const values=[0,1,2].map(i=>document.getElementById('sectionTitle'+i).value.trim());saveTitles.disabled=true;titleStatus.textContent='正在保存标题…';
 try{await DetectiveCloud.setText('sectionTitles',values);applySectionTitles();await renderCoverEditor();titleStatus.textContent='卷宗标题已保存到云端';}
 catch(error){titleStatus.textContent=error.message;}finally{saveTitles.disabled=false;}
};
function applyCloudText(){
 const content=DetectiveCloud.current();
 applySectionTitles();
 statementView.textContent=typeof content.statement==='string'?content.statement:defaultStatement;
 witnessTraitTags=Array.isArray(content.tags)?content.tags.filter(t=>typeof t==='string').slice(0,3).map(t=>t.slice(0,4)):['冷静','敏锐','独立'];
 renderWitnessTags();witnessTagInputs.forEach((el,i)=>el.value=witnessTraitTags[i]||'');
 if(adminOverlay.classList.contains('show'))document.getElementById('adminStatement').value=statementView.textContent;
}
window.addEventListener('detective-cloud-loaded',()=>{
 applyCloudText();request.dispatchEvent(new Event('success'));
 if(overlay.classList.contains('show'))render();
 if(adminOverlay.classList.contains('show')){renderAdminSlots();renderCoverEditor()}
});
window.addEventListener('detective-cloud-error',()=>{if(!DetectiveCloud.hasLoaded&&overlay.classList.contains('show'))render();});
DetectiveCloud.load().catch(()=>{});
