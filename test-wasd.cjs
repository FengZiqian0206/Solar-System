// Public controller + real input QA, without a WebGL renderer.
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium}=require('playwright');
const length=vector=>Math.hypot(...vector),difference=(a,b)=>a.map((value,index)=>value-b[index]);
const near=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<1e-6,`${message}: ${actual} vs ${expected}`);
const dot=(a,b)=>a.reduce((sum,value,index)=>sum+value*b[index],0);

(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const url=process.argv[2]||'http://127.0.0.1:4194/',output=fs.mkdtempSync(path.join(os.tmpdir(),'solar-wasd-'));
  const report=[];
  async function open(profile){
    const context=await browser.newContext({viewport:{width:profile.width,height:profile.height},isMobile:!!profile.mobile,hasTouch:!!profile.mobile,deviceScaleFactor:1});
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    page.on('response',response=>{if(response.status()>=400&&!response.url().endsWith('favicon.ico'))errors.push(`${response.status()} ${response.url()}`);});
    await page.route('**/*',route=>route.request().isNavigationRequest()?route.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="./style.css"><section id="hologram" class="hologram"><div id="viewport"><canvas id="canvas"></canvas></div></section>'}):route.continue());
    await page.goto(url);
    await page.evaluate(async()=>{
      const [THREE,{createRoaming}]=await Promise.all([import(new URL('./vendor/three/three.module.js',location.href).href),import(new URL('./roaming.js',location.href).href)]);
      const viewport=document.querySelector('#viewport');
      viewport.requestPointerLock=()=>Promise.reject(new Error('QA CSS mode'));
      document.querySelector('#hologram').requestFullscreen=()=>Promise.reject(new Error('QA CSS mode'));
      window.qaCamera=new THREE.PerspectiveCamera(48,1,.1,500);window.qaRegrow=0;
      window.qaController=createRoaming({THREE,camera:window.qaCamera,viewport,getEarth:()=>({pos:new THREE.Vector3(0,0,0)}),half:26,step:52/49,onStart(){},onRegrow(){window.qaRegrow++;}});
      window.qaSnapshot=()=>({active:window.qaController.active,collapsing:window.qaController.collapsing,travel:window.qaController.influencePosition.toArray(),direction:window.qaCamera.getWorldDirection(new THREE.Vector3()).toArray(),right:new THREE.Vector3(1,0,0).applyQuaternion(window.qaCamera.quaternion).toArray(),quaternion:window.qaCamera.quaternion.toArray(),held:Object.fromEntries([...document.querySelectorAll('.roam-key')].map(button=>[button.dataset.move,button.getAttribute('aria-pressed')==='true'])),disabled:[...document.querySelectorAll('.roam-key')].map(button=>button.disabled)});
      await window.qaController.enter({automatic:true});window.qaController.update(0,0);
    });
    return {context,page,errors};
  }
  const snapshot=page=>page.evaluate(()=>window.qaSnapshot());
  const advance=(page,steps=1,elapsed=.1)=>page.evaluate(({steps,elapsed})=>{for(let i=0;i<steps;i++)window.qaController.update(.1,elapsed);return window.qaSnapshot();},{steps,elapsed});
  async function chord(page,keys,steps=10){
    const before=await snapshot(page);
    for(const key of keys)await page.keyboard.down(key);
    const after=await advance(page,steps);
    for(const key of keys)await page.keyboard.up(key);
    return {before,after,delta:difference(after.travel,before.travel)};
  }
  function allReleased(state){assert.ok(Object.values(state.held).every(held=>!held),'Every movement source is released');}
  async function layout(page,profile){
    const boxes=await page.evaluate(()=>Object.fromEntries(['#roamForward','#roamLeft','#roamBackward','#roamRight','#roamMoveHint','#roamCollapse','#roamCollapseHint','.roam-instructions','#roamExit'].map(selector=>{
      const r=document.querySelector(selector).getBoundingClientRect();return [selector,{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}];
    })));
    const entries=Object.entries(boxes);
    for(const [selector,r]of entries)assert.ok(r.width>0&&r.height>0&&r.x>=0&&r.y>=0&&r.right<=profile.width+.5&&r.bottom<=profile.height+.5,`${selector} fits ${profile.width}x${profile.height}`);
    for(let a=0;a<entries.length;a++)for(let b=a+1;b<entries.length;b++){
      const [sa,ra]=entries[a],[sb,rb]=entries[b];
      assert.ok(ra.right<=rb.x+.5||rb.right<=ra.x+.5||ra.bottom<=rb.y+.5||rb.bottom<=ra.y+.5,`${sa} and ${sb} must not overlap`);
    }
    for(const selector of ['#roamForward','#roamLeft','#roamBackward','#roamRight','#roamCollapse'])assert.ok(boxes[selector].width>=44&&boxes[selector].height>=44,'Movement and Space remain touch targets');
    const w=boxes['#roamForward'],a=boxes['#roamLeft'],s=boxes['#roamBackward'],d=boxes['#roamRight'];
    near(w.x+w.width/2,s.x+s.width/2,'W is centred above S');near(a.y,s.y,'ASD share a row');near(d.y,s.y,'ASD share a row');
    assert.ok(w.bottom<a.y&&a.right<s.x&&s.right<d.x,'WASD key layout');
    await page.screenshot({path:path.join(output,`${profile.width}x${profile.height}.png`)});
    return boxes;
  }
  try{
    const desktop={width:1280,height:900},session=await open(desktop),{page}=session;
    try{
      const boxes=await layout(page,desktop);
      const w=await chord(page,['w']),s=await chord(page,['s']),a=await chord(page,['a']),d=await chord(page,['d']);
      for(const move of [w,s,a,d])near(length(move.delta),6,'Single-axis speed stays six world units per second');
      for(let axis=0;axis<3;axis++){near(w.delta[axis],-s.delta[axis],'W/S oppose');near(a.delta[axis],-d.delta[axis],'A/D oppose');}
      near(dot(w.delta,w.before.direction),6,'W follows camera facing');near(dot(d.delta,d.before.right),6,'D follows camera right');
      assert.deepEqual(a.after.quaternion,a.before.quaternion,'Strafing does not rotate camera');assert.deepEqual(d.after.quaternion,d.before.quaternion);
      near(dot(a.delta,a.before.direction),0,'A is perpendicular to camera forward');
      near(length((await chord(page,['w','d'])).delta),6,'Diagonal input is normalised');
      near(length((await chord(page,['w','s'])).delta),0,'W/S cancel');near(length((await chord(page,['a','d'])).delta),0,'A/D cancel');
      const button=boxes['#roamForward'];await page.mouse.move(button.x+button.width/2,button.y+button.height/2);
      for(const releaseFirst of ['keyboard','pointer']){
        await page.keyboard.down('w');await page.mouse.down();
        if(releaseFirst==='keyboard')await page.keyboard.up('w');else await page.mouse.up();
        assert.equal((await snapshot(page)).held.KeyW,true,'One released source must not clear another');
        const before=await snapshot(page),after=await advance(page);near(length(difference(after.travel,before.travel)),.6,'Remaining source still moves');
        if(releaseFirst==='keyboard')await page.mouse.up();else await page.keyboard.up('w');
        allReleased(await snapshot(page));
      }
      for(const key of ['w','a','s','d'])await page.keyboard.down(key);
      await page.evaluate(()=>window.dispatchEvent(new Event('blur')));allReleased(await snapshot(page));
      for(const key of ['w','a','s','d'])await page.keyboard.up(key);
      await page.keyboard.down('w');await page.keyboard.press('Space');
      const locked=await snapshot(page);assert.ok(locked.collapsing&&locked.disabled.every(Boolean));allReleased(locked);
      for(const key of ['w','a','s','d'])await page.keyboard.down(key);
      assert.deepEqual((await advance(page,10)).travel,locked.travel,'Space locks every movement direction');allReleased(await snapshot(page));
      for(const key of ['w','a','s','d'])await page.keyboard.up(key);
      const ready=await advance(page,3,100);
      assert.ok(!ready.collapsing&&ready.disabled.every(value=>!value));assert.equal(await page.evaluate(()=>window.qaRegrow),1);
      near(length((await chord(page,['a'],1)).delta),.6,'Movement returns after regrowth');
      await page.keyboard.down('a');await page.keyboard.press('Escape');
      assert.equal((await snapshot(page)).active,false);allReleased(await snapshot(page));await page.keyboard.up('a');
      assert.deepEqual(session.errors,[]);
      report.push({viewport:desktop,boxes,checks:['W/S and A/D basis','6 units/s','normalised diagonal','opposite cancellation','independent pointer/keyboard sources','blur','Space lock','regrowth unlock','Escape cleanup']});
    }finally{await session.context.close();}
    for(const profile of [{width:390,height:844,mobile:true},{width:320,height:700,mobile:true},{width:844,height:390,mobile:true}]){
      const mobile=await open(profile),{page}=mobile;
      try{
        const boxes=await layout(page,profile),cdp=await mobile.context.newCDPSession(page);
        const touch=(selector,id)=>({id,x:boxes[selector].x+boxes[selector].width/2,y:boxes[selector].y+boxes[selector].height/2,radiusX:4,radiusY:4,force:.7});
        const w=touch('#roamForward',1),a=touch('#roamLeft',2),before=await snapshot(page);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[w]});
        assert.equal((await snapshot(page)).held.KeyW,true);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[w,a]});
        const held=await snapshot(page);assert.ok(held.held.KeyW&&held.held.KeyA,'Two real touch points hold two movement keys');
        const diagonal=await advance(page,10);near(length(difference(diagonal.travel,before.travel)),6,'Touch diagonal has normal speed');
        assert.deepEqual(diagonal.quaternion,before.quaternion,'Touch keys do not rotate the view');
        await page.screenshot({path:path.join(output,`${profile.width}x${profile.height}-held.png`)});
        // Edge ends the listed contact; keep the independently captured A contact down.
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[w]});
        const onlyA=await snapshot(page);assert.ok(!onlyA.held.KeyW&&onlyA.held.KeyA,'Releasing one touch preserves the other key');
        near(dot(difference((await advance(page)).travel,onlyA.travel),onlyA.right),-.6,'Remaining A touch strafes left');
        await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});allReleased(await snapshot(page));
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch('#roamBackward',3)]});assert.equal((await snapshot(page)).held.KeyS,true);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
        for(const key of ['w','a','s','d'])await page.keyboard.down(key);
        await page.locator('#roamExit').tap();
        assert.equal((await snapshot(page)).active,false);allReleased(await snapshot(page));
        for(const key of ['w','a','s','d'])await page.keyboard.up(key);
        assert.deepEqual(mobile.errors,[]);
        report.push({viewport:profile,boxes,checks:['safe layout and 44px targets','CDP two-finger diagonal','independent touch release','touchcancel','exit cleanup']});
      }finally{await mobile.context.close();}
    }
    console.log(JSON.stringify({passed:true,profiles:report,screenshots:output}));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
