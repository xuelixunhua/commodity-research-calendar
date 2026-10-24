import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateData,saveEvent,selectImpacts} from '../assets/model.js';
const data=JSON.parse(readFileSync(new URL('../data/catalog.json',import.meta.url),'utf8'));
const ids=['W202603-wind','W202606-wind','W202511-wind','W202501-solar','W202510-solar','C202505-solar','C202512-wind','C202512-solar','C202505-neimenggu-renewable','G202509-hydro-thermal'];
test('power and coal share the same physical evidence and indicator vocabulary',()=>{
 for(const id of ids){
  assert.equal(data.events.filter(e=>e.id===id).length,1);
  const links=data.impacts.filter(i=>i.event_id===id);
  assert.deepEqual(new Set(links.map(i=>i.commodity)),new Set(['电力','动力煤']));
  assert.equal(new Set(links.map(i=>i.metric)).size,1);
  const event={...data.events.find(e=>e.id===id),fact:'共同证据修正'};
  const next=saveEvent(data,event,links);
  for(const commodity of ['电力','动力煤'])assert(selectImpacts(next,{commodity,year:'all',region:'all',status:'all',module:'all',importance:'all',search:''}).some(i=>i.event.id===id&&i.event.fact==='共同证据修正'));
 }
});
test('superseded price and capture examples are absent; historical research remains',()=>{
 assert(!data.events.some(e=>['P2026-intraday-jan','P2026-capture-jun','P2026-coal-price-divergence'].includes(e.id)));
 assert.equal(data.events.filter(e=>e.source==='历史研究记录').length,1518);
});
test('additional evidence links reject unsafe protocols',()=>{
 const next=structuredClone(data);next.events[0].sources=[{title:'source',url:'javascript:alert(1)'}];
 assert.throws(()=>validateData(next),/补充来源/);
 validateData(data);
});
