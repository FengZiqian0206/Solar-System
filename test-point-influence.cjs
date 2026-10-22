const assert=require('node:assert/strict');
(async()=>{
  const {createPointInfluence}=await import('./point-influence.js');
  const step=52/49, c=-26+25*step, center={x:c,y:c,z:c};
  const index=(x,y=25,z=25)=>(x*50+y)*50+z;
  const field=createPointInfluence(50,26);
  field.update(center,.05);
  assert.ok(field.values[index(26)]>0 && field.values[index(26)]<.3,'Gradual arrival');
  field.update(center,2);
  assert.ok(field.values[index(26)]>.94);
  assert.equal(field.values[index(27,26)],0,'Reduced radius excludes cells sqrt(5) steps away');
  const before=field.values[index(26)];
  field.update(null,.5);
  assert.ok(field.values[index(26)]>before*.7 && field.values[index(26)]<before,'Slow departure');
  field.update(null,2);
  assert.ok(field.values[index(26)]>before*.6 && field.values[index(26)]<before*.7,'Much longer fade');
  field.update(null,45); assert.ok(field.values.every(v=>v===0));
  field.reset();field.update({...center,x:c+step*.45},.1);
  assert.ok(field.values[index(27)]>.1,'Next cells begin colouring before a grid snap');
  field.reset();assert.ok(field.values.every(v=>v===0));
  const result=[];
  for(const fps of [30,60,120]){
    const f=createPointInfluence(50,26);
    for(let i=0;i<fps;i++)f.update(center,1/fps);
    for(let i=0;i<fps;i++)f.update(null,1/fps);
    result.push(f.values[index(25)]);
  }
  assert.ok(Math.max(...result)-Math.min(...result)<.00001,'Frame-rate-independent fade');
  field.update({x:-26,y:-26,z:-26},1);
  assert.ok(field.values.every(v=>Number.isFinite(v)&&v>=0&&v<=.95));
  console.log('Influence: smaller radius, gradual pre-colouring, slower fade, reset, boundaries and 30/60/120 FPS equivalence passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
