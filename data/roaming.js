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
  hud.innerHTML = '<span>按住 W 前进 · HOLD W TO MOVE FORWARD<br>移动鼠标环顾 · MOVE MOUSE TO LOOK<br>滚轮缩放 · SCROLL TO ZOOM</span><button id="roamExit" type="button">退出漫游 · EXIT <kbd>Esc</kbd></button>';
  hologram.append(hud);
  const notice = document.createElement('div');
  notice.id = 'roamNotice';
  notice.setAttribute('role', 'status');
  hologram.append(notice);

  // Motion is integrated continuously, but only an existing lattice vertex is highlighted.
  // No point geometry is created, moved or removed.
  const position = new THREE.Vector3(), travel = new THREE.Vector3();
  const offset = new THREE.Vector3(), target = new THREE.Vector3(), up = new THREE.Vector3(), forward = new THREE.Vector3();
  let active = false, pending = false, locked = false, moving = false, yaw = Math.PI / 4, pitch = .24, distance = 32;
  let pointer = null, noticeTimer;

  function snapToGrid() {
    travel.clampScalar(-half, half);
    position.copy(travel).addScalar(half).divideScalar(step).round().multiplyScalar(step).addScalar(-half);
  }
  function aimCamera() {
    offset.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(distance);
    camera.position.copy(travel).add(offset);
    camera.zoom = 1;
    camera.lookAt(travel);
    up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    target.copy(travel).addScaledVector(up, distance * .10);
    camera.lookAt(target);
  }

  function notify(text) {
    notice.textContent = text;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { notice.textContent = ''; }, 6000);
  }
  function leave() {
    if (!active) return;
    active = false; locked = false; moving = false; pointer = null;
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
      // Called directly by double-click: retain the browser's user-activation permission.
      if (document.fullscreenElement !== hologram) await hologram.requestFullscreen();
      if (document.fullscreenElement !== hologram) return;
      onStart();
      active = true; pointer = null; yaw = Math.PI / 4; pitch = .24;
      distance = 32; moving = false;
      travel.copy(getEarth().pos); snapToGrid(); travel.copy(position);
      hud.hidden = false;
      document.body.classList.add('is-roaming');
      hologram.classList.add('is-roaming');
      notice.textContent = '';
      // Pointer lock is optional; ordinary mouse movement still works if it is refused.
      try { await viewport.requestPointerLock?.(); } catch (_) {}
    } catch (_) {
      notify('无法进入全屏，请再次双击。 · Full screen unavailable. Double-click to retry.');
    } finally { pending = false; }
  }
  document.addEventListener('dblclick', event => {
    if (event.target.closest('#roamExit')) return;
    event.preventDefault();
    enter();
  });
  document.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse') return;
    if (active) {
      const dx = document.pointerLockElement === viewport ? event.movementX : pointer ? event.clientX - pointer.x : 0;
      const dy = document.pointerLockElement === viewport ? event.movementY : pointer ? event.clientY - pointer.y : 0;
      pointer = { x: event.clientX, y: event.clientY };
      yaw -= Math.max(-120, Math.min(120, dx)) * .002;
      pitch = Math.max(-1.35, Math.min(1.35, pitch + Math.max(-120, Math.min(120, dy)) * .002));
      return;
    }
    cursor.style.left = `${event.clientX}px`;
    cursor.style.top = `${event.clientY}px`;
    cursor.classList.toggle('tip-left', event.clientX > innerWidth - 180);
    cursor.classList.toggle('tip-below', event.clientY < 42);
    document.body.classList.add('has-rainbow-cursor');
  });
  document.addEventListener('pointerout', event => {
    if (!event.relatedTarget) { pointer = null; document.body.classList.remove('has-rainbow-cursor'); }
  });
  window.addEventListener('blur', () => { moving = false; pointer = null; document.body.classList.remove('has-rainbow-cursor'); });
  document.addEventListener('visibilitychange', () => { if(document.hidden) moving = false; });
  document.addEventListener('fullscreenchange', () => {
    // Keep the custom cursor visible in the existing, non-roaming fullscreen mode too.
    (document.fullscreenElement || document.body).append(cursor);
    if (active && document.fullscreenElement !== hologram) leave();
  });
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === viewport) {
      if (!active) { document.exitPointerLock(); return; }
      locked = true;
    } else if (active && locked) leave();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') leave();
    if (active && event.code === 'KeyW' && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); moving = true; }
  });
  document.addEventListener('keyup', event => { if (event.code === 'KeyW') moving = false; });
  hud.querySelector('button').addEventListener('click', leave);
  return {
    get active() { return active; },
    get zoom() { return 78 / distance; },
    position,
    wheel(delta) {
      distance = Math.max(6, Math.min(90, distance * (delta < 0 ? .9 : 1.1)));
    },
    update(dt) {
      aimCamera();
      if (moving) {
        camera.getWorldDirection(forward);
        travel.addScaledVector(forward, Math.min(dt, .1) * 3);
        snapToGrid();
        aimCamera();
      }
    }
  };
}
