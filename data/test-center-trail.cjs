const assert=require('node:assert/strict');
(async()=>{
  const THREE=await import('./vendor/three/three.module.js');
  const {createCenterTrail}=await import('./center-trail.js');
  const trail=createCenterTrail(THREE),object=trail.object,geometry=object.geometry;
  const buffer=geometry.attributes.position.array,alpha=geometry.attributes.aAlpha.array;
  const point=(x,y=0,z=0)=>({x,y,z});
  const usedPositions=()=>Array.from(buffer.slice(0,geometry.drawRange.count*3));
  const usedAlpha=()=>Array.from(alpha.slice(0,geometry.drawRange.count));
  assert.equal(object.name,'centerTrail');assert.equal(object.isLineSegments,true);assert.equal(object.visible,false);
  trail.update(point(0),0);assert.equal(geometry.drawRange.count,0,'A stationary first point is not a line');
  trail.update(point(.1),.1);
  assert.equal(object.visible,true);assert.equal(geometry.drawRange.count,2,'Live head joins movement before the sampling threshold');
  assert.ok(Math.abs(buffer[0]-.1)<1e-6,'Head connects to continuous position');
  const still=usedPositions();trail.update(point(.1),1);
  assert.deepEqual(usedPositions(),still,'Standing still adds no path');
  trail.update(point(0),.1);assert.equal(object.visible,false,'Coincident head and sole sample do not add an empty draw call');
  trail.reset();trail.update(point(0),0);trail.update(point(10),1,{time:7});
  assert.equal(object.material.uniforms.uTime.value,7);
  const merged=[];
  for(let i=0;i<geometry.drawRange.count;i+=2){
    const a=buffer[i*3],b=buffer[(i+1)*3],last=merged.at(-1);
    if(last&&Math.abs(last[1]-a)<1e-5)last[1]=b;else merged.push([a,b]);
  }
  assert.ok(merged.length>10,'The tail is dashed');
  for(let i=0;i<merged.length-1;i++){
    assert.ok(Math.abs(merged[i][0]-merged[i][1]-.32)<1e-5,'Dash length uses world units');
    assert.ok(Math.abs(merged[i][1]-merged[i+1][0]-.22)<1e-5,'Gap length uses world units');
  }
  const frozenPositions=usedPositions(),frozenAlpha=usedAlpha();
  trail.update(point(20),20,{freeze:true,time:8,fade:.4});
  assert.deepEqual(usedPositions(),frozenPositions);assert.deepEqual(usedAlpha(),frozenAlpha,'Freeze does not age the path');
  assert.equal(object.material.uniforms.uFade.value,.4);assert.equal(object.material.uniforms.uTime.value,8);
  trail.update(point(20),1,{freeze:true,fade:0});assert.equal(object.visible,false,'Final fade hides the draw call');
  trail.update(point(20),1,{active:false});assert.equal(geometry.drawRange.count,0);assert.equal(object.visible,false);
  trail.update(point(0),0);trail.update(point(10),1);
  trail.update(point(10),20);
  assert.ok(object.visible,'Line lasts longer than the colour trail 90% fade');
  assert.ok(Math.max(...usedAlpha())<.3,'Age fades the remaining path');
  trail.update(point(10),10);assert.equal(object.visible,false);assert.equal(geometry.drawRange.count,0,'Old stationary path fully expires');
  trail.update(point(10.1),.1);assert.equal(object.visible,true,'Movement after expiry starts a fresh path');
  trail.reset();trail.update(point(0),0);
  for(let i=1;i<=1200;i++)trail.update(point(i*.45),.01);
  assert.strictEqual(geometry.attributes.position.array,buffer,'Position buffer stays fixed through ring wrap');
  assert.strictEqual(geometry.attributes.aAlpha.array,alpha,'Alpha buffer stays fixed');
  assert.ok(geometry.drawRange.count<=alpha.length && geometry.drawRange.count%2===0,'Draw count stays within fixed capacity');
  const drawn=usedPositions(),xs=drawn.filter((_,i)=>i%3===0);
  assert.ok(Math.min(...xs)>=360-1e-4 && Math.max(...xs)<=540+1e-4,'History stays within 180 world units');
  const headAlpha=alpha[0],tailAlpha=alpha[geometry.drawRange.count-1];
  assert.ok(headAlpha>tailAlpha && tailAlpha<.02,'Arc length softens the far tail');
  assert.ok(drawn.every(Number.isFinite)&&usedAlpha().every(a=>Number.isFinite(a)&&a>=0&&a<=.65),'Finite bounded vertices and alpha');
  trail.reset();assert.equal(geometry.drawRange.count,0);assert.equal(object.visible,false);
  object.geometry.dispose();object.material.dispose();
  console.log('Center trail: fixed buffers, world dashes, live head, stationary expiry, freeze/fade, ring capacity, 180-unit range and reset passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
