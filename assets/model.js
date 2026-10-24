export const MODULES = ['综述', '供给', '需求', '数据', '宏观'];
export function validateData(data) {
  if (!data || data.schema_version !== 2) throw Error('需要第 2 版事件数据格式。');
  for (const key of ['commodities', 'events', 'impacts', 'factors', 'relations']) {
    if (!Array.isArray(data[key])) throw Error(`缺少 ${key} 数据表。`);
  }
  if (!data.commodities.length || data.commodities.some(x=>typeof x!=='string'||!x.trim())) throw Error('品种列表不能为空。');
  if(!data.events.length||!data.factors.length)throw Error('至少需要一个事件和研究因素。');
  if (new Set(data.commodities).size!==data.commodities.length) throw Error('品种名称重复。');
  const maps={};
  for (const key of ['events','impacts','factors','relations']) {
    maps[key]=new Map();
    for (const row of data[key]) {
      if (!row || typeof row.id!=='string' || !/^[\w-]+$/.test(row.id)) throw Error(`${key} 包含无效 ID。`);
      if (maps[key].has(row.id)) throw Error(`ID 重复：${row.id}`);
      maps[key].set(row.id,row);
    }
  }
  const strings=(row,keys)=>keys.forEach(key=>{if(typeof row[key]!=='string')throw Error(`${row.id} 的 ${key} 必须是文本。`);});
  for (const e of data.events) {
    strings(e,['title','fact','region','status','period','date','source','url','published','category']);
    if (!e.title.trim()||!e.fact.trim()) throw Error(`${e.id} 缺少事件名称或事实。`);
    if (!Number.isInteger(e.year)||e.year<1900||e.year>2200||!Number.isInteger(e.quarter)||e.quarter<0||e.quarter>4) throw Error(`${e.id} 的年份或季度无效。`);
    if (!['已发生','计划'].includes(e.status)) throw Error(`${e.id} 的状态无效。`);
    if(e.quarter===0&&e.period_scope!=='year')throw Error(`${e.id} 的非季度记录需要明确年度范围。`);
    if (e.url && !/^https?:\/\/[^\s]+$/i.test(e.url)) throw Error(`${e.id} 的来源链接应以 https:// 或 http:// 开头。`);
    for (const field of ['date','published']) {
      const val=e[field];
      if(val && (!/^\d{4}-\d{2}-\d{2}$/.test(val)||!Number.isFinite(Date.parse(val))||new Date(val).toISOString().slice(0,10)!==val)) throw Error(`${e.id} 的日期无效。`);
    }
    if(e.date && (+e.date.slice(0,4)!==e.year || Math.ceil(+e.date.slice(5,7)/3)!==e.quarter)) throw Error(`${e.id} 的日期与年份、季度不一致。`);
  }
  for (const f of data.factors) {
    strings(f,['commodity','module','name','description','metrics']);
    if (!data.commodities.includes(f.commodity)||!MODULES.includes(f.module)||!f.name.trim()||!Array.isArray(f.drivers)) throw Error(`${f.id} 的因素定义无效。`);
    for(const d of f.drivers)strings(d,['factor','metrics','mechanism','season','boundary','source']);
  }
  for (const i of data.impacts) {
    strings(i,['event_id','commodity','region','factor_id','importance','topic','impact','metric','condition','window','reason']);
    if (!maps.events.has(i.event_id)) throw Error(`${i.id} 关联了不存在的事件。`);
    const f=maps.factors.get(i.factor_id);
    if(!f||f.commodity!==i.commodity) throw Error(`${i.id} 的品种与因素不匹配。`);
    if(!['重点','一般'].includes(i.importance)||!i.impact.trim()) throw Error(`${i.id} 缺少关注程度或影响。`);
  }
  for(const e of data.events) if(!data.impacts.some(i=>i.event_id===e.id))throw Error(`${e.id} 至少需要关联一个品种因素。`);
  for(const r of data.relations)strings(r,['from','to','type','path','metric','boundary']);
  for(const [commodity,views] of Object.entries(data.chains||{})){
    if(!data.commodities.includes(commodity))throw Error('产业链品种不存在。');
    for(const g of Object.values(views)){
      const ids=new Set(g.nodes.map(n=>n.id));
      if(ids.size!==g.nodes.length||!ids.has(g.focus))throw Error('产业链节点无效。');
      for(const n of g.nodes)if(typeof n.id!=='string'||!/^[\w-]+$/.test(n.id)||![n.x,n.y].every(Number.isFinite)||!n.mechanism||!n.boundary)throw Error('产业链缺少有效节点、机制或位置。');
      for(const e of g.edges)if(!ids.has(e.from_id)||!ids.has(e.to_id)||!['实物流','成本','需求','反馈'].includes(e.kind))throw Error('产业链箭头或引用无效。');
    }
  }
  return data;
}
export function selectImpacts(data,state,ignoreImportance=false) {
  const events=new Map(data.events.map(e=>[e.id,e]));
  const factors=new Map(data.factors.map(f=>[f.id,f]));
  return data.impacts.filter(i=>{
    const e=events.get(i.event_id),f=factors.get(i.factor_id);
    if(i.commodity!==state.commodity) return false;
    if(Array.isArray(state.years)){if(!state.years.includes(e.year))return false;}
    else if(state.year!=='all'&&e.year!==Number(state.year))return false;
    // National/global context remains available under a regional scope.
    if(state.region!=='all'&&![state.region,'全国','全球'].includes(i.region))return false;
    if(state.status!=='all'&&e.status!==state.status)return false;
    if(state.module!=='all'&&f.module!==state.module)return false;
    if(!ignoreImportance&&state.importance!=='all'&&i.importance!==state.importance)return false;
    if(state.search && ![e.title,e.fact,i.topic,i.impact,i.region,f.name,f.description].join(' ').toLowerCase().includes(state.search.toLowerCase()))return false;
    return true;
  }).map(i=>({...i,event:events.get(i.event_id),factor:factors.get(i.factor_id)}));
}
export function saveEvent(data,event,impacts) {
  const next=structuredClone(data),index=next.events.findIndex(e=>e.id===event.id);
  if(index<0)next.events.push(event);else next.events[index]=event;
  next.impacts=next.impacts.filter(i=>i.event_id!==event.id).concat(impacts);
  return validateData(next);
}
export function groupEvents(impacts) {
  const groups=new Map();
  for(const i of impacts){if(!groups.has(i.event_id))groups.set(i.event_id,{event:i.event,impacts:[]});groups.get(i.event_id).impacts.push(i);}
  return [...groups.values()].sort((a,b)=>b.event.year-a.event.year||b.event.quarter-a.event.quarter||a.event.id.localeCompare(b.event.id));
}
