import {chainMarkup} from './chains.js?v=20261024d';
import {MODULES,validateData,selectImpacts,saveEvent,groupEvents} from './model.js?v=20261024d';
import {esc,eventChip,availableYears,recentYears,yearRange,calendarMarkup,relationMarkup} from './calendar.js?v=20261024d';
const $=s=>document.querySelector(s);
const repo='https://github.com/xuelixunhua/commodity-research-calendar';
const storageKey='commodity-calendar-draft-v2';
const initial={commodity:'电力',year:'all',years:[],region:'all',status:'all',module:'all',importance:'all',view:'matrix',search:'',empty:false};
let state={...initial},data,published,baseHash,storedBase,loadedDraftRaw=null,hasDraft=false,editorDirty=false,editingId=null,drawerFactor=null,drawerPriority='all',toastTimer,activeRelation=null,chainMode='flow',scrollPosition={left:0,top:0};
let panObserver;
const uid=prefix=>prefix+'-'+crypto.randomUUID();
const factorById=id=>data.factors.find(f=>f.id===id);
const option=(v,label,current)=>`<option value="${esc(v)}" ${String(v)===String(current)?'selected':''}>${esc(label??v)}</option>`;
const chip=eventChip;
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,4200);}
function syncUrl(){
  const p=new URLSearchParams();
  for(const[k,v]of Object.entries(state)){
    if(k==='year')continue;
    if(k==='years')p.set(k,v.join(','));
    else if(v!==initial[k]||k==='view')p.set(k,String(v));
  }
  history.replaceState(null,'',location.pathname+'?'+p+location.hash);
}
function readUrl(){
  const p=new URLSearchParams(location.search),years=availableYears(data);
  for(const k of Object.keys(initial)){
    if(k==='years'||k==='year')continue;
    if(p.has(k))state[k]=typeof initial[k]==='boolean'?p.get(k)==='true':p.get(k);
  }
  if(!data.commodities.includes(state.commodity))state.commodity=initial.commodity;
  state.years=p.has('years')?[...new Set(p.get('years').split(',').map(Number).filter(y=>years.includes(y)))].sort((a,b)=>a-b):p.has('year')?(p.get('year')==='all'?years:[Number(p.get('year'))].filter(y=>years.includes(y))):recentYears(data,state.commodity);
  if(!state.years.length)state.years=recentYears(data,state.commodity);
  if(!p.has('view')&&matchMedia('(max-width:760px)').matches)state.view='list';
  if(!['all',...MODULES].includes(state.module))state.module='all';
  if(!['all','重点','一般'].includes(state.importance))state.importance='all';
  if(!['matrix','list','relations'].includes(state.view))state.view='matrix';
  if(state.commodity==='宏观'&&state.view==='relations')state.view='matrix';
}
function update(patch){
  const viewport=$('.matrix-scroll');
  if(viewport)scrollPosition={left:viewport.scrollLeft,top:viewport.scrollTop};
  if(patch.years||patch.commodity)scrollPosition={left:0,top:0};
  Object.assign(state,patch);syncUrl();render();
}
function switchCommodity(commodity,view=state.view){
  const ids=new Set(data.impacts.filter(i=>i.commodity===commodity).map(i=>i.event_id));
  const hasYear=data.events.some(e=>ids.has(e.id)&&state.years.includes(e.year));
  if(commodity==='宏观'&&view==='relations')view='matrix';
  update({commodity,view,years:hasYear?state.years:recentYears(data,commodity)});
}
function controls(){
  if(!data.commodities.includes(state.commodity))state.commodity=data.commodities[0];
  state.years=state.years.filter(y=>availableYears(data).includes(y));
  if(!state.years.length)state.years=recentYears(data,state.commodity);
  $('#page-title').innerHTML=`${esc(state.commodity)}<span>研究日历</span>`;
  document.title=state.commodity+' · 事件数据库';
  const icons={'电力':'ϟ','原油':'◒','甲醇':'◈','动力煤':'▰'};
  $('#commodities').innerHTML=data.commodities.map(c=>`<button data-commodity="${esc(c)}" class="${state.commodity===c?'active':''}" aria-current="${state.commodity===c?'page':'false'}"><span class="commodity-icon" aria-hidden="true">${icons[c]||'◦'}</span>${esc(c)}</button>`).join('');
  $('#modules').innerHTML=['all',...MODULES].map(m=>`<button data-module="${m}" class="${state.module===m?'active':''}" aria-pressed="${state.module===m}"><span class="module-dot"></span>${m==='all'?'全部因素':m}</button>`).join('');
  const years=availableYears(data),indices=state.years.map(y=>years.indexOf(y)),lo=Math.min(...indices),hi=Math.max(...indices);
  $('#year-ticks').innerHTML=years.map(y=>`<button data-year="${y}" class="${state.years.includes(y)?'selected':''}" aria-pressed="${state.years.includes(y)}">${y}</button>`).join('');
  $('#year-marks').innerHTML=years.map((y,i)=>state.years.includes(y)?`<span style="left:${i/Math.max(1,years.length-1)*100}%"></span>`:'').join('');
  for(const id of ['year-start','year-end']){const slider=$('#'+id);slider.min=0;slider.max=years.length-1;slider.value=id==='year-start'?lo:hi;slider.setAttribute('aria-valuetext',String(years[slider.value]));}
  const regions=[...new Set(data.impacts.map(i=>i.region))].filter(Boolean).sort((a,b)=>a.localeCompare(b,'zh'));
  if(state.region!=='all'&&!regions.includes(state.region))state.region='all';
  $('#region').innerHTML=option('all','全部地区',state.region)+regions.map(r=>option(r,r,state.region)).join('');
  $('#search').value=state.search;$('#show-empty').checked=state.empty;
  document.querySelectorAll('[data-view]').forEach(el=>{el.classList.toggle('active',el.dataset.view===state.view);el.setAttribute('aria-pressed',el.dataset.view===state.view);});
  document.querySelectorAll('#importance button').forEach(el=>{el.classList.toggle('active',el.dataset.importance===state.importance);el.setAttribute('aria-pressed',el.dataset.importance===state.importance);});
  document.querySelector('[data-view=relations]').hidden=state.commodity==='宏观';
  if(state.commodity==='宏观'&&state.view==='relations')state.view='matrix';
  $('#matrix-options').hidden=state.view!=='matrix';
  $('#year-picker').hidden=state.view==='relations';
  $('#modules').hidden=state.view==='relations';
  $('.dimensions-label').hidden=state.view==='relations';
  $('.page-footer').hidden=state.view==='relations';
  $('#result-actions').hidden=state.view==='relations';
  $('.quick-filters').hidden=state.view==='relations';
  $('#draft-notice').hidden=!hasDraft;
  if(hasDraft)$('#draft-notice').innerHTML=(storedBase!==baseHash?'网站已有新数据，本地草稿尚未合并。请先导出保留修改，再对照发布版。':'当前展示本浏览器的草稿，尚未发布。')+'<button data-manage>数据管理</button>';
}
function render(){
  const graph=$('.graph-scroll'),graphLeft=graph&&graph.dataset.commodity===state.commodity?graph.scrollLeft:null;
  panObserver?.disconnect();
  controls();
  const impacts=selectImpacts(data,state),base=selectImpacts(data,state,true);
  $('#result-count').textContent=new Set(impacts.map(i=>i.event_id)).size+' 条记录'+(state.region!=='all'?' · 含全国与全球背景':'');
  $('#calendar-position').textContent=state.view==='matrix'&&state.years.length>1?'横向滚动查看不同年份':'';
  if(state.view==='relations'){
    $('#result-count').textContent='产业联系';$('#calendar-position').textContent='';
    $('#content').innerHTML=chainMarkup(data,state.commodity,chainMode,activeRelation);
    const viewport=$('.graph-scroll');
    if(!viewport)return;
    viewport.dataset.commodity=state.commodity;
    if(graphLeft!==null)viewport.scrollLeft=graphLeft;
    else {
      const center=$('.graph-node.central').getBoundingClientRect(),bounds=viewport.getBoundingClientRect();
      viewport.scrollLeft=center.left-bounds.left+center.width/2-bounds.width/2;
    }
    attachPan(viewport);return;
  }
  if(state.view==='list'){renderList(impacts);return;}
  $('#content').innerHTML=calendarMarkup(data,state,impacts,base);
  const viewport=$('.matrix-scroll');
  if(viewport){viewport.scrollLeft=scrollPosition.left;viewport.scrollTop=scrollPosition.top;attachPan(viewport);}
}
function attachPan(viewport){
  const control=viewport.nextElementSibling,slider=control.querySelector('input');
  const sync=()=>{
    const max=Math.max(0,viewport.scrollWidth-viewport.clientWidth);
    control.hidden=max<2;
    slider.max=String(max);slider.value=String(viewport.scrollLeft);
    slider.setAttribute('aria-valuetext',Math.round(max?viewport.scrollLeft/max*100:0)+'%');
  };
  slider.addEventListener('input',()=>{viewport.scrollLeft=Number(slider.value);});
  viewport.addEventListener('scroll',sync,{passive:true});
  panObserver=new ResizeObserver(sync);panObserver.observe(viewport);sync();
}
function emptyMarkup(){return '<div class="empty"><strong>当前条件下暂无记录</strong><button data-reset>重置筛选</button> <button data-new>＋ 记录</button></div>';}
function renderList(impacts){
  const groups=groupEvents(impacts);
  $('#content').innerHTML=groups.length?`<div class="event-list">${[...state.years].reverse().map(year=>{
    const rows=groups.filter(g=>g.event.year===year);
    return rows.length?`<section class="list-year"><h2>${year}<span>${rows.length} 条记录</span></h2>${rows.map(({event:e,impacts:items})=>`<article class="event-row"><div class="event-date"><strong>${e.quarter?'Q'+e.quarter:'全年'}</strong>${esc(e.region)}</div><div><button class="row-title" data-event="${e.id}">${esc(e.title)}</button><p>${esc(e.fact)}</p><div class="tag-row">${items.map(i=>`<span class="tag ${i.importance==='重点'?'key':''}">${i.importance==='重点'?'★ ':''}${i.factor.module} / ${esc(i.factor.name)}</span>`).join('')}${e.status==='计划'?'<span class="tag plan">预期</span>':''}</div></div></article>`).join('')}</section>`:'';
  }).join('')}</div>`:emptyMarkup();
}
function showCell(factorId,year,quarter){
  const f=factorById(factorId),items=selectImpacts(data,state).filter(i=>i.factor_id===factorId&&i.event.year===year&&i.event.quarter===quarter);
  $('#drawer-eyebrow').textContent=f.commodity+' / '+f.module;
  $('#drawer-content').innerHTML=`<h2 id="drawer-title">${esc(f.name)} · ${year} Q${quarter}</h2><div class="factor-history">${items.map(i=>chip(i,true)).join('')}</div>`;
  openDrawer();
}
function openDrawer(){if(!$('#drawer').open)$('#drawer').showModal();$('#drawer').scrollTop=0;}
function showEvent(id){
  const e=data.events.find(x=>x.id===id);if(!e)return;
  drawerFactor=null;
  const linked=data.impacts.filter(i=>i.event_id===id),current=linked.filter(i=>i.commodity===state.commodity);
  const display=current.length?current:linked;
  $('#drawer-eyebrow').textContent='事件事实与品种影响';
  $('#drawer-content').innerHTML=`<h2 id="drawer-title">${esc(e.title)}</h2><div class="tag-row"><span class="tag">${esc(e.period||e.year+'年')}</span><span class="tag">${esc(e.region)}</span><span class="tag ${e.status==='计划'?'plan':''}">${e.status==='计划'?'预期':e.record_type||e.status}</span></div><p class="detail-fact">${esc(e.fact)}</p>${e.timing_basis?`<p class="definition">${esc(e.timing_basis)}</p>`:''}<p class="detail-source">${e.url?`<a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">${esc(e.source||'查看来源')} ↗</a>`:esc(e.source||'暂未填写来源')}${e.published?' · 发布于 '+e.published:''}${(e.sources||[]).map(source=>`<br><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)} ↗</a>`).join('')}</p><section class="detail-section"><h3>关联品种</h3><div class="linked-commodities">${[...new Set(linked.map(i=>i.commodity))].map(c=>`<button class="${c===state.commodity?'active':''}" data-linked-commodity="${esc(c)}" data-linked-event="${id}">${esc(c)} · ${linked.filter(i=>i.commodity===c).length}</button>`).join('')}</div></section><section class="detail-section"><h3>${esc(current.length?state.commodity:'相关品种')}的影响</h3>${display.map(i=>{const f=factorById(i.factor_id);return `<article class="impact-detail"><h3><span>${f.module} / ${esc(f.name)} · ${esc(i.region)}</span><button class="text-button" data-toggle-priority="${i.id}" aria-label="${i.importance==='重点'?'改为一般':'标为重点'}：${esc(i.topic)}">${i.importance==='重点'?'★ 重点':'☆ 一般'}</button></h3><p>${esc(i.impact)}</p><p class="definition"><b>观察指标</b> ${esc(i.metric)}<br><b>成立条件</b> ${esc(i.condition)}<br><b>影响窗口</b> ${esc(i.window)}</p><p class="definition">${i.importance}：${esc(i.reason)}</p></article>`;}).join('')}</section><div class="detail-actions"><button class="primary" data-edit="${id}">编辑事件与影响</button><button data-share="${id}">复制事件链接</button></div>`;
  openDrawer();
}
function showFactor(id,priority='all'){
  const f=factorById(id);if(!f)return;drawerFactor=id;drawerPriority=priority;
  const all=selectImpacts(data,{...initial,years:availableYears(data),commodity:f.commodity}).filter(i=>i.factor_id===id),items=all.filter(i=>priority==='all'||i.importance===priority).sort((a,b)=>b.event.year-a.event.year||b.event.quarter-a.event.quarter);
  $('#drawer-eyebrow').textContent=f.commodity+' / '+f.module;
  $('#drawer-content').innerHTML=`<h2 id="drawer-title">${esc(f.name)}</h2><p class="definition">${esc(f.description)}</p><div class="segmented">${['all','重点','一般'].map(p=>`<button data-factor-priority="${p}" class="${p===priority?'active':''}">${p==='all'?'全部历史':p==='重点'?'★ 重点':'一般'} ${all.filter(i=>p==='all'||i.importance===p).length}</button>`).join('')}</div><div class="factor-history">${items.map(i=>chip(i,true)).join('')||'<p class="definition">暂无相应事件，可在“记录事件”中关联此因素。</p>'}</div><section class="detail-section"><h3>机制与跟踪指标</h3>${f.metrics?`<p>${esc(f.metrics)}</p>`:''}${(f.reference_notes||[]).map(n=>`<div class="driver"><p>${esc(n.text)}</p><small>${esc(n.source)} · ${esc(n.boundary)}</small></div>`).join('')}${f.drivers.map(d=>`<div class="driver"><b>${esc(d.factor)}</b><p>${esc(d.mechanism)}</p><small>指标：${esc(d.metrics)}<br>窗口：${esc(d.season)}<br>条件：${esc(d.boundary)}</small></div>`).join('')}</section><button class="primary" data-new-factor="${id}">＋ 在此因素下记录事件</button>`;
  openDrawer();
}
function persist(next){
  validateData(next);
  if(localStorage.getItem(storageKey)!==loadedDraftRaw)throw Error('另一个标签页已修改草稿。当前输入尚未保存；请保留输入内容后刷新核对。');
  const raw=JSON.stringify({base:hasDraft?storedBase:baseHash,data:next});
  try{localStorage.setItem(storageKey,raw);loadedDraftRaw=raw;}catch{throw Error('浏览器无法保存草稿，请检查存储空间或隐私设置。');}
  if(!hasDraft)storedBase=baseHash;data=next;hasDraft=true;render();
}
function factorOptions(commodity,current){return MODULES.map(m=>`<optgroup label="${m}">${data.factors.filter(f=>f.commodity===commodity&&f.module===m).map(f=>option(f.id,f.name,current)).join('')}</optgroup>`).join('');}
function input(label,name,value,span='',type='text',required=false){return `<label class="${span}">${label}<input name="${name}" value="${esc(value)}" type="${type}" ${required?'required':''}></label>`;}
function textarea(label,name,value,span='span-4',required=false){return `<label class="${span}">${label}<textarea name="${name}" rows="2" ${required?'required':''}>${esc(value)}</textarea></label>`;}
function impactForm(i,index){return `<fieldset class="impact-edit" data-impact-id="${i.id}"><legend>品种影响 ${index+1}</legend><div class="form-grid"><label>品种<select name="commodity">${data.commodities.map(c=>option(c,c,i.commodity)).join('')}</select></label><label>因素<select name="factor_id">${factorOptions(i.commodity,i.factor_id)}</select></label>${input('适用地区','region',i.region)}<label>关注程度<select name="importance">${['重点','一般'].map(p=>option(p,p,i.importance)).join('')}</select></label>${input('影响主题','topic',i.topic,'span-2')}${input('判断理由','reason',i.reason,'span-2')}${textarea('影响机制','impact',i.impact,'span-4',true)}${input('观察指标','metric',i.metric,'span-2')}${input('影响窗口','window',i.window,'span-2')}${textarea('成立条件','condition',i.condition)}</div><button type="button" class="remove-impact">移除此关联</button></fieldset>`;}
function openEditor(id=null,preFactor=null){
  const existing=id?data.events.find(e=>e.id===id):null;
  const e=existing||{id:uid('E'),title:'',year:state.years.at(-1)||new Date().getFullYear(),quarter:1,date:'',period:'',status:'已发生',region:state.region==='all'?'全国':state.region,category:'',fact:'',published:'',source:'',url:''};
  editingId=e.id;
  const f=preFactor?factorById(preFactor):data.factors.find(f=>f.commodity===state.commodity&&(state.module==='all'||f.module===state.module));
  const impacts=existing?data.impacts.filter(i=>i.event_id===id):[blankImpact(f)];
  if($('#drawer').open)$('#drawer').close();
  $('#editor-title').textContent=existing?'编辑事件与品种影响':'记录新事件';
  $('#event-form').innerHTML=`<p class="form-note">事件正文由 ${[...new Set(impacts.map(i=>i.commodity))].map(esc).join('、')}共用。下方分别填写各品种的因素和影响。</p><div class="form-grid">${input('事件名称','title',e.title,'span-4','text',true)}${input('年份','year',e.year,'','number',true)}<label>季度<select name="quarter">${[0,1,2,3,4].map(q=>option(q,q?'Q'+q:'全年',e.quarter)).join('')}</select></label>${input('确切日期（可空）','date',e.date,'','date')}<label>状态<select name="status">${['已发生','计划'].map(s=>option(s,s,e.status)).join('')}</select></label>${input('时间描述','period',e.period,'span-2')}${input('事件地区','region',e.region)}${input('事件类型','category',e.category)}${textarea('发生了什么','fact',e.fact,'span-4',true)}${input('来源名称','source',e.source,'span-2')}${input('来源发布日期（可空）','published',e.published,'span-2','date')}${input('来源链接','url',e.url,'span-4','url')}</div><h3 class="form-section-title">各品种的影响 <button type="button" id="add-impact">＋ 关联品种 / 因素</button></h3><div id="impact-forms">${impacts.map(impactForm).join('')}</div><p id="form-error" class="error" role="alert"></p><div class="form-actions"><span class="hint">保存到本浏览器，发布需提交 GitHub</span><button type="button" data-close="editor">取消</button><button type="submit" class="primary">保存草稿</button></div>`;
  editorDirty=false;$('#editor').showModal();$('#editor').scrollTop=0;
}
function blankImpact(f){return {id:uid('I'),event_id:editingId,commodity:f.commodity,factor_id:f.id,region:state.region==='all'?'全国':state.region,importance:'一般',topic:'',impact:'',metric:'',condition:'',window:'',reason:''};}
function closeEditor(){if(editorDirty&&!confirm('尚有未保存的修改，确定放弃吗？'))return;$('#editor').close();editorDirty=false;}
function manage(){ $('#import-error').textContent='';$('#data-dialog').showModal(); }
async function boot(){
  try{
    const response=await fetch('./data/catalog.json',{cache:'no-cache'});if(!response.ok)throw Error('数据文件加载失败（'+response.status+'）。');
    published=validateData(await response.json());data=structuredClone(published);
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(published)));baseHash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
    try{const raw=localStorage.getItem(storageKey);loadedDraftRaw=raw;if(raw){const saved=JSON.parse(raw);data=validateData(saved.data);storedBase=saved.base;hasDraft=true;}}catch{toast('本地草稿无法读取，当前显示网站数据；原草稿仍保留。');}
    readUrl();render();
    const eventId=new URLSearchParams(location.hash.slice(1)).get('event');if(eventId)showEvent(eventId);
  }catch(err){$('#result-count').textContent='数据暂不可用';$('#content').innerHTML=`<div class="empty"><strong>无法载入事件日历</strong>${esc(err.message)}<br><a href="${repo}">在 GitHub 查看数据 ↗</a></div>`;}
}
document.addEventListener('click',async ev=>{
  const chainTarget=ev.target.closest('[data-chain-node],[data-chain-mode]');
  if(chainTarget){if(chainTarget.dataset.chainMode){chainMode=chainTarget.dataset.chainMode;activeRelation=null;}else activeRelation=chainTarget.dataset.chainNode;render();return;}
  const graphTarget=ev.target.closest('[data-graph-commodity],[data-relation]');
  if(graphTarget&&data){
    if(graphTarget.dataset.graphCommodity){activeRelation=null;chainMode='flow';switchCommodity(graphTarget.dataset.graphCommodity,'relations');}
    else {activeRelation=graphTarget.dataset.relation;render();}
    return;
  }
  const b=ev.target.closest('button');if(!b)return;
  if(b.dataset.close){if(b.dataset.close==='editor')closeEditor();else $('#'+b.dataset.close).close();return;}
  if(!data)return;
  if(b.dataset.year){
    const y=Number(b.dataset.year),selected=state.years.includes(y)?state.years.filter(v=>v!==y):[...state.years,y];
    if(!selected.length){toast('请至少选择一个年份。');return;}
    update({years:selected.sort((a,b)=>a-b)});return;
  }
  if(b.dataset.years){update({years:b.dataset.years==='all'?availableYears(data):recentYears(data,state.commodity)});return;}
  if(b.dataset.cellFactor){showCell(b.dataset.cellFactor,Number(b.dataset.cellYear),Number(b.dataset.cellQuarter));return;}
  if(b.dataset.commodity){activeRelation=null;chainMode='flow';switchCommodity(b.dataset.commodity);return;}
  if(b.dataset.module){update({module:b.dataset.module});return;}
  if(b.dataset.view){update({view:b.dataset.view});return;}
  if(b.dataset.importance){update({importance:b.dataset.importance});return;}
  if(b.dataset.event){showEvent(b.dataset.event);return;}
  if(b.dataset.factor){showFactor(b.dataset.factor);return;}
  if(b.dataset.factorPriority){showFactor(drawerFactor,b.dataset.factorPriority);return;}
  if(b.dataset.linkedCommodity){switchCommodity(b.dataset.linkedCommodity);showEvent(b.dataset.linkedEvent);return;}
  if(b.dataset.edit){openEditor(b.dataset.edit);return;}
  if(b.dataset.newFactor){openEditor(null,b.dataset.newFactor);return;}
  if(b.id==='add-event'||b.hasAttribute('data-new')){openEditor();return;}
  if(b.id==='reset-filters'||b.hasAttribute('data-reset')){update({...initial,commodity:state.commodity,years:recentYears(data,state.commodity)});return;}
  if(b.id==='manage'||b.hasAttribute('data-manage')){manage();return;}
  if(b.dataset.share){const url=new URL(location.href);url.hash='event='+b.dataset.share;try{await navigator.clipboard.writeText(url.href);toast('事件链接已复制。');}catch{prompt('复制事件链接',url.href);}return;}
  if(b.dataset.togglePriority){const next=structuredClone(data),i=next.impacts.find(i=>i.id===b.dataset.togglePriority);i.importance=i.importance==='重点'?'一般':'重点';i.reason='手动调整关注程度；可在编辑中补充理由';try{persist(next);showEvent(i.event_id);toast('关注程度已保存到本地草稿。');}catch(err){toast(err.message);}return;}
  if(b.id==='add-impact'){const f=data.factors.find(f=>f.commodity===state.commodity);$('#impact-forms').insertAdjacentHTML('beforeend',impactForm(blankImpact(f),$('#impact-forms').children.length));editorDirty=true;return;}
  if(b.classList.contains('remove-impact')){if($('#impact-forms').children.length<=1){$('#form-error').textContent='每个事件至少关联一个品种因素。';return;}b.closest('fieldset').remove();editorDirty=true;return;}
  if(b.id==='export-data'){
    if(hasDraft&&storedBase!==baseHash&&!confirm('草稿基于旧发布版，直接提交可能覆盖他人修改。导出后请先核对差异。继续导出？'))return;
    const blob=new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='catalog.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已导出 catalog.json。');return;
  }
  if(b.id==='restore-data'){if(!confirm('放弃当前浏览器的全部草稿，恢复网站发布版？'))return;try{localStorage.removeItem(storageKey);loadedDraftRaw=null;data=structuredClone(published);hasDraft=false;storedBase=null;render();$('#data-dialog').close();toast('已恢复网站发布版。');}catch{toast('无法清除草稿，请检查浏览器存储设置。');}}
});
for(const key of ['region'])$('#'+key).addEventListener('change',e=>update({[key]:e.target.value}));
$('#search').addEventListener('input',e=>update({search:e.target.value}));
$('#show-empty').addEventListener('change',e=>update({empty:e.target.checked}));

$('#event-form').addEventListener('input',()=>editorDirty=true);
$('#event-form').addEventListener('change',e=>{
  editorDirty=true;
  if(e.target.name==='commodity'){const fieldset=e.target.closest('fieldset');fieldset.querySelector('[name=factor_id]').innerHTML=factorOptions(e.target.value,'');}
  if(e.target.name==='date'&&e.target.value){const form=$('#event-form');form.querySelector('[name=year]').value=e.target.value.slice(0,4);form.querySelector('[name=quarter]').value=Math.ceil(+e.target.value.slice(5,7)/3);}
});
$('#event-form').addEventListener('submit',ev=>{
  ev.preventDefault();const form=ev.currentTarget,shared=form.querySelector('.form-grid');
  const previous=data.events.find(e=>e.id===editingId);const event={...(previous||{}),id:editingId};for(const el of shared.querySelectorAll('[name]'))event[el.name]=['year','quarter'].includes(el.name)?Number(el.value):el.value.trim();
  event.period_scope=event.quarter===0?'year':'quarter';
  const impacts=[...form.querySelectorAll('.impact-edit')].map(fs=>{const i={id:fs.dataset.impactId,event_id:editingId};for(const el of fs.querySelectorAll('[name]'))i[el.name]=el.value.trim();return i;});
  try{persist(saveEvent(data,event,impacts));editorDirty=false;$('#editor').close();showEvent(event.id);toast('已保存草稿，关联品种同步更新。');}catch(err){$('#form-error').textContent=err.message;$('#form-error').scrollIntoView({block:'nearest'});}
});
$('#editor').addEventListener('cancel',e=>{e.preventDefault();closeEditor();});
window.addEventListener('beforeunload',e=>{if(editorDirty){e.preventDefault();e.returnValue='';}});
window.addEventListener('hashchange',()=>{const id=new URLSearchParams(location.hash.slice(1)).get('event');if(data&&id)showEvent(id);});
window.addEventListener('storage',e=>{if(e.key===storageKey)toast('另一个标签页修改了草稿。请导出当前修改或刷新后继续。');});
$('#import-data').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;
  try{if(file.size>8*1024*1024)throw Error('文件超过 8 MB，请拆分或检查数据。');const next=validateData(JSON.parse(await file.text()));if(!confirm(`导入 ${next.events.length} 个事件并替换本浏览器的现有数据？`))return;persist(next);$('#data-dialog').close();toast('已导入本地草稿，尚未发布。');}catch(err){$('#import-error').textContent='导入失败：'+err.message;}finally{e.target.value='';}
});

for(const id of ['year-start','year-end']){
  $('#'+id).addEventListener('input',()=>{
    const years=availableYears(data),start=Number($('#year-start').value),end=Number($('#year-end').value);
    state.years=yearRange(years,start,end);
    $('#year-ticks').querySelectorAll('button').forEach(b=>{b.classList.toggle('selected',state.years.includes(Number(b.dataset.year)));b.setAttribute('aria-pressed',state.years.includes(Number(b.dataset.year)));});
    $('#year-marks').innerHTML=years.map((y,i)=>state.years.includes(y)?`<span style="left:${i/Math.max(1,years.length-1)*100}%"></span>`:'').join('');
    $('#'+id).setAttribute('aria-valuetext',String(years[Number($('#'+id).value)]));
  });
  $('#'+id).addEventListener('change',()=>update({years:[...state.years]}));
}
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('.graph-node,.graph-edge')){e.preventDefault();e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}});
boot();
