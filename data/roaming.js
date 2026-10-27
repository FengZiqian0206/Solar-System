// One optional camera mode; the overview's orbit, zoom and follow state stay untouched.
export function createRoaming({ THREE, camera, viewport, getEarth, half, step, onStart }) {
  const hologram = document.querySelector('#hologram');
  const cursor = document.createElement('div');
  cursor.id = 'rainbowCursor';
  cursor.setAttribute('aria-hidden', 'true');
  cursor.innerHTML = '<i></i><span>Double-click to start</span>';
  document.body.append(cursor);
  const hud = document.createElement('div');
  hud.id = 'roamHud';
  hud.hidden = true;
  hud.innerHTML = '<span class="roam-instructions"><span class="roam-look-desktop">移动鼠标环顾 · MOVE MOUSE TO LOOK<br>滚轮缩放 · SCROLL TO ZOOM</span><span class="roam-look-touch">滑动环顾 · DRAG TO LOOK</span></span><button id="roamExit" type="button">退出漫游 · EXIT <kbd>Esc</kbd></button><div class="roam-forward"><button id="roamForward" type="button" aria-label="Hold W to move forward" aria-describedby="roamForwardHint" aria-keyshortcuts="W" aria-pressed="false">W</button><small id="roamForwardHint">HOLD W TO<br>MOVE FORWARD</small></div>';
  hologram.append(hud);
  const forwardButton = hud.querySelector('#roamForward'), movementInputs = new Set();
  const notice = document.createElement('div');
  notice.id = 'roamNotice';
  notice.setAttribute('role', 'status');
  hologram.append(notice);

  // Motion is integrated continuously, but only an existing lattice vertex is highlighted.
  // Nearby points can render off-grid; the player and base lattice stay on-grid.
  const position = new THREE.Vector3(), travel = new THREE.Vector3();
  const offset = new THREE.Vector3(), forward = new THREE.Vector3(), orbitRotation = new THREE.Euler(0,0,0,'YXZ');
  let active = false, pending = false, locked = false, moving = false, nativeFullscreen = false, yaw = Math.PI / 4, pitch = .24, distance = 40;
  let pointer = null, lookPointer = null, heldPointer = null, touchStart = null, lastTap = null, noticeTimer, lockPending = false;

  function setForward(source, pressed) {
    if(pressed)movementInputs.add(source);else movementInputs.delete(source);
    moving=movementInputs.size>0;
    forwardButton.classList.toggle('is-held',moving);
    forwardButton.setAttribute('aria-pressed',String(moving));
  }
  function stopMovement() {
    const id=heldPointer;heldPointer=null;
    movementInputs.clear();setForward('keyboard',false);
    if(id!==null && forwardButton.hasPointerCapture(id))forwardButton.releasePointerCapture(id);
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

  function notify(text) {
    notice.textContent = text;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { notice.textContent = ''; }, 6000);
  }
  function leave() {
    if (!active) return;
    active = false; locked = false; nativeFullscreen = false; stopMovement(); pointer = null; lookPointer = null;
    hud.hidden = true;
    document.body.classList.remove('is-roaming', 'has-rainbow-cursor');
    hologram.classList.remove('is-roaming');
    camera.position.set(0, 0, 78);
    camera.rotation.set(0, 0, 0);
    if (document.pointerLockElement === viewport) document.exitPointerLock();
    if (document.fullscreenElement === hologram) document.exitFullscreen().catch(() => {});
  }
  async function enter() {
    if (active || pending || !getEarth()) return;
    pending = true;
    try {
      // Pointer lock must be requested before fullscreen consumes this gesture's activation.
      const touchMode=matchMedia('(pointer:coarse)').matches;
      const lockAttempt=touchMode?Promise.resolve():requestLock();
      if (document.fullscreenElement !== hologram) {
        try { await hologram.requestFullscreen(); }
        catch(error) { if(!touchMode)throw error; }
      }
      nativeFullscreen=document.fullscreenElement===hologram;
      if (!nativeFullscreen && !touchMode) return;
      onStart();
      active = true; pointer = null; yaw = Math.PI / 4; pitch = .24;
      distance = 40; stopMovement(); lookPointer = null;
      travel.copy(getEarth().pos); snapToGrid(); travel.copy(position);
      hud.hidden = false;
      document.body.classList.add('is-roaming');
      hologram.classList.add('is-roaming');
      notice.textContent = '';
      await lockAttempt;
    } catch (_) {
      notify('无法进入全屏，请再次双击。 · Full screen unavailable. Double-click to retry.');
    } finally {
      pending = false;
      if(!active && document.pointerLockElement===viewport)document.exitPointerLock();
    }
  }
  document.addEventListener('dblclick', event => {
    if (event.target.closest('#roamExit,#roamForward')) return;
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
    if(event.pointerType==='touch' || event.pointerType==='pen') {
      if(lookPointer)return;
      event.preventDefault();lookPointer={id:event.pointerId,x:event.clientX,y:event.clientY};
      viewport.setPointerCapture(event.pointerId);
    }else if(document.pointerLockElement!==viewport)requestLock();
  });
  viewport.addEventListener('pointermove',event=>{
    if(!active || lookPointer?.id!==event.pointerId)return;
    rotate(event.clientX-lookPointer.x,event.clientY-lookPointer.y);
    lookPointer.x=event.clientX;lookPointer.y=event.clientY;
  });
  viewport.addEventListener('pointerup',event=>{
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
    cursor.classList.toggle('tip-left', event.clientX > innerWidth - 180);
    cursor.classList.toggle('tip-below', event.clientY < 42);
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
    if (active && event.code === 'KeyW' && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); setForward('keyboard',true); }
  });
  document.addEventListener('keyup', event => { if (event.code === 'KeyW') setForward('keyboard',false); });
  forwardButton.addEventListener('pointerdown',event=>{
    if(!active || event.button!==0 || heldPointer!==null)return;
    event.preventDefault();heldPointer=event.pointerId;
    forwardButton.setPointerCapture(event.pointerId);setForward('pointer',true);
  });
  forwardButton.addEventListener('contextmenu',event=>event.preventDefault());
  for(const type of ['pointerup','pointercancel','lostpointercapture'])forwardButton.addEventListener(type,event=>{
    if(event.pointerId===heldPointer){heldPointer=null;setForward('pointer',false);}
  });
  forwardButton.addEventListener('keydown',event=>{if(active && (event.code==='Space'||event.code==='Enter')){event.preventDefault();setForward('button-key',true);}});
  forwardButton.addEventListener('keyup',event=>{if(event.code==='Space'||event.code==='Enter'){event.preventDefault();setForward('button-key',false);}});
  forwardButton.addEventListener('blur',()=>setForward('button-key',false));
  hud.querySelector('#roamExit').addEventListener('click', leave);
  return {
    get active() { return active; },
    get zoom() { return 78 / distance; },
    position,
    influencePosition: travel,
    wheel(delta) {
      distance = Math.max(6, Math.min(90, distance * (delta < 0 ? .9 : 1.1)));
    },
    update(dt) {
      // If lock is refused, edge turning still permits continuous orbit without dragging.
      if(document.pointerLockElement!==viewport && pointer) {
        const edgeX=Math.max(0,(pointer.x-innerWidth+24)/24)-Math.max(0,(24-pointer.x)/24);
        const edgeY=Math.max(0,(pointer.y-innerHeight+24)/24)-Math.max(0,(24-pointer.y)/24);
        rotate(Math.max(-1,Math.min(1,edgeX))*dt*400,Math.max(-1,Math.min(1,edgeY))*dt*400);
      }
      aimCamera();
      if (moving) {
        camera.getWorldDirection(forward);
        travel.addScaledVector(forward, Math.min(dt, .1) * 6);
        snapToGrid();
        aimCamera();
      }
    }
  };
}
