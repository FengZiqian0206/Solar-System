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
    });
    // Header double-click proves the gesture also works outside the canvas.
    await page.locator('h1').dblclick();
    await page.waitForFunction(() => document.body.classList.contains('is-roaming'));
    assert.equal(await page.evaluate(() => document.fullscreenElement?.id), 'hologram');
    assert.equal(await page.locator('#labels').isVisible(), false);
    assert.equal(await page.locator('#leaders').isVisible(), false);
    assert.equal(await page.locator('#rainbowCursor').isVisible(), false);
    await page.waitForFunction(() => window.cameraSample);
    await page.screenshot({path:path.join(output,'roaming-entry.png')});
    const before = await page.evaluate(() => window.cameraSample);
    await page.mouse.move(800, 380, {steps:8});
    await page.waitForFunction(previous => window.cameraSample.some((v,i) => Math.abs(v-previous[i])>.1), before);
    const rotated = await page.evaluate(() => window.cameraSample);
    await page.mouse.wheel(0,-450);
    await page.waitForFunction(previous => window.cameraSample.some((v,i) => Math.abs(v-previous[i])>.1), rotated);
    await page.screenshot({path:path.join(output,'roaming.png')});
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
    console.log(JSON.stringify({passed:true,densities:[50],checks:['fixed density','cursor','5-second fade','anywhere double-click','fullscreen','labels hidden','mouse-look without drag','wheel','Escape','exit button','permission failures','chart regression'],screenshots:output}));
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
