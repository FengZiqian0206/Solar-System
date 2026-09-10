import * as THREE from 'three';

const PLANETS = [
  ['水星','Mercury',.3871,87.969,.2056,47.36,2439.7,.15,7.005,1.50,.58,.37],
  ['金星','Venus',.7233,224.701,.0068,35.02,6051.8,1.35,3.395,1.80,.74,.46],
  ['地球','Earth',1,365.256,.0167,29.78,6371,2.55,0,2.40,.72,.44],
  ['火星','Mars',1.5237,686.980,.0934,24.07,3389.5,3.65,1.85,1.65,.88,.54],
  ['木星','Jupiter',5.2028,4332.59,.0489,13.07,69911,4.65,1.303,2.75,.93,.57],
  ['土星','Saturn',9.5388,10759.22,.0565,9.69,58232,5.55,2.489,2.45,.78,.49],
  ['天王星','Uranus',19.1914,30688.5,.0472,6.81,25362,.85,.773,2.45,.65,.38],
  ['海王星','Neptune',30.0611,60182,.0086,5.43,24622,2.05,1.77,2.35,.60,.34]
];
const SPEEDS=[5,30,100,365.256,1000,5000];
const $=s=>document.querySelector(s);
const viewport=$('#viewport'), canvas=$('#canvas'), labels=$('#labels'), leaders=$('#leaders');
let renderer,scene,camera,cloud,geometry,material,gridSize=50,simDays=0,daysPerSecond=5,paused=false,last=performance.now(),yaw=.66,pitch=-.42,zoom=1,drag=null;
const bodies=[];

function solveE(m,e){m%=Math.PI*2;let a=m;for(let i=0;i<7;i++)a-=(a-e*Math.sin(a)-m)/(1-e*Math.cos(a));return a}
function bodyData(){
  const half=(gridSize-1)/2, sf=Math.sqrt(half/19), maxAu=30.0611;
  const out=[{name:'太阳 · SUN',pos:new THREE.Vector3(),radius:Math.max(4,half*.20),core:1,edge:.51}];
  for(const p of PLANETS){const r=half*(.29+Math.log10(p[2]+1)/Math.log10(maxAu+1)*.55),a=solveE(p[7]+simDays/p[3]*Math.PI*2,p[4]),x=r*(Math.cos(a)-p[4]),pz=r*Math.sqrt(1-p[4]*p[4])*Math.sin(a),inc=p[8]*Math.PI/180;out.push({name:`${p[0]} · ${p[1].toUpperCase()}`,pos:new THREE.Vector3(x,pz*Math.sin(inc),pz*Math.cos(inc)),radius:p[9]*sf,core:p[10],edge:p[11]})}return out;
}

const vertexShader=`
attribute float aSeed; uniform float uTime,uHalf,uPixelRatio; uniform vec2 uViewport; uniform vec4 uBodies[9]; uniform vec2 uLevels[9]; uniform vec3 uSaturn; varying float vRatio;
float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
void main(){
 float ratio=.16+hash(position)*.12; float belt=length(position.xz); float beltHash=hash(position*vec3(1.7,2.3,3.1));
 if(belt>=uHalf*.49&&belt<=uHalf*.54&&abs(position.y)<=max(1.,uHalf*.10)&&beltHash<.48) ratio=max(ratio,.46+beltHash*.17);
 for(int i=0;i<9;i++){vec3 d=position-uBodies[i].xyz;float dist=length(d);if(dist<uBodies[i].w){float inward=1.-dist/uBodies[i].w;ratio=max(ratio,uLevels[i].y+(uLevels[i].x-uLevels[i].y)*pow(inward,.72));}}
 vec3 sd=position-uSaturn;float ringY=sd.y*.894-sd.z*.448,ringZ=sd.y*.448+sd.z*.894,rr=length(vec2(sd.x,ringZ));float sr=uBodies[6].w,ri=sr*1.30,ro=sr*1.95,rt=max(.75,sr*.19);if(rr>ri&&rr<ro&&abs(ringY)<rt){float f=sin(3.14159*(rr-ri)/(ro-ri))*(1.-abs(ringY)/rt);ratio=max(ratio,.35+f*.17);}
 float sizeFactor=1.;if(ratio<=.281)sizeFactor+=.22*sin(uTime*(.65+aSeed*.55)+aSeed*6.28318);
 float cycle=floor(uTime/7.),age=mod(uTime,7.)-(1.+hash(vec3(cycle,7.,11.))*2.),meteorOn=step(0.,age)*step(age,2.4),mx=uHalf*(-.8+age/2.4*1.6),my=uHalf*(.38+hash(vec3(cycle,17.,3.))*.35)-age*uHalf*.15,mz=uHalf*(-.65+hash(vec3(cycle,23.,5.))*1.3),behind=mx-position.x;
 if(ratio<=.281&&meteorOn>0.&&behind>=0.&&behind<uHalf*.4){float dy=position.y-(my+behind*.225),dz=position.z-mz,d2=dy*dy+dz*dz;if(d2<2.6){float intensity=sin(3.14159*age/2.4)*pow(1.-behind/(uHalf*.4),1.3)*(1.-d2/2.6);ratio+=intensity*.18;sizeFactor+=intensity*.5;}}
 vRatio=clamp(ratio,0.,1.);vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;float radius=.72+pow(vRatio,2.15)*8.8;gl_PointSize=clamp(radius*2.*sizeFactor*uPixelRatio*(340./-mv.z),1.,34.);
}`;
const fragmentShader=`
precision highp float;varying float vRatio;
vec3 palette(float t){vec3 c[11];c[0]=vec3(.192,.212,.584);c[1]=vec3(.271,.459,.706);c[2]=vec3(.455,.678,.82);c[3]=vec3(.671,.851,.914);c[4]=vec3(.878,.953,.973);c[5]=vec3(1.,1.,.749);c[6]=vec3(.996,.878,.565);c[7]=vec3(.992,.682,.38);c[8]=vec3(.957,.427,.263);c[9]=vec3(.843,.188,.153);c[10]=vec3(.647,0.,.149);int i=min(10,int(floor(t*11.)));return c[i];}
void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;float edge=1.-smoothstep(.43,.5,d);float alpha=(.071+pow(vRatio,2.35)*.929)*edge;gl_FragColor=vec4(palette(vRatio),alpha);}`;

function rebuild(){
  if(cloud){scene.remove(cloud);geometry.dispose();material.dispose()}
  const n=gridSize,count=n*n*n,half=(n-1)/2,pos=new Float32Array(count*3),seed=new Float32Array(count);let q=0;
  for(let x=0;x<n;x++)for(let y=0;y<n;y++)for(let z=0;z<n;z++){pos[q*3]=x-half;pos[q*3+1]=y-half;pos[q*3+2]=z-half;seed[q]=((x*73856093^y*19349663^z*83492791)>>>0)%10000/10000;q++}
  geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(pos,3));geometry.setAttribute('aSeed',new THREE.BufferAttribute(seed,1));
  material=new THREE.ShaderMaterial({vertexShader,fragmentShader,transparent:true,depthWrite:false,blending:THREE.NormalBlending,uniforms:{uTime:{value:0},uHalf:{value:half},uPixelRatio:{value:Math.min(devicePixelRatio,2)},uViewport:{value:new THREE.Vector2()},uBodies:{value:Array.from({length:9},()=>new THREE.Vector4())},uLevels:{value:Array.from({length:9},()=>new THREE.Vector2())},uSaturn:{value:new THREE.Vector3()}}});
  cloud=new THREE.Points(geometry,material);scene.add(cloud);updateBodies();$('#pointCount').textContent=count.toLocaleString();
}
function updateBodies(){const next=bodyData();bodies.length=0;bodies.push(...next);next.forEach((b,i)=>{material.uniforms.uBodies.value[i].set(b.pos.x,b.pos.y,b.pos.z,b.radius);material.uniforms.uLevels.value[i].set(b.core,b.edge)});material.uniforms.uSaturn.value.copy(next[6].pos)}
function init(){
  try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});renderer.setClearColor(0x000000);renderer.setPixelRatio(Math.min(devicePixelRatio,2));scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(48,1,.1,500);camera.position.z=78;rebuild();resize();requestAnimationFrame(frame)}catch(e){$('#webglError').hidden=false;$('#webglError').style.display='grid';console.error(e)}
}
function resize(){if(!renderer)return;const r=viewport.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();material?.uniforms.uViewport.value.set(r.width,r.height)}
function frame(now){const dt=Math.min((now-last)/1000,.1);last=now;if(!paused){simDays+=dt*daysPerSecond;updateBodies()}material.uniforms.uTime.value=now/1000;cloud.rotation.set(pitch,yaw,0);camera.position.z=78/zoom;renderer.render(scene,camera);updateLabels();$('#sceneInfo').textContent=`CUBIC LATTICE  ${gridSize}³   ·   ${(gridSize**3).toLocaleString()} POINTS   ·   ${(simDays/365.256).toFixed(2)} EARTH YEARS`;requestAnimationFrame(frame)}
function updateLabels(){
  labels.replaceChildren();leaders.replaceChildren();const rect=viewport.getBoundingClientRect(),w=rect.width,h=rect.height;
  bodies.forEach((b,i)=>{const v=b.pos.clone().applyEuler(cloud.rotation).project(camera);const x=(v.x*.5+.5)*w,y=(-v.y*.5+.5)*h,dir=x>=w/2?1:-1,vertical=i%2===0?-1:1,lineY=Math.max(12,Math.min(h-28,y+vertical*36)),elbow=x+dir*42,end=elbow+dir*115;const poly=document.createElementNS('http://www.w3.org/2000/svg','polyline');poly.setAttribute('points',`${x},${y} ${elbow},${lineY} ${end},${lineY}`);leaders.append(poly);const label=document.createElement('span');label.className='body-label';label.textContent=b.name;label.style.top=`${lineY}px`;label.style.left=dir>0?`${end+6}px`:`${end-6}px`;if(dir<0)label.style.transform='translate(-100%,-50%)';labels.append(label)})
}
function setView(y,p,z=1){yaw=y;pitch=p;zoom=z}
viewport.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY};viewport.setPointerCapture(e.pointerId)});viewport.addEventListener('pointermove',e=>{if(!drag)return;yaw-=(e.clientX-drag.x)*.002;pitch=Math.max(-Math.PI/2,Math.min(Math.PI/2,pitch-(e.clientY-drag.y)*.002));drag={x:e.clientX,y:e.clientY}});viewport.addEventListener('pointerup',()=>drag=null);viewport.addEventListener('pointercancel',()=>drag=null);viewport.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.52,Math.min(2.4,zoom*(e.deltaY<0?1.1:.9)))},{passive:false});
$('#density').addEventListener('input',e=>{$('#densityValue').textContent=`${e.target.value} × ${e.target.value} × ${e.target.value}`});$('#density').addEventListener('change',e=>{gridSize=+e.target.value;rebuild()});$('#speed').addEventListener('input',e=>{daysPerSecond=SPEEDS[+e.target.value];$('#speedValue').textContent=`${daysPerSecond} 天/秒 · DAYS/S`});$('#pause').onclick=()=>{paused=!paused;$('#pause').innerHTML=paused?'▶&nbsp;&nbsp;继续公转 · RESUME ORBITS':'Ⅱ&nbsp;&nbsp;暂停公转 · PAUSE ORBITS';$('#status').textContent=paused?'● 已暂停 · PAUSED':'● 运行中 · RUNNING'};$('#resetView').onclick=()=>setView(.66,-.42);$('#frontView').onclick=()=>setView(0,0);$('#topView').onclick=()=>setView(0,-Math.PI/2);$('#resetPlanets').onclick=()=>{simDays=0;updateBodies()};
$('#fullscreen').onclick=async()=>{if(!document.fullscreenElement)await $('#hologram').requestFullscreen();else await document.exitFullscreen()};document.addEventListener('fullscreenchange',()=>$('#fullscreen').classList.toggle('exit',!!document.fullscreenElement));
function rows(filter=''){const f=filter.trim().toLowerCase();$('#planetRows').innerHTML=PLANETS.filter(p=>!f||p[0].includes(f)||p[1].toLowerCase().includes(f)).map(p=>`<tr><td>${p[0]}&nbsp;&nbsp;${p[1]}</td><td>${p[2].toFixed(4)}</td><td>${p[3].toLocaleString(undefined,{maximumFractionDigits:3})}</td><td>${(p[3]/365.256).toFixed(3)}</td><td>${p[5].toFixed(2)}</td><td>${p[6].toLocaleString()}</td></tr>`).join('')}rows();$('#search').addEventListener('input',e=>rows(e.target.value));new ResizeObserver(resize).observe(viewport);
setTimeout(()=>$('#splash').classList.add('fade'),1000);setTimeout(()=>$('#splash').remove(),1950);init();
