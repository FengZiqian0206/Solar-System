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

export function buildPlanetCharts(planets,filter=''){
  const query=filter.trim().toLowerCase();
  const selected=planets.map((p,i)=>({p,i})).filter(({p})=>p[0].includes(query)||p[1].toLowerCase().includes(query));
  if(!selected.length)return '<p class="chart-empty">没有匹配的行星 · NO MATCHING PLANETS</p>';
  return `<div class="chart-intro">行星参数图谱 · PLANETARY ATLAS <span>彩色点对应行星 · COLORED POINTS REPRESENT PLANETS</span></div><div class="chart-grid">`+METRICS.map(([cn,en,unit,value,digits,log],metric)=>{
    // Fixed full-system scales make filtered views directly comparable.
    const values=planets.map(value),min=log?Math.min(...values):0,max=Math.max(...values);
    const position=v=>125+225*(log?Math.log(v/min)/Math.log(max/min):v/max);
    const ticks=[min,log?Math.sqrt(min*max):max/2,max];
    const guides=ticks.map(v=>`<line class="chart-guide" x1="${position(v)}" x2="${position(v)}" y1="18" y2="${selected.length*27+18}"/><text class="chart-tick" x="${position(v)}" y="12" text-anchor="middle">${format(v,2)}</text>`).join('');
    const dots=selected.map(({p,i},row)=>{
      const v=value(p),x=position(v),y=36+row*27;
      return `<g class="chart-planet"><title>${p[0]} · ${p[1]}: ${format(v,digits)} ${unit}</title><text class="chart-name" x="2" y="${y+4}">${p[0]} <tspan>${p[1]}</tspan></text><line class="chart-track" x1="125" x2="350" y1="${y}" y2="${y}"/><line x1="125" x2="${x}" y1="${y}" y2="${y}" stroke="${COLORS[i]}" stroke-opacity=".4"/><circle cx="${x}" cy="${y}" r="7" fill="none" stroke="${COLORS[i]}" stroke-opacity=".26"/><circle cx="${x}" cy="${y}" r="3" fill="${COLORS[i]}"/><text class="chart-value" x="490" y="${y+4}" text-anchor="end">${format(v,digits)}</text></g>`;
    }).join('');
    return `<section class="metric-chart"><header><h3><small>0${metric+1}</small> ${cn} · ${en}</h3><p>${unit} / ${log?'对数刻度 · LOG SCALE':'线性刻度 · LINEAR SCALE'}</p></header><svg viewBox="0 0 500 ${selected.length*27+28}" role="img" aria-label="${cn} · ${en}，${unit}，${log?'对数刻度':'线性刻度'}">${guides}${dots}</svg></section>`;
  }).join('')+'</div>';
}

export function initPlanetCharts(planets){
  const toggle=document.getElementById('chartToggle'),charts=document.getElementById('planetCharts');
  const table=document.querySelector('.table-wrap'),search=document.getElementById('search');
  function draw(){charts.innerHTML=buildPlanetCharts(planets,search.value)}
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
