import { THREE, context } from './renderer-support.js?v=visual-balance-1';

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
const SPEEDS=[10,30,100,365.256,1000];
const VISUAL_HALF=26, BODY_HALF=24.5, ORBIT_SCALE=1.10;
const $=s=>document.querySelector(s);
const viewport=$('#viewport'), canvas=$('#canvas'), labels=$('#labels'), leaders=$('#leaders');
let renderer,scene,camera,cloud,geometry,material,gridSize=50,simDays=0,daysPerSecond=10,paused=false,last=performance.now(),yaw=Math.PI/4,pitch=Math.PI/4,zoom=1,drag=null,followPlanet=-1;
const bodies=[];
const focusOffset=new THREE.Vector3();
let detailCloud,detailGeometry;
const BODY_STEP_50=2*VISUAL_HALF/49, BODY_STEP_100=BODY_STEP_50/2, BODY_STEP_150=BODY_STEP_50/3, DETAIL_CAPACITY=16000;

// Pack dense-mode bodies into adjacent fine-grid cells; every position stays on the global lattice.
function updateBodyDetails(){
  if(!detailGeometry)return;
  const positions=detailGeometry.attributes.position.array,seeds=detailGeometry.attributes.aSeed.array;
  const bodyStep=gridSize===150?BODY_STEP_150:BODY_STEP_100;
  let count=0;
  for(const b of bodies){
    const lo=['x','y','z'].map(axis=>Math.ceil((b.pos[axis]-b.radius+VISUAL_HALF)/bodyStep));
    const hi=['x','y','z'].map(axis=>Math.floor((b.pos[axis]+b.radius+VISUAL_HALF)/bodyStep));
    for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++)for(let z=lo[2];z<=hi[2];z++){
      const px=x*bodyStep-VISUAL_HALF,py=y*bodyStep-VISUAL_HALF,pz=z*bodyStep-VISUAL_HALF;
      if((px-b.pos.x)**2+(py-b.pos.y)**2+(pz-b.pos.z)**2>=b.radius*b.radius)continue;
      if(count>=DETAIL_CAPACITY)throw new Error('Body detail capacity exceeded');
      positions[count*3]=px;positions[count*3+1]=py;positions[count*3+2]=pz;
      seeds[count]=((x*73856093^y*19349663^z*83492791)>>>0)%10000/10000;count++;
    }
  }
  // Compact Saturn's ring onto adjacent dense-grid cells together with the planet.
  const saturn=bodies[6],sr=saturn.radius,ro=sr*2.08,rt=sr*.324;
  const ringStep=gridSize===150?BODY_STEP_150:BODY_STEP_100;
  const lo=['x','y','z'].map(axis=>Math.ceil((saturn.pos[axis]-(axis==='x'?ro:ro+rt)+VISUAL_HALF)/ringStep));
  const hi=['x','y','z'].map(axis=>Math.floor((saturn.pos[axis]+(axis==='x'?ro:ro+rt)+VISUAL_HALF)/ringStep));
  for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++)for(let z=lo[2];z<=hi[2];z++){
    const px=x*ringStep-VISUAL_HALF,py=y*ringStep-VISUAL_HALF,pz=z*ringStep-VISUAL_HALF;
    const sx=px-saturn.pos.x,sy=py-saturn.pos.y,sz=pz-saturn.pos.z;
    const ringY=sy*.894-sz*.448,ringZ=sy*.448+sz*.894,rr=Math.hypot(sx,ringZ);
    if(rr<=sr*1.25||rr>=ro||Math.abs(ringY)>=rt)continue;
    if(count>=DETAIL_CAPACITY)throw new Error('Body detail capacity exceeded');
    positions[count*3]=px;positions[count*3+1]=py;positions[count*3+2]=pz;
    seeds[count]=((x*73856093^y*19349663^z*83492791)>>>0)%10000/10000;count++;
  }
  // Supply the complete 50³ asteroid-belt volume; the shader keeps its seeded subset.
  const beltInner=VISUAL_HALF*.265,beltOuter=VISUAL_HALF*.320,beltHeight=Math.max(1,VISUAL_HALF*.10);
  const beltLoX=Math.ceil((-beltOuter+VISUAL_HALF)/BODY_STEP_50),beltHiX=Math.floor((beltOuter+VISUAL_HALF)/BODY_STEP_50);
  const beltLoY=Math.ceil((-beltHeight+VISUAL_HALF)/BODY_STEP_50),beltHiY=Math.floor((beltHeight+VISUAL_HALF)/BODY_STEP_50);
  for(let x=beltLoX;x<=beltHiX;x++)for(let y=beltLoY;y<=beltHiY;y++)for(let z=beltLoX;z<=beltHiX;z++){
    const px=x*BODY_STEP_50-VISUAL_HALF,py=y*BODY_STEP_50-VISUAL_HALF,pz=z*BODY_STEP_50-VISUAL_HALF,br=Math.hypot(px,pz);
    if(br<beltInner||br>beltOuter)continue;
    if(bodies.some(b=>(px-b.pos.x)**2+(py-b.pos.y)**2+(pz-b.pos.z)**2<b.radius*b.radius))continue;
    const sx=px-saturn.pos.x,sy=py-saturn.pos.y,sz=pz-saturn.pos.z;
    const ringY=sy*.894-sz*.448,ringZ=sy*.448+sz*.894,rr=Math.hypot(sx,ringZ);
    if(rr>sr*1.25&&rr<ro&&Math.abs(ringY)<rt)continue;
    if(count>=DETAIL_CAPACITY)throw new Error('Body detail capacity exceeded');
    positions[count*3]=px;positions[count*3+1]=py;positions[count*3+2]=pz;
    seeds[count]=((x*73856093^y*19349663^z*83492791)>>>0)%10000/10000;count++;
  }
  detailGeometry.setDrawRange(0,count);
  detailGeometry.attributes.position.needsUpdate=true;detailGeometry.attributes.aSeed.needsUpdate=true;
}

function solveE(m,e){m%=Math.PI*2;let a=m;for(let i=0;i<7;i++)a-=(a-e*Math.sin(a)-m)/(1-e*Math.cos(a));return a}
function bodyData(){
  const bodyScale=gridSize===50?1:50/gridSize,sf=Math.sqrt(BODY_HALF/19)*bodyScale, maxAu=30.0611;
  const out=[{name:'太阳 · SUN',pos:new THREE.Vector3(),radius:Math.max(4,BODY_HALF*.20)*bodyScale,core:1,edge:.51}];
  const compactInner=gridSize===150?[.29,.36,.43,.50]:gridSize===100?[.33,.40,.47,.54]:[.80,.82,.84,.86];
  for(const [index,p] of PLANETS.entries()){const orbitScale=index<4?compactInner[index]:(gridSize>50&&index===4?.82:1),r=BODY_HALF*(.29+Math.log10(p[2]+1)/Math.log10(maxAu+1)*.55)*ORBIT_SCALE*orbitScale,a=solveE(p[7]+simDays/p[3]*Math.PI*2,p[4]),x=r*(Math.cos(a)-p[4]),pz=r*Math.sqrt(1-p[4]*p[4])*Math.sin(a),inc=p[8]*Math.PI/180;out.push({name:`${p[0]} · ${p[1].toUpperCase()}`,pos:new THREE.Vector3(x,pz*Math.sin(inc),pz*Math.cos(inc)),radius:p[9]*sf,core:p[10],edge:p[11]})}return out;
}

const vertexShader=`
attribute float aSeed,aDetail; uniform float uTime,uHalf,uPixelRatio,uDenseMode,uSpaceScale,uZoom; uniform vec2 uViewport; uniform vec4 uBodies[9]; uniform vec2 uLevels[9]; uniform vec3 uSaturn; uniform vec3 uShadowDirs[9]; varying float vRatio,vSeed,vPerspective,vVisible,vBodyDepth,vShadow,vEmphasis;
float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
void main(){
 float visualDense=uDenseMode*(1.-aDetail);
 float compactLayer=uDenseMode*aDetail;
 float ratio=.16+hash(position)*.12; float belt=length(position.xz); float beltHash=hash(position*vec3(1.7,2.3,3.1));float beltClump=hash(vec3(floor(position.x*.55),floor(position.z*.55),19.));float beltPoint=0.,beltEnabled=1.-uDenseMode*(1.-aDetail);
 float beltShift=visualDense*(beltHash-.5)*uHalf*.012;float beltInner=uHalf*mix(.455,.265,compactLayer);float beltOuter=uHalf*mix(.515,.320,compactLayer);float beltHeight=max(1.,uHalf*mix(.10,.035+beltClump*.020,visualDense));float beltChance=mix(.48,.30+beltClump*.12,visualDense);
 if(beltEnabled>.5&&belt>=beltInner&&belt<=beltOuter&&abs(position.y)<=beltHeight&&beltHash<beltChance){ratio=max(ratio,mix(.46+beltHash*.17,.44+beltHash*.17,visualDense));beltPoint=1.;}
 float bodyDepth=0.,shadow=0.;for(int i=0;i<9;i++){vec3 d=position-uBodies[i].xyz;float dist=length(d);if(dist<uBodies[i].w){float inward=1.-dist/uBodies[i].w;bodyDepth=max(bodyDepth,inward);ratio=max(ratio,uLevels[i].y+(uLevels[i].x-uLevels[i].y)*pow(inward,.72));}if(i>0){vec3 shadowDir=uShadowDirs[i];float behind=dot(d,shadowDir);if(behind>0.){vec3 radial=d-shadowDir*behind;float shadowRadius=uBodies[i].w*(2.40+behind/uHalf*.60)+.12;float softness=1.-smoothstep(shadowRadius*shadowRadius*.50,shadowRadius*shadowRadius,dot(radial,radial));float distanceFade=1.-smoothstep(uHalf*.18,uHalf*1.15,behind);shadow=max(shadow,softness*distanceFade);}}}
 vec3 sd=position-uSaturn;float ringY=sd.y*.894-sd.z*.448,ringZ=sd.y*.448+sd.z*.894,rr=length(vec2(sd.x,ringZ));float sr=uBodies[6].w,ri=sr*1.25,ro=sr*2.08,rt=sr*.324,ringPoint=0.;if(rr>ri&&rr<ro&&abs(ringY)<rt){float f=sin(3.14159*(rr-ri)/(ro-ri))*(1.-abs(ringY)/rt);ratio=max(ratio,.44+f*.21);ringPoint=1.;}
 float sizeFactor=.82+aSeed*.36;if(bodyDepth>0.)sizeFactor*=mix(1.,.24+2.16*pow(bodyDepth,.72),compactLayer);if(ratio<=.281)sizeFactor*=1.+.28*sin(uTime*(.65+aSeed*.55)+aSeed*6.28318);
 float mercuryDepth=max(0.,1.-length(position-uBodies[1].xyz)/uBodies[1].w);float iceDepth=max(1.-length(position-uBodies[7].xyz)/uBodies[7].w,1.-length(position-uBodies[8].xyz)/uBodies[8].w);float emphasis=max(max(mercuryDepth*.82,iceDepth*.88),max(beltPoint*.82,ringPoint*.30));if(mercuryDepth>0.)sizeFactor*=1.+.45*pow(mercuryDepth,.65);if(iceDepth>0.)sizeFactor*=1.+.50*pow(iceDepth,.65);if(ringPoint>.5)sizeFactor*=1.15;
 float meteorPeriod=3.6,meteorDuration=1.9,cycle=floor(uTime/meteorPeriod),age=mod(uTime,meteorPeriod)-(.25+hash(vec3(cycle,7.,11.))*.55),meteorOn=step(0.,age)*step(age,meteorDuration);
 float meteorAngle=hash(vec3(cycle,17.,3.))*6.28318,meteorLift=(hash(vec3(cycle,23.,5.))-.5)*.8;vec3 meteorDir=normalize(vec3(cos(meteorAngle),meteorLift,sin(meteorAngle)));vec3 meteorSide=normalize(vec3(-meteorDir.z,0.,meteorDir.x)),meteorUp=normalize(cross(meteorSide,meteorDir));
 vec3 meteorStart=-meteorDir*uHalf*1.12+meteorSide*uHalf*(hash(vec3(cycle,29.,13.))-.5)*.7+meteorUp*uHalf*(hash(vec3(cycle,31.,19.))-.5)*.38;vec3 meteorHead=meteorStart+meteorDir*(age/meteorDuration)*(uHalf*2.24),meteorDelta=meteorHead-position;float behind=dot(meteorDelta,meteorDir);vec3 meteorPerp=meteorDelta-meteorDir*behind;float meteorD2=dot(meteorPerp,meteorPerp),tailLength=uHalf*.42;
 if(ratio<=.281&&meteorOn>0.&&behind>=0.&&behind<tailLength&&meteorD2<2.6){float intensity=sin(3.14159*age/meteorDuration)*pow(1.-behind/tailLength,1.3)*(1.-meteorD2/2.6);ratio+=intensity*.18;sizeFactor+=intensity*.5;}
 vRatio=clamp(ratio,0.,1.);vSeed=aSeed;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;float sizeTone=smoothstep(.38,1.,vRatio);float redBoost=smoothstep(.78,1.,vRatio);float radius=(.38+pow(sizeTone,2.4)*10.6)*(1.+redBoost*.18);float zoomFill=pow(max(uZoom,1.),.47);if(vRatio<=.281){float spaceZoom=1.+(sqrt(max(uZoom,1.))-1.)*.12;radius*=mix(1.55,1.00,visualDense)*uSpaceScale*spaceZoom;}if(beltPoint>.5)radius*=mix(1.55,1.32,visualDense);float yellowBand=smoothstep(.42,.54,vRatio)*(1.-smoothstep(.69,.79,vRatio));float denseColorScale=1.-yellowBand*.22+redBoost*.32;radius*=mix(1.,denseColorScale,visualDense);float depth=max(1.,-mv.z);vPerspective=clamp(78./depth,.68,1.32);float perspectiveScale=(340./78.)*pow(78./depth,1.22);gl_PointSize=clamp(radius*sizeFactor*uPixelRatio*perspectiveScale*zoomFill,.35,mix(17.,34.,visualDense)*zoomFill);
 // Dense modes replace body/ring points with a compact adjacent-grid celestial layer.
 vVisible=1.;if(uDenseMode>.5){if(aDetail<.5&&(bodyDepth>0.||ringPoint>.5))vVisible=0.;if(aDetail>.5&&bodyDepth<=0.&&ringPoint<=.5&&beltPoint<=.5)vVisible=0.;}vBodyDepth=0.;vShadow=(bodyDepth<=0.&&beltPoint<.5&&ringPoint<.5)?shadow:0.;vEmphasis=emphasis;
}`;
const fragmentShader=`
precision highp float;varying float vRatio,vSeed,vPerspective,vVisible,vBodyDepth,vShadow,vEmphasis;
vec3 palette(float t){vec3 c[11];c[0]=vec3(.192,.212,.584);c[1]=vec3(.271,.459,.706);c[2]=vec3(.455,.678,.82);c[3]=vec3(.671,.851,.914);c[4]=vec3(.878,.953,.973);c[5]=vec3(1.,1.,.749);c[6]=vec3(.996,.878,.565);c[7]=vec3(.992,.682,.38);c[8]=vec3(.957,.427,.263);c[9]=vec3(.843,.188,.153);c[10]=vec3(.647,0.,.149);int i=int(min(10.,floor(t*11.)));if(i==0)return c[0];if(i==1)return c[1];if(i==2)return c[2];if(i==3)return c[3];if(i==4)return c[4];if(i==5)return c[5];if(i==6)return c[6];if(i==7)return c[7];if(i==8)return c[8];if(i==9)return c[9];return c[10];}
void main(){if(vVisible<.5)discard;float d=length(gl_PointCoord-.5);if(d>.5)discard;float edge=1.-smoothstep(.43,.5,d);float opacityVariation=.72+vSeed*.28;float depthFade=mix(.78,1.18,clamp((vPerspective-.68)/.64,0.,1.));float redOpacity=1.+smoothstep(.78,1.,vRatio)*.22;float alpha=min(1.,(.05+pow(vRatio,2.85)*.95)*opacityVariation*depthFade*redOpacity*1.08)*edge;alpha=min(1.,alpha*(1.+vEmphasis*.48));alpha*=1.-vShadow*.99;if(vBodyDepth>0.)alpha=max(alpha,(.30+.70*pow(vBodyDepth,.78))*edge);gl_FragColor=vec4(palette(vRatio),alpha);}`;

function rebuild(){
  if(detailGeometry){detailGeometry.dispose();detailGeometry=null;detailCloud=null;}
  if(cloud){scene.remove(cloud);geometry.dispose();material.dispose()}
  const n=gridSize,count=n*n*n,half=VISUAL_HALF,step=n===150?BODY_STEP_150:n===100?BODY_STEP_100:BODY_STEP_50,pos=new Float32Array(count*3),seed=new Float32Array(count);let q=0;
  for(let x=0;x<n;x++)for(let y=0;y<n;y++)for(let z=0;z<n;z++){pos[q*3]=x*step-half;pos[q*3+1]=y*step-half;pos[q*3+2]=z*step-half;seed[q]=((x*73856093^y*19349663^z*83492791)>>>0)%10000/10000;q++}
  geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(pos,3));geometry.setAttribute('aSeed',new THREE.BufferAttribute(seed,1));
  material=new THREE.ShaderMaterial({vertexShader,fragmentShader,transparent:true,depthWrite:false,blending:THREE.NormalBlending,uniforms:{uTime:{value:0},uHalf:{value:half},uPixelRatio:{value:Math.min(devicePixelRatio,2)},uDenseMode:{value:gridSize>50?1:0},uSpaceScale:{value:1},uZoom:{value:zoom},uViewport:{value:new THREE.Vector2()},uBodies:{value:Array.from({length:9},()=>new THREE.Vector4())},uLevels:{value:Array.from({length:9},()=>new THREE.Vector2())},uSaturn:{value:new THREE.Vector3()},uShadowDirs:{value:Array.from({length:9},()=>new THREE.Vector3())}}});
  material.defaultAttributeValues.aDetail=[0];
  cloud=new THREE.Points(geometry,material);scene.add(cloud);
  if(gridSize>50){
    detailGeometry=new THREE.BufferGeometry();
    detailGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(DETAIL_CAPACITY*3),3).setUsage(THREE.DynamicDrawUsage));
    detailGeometry.setAttribute('aSeed',new THREE.BufferAttribute(new Float32Array(DETAIL_CAPACITY),1).setUsage(THREE.DynamicDrawUsage));
    detailGeometry.setAttribute('aDetail',new THREE.BufferAttribute(new Float32Array(DETAIL_CAPACITY).fill(1),1));
    detailCloud=new THREE.Points(detailGeometry,material);detailCloud.frustumCulled=false;cloud.add(detailCloud);
  }
  updateBodies();if(followPlanet>=0)zoom=followFitZoom();$('#pointCount').textContent=count.toLocaleString();
}
function updateBodies(){const next=bodyData();bodies.length=0;bodies.push(...next);next.forEach((b,i)=>{material.uniforms.uBodies.value[i].set(b.pos.x,b.pos.y,b.pos.z,b.radius);material.uniforms.uLevels.value[i].set(b.core,b.edge);if(i>0)material.uniforms.uShadowDirs.value[i].copy(b.pos).sub(next[0].pos).normalize()});material.uniforms.uSaturn.value.copy(next[6].pos);updateBodyDetails()}
function followFitZoom(){const b=bodies[followPlanet+1];return b?Math.min(22,78/Math.max(1.25,b.radius*9.5)):1}
function setFollow(index){followPlanet=followPlanet===index?-1:index;zoom=followPlanet>=0?followFitZoom():1;rows($('#search').value)}
function init(){
  renderer=new THREE.WebGLRenderer({canvas,context,antialias:true,alpha:false,powerPreference:'default'});
  renderer.debug.onShaderError=(gl,program,vertex,fragment)=>{
    const error=new Error([gl.getProgramInfoLog(program),gl.getShaderInfoLog(vertex),gl.getShaderInfoLog(fragment)].filter(Boolean).join('\n') || 'Shader compilation failed');
    error.code='SHADER_FAILED';throw error;
  };
  renderer.setClearColor(0x000000);renderer.setPixelRatio(Math.min(devicePixelRatio,2));scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(48,1,.1,500);camera.position.z=78;rebuild();resize();cloud.rotation.set(pitch,yaw,0);renderer.render(scene,camera);requestAnimationFrame(frame);
}
function resize(){if(!renderer)return;const r=viewport.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();material?.uniforms.uViewport.value.set(r.width,r.height)}
function frame(now){const dt=Math.min((now-last)/1000,.1);last=now;if(!paused){simDays+=dt*daysPerSecond;updateBodies()}material.uniforms.uTime.value=now/1000;material.uniforms.uZoom.value=Math.max(1,zoom);cloud.rotation.set(pitch,yaw,0);const focus=bodies[followPlanet>=0?followPlanet+1:0];focusOffset.copy(focus.pos).applyEuler(cloud.rotation).multiplyScalar(-1);cloud.position.copy(focusOffset);camera.position.z=78;camera.zoom=zoom;camera.updateProjectionMatrix();renderer.render(scene,camera);updateLabels();$('#sceneInfo').textContent=`CUBIC LATTICE  ${gridSize}³   ·   ${(gridSize**3).toLocaleString()} POINTS   ·   ${(simDays/365.256).toFixed(2)} EARTH YEARS`;requestAnimationFrame(frame)}
function updateLabels(){
  labels.replaceChildren();leaders.replaceChildren();const rect=viewport.getBoundingClientRect(),w=rect.width,h=rect.height;
  bodies.forEach((b,i)=>{if(followPlanet>=0&&i!==followPlanet+1)return;const v=b.pos.clone().applyEuler(cloud.rotation).add(cloud.position).project(camera);const x=(v.x*.5+.5)*w,y=(-v.y*.5+.5)*h,dir=x>=w/2?1:-1,vertical=i%2===0?-1:1,lineY=Math.max(12,Math.min(h-28,y+vertical*36)),elbow=x+dir*42,end=elbow+dir*115;const poly=document.createElementNS('http://www.w3.org/2000/svg','polyline');poly.setAttribute('points',`${x},${y} ${elbow},${lineY} ${end},${lineY}`);leaders.append(poly);const label=document.createElement('span');label.className='body-label';label.textContent=b.name;label.style.top=`${lineY}px`;label.style.left=dir>0?`${end+6}px`:`${end-6}px`;if(dir<0)label.style.transform='translate(-100%,-50%)';labels.append(label)})
}
function setView(y,p,z){yaw=y;pitch=p;zoom=z??(followPlanet>=0?followFitZoom():1)}
viewport.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY};viewport.setPointerCapture(e.pointerId)});viewport.addEventListener('pointermove',e=>{if(!drag)return;yaw+=(e.clientX-drag.x)*.002;pitch=Math.max(-Math.PI/2,Math.min(Math.PI/2,pitch+(e.clientY-drag.y)*.002));drag={x:e.clientX,y:e.clientY}});viewport.addEventListener('pointerup',()=>drag=null);viewport.addEventListener('pointercancel',()=>drag=null);viewport.addEventListener('wheel',e=>{e.preventDefault();const maxZoom=followPlanet>=0?90:10;zoom=Math.max(.52,Math.min(maxZoom,zoom*(e.deltaY<0?1.1:.9)))},{passive:false});
$('#density').addEventListener('input',e=>{$('#densityValue').textContent=`${e.target.value} × ${e.target.value} × ${e.target.value}`});$('#density').addEventListener('change',e=>{gridSize=+e.target.value;rebuild()});$('#speed').addEventListener('input',e=>{daysPerSecond=SPEEDS[+e.target.value];$('#speedValue').textContent=`${daysPerSecond} 天/秒 · DAYS/S`});const pauseButton=$('#pause'),pauseLabel=$('#pauseLabel');pauseButton.onclick=()=>{paused=!paused;pauseButton.classList.toggle('is-paused',paused);pauseLabel.textContent=paused?'继续公转 · RESUME ORBITS':'暂停公转 · PAUSE ORBITS';$('#status').textContent=paused?'● 已暂停 · PAUSED':'● 运行中 · RUNNING'};$('#resetView').onclick=()=>setView(Math.PI/4,Math.PI/4);$('#frontView').onclick=()=>setView(0,0);$('#topView').onclick=()=>setView(0,Math.PI/2);$('#resetPlanets').onclick=()=>{simDays=0;updateBodies()};
$('#fullscreen').onclick=async()=>{if(!document.fullscreenElement)await $('#hologram').requestFullscreen();else await document.exitFullscreen()};document.addEventListener('fullscreenchange',()=>$('#fullscreen').classList.toggle('exit',!!document.fullscreenElement));
function rows(filter=''){const f=filter.trim().toLowerCase();$('#planetRows').innerHTML=PLANETS.map((p,index)=>({p,index})).filter(({p})=>!f||p[0].includes(f)||p[1].toLowerCase().includes(f)).map(({p,index})=>{const active=followPlanet===index;return `<tr class="${active?'is-following':''}"><td><div class="planet-cell"><span>${p[0]}&nbsp;&nbsp;${p[1]}</span><button class="follow-button" data-follow="${index}" aria-pressed="${active}">${active?'跟随中 · ACTIVE':'跟随 · FOLLOW'}</button></div></td><td>${p[2].toFixed(4)}</td><td>${p[3].toLocaleString(undefined,{maximumFractionDigits:3})}</td><td>${(p[3]/365.256).toFixed(3)}</td><td>${p[5].toFixed(2)}</td><td>${p[6].toLocaleString()}</td></tr>`}).join('')}rows();$('#planetRows').addEventListener('click',e=>{const button=e.target.closest('.follow-button');if(button)setFollow(+button.dataset.follow)});$('#search').addEventListener('input',e=>rows(e.target.value));new ResizeObserver(resize).observe(viewport);
init();
