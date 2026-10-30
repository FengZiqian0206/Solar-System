// Isolated touch/browser checks: NODE_PATH=<Playwright modules> node data/test-mobile-roaming.cjs <URL>
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {chromium}=require('playwright');

(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const output=fs.mkdtempSync(path.join(os.tmpdir(),'solar-mobile-roaming-'));
  const url=process.argv[2]||'http://127.0.0.1:4194/';
  const results=[];
  try{
    for(const profile of [
      {name:'portrait-fallback',width:390,height:844,fullscreen:'reject'},
      {name:'landscape-fallback',width:844,height:390,fullscreen:'missing'},
      {name:'portrait-native',width:390,height:844,fullscreen:'native'}
    ]){
      const context=await browser.newContext({viewport:{width:profile.width,height:profile.height},isMobile:true,hasTouch:true,deviceScaleFactor:1});
      const page=await context.newPage(),errors=[],failed=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))failed.push(r.url());});
      try{
        await page.addInitScript(mode=>{
          window.qaLockRequests=0;window.qaFullscreenRequests=[];
          Element.prototype.requestPointerLock=()=>{window.qaLockRequests++;return Promise.reject(new Error('Unexpected mobile pointer lock'));};
          const fullscreen=Element.prototype.requestFullscreen;
          Element.prototype.requestFullscreen=mode==='missing'?undefined:function(...args){
            window.qaFullscreenRequests.push({active:navigator.userActivation.isActive,target:this.id});
            return mode==='reject'?Promise.reject(new Error('QA mobile fullscreen unavailable')):fullscreen.apply(this,args);
          };
          const observer=new MutationObserver(()=>{
            if(document.body?.classList.contains('is-roaming')){window.qaFirstRoam={splashPresent:!!document.querySelector('#splash')};observer.disconnect();}
          });
          observer.observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
          document.addEventListener('DOMContentLoaded',async()=>{
            const {THREE}=await import(new URL('./renderer-support.js?v=visual-balance-1',location.href).href);
            document.addEventListener('pointerdown',event=>{if(event.target.closest('#roamForward'))window.qaForwardPointer=event.pointerId;},true);
            window.qaCaptureLog=[];
            for(const type of ['gotpointercapture','lostpointercapture'])document.addEventListener(type,event=>{if(event.target.id==='roamForward')window.qaCaptureLog.push({type,id:event.pointerId});},true);
            const afterRender=THREE.Points.prototype.onAfterRender;
            let initialReported=false;
            THREE.Points.prototype.onAfterRender=function(renderer,scene,camera,...args){
              afterRender.call(this,renderer,scene,camera,...args);
              if(!this.material?.uniforms?.uInfluenceCenter||this.geometry.attributes.position.count!==125000)return;
              const u=this.material.uniforms;
              window.qaSample={time:u.uTime.value,active:u.uRoam.value,travel:u.uInfluenceCenter.value.toArray(),camera:camera.position.toArray(),quaternion:camera.quaternion.toArray(),calls:renderer.info.render.calls,points:renderer.info.render.points};
              if(u.uRoam.value&&!initialReported){initialReported=true;console.log('QA_INITIAL_ROAM_FRAME_READY');}
            };
          });
        },profile.fullscreen);
        // Wait on browser-owned events rather than evaluation that supplies a synthetic gesture.
        const initialFrame=page.waitForEvent('console',{predicate:message=>message.text()==='QA_INITIAL_ROAM_FRAME_READY'});
        await page.goto(url);
        await initialFrame;
        assert.equal(await page.evaluate(()=>matchMedia('(pointer:coarse)').matches),true);
        const cdp=await context.newCDPSession(page);
        const touch=(id,x,y)=>({id,x,y,radiusX:4,radiusY:4,force:.7});
        const send=(type,points=[])=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
        async function doubleTap(){
          await page.locator('#viewport').scrollIntoViewIfNeeded();
          const rect=await page.locator('#viewport').boundingBox(),x=rect.x+rect.width/2,y=rect.y+rect.height/2;
          await page.touchscreen.tap(x,y);await page.touchscreen.tap(x,y);
          await page.waitForFunction(()=>document.body.classList.contains('is-roaming')&&window.qaSample?.active);
        }
        async function released(){
          await page.waitForFunction(()=>document.querySelector('#roamForward').getAttribute('aria-pressed')==='false'&&!document.querySelector('#roamForward').classList.contains('is-held'));
          const stopped=await page.evaluate(()=>window.qaSample);
          await page.waitForFunction(t=>window.qaSample.time>t+.25,stopped.time);
          assert.deepEqual(await page.evaluate(()=>window.qaSample.travel),stopped.travel,'Forward travel stops on release/cancel');
        }
        assert.equal(await page.evaluate(()=>window.qaFirstRoam.splashPresent),false,'Automatic mobile entry follows splash removal');
        assert.equal(await page.evaluate(()=>document.fullscreenElement),null,'Automatic mobile entry uses CSS fullscreen without activation');
        assert.equal(await page.evaluate(()=>document.pointerLockElement),null);
        assert.ok(await page.evaluate(()=>window.qaFullscreenRequests.every(request=>!request.active)),'Automatic fullscreen requests have no user activation');
        await page.evaluate(()=>document.querySelector('#pause').click());
        const automatic=await page.evaluate(()=>window.qaSample),automaticDistance=Math.hypot(...automatic.camera.map((v,i)=>v-automatic.travel[i]));
        assert.ok(Math.abs(automaticDistance-48)<.01);
        await page.screenshot({path:path.join(output,profile.name+'-automatic-entry.png')});
        const firstViewport=await page.locator('#viewport').boundingBox();
        await page.touchscreen.tap(firstViewport.x+firstViewport.width*.5,firstViewport.y+firstViewport.height*.4);
        if(profile.fullscreen==='native')await page.waitForFunction(()=>document.fullscreenElement?.id==='hologram');
        assert.equal(await page.evaluate(()=>document.body.classList.contains('is-roaming')),true);
        assert.deepEqual(await page.evaluate(()=>window.qaSample.travel),automatic.travel,'Native upgrade preserves the active roaming position');
        await page.locator('#roamExit').tap();
        await page.waitForFunction(()=>!document.body.classList.contains('is-roaming')&&!document.fullscreenElement);
        const exitTime=await page.evaluate(()=>window.qaSample.time);
        await page.waitForFunction(t=>window.qaSample.time>t+.4,exitTime);
        assert.equal(await page.evaluate(()=>document.body.classList.contains('is-roaming')),false,'Automatic entry is not repeated after exit');
        await doubleTap();
        assert.equal(await page.evaluate(()=>window.qaLockRequests),0,'Coarse input skips pointer lock');
        assert.equal(await page.evaluate(()=>document.fullscreenElement?.id||null),profile.fullscreen==='native'?'hologram':null);
        const layout=await page.evaluate(()=>{
          const bounds=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
          return {width:innerWidth,height:innerHeight,hologram:bounds('#hologram'),key:bounds('#roamForward'),keys:Array.from(document.querySelectorAll('.roam-key'),button=>bounds('#'+button.id)),group:bounds('.roam-keys'),hint:bounds('#roamMoveHint'),exit:bounds('#roamExit'),font:parseFloat(getComputedStyle(document.querySelector('#roamMoveHint')).fontSize),hintText:document.querySelector('#roamMoveHint').innerText.replace(/\s+/g,' '),bodyOverflow:getComputedStyle(document.body).overflow};
        });
        assert.ok(Math.abs(layout.hologram.x)<1&&Math.abs(layout.hologram.y)<1&&Math.abs(layout.hologram.width-layout.width)<1&&Math.abs(layout.hologram.height-layout.height)<1,'Roaming fills the mobile viewport');
        for(const rect of [...layout.keys,layout.hint,layout.exit])assert.ok(rect.x>=0&&rect.y>=0&&rect.right<=layout.width+1&&rect.bottom<=layout.height+1,'Mobile controls fit inside viewport');
        assert.ok(layout.keys.every(key=>key.width>=44&&key.height>=44),'All four movement keys have usable touch targets');
        assert.ok((layout.hint.bottom<=layout.group.y||layout.hint.x>=layout.group.right)&&layout.font<=11,'Small English hint stays outside the WASD key group');
        assert.equal(layout.hintText,'HOLD WASD TO MOVE');
        assert.ok(layout.exit.y<60&&layout.exit.right>layout.width-80,'Exit sits at the top right');
        assert.equal(layout.bodyOverflow,'hidden');
        const entry=await page.evaluate(()=>window.qaSample),entryDistance=Math.hypot(...entry.camera.map((v,i)=>v-entry.travel[i]));
        assert.ok(Math.abs(entryDistance-48)<.01);assert.equal(entry.calls,1);assert.equal(entry.points,125000);
        await page.screenshot({path:path.join(output,profile.name+'-entry.png')});
        const key=layout.key,w=touch(1,key.x+key.width/2,key.y+key.height/2);
        await send('touchStart',[w]);
        await page.waitForFunction(()=>document.querySelector('#roamForward').classList.contains('is-held')&&document.querySelector('#roamForward').getAttribute('aria-pressed')==='true');
        await page.waitForFunction(p=>Math.hypot(...window.qaSample.travel.map((v,i)=>v-p[i]))>1,entry.travel);
        const beforeLook=await page.evaluate(()=>window.qaSample);
        const look=touch(2,layout.width*.40,layout.height*.40);
        await send('touchStart',[w,look]);
        await send('touchMove',[w,{...look,x:look.x+60,y:look.y+35}]);
        await page.waitForFunction(q=>window.qaSample.quaternion.some((v,i)=>Math.abs(v-q[i])>.02),beforeLook.quaternion);
        assert.equal(await page.locator('#roamForward').getAttribute('aria-pressed'),'true','A second touch can look while W remains held');
        await page.waitForFunction(p=>Math.hypot(...window.qaSample.travel.map((v,i)=>v-p[i]))>.5,beforeLook.travel);
        await page.screenshot({path:path.join(output,profile.name+'-holding-and-looking.png')});
        await send('touchEnd');await released();
        if(profile.fullscreen!=='native'){
          await send('touchStart',[w]);
          await page.waitForFunction(()=>document.querySelector('#roamForward').getAttribute('aria-pressed')==='true');
          await send('touchCancel');await released();
          await send('touchStart',[w]);
          await page.waitForFunction(()=>document.querySelector('#roamForward').getAttribute('aria-pressed')==='true');
          await send('touchMove',[{...w,x:w.x+3}]);
          await page.waitForFunction(()=>window.qaCaptureLog.some(event=>event.type==='gotpointercapture'&&event.id===window.qaForwardPointer));
          assert.equal(await page.evaluate(()=>document.querySelector('#roamForward').hasPointerCapture(window.qaForwardPointer)),true);
          await page.evaluate(()=>document.querySelector('#roamForward').releasePointerCapture(window.qaForwardPointer));
          await send('touchMove',[{...w,x:w.x+6}]); // Deliver the pending lostpointercapture event.
          await released();await send('touchEnd');
          await send('touchStart',[w]);
          await page.waitForFunction(()=>document.querySelector('#roamForward').getAttribute('aria-pressed')==='true');
          await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
          await released();await send('touchEnd');
          await send('touchStart',[w]);
          await page.waitForFunction(()=>document.querySelector('#roamForward').getAttribute('aria-pressed')==='true');
          await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;});
          await released();await send('touchEnd');
        }
        await send('touchStart',[w]);
        await page.waitForFunction(()=>document.querySelector('#roamForward').getAttribute('aria-pressed')==='true');
        await page.locator('#roamExit').evaluate(el=>el.click());
        await send('touchEnd');
        await page.waitForFunction(()=>!document.body.classList.contains('is-roaming')&&!document.fullscreenElement);
        assert.equal(await page.locator('#roamForward').getAttribute('aria-pressed'),'false','Exit releases held W');
        assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
        results.push({profile:profile.name,automaticDistance,entryDistance,layout,checks:['automatic entry after splash without activation','first tap upgrades the existing native session when available','exit stays in overview until manual double tap','real double tap','coarse-pointer skip','full viewport and safe controls','touch hold and release','simultaneous movement and touch look','exit cleanup',...(profile.fullscreen==='native'?[]:['fullscreen fallback','cancel','lost pointer capture','blur','hidden tab'])]});
      }finally{await context.close();}
    }
    console.log(JSON.stringify({passed:true,results,screenshots:output}));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
