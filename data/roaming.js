// One optional camera mode; the overview's orbit, zoom and follow state stay untouched.
export function createRoaming({ THREE, camera, viewport, getEarth, half, step, onStart, onCollapse, onRegrow }) {
  const expansionDuration=.9,collapseEnd=expansionDuration+24,growthStart=collapseEnd+1,cycleEnd=growthStart+3;
  const hologram = document.querySelector('#hologram');
  const cursor = document.createElement('div');
  cursor.id = 'rainbowCursor';
  cursor.setAttribute('aria-hidden', 'true');
  cursor.innerHTML = '<i></i><svg class="cursor-guide" viewBox="0 0 130 60" aria-hidden="true"><polyline points="8,42 42,12 118,12"/></svg><span>Double-click to start</span>';
  document.body.append(cursor);
  const hud = document.createElement('div');
  hud.id = 'roamHud';
  hud.hidden = true;
  hud.innerHTML = '<span class="roam-instructions"><span class="roam-look-desktop">移动鼠标环顾 · MOVE MOUSE TO LOOK<br>滚轮缩放 · SCROLL TO ZOOM</span><span class="roam-look-touch">滑动环顾 · DRAG TO LOOK</span></span><button id="roamExit" type="button">退出漫游 · EXIT <kbd>Esc</kbd></button><div class="roam-movement"><div class="roam-keys"><button class="roam-key" id="roamForward" data-move="KeyW" type="button" aria-label="Hold W to move forward" aria-describedby="roamMoveHint" aria-keyshortcuts="W" aria-pressed="false">W</button><button class="roam-key" id="roamLeft" data-move="KeyA" type="button" aria-label="Hold A to move left" aria-describedby="roamMoveHint" aria-keyshortcuts="A" aria-pressed="false">A</button><button class="roam-key" id="roamBackward" data-move="KeyS" type="button" aria-label="Hold S to move backward" aria-describedby="roamMoveHint" aria-keyshortcuts="S" aria-pressed="false">S</button><button class="roam-key" id="roamRight" data-move="KeyD" type="button" aria-label="Hold D to move right" aria-describedby="roamMoveHint" aria-keyshortcuts="D" aria-pressed="false">D</button></div><small id="roamMoveHint">HOLD WASD TO<br>MOVE</small></div><div class="roam-collapse"><button id="roamCollapse" type="button" aria-label="看看会发生什么 · See what happens" aria-describedby="roamCollapseHint" aria-keyshortcuts="Space" aria-pressed="false">SPACE</button><small id="roamCollapseHint">看看会发生什么<br><span>SEE WHAT HAPPENS</span></small></div>';
  hologram.append(hud);
  const movementKeys = new Map(Array.from(hud.querySelectorAll('[data-move]'),button=>[button.dataset.move,{button,inputs:new Set(),pointer:null}]));
  const collapseButton = hud.querySelector('#roamCollapse');
  const notice = document.createElement('div');
  notice.id = 'roamNotice';
  notice.setAttribute('role', 'status');
  hologram.append(notice);

  // Motion is integrated continuously, but only an existing lattice vertex is highlighted.
  // Nearby points can render off-grid; the player and base lattice stay on-grid.
  const position = new THREE.Vector3(), travel = new THREE.Vector3();
  const offset = new THREE.Vector3(), forward = new THREE.Vector3(), right = new THREE.Vector3(), movement = new THREE.Vector3(), orbitRotation = new THREE.Euler(0,0,0,'YXZ');
  let active = false, pending = false, enteredOnce = false, locked = false, nativeFullscreen = false, yaw = Math.PI / 4, pitch = .24, distance = 48;
  let pointer = null, lookPointer = null, touchStart = null, lastTap = null, noticeTimer, lockPending = false;
  let collapseElapsed = -1;

  function setMovement(code, source, pressed) {
    const key=movementKeys.get(code);
    if(!key)return;
    if(pressed && collapseElapsed>=0)return;
    if(pressed)key.inputs.add(source);else key.inputs.delete(source);
    const held=key.inputs.size>0;
    key.button.classList.toggle('is-held',held);
    key.button.setAttribute('aria-pressed',String(held));
  }
  function stopMovement() {
    for(const [code,key] of movementKeys){
      const id=key.pointer;key.pointer=null;
      key.inputs.clear();setMovement(code,'keyboard',false);
      if(id!==null && key.button.hasPointerCapture(id))key.button.releasePointerCapture(id);
    }
  }
  function resetCollapse() {
    collapseElapsed=-1;for(const {button} of movementKeys.values())button.disabled=false;collapseButton.disabled=false;
    collapseButton.classList.remove('is-held');collapseButton.setAttribute('aria-pressed','false');
  }
  function startCollapse() {
    if(!active || collapseElapsed>=0)return;
    stopMovement();onCollapse?.();collapseElapsed=0;
    for(const {button} of movementKeys.values())button.disabled=true;collapseButton.disabled=true;
    collapseButton.classList.add('is-held');collapseButton.setAttribute('aria-pressed','true');
  }

  function snapToGrid() {
    travel.clampScalar(-half, half);
    position.copy(travel).addScalar(half).divideScalar(step).round().multiplyScalar(step).addScalar(-half);
  }
  function aimCamera() {
    // Orient the orbit directly, so passing a pole never depends on world-up lookAt.
    camera.quaternion.setFromEuler(orbitRotation.set(-pitch,yaw,0,'YXZ'));
    offset.set(0,0,distance).applyQuaternion(camera.quaternion);
    camera.position.copy(travel).add(offset);
    camera.zoom = 1;
    camera.rotateX(Math.atan(.10));
  }
  function rotate(dx,dy) {
    yaw = (yaw - Math.max(-120,Math.min(120,dx))*.002) % (Math.PI*2);
    pitch = (pitch + Math.max(-120,Math.min(120,dy))*.002) % (Math.PI*2);
  }
  function requestLock() {
    if(lockPending || document.pointerLockElement===viewport)return Promise.resolve();
    lockPending=true;
    try {
      return Promise.resolve(viewport.requestPointerLock?.()).catch(()=>{}).finally(()=>{lockPending=false;});
    } catch (_) { lockPending=false;return Promise.resolve(); }
  }
  async function requestImmersive(allowFallback=false) {
    const touchMode=matchMedia('(pointer:coarse)').matches;
    // Automatic entry cannot claim user activation; the first real gesture can upgrade it.
    const lockAttempt=!touchMode && (!allowFallback || navigator.userActivation?.isActive)?requestLock():Promise.resolve();
    if(document.fullscreenElement!==hologram) {
      try { await hologram.requestFullscreen(); }
      catch(error) { if(!allowFallback && !touchMode)throw error; }
    }
    if(!active && !pending) {
      if(document.fullscreenElement===hologram)document.exitFullscreen().catch(()=>{});
      if(document.pointerLockElement===viewport)document.exitPointerLock();
      return;
    }
    nativeFullscreen=document.fullscreenElement===hologram;
    await lockAttempt;
  }

  function notify(text) {
    notice.textContent = text;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { notice.textContent = ''; }, 6000);
  }
  function leave() {
    if (!active) return;
    active = false; locked = false; nativeFullscreen = false; stopMovement();resetCollapse(); pointer = null; lookPointer = null;touchStart=null;lastTap=null;
    document.querySelector('#density')?.removeAttribute('disabled');
    hud.hidden = true;
    document.body.classList.remove('is-roaming', 'has-rainbow-cursor');
    hologram.classList.remove('is-roaming');
    camera.position.set(0, 0, 78);
    camera.rotation.set(0, 0, 0);
    if (document.pointerLockElement === viewport) document.exitPointerLock();
    if (document.fullscreenElement === hologram) document.exitFullscreen().catch(() => {});
  }
  async function enter({automatic=false}={}) {
    if (active || pending || (automatic && enteredOnce) || !getEarth()) return;
    pending = true;
    try {
      const touchMode=matchMedia('(pointer:coarse)').matches;
      await requestImmersive(automatic);
      if (!nativeFullscreen && !touchMode && !automatic) return;
      onStart();
      active = true; enteredOnce = true;pointer = null; yaw = Math.PI / 4; pitch = .24;
      document.querySelector('#density')?.setAttribute('disabled','');
      distance = 48; stopMovement();resetCollapse(); lookPointer = null;
      travel.copy(getEarth().pos); snapToGrid(); travel.copy(position);
      hud.hidden = false;
      document.body.classList.add('is-roaming');
      hologram.classList.add('is-roaming');
      notice.textContent = '';
    } catch (_) {
      notify('无法进入全屏，请再次双击。 · Full screen unavailable. Double-click to retry.');
    } finally {
      pending = false;
      if(!active && document.pointerLockElement===viewport)document.exitPointerLock();
    }
  }
  document.addEventListener('dblclick', event => {
    if (event.target.closest('#roamExit,.roam-key,#roamCollapse')) return;
    event.preventDefault();
    enter();
  });
  document.addEventListener('mousemove', event => {
    if(!active || matchMedia('(pointer:coarse)').matches)return;
    const dx = document.pointerLockElement === viewport ? event.movementX : pointer ? event.clientX - pointer.x : 0;
    const dy = document.pointerLockElement === viewport ? event.movementY : pointer ? event.clientY - pointer.y : 0;
    pointer = { x: event.clientX, y: event.clientY };
    rotate(dx,dy);
  });
  viewport.addEventListener('pointerdown',event=>{
    if(!active){
      if(event.pointerType==='touch')touchStart={id:event.pointerId,x:event.clientX,y:event.clientY,time:performance.now()};
      return;
    }
    if(!nativeFullscreen || (event.pointerType==='mouse' && document.pointerLockElement!==viewport))requestImmersive(true);
    if(event.pointerType==='touch' || event.pointerType==='pen') {
      if(lookPointer)return;
      event.preventDefault();lookPointer={id:event.pointerId,x:event.clientX,y:event.clientY};
      viewport.setPointerCapture(event.pointerId);
    }
  });
  viewport.addEventListener('pointermove',event=>{
    if(!active || lookPointer?.id!==event.pointerId)return;
    rotate(event.clientX-lookPointer.x,event.clientY-lookPointer.y);
    lookPointer.x=event.clientX;lookPointer.y=event.clientY;
  });
  viewport.addEventListener('pointerup',event=>{
    if(active && !nativeFullscreen)requestImmersive(true);
    // Some touch browsers do not synthesize dblclick; detect a short double-tap too.
    if(!active && touchStart?.id===event.pointerId){
      const now=performance.now(),tap=touchStart;touchStart=null;
      if(now-tap.time<300 && Math.hypot(event.clientX-tap.x,event.clientY-tap.y)<18){
        if(lastTap && now-lastTap.time<350 && Math.hypot(event.clientX-lastTap.x,event.clientY-lastTap.y)<24){lastTap=null;enter();}
        else lastTap={time:now,x:event.clientX,y:event.clientY};
      }else lastTap=null;
    }
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(type,event=>{if(lookPointer?.id===event.pointerId)lookPointer=null;});
  viewport.addEventListener('pointercancel',()=>{touchStart=null;lastTap=null;});
  document.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || active) return;
    cursor.style.left = `${event.clientX}px`;
    cursor.style.top = `${event.clientY}px`;
    cursor.classList.toggle('tip-left', event.clientX > innerWidth - 260);
    cursor.classList.toggle('tip-below', event.clientY < 56);
    document.body.classList.add('has-rainbow-cursor');
  });
  document.addEventListener('pointerout', event => {
    if (!event.relatedTarget) { pointer = null; document.body.classList.remove('has-rainbow-cursor'); }
  });
  window.addEventListener('blur', () => { stopMovement(); pointer = null; lookPointer = null; document.body.classList.remove('has-rainbow-cursor'); });
  document.addEventListener('visibilitychange', () => { if(document.hidden) { stopMovement();lookPointer=null; } });
  document.addEventListener('fullscreenchange', () => {
    // Keep the custom cursor visible in the existing, non-roaming fullscreen mode too.
    (document.fullscreenElement || document.body).append(cursor);
    if (active && nativeFullscreen && document.fullscreenElement !== hologram) leave();
  });
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === viewport) {
      if (!active && !pending) { document.exitPointerLock(); return; }
      locked = true;pointer = null;
    } else if (active && locked) leave();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') leave();
    if(active && event.code==='Space' && !event.ctrlKey && !event.metaKey && !event.altKey){
      event.preventDefault();
      if(!event.repeat&&collapseElapsed<0){requestImmersive(true);startCollapse();}
    }
    if (active && movementKeys.has(event.code) && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); if(collapseElapsed<0){if(!event.repeat)requestImmersive(true);setMovement(event.code,'keyboard',true);} }
  });
  document.addEventListener('keyup', event => setMovement(event.code,'keyboard',false));
  for(const [code,key] of movementKeys){
    const button=key.button;
    button.addEventListener('pointerdown',event=>{
      if(!active || collapseElapsed>=0 || event.button!==0 || key.pointer!==null)return;
      event.preventDefault();key.pointer=event.pointerId;
      button.setPointerCapture(event.pointerId);setMovement(code,'pointer',true);
    });
    button.addEventListener('contextmenu',event=>event.preventDefault());
    for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,event=>{
      if(event.pointerId===key.pointer){
        if(type==='pointerup' && active && !nativeFullscreen)requestImmersive(true);
        key.pointer=null;setMovement(code,'pointer',false);
      }
    });
    button.addEventListener('keydown',event=>{if(active && event.code==='Enter'){event.preventDefault();setMovement(code,'button-key',true);}});
    button.addEventListener('keyup',event=>{if(event.code==='Enter'){event.preventDefault();setMovement(code,'button-key',false);}});
    button.addEventListener('blur',()=>setMovement(code,'button-key',false));
  }
  collapseButton.addEventListener('pointerdown',event=>{if(active && event.button===0){event.preventDefault();startCollapse();}});
  collapseButton.addEventListener('pointerup',()=>{if(active && !nativeFullscreen)requestImmersive(true);});
  collapseButton.addEventListener('click',event=>{if(event.detail===0)startCollapse();});
  collapseButton.addEventListener('contextmenu',event=>event.preventDefault());
  hud.querySelector('#roamExit').addEventListener('click', leave);
  return {
    enter,
    get active() { return active; },
    get collapsing() { return collapseElapsed>=0; },
    get collapseProgress() { return collapseElapsed<0||collapseElapsed>=growthStart?0:collapseElapsed>=collapseEnd?1:Math.max(0,(collapseElapsed-expansionDuration)/24); },
    get expansion() { return collapseElapsed<0||collapseElapsed>=expansionDuration?0:Math.sin(Math.PI*collapseElapsed/expansionDuration)**2; },
    get growth() { return collapseElapsed<growthStart?1:Math.min(1,(collapseElapsed-growthStart)/3); },
    setGrid(nextStep) { if(!active)step=nextStep; },
    get zoom() { return 78 / distance; },
    position,
    influencePosition: travel,
    wheel(delta) {
      distance = Math.max(6, Math.min(90, distance * (delta < 0 ? .9 : 1.1)));
    },
    update(dt, elapsed=dt) {
      if(collapseElapsed>=0){
        const before=collapseElapsed;let next=Math.min(cycleEnd,collapseElapsed+Math.max(0,elapsed));
        // Render the completed black scene and its growth origin even after a slow frame.
        if(before<collapseEnd&&next>=collapseEnd)next=collapseEnd;
        else if(before<growthStart&&next>=growthStart)next=growthStart;
        collapseElapsed=next;
        if(before<growthStart&&collapseElapsed>=growthStart)onRegrow?.();
        if(collapseElapsed>=cycleEnd)resetCollapse();
      }
      // If lock is refused, edge turning still permits continuous orbit without dragging.
      if(document.pointerLockElement!==viewport && pointer) {
        const edgeX=Math.max(0,(pointer.x-innerWidth+24)/24)-Math.max(0,(24-pointer.x)/24);
        const edgeY=Math.max(0,(pointer.y-innerHeight+24)/24)-Math.max(0,(24-pointer.y)/24);
        rotate(Math.max(-1,Math.min(1,edgeX))*dt*400,Math.max(-1,Math.min(1,edgeY))*dt*400);
      }
      aimCamera();
      const forwardAxis=Number(movementKeys.get('KeyW').inputs.size>0)-Number(movementKeys.get('KeyS').inputs.size>0);
      const rightAxis=Number(movementKeys.get('KeyD').inputs.size>0)-Number(movementKeys.get('KeyA').inputs.size>0);
      if (forwardAxis || rightAxis) {
        camera.getWorldDirection(forward);
        right.set(1,0,0).applyQuaternion(camera.quaternion);
        movement.copy(forward).multiplyScalar(forwardAxis).addScaledVector(right,rightAxis).normalize();
        travel.addScaledVector(movement, Math.min(dt, .1) * 6);
        snapToGrid();
        aimCamera();
      }
    }
  };
}
