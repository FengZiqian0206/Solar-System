// Focused Space/vortex QA: NODE_PATH=<Playwright modules> node data/test-vortex.cjs <URL>
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {chromium}=require('playwright');

(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const output=fs.mkdtempSync(path.join(os.tmpdir(),'solar-vortex-'));
  const url=process.argv[2]||'http://127.0.0.1:4194/';
  const report={desktop:null,mobile:[],screenshots:output};
  async function open(profile){
    const context=await browser.newContext({viewport:{width:profile.width,height:profile.height},isMobile:!!profile.mobile,hasTouch:!!profile.mobile,deviceScaleFactor:1});
    const page=await context.newPage(),errors=[],failed=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('response',response=>{if(response.status()>=400&&!response.url().endsWith('favicon.ico'))failed.push(response.url());});
    await page.addInitScript(mobile=>{
      if(mobile)Element.prototype.requestFullscreen=()=>Promise.reject(new Error('QA mobile fallback'));
      document.addEventListener('DOMContentLoaded',async()=>{
        const {THREE}=await import(new URL('./renderer-support.js?v=visual-balance-1',location.href).href);
        const afterRender=THREE.Points.prototype.onAfterRender;
        window.qaVortexHistory=[];window.qaFrozen=null;
        document.addEventListener('keydown',event=>{if(event.code==='Space'&&!event.repeat&&window.qaVortex?.active&&window.qaVortex.progress===0)window.qaTriggerWall=performance.now();},true);
        THREE.Points.prototype.onAfterRender=function(renderer,scene,camera,...args){
          afterRender.call(this,renderer,scene,camera,...args);
          if(!this.material?.uniforms?.uCollapse||this.geometry.attributes.position.count!==125000)return;
          const u=this.material.uniforms;
          window.qaCloud=this;window.qaRenderer=renderer;window.qaScene=scene;window.qaCamera=camera;
          window.qaVortex={active:u.uRoam.value,progress:u.uCollapse.value,time:u.uTime.value,wall:performance.now(),travel:u.uInfluenceCenter.value.toArray(),player:u.uPlayer.value.toArray(),camera:camera.position.toArray(),quaternion:camera.quaternion.toArray(),bodies:u.uBodies.value.flatMap(body=>body.toArray()),calls:renderer.info.render.calls,points:renderer.info.render.points,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,dpr:renderer.getPixelRatio()};
          if(u.uRoam.value&&u.uCollapse.value>0){
            if(!window.qaFrozen)window.qaFrozen={bodies:window.qaVortex.bodies.slice(),travel:window.qaVortex.travel.slice(),tint:this.geometry.attributes.aPlayerTint.array.slice(),offset:this.geometry.attributes.aPlayerOffset.array.slice()};
            window.qaVortexHistory.push({progress:u.uCollapse.value,wall:performance.now()});
          }
          if(u.uRoam.value&&!window.qaVortexReady){window.qaVortexReady=true;console.log('QA_VORTEX_READY');}
        };
      });
    },!!profile.mobile);
    const ready=page.waitForEvent('console',{predicate:message=>message.text()==='QA_VORTEX_READY'});
    await page.goto(url);await ready;
    return {context,page,errors,failed};
  }
  async function scenePixels(page){
    return page.evaluate(async()=>{
      const {THREE}=await import('./renderer-support.js?v=visual-balance-1');
      const renderer=window.qaRenderer,target=new THREE.WebGLRenderTarget(128,96),previous=renderer.getRenderTarget();
      try{
        renderer.setRenderTarget(target);renderer.render(window.qaScene,window.qaCamera);
        const pixels=new Uint8Array(128*96*4);renderer.readRenderTargetPixels(target,0,0,128,96,pixels);
        let lit=0,maxRGB=0;
        for(let i=0;i<pixels.length;i+=4){const value=Math.max(pixels[i],pixels[i+1],pixels[i+2]);maxRGB=Math.max(maxRGB,value);if(value>1)lit++;}
        return {lit,maxRGB};
      }finally{renderer.setRenderTarget(previous);target.dispose();}
    });
  }
  async function resetChecks(page){
    await page.waitForFunction(()=>window.qaVortex?.active&&window.qaVortex.progress===0);
    assert.equal(await page.locator('#roamForward').isDisabled(),false);
    assert.equal(await page.locator('#roamCollapse').isDisabled(),false);
    assert.equal(await page.locator('#roamCollapse').getAttribute('aria-pressed'),'false');
  }
  async function shaderSamples(page){
    return page.evaluate(async()=>{
      const {THREE}=await import('./renderer-support.js?v=visual-balance-1');
      const renderer=window.qaRenderer,material=window.qaCloud.material.clone();
      material.blending=THREE.NoBlending;material.defaultAttributeValues.aDetail=[0];material.defaultAttributeValues.aPlayerOffset=[0,0,0];
      material.uniforms.uTime.value=0;material.uniforms.uRoam.value=1;material.uniforms.uInfluenceCenter.value.set(0,12,0);material.uniforms.uPlayer.value.set(0,12,0);
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute([8,12,4],3));
      geometry.setAttribute('aSeed',new THREE.Float32BufferAttribute([.5],1));
      geometry.setAttribute('aPlayerTint',new THREE.Float32BufferAttribute([.95],1));
      const scene=new THREE.Scene(),point=new THREE.Points(geometry,material);point.frustumCulled=false;scene.add(point);
      const camera=new THREE.OrthographicCamera(-16,16,16,-16,.1,100),target=new THREE.WebGLRenderTarget(128,128);
      const previous=renderer.getRenderTarget(),clear=renderer.getClearColor(new THREE.Color()),clearAlpha=renderer.getClearAlpha();
      function sample(progress,top=false,player=false){
        material.uniforms.uCollapse.value=progress;
        geometry.attributes.position.setXYZ(0,player?0:8,12,player?0:4);geometry.attributes.position.needsUpdate=true;
        camera.up.set(0,top?0:1,top?-1:0);camera.position.set(0,top?52:12,top?0:40);camera.lookAt(0,12,0);
        renderer.setRenderTarget(target);renderer.setClearColor(0,0);renderer.render(scene,camera);
        const pixels=new Uint8Array(128*128*4);renderer.readRenderTargetPixels(target,0,0,128,128,pixels);
        let weight=0,x=0,y=0,maxAlpha=0;
        for(let py=0;py<128;py++)for(let px=0;px<128;px++){
          const alpha=pixels[(py*128+px)*4+3];weight+=alpha;x+=px*alpha;y+=py*alpha;maxAlpha=Math.max(maxAlpha,alpha);
        }
        return {weight,maxAlpha,x:weight?(x/weight+.5-64)/4:null,y:weight?(y/weight+.5-64)/4:null};
      }
      try{
        return [0,.4,.8,1].map(progress=>{
          const front=sample(progress),top=sample(progress,true),player=sample(progress,false,true);
          return {progress,front,top,player,radius:front.weight&&top.weight?Math.hypot(front.x,front.y,top.y):null};
        });
      }finally{renderer.setRenderTarget(previous);renderer.setClearColor(clear,clearAlpha);target.dispose();geometry.dispose();material.dispose();}
    });
  }
  try{
    const desktop=await open({width:1280,height:900}),page=desktop.page;
    try{
      await resetChecks(page);
      assert.ok((await page.locator('#roamCollapseHint').textContent()).includes('看看会发生什么'));
      assert.ok((await page.locator('#roamCollapseHint').textContent()).includes('SEE WHAT HAPPENS'));
      const shader=await shaderSamples(page);
      assert.ok(shader[0].radius>8&&shader[1].radius<shader[0].radius*.8&&shader[2].radius<shader[1].radius*.8,'Actual shader pulls the three-dimensional point radius inward');
      const initialXZ=[shader[0].front.x,shader[0].top.y],middleXZ=[shader[1].front.x,shader[1].top.y];
      const normalizedRotationCross=(initialXZ[0]*middleXZ[1]-initialXZ[1]*middleXZ[0])/(Math.hypot(...initialXZ)*Math.hypot(...middleXZ));
      assert.ok(Math.abs(normalizedRotationCross)>.1,'The rendered point turns around the centre, rather than only scaling inward');
      assert.ok(shader[0].player.maxAlpha>150&&shader[2].player.maxAlpha<shader[0].player.maxAlpha,'Selected player also fades in the vortex');
      assert.equal(shader[3].front.weight,0);assert.equal(shader[3].top.weight,0);assert.equal(shader[3].player.weight,0,'No selected-point exception survives at completion');
      const beforePixels=await scenePixels(page);assert.ok(beforePixels.lit>100,'The original point cloud renders before collapse');
      await page.screenshot({path:path.join(output,'desktop-0-before.png')});
      await page.keyboard.down('w');
      await page.waitForFunction(()=>document.pointerLockElement?.id==='viewport');
      const movingFrom=await page.evaluate(()=>window.qaVortex.travel);
      await page.waitForFunction(p=>Math.hypot(...window.qaVortex.travel.map((v,i)=>v-p[i]))>.5,movingFrom);
      await page.evaluate(()=>window.qaBasePositions=window.qaCloud.geometry.attributes.position.array.slice());
      await page.keyboard.down('Space');
      await page.waitForFunction(()=>window.qaVortex.progress>0);
      const started=await page.evaluate(()=>window.qaVortex);
      assert.equal(await page.locator('#roamForward').isDisabled(),true);
      assert.equal(await page.locator('#roamCollapse').isDisabled(),true);
      assert.equal(await page.locator('#roamForward').getAttribute('aria-pressed'),'false');
      assert.equal(await page.locator('#roamCollapse').getAttribute('aria-pressed'),'true');
      await page.keyboard.down('Space'); // A repeat must not restart the animation.
      await page.keyboard.up('w');await page.keyboard.down('w');
      assert.equal(await page.locator('#roamForward').getAttribute('aria-pressed'),'false','W cannot resume movement during collapse');
      await page.keyboard.up('w');await page.keyboard.up('Space');
      await page.waitForFunction(()=>window.qaVortex.progress>=.05);
      await page.screenshot({path:path.join(output,'desktop-1-early.png')});
      const beforeLook=await page.evaluate(()=>window.qaVortex);
      await page.mouse.move(700,300,{steps:3});
      await page.waitForFunction(q=>window.qaVortex.quaternion.some((v,i)=>Math.abs(v-q[i])>.01),beforeLook.quaternion);
      const beforeZoom=await page.evaluate(()=>window.qaVortex);
      await page.mouse.wheel(0,-300);
      await page.waitForFunction(previous=>Math.abs(Math.hypot(...window.qaVortex.camera.map((v,i)=>v-window.qaVortex.travel[i]))-previous)>.1,Math.hypot(...beforeZoom.camera.map((v,i)=>v-beforeZoom.travel[i])));
      await page.waitForFunction(()=>window.qaVortex.progress>=.4);
      await page.screenshot({path:path.join(output,'desktop-2-middle.png')});
      assert.deepEqual(await page.evaluate(()=>window.qaVortex.travel),started.travel,'Collapse freezes continuous movement');
      await page.waitForFunction(()=>window.qaVortex.progress>=.8);
      await page.screenshot({path:path.join(output,'desktop-3-late.png')});
      await page.waitForFunction(()=>window.qaVortex.progress===1,null,{timeout:30000});
      await page.screenshot({path:path.join(output,'desktop-4-complete.png')});
      const completed=await page.evaluate(()=>({state:window.qaVortex,history:window.qaVortexHistory.slice(),elapsed:(window.qaVortexHistory.find(frame=>frame.progress===1).wall-window.qaTriggerWall)/1000,baseIntact:window.qaBasePositions.every((value,index)=>value===window.qaCloud.geometry.attributes.position.array[index]),frozenTint:window.qaFrozen.tint.every((value,index)=>value===window.qaCloud.geometry.attributes.aPlayerTint.array[index]),frozenOffsets:window.qaFrozen.offset.every((value,index)=>value===window.qaCloud.geometry.attributes.aPlayerOffset.array[index]),frozenBodies:window.qaFrozen.bodies.every((value,index)=>value===window.qaVortex.bodies[index])}));
      assert.ok(completed.history.length>10);
      assert.ok(completed.elapsed>=9&&completed.elapsed<=15,'Vortex completes in about ten real seconds, independent of the capped movement timestep');
      assert.ok(completed.history.every((frame,index,frames)=>frame.progress>=0&&frame.progress<=1&&(index===0||frame.progress>=frames[index-1].progress)),'Progress stays bounded and never restarts');
      assert.equal(completed.baseIntact,true);assert.equal(completed.frozenTint,true);assert.equal(completed.frozenOffsets,true);assert.equal(completed.frozenBodies,true);
      assert.equal(completed.state.calls,1);assert.equal(completed.state.points,125000);
      const completePixels=await scenePixels(page);
      assert.equal(completePixels.lit,0,'Only the scene, excluding HTML HUD, becomes black');assert.ok(completePixels.maxRGB<=1);
      await page.keyboard.press('Space');
      assert.equal(await page.evaluate(()=>window.qaVortex.progress),1,'Finished animation is one-shot for this roaming session');
      await page.keyboard.press('Escape');
      await page.waitForFunction(()=>!document.body.classList.contains('is-roaming')&&!document.fullscreenElement);
      await page.locator('h1').dblclick();await resetChecks(page);
      report.desktop={beforePixels,completePixels,shader,normalizedRotationCross,elapsed:completed.elapsed,frames:completed.history.length,progress:{first:completed.history[0].progress,last:completed.history.at(-1).progress,monotonic:true},render:{calls:completed.state.calls,points:completed.state.points,geometries:completed.state.geometries,textures:completed.state.textures,dpr:completed.state.dpr},checks:['actual GPU spiral rotation/radius and selected-point fade','W then Space stops movement','one-shot and repeat safety','camera look and wheel during collapse','unpaused early/middle/late/final captures','ten-second real-time completion','frozen orbits and influence','immutable base coordinates','completed scene black','exit and re-entry reset']};
      assert.deepEqual(desktop.errors,[]);assert.deepEqual(desktop.failed,[]);
    }finally{await desktop.context.close();}

    for(const viewport of [{width:390,height:844},{width:320,height:700},{width:844,height:390}]){
      const mobile=await open({...viewport,mobile:true}),page=mobile.page;
      try{
        await resetChecks(page);
        const layout=await page.evaluate(()=>{
          const bounds=id=>{const r=document.querySelector(id).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
          return {width:innerWidth,height:innerHeight,space:bounds('#roamCollapse'),spaceHint:bounds('#roamCollapseHint'),w:bounds('#roamForward'),wHint:bounds('#roamForwardHint'),exit:bounds('#roamExit')};
        });
        for(const rect of [layout.space,layout.spaceHint,layout.w,layout.wHint,layout.exit])assert.ok(rect.x>=0&&rect.y>=0&&rect.right<=layout.width+1&&rect.bottom<=layout.height+1,'Mobile action and hints fit inside viewport');
        const intersects=(a,b)=>Math.min(a.right,b.right)-Math.max(a.x,b.x)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1;
        const controls=[layout.space,layout.spaceHint,layout.w,layout.wHint];
        assert.ok(controls.every((rect,index)=>controls.slice(index+1).every(other=>!intersects(rect,other))),'Space, W and their hints do not overlap');
        assert.ok(layout.space.width>layout.w.width*1.25&&layout.space.height>=44,'Space is a wide physical-key touch target');
        await page.screenshot({path:path.join(output,`mobile-${viewport.width}x${viewport.height}-before.png`)});
        const cdp=await mobile.context.newCDPSession(page),w={id:1,x:layout.w.x+layout.w.width/2,y:layout.w.y+layout.w.height/2,radiusX:4,radiusY:4,force:.7},space={id:2,x:layout.space.x+layout.space.width/2,y:layout.space.y+layout.space.height/2,radiusX:4,radiusY:4,force:.7};
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[w]});
        await page.waitForFunction(()=>document.querySelector('#roamForward').getAttribute('aria-pressed')==='true');
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[w,space]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        await page.waitForFunction(()=>window.qaVortex.progress>0);
        assert.equal(await page.locator('#roamForward').isDisabled(),true);assert.equal(await page.locator('#roamCollapse').isDisabled(),true);
        assert.equal(await page.locator('#roamForward').getAttribute('aria-pressed'),'false');
        const trigger=await page.evaluate(()=>window.qaVortex);
        await page.waitForFunction(p=>window.qaVortex.progress>p+.03,trigger.progress);
        assert.deepEqual(await page.evaluate(()=>window.qaVortex.travel),trigger.travel);
        await page.screenshot({path:path.join(output,`mobile-${viewport.width}x${viewport.height}-triggered.png`)});
        await page.locator('#roamExit').tap();
        await page.waitForFunction(()=>!document.body.classList.contains('is-roaming'));
        assert.deepEqual(mobile.errors,[]);assert.deepEqual(mobile.failed,[]);
        report.mobile.push({viewport,layout,checks:['safe action layout','Space tap with W held','movement stops','exit works during animation']});
      }finally{await mobile.context.close();}
    }
    console.log(JSON.stringify({passed:true,...report}));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
