import {MODULES} from './model.js?v=20261024c';
export const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function availableYears(data) {
  const values=data.events.map(e=>e.year);
  return Array.from({length:Math.max(...values)-Math.min(...values)+1},(_,i)=>Math.min(...values)+i);
}
export function recentYears(data,commodity) {
  const ids=new Set(data.impacts.filter(i=>i.commodity===commodity).map(i=>i.event_id));
  const latest=Math.max(...data.events.filter(e=>ids.has(e.id)).map(e=>e.year));
  return availableYears(data).filter(y=>y>=latest-1&&y<=latest);
}
export function yearRange(years,start,end) {
  return years.slice(Math.min(start,end),Math.max(start,end)+1);
}
export function eventChip(i,withPeriod=false) {
  const e=i.event;
  return `<button class="event-chip ${i.importance==='重点'?'key':''} ${e.status==='计划'?'plan':''}" data-event="${e.id}"><span class="chip-title">${i.importance==='重点'?'<span class="key-star">★</span>':''}${esc(e.title)}</span><span class="chip-meta">${withPeriod?e.year+(e.quarter?' Q'+e.quarter:' 全年')+' · ':''}${esc(i.region)}${e.status==='计划'?' · '+(e.timing_basis?'预期':'计划'):''}</span></button>`;
}
function panMarkup(label,start='左',end='右') {
  return `<div class="horizontal-pan" hidden><span>${start}</span><input type="range" min="0" max="100" value="0" step="1" aria-label="${label}"><span>${end}</span></div>`;
}
export function calendarMarkup(data,state,impacts,base) {
  const factors=MODULES.flatMap(m=>data.factors.filter(f=>f.commodity===state.commodity&&f.module===m&&(state.module==='all'||f.module===state.module)&&(state.empty||base.some(i=>i.factor_id===f.id))));
  if(!factors.length)return '<div class="empty">当前筛选下暂无记录。<br><button data-reset>重置筛选</button></div>';
  let previous='';
  const rows=factors.map(f=>{
    const start=previous!==f.module;previous=f.module;
    const annual=f.period_scope==='year'||base.some(i=>i.factor_id===f.id&&i.event.quarter===0);
    if(annual)return `<tr class="annual-row" data-section="综述"><th class="factor-head" scope="row"><span class="module-name">综述</span><button data-factor="${f.id}">${esc(f.name)}</button></th>${state.years.map(year=>`<td colspan="4" data-year="${year}" data-period="year">${impacts.filter(i=>i.factor_id===f.id&&i.event.year===year&&i.event.quarter===0).map(i=>eventChip(i)).join('')}</td>`).join('')}</tr>`;
    return `<tr data-section="${f.module}" class="${start?'section-start':''}"><th class="factor-head" scope="row"><span class="module-name">${f.module}</span><button data-factor="${f.id}">${esc(f.name)}</button></th>${state.years.flatMap(year=>[1,2,3,4].map(q=>{
      const items=impacts.filter(i=>i.factor_id===f.id&&i.event.year===year&&i.event.quarter===q).sort((a,b)=>(a.importance==='重点'?0:1)-(b.importance==='重点'?0:1)||a.event.id.localeCompare(b.event.id));
      return `<td data-year="${year}" data-quarter="${q}" class="${q===1?'year-start':''}">${items.slice(0,2).map(i=>eventChip(i)).join('')}${items.length>2?`<button class="more-events" data-cell-factor="${f.id}" data-cell-year="${year}" data-cell-quarter="${q}">另 ${items.length-2} 条</button>`:''}</td>`;
    })).join('')}</tr>`;
  }).join('');
  return `<div class="matrix-scroll" tabindex="0" aria-label="按年份分组的季度记录，可横向滚动"><table class="matrix year-matrix" style="--years:${state.years.length}"><colgroup><col class="factor-col">${state.years.flatMap(()=>[1,2,3,4].map(()=>'<col class="quarter-col">')).join('')}</colgroup><thead><tr><th rowspan="2" scope="col" class="factor-corner">研究因素</th>${state.years.map(y=>`<th colspan="4" class="year-heading" data-year-heading="${y}">${y}<span>${new Set(impacts.filter(i=>i.event.year===y).map(i=>i.event_id)).size} 条记录</span></th>`).join('')}</tr><tr>${state.years.flatMap(()=>[1,2,3,4].map(q=>`<th scope="col" class="quarter-heading ${q===1?'year-start':''}">Q${q}<small>${(q-1)*3+1}—${q*3}月</small></th>`)).join('')}</tr></thead><tbody>${rows}</tbody></table></div>${panMarkup('横向浏览季度记录',state.years[0],state.years.at(-1))}`;
}

const palettes={cost:'#52678d',demand:'#a87846',substitution:'#8674a8'};
const node=(id,name,role,x,y,commodity)=>({id,name,role,x,y,commodity});
const layouts={
  '电力':{
    nodes:[node('coal','煤炭','燃料投入',145,135,'动力煤'),node('gas','天然气','燃料投入',145,395),node('power','电力','发电与供需平衡',485,265,'电力'),node('methanol','甲醇','工业用电负荷',825,265,'甲醇')],
    edges:[['R01','M 211 120 C 315 120 325 230 419 245',310,154,'燃料成本'],['R02','M 419 276 C 320 290 300 190 211 157',307,256,'电煤需求'],['R09','M 211 395 C 315 395 322 315 419 286',305,368,'气电成本'],['R07','M 551 248 C 620 190 690 190 759 248',655,205,'用电成本'],['R08','M 759 281 C 690 350 620 350 551 281',655,335,'工业负荷']]
  },
  '动力煤':{
    nodes:[node('coal','煤炭','燃料与原料',280,265,'动力煤'),node('power','电力','电煤需求',710,135,'电力'),node('methanol','甲醇','煤化工原料需求',710,395,'甲醇')],
    edges:[['R01','M 346 240 C 460 145 500 110 644 120',486,140,'煤电燃料成本'],['R02','M 644 155 C 530 240 475 260 346 280',500,238,'电煤消耗'],['R03','M 346 291 C 455 390 535 395 644 395',495,373,'煤制甲醇成本']]
  },
  '甲醇':{
    nodes:[node('coal','煤炭','煤头原料',125,100,'动力煤'),node('gas','天然气','气头原料',125,265),node('power','电力','公用工程',125,435,'电力'),node('methanol','甲醇','装置产量与开工',475,265,'甲醇'),node('mto','MTO / 烯烃','甲醇下游需求',825,130),node('oil','原油','替代生产路线',825,420,'原油')],
    edges:[['R03','M 191 100 C 300 100 320 200 409 242',295,157,'原料成本'],['R04','M 191 265 L 409 265',300,249,'气价与气源'],['R07','M 191 420 C 280 420 320 320 409 283',290,358,'用电成本'],['R08','M 409 300 C 390 425 310 477 191 454',340,458,'工业用电'],['R12','M 541 240 C 610 140 675 105 759 111',643,142,'甲醇原料'],['R13','M 759 150 C 675 240 620 263 541 268',666,251,'外采需求'],['R05','M 759 420 C 650 420 615 330 541 291',645,383,'油制烯烃竞争']]
  },
  '原油':{
    nodes:[node('oil','原油','油制路线',135,165,'原油'),node('naphtha','石脑油','裂解原料',470,165),node('olefin','烯烃','共同终端产品',815,165),node('methanol','甲醇','煤 / 气制路线',470,415,'甲醇'),node('mto','MTO','甲醇制烯烃',815,415)],
    edges:[['R14','M 201 165 L 404 165',303,144,'原料成本'],['R15','M 536 165 L 749 165',645,144,'油制烯烃'],['R16','M 815 200 L 815 380',815,291,'售价与路线竞争'],['R12','M 536 400 C 615 350 675 350 749 400',645,367,'甲醇原料'],['R13','M 749 432 C 675 480 615 480 536 432',645,470,'外采需求'],['R06','M 404 415 C 235 415 135 355 135 200',240,359,'燃料替代']]
  }
};
export function relationMarkup(data,commodity,activeId) {
  const layout=layouts[commodity];
  if(!layout)return '<div class="empty">暂无该品种的联动关系。</div>';
  const ids=new Set(data.relations.map(r=>r.id));
  const edges=layout.edges.filter(e=>ids.has(e[0]));
  if(!edges.length)return '<div class="empty">暂无已录入的联动关系。</div>';
  const active=data.relations.find(r=>r.id===activeId)||data.relations.find(r=>r.id===edges[0][0]);
  const svgEdges=edges.map(([id,path,x,y,label])=>{
    const r=data.relations.find(r=>r.id===id),color=palettes[r.kind]||palettes.cost,w=label.length*12+18;
    return `<g class="graph-edge ${active.id===id?'selected':''}" data-relation="${id}" tabindex="0" role="button" aria-label="${esc(r.from+'到'+r.to+'：'+label)}"><path class="edge-hit" d="${path}"/><path class="edge-line ${r.kind==='substitution'?'dashed':''}" stroke="${color}" d="${path}" marker-end="url(#arrow-${r.kind||'cost'})"/><rect x="${x-w/2}" y="${y-12}" width="${w}" height="24" rx="4"/><text x="${x}" y="${y+4}" fill="${color}">${esc(label)}</text></g>`;
  }).join('');
  const svgNodes=layout.nodes.map(n=>`<g class="graph-node ${n.commodity===commodity?'central':''} ${n.commodity?'clickable':''}" ${n.commodity?`data-graph-commodity="${n.commodity}" tabindex="0" role="button" aria-label="查看${n.commodity}联动"`:''}><rect x="${n.x-66}" y="${n.y-35}" width="132" height="70" rx="8"/><text class="node-name" x="${n.x}" y="${n.y-3}">${n.name}</text><text class="node-role" x="${n.x}" y="${n.y+19}">${n.role}</text></g>`).join('');
  return `<div class="graph-panel"><div class="graph-legend"><span><i style="background:${palettes.cost}"></i>成本与原料</span><span><i style="background:${palettes.demand}"></i>需求与负荷</span><span><i style="background:${palettes.substitution}"></i>替代与竞争</span><small>箭头表示影响传导方向</small></div><div class="graph-scroll"><svg viewBox="0 0 960 525" aria-label="${commodity}产业联系图"> <defs>${Object.entries(palettes).map(([kind,color])=>`<marker id="arrow-${kind}" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M 0 0 L 9 4.5 L 0 9 Z" fill="${color}"/></marker>`).join('')}</defs>${svgEdges}${svgNodes}</svg></div>${panMarkup("横向浏览品种联动")}<div class="relation-insight"><strong>${esc(active.from)} → ${esc(active.to)} <span>${esc(active.type)}</span></strong><p>${esc(active.path)}</p><small>${esc(active.boundary)}</small></div></div>`;
}
