// Read the same data as the table; SVG keeps this panel independent of WebGL.
const COLORS=['#fee090','#fdae61','#abd9e9','#f46d43','#d73027','#fee090','#74add1','#4575b4'];
const METRICS=[
  ['轨道半长轴','SEMI-MAJOR AXIS','AU',p=>p[2],4,true],
  ['公转周期','ORBITAL PERIOD','天 · DAYS',p=>p[3],3,true],
  ['公转周期','ORBITAL PERIOD','地球年 · EARTH YEARS',p=>p[3]/365.256,3,true],
  ['平均轨道速度','MEAN ORBITAL SPEED','km/s',p=>p[5],2,false],
  ['平均半径','MEAN RADIUS','km',p=>p[6],1,true]
];
const format=(v,d)=>v.toLocaleString('en-US',{maximumFractionDigits:d});

export function buildPlanetCharts(planets,filter='',focus=-1){
  const query=filter.trim().toLowerCase();
  const selected=planets.map((p,i)=>({p,i})).filter(({p})=>p[0].includes(query)||p[1].toLowerCase().includes(query));
  if(!selected.length)return '<p class="chart-empty">没有匹配的行星 · NO MATCHING PLANETS</p>';
  if(!selected.some(({i})=>i===focus))focus=-1;
  // Independent full-system axes retain their physical units and fixed scales.
  const axes=METRICS.map(([cn,en,unit,value,digits,log],m)=>{
    const values=planets.map(value),min=log?Math.min(...values):0,max=Math.max(...values),x=75+m*237.5;
    const y=v=>190-125*(log?Math.log(v/min)/Math.log(max/min):v/max);
    const ticks=[min,log?Math.sqrt(min*max):max/2,max];
    return {x,y,markup:`<g class="spectrum-axis"><text x="${x}" y="12" text-anchor="middle">${cn}</text><text class="axis-en" x="${x}" y="27" text-anchor="middle">${en}</text><text class="axis-unit" x="${x}" y="43" text-anchor="middle">${unit} / ${log?'对数 · LOG':'线性 · LINEAR'}</text><line x1="${x}" x2="${x}" y1="65" y2="190"/>${ticks.map(v=>`<path d="M${x-4} ${y(v)}h8"/><text class="axis-tick" x="${x+10}" y="${y(v)+3}">${format(v,2)}</text>`).join('')}</g>`};
  });
  const paths=selected.slice().sort((a,b)=>(a.i===focus)-(b.i===focus)).map(({p,i})=>{
    const points=axes.map((a,m)=>`${a.x},${a.y(METRICS[m][3](p))}`).join(' ');
    const description=METRICS.map(([cn,,unit,value,digits])=>`${cn}: ${format(value(p),digits)} ${unit}`).join(' / ');
    return `<g class="chart-planet${focus===i?' is-selected':focus>=0?' is-muted':''}" data-planet="${i}" style="--planet-color:${COLORS[i]}"><title>${p[0]} · ${p[1]} / ${description}</title><polyline class="spectrum-hit" points="${points}"/><polyline class="spectrum-line" points="${points}"/>${axes.map((a,m)=>`<circle cx="${a.x}" cy="${a.y(METRICS[m][3](p))}" r="3"/>`).join('')}</g>`;
  }).join('');
  const legend=selected.map(({p,i})=>`<button class="spectrum-key" data-planet="${i}" aria-pressed="${i===focus}" style="--planet-color:${COLORS[i]}"><i aria-hidden="true"></i>${p[0]} · ${p[1]}</button>`).join('');
  const p=planets[focus];
  const readout=p?`<strong>${p[0]} · ${p[1]}</strong>`+METRICS.map(([cn,,unit,value,digits])=>`<span>${cn} <b>${format(value(p),digits)}</b> ${unit}</span>`).join(''):'点击行星名称查看全部数值 · SELECT A PLANET FOR EXACT VALUES';
  return `<div class="chart-intro">行星参数谱线 · PLANETARY SPECTRUM <span>各轴独立刻度 · INDEPENDENT AXIS SCALES</span></div><div class="spectrum-legend" aria-label="突出行星 · HIGHLIGHT PLANET">${legend}</div><div class="spectrum-scroll"><svg class="spectrum" viewBox="0 0 1100 215" role="img" aria-label="八大行星五项指标的平行坐标图 · Five-metric planetary parallel coordinates"><desc>每条彩色线代表一颗行星。各轴单位和刻度独立，线的斜率不代表物理变化。Each colored line represents one planet; axes use independent units and scales.</desc>${[65,127.5,190].map(y=>`<line class="spectrum-guide" x1="75" x2="1025" y1="${y}" y2="${y}"/>`).join('')}${axes.map(a=>a.markup).join('')}${paths}</svg></div><div class="spectrum-readout" aria-live="polite">${readout}</div>`;
}

export function initPlanetCharts(planets){
  const toggle=document.getElementById('chartToggle'),charts=document.getElementById('planetCharts');
  const table=document.querySelector('.table-wrap'),search=document.getElementById('search');
  let focus=-1;
  function draw(){charts.innerHTML=buildPlanetCharts(planets,search.value,focus)}
  charts.addEventListener('click',event=>{
    const item=event.target.closest('[data-planet]');
    if(!item)return;
    const index=+item.dataset.planet;
    focus=focus===index?-1:index;
    draw();
    charts.querySelector(`button[data-planet="${index}"]`)?.focus({preventScroll:true});
  });
  toggle.addEventListener('click',()=>{
    const active=toggle.getAttribute('aria-pressed')!=='true';
    toggle.setAttribute('aria-pressed',String(active));
    toggle.querySelector('span').textContent=active?'数据表格 · TABLE':'数据图表 · CHARTS';
    table.hidden=active;charts.hidden=!active;
    document.querySelector('.app').classList.toggle('charts-open',active);
    if(active)draw();
  });
  search.addEventListener('input',()=>{if(!charts.hidden)draw()});
}
