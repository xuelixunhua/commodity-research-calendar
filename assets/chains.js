import {esc,relationMarkup} from './calendar.js?v=20261024d';
const colors={'实物流':'#52678d','成本':'#8d6b43','需求':'#8674a8','反馈':'#a45f66'};
export function chainMarkup(data,commodity,mode='flow',selected=null){
 const chain=data.chains?.[commodity];
 if(!chain)return relationMarkup(data,commodity,selected);
 const tabs=`<div class="chain-tabs segmented">${[['flow','供需流向'],['feedback','成本与反馈'],['links','跨品种联系']].filter(([id])=>id!=='links'||commodity!=='LPG').map(([id,label])=>`<button data-chain-mode="${id}" class="${id===mode?'active':''}">${label}</button>`).join('')}</div>`;
 if(mode==='links'&&commodity!=='LPG')return tabs+relationMarkup(data,commodity,selected);
 const g=chain[mode]||chain.flow,active=g.nodes.find(n=>n.id===selected)||g.nodes.find(n=>n.id===g.focus)||g.nodes[0];
 const hasReturn=g.edges.some(e=>g.nodes.find(n=>n.id===e.to_id).x<g.nodes.find(n=>n.id===e.from_id).x);
 const height=Math.max(...g.nodes.map(n=>n.y))+(hasReturn?98:65);
 const edges=g.edges.map(e=>{
   const a=g.nodes.find(n=>n.id===e.from_id),b=g.nodes.find(n=>n.id===e.to_id);
   let path,lx,ly;
   if(b.x<a.x){path=`M ${a.x+76} ${a.y} H 955 V ${height-20} H 12 V ${b.y} H ${b.x-76}`;lx=485;ly=height-29;}
   else if(a.x===b.x){const down=b.y>a.y;const sy=a.y+(down?31:-31),ty=b.y+(down?-31:31);path=`M ${a.x} ${sy} L ${b.x} ${ty}`;lx=a.x+34;ly=(sy+ty)/2;}
   else{const sx=a.x+76,tx=b.x-76;const mid=(sx+tx)/2;path=`M ${sx} ${a.y} C ${mid} ${a.y} ${mid} ${b.y} ${tx} ${b.y}`;lx=mid;ly=(a.y+b.y)/2-10;}
   const color=colors[e.kind];
   return `<g class="chain-edge"><path d="${path}" stroke="${color}" ${b.x<a.x?'stroke-dasharray="5 4"':''} marker-end="url(#chain-${e.kind})"/><text x="${lx}" y="${ly}" fill="${color}">${esc(e.label)}</text></g>`;
 }).join('');
 const nodes=g.nodes.map(n=>`<g class="graph-node clickable ${n.id===active.id?'central':''}" data-chain-node="${n.id}" role="button" tabindex="0" aria-label="${esc(n.label)}"><rect x="${n.x-76}" y="${n.y-31}" width="152" height="62" rx="7"/><text class="node-name" x="${n.x}" y="${n.y-3}">${esc(n.label)}</text><text class="node-role" x="${n.x}" y="${n.y+17}">${esc(n.role)}</text></g>`).join('');
 return tabs+`<div class="graph-panel chain-panel"><div class="graph-legend">${Object.entries(colors).filter(([kind])=>g.edges.some(e=>e.kind===kind)).map(([kind,color])=>`<span><i style="background:${color}"></i>${kind}</span>`).join('')}<small>点击节点查看机制</small></div><div class="graph-scroll"><svg viewBox="0 0 970 ${height}" aria-label="${esc(commodity)}${mode==='feedback'?'成本与反馈':'供需产业链'}"><defs>${Object.entries(colors).map(([kind,color])=>`<marker id="chain-${kind}" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7Z" fill="${color}"/></marker>`).join('')}</defs>${g.columns.map((c,i)=>`<text class="chain-column" x="${110+i*250}" y="27">${esc(c)}</text>`).join('')}${edges}${nodes}</svg></div><div class="horizontal-pan" hidden><span>左</span><input type="range" min="0" max="100" value="0" aria-label="横向浏览产业链"><span>右</span></div><div class="relation-insight"><strong>${esc(active.label)} <span>${esc(active.role)}</span></strong><p>${esc(active.mechanism)}</p><div class="chain-details"><span><b>跟踪</b>${esc(active.metrics)}</span><span><b>窗口</b>${esc(active.window)}</span></div><p class="chain-boundary">${esc(active.boundary)}</p>${active.commodity&&active.commodity!==commodity?`<button class="text-button" data-commodity="${esc(active.commodity)}">查看${esc(active.commodity)} ↗</button>`:''}<details class="chain-source"><summary>参考</summary>${esc(g.source)}</details></div></div>`;
}
