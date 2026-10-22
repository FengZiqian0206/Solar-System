// Isolated browser QA: node data/test-roaming.cjs [local URL]. Requires Playwright.
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({channel:'msedge', headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page = await browser.newPage({viewport:{width:1280,height:900}});
  const errors = [], failed = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('favicon.ico')) failed.push(response.url()); });
  const url = process.argv[2] || 'http://127.0.0.1:4193/';
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'solar-roaming-'));
  try {
    await page.goto(url);
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('RUNNING'));
    await page.locator('#splash').waitFor({state:'detached'});
    assert.equal(await page.locator('#density').isDisabled(), true);
    assert.equal(await page.locator('#density').inputValue(), '50');
    assert.equal(await page.locator('#pointCount').textContent(), '125,000');
    // Even an old/programmatically dispatched change cannot rebuild higher density.
    await page.locator('#density').evaluate(el=>{el.value='150';el.dispatchEvent(new Event('input'));el.dispatchEvent(new Event('change'));el.value='50';});
    assert.equal(await page.locator('#densityValue').textContent(), '50 × 50 × 50');
    assert.equal(await page.locator('#pointCount').textContent(), '125,000');
    await page.locator('#pause').click();
    await page.mouse.move(650, 280);
    assert.equal(await page.locator('#rainbowCursor span').textContent(), 'Double-click to start');
    assert.equal(await page.locator('#rainbowCursor').isVisible(), true);
    assert.equal(await page.locator('#rainbowCursor').evaluate(el=>getComputedStyle(el).width), '16px');
    assert.equal(await page.locator('#rainbowCursor i').evaluate(el=>getComputedStyle(el).backgroundImage), 'none');
    const timing = await page.locator('#rainbowCursor span').evaluate(el => {
      const a = el.getAnimations()[0];
      const {duration, delay} = a.effect.getTiming();
      a.pause(); a.currentTime = delay + 1500;
      return {duration, delay, shown:getComputedStyle(el).opacity};
    });
    assert.equal(timing.duration, 5000); assert.equal(timing.delay, 5000); assert.equal(+timing.shown, 1);
    await page.screenshot({path:path.join(output,'cursor.png')});
    const hidden = await page.locator('#rainbowCursor span').evaluate(el => {el.getAnimations()[0].currentTime=9500;return getComputedStyle(el).opacity;});
    assert.equal(+hidden, 0);

    // Instrument only this isolated test page, without adding production debug globals.
    await page.evaluate(async () => {
      const {THREE} = await import('./renderer-support.js?v=visual-balance-1');
      const lookAt = THREE.PerspectiveCamera.prototype.lookAt;
      THREE.PerspectiveCamera.prototype.lookAt = function(...args) {
        lookAt.apply(this,args); window.cameraSample=this.position.toArray();
      };
      const afterRender = THREE.Points.prototype.onAfterRender, direction = new THREE.Vector3();
      THREE.Points.prototype.onAfterRender = function(renderer,scene,camera,...args) {
        afterRender.call(this,renderer,scene,camera,...args);
        const cloud=this;
        if(!cloud.material?.uniforms?.uPlayer)return;
        const u=cloud.material.uniforms, player=u.uPlayer.value.toArray(), step=52/49;
        const ijk=player.map(v=>Math.round((v+26)/step)), index=(ijk[0]*50+ijk[1])*50+ijk[2];
        const actual=new THREE.Vector3().fromBufferAttribute(cloud.geometry.attributes.position,index).toArray();
        window.qaCloud=cloud;
        window.roamSample={player,earth:u.uBodies.value[3].toArray().slice(0,3),time:u.uTime.value,active:u.uRoam.value,
          direction:camera.getWorldDirection(direction).toArray(),count:cloud.geometry.attributes.position.count,
          matches:player.every((v,i)=>Math.abs(v-actual[i])<.00001),calls:renderer.info.render.calls,points:renderer.info.render.points};
        if(u.uRoam.value && (!window.roamSample.matches || player.some(v=>Math.abs(v)>26.00001))) window.gridFailure=true;
      };
    });
    // Header double-click proves the gesture also works outside the canvas.
    await page.locator('h1').dblclick();
    await page.waitForFunction(() => document.body.classList.contains('is-roaming'));
    assert.equal(await page.evaluate(() => document.fullscreenElement?.id), 'hologram');
    assert.equal(await page.locator('#labels').isVisible(), false);
    assert.equal(await page.locator('#leaders').isVisible(), false);
    assert.equal(await page.locator('#rainbowCursor').isVisible(), false);
    await page.waitForFunction(() => window.cameraSample && window.roamSample?.active);
    const entry=await page.evaluate(()=>window.roamSample);
    assert.equal(entry.matches,true); assert.equal(entry.count,125000); assert.equal(entry.calls,1); assert.equal(entry.points,125000);
    assert.ok(entry.player.every((v,i)=>Math.abs(v-entry.earth[i])<=52/49/2+.001));
    const entryCamera=await page.evaluate(()=>window.cameraSample);
    assert.ok(Math.hypot(...entryCamera.map((v,i)=>v-entry.player[i]))>31);
    await page.evaluate(()=>{window.gridBefore=window.qaCloud.geometry.attributes.position.array.slice();document.querySelector('#pause').click();});
    await page.waitForFunction(earth=>window.roamSample.earth.some((v,i)=>Math.abs(v-earth[i])>.2),entry.earth);
    assert.deepEqual(await page.evaluate(()=>window.roamSample.player),entry.player);
    await page.evaluate(()=>document.querySelector('#pause').click());
    await page.screenshot({path:path.join(output,'roaming-entry.png')});
    const before = await page.evaluate(() => window.cameraSample);
    await page.mouse.move(800, 380, {steps:8});
    await page.waitForFunction(previous => window.cameraSample.some((v,i) => Math.abs(v-previous[i])>.1), before);
    const rotated = await page.evaluate(() => window.cameraSample);
    await page.mouse.wheel(0,-450);
    await page.waitForFunction(previous => window.cameraSample.some((v,i) => Math.abs(v-previous[i])>.1), rotated);
    await page.screenshot({path:path.join(output,'roaming.png')});
    const startMove=await page.evaluate(()=>window.roamSample);
    await page.keyboard.down('w');
    await page.waitForFunction(start=>Math.hypot(...window.roamSample.player.map((v,i)=>v-start[i]))>3,startMove.player);
    const moved=await page.evaluate(()=>window.roamSample);
    assert.ok(moved.player.reduce((sum,v,i)=>sum+(v-startMove.player[i])*startMove.direction[i],0)>2);
    await page.screenshot({path:path.join(output,'moving.png')});
    await page.waitForFunction(()=>window.roamSample.player.some(v=>Math.abs(v)>25.99),null,{timeout:25000});
    await page.keyboard.up('w');
    const stopped=await page.evaluate(()=>window.roamSample);
    await page.waitForFunction(t=>window.roamSample.time>t+.4,stopped.time);
    assert.deepEqual(await page.evaluate(()=>window.roamSample.player),stopped.player);
    assert.equal(await page.evaluate(()=>!!window.gridFailure),false);
    assert.equal(await page.evaluate(()=>window.gridBefore.every((v,i)=>v===window.qaCloud.geometry.attributes.position.array[i])),true);
    // A lost focus must clear W even if no keyup arrives.
    await page.keyboard.down('w');
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
    const blurred=await page.evaluate(()=>window.roamSample);
    await page.waitForFunction(t=>window.roamSample.time>t+.4,blurred.time);
    assert.deepEqual(await page.evaluate(()=>window.roamSample.player),blurred.player);
    await page.keyboard.up('w');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.body.classList.contains('is-roaming') && !document.fullscreenElement);
    assert.equal(await page.locator('#labels').isVisible(), true);
    assert.equal(await page.locator('#labels span').count(), 9);

    await page.locator('#fullscreen').click();
    await page.waitForFunction(() => document.fullscreenElement?.id==='hologram');
    await page.mouse.move(500,320);
    assert.equal(await page.locator('#rainbowCursor').evaluate(el=>el.parentElement.id), 'hologram');
    await page.locator('#fullscreen').click();
    await page.waitForFunction(() => !document.fullscreenElement);

    // Refused pointer lock must still allow movement without holding a button.
    await page.evaluate(() => { document.querySelector('#viewport').requestPointerLock=()=>Promise.reject(new Error('QA denial')); });
    for (let attempt=0;attempt<2;attempt++) {
      assert.equal(await page.locator('#density').isDisabled(), true);
      assert.equal(await page.locator('#pointCount').textContent(), '125,000');
      await page.locator('h1').dblclick();
      await page.waitForFunction(() => document.body.classList.contains('is-roaming'));
      await page.mouse.move(500,400);
      const start = await page.evaluate(() => window.cameraSample);
      await page.mouse.move(730,480,{steps:5});
      await page.waitForFunction(previous => window.cameraSample.some((v,i) => Math.abs(v-previous[i])>.1), start);
      await page.locator('#roamExit').click();
      await page.waitForFunction(() => !document.body.classList.contains('is-roaming') && !document.fullscreenElement);
    }
    // Permission failure leaves the original overview usable and offers retry.
    await page.evaluate(() => { document.querySelector('#hologram').requestFullscreen=()=>Promise.reject(new Error('QA denial')); });
    await page.locator('h1').dblclick();
    await page.waitForFunction(() => document.querySelector('#roamNotice').textContent.includes('retry'));
    assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('is-roaming')), false);
    await page.locator('#chartToggle').click();
    assert.equal(await page.locator('#planetCharts svg').count(), 1);
    assert.deepEqual(errors, []); assert.deepEqual(failed, []);
    console.log(JSON.stringify({passed:true,densities:[50],checks:['fixed density','16px flat cursor','5-second fade','fullscreen','labels hidden','mouse-look','wheel','32-unit camera distance','Earth spawn without following','W forward','grid alignment','boundary clamp','unchanged geometry','keyup and blur stop','Escape','exit button','permission failures','chart regression'],render:{calls:entry.calls,points:entry.points},screenshots:output}));
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
