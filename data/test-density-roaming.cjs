// Focused 50/100/150 density smoke; no duplicate full vortex lifecycle.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {chromium}=require('playwright');

(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:480,height:360},deviceScaleFactor:1});
  page.setDefaultTimeout(120000);
  const output=fs.mkdtempSync(path.join(os.tmpdir(),'solar-density-')),errors=[],failed=[],densities=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{if(response.status()>=400&&!response.url().endsWith('favicon.ico'))failed.push(response.url());});
  try{
    await page.addInitScript(()=>{
      // Keep physical mouse clicks available for the exit HUD; native fullscreen still exercises real entry.
      Element.prototype.requestPointerLock=()=>Promise.reject(new Error('QA density unlocked input'));
      document.addEventListener('DOMContentLoaded',async()=>{
        const {THREE}=await import(new URL('./renderer-support.js?v=visual-balance-1',location.href).href),after=THREE.Points.prototype.onAfterRender;
        THREE.Points.prototype.onAfterRender=function(renderer,scene,camera,...args){
          after.call(this,renderer,scene,camera,...args);
          if(!this.material?.uniforms?.uGridStep||this.geometry.attributes.aDetail)return;
          window.qaDensityCloud=this;window.qaDensityRenderer=renderer;window.qaDensityScene=scene;window.qaDensityCamera=camera;
          const u=this.material.uniforms;
          window.qaDensity={count:this.geometry.attributes.position.count,active:u.uRoam.value,progress:u.uCollapse.value,expansion:u.uExpansion.value,travel:u.uInfluenceCenter.value.toArray(),player:u.uPlayer.value.toArray()};
          if(u.uRoam.value&&!window.qaDensityReady){window.qaDensityReady=true;console.log('QA_DENSITY_READY');}
        };
      });
    });
    const ready=page.waitForEvent('console',{predicate:message=>message.text()==='QA_DENSITY_READY'});
    await page.goto(process.argv[2]||'http://127.0.0.1:4194/');await ready;
    assert.equal(await page.locator('#density').inputValue(),'50','Initial roaming retains the first density');

    async function gridState(){
      return page.evaluate(()=>{
        const cloud=window.qaDensityCloud,a=cloud.geometry.attributes,u=cloud.material.uniforms,n=Math.round(Math.cbrt(a.position.count)),base=a.position.array,step=u.uGridStep.value,half=u.uHalf.value;
        const ijk=u.uPlayer.value.toArray().map(value=>Math.round((value+half)/step)),index=(ijk[0]*n+ijk[1])*n+ijk[2];
        return {n,count:a.position.count,step,half,dense:u.uDenseMode.value,spaceScale:u.uSpaceScale.value,uuid:cloud.geometry.uuid,bounds:[base[0],base[base.length-1]],adjacentStep:base[5]-base[2],selected:[base[index*3],base[index*3+1],base[index*3+2]],player:u.uPlayer.value.toArray(),attributes:Object.fromEntries(['aSeed','aPlayerTint','aPlayerOffset','aJetDelay'].map(name=>[name,{count:a[name].count,itemSize:a[name].itemSize,bytes:a[name].array.byteLength}])),detailVisible:cloud.children.some(child=>child.visible),calls:window.qaDensityRenderer.info.render.calls,points:window.qaDensityRenderer.info.render.points,dpr:window.qaDensityRenderer.getPixelRatio(),memory:{...window.qaDensityRenderer.info.memory}};
      });
    }
    async function exercise(n){
      await page.waitForFunction(n=>window.qaDensity?.active&&window.qaDensity.count===n**3,n);
      assert.equal(await page.locator('#density').isDisabled(),true);
      const state=await gridState();
      assert.equal(state.count,n**3);assert.equal(state.half,26);assert.ok(Math.abs(state.step-52/(n-1))<1e-10);
      assert.ok(Math.abs(state.adjacentStep-state.step)<.000003&&Math.abs(state.bounds[0]+26)<.000003&&Math.abs(state.bounds[1]-26)<.000003,'Each mode fills the same cube with its own standard grid spacing');
      assert.ok(state.selected.every((value,index)=>Math.abs(value-state.player[index])<.00001),'Selected player is an existing vertex of this density');
      assert.equal(state.dense,n>50?1:0);assert.equal(state.detailVisible,false,'Roaming uses the complete base lattice without the extra overview layer');
      assert.equal(state.calls,1);assert.equal(state.points,n**3);assert.equal(state.dpr,1);
      for(const [name,attribute]of Object.entries(state.attributes)){assert.equal(attribute.count,n**3);assert.equal(attribute.itemSize,name==='aPlayerOffset'?3:1);}
      assert.equal(state.attributes.aJetDelay.bytes,n**3*4);
      await page.locator('#density').evaluate((element,value)=>{element.value=String(value);element.dispatchEvent(new Event('input',{bubbles:true}));},n===150?50:150);
      assert.equal(await page.locator('#density').inputValue(),String(n),'Dispatched changes cannot rebuild density while roaming');
      assert.equal(await page.evaluate(()=>window.qaDensityCloud.geometry.uuid),state.uuid);

      const start=await page.evaluate(()=>window.qaDensity.travel);
      await page.keyboard.down('w');
      await page.waitForFunction(start=>Math.hypot(...window.qaDensity.travel.map((value,index)=>value-start[index]))>.8,start);
      await page.keyboard.up('w');
      const moved=await gridState();
      assert.ok(moved.selected.every((value,index)=>Math.abs(value-moved.player[index])<.00001),'Movement snaps using the rebuilt density step');
      await page.waitForFunction(()=>{
        const cloud=window.qaDensityCloud,u=cloud.material.uniforms,n=Math.round(Math.cbrt(cloud.geometry.attributes.position.count)),p=u.uPlayer.value,step=u.uGridStep.value,half=u.uHalf.value;
        const cell=[p.x,p.y,p.z].map(value=>Math.round((value+half)/step)),index=(cell[0]*n+cell[1])*n+cell[2];
        return cloud.geometry.attributes.aPlayerTint.array[index]>.2;
      });
      const pixels=await page.evaluate(async()=>{
        const {THREE}=await import('./renderer-support.js?v=visual-balance-1'),renderer=window.qaDensityRenderer,target=new THREE.WebGLRenderTarget(64,48),previous=renderer.getRenderTarget();
        try{
          renderer.setRenderTarget(target);renderer.render(window.qaDensityScene,window.qaDensityCamera);
          const pixels=new Uint8Array(64*48*4);renderer.readRenderTargetPixels(target,0,0,64,48,pixels);
          let lit=0;for(let index=0;index<pixels.length;index+=4)if(Math.max(pixels[index],pixels[index+1],pixels[index+2])>1)lit++;
          return lit;
        }finally{renderer.setRenderTarget(previous);target.dispose();}
      });
      assert.ok(pixels>30,'Each density produces visible scene pixels while roaming');
      await page.screenshot({path:path.join(output,`roaming-${n}.png`)});
      await page.keyboard.press('Space');
      await page.waitForFunction(()=>window.qaDensity.progress>0);
      const jets=await page.evaluate(()=>{
        const cloud=window.qaDensityCloud,a=cloud.geometry.attributes,u=cloud.material.uniforms,n=Math.round(Math.cbrt(a.position.count)),step=u.uGridStep.value,half=u.uHalf.value,center=u.uInfluenceCenter.value,player=u.uPlayer.value,base=a.position.array,offset=a.aPlayerOffset.array,cells=[],local=[];
        const lo=axis=>Math.max(0,Math.ceil((center[axis]-4*step+half)/step)),hi=axis=>Math.min(n-1,Math.floor((center[axis]+4*step+half)/step));
        for(let x=lo('x');x<=hi('x');x++)for(let y=lo('y');y<=hi('y');y++)for(let z=lo('z');z<=hi('z');z++){
          const index=(x*n+y)*n+z,q=index*3,pinned=Math.hypot(base[q]-player.x,base[q+1]-player.y,base[q+2]-player.z)<.01;
          const distance=Math.hypot(base[q]+(pinned?0:offset[q])-center.x,base[q+1]+(pinned?0:offset[q+1])-center.y,base[q+2]+(pinned?0:offset[q+2])-center.z);
          local.push({index,tint:a.aPlayerTint.array[index],offset:Array.from(offset.slice(q,q+3)),delay:a.aJetDelay.array[index]});
          if(distance<=2.1*step)cells.push({index,distance,delay:a.aJetDelay.array[index]});
        }
        cells.sort((a,b)=>a.distance-b.distance||a.index-b.index);
        window.qaDensityFrozen={local,travel:center.toArray(),bodies:u.uBodies.value.flatMap(body=>body.toArray()),positions:base};
        return {cells,step,progress:u.uCollapse.value,coloured:local.filter(cell=>cell.tint>.05).length,displaced:local.filter(cell=>Math.hypot(...cell.offset)>.001).length};
      });
      assert.ok(jets.coloured>4&&jets.displaced>4,'Influence colours and repels nearby cells in each mode');
      assert.ok(jets.cells.length>1&&new Set(jets.cells.map(cell=>cell.delay)).size===jets.cells.length);
      const spacing=Math.min(.14,8/Math.max(1,jets.cells.length-1));
      assert.ok(jets.cells.every((cell,rank)=>Math.abs(cell.delay-rank*spacing)<.000002),'Current-density core uses its own sorted launch schedule');
      assert.equal(await page.locator('#roamForward').isDisabled(),true);
      await page.waitForFunction(progress=>window.qaDensity.progress>progress+.02,jets.progress);
      const frozen=await page.evaluate(()=>{
        const saved=window.qaDensityFrozen,a=window.qaDensityCloud.geometry.attributes,u=window.qaDensityCloud.material.uniforms;
        return {geometry:saved.positions===a.position.array,influence:saved.local.every(cell=>a.aPlayerTint.array[cell.index]===cell.tint&&cell.offset.every((value,axis)=>a.aPlayerOffset.array[cell.index*3+axis]===value)),delays:saved.local.every(cell=>a.aJetDelay.array[cell.index]===cell.delay),travel:saved.travel.every((value,index)=>u.uInfluenceCenter.value.getComponent(index)===value),bodies:saved.bodies.every((value,index)=>u.uBodies.value[Math.floor(index/4)].getComponent(index%4)===value)};
      });
      assert.ok(Object.values(frozen).every(Boolean),'Collapse freezes the rebuilt influence, orbit and launch data');
      await page.locator('#roamExit').click();
      await page.waitForFunction(()=>!document.body.classList.contains('is-roaming')&&window.qaDensity?.active===0);
      assert.equal(await page.locator('#density').isDisabled(),false,'Exit restores overview density control');
      densities.push({n,...state,litPixels:pixels,jets:{count:jets.cells.length,spacing,gridStep:jets.step},frozen});
    }
    await exercise(50);
    for(const n of [100,150,50]){
      await page.locator('#density').press(n===50?'Home':'ArrowRight');
      await page.waitForFunction(n=>window.qaDensity?.count===n**3&&window.qaDensity.active===0,n);
      assert.equal(await page.locator('#density').inputValue(),String(n));
      assert.equal(await page.locator('#densityValue').textContent(),`${n} × ${n} × ${n}`);
      assert.equal(await page.locator('#pointCount').textContent(),(n**3).toLocaleString('en-US'));
      const overview=await gridState();
      assert.equal(overview.detailVisible,n>50);assert.equal(overview.calls,n>50?2:1);
      if(n===50)break;
      await page.locator('h1').dblclick();await exercise(n);
    }
    const trail=await page.evaluate(async()=>{
      const {createPointInfluence}=await import('./point-influence.js?v=7'),field=createPointInfluence(50,26),step=52/49,coordinate=-26+25*step,index=(25*50+25)*50+25;
      for(let count=0;count<20;count++)field.update({x:coordinate,y:coordinate,z:coordinate},.1);
      const initial=field.values[index];field.update(null,6);
      return {initial,afterSixSeconds:field.values[index],fraction:field.values[index]/initial};
    });
    assert.ok(trail.initial>.9&&trail.fraction>.5&&trail.fraction<.55,'Departed coloured cells retain over half their tint after six seconds');
    assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
    console.log(JSON.stringify({passed:true,densities,trail,screenshots:output}));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
