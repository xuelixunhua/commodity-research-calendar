import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateData,selectImpacts,saveEvent,groupEvents} from '../assets/model.js';
const original=JSON.parse(readFileSync(new URL('../data/catalog.json',import.meta.url),'utf8'));
const state={commodity:'电力',year:'all',region:'all',status:'all',module:'all',importance:'all',search:''};
test('published database has valid references and consistent time precision',()=>validateData(original));
test('unknown quarter stays unknown and plans never become actual observations',()=>{
 const plans=selectImpacts(original,{...state,status:'计划'});
 assert(plans.length>0);assert(plans.every(i=>i.event.quarter===0));
 assert(!selectImpacts(original,{...state,status:'已发生'}).some(i=>i.event.id==='E010'));
});
test('priority and module belong to the impact, not the shared event',()=>{
 const all=selectImpacts(original,state),key=selectImpacts(original,{...state,importance:'重点'}),normal=selectImpacts(original,{...state,importance:'一般'});
 assert.equal(key.length+normal.length,all.length);
 assert(selectImpacts(original,{...state,module:'数据'}).every(i=>i.factor.module==='数据'));
 assert(selectImpacts(original,{...state,module:'供给'}).some(i=>i.event.id==='E012'));
 assert(selectImpacts(original,{...state,module:'数据'}).some(i=>i.event.id==='E012'));
});
test('shared macro edit propagates to every commodity without changing other impacts',()=>{
 const e={...original.events.find(e=>e.id==='E005'),title:'共同事实更新'};
 const linked=original.impacts.filter(i=>i.event_id===e.id);
 const next=saveEvent(original,e,linked);
 for(const commodity of original.commodities)assert(selectImpacts(next,{...state,commodity}).some(i=>i.event.title==='共同事实更新'));
 assert.notEqual(original.events.find(x=>x.id===e.id).title,e.title);
 assert.deepEqual(next.impacts.filter(i=>i.event_id!==e.id),original.impacts.filter(i=>i.event_id!==e.id));
});
test('regional scope retains national/global context and excludes other provinces',()=>{
 const result=selectImpacts(original,{...state,region:'山东'});
 assert(result.some(i=>i.id==='I015'));assert(result.some(i=>i.event.id==='E005'));
 assert(!result.some(i=>i.region==='辽宁'||i.region==='甘肃'));
});
test('list deduplicates one fact that affects both supply and demand',()=>{
 const impacts=selectImpacts(original,{...state,year:2022});
 assert.equal(impacts.length,2);assert.equal(groupEvents(impacts).length,1);
});
test('imports reject dangling links, mismatched commodity, unsafe URLs and inconsistent dates',()=>{
 for(const mutate of [d=>d.impacts[0].event_id='unknown',d=>d.impacts[0].commodity='原油',d=>d.events[0].url='javascript:alert(1)',d=>d.events[0].date='2022-01-01',d=>d.events[0].published='2021-02-30',d=>d.events.push({...d.events[0]})]){
  const d=structuredClone(original);mutate(d);assert.throws(()=>validateData(d));
 }
});
