import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectImpacts} from '../assets/model.js';
import {calendarMarkup,yearRange,relationMarkup} from '../assets/calendar.js';
const data=JSON.parse(readFileSync(new URL('../data/catalog.json',import.meta.url),'utf8'));
const state={commodity:'电力',years:[2021,2027],region:'all',status:'all',module:'all',importance:'all',search:'',empty:true};
test('year boundaries retain their own quarters in a multi-year matrix',()=>{
 const impacts=selectImpacts(data,state),html=calendarMarkup(data,state,impacts,impacts);
 assert(html.includes('colspan="4" class="year-heading" data-year-heading="2021"'));
 assert(html.includes('colspan="4" class="year-heading" data-year-heading="2027"'));
 const nuclearRow=html.match(/<tr[^>]*>(?:(?!<tr).)*data-factor="power-nuclear".*?<\/tr>/s)[0];
 assert.match(nuclearRow, /data-year="2027" data-quarter="1"[^>]*>[^]*?data-event="E010"/);
 assert(!nuclearRow.slice(0,nuclearRow.indexOf('data-year="2027"')).includes('data-event="E010"'));
});
test('crossed slider handles still select an ascending interval',()=>{
 assert.deepEqual(yearRange([2020,2021,2022,2023],3,1),[2021,2022,2023]);
});
test('power graph distinguishes industrial load from fuel cost and retains reverse effects',()=>{
 const html=relationMarkup(data,'电力');
 for(const label of ['工业用电负荷','燃料投入','燃料成本','用电成本','工业负荷','电煤需求'])assert(html.includes(label));
 for(const id of ['R01','R02','R07','R08'])assert(html.includes(`data-relation="${id}"`));
 assert(html.includes('marker-end="url(#arrow-demand)"'));
 assert(html.includes('marker-end="url(#arrow-cost)"'));
});
