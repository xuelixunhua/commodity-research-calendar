import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chainMarkup} from '../assets/chains.js';
import {calendarMarkup} from '../assets/calendar.js';
import {selectImpacts,saveEvent,validateData} from '../assets/model.js';
const data=JSON.parse(readFileSync(new URL('../data/catalog.json',import.meta.url),'utf8'));
const base={commodity:'原油',years:[2023],region:'all',status:'all',module:'all',importance:'all',search:'',empty:false};
test('annual observations span a full year without becoming undated quarters',()=>{
 const items=selectImpacts(data,base),html=calendarMarkup(data,base,items,items);
 assert(html.includes('data-period="year"'));
 const annual=items.find(i=>i.event.quarter===0);assert(annual);
 assert(html.includes(`data-event="${annual.event.id}"`));
 assert(!html.includes('Q0'));
});
test('imported macro references share one fact and survive editing and export',()=>{
 const e=data.events.find(e=>e.id==='L-macro-G4'),linked=data.impacts.filter(i=>i.event_id===e.id);
 assert(new Set(linked.map(i=>i.commodity)).size>1);
 const updated=saveEvent(data,{...e,fact:'共享宏观修订'},linked);
 const exported=JSON.parse(JSON.stringify(updated));
 for(const i of linked)assert(selectImpacts(exported,{...base,commodity:i.commodity,years:[e.year]}).some(x=>x.event.fact==='共享宏观修订'));
});
test('each research chain has independent flow and profit feedback with valid node details',()=>{
 for(const commodity of ['甲醇','原油','动力煤','LPG'])for(const mode of ['flow','feedback']){
  const g=data.chains[commodity][mode];assert(g.nodes.length>=7);assert(g.edges.length>=6);
  const html=chainMarkup(data,commodity,mode);
  assert(html.includes('marker-end='));assert(html.includes('跟踪'));assert(html.includes('窗口'));
  for(const n of g.nodes)assert(n.mechanism&&n.boundary&&n.metrics);
 }
 const meth=JSON.stringify(data.chains['甲醇']);for(const word of ['外采','伊朗','非伊','内地','港口','库销比','PP−3MA'])assert(meth.includes(word));
});
test('2026 coal benchmark, climate observations and installed capacity preserve evidence boundaries',()=>{
 const coal=data.events.find(e=>e.id==='D2026-coal-q3');assert.match(coal.fact,/882.32/);assert.match(coal.fact,/低于 2021、2022/);
 const climate=data.events.filter(e=>e.id.startsWith('D2026-enso'));assert.equal(climate.length,2);assert(climate.every(e=>e.url.includes('cpc.ncep.noaa.gov')&&e.status==='已发生'));
 const cap=data.events.find(e=>e.id==='D2026-capacity-4000');assert.equal(cap.quarter,2);assert(cap.fact.includes('不等同于可用出力'));
});
test('import validation rejects malformed graph identifiers and arrow types',()=>{
 for(const alter of [g=>g.nodes[0].id='bad"id',g=>g.edges[0].kind='bad"type']){
  const d=structuredClone(data);alter(d.chains['甲醇'].flow);assert.throws(()=>validateData(d));
 }
});
