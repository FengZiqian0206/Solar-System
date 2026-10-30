// A fixed, distance-sampled path; the live head connects without adding stationary samples.
export function createCenterTrail(THREE) {
  const capacity=512, spacing=.45, maxLength=180, maxAge=30, dash=.32, period=dash+.22;
  const history=new Float64Array(capacity*3), times=new Float64Array(capacity), arcs=new Float64Array(capacity);
  const positions=new Float32Array(capacity*12), alphas=new Float32Array(capacity*4);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('aAlpha',new THREE.BufferAttribute(alphas,1).setUsage(THREE.DynamicDrawUsage));
  geometry.setDrawRange(0,0);
  const material=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,
    uniforms:{uTime:{value:0},uFade:{value:1}},
    vertexShader:`attribute float aAlpha;varying float vAlpha;void main(){vAlpha=aAlpha;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`precision highp float;uniform float uTime,uFade;varying float vAlpha;void main(){vec3 color=.75+.25*(.55+.45*cos(6.28318*(uTime/4.+vec3(0.,.333,.667))));gl_FragColor=vec4(color,vAlpha*uFade);}`
  });
  material.linewidth=1;
  const object=new THREE.LineSegments(geometry,material);
  object.name='centerTrail';object.renderOrder=1;object.frustumCulled=false;object.visible=false;
  let start=0,count=0,clock=0,arc=0,carry=0,headTime=0,headX=0,headY=0,headZ=0,initialized=false,vertices=0;
  const smooth=(lo,hi,value)=>{const t=Math.max(0,Math.min(1,(value-lo)/(hi-lo)));return t*t*(3-2*t);};

  function append(x,y,z,time,distance) {
    const slot=(start+count)%capacity,q=slot*3;
    history[q]=x;history[q+1]=y;history[q+2]=z;times[slot]=time;arcs[slot]=distance;
    if(count<capacity)count++;else start=(start+1)%capacity;
  }
  function reset() {
    start=count=clock=arc=carry=headTime=vertices=0;initialized=false;
    geometry.setDrawRange(0,0);object.visible=false;
  }
  function emit(nx,ny,nz,nt,na,ox,oy,oz,ot,oa) {
    const from=arc-na,to=Math.min(arc-oa,maxLength),length=na-oa;
    if(length<1e-7 || to-from<1e-7 || (nx-ox)**2+(ny-oy)**2+(nz-oz)**2<1e-14)return;
    for(let d=Math.floor(from/period);d*period<to;d++) {
      const a=Math.max(from,d*period),b=Math.min(to,d*period+dash);
      if(b-a<1e-7)continue;
      const fa=(a-from)/length,fb=(b-from)/length;
      const aa=.65*(1-smooth(6,maxAge,clock-(nt+(ot-nt)*fa)))*(1-smooth(maxLength*.55,maxLength,a));
      const ab=.65*(1-smooth(6,maxAge,clock-(nt+(ot-nt)*fb)))*(1-smooth(maxLength*.55,maxLength,b));
      if(Math.max(aa,ab)<1e-6)continue;
      const q=vertices*3;
      positions[q]=nx+(ox-nx)*fa;positions[q+1]=ny+(oy-ny)*fa;positions[q+2]=nz+(oz-nz)*fa;
      positions[q+3]=nx+(ox-nx)*fb;positions[q+4]=ny+(oy-ny)*fb;positions[q+5]=nz+(oz-nz)*fb;
      alphas[vertices]=aa;alphas[vertices+1]=ab;vertices+=2;
    }
  }
  function rebuild() {
    vertices=0;
    let x=headX,y=headY,z=headZ,time=headTime,distance=arc;
    for(let i=count-1;i>=0;i--) {
      const slot=(start+i)%capacity,q=slot*3;
      emit(x,y,z,time,distance,history[q],history[q+1],history[q+2],times[slot],arcs[slot]);
      x=history[q];y=history[q+1];z=history[q+2];time=times[slot];distance=arcs[slot];
      if(arc-distance>=maxLength)break;
    }
    geometry.setDrawRange(0,vertices);
    geometry.attributes.position.needsUpdate=true;geometry.attributes.aAlpha.needsUpdate=true;
  }
  function update(center,dt,{active=true,time,freeze=false,fade=1}={}) {
    if(!active){reset();return;}
    material.uniforms.uFade.value=Math.max(0,Math.min(1,fade));
    if(!freeze) {
      const previousClock=clock;clock+=Math.max(0,dt);
      if(!initialized) {
        headX=center.x;headY=center.y;headZ=center.z;headTime=clock;initialized=true;
        append(headX,headY,headZ,clock,arc);
      }else{
        const dx=center.x-headX,dy=center.y-headY,dz=center.z-headZ,distance=Math.hypot(dx,dy,dz);
        if(distance>1e-7) {
          if(previousClock-headTime>=maxAge){start=count=0;carry=0;append(headX,headY,headZ,previousClock,arc);}
          let next=spacing-carry;
          for(;next<=distance+1e-7;next+=spacing) {
            const travelled=Math.min(next,distance),fraction=travelled/distance;
            append(headX+dx*fraction,headY+dy*fraction,headZ+dz*fraction,previousClock+(clock-previousClock)*fraction,arc+travelled);
          }
          carry=Math.max(0,distance-(next-spacing));arc+=distance;
          headX=center.x;headY=center.y;headZ=center.z;headTime=clock;
        }
      }
      while(count>1) {
        const next=(start+1)%capacity;
        if(clock-times[next]<maxAge && arc-arcs[next]<maxLength)break;
        start=next;count--;
      }
      rebuild();
    }
    material.uniforms.uTime.value=time??clock;
    object.visible=vertices>0 && material.uniforms.uFade.value>0;
  }
  return {object,update,reset};
}
